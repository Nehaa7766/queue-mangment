import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JoinQueueForm } from "@/components/patient/join-queue-form";
import type { PublicServiceView } from "@/features/queue/contracts";
import {
  errorResponse,
  jsonResponse,
  makeService,
  makeToken,
} from "./fixtures";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

type JoinableService = PublicServiceView & {
  queue: NonNullable<PublicServiceView["queue"]>;
};

const fetchMock = vi.fn<typeof fetch>();

function renderForm(
  options: { service?: JoinableService; clinicOpen?: boolean } = {},
) {
  const service = options.service ?? (makeService() as JoinableService);
  return render(
    <JoinQueueForm
      clinicSlug="demo-clinic"
      clinicName="Demo Clinic"
      clinicOpen={options.clinicOpen ?? true}
      service={service}
    />,
  );
}

function submitButton() {
  return screen.getByRole("button", { name: /Join queue|Joining/ });
}

function idempotencyKeyOf(call: number): string {
  const init = fetchMock.mock.calls[call]?.[1];
  return (init?.headers as Record<string, string>)["idempotency-key"];
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  push.mockReset();
});

describe("JoinQueueForm", () => {
  it("joins and opens the token page", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: makeToken({ publicTokenId: "tok-1" }) }, 201),
    );
    renderForm();

    fireEvent.change(screen.getByLabelText(/First name or initials/), {
      target: { value: "  Priya  " },
    });
    fireEvent.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/token/tok-1"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/queues/queue-general/tokens");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ patientName: "Priya" });
    expect(idempotencyKeyOf(0)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends no name when the field is left blank", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: makeToken({ publicTokenId: "tok-2" }) }, 201),
    );
    renderForm();

    fireEvent.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({});
  });

  it("rejects a name longer than 80 characters without calling the API", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/First name or initials/), {
      target: { value: "x".repeat(81) },
    });
    fireEvent.click(submitButton());

    expect(
      screen.getByText("Please use 80 characters or fewer."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only one request when submitted twice quickly", async () => {
    let resolve: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((done) => {
        resolve = done;
      }),
    );
    renderForm();

    const form = submitButton().closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.click(submitButton());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveTextContent("Joining…");

    resolve(
      jsonResponse({ token: makeToken({ publicTokenId: "tok-3" }) }, 201),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/token/tok-3"));
  });

  it("reuses the same key when retrying after a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: makeToken({ publicTokenId: "tok-4" }) }, 201),
    );
    renderForm();

    fireEvent.click(submitButton());
    expect(
      await screen.findByText(/couldn't reach the clinic/),
    ).toBeInTheDocument();

    fireEvent.click(submitButton());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/token/tok-4"));
    expect(idempotencyKeyOf(1)).toBe(idempotencyKeyOf(0));
  });

  it.each([
    ["QUEUE_PAUSED", 409, /paused for a few minutes/],
    ["QUEUE_CLOSED", 409, /isn't taking new patients/],
    ["RATE_LIMITED", 429, /Too many attempts/],
  ])("explains %s in plain language", async (code, status, text) => {
    fetchMock.mockResolvedValueOnce(errorResponse(code, status));
    renderForm();

    fireEvent.click(submitButton());

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("starts a fresh attempt after a definite rejection", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse("RATE_LIMITED", 429));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: makeToken({ publicTokenId: "tok-5" }) }, 201),
    );
    renderForm();

    fireEvent.click(submitButton());
    await screen.findByText(/Too many attempts/);
    fireEvent.click(submitButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/token/tok-5"));
    expect(idempotencyKeyOf(1)).not.toBe(idempotencyKeyOf(0));
  });

  it("disables joining when the queue is paused", () => {
    const paused = makeService({
      queue: {
        queueId: "queue-general",
        status: "PAUSED",
        waitingCount: 2,
        estimate: { minMinutes: 5, maxMinutes: 10, isRough: false },
      },
    }) as JoinableService;
    renderForm({ service: paused });

    expect(submitButton()).toBeDisabled();
    expect(
      screen.getAllByText(/paused for a few minutes/).length,
    ).toBeGreaterThan(0);
  });

  it("disables joining while the clinic is closed", () => {
    renderForm({ clinicOpen: false });

    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(/clinic is closed right now/)).toBeInTheDocument();
  });

  it("shows the privacy notice", () => {
    renderForm();

    expect(
      screen.getByText(/don't ask for your phone number/),
    ).toBeInTheDocument();
  });
});
