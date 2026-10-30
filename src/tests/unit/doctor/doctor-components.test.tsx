import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityBadge } from "@/components/doctor/availability-badge";
import { CalledPatientList } from "@/components/doctor/called-patient-list";
import { ConsultationTicket } from "@/components/doctor/consultation-ticket";
import {
  PatientDoctorNoticeBanner,
  QueueDoctorBanner,
} from "@/components/doctor/doctor-notice";
import { TokenStatusView } from "@/components/patient/token-status-view";
import type { PublicTokenView } from "@/features/queue/contracts";
import { NOW, queueDoctor, staffToken } from "./fixtures";

describe("AvailabilityBadge", () => {
  it.each([
    [{ availability: "AVAILABLE", delayMinutes: 0 }, "Available"],
    [
      { availability: "AVAILABLE", delayMinutes: 10 },
      "Available · 10 min late",
    ],
    [{ availability: "ON_BREAK", delayMinutes: 15 }, "On break · 15 min"],
    [{ availability: "OFF_DUTY", delayMinutes: 0 }, "Off duty"],
  ] as const)("labels %o as %s", (doctor, label) => {
    render(<AvailabilityBadge doctor={doctor} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("QueueDoctorBanner", () => {
  it("shows nothing while every doctor is available and on time", () => {
    const { container } = render(
      <QueueDoctorBanner
        doctors={[queueDoctor()]}
        serviceName="General"
        now={NOW}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names doctors on a break or running late, with their note", () => {
    render(
      <QueueDoctorBanner
        doctors={[
          queueDoctor({
            name: "Dr. Shah",
            availability: "ON_BREAK",
            delayMinutes: 15,
            updatedAt: new Date(NOW - 5 * 60_000).toISOString(),
            note: "Back after lunch",
          }),
          queueDoctor({ name: "Dr. Rao", delayMinutes: 20 }),
        ]}
        serviceName="General"
        now={NOW}
      />,
    );
    const banner = screen.getByRole("status", { name: "Doctor availability" });
    expect(banner).toHaveTextContent(
      "Dr. Shah is on a break · back in about 10 min · “Back after lunch”",
    );
    expect(banner).toHaveTextContent("Dr. Rao is running about 20 min late");
  });

  it("warns when no doctor is on duty for the service", () => {
    render(
      <QueueDoctorBanner
        doctors={[queueDoctor({ availability: "OFF_DUTY" })]}
        serviceName="Dental"
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "No doctor is on duty for Dental right now.",
    );
  });
});

describe("PatientDoctorNoticeBanner", () => {
  it("never names a doctor", () => {
    render(
      <PatientDoctorNoticeBanner
        notice={{ kind: "DELAYED", delayMinutes: 20 }}
      />,
    );
    expect(
      screen.getByText(
        "The doctor is running about 20 min late. You keep your place.",
      ),
    ).toBeInTheDocument();
  });

  it("gives a return time for a break when one was announced", () => {
    render(
      <PatientDoctorNoticeBanner
        notice={{ kind: "ON_BREAK", delayMinutes: 10 }}
      />,
    );
    expect(screen.getByText(/back in about 10 min/)).toBeInTheDocument();
  });
});

describe("patient token page", () => {
  const token: PublicTokenView = {
    publicTokenId: "p-1",
    tokenLabel: "A-18",
    status: "WAITING",
    peopleAhead: 2,
    estimate: { minMinutes: 10, maxMinutes: 20, isRough: false },
    serviceName: "General",
    clinicName: "Demo Clinic",
    clinicSlug: "demo-clinic",
    queueStatus: "OPEN",
    calledAt: null,
    updatedAt: new Date(NOW).toISOString(),
    doctorNotice: { kind: "ON_BREAK", delayMinutes: 0 },
  };

  it("shows the doctor notice while the patient waits", () => {
    render(<TokenStatusView token={token} now={NOW} />);
    expect(
      screen.getByText("The doctor is on a short break. You keep your place."),
    ).toBeInTheDocument();
  });

  it("hides the notice once the patient is called", () => {
    render(
      <TokenStatusView token={{ ...token, status: "CALLED" }} now={NOW} />,
    );
    expect(screen.queryByText(/short break/)).not.toBeInTheDocument();
  });
});

describe("CalledPatientList", () => {
  it("explains that reception calls patients when none are ready", () => {
    render(
      <CalledPatientList
        tokens={[]}
        now={NOW}
        blockedReason={null}
        pendingTokenId={null}
        onStart={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Waiting for reception to call the next patient/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("disables Start with the reason while a consultation is open", () => {
    render(
      <CalledPatientList
        tokens={[
          staffToken({
            id: "17",
            status: "CALLED",
            calledAt: new Date(NOW - 90_000).toISOString(),
          }),
        ]}
        now={NOW}
        blockedReason="Complete your current consultation first."
        pendingTokenId={null}
        onStart={vi.fn()}
      />,
    );
    const start = screen.getByRole("button", {
      name: "Start consultation with A-17, Patient 17",
    });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription(
      "Complete your current consultation first.",
    );
    expect(screen.getByText(/called 1:30 ago/)).toBeInTheDocument();
  });
});

describe("ConsultationTicket", () => {
  it("shows only the token, name, service and time", () => {
    render(
      <ConsultationTicket
        token={staffToken({
          id: "17",
          status: "IN_SERVICE",
          serviceStartedAt: new Date(NOW - 12 * 60_000).toISOString(),
        })}
        now={NOW}
        timezone="Asia/Kolkata"
      />,
    );
    const ticket = screen.getByRole("region", { name: "Current consultation" });
    expect(within(ticket).getByText("A-17")).toBeInTheDocument();
    expect(within(ticket).getByText("Patient 17")).toBeInTheDocument();
    expect(within(ticket).getByText("General")).toBeInTheDocument();
    expect(within(ticket).getByText("12 min")).toBeInTheDocument();
    // 05:48 UTC is 11:18 in Asia/Kolkata.
    expect(within(ticket).getByText("Started 11:18")).toBeInTheDocument();
  });
});
