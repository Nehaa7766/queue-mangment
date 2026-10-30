import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveQueue } from "@/components/queue/live-queue";
import { NOW, queueView, staffToken } from "./fixtures";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));
const { toast } = await import("sonner");

function respond(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Fake only the clock, so the fixture times are "now" and timers stay real.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderQueue(view = queueView()) {
  return render(
    <LiveQueue
      initialView={view}
      queues={[view.queue]}
      initialNow={NOW}
      timezone="Asia/Kolkata"
    />,
  );
}

const callNextButton = () => screen.getByRole("button", { name: /Call next/ });
const ticket = () => screen.getByRole("region", { name: "Now serving" });

describe("LiveQueue", () => {
  it("disables Call next with the reason when the queue is paused", () => {
    renderQueue(queueView({ queue: { status: "PAUSED" } as never }));

    expect(callNextButton()).toBeDisabled();
    expect(callNextButton()).toHaveAccessibleDescription(/queue is paused/i);
  });

  it("disables Call next with the reason when no one is waiting", () => {
    renderQueue(queueView({ waiting: [] }));

    expect(callNextButton()).toBeDisabled();
    expect(callNextButton()).toHaveAccessibleDescription("No one is waiting.");
  });

  it("calls the next patient with the N key, optimistically", async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((r) => (resolve = r)),
    );
    fetchMock.mockImplementation(() => respond(200, queueView()));
    renderQueue();

    fireEvent.keyDown(window, { key: "n" });

    // Before the server answers, A-18 is already on the ticket.
    expect(ticket()).toHaveTextContent("A-18");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/queues/11111111-1111-4111-8111-111111111111/call-next",
      expect.objectContaining({ method: "POST" }),
    );

    await act(async () => {
      resolve(
        await respond(200, {
          token: staffToken({
            id: "18",
            status: "CALLED",
            calledAt: new Date(NOW).toISOString(),
          }),
        }),
      );
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Called A-18 · Patient 18."),
    );
  });

  it("ignores N while typing in a field", () => {
    renderQueue();
    const input = document.createElement("input");
    document.body.append(input);

    fireEvent.keyDown(input, { key: "n" });

    expect(fetchMock).not.toHaveBeenCalled();
    input.remove();
  });

  it("rolls back and shows an error toast when the call fails", async () => {
    fetchMock.mockImplementationOnce(() =>
      respond(500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong.",
          requestId: "r",
        },
      }),
    );
    fetchMock.mockImplementation(() => respond(500, {}));
    renderQueue();

    fireEvent.click(callNextButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Something went wrong."),
    );
    // A-17 is back on the ticket and A-18 is back in Up next.
    expect(ticket()).toHaveTextContent("A-17");
    const upNext = screen.getByRole("tabpanel", { name: /Up next/ });
    expect(within(upNext).getByText("A-18")).toBeInTheDocument();
  });

  it("refreshes and explains a conflict when someone else acted first", async () => {
    fetchMock.mockImplementationOnce(() =>
      respond(409, {
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: "That token was already called.",
          requestId: "r",
        },
      }),
    );
    const fresh = queueView({ waiting: [staffToken({ id: "19" })] });
    fetchMock.mockImplementation(() => respond(200, fresh));
    renderQueue();

    fireEvent.click(callNextButton());

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "That token was already called. The queue has been refreshed.",
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/queues/11111111-1111-4111-8111-111111111111/tokens",
        expect.objectContaining({ method: "GET" }),
      ),
    );
  });
});

// 05:30–05:42 UTC is 11:00–11:12 in Asia/Kolkata.
const completed = staffToken({
  id: "13",
  status: "COMPLETED",
  calledAt: "2026-10-30T05:28:00Z",
  serviceStartedAt: "2026-10-30T05:30:00Z",
  completedAt: "2026-10-30T05:42:00Z",
  assignedDoctorName: "Dr. Shah",
});

const withDoctor = staffToken({
  id: "15",
  status: "IN_SERVICE",
  calledAt: "2026-10-30T05:44:00Z",
  serviceStartedAt: "2026-10-30T05:46:00Z",
  assignedDoctorName: "Dr. Rao",
});

const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("LiveQueue patient tabs", () => {
  it("shows today's patients by stage, with a count on each tab", () => {
    renderQueue(
      queueView({
        current: [
          withDoctor,
          staffToken({
            id: "17",
            status: "CALLED",
            calledAt: "2026-10-30T05:58:00Z",
          }),
        ],
        completedToday: [completed],
        missedToday: [staffToken({ id: "12", status: "SKIPPED" })],
      }),
    );

    expect(tab(/^Up next/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Up next/)).toHaveTextContent("2");
    expect(tab(/^In consultation/)).toHaveTextContent("1");
    expect(tab(/^Completed/)).toHaveTextContent("1");
    expect(tab(/^No-show/)).toHaveTextContent("1");

    fireEvent.click(tab(/^In consultation/));
    const withDoctors = screen.getByRole("tabpanel");
    expect(withDoctors).toHaveTextContent("A-15");
    expect(withDoctors).toHaveTextContent("Started 11:16 · with Dr. Rao");

    fireEvent.click(tab(/^Completed/));
    const done = screen.getByRole("tabpanel", { name: /Completed/ });
    expect(done).toHaveTextContent("A-13");
    expect(done).toHaveTextContent("Completed 11:12 · Dr. Shah · General");
    expect(done).toHaveTextContent("12 min");
  });

  it("moves between tabs with the arrow keys", () => {
    renderQueue();

    fireEvent.keyDown(tab(/^Up next/), { key: "ArrowLeft" });

    const missed = tab(/^No-show/);
    expect(missed).toHaveAttribute("aria-selected", "true");
    expect(missed).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "No no-shows or cancellations today.",
    );
  });

  it("lists a skipped patient under No-show before the server answers", async () => {
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((r) => (resolve = r)),
    );
    fetchMock.mockImplementation(() => respond(200, queueView()));
    renderQueue();

    fireEvent.click(within(ticket()).getByRole("button", { name: "Skip" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip patient" }));

    expect(tab(/^No-show/)).toHaveTextContent("1");
    fireEvent.click(tab(/^No-show/));
    const row = within(screen.getByRole("tabpanel"))
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes("A-17"));
    expect(row).toHaveTextContent("No-show");
    expect(
      within(row!).getByRole("button", { name: "Requeue" }),
    ).toBeInTheDocument();

    await act(async () => {
      resolve(
        await respond(200, {
          token: staffToken({ id: "17", status: "SKIPPED" }),
        }),
      );
    });
  });

  it("shows a consultation the doctor completed under Completed after the next poll", async () => {
    const before = queueView({ current: [withDoctor] });
    const finished = {
      ...withDoctor,
      status: "COMPLETED" as const,
      completedAt: "2026-10-30T05:58:00Z",
    };
    fetchMock.mockImplementation(() =>
      respond(
        200,
        queueView({ current: [], completedToday: [finished, completed] }),
      ),
    );
    renderQueue(before);
    expect(tab(/^In consultation/)).toHaveTextContent("1");
    expect(tab(/^Completed/)).toHaveTextContent("0");

    // The poll runs when the tab becomes visible, as well as every 10 s.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(tab(/^Completed/)).toHaveTextContent("2"));
    expect(tab(/^In consultation/)).toHaveTextContent("0");
    fireEvent.click(tab(/^Completed/));
    const rows = within(screen.getByRole("tabpanel")).getAllByRole("listitem");
    // Newest first, with the doctor and the consultation length.
    expect(rows[0]).toHaveTextContent("A-15");
    expect(rows[0]).toHaveTextContent("Completed 11:28 · Dr. Rao");
    expect(rows[0]).toHaveTextContent("12 min");
    expect(rows[1]).toHaveTextContent("A-13");
  });
});
