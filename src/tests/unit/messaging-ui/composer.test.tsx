import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/messaging/composer";

const textbox = () => screen.getByRole("textbox", { name: "Message" });
const send = () => screen.getByRole("button", { name: "Send" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Composer", () => {
  it("sends on Enter, adds a line on Shift+Enter and clears after sending", () => {
    const onSend = vi.fn(() => ({ ok: true as const }));
    render(<Composer onSend={onSend} />);

    fireEvent.change(textbox(), { target: { value: "Hello" } });
    fireEvent.keyDown(textbox(), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textbox(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Hello");
    expect(textbox()).toHaveValue("");
  });

  it("doesn't send while an input method is composing", () => {
    const onSend = vi.fn(() => ({ ok: true as const }));
    render(<Composer onSend={onSend} />);

    fireEvent.change(textbox(), { target: { value: "नमस्ते" } });
    fireEvent.keyDown(textbox(), { key: "Enter", isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("leaves Enter for new lines on touch screens", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(pointer: coarse)",
    }));
    const onSend = vi.fn(() => ({ ok: true as const }));
    render(<Composer onSend={onSend} />);

    fireEvent.change(textbox(), { target: { value: "Hi" } });
    fireEvent.keyDown(textbox(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.click(send());
    expect(onSend).toHaveBeenCalledWith("Hi");
  });

  it("counts characters and blocks messages over 1,000", () => {
    render(<Composer onSend={vi.fn(() => ({ ok: true as const }))} />);

    fireEvent.change(textbox(), { target: { value: "Hello " } });
    expect(screen.getByText("5 / 1,000")).toBeInTheDocument();
    expect(send()).toBeEnabled();

    fireEvent.change(textbox(), { target: { value: "x".repeat(1001) } });
    expect(screen.getByText("1,001 / 1,000")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Keep it under 1,000 characters.",
    );
    expect(textbox()).toHaveAttribute("aria-invalid", "true");
    expect(send()).toBeDisabled();
  });

  it("is disabled with the reason when the chat is closed", () => {
    render(
      <Composer
        onSend={vi.fn(() => ({ ok: true as const }))}
        closedNote="Closed after the visit."
      />,
    );

    const box = screen.getByRole("textbox", { name: "Chat closed" });
    expect(box).toBeDisabled();
    expect(box).toHaveAccessibleDescription(/Closed after the visit\./);
    expect(send()).toBeDisabled();
  });

  it("shows why a message was refused", () => {
    render(
      <Composer
        onSend={() => ({ ok: false, error: "Write a message first." })}
      />,
    );

    fireEvent.change(textbox(), { target: { value: "Hi" } });
    fireEvent.click(send());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Write a message first.",
    );
    expect(textbox()).toHaveValue("Hi");
  });
});
