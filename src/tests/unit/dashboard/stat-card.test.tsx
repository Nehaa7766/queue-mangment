import { render, screen } from "@testing-library/react";
import { UsersIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard } from "@/components/dashboard/stat-card";

describe("StatCard", () => {
  it("shows the value, label and footer caption", () => {
    render(
      <StatCard
        icon={UsersIcon}
        value={18}
        label="Waiting now"
        footerLabel="vs last hour"
        footerValue="+4"
      />,
    );

    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Waiting now")).toBeInTheDocument();
    expect(screen.getByText("vs last hour")).toBeInTheDocument();
    expect(screen.getByText("+4")).toBeInTheDocument();
  });

  it("draws the progress line in the tone, clamped to 0–100%", () => {
    const { container } = render(
      <StatCard
        icon={UsersIcon}
        value="3"
        label="No-shows"
        footerLabel="Of those called"
        progress={140}
        tone="red"
      />,
    );

    const bar = container.querySelector(".bg-tone-red");
    expect(bar).toHaveStyle({ width: "100%" });
    // Decoration only: the numbers are already in the text.
    expect(bar?.parentElement).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves out the footer when there is nothing to show", () => {
    const { container } = render(
      <StatCard icon={UsersIcon} value="52" label="Served today" />,
    );

    expect(container.querySelector("[aria-hidden='true'].h-1")).toBeNull();
    expect(screen.getByText("Served today")).toBeInTheDocument();
  });
});
