import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaffProvider } from "@/components/layout/staff-provider";
import { BottomTabs } from "@/components/layout/staff-navigation";
import { StaffMessagingProvider } from "@/components/messaging/staff-messaging";
import { StaffMessages } from "@/components/messaging/staff-messages";
import { ShellProvider } from "@/components/shell/shell-context";
import { MESSAGING_API } from "@/features/messaging/contracts";
import type { StaffContext } from "@/lib/auth/staff-context";
import {
  conversation,
  FakeEventSource,
  inboxItem,
  message,
  mockApi,
  page,
  setOnline,
} from "./fakes";

const navigation = vi.hoisted(() => ({
  search: "",
  pathname: "/receptionist/messages",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
  usePathname: () => navigation.pathname,
  useRouter: () => ({
    push: navigation.push,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const NOW = Date.parse("2026-11-01T10:00:00.000Z");

function staff(role: StaffContext["role"] = "RECEPTIONIST"): StaffContext {
  return {
    user: { userId: "user-1", name: "Asha Desk", email: "asha@test" },
    clinic: {
      id: "clinic-1",
      name: "Demo Clinic",
      slug: "demo-clinic",
      timezone: "Asia/Kolkata",
    },
    membershipId: "member-1",
    role,
  };
}

function Providers({
  role,
  children,
}: {
  role?: StaffContext["role"];
  children: ReactNode;
}) {
  return (
    <StaffProvider value={staff(role)}>
      <ShellProvider
        info={{ homeHref: "/receptionist", now: NOW, timezone: "Asia/Kolkata" }}
      >
        <StaffMessagingProvider>{children}</StaffMessagingProvider>
      </ShellProvider>
    </StaffProvider>
  );
}

const inboxCalls = (calls: { url: URL }[]) =>
  calls.filter((call) => call.url.pathname === MESSAGING_API.inbox);

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSource);
  FakeEventSource.reset();
  setOnline(true);
  localStorage.clear();
  navigation.search = "";
  navigation.push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Messages nav badge", () => {
  it("shows unread chats and keeps them fresh from the staff stream", async () => {
    let unread = 2;
    const { calls } = mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: unread }),
    });
    render(
      <Providers>
        <BottomTabs />
      </Providers>,
    );

    const link = await screen.findByRole("link", {
      name: "Messages, 2 unread chats",
    });
    expect(link).toHaveAttribute("href", "/receptionist/messages");
    // One stream for the whole tab.
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.latest().url).toBe(MESSAGING_API.staffEvents);

    unread = 3;
    act(() => {
      FakeEventSource.latest().emit({
        type: "message",
        conversationId: "c",
        channel: "RECEPTION",
      });
    });
    expect(
      await screen.findByRole("link", { name: "Messages, 3 unread chats" }),
    ).toBeInTheDocument();
    expect(
      calls.filter((call) => call.url.pathname === MESSAGING_API.unread),
    ).toHaveLength(2);
  });

  it("hides the badge when nothing is unread", async () => {
    const { calls } = mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 0 }),
    });
    render(
      <Providers role="DOCTOR">
        <BottomTabs />
      </Providers>,
    );
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/doctor/messages",
    );
  });
});

describe("StaffMessages inbox", () => {
  it("lists each chat with token, service, patient, last message and unread count", async () => {
    const unread = inboxItem({ unread: 2 });
    const closed = inboxItem({
      closed: true,
      lastMessage: null,
      token: { ...inboxItem().token, label: "B-4", patientName: null },
    });
    mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 1 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({
        items: [unread, closed],
        nextCursor: null,
      }),
    });
    render(
      <Providers>
        <StaffMessages basePath="/receptionist/messages" />
      </Providers>,
    );

    const list = await screen.findByRole("list", { name: "Chats" });
    const [first, second] = within(list).getAllByRole("link");
    expect(first).toHaveTextContent(unread.token.label);
    expect(first).toHaveTextContent(unread.token.patientName!);
    expect(first).toHaveTextContent("General · Reception chat");
    expect(first).toHaveTextContent("When is my turn?");
    expect(first).toHaveTextContent("2 unread");
    // 09:00 UTC is 14:30 in the clinic's timezone.
    expect(first).toHaveTextContent("14:30");
    expect(first).toHaveAttribute(
      "href",
      `/receptionist/messages?c=${unread.conversationId}`,
    );
    expect(second).toHaveTextContent("B-4");
    expect(second).toHaveTextContent("Patient");
    expect(second).toHaveTextContent("Closed");
    expect(second).toHaveTextContent("No messages yet");
  });

  it("filters by status, channel and search", async () => {
    const { calls } = mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 0 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({ items: [], nextCursor: null }),
    });
    render(
      <Providers>
        <StaffMessages basePath="/receptionist/messages" />
      </Providers>,
    );
    await screen.findByText(/No chats yet/);
    expect(inboxCalls(calls)[0].url.searchParams.get("filter")).toBe("all");

    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    await waitFor(() =>
      expect(inboxCalls(calls).at(-1)!.url.searchParams.get("filter")).toBe(
        "unread",
      ),
    );
    expect(screen.getByRole("button", { name: "Unread" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByText("Nothing unread.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Chat type"), {
      target: { value: "DOCTOR" },
    });
    await waitFor(() =>
      expect(inboxCalls(calls).at(-1)!.url.searchParams.get("channel")).toBe(
        "doctor",
      ),
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "Search chats" }), {
      target: { value: "A-12" },
    });
    await waitFor(() =>
      expect(inboxCalls(calls).at(-1)!.url.searchParams.get("q")).toBe("A-12"),
    );
    expect(
      await screen.findByText("No chats match this search."),
    ).toBeInTheDocument();
  });

  it("shows doctors only their own chats, without the channel filter", async () => {
    mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 0 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({ items: [], nextCursor: null }),
    });
    render(
      <Providers role="DOCTOR">
        <StaffMessages basePath="/doctor/messages" />
      </Providers>,
    );
    await screen.findByText(/No chats yet/);

    expect(screen.queryByLabelText("Chat type")).not.toBeInTheDocument();
  });

  it("updates the list live without a reload", async () => {
    const item = inboxItem();
    let items = [item];
    mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 0 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({ items, nextCursor: null }),
    });
    render(
      <Providers>
        <StaffMessages basePath="/receptionist/messages" />
      </Providers>,
    );
    await screen.findByText("When is my turn?");

    items = [
      {
        ...item,
        unread: 1,
        lastMessage: {
          body: "I'm outside",
          sender: "PATIENT",
          createdAt: "2026-11-01T09:30:00.000Z",
        },
      },
    ];
    act(() => {
      FakeEventSource.latest().emit({
        type: "message",
        conversationId: item.conversationId,
        channel: "RECEPTION",
      });
    });

    expect(await screen.findByText("I'm outside")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  it("puts the chosen chat in the URL", async () => {
    const item = inboxItem();
    mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 0 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({
        items: [item],
        nextCursor: null,
      }),
    });
    const pushState = vi.spyOn(window.history, "pushState");
    render(
      <Providers>
        <StaffMessages basePath="/receptionist/messages" />
      </Providers>,
    );

    fireEvent.click(await screen.findByText("When is my turn?"));

    expect(pushState).toHaveBeenCalledWith(
      null,
      "",
      `/receptionist/messages?c=${item.conversationId}`,
    );
  });
});

describe("StaffMessages conversation", () => {
  it("opens the chat in the URL with its header, history and Seen ticks", async () => {
    const item = inboxItem({ unread: 1 });
    navigation.search = `?c=${item.conversationId}`;
    const { calls } = mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 1 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({
        items: [item],
        nextCursor: null,
      }),
      [`GET ${MESSAGING_API.conversationMessages(item.conversationId)}`]: () =>
        page(
          [
            message({
              sender: "PATIENT",
              senderName: null,
              body: "When is my turn?",
            }),
            message({
              sender: "STAFF",
              senderName: "Asha Desk",
              body: "About 10 minutes",
              seen: true,
            }),
          ],
          {
            conversation: conversation({
              conversationId: item.conversationId,
              unread: 1,
            }),
          },
        ),
      [`POST ${MESSAGING_API.conversationRead(item.conversationId)}`]: () => ({
        ok: true,
      }),
    });
    render(
      <Providers>
        <StaffMessages basePath="/receptionist/messages" />
      </Providers>,
    );

    const chat = screen.getByRole("region", { name: "Conversation" });
    expect(
      await within(chat).findByRole("heading", {
        // jsdom drops the space after the screen-reader text.
        name: new RegExp(
          `^Chat with ?${item.token.patientName}, token ${item.token.label}$`,
        ),
      }),
    ).toBeInTheDocument();
    expect(within(chat).getByText("Waiting")).toBeInTheDocument();
    const history = await within(chat).findByRole("region", {
      name: "Message history",
    });
    expect(await within(history).findByText("About 10 minutes")).toBeVisible();
    expect(within(history).getByText("Asha Desk")).toBeInTheDocument();
    expect(within(history).getByText("Seen")).toBeInTheDocument();
    expect(
      within(chat).getByRole("link", { name: "Token details" }),
    ).toHaveAttribute("href", `/receptionist/tokens/${item.token.id}`);

    // Opening it marks it read and clears the row's count.
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === "POST" &&
            call.url.pathname ===
              MESSAGING_API.conversationRead(item.conversationId),
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(screen.queryByText("1 unread")).not.toBeInTheDocument(),
    );
  });

  it("shows the token from the chat itself when it isn't in the loaded inbox", async () => {
    // E.g. opened from "Message patient" in a busy clinic: new chats without
    // messages sort last, past the first inbox page.
    const item = inboxItem();
    navigation.search = `?c=${item.conversationId}`;
    mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 0 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({ items: [], nextCursor: null }),
      [`GET ${MESSAGING_API.conversationMessages(item.conversationId)}`]: () =>
        page([], {
          conversation: conversation({ conversationId: item.conversationId }),
          token: item.token,
        }),
    });
    render(
      <Providers>
        <StaffMessages basePath="/receptionist/messages" />
      </Providers>,
    );

    const chat = screen.getByRole("region", { name: "Conversation" });
    expect(
      await within(chat).findByRole("heading", {
        name: new RegExp(
          `^Chat with ?${item.token.patientName}, token ${item.token.label}$`,
        ),
      }),
    ).toBeInTheDocument();
    expect(
      within(chat).getByRole("link", { name: "Token details" }),
    ).toHaveAttribute("href", `/receptionist/tokens/${item.token.id}`);
  });

  it("shows who answers a doctor chat", async () => {
    const item = inboxItem({
      channel: "DOCTOR",
      routing: { kind: "RECEPTION_FALLBACK" },
    });
    navigation.search = `?c=${item.conversationId}`;
    mockApi({
      [`GET ${MESSAGING_API.unread}`]: () => ({ conversations: 0 }),
      [`GET ${MESSAGING_API.inbox}`]: () => ({
        items: [item],
        nextCursor: null,
      }),
      [`GET ${MESSAGING_API.conversationMessages(item.conversationId)}`]: () =>
        page([], {
          conversation: conversation({
            conversationId: item.conversationId,
            channel: "DOCTOR",
            routing: { kind: "RECEPTION_FALLBACK" },
          }),
        }),
    });
    render(
      <Providers>
        <StaffMessages basePath="/receptionist/messages" />
      </Providers>,
    );

    expect(
      await screen.findByText(
        "Reception answers: no doctor serves this service",
      ),
    ).toBeInTheDocument();
  });
});
