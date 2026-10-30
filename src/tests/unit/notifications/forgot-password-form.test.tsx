import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { resetPasswordUrl } from "@/features/notifications/password-reset";

const requestPasswordReset = vi.fn();

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  },
}));

function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
  });

  it("shows the same confirmation whatever the email", async () => {
    requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    render(<ForgotPasswordForm />);

    submit("nobody@example.test");

    expect(
      await screen.findByText(/If an account uses that email/),
    ).toBeInTheDocument();
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "nobody@example.test",
    });
  });

  it("checks the email before calling the server", () => {
    render(<ForgotPasswordForm />);

    submit("not-an-email");

    expect(screen.getByText("Enter a valid email address.")).toBeVisible();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("says when there have been too many requests", async () => {
    requestPasswordReset.mockResolvedValue({
      data: null,
      error: { status: 429 },
    });
    render(<ForgotPasswordForm />);

    submit("asha@clinic.test");

    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument();
  });
});

describe("resetPasswordUrl", () => {
  it("links to our reset page with the token encoded", () => {
    expect(resetPasswordUrl("https://app.test", "a b/c")).toBe(
      "https://app.test/reset-password?token=a+b%2Fc",
    );
  });
});
