import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementComposer } from "@/components/announcements/announcement-composer";
import { SEND_ERRORS } from "@/components/announcements/announcements-api";
import { MESSAGE_MAX_LENGTH } from "@/features/messaging/contracts";
import {
  BLOOD,
  BROADCAST_ID,
  apiError,
  audience,
  respond,
  stubFetch,
  summary,
  type Call,
} from "./fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const AUDIENCE = "/api/messages/announcements/audience";
const BROADCASTS = "/api/messages/announcements";

// Answers the audience endpoint with `count(serviceIds)` patients and the
// create endpoint with `create()`.
function serve({
  count = () => 12,
  create = () => respond(summary({ status: "SENDING" }), 201),
}: {
  count?: (serviceIds: string[]) => number;
  create?: (call: Call) => Promise<Response>;
} = {}) {
  return stubFetch((call) => {
    if (call.url.startsWith(AUDIENCE)) {
      const query = new URL(call.url, "http://test").searchParams;
      const ids = query.get("serviceIds")?.split(",") ?? [];
      const base = audience();
      return respond({
        eligible: count(ids),
        services: ids.length
          ? base.services.filter((s) => ids.includes(s.serviceId))
          : base.services,
      });
    }
    if (call.url === BROADCASTS && call.method === "POST") return create(call);
    return apiError("NOT_FOUND", "Nope", 404);
  });
}

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <AnnouncementComposer
      open={open}
      onOpenChange={setOpen}
      basePath="/receptionist/announcements"
    />
  );
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const message = () => screen.getByRole("textbox", { name: "Message" });
const type = (text: string) =>
  fireEvent.change(message(), { target: { value: text } });
const sendButton = () =>
  screen.getByRole("button", { name: /Send announcement|Try again/ });
const posts = (calls: Call[]) => calls.filter((c) => c.method === "POST");
const footerAlert = () =>
  screen.getAllByRole("alert").find((el) => el.dataset.slot === "alert");

async function countShown(count: string) {
  await waitFor(() =>
    expect(screen.getByText(/will get this/)).toHaveTextContent(
      new RegExp(`^${count} patients? will get this$`),
    ),
  );
}

async function confirmSend(count = "12 patients") {
  fireEvent.click(sendButton());
  const dialog = await screen.findByRole("alertdialog");
  fireEvent.click(
    within(dialog).getByRole("button", { name: `Send to ${count}` }),
  );
}

describe("AnnouncementComposer", () => {
  it("counts characters against the 1,000 limit", async () => {
    const calls = serve();
    render(<Harness />);

    type("Hello");
    expect(message()).toHaveAccessibleDescription(/5 of 1,000 characters/);

    type("x".repeat(MESSAGE_MAX_LENGTH + 1));
    expect(message()).toHaveAccessibleDescription(
      /1,001 of 1,000 characters · 1 over the limit/,
    );
    expect(message()).toHaveAttribute("aria-invalid", "true");

    await countShown("12");
    fireEvent.click(sendButton());
    expect(
      await screen.findByText("Keep it under 1,000 characters."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(posts(calls)).toHaveLength(0);
  });

  it("asks for a message before sending", async () => {
    serve();
    render(<Harness />);

    fireEvent.click(sendButton());

    expect(await screen.findByText("Write a message first.")).toBeVisible();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the live count for all services and for chosen ones", async () => {
    const calls = serve({
      count: (ids) => (ids.length === 0 ? 12 : ids.includes(BLOOD) ? 3 : 9),
    });
    render(<Harness />);

    await countShown("12");
    expect(
      screen.getByRole("radio", { name: /All services/ }),
    ).toHaveAccessibleName(/^All services.*12 patients$/);

    fireEvent.click(screen.getByRole("radio", { name: "Chosen services" }));
    // No service chosen yet: nobody would get it.
    await countShown("0");

    fireEvent.click(screen.getByRole("checkbox", { name: /Blood test/ }));
    await countShown("3");
    // The server is asked for exactly that choice.
    await waitFor(() =>
      expect(calls.map((c) => c.url)).toContain(
        `${AUDIENCE}?serviceIds=${BLOOD}`,
      ),
    );
  });

  it("asks to choose a service when Chosen services has none", async () => {
    const calls = serve();
    render(<Harness />);
    type("Delay today");
    await countShown("12");

    fireEvent.click(screen.getByRole("radio", { name: "Chosen services" }));
    fireEvent.click(sendButton());

    expect(
      await screen.findByText(
        "Choose at least one service, or send to all services.",
      ),
    ).toBeVisible();
    expect(posts(calls)).toHaveLength(0);
  });

  it("previews the message as the patient sees it", () => {
    serve();
    render(<Harness />);

    type("  Doctor is late.\n\n\n\nSorry!  ");

    const preview = screen
      .getByText("Preview: what each patient sees")
      .closest("figure")!;
    expect(within(preview).getAllByText("Reception").length).toBeGreaterThan(0);
    // Stored text: trimmed, blank lines collapsed.
    expect(within(preview).getByText(/Doctor is late/).textContent).toBe(
      "Doctor is late.\n\nSorry!",
    );
  });

  it("sends only after the confirmation, which explains the privacy", async () => {
    const calls = serve();
    render(<Harness />);
    type("The doctor is running 20 minutes late.");
    await countShown("12");

    fireEvent.click(sendButton());
    const dialog = await screen.findByRole("alertdialog");

    expect(dialog).toHaveAccessibleName("Send to 12 patients?");
    expect(dialog).toHaveTextContent(
      "Each patient gets it as a separate private message in their own reception chat. They can't see who else got it.",
    );
    expect(dialog).toHaveTextContent("All services");
    expect(posts(calls)).toHaveLength(0);

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Send to 12 patients" }),
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/receptionist/announcements/${BROADCAST_ID}`,
      ),
    );
    expect(posts(calls)).toHaveLength(1);
    expect(posts(calls)[0].body).toEqual({
      idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
      body: "The doctor is running 20 minutes late.",
      serviceIds: [],
    });
  });

  it("can go back from the confirmation without sending", async () => {
    const calls = serve();
    render(<Harness />);
    type("Delay today");
    await countShown("12");

    fireEvent.click(sendButton());
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Go back" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(posts(calls)).toHaveLength(0);
    expect(message()).toHaveValue("Delay today");
  });

  it("reuses the idempotency key on retry and starts a new one after", async () => {
    let attempt = 0;
    const calls = serve({
      create: () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new TypeError("Failed to fetch"))
          : respond(summary(), attempt === 2 ? 200 : 201);
      },
    });
    render(<Harness />);
    type("Delay today");
    await countShown("12");

    await confirmSend();
    await waitFor(() =>
      expect(footerAlert()).toHaveTextContent(SEND_ERRORS.network),
    );
    expect(sendButton()).toHaveTextContent("Try again");
    // The draft is still there to retry.
    expect(message()).toHaveValue("Delay today");

    await confirmSend();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const [first, retry] = posts(calls);
    expect(retry.body).toEqual(first.body);

    // A new announcement from the reopened composer gets its own key.
    fireEvent.click(screen.getByRole("button", { name: "New announcement" }));
    await waitFor(() => expect(message()).toHaveValue(""));
    type("Another one");
    await countShown("12");
    await confirmSend();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(2));
    const next = posts(calls)[2].body as { idempotencyKey: string };
    expect(next.idempotencyKey).not.toBe(
      (first.body as { idempotencyKey: string }).idempotencyKey,
    );
  });

  it("sends once when the confirm button is clicked twice", async () => {
    let release!: () => void;
    const calls = serve({
      create: () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(new Response(JSON.stringify(summary())));
        }),
    });
    render(<Harness />);
    type("Delay today");
    await countShown("12");

    fireEvent.click(sendButton());
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", {
      name: "Send to 12 patients",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(
      await screen.findByRole("button", { name: /Sending/ }),
    ).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(posts(calls)).toHaveLength(1);
  });

  it("explains the rate limit", async () => {
    serve({
      create: () =>
        apiError("RATE_LIMITED", "Too many requests. Slow down.", 429),
    });
    render(<Harness />);
    type("Delay today");
    await countShown("12");

    await confirmSend();

    await waitFor(() =>
      expect(footerAlert()).toHaveTextContent(SEND_ERRORS.rateLimited),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("says so when nobody is waiting, without asking to confirm", async () => {
    const calls = serve({ count: () => 0 });
    render(<Harness />);
    type("Delay today");
    await countShown("0");

    fireEvent.click(sendButton());

    await waitFor(() =>
      expect(footerAlert()).toHaveTextContent(SEND_ERRORS.noRecipients),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(posts(calls)).toHaveLength(0);
  });

  it("explains a server VALIDATION_ERROR when everyone left meanwhile", async () => {
    let eligible = 12;
    serve({
      count: () => eligible,
      create: () => {
        eligible = 0;
        return apiError(
          "VALIDATION_ERROR",
          "No patients to send this to.",
          400,
        );
      },
    });
    render(<Harness />);
    type("Delay today");
    await countShown("12");

    await confirmSend();

    await waitFor(() =>
      expect(footerAlert()).toHaveTextContent(SEND_ERRORS.noRecipients),
    );
    await countShown("0");
  });

  it("shows the server's message for other validation errors", async () => {
    serve({
      create: () =>
        apiError("VALIDATION_ERROR", "That service is turned off.", 400),
    });
    render(<Harness />);
    type("Delay today");
    await countShown("12");

    await confirmSend();

    await waitFor(() =>
      expect(footerAlert()).toHaveTextContent("That service is turned off."),
    );
  });
});
