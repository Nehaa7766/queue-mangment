import { render, screen } from "@testing-library/react";
import { UsersIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { KpiCard } from "@/components/queue/kpi-card";
import { MiniTicketRow } from "@/components/queue/mini-ticket-row";
import { NowServingTicket } from "@/components/queue/now-serving-ticket";
import { NOW, staffToken } from "./fixtures";

describe("NowServingTicket", () => {
  const called = staffToken({
    id: "17",
    status: "CALLED",
    // Called 1:42 before NOW.
    calledAt: new Date(NOW - 102_000).toISOString(),
    assignedDoctorName: "Dr. Anjali Shah",
  });

  it("shows the token, the call time and the grace period left", () => {
    render(
      <NowServingTicket token={called} now={NOW} gracePeriodSeconds={300} />,
    );

    const ticket = screen.getByRole("region", { name: "Now serving" });
    expect(ticket).toHaveTextContent("A-17");
    expect(ticket).toHaveTextContent("Called 1:42");
    expect(ticket).toHaveTextContent("3:18 left in the grace period");
    expect(
      screen.getByRole("progressbar", { name: "Grace period" }),
    ).toHaveAttribute("aria-valuenow", "198");
    expect(ticket).toHaveTextContent("General · Dr. Anjali Shah");
  });

  it("says when the grace period is over", () => {
    render(
      <NowServingTicket
        token={called}
        now={NOW + 400_000}
        gracePeriodSeconds={300}
      />,
    );
    expect(
      screen.getByText("Grace period over. Recall or skip."),
    ).toBeInTheDocument();
  });

  it("announces changes politely without the ticking clock", () => {
    render(
      <NowServingTicket token={called} now={NOW} gracePeriodSeconds={300} />,
    );
    const live = screen.getByText("Now serving A-17, Patient 17");
    expect(live).toHaveAttribute("aria-live", "polite");
  });

  it("has an empty state", () => {
    render(
      <NowServingTicket token={null} now={NOW} gracePeriodSeconds={300} />,
    );
    expect(
      screen.getByText(
        "No one is being served. Call the next patient when ready.",
      ),
    ).toBeInTheDocument();
  });
});

describe("MiniTicketRow", () => {
  it("highlights a wait over the clinic's target", () => {
    render(
      <ol>
        <MiniTicketRow
          token={staffToken({
            id: "18",
            joinedAt: new Date(NOW - 24 * 60_000).toISOString(),
          })}
          isNext
          now={NOW}
          waitTargetMinutes={20}
          href="/receptionist/tokens/18"
        />
      </ol>,
    );

    expect(screen.getByText("24m").parentElement).toHaveClass(
      "text-terracotta-text",
    );
    // Screen readers hear "24 minutes" instead of "24m".
    expect(screen.getByText("24 minutes")).toHaveClass("sr-only");
    expect(screen.getByText("over target")).toBeInTheDocument();
    expect(screen.getByText(/· next up/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/receptionist/tokens/18",
    );
  });

  it("keeps a wait under the target neutral", () => {
    render(
      <ol>
        <MiniTicketRow
          token={staffToken({
            id: "19",
            joinedAt: new Date(NOW - 5 * 60_000).toISOString(),
          })}
          isNext={false}
          now={NOW}
          waitTargetMinutes={20}
        />
      </ol>,
    );

    expect(screen.getByText("5m").parentElement).not.toHaveClass(
      "text-terracotta-text",
    );
    expect(screen.getByText("waited")).toBeInTheDocument();
    expect(screen.queryByText(/next up/)).not.toBeInTheDocument();
  });
});

describe("KpiCard", () => {
  it("shows the value with an arrowed, coloured trend", () => {
    render(
      <KpiCard
        label="Waiting now"
        value={20}
        icon={UsersIcon}
        trend={{
          direction: "up",
          value: "+4",
          good: false,
          comparison: "vs last hour",
        }}
      />,
    );

    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("↗ +4")).toHaveClass("text-terracotta-text");
    expect(screen.getByText("vs last hour")).toBeInTheDocument();
  });

  it("shows a caption when there is no trend", () => {
    render(
      <KpiCard
        label="Served today"
        value={52}
        icon={UsersIcon}
        caption="Consultations completed"
      />,
    );
    expect(screen.getByText("Consultations completed")).toBeInTheDocument();
  });
});
