import { z } from "zod";
import type { WaitEstimate } from "./eta";
import type { QueueStatus } from "./queue-rules";
import type { TokenAction, TokenStatus } from "./token-status";

// Shared contract between the queue API (Phase 3) and the patient and
// reception screens (Phases 4–5). Change it only in ways both sides can follow.
// All timestamps are ISO 8601 strings; all dates are YYYY-MM-DD in the clinic's timezone.

// Clients send a fresh crypto.randomUUID() per join or walk-in attempt and
// reuse it on retry, so a double tap never creates two tokens.
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

// Cap on each of the staff view's full-day lists (completedToday, missedToday).
export const STAFF_DAY_LIST_LIMIT = 300;

// ---- Request bodies ----

const patientName = z.string().trim().min(1).max(80);

export const joinQueueBodySchema = z.object({
  patientName: patientName.optional(),
});
export type JoinQueueBody = z.infer<typeof joinQueueBodySchema>;

export const walkInBodySchema = z.object({ patientName });
export type WalkInBody = z.infer<typeof walkInBodySchema>;

// ---- Public views (no login; minimum data only, docs/PLAN.md §9 rule 17) ----

export type PublicServiceView = {
  serviceId: string;
  name: string;
  description: string | null;
  tokenPrefix: string;
  // Null when the service has no queue today.
  queue: {
    queueId: string;
    status: QueueStatus;
    waitingCount: number;
    estimate: WaitEstimate;
  } | null;
};

export type PublicClinicView = {
  name: string;
  slug: string;
  timezone: string;
  address: string | null;
  // From opening hours; true when no hours are configured.
  isOpenNow: boolean;
  services: PublicServiceView[];
};

export type PublicTokenView = {
  publicTokenId: string;
  tokenLabel: string;
  status: TokenStatus;
  // Null unless the token is WAITING.
  peopleAhead: number | null;
  estimate: WaitEstimate | null;
  serviceName: string;
  clinicName: string;
  clinicSlug: string;
  queueStatus: QueueStatus;
  calledAt: string | null;
  // When this view was computed, for "updated X min ago".
  updatedAt: string;
  // Set while the token is WAITING and the doctors for this service are on a
  // break or running late (Phase 6). Never names a doctor.
  doctorNotice?: PatientDoctorNotice | null;
};

// ---- Doctor availability (Phase 6) ----

export type DoctorAvailabilityStatus = "AVAILABLE" | "ON_BREAK" | "OFF_DUTY";

// A doctor who serves a queue's service, for reception's banner.
export type QueueDoctorView = {
  name: string;
  availability: DoctorAvailabilityStatus;
  // Announced delay in minutes: how late they are running, or how long the
  // break should last. 0 when not set.
  delayMinutes: number;
  note: string | null;
  // When the doctor last changed their availability.
  updatedAt: string | null;
};

export type PatientDoctorNotice = {
  kind: "ON_BREAK" | "DELAYED";
  // ON_BREAK: minutes until the doctor expects to be back (0 when unknown).
  // DELAYED: how late the doctor says they are running.
  delayMinutes: number;
};

// ---- Staff views ----

export type StaffTokenView = {
  id: string;
  tokenLabel: string;
  patientName: string | null;
  status: TokenStatus;
  serviceName: string;
  joinedAt: string;
  calledAt: string | null;
  serviceStartedAt: string | null;
  completedAt: string | null;
  recallCount: number;
  assignedDoctorName: string | null;
};

export type StaffQueueSummary = {
  queueId: string;
  serviceId: string;
  serviceName: string;
  tokenPrefix: string;
  status: QueueStatus;
  queueDate: string;
  waitingCount: number;
};

export type StaffQueueView = {
  queue: StaffQueueSummary;
  // CALLED and IN_SERVICE tokens, earliest call first.
  current: StaffTokenView[];
  // WAITING tokens in FIFO (sortKey) order.
  waiting: StaffTokenView[];
  // Last 20 COMPLETED, SKIPPED or CANCELLED tokens, newest first.
  recent: StaffTokenView[];
  // A queue is one clinic day, so these are today's: COMPLETED tokens,
  // latest completion first, and SKIPPED or CANCELLED ones, latest first.
  // Up to STAFF_DAY_LIST_LIMIT each.
  completedToday: StaffTokenView[];
  missedToday: StaffTokenView[];
  settings: {
    waitTargetMinutes: number;
    gracePeriodSeconds: number;
    allowRequeue: boolean;
  };
  // Doctors who serve this queue's service and their availability (Phase 6).
  doctors?: QueueDoctorView[];
};

// Today's queue for the signed-in doctor in one clinic (Phase 6 screens).
export type DoctorQueueView = {
  clinicId: string;
  // The doctor's own IN_SERVICE token, if any.
  current: StaffTokenView | null;
  // CALLED tokens in the clinic today, earliest call first; the doctor starts one of these.
  called: StaffTokenView[];
  waitingCount: number;
};

// ---- Response bodies ----

export type PublicClinicResponse = PublicClinicView;
export type PublicTokenResponse = { token: PublicTokenView };
export type StaffTokenResponse = { token: StaffTokenView };
export type StaffQueueResponse = { queue: StaffQueueSummary };
export type TodayQueuesResponse = { queues: StaffQueueSummary[] };
export type DoctorQueueResponse = DoctorQueueView;
// GET API.queueTokens returns StaffQueueView.
// Errors always use the ErrorBody shape from @/lib/errors/api-handler.

// ---- Endpoints (docs/PLAN.md §11) ----

export type StaffTokenAction = Exclude<TokenAction, "call">;

export const API = {
  // Public
  publicClinic: (clinicSlug: string) => `/api/public/clinics/${clinicSlug}`,
  publicToken: (publicTokenId: string) => `/api/public/tokens/${publicTokenId}`,
  // POST: the patient cancels their own WAITING token.
  publicTokenCancel: (publicTokenId: string) =>
    `/api/public/tokens/${publicTokenId}/cancel`,
  // POST (public): join; body JoinQueueBody + idempotency header → 201 PublicTokenResponse.
  // GET (staff): StaffQueueView.
  queueTokens: (queueId: string) => `/api/queues/${queueId}/tokens`,

  // Staff
  todayQueues: (clinicId: string) => `/api/clinics/${clinicId}/queues/today`,
  callNext: (queueId: string) => `/api/queues/${queueId}/call-next`,
  // POST: body WalkInBody + idempotency header → 201 StaffTokenResponse.
  walkIn: (queueId: string) => `/api/queues/${queueId}/walk-ins`,
  pauseQueue: (queueId: string) => `/api/queues/${queueId}/pause`,
  resumeQueue: (queueId: string) => `/api/queues/${queueId}/resume`,
  // POST: ends the queue for the day; it can't be reopened.
  closeQueue: (queueId: string) => `/api/queues/${queueId}/close`,
  // POST → StaffTokenResponse.
  tokenAction: (tokenId: string, action: StaffTokenAction) =>
    `/api/tokens/${tokenId}/${action}`,
  // GET → DoctorQueueResponse. Optional ?clinicId=; defaults to the first membership.
  doctorQueue: "/api/doctor/queue",
} as const;
