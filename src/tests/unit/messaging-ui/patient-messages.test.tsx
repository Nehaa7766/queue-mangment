import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PatientChatScreen } from "@/components/patient/patient-chat-screen";
import {
  MESSAGING_API,
  type MessageView,
} from "@/features/messaging/contracts";
import {
  apiError,
  conversation,
  FakeEventSource,
  message,
  mockApi,
  page,
  PUBLIC_TOKEN,
  setOnline,
  summary,
} from "./fakes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// The patient's full-screen chat (/token/<id>/messages).
function Screen() {
  return (
    <PatientChatScreen
      publicTokenId={PUBLIC_TOKEN}
      clinicName="Demo Clinic"
      tokenLabel="A-6"
      initialChannel="RECEPTION"
    />
  );
}

const SUMMARY = MESSAGING_API.patientSummary(PUBLIC_TOKEN);
const RECEPTION = MESSAGING_API.patientMessages(PUBLIC_TOKEN, "RECEPTION");
const DOCTOR = MESSAGING_API.patientMessages(PUBLIC_TOKEN, "DOCTOR");
const RECEPTION_READ = MESSAGING_API.patientRead(PUBLIC_TOKEN, "RECEPTION");

// What a POST to the messages endpoint stores.
function stored(body: { clientMessageId: string; body: string }): MessageView {
  return message({
    sender: "PATIENT",
    senderName: null,
    clientMessageId: body.clientMessageId,
    body: body.body,
    createdAt: new Date().toISOString(),
  });
}

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSource);
  FakeEventSource.reset();
  setOnline(true);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const textbox = () => screen.getByRole("textbox", { name: "Your message" });

function write(text: string) {
  fireEvent.change(textbox(), { target: { value: text } });
  fireEvent.keyDown(textbox(), { key: "Enter" });
}

describe("PatientChatScreen", () => {
  it("shows the emergency note, unread counts and who answers the doctor chat", async () => {
    mockApi({
      [`GET ${SUMMARY}`]: () =>
        summary({
          reception: { unread: 2 },
          doctor: {
            unread: 0,
            routing: { kind: "ASSIGNED_DOCTOR", doctorName: "Dr Mehta" },
          },
        }),
      [`GET ${RECEPTION}`]: () =>
        page([], { conversation: conversation({ unread: 2 }) }),
      [`POST ${RECEPTION_READ}`]: () => ({ ok: true }),
      [`GET ${DOCTOR}`]: () =>
        page([], {
          conversation: conversation({
            channel: "DOCTOR",
            routing: { kind: "ASSIGNED_DOCTOR", doctorName: "Dr Mehta" },
          }),
        }),
    });
    render(<Screen />);

    expect(
      await screen.findByText(
        "For questions about your visit. Not for medical emergencies.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Reception" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Demo Clinic · Token A-6")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to your token" }),
    ).toHaveAttribute("href", `/token/${PUBLIC_TOKEN}`);
    const receptionTab = await screen.findByRole("tab", { name: /Reception/ });
    expect(receptionTab).toHaveAccessibleName("Reception, 2 unread messages");

    fireEvent.click(screen.getByRole("tab", { name: "Doctor" }));
    expect(await screen.findByText("Answered by Dr Mehta.")).toBeVisible();
    // The header names who is answering.
    expect(
      screen.getByRole("heading", { level: 1, name: "Dr Mehta" }),
    ).toBeInTheDocument();
  });

  it("shows clinic messages on the left with their sender, and Seen on the patient's", async () => {
    mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${RECEPTION}`]: () =>
        page([
          message({
            sender: "PATIENT",
            senderName: null,
            body: "Hi",
            seen: true,
          }),
          message({
            body: "Please come to the desk",
            senderName: "Reception",
            isAnnouncement: true,
          }),
        ]),
    });
    render(<Screen />);

    const history = await screen.findByRole("region", {
      name: "Message history",
    });
    expect(await within(history).findByText("Hi")).toBeInTheDocument();
    expect(within(history).getByText("Seen")).toBeInTheDocument();
    expect(within(history).getByText("Reception")).toBeInTheDocument();
    expect(within(history).getByText("Announcement")).toBeInTheDocument();
  });

  it("sends with a fresh id and shows Sent once stored", async () => {
    const { calls } = mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${RECEPTION}`]: () => page([]),
      [`POST ${RECEPTION}`]: (init) => stored(JSON.parse(String(init?.body))),
    });
    render(<Screen />);
    await screen.findByText("No messages yet");

    write("  Running late  ");

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({
      clientMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      body: "Running late",
    });
    expect(textbox()).toHaveValue("");
    expect(localStorage.length).toBe(0);
  });

  it("keeps a failed message with Retry, and retries with the same id", async () => {
    let fail = true;
    const { calls } = mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${RECEPTION}`]: () => page([]),
      [`POST ${RECEPTION}`]: (init) => {
        if (fail) throw new TypeError("Failed to fetch");
        return stored(JSON.parse(String(init?.body)));
      },
    });
    render(<Screen />);
    await screen.findByText("No messages yet");

    write("Where do I go?");

    expect(await screen.findByText("Not sent")).toBeInTheDocument();
    expect(
      screen.getByText("No connection. It will send when you're back online."),
    ).toBeInTheDocument();
    // Kept for a refresh, without the private link in the key.
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).not.toContain(PUBLIC_TOKEN);

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[1].body).toEqual(posts[0].body);
    expect(localStorage.length).toBe(0);
  });

  it("retries by itself when the browser comes back online", async () => {
    let fail = true;
    const { calls } = mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${RECEPTION}`]: () => page([]),
      [`POST ${RECEPTION}`]: (init) => {
        if (fail) throw new TypeError("Failed to fetch");
        return stored(JSON.parse(String(init?.body)));
      },
    });
    render(<Screen />);
    await screen.findByText("No messages yet");
    write("Hello?");
    await screen.findByText("Not sent");

    fail = false;
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(await screen.findByText("Sent")).toBeInTheDocument();
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts[1].body).toEqual(posts[0].body);
  });

  it("keeps unsent messages through a refresh and sends them when it can", async () => {
    let fail = true;
    const { calls } = mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${RECEPTION}`]: () => page([]),
      [`POST ${RECEPTION}`]: (init) => {
        if (fail) throw new TypeError("Failed to fetch");
        return stored(JSON.parse(String(init?.body)));
      },
    });
    const first = render(<Screen />);
    await screen.findByText("No messages yet");
    write("Still there?");
    await screen.findByText("Not sent");
    first.unmount();

    fail = false;
    render(<Screen />);

    expect(await screen.findByText("Still there?")).toBeInTheDocument();
    expect(await screen.findByText("Sent")).toBeInTheDocument();
    const posts = calls.filter((call) => call.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[1].body).toEqual(posts[0].body);
  });

  it("explains why a closed chat can't take messages", async () => {
    mockApi({
      [`GET ${SUMMARY}`]: () => summary({ reception: { closed: true } }),
      [`GET ${RECEPTION}`]: () =>
        page([message()], { conversation: conversation({ closed: true }) }),
    });
    render(<Screen />);

    const box = await screen.findByRole("textbox", { name: "Chat closed" });
    expect(box).toBeDisabled();
    expect(box).toHaveAccessibleDescription(/This chat has closed/);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows a send rejected because the chat closed meanwhile", async () => {
    let closed = false;
    mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${RECEPTION}`]: () =>
        page([], { conversation: conversation({ closed }) }),
      [`POST ${RECEPTION}`]: () => {
        closed = true;
        return apiError(409, "CONVERSATION_CLOSED", "This chat is closed.");
      },
    });
    render(<Screen />);
    await screen.findByText("No messages yet");

    write("Hello");

    expect(await screen.findByText("This chat is closed.")).toBeInTheDocument();
    expect(
      await screen.findByRole("textbox", { name: "Chat closed" }),
    ).toBeDisabled();
  });

  it("marks an open chat read, then refreshes the counts", async () => {
    const { calls } = mockApi({
      [`GET ${SUMMARY}`]: () => summary({ reception: { unread: 1 } }),
      [`GET ${RECEPTION}`]: () =>
        page([message()], { conversation: conversation({ unread: 1 }) }),
      [`POST ${RECEPTION_READ}`]: () => ({ ok: true }),
    });
    render(<Screen />);

    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === "POST" && call.url.pathname === RECEPTION_READ,
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        calls.filter((call) => call.url.pathname === SUMMARY).length,
      ).toBeGreaterThan(1),
    );
  });

  it("refetches the chat on a live event", async () => {
    let messages = [message({ body: "First" })];
    mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${RECEPTION}`]: () => page(messages),
    });
    render(<Screen />);
    await screen.findByText("First");

    messages = [...messages, message({ body: "Your turn is next" })];
    act(() => {
      FakeEventSource.latest().open();
      FakeEventSource.latest().emit({
        type: "message",
        conversationId: "c",
        channel: "RECEPTION",
      });
    });

    expect(await screen.findByText("Your turn is next")).toBeInTheDocument();
    // Screen readers hear about the new message.
    expect(
      await screen.findByText("New message from Reception: Your turn is next"),
    ).toBeInTheDocument();
  });

  it("offers a retry when the messages can't load", async () => {
    let fail = true;
    mockApi({
      [`GET ${SUMMARY}`]: () =>
        fail ? apiError(500, "INTERNAL_ERROR") : summary(),
      [`GET ${RECEPTION}`]: () => page([]),
    });
    render(<Screen />);

    const retry = await screen.findByRole("button", { name: "Try again" });
    fail = false;
    fireEvent.click(retry);

    expect(await screen.findByText("No messages yet")).toBeInTheDocument();
  });
});
