import type {
  PublicClinicView,
  PublicServiceView,
  PublicTokenView,
} from "@/features/queue/contracts";

export const UPDATED_AT = "2026-10-30T09:00:00.000Z";

export function makeToken(
  overrides: Partial<PublicTokenView> = {},
): PublicTokenView {
  return {
    publicTokenId: "8d3f6f0e-2c1b-4f7a-9a51-0b6f1d2e3c4b",
    tokenLabel: "A-17",
    status: "WAITING",
    peopleAhead: 3,
    estimate: { minMinutes: 10, maxMinutes: 20, isRough: false },
    serviceName: "General",
    clinicName: "Demo Clinic",
    clinicSlug: "demo-clinic",
    queueStatus: "OPEN",
    calledAt: null,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

export function makeService(
  overrides: Partial<PublicServiceView> = {},
): PublicServiceView {
  return {
    serviceId: "service-general",
    name: "General",
    description: "General consultation",
    tokenPrefix: "A",
    queue: {
      queueId: "queue-general",
      status: "OPEN",
      waitingCount: 4,
      estimate: { minMinutes: 15, maxMinutes: 25, isRough: true },
    },
    ...overrides,
  };
}

export function makeClinic(
  overrides: Partial<PublicClinicView> = {},
): PublicClinicView {
  return {
    name: "Demo Clinic",
    slug: "demo-clinic",
    timezone: "Asia/Kolkata",
    address: "12 MG Road, Pune",
    isOpenNow: true,
    services: [makeService()],
    ...overrides,
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function errorResponse(code: string, status: number): Response {
  return Response.json(
    { error: { code, message: "Server message", requestId: "req-1" } },
    { status },
  );
}
