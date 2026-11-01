import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnouncementsScreen } from "@/components/announcements/announcements-screen";
import {
  BROADCAST_ID,
  FakeEventSource,
  NOW,
  TIMEZONE,
  apiError,
  audience,
  respond,
  stubFetch,
  summary,
  withShell,
} from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const SECOND = "44444444-4444-4444-8444-444444444444";

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

// Announcement rows, found by their "View progress" links (the breadcrumb
// is a list too).
async function rows() {
  const links = await screen.findAllByRole("link", { name: /View progress/ });
  return links.map((link) => link.closest("li")!);
}

function renderList(basePath = "/receptionist/announcements") {
  return render(
    withShell(
      <AnnouncementsScreen
        basePath={basePath}
        crumbs={[{ label: "Reception", href: "/receptionist" }]}
        timeZone={TIMEZONE}
      />,
    ),
  );
}

describe("AnnouncementsScreen", () => {
  it("shows an empty state that opens the composer", async () => {
    stubFetch((call) =>
      call.url.includes("/audience") ? respond(audience()) : respond([]),
    );
    renderList();

    expect(
      await screen.findByRole("heading", { name: "No announcements yet" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Write the first one" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "New announcement" }),
    ).toBeVisible();
  });

  it("lists past announcements with who, when, services and counts", async () => {
    stubFetch(() =>
      respond([
        summary({
          id: SECOND,
          body: "Blood tests resume at 11.",
          createdAt: new Date(NOW - 26 * 60 * 60_000).toISOString(),
          createdByName: null,
          serviceNames: ["Blood test"],
        }),
        summary(),
      ]),
    );
    renderList("/admin/announcements");

    const [older, latest] = await rows();

    // Newlines become spaces in the one-line preview.
    expect(latest).toHaveTextContent(
      "The doctor is running 20 minutes late. Sorry for the wait.",
    );
    expect(latest).toHaveTextContent(
      "Today, 10:20 · by Asha Reception · All services",
    );
    expect(latest).toHaveTextContent("Finished");
    expect(latest).toHaveTextContent(/Sent3Seen2Skipped2Failed1/);
    expect(
      within(latest).getByRole("link", { name: /View progress/ }),
    ).toHaveAttribute("href", `/admin/announcements/${BROADCAST_ID}`);

    expect(older).toHaveTextContent(
      "Sat, 31 Oct, 08:30 · by a staff member · Blood test",
    );
    expect(
      within(older).getByRole("link", { name: /View progress/ }),
    ).toHaveAccessibleName(
      // jsdom drops the space browsers keep before the sr-only text.
      /^View progress ?of the announcement from Sat, 31 Oct, 08:30$/,
    );
  });

  it("updates rows that are still sending, then stops listening", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    let answer = [
      summary({
        status: "SENDING",
        counts: {
          total: 6,
          pending: 4,
          sent: 2,
          skipped: 0,
          failed: 0,
          seen: 0,
        },
      }),
    ];
    const calls = stubFetch(() => respond(answer));
    renderList();

    const [row] = await rows();
    expect(row).toHaveTextContent("Sending");
    expect(row).toHaveTextContent("2 of 6 patients");
    expect(row).toHaveTextContent(/Pending4/);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const stream = FakeEventSource.instances[0];
    expect(stream.url).toBe("/api/messages/events");

    answer = [summary()];
    act(() =>
      stream.emit("messaging", {
        type: "broadcast",
        broadcastId: BROADCAST_ID,
      }),
    );

    await waitFor(async () =>
      expect((await rows())[0]).toHaveTextContent("Finished"),
    );
    expect(calls.length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(stream.closed).toBe(true));
  });

  it("opens no stream when nothing is sending", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    stubFetch(() => respond([summary()]));
    renderList();

    await rows();
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("shows an error with a retry", async () => {
    let fail = true;
    stubFetch(() =>
      fail
        ? apiError("INTERNAL_ERROR", "Something went wrong.", 500)
        : respond([summary()]),
    );
    renderList();

    expect(
      await screen.findByRole("heading", {
        name: "Announcements couldn't load",
      }),
    ).toBeVisible();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect((await rows())[0]).toBeVisible();
  });
});
