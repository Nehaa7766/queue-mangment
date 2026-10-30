import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TokenStatusView } from "@/components/patient/token-status-view";
import type { TokenStatus } from "@/features/queue/token-status";
import { makeToken, UPDATED_AT } from "./fixtures";

const NOW = Date.parse(UPDATED_AT);

function renderToken(overrides: Parameters<typeof makeToken>[0] = {}) {
  return render(<TokenStatusView token={makeToken(overrides)} now={NOW} />);
}

describe("TokenStatusView", () => {
  it.each<[TokenStatus, string, string]>([
    ["WAITING", "Waiting", "You're in the queue"],
    ["CALLED", "Called", "It's your turn"],
    ["IN_SERVICE", "In consultation", "You're with the doctor"],
    ["COMPLETED", "Done", "Visit completed"],
    ["SKIPPED", "Skipped", "You missed your turn"],
    ["CANCELLED", "Cancelled", "You've left the queue"],
  ])("shows the %s state", (status, pill, title) => {
    const waiting = status === "WAITING";
    renderToken({
      status,
      peopleAhead: waiting ? 3 : null,
      estimate: waiting
        ? { minMinutes: 10, maxMinutes: 20, isRough: false }
        : null,
    });

    expect(screen.getByText(pill)).toBeInTheDocument();
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByTestId("token-label")).toHaveTextContent("A-17");
  });

  it("shows people ahead and the estimated range while waiting", () => {
    renderToken({
      peopleAhead: 3,
      estimate: { minMinutes: 10, maxMinutes: 20, isRough: true },
    });

    expect(screen.getByText("3 people ahead of you")).toBeInTheDocument();
    expect(screen.getByText("10–20 min")).toBeInTheDocument();
    expect(screen.getByText("Rough estimate")).toBeInTheDocument();
  });

  it("says the patient is next when nobody is ahead", () => {
    renderToken({ peopleAhead: 0 });

    expect(screen.getByText("You're next")).toBeInTheDocument();
  });

  it("hides the rough label for estimates based on real data", () => {
    renderToken();

    expect(screen.queryByText("Rough estimate")).not.toBeInTheDocument();
  });

  it("warns when the queue is paused or closed", () => {
    const { rerender } = renderToken({ queueStatus: "PAUSED" });
    expect(screen.getByText(/You keep your place/)).toBeInTheDocument();

    rerender(
      <TokenStatusView
        token={makeToken({ queueStatus: "CLOSED" })}
        now={NOW}
      />,
    );
    expect(screen.getByText(/has closed for today/)).toBeInTheDocument();
  });

  it("thanks the patient after the visit", () => {
    renderToken({ status: "COMPLETED", peopleAhead: null, estimate: null });

    expect(
      screen.getByText("Thank you for visiting Demo Clinic."),
    ).toBeInTheDocument();
  });

  it("announces status changes politely", () => {
    renderToken();

    expect(
      screen.getByText("You're in the queue").closest("[aria-live]"),
    ).toHaveAttribute("aria-live", "polite");
  });

  it("shows how fresh the data is, or that a refresh failed", () => {
    const { rerender } = render(
      <TokenStatusView token={makeToken()} now={NOW + 2 * 60_000} />,
    );
    expect(screen.getByText(/Updated 2 min ago/)).toBeInTheDocument();

    rerender(<TokenStatusView token={makeToken()} now={NOW} refreshFailed />);
    expect(screen.getByText(/Couldn't refresh/)).toBeInTheDocument();
  });

  it("does not show the freshness line once the visit is over", () => {
    renderToken({ status: "COMPLETED", peopleAhead: null, estimate: null });

    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });
});
