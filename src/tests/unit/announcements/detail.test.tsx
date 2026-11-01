import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementDetailScreen } from "@/components/announcements/announcement-detail";
import { LIVE_POLL_MS } from "@/components/announcements/use-broadcast-live";
import {
  BROADCAST_ID,
  FakeEventSource,
  NOW,
  TIMEZONE,
  apiError,
  detail,
  recipient,
  respond,
  stubFetch,
  withShell,
} from "./fixtures";

const DETAIL_URL = `/api/messages/announcements/${BROADCAST_ID}`;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  FakeEventSource.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderDetail() {
  return render(
    withShell(
      <AnnouncementDetailScreen
        broadcastId={BROADCAST_ID}
        basePath="/receptionist/announcements"
        crumbs={[{ label: "Reception", href: "/receptionist" }]}
        timeZone={TIMEZONE}
      />,
    ),
  );
}

// The StatCard whose label is `label`, e.g. "Skipped".
function stat(label: string) {
  const card = screen
    .getAllByRole("article")
    .find((article) => within(article).queryByText(label, { selector: "p" }));
  if (!card) throw new Error(`No stat card ${label}`);
  return card;
}

const sending = detail({
  status: "SENDING",
  counts: { total: 6, pending: 2, sent: 2, skipped: 1, failed: 1, seen: 1 },
  recipients: [
    recipient("t1", "A-1", "Ravi", "SENT", { seen: true }),
    recipient("t2", "A-2", "Meena", "SENT"),
    recipient("t3", "A-3", "Kiran", "SKIPPED", { skipReason: "CHAT_CLOSED" }),
    recipient("t4", "B-1", "Sunil", "FAILED"),
    recipient("t5", "B-2", "Lata", "PENDING"),
    recipient("t6", "B-3", "Asha", "PENDING"),
  ],
});

describe("AnnouncementDetailScreen", () => {
  it("shows the counts, the skip reasons and every recipient", async () => {
    stubFetch(() => respond(detail()));
    renderDetail();

    expect(await screen.findByText(/All 6 patients handled\./)).toBeVisible();
    expect(stat("Patients")).toHaveTextContent(/^6Patients/);
    expect(stat("Sent")).toHaveTextContent(/^3Sent/);
    expect(stat("Seen")).toHaveTextContent(/^2Seen/);
    expect(stat("Skipped")).toHaveTextContent(/^2Skipped/);
    expect(stat("Failed")).toHaveTextContent(/^1Failed/);
    expect(stat("Pending")).toHaveTextContent(/^0Pending/);

    const reasons = screen.getByRole("region", {
      name: "Why some were skipped",
    });
    expect(
      within(reasons).getByText("Visit had ended").nextSibling,
    ).toHaveTextContent("1");
    expect(
      within(reasons).getByText("Already with the doctor").nextSibling,
    ).toHaveTextContent("1");
    expect(within(reasons).queryByText("Chat was closed")).toBeNull();

    // Message, sender and audience.
    expect(screen.getByText(/running 20 minutes late/)).toBeVisible();
    expect(
      screen.getByText("Today, 10:20 · by Asha Reception · All services"),
    ).toBeVisible();

    const table = screen.getByRole("table", { name: "Recipients" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(6);
    const row = (label: string) =>
      rows.find((r) => within(r).queryByRole("link", { name: label }))!;
    expect(row("A-1")).toHaveTextContent("Ravi");
    expect(row("A-1")).toHaveTextContent(/Sent.*Seen$/);
    // No name on file, and stored but not read yet: still Sent, not failed.
    expect(row("A-3")).toHaveTextContent("Patient");
    expect(row("A-3")).toHaveTextContent(/Sent.*Not seen yet$/);
    expect(row("A-4")).toHaveTextContent(/Skipped.*Visit had ended/);
    expect(row("B-1")).toHaveTextContent(/Skipped.*Already with the doctor/);
    expect(row("B-2")).toHaveTextContent(/Failed.*Not stored after 5 tries/);
    expect(within(row("A-1")).getByRole("link")).toHaveAttribute(
      "href",
      "/receptionist/tokens/t1",
    );
  });

  it("filters the recipients by status", async () => {
    stubFetch(() => respond(detail()));
    renderDetail();
    await screen.findByRole("table", { name: "Recipients" });

    const filters = screen.getByRole("group", { name: "Show recipients" });
    // Statuses nobody has are left out.
    expect(
      within(filters)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["All6", "Sent3", "Skipped2", "Failed1"]);

    fireEvent.click(within(filters).getByRole("button", { name: /Failed/ }));

    expect(
      within(filters).getByRole("button", { name: /Failed/ }),
    ).toHaveAttribute("aria-pressed", "true");
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("Sunil");
  });

  it("follows the event stream while sending and stops when done", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    let answer = sending;
    const calls = stubFetch(() => respond(answer));
    renderDetail();

    expect(await screen.findByText(/4 of 6 patients handled\./)).toBeVisible();
    expect(
      screen.getByText(/^Sending\. 4 of 6 patients handled/),
    ).toBeInTheDocument();
    // The stream opens in an effect, just after the first render.
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const stream = FakeEventSource.instances[0];
    expect(stream.url).toBe("/api/messages/events");
    const before = calls.length;

    // Hints about other announcements or chats are ignored.
    act(() => {
      stream.emit("messaging", { type: "broadcast", broadcastId: "other" });
      stream.emit("messaging", {
        type: "message",
        conversationId: "c1",
        channel: "RECEPTION",
      });
    });
    expect(calls.length).toBe(before);

    answer = detail();
    act(() =>
      stream.emit("messaging", {
        type: "broadcast",
        broadcastId: BROADCAST_ID,
      }),
    );

    expect(await screen.findByText(/All 6 patients handled\./)).toBeVisible();
    expect(calls.at(-1)?.url).toBe(DETAIL_URL);
    await waitFor(() => expect(stream.closed).toBe(true));
  });

  it("refetches when the stream reconnects", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    const calls = stubFetch(() => respond(sending));
    renderDetail();
    await screen.findByText(/4 of 6 patients handled\./);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const before = calls.length;

    act(() => FakeEventSource.instances[0].emit("open"));

    await waitFor(() => expect(calls.length).toBe(before + 1));
  });

  it("polls every 5 seconds while sending when no hints arrive", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    // No EventSource at all: polling alone keeps the page current.
    vi.stubGlobal("EventSource", undefined);
    let answer = sending;
    const calls = stubFetch(() => respond(answer));
    renderDetail();
    await screen.findByText(/4 of 6 patients handled\./);
    expect(calls).toHaveLength(1);

    answer = detail();
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS));

    expect(await screen.findByText(/All 6 patients handled\./)).toBeVisible();
    expect(calls).toHaveLength(2);

    // Finished: no more polling.
    await act(() => vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3));
    expect(calls).toHaveLength(2);
  });

  it("keeps the last data and says so when a refresh fails", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    let fail = false;
    stubFetch(() =>
      fail ? Promise.reject(new TypeError("offline")) : respond(sending),
    );
    renderDetail();
    await screen.findByText(/4 of 6 patients handled\./);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));

    fail = true;
    act(() =>
      FakeEventSource.instances[0].emit("messaging", {
        type: "broadcast",
        broadcastId: BROADCAST_ID,
      }),
    );

    expect(
      await screen.findByText(
        "Can't reach the server. Showing the last update.",
      ),
    ).toBeVisible();
    expect(screen.getByText(/4 of 6 patients handled\./)).toBeVisible();
  });

  it("shows not found for an unknown announcement", async () => {
    stubFetch(() => apiError("NOT_FOUND", "Not found.", 404));
    renderDetail();

    expect(
      await screen.findByRole("heading", { name: "Announcement not found" }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /All announcements/ })[0],
    ).toHaveAttribute("href", "/receptionist/announcements");
  });

  it("offers a retry when loading fails", async () => {
    let fail = true;
    stubFetch(() =>
      fail
        ? apiError("INTERNAL_ERROR", "Server trouble.", 500)
        : respond(detail()),
    );
    renderDetail();

    expect(
      await screen.findByRole("heading", {
        name: "This announcement couldn't load",
      }),
    ).toBeVisible();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(/All 6 patients handled\./)).toBeVisible();
  });
});
