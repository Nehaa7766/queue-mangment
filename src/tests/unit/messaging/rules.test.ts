// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  canStaffAccess,
  closesAt,
  doctorRoutingKind,
  isConversationClosed,
  patientEventFor,
  previewText,
  staffEventFor,
  type ChatNotification,
  type ChatTarget,
  type ClosureToken,
  type StaffViewer,
} from "@/features/messaging/rules";

const HOUR = 60 * 60_000;
const NOW = new Date("2026-11-01T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function token(overrides: Partial<ClosureToken> = {}): ClosureToken {
  return {
    status: "WAITING",
    joinedAt: ago(HOUR),
    completedAt: null,
    cancelledAt: null,
    skippedAt: null,
    ...overrides,
  };
}

describe("closing", () => {
  it("keeps a chat open while the visit is going", () => {
    for (const status of ["WAITING", "CALLED", "IN_SERVICE"] as const) {
      expect(isConversationClosed(token({ status }), NOW)).toBe(false);
    }
  });

  it("closes 2 hours after the visit ends, however it ended", () => {
    const ended = [
      { status: "COMPLETED", completedAt: ago(2 * HOUR) },
      { status: "CANCELLED", cancelledAt: ago(2 * HOUR) },
      { status: "SKIPPED", skippedAt: ago(2 * HOUR) },
    ] as const;
    for (const fields of ended) {
      expect(isConversationClosed(token(fields), NOW)).toBe(true);
      expect(
        isConversationClosed(token(fields), new Date(NOW.getTime() - 1)),
      ).toBe(false);
    }
  });

  it("closes a day after joining even if the visit never ended", () => {
    expect(isConversationClosed(token({ joinedAt: ago(24 * HOUR) }), NOW)).toBe(
      true,
    );
    expect(isConversationClosed(token({ joinedAt: ago(23 * HOUR) }), NOW)).toBe(
      false,
    );
  });

  it("takes whichever comes first", () => {
    const late = token({
      joinedAt: ago(23 * HOUR),
      status: "COMPLETED",
      completedAt: ago(30 * 60_000),
    });
    expect(closesAt(late)).toEqual(new Date(NOW.getTime() + HOUR));
  });

  it("reopens a requeued token (skippedAt is cleared)", () => {
    const requeued = token({ status: "WAITING", skippedAt: null });
    expect(isConversationClosed(requeued, NOW)).toBe(false);
  });
});

const SERVICE = "service-general";
const OTHER_SERVICE = "service-dental";

function viewer(
  role: StaffViewer["role"],
  overrides: Partial<StaffViewer> = {},
): StaffViewer {
  return {
    userId: `${role}-user`,
    clinicId: "clinic-1",
    role,
    doctorServiceIds: [],
    ...overrides,
  };
}

function target(overrides: Partial<ChatTarget> = {}): ChatTarget {
  return {
    clinicId: "clinic-1",
    channel: "DOCTOR",
    serviceId: SERVICE,
    assignedDoctorId: null,
    routing: "SERVICE_DOCTORS",
    ...overrides,
  };
}

describe("routing", () => {
  it("decides who answers the doctor chat", () => {
    expect(doctorRoutingKind("doctor-1", true)).toBe("ASSIGNED_DOCTOR");
    expect(doctorRoutingKind("doctor-1", false)).toBe("ASSIGNED_DOCTOR");
    expect(doctorRoutingKind(null, true)).toBe("SERVICE_DOCTORS");
    expect(doctorRoutingKind(null, false)).toBe("RECEPTION_FALLBACK");
  });

  it("gives the reception chat to reception and admins only", () => {
    const reception = target({ channel: "RECEPTION", routing: null });
    expect(canStaffAccess(viewer("RECEPTIONIST"), reception)).toBe(true);
    expect(canStaffAccess(viewer("CLINIC_ADMIN"), reception)).toBe(true);
    expect(canStaffAccess(viewer("DOCTOR"), reception)).toBe(false);
  });

  it("gives a doctor chat before the visit to the service's doctors", () => {
    const chat = target();
    expect(canStaffAccess(viewer("DOCTOR"), chat)).toBe(true);
    expect(
      canStaffAccess(viewer("DOCTOR", { doctorServiceIds: [SERVICE] }), chat),
    ).toBe(true);
    expect(
      canStaffAccess(
        viewer("DOCTOR", { doctorServiceIds: [OTHER_SERVICE] }),
        chat,
      ),
    ).toBe(false);
    expect(canStaffAccess(viewer("RECEPTIONIST"), chat)).toBe(false);
    expect(canStaffAccess(viewer("CLINIC_ADMIN"), chat)).toBe(false);
  });

  it("gives it to the assigned doctor only once the visit starts", () => {
    const chat = target({
      assignedDoctorId: "DOCTOR-user",
      routing: "ASSIGNED_DOCTOR",
    });
    expect(canStaffAccess(viewer("DOCTOR"), chat)).toBe(true);
    expect(
      canStaffAccess(viewer("DOCTOR", { userId: "someone-else" }), chat),
    ).toBe(false);
    expect(canStaffAccess(viewer("CLINIC_ADMIN"), chat)).toBe(false);
  });

  it("falls back to reception when no doctor serves the service", () => {
    const chat = target({ routing: "RECEPTION_FALLBACK" });
    expect(canStaffAccess(viewer("RECEPTIONIST"), chat)).toBe(true);
    expect(canStaffAccess(viewer("CLINIC_ADMIN"), chat)).toBe(true);
    expect(canStaffAccess(viewer("DOCTOR"), chat)).toBe(false);
  });

  it("never crosses clinics", () => {
    const elsewhere = viewer("RECEPTIONIST", { clinicId: "clinic-2" });
    expect(
      canStaffAccess(
        elsewhere,
        target({ channel: "RECEPTION", routing: null }),
      ),
    ).toBe(false);
  });
});

function notification(
  overrides: Partial<ChatNotification> = {},
): ChatNotification {
  return {
    type: "message",
    clinicId: "clinic-1",
    conversationId: "conversation-1",
    tokenId: "token-1",
    channel: "RECEPTION",
    serviceId: SERVICE,
    assignedDoctorId: null,
    routing: null,
    actor: "PATIENT",
    ...overrides,
  };
}

describe("live hints", () => {
  const hint = {
    type: "message",
    conversationId: "conversation-1",
    channel: "RECEPTION",
  };

  it("sends a patient hints for their own token only, never their own reads", () => {
    expect(patientEventFor("token-1", notification())).toEqual(hint);
    expect(patientEventFor("token-2", notification())).toBeNull();
    expect(
      patientEventFor(
        "token-1",
        notification({ type: "read", actor: "PATIENT" }),
      ),
    ).toBeNull();
    expect(
      patientEventFor(
        "token-1",
        notification({ type: "read", actor: "STAFF" }),
      ),
    ).toEqual({
      ...hint,
      type: "read",
    });
    expect(
      patientEventFor("token-1", {
        type: "broadcast",
        clinicId: "clinic-1",
        broadcastId: "b",
      }),
    ).toBeNull();
  });

  it("sends staff hints by the routing rule", () => {
    expect(staffEventFor(viewer("RECEPTIONIST"), notification())).toEqual(hint);
    expect(staffEventFor(viewer("DOCTOR"), notification())).toBeNull();
    expect(
      staffEventFor(
        viewer("RECEPTIONIST", { clinicId: "clinic-2" }),
        notification(),
      ),
    ).toBeNull();
    // Reads by staff go to the patient, not other staff.
    expect(
      staffEventFor(
        viewer("RECEPTIONIST"),
        notification({ type: "read", actor: "STAFF" }),
      ),
    ).toBeNull();

    const doctorChat = notification({
      channel: "DOCTOR",
      routing: "SERVICE_DOCTORS",
    });
    expect(staffEventFor(viewer("DOCTOR"), doctorChat)).not.toBeNull();
    expect(
      staffEventFor(
        viewer("DOCTOR", { doctorServiceIds: [OTHER_SERVICE] }),
        doctorChat,
      ),
    ).toBeNull();
    expect(staffEventFor(viewer("RECEPTIONIST"), doctorChat)).toBeNull();
    expect(
      staffEventFor(
        viewer("RECEPTIONIST"),
        notification({ channel: "DOCTOR", routing: "RECEPTION_FALLBACK" }),
      ),
    ).not.toBeNull();
  });

  it("tells whoever just lost a doctor chat to refetch", () => {
    const moved = notification({
      type: "conversation",
      channel: "DOCTOR",
      assignedDoctorId: "assigned",
      routing: "ASSIGNED_DOCTOR",
      previousRouting: "RECEPTION_FALLBACK",
      actor: "STAFF",
    });
    expect(
      staffEventFor(viewer("DOCTOR", { userId: "assigned" }), moved),
    ).not.toBeNull();
    expect(staffEventFor(viewer("DOCTOR"), moved)).not.toBeNull();
    expect(staffEventFor(viewer("RECEPTIONIST"), moved)).not.toBeNull();
    expect(
      staffEventFor(
        viewer("DOCTOR", { doctorServiceIds: [OTHER_SERVICE] }),
        moved,
      ),
    ).toBeNull();
    // A new message in that chat reaches the assigned doctor only.
    expect(
      staffEventFor(viewer("DOCTOR"), { ...moved, type: "message" }),
    ).toBeNull();
  });

  it("sends announcement progress to reception and admins", () => {
    const progress = {
      type: "broadcast",
      clinicId: "clinic-1",
      broadcastId: "b",
    } as const;
    expect(staffEventFor(viewer("CLINIC_ADMIN"), progress)).toEqual({
      type: "broadcast",
      broadcastId: "b",
    });
    expect(staffEventFor(viewer("DOCTOR"), progress)).toBeNull();
  });
});

describe("previewText", () => {
  it("flattens lines and cuts at 120 characters", () => {
    expect(previewText("Line one\n\nLine two")).toBe("Line one Line two");
    const long = previewText("x".repeat(500));
    expect(long).toHaveLength(120);
    expect(long.endsWith("…")).toBe(true);
  });
});
