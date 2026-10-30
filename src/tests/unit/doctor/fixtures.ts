import type { DoctorPanelView } from "@/features/doctor/contracts";
import type { QueueDoctorView } from "@/features/queue/contracts";
import { NOW, staffToken } from "../receptionist/fixtures";

export { NOW, staffToken };

export function queueDoctor(
  overrides: Partial<QueueDoctorView> = {},
): QueueDoctorView {
  return {
    name: "Dr. Shah",
    availability: "AVAILABLE",
    delayMinutes: 0,
    note: null,
    updatedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

export function panelView(
  overrides: Partial<DoctorPanelView> = {},
): DoctorPanelView {
  return {
    clinicId: "clinic-1",
    clinic: { id: "clinic-1", name: "Demo Clinic", timezone: "Asia/Kolkata" },
    doctor: {
      name: "Dr. Shah",
      availability: "AVAILABLE",
      delayMinutes: 0,
      note: null,
      updatedAt: null,
    },
    services: [
      {
        serviceId: "service-a",
        name: "General",
        tokenPrefix: "A",
        queueId: "queue-a",
        queueStatus: "OPEN",
        waitingCount: 2,
      },
    ],
    assignedOnly: false,
    current: null,
    called: [
      staffToken({
        id: "17",
        status: "CALLED",
        calledAt: "2026-10-30T05:58:00Z",
      }),
    ],
    waiting: [staffToken({ id: "18" }), staffToken({ id: "19" })],
    waitingCount: 2,
    seenToday: 3,
    averageConsultationMinutes: 9,
    waitTargetMinutes: 20,
    generatedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}
