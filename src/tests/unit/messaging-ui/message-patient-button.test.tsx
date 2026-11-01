import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessagePatientButton } from "@/components/messaging/message-patient-button";
import { QueueTabs } from "@/components/queue/queue-tabs";
import { MESSAGING_API } from "@/features/messaging/contracts";
import { NOW, queueView } from "../receptionist/fixtures";
import { apiError, CONVERSATION_ID, mockApi } from "./fakes";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const { toast } = await import("sonner");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MessagePatientButton", () => {
  it("starts the reception chat and opens it", async () => {
    const { calls } = mockApi({
      [`POST ${MESSAGING_API.startConversation("token-1", "RECEPTION")}`]:
        () => ({
          conversationId: CONVERSATION_ID,
        }),
    });
    render(
      <MessagePatientButton
        tokenId="token-1"
        tokenLabel="A-7"
        patientName="Ravi"
        messagesHref="/receptionist/messages"
      />,
    );

    // jsdom drops the space before the screen-reader text; browsers keep it.
    fireEvent.click(
      screen.getByRole("button", { name: /^Message ?Ravi \(A-7\)$/ }),
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/receptionist/messages?c=${CONVERSATION_ID}`,
      ),
    );
    expect(calls).toHaveLength(1);
  });

  it("says so when the chat can't be opened", async () => {
    mockApi({
      [`POST ${MESSAGING_API.startConversation("token-1", "RECEPTION")}`]: () =>
        apiError(409, "CONVERSATION_CLOSED", "This chat is closed."),
    });
    render(
      <MessagePatientButton
        tokenId="token-1"
        tokenLabel="A-7"
        patientName="Ravi"
        messagesHref="/receptionist/messages"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Message ?Ravi/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This chat is closed."),
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Message ?Ravi/ })).toBeEnabled();
  });
});

describe("QueueTabs Message action", () => {
  it("adds Message to waiting and called patients when the panel has messages", () => {
    const view = queueView();
    render(
      <QueueTabs
        view={view}
        featuredId={null}
        now={NOW}
        timezone="Asia/Kolkata"
        disabled={false}
        onRecall={vi.fn()}
        onSkip={vi.fn()}
        onRequeue={vi.fn()}
        messagesHref="/receptionist/messages"
      />,
    );

    // Two waiting rows and the called patient.
    expect(screen.getAllByRole("button", { name: /^Message/ })).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: /^Message ?Patient 18 \(A-18\)$/ }),
    ).toBeInTheDocument();
  });

  it("leaves rows unchanged without a messages page", () => {
    render(
      <QueueTabs
        view={queueView()}
        featuredId={null}
        now={NOW}
        timezone="Asia/Kolkata"
        disabled={false}
        onRecall={vi.fn()}
        onSkip={vi.fn()}
        onRequeue={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Message/ })).toBeNull();
  });
});
