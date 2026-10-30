import type {
  StaffQueueView,
  StaffTokenView,
} from "@/features/queue/contracts";

export const NOW = Date.parse("2026-10-30T06:00:00Z");

export function staffToken(
  overrides: Partial<StaffTokenView> & Pick<StaffTokenView, "id">,
): StaffTokenView {
  return {
    tokenLabel: `A-${overrides.id}`,
    patientName: `Patient ${overrides.id}`,
    status: "WAITING",
    serviceName: "General",
    joinedAt: "2026-10-30T05:50:00Z",
    calledAt: null,
    serviceStartedAt: null,
    completedAt: null,
    recallCount: 0,
    assignedDoctorName: null,
    ...overrides,
  };
}

export function queueView(
  overrides: Partial<StaffQueueView> = {},
): StaffQueueView {
  const waiting = overrides.waiting ?? [
    staffToken({ id: "18" }),
    staffToken({ id: "19" }),
  ];
  return {
    queue: {
      queueId: "11111111-1111-4111-8111-111111111111",
      serviceId: "service-a",
      serviceName: "General",
      tokenPrefix: "A",
      status: "OPEN",
      queueDate: "2026-10-30",
      waitingCount: waiting.length,
      ...overrides.queue,
    },
    current: overrides.current ?? [
      staffToken({
        id: "17",
        status: "CALLED",
        calledAt: "2026-10-30T05:58:00Z",
      }),
    ],
    waiting,
    recent: overrides.recent ?? [],
    settings: {
      waitTargetMinutes: 20,
      gracePeriodSeconds: 300,
      allowRequeue: true,
      ...overrides.settings,
    },
  };
}
