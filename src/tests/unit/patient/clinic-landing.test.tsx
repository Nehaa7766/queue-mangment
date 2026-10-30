import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClinicLanding } from "@/components/patient/clinic-landing";
import { makeClinic, makeService } from "./fixtures";

describe("ClinicLanding", () => {
  it("links each open service to its confirmation step", () => {
    render(<ClinicLanding clinic={makeClinic()} />);

    const link = screen.getByRole("link", { name: /General/ });
    expect(link).toHaveAttribute("href", "/q/demo-clinic/join/queue-general");
    expect(link).toHaveTextContent("4 people waiting");
    expect(link).toHaveTextContent("15–25 min");
  });

  it("shows paused services without a link", () => {
    const paused = makeService({
      name: "Pediatrics",
      queue: {
        queueId: "queue-peds",
        status: "PAUSED",
        waitingCount: 1,
        estimate: { minMinutes: 5, maxMinutes: 10, isRough: false },
      },
    });
    render(<ClinicLanding clinic={makeClinic({ services: [paused] })} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText(/1 person waiting/)).toBeInTheDocument();
  });

  it("marks services without a queue today", () => {
    render(
      <ClinicLanding
        clinic={makeClinic({ services: [makeService({ queue: null })] })}
      />,
    );

    expect(screen.getByText("Not taking patients today")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("blocks joining while the clinic is closed", () => {
    render(<ClinicLanding clinic={makeClinic({ isOpenNow: false })} />);

    expect(screen.getByText("Closed now")).toBeInTheDocument();
    expect(screen.getByText(/clinic is closed right now/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("explains when there are no services", () => {
    render(<ClinicLanding clinic={makeClinic({ services: [] })} />);

    expect(
      screen.getByText(/No services are taking patients right now/),
    ).toBeInTheDocument();
  });
});
