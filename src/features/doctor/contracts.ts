import type {
  DoctorAvailabilityStatus,
  DoctorQueueView,
  StaffTokenView,
} from "@/features/queue/contracts";
import type { QueueStatus } from "@/features/queue/queue-rules";

// Shapes for the doctor panel (Phase 6). All timestamps are ISO 8601 strings;
// dates are YYYY-MM-DD in the clinic's timezone.

export type DoctorSelfView = {
  name: string;
  availability: DoctorAvailabilityStatus;
  delayMinutes: number;
  note: string | null;
  updatedAt: string | null;
};

export type DoctorServiceView = {
  serviceId: string;
  name: string;
  tokenPrefix: string;
  // Null when the service has no queue today.
  queueId: string | null;
  queueStatus: QueueStatus | null;
  waitingCount: number;
};

// Everything the doctor's live screens need, polled every 15 s. A superset of
// DoctorQueueView, so GET /api/doctor/queue keeps its Phase 3 shape.
export type DoctorPanelView = DoctorQueueView & {
  clinic: { id: string; name: string; timezone: string };
  doctor: DoctorSelfView;
  // The services this doctor serves today: their assignments, or every
  // active service when no assignments are set.
  services: DoctorServiceView[];
  // True when the doctor has explicit service assignments.
  assignedOnly: boolean;
  // `called` is narrowed to these services; `waiting` lists WAITING tokens per
  // service in queue order (services by token prefix).
  waiting: StaffTokenView[];
  seenToday: number;
  averageConsultationMinutes: number | null;
  // The clinic's wait target, for "over target" colouring.
  waitTargetMinutes: number;
  generatedAt: string;
};

export type DoctorHistoryEntry = {
  id: string;
  tokenLabel: string;
  patientName: string | null;
  serviceName: string;
  serviceStartedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
};

export type DoctorHistoryView = {
  timezone: string;
  // Newest day first; only days with completed consultations.
  days: { date: string; entries: DoctorHistoryEntry[] }[];
  generatedAt: string;
};

export type DoctorPanelResponse = DoctorPanelView;
export type DoctorAvailabilityResponse = { doctor: DoctorSelfView };

export const DOCTOR_API = {
  // GET → DoctorPanelResponse (same path as API.doctorQueue).
  panel: "/api/doctor/queue",
  // POST body AvailabilityBody → DoctorAvailabilityResponse.
  availability: "/api/doctor/availability",
} as const;
