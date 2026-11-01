import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NewMessageBar,
  PatientChatDock,
  PatientMessagesButton,
  PatientMessagesCard,
  PatientMessagingProvider,
} from "@/components/patient/patient-messages";
import { MESSAGING_API } from "@/features/messaging/contracts";
import {
  FakeEventSource,
  mockApi,
  page as messagePage,
  PUBLIC_TOKEN,
  setOnline,
  summary,
} from "./fakes";

const SUMMARY = MESSAGING_API.patientSummary(PUBLIC_TOKEN);
const chatUrl = (channel: string) =>
  `/token/${PUBLIC_TOKEN}/messages?with=${channel}`;

beforeEach(() => {
  vi.stubGlobal("EventSource", FakeEventSource);
  FakeEventSource.reset();
  setOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The token page's pieces, as the page puts them together.
function TokenPageMessages() {
  return (
    <PatientMessagingProvider publicTokenId={PUBLIC_TOKEN}>
      <PatientMessagesButton />
      <PatientMessagesCard />
      <NewMessageBar />
    </PatientMessagingProvider>
  );
}

describe("token page messaging", () => {
  it("lists both chats with who answers, linking to the chat screen", async () => {
    mockApi({
      [`GET ${SUMMARY}`]: () =>
        summary({
          doctor: {
            routing: { kind: "SERVICE_DOCTORS", serviceName: "General" },
          },
        }),
    });
    render(<TokenPageMessages />);

    const card = screen.getByRole("region", { name: "Messages" });
    expect(
      await within(card).findByText("Answered by the General doctors."),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: /^Reception/ }),
    ).toHaveAttribute("href", chatUrl("reception"));
    expect(within(card).getByRole("link", { name: /^Doctor/ })).toHaveAttribute(
      "href",
      chatUrl("doctor"),
    );
    expect(
      within(card).getByText(
        "For questions about your visit. Not for medical emergencies.",
      ),
    ).toBeInTheDocument();
    // Nothing unread: no bar.
    expect(screen.queryByText(/New message from/)).not.toBeInTheDocument();
  });

  it("shows unread counts and a bar that opens the chat with news", async () => {
    mockApi({
      [`GET ${SUMMARY}`]: () =>
        summary({ reception: { unread: 0 }, doctor: { unread: 2 } }),
    });
    render(<TokenPageMessages />);

    const bar = await screen.findByRole("link", {
      name: /New message from Doctor/,
    });
    expect(bar).toHaveAttribute("href", chatUrl("doctor"));
    // The top button opens the chat with something unread, and says how much.
    expect(
      screen.getByRole("link", { name: "Messages, 2 unread messages" }),
    ).toHaveAttribute("href", chatUrl("doctor"));
    const card = screen.getByRole("region", { name: "Messages" });
    expect(
      within(card).getByRole("link", { name: /^Doctor.*, 2 unread messages$/ }),
    ).toBeInTheDocument();
  });
});

describe("desktop chat beside the token", () => {
  function setDesktop(matches: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  function Dock() {
    return (
      <PatientMessagingProvider publicTokenId={PUBLIC_TOKEN}>
        <PatientChatDock clinicName="Demo Clinic" tokenLabel="A-6" />
      </PatientMessagingProvider>
    );
  }

  it("shows the chats with who answers on desktop widths", async () => {
    setDesktop(true);
    mockApi({
      [`GET ${SUMMARY}`]: () => summary(),
      [`GET ${MESSAGING_API.patientMessages(PUBLIC_TOKEN, "RECEPTION")}`]: () =>
        messagePage([]),
      [`POST ${MESSAGING_API.patientRead(PUBLIC_TOKEN, "RECEPTION")}`]: () => ({
        ok: true,
      }),
    });
    render(<Dock />);

    const dock = screen.getByRole("complementary", { name: "Messages" });
    expect(
      await within(dock).findByRole("tab", { name: "Reception" }),
    ).toBeInTheDocument();
    expect(
      within(dock).getByRole("tab", { name: "Doctor" }),
    ).toBeInTheDocument();
    expect(
      within(dock).getByRole("heading", { level: 2, name: "Reception" }),
    ).toBeInTheDocument();
    expect(
      within(dock).getByText("Demo Clinic · Token A-6"),
    ).toBeInTheDocument();
    expect(
      await within(dock).findByRole("textbox", { name: "Your message" }),
    ).toBeInTheDocument();
  });

  it("doesn't load or read any chat on phone widths", async () => {
    setDesktop(false);
    const { calls } = mockApi({
      [`GET ${SUMMARY}`]: () => summary({ reception: { unread: 1 } }),
    });
    render(<Dock />);

    await vi.waitFor(() =>
      expect(calls.some((call) => call.url.pathname === SUMMARY)).toBe(true),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url.pathname.startsWith(`${SUMMARY}/`) || call.method === "POST",
      ),
    ).toBe(false);
  });
});
