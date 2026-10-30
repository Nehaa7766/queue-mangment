import { describe, expect, it } from "vitest";
import { MembershipRole } from "@/generated/prisma/enums";
import { ACTIONS, can } from "@/lib/auth/permissions";

describe("permission matrix", () => {
  it("lets reception run the queue but not configure the clinic", () => {
    expect(can("RECEPTIONIST", "queue.callNext")).toBe(true);
    expect(can("RECEPTIONIST", "walkIn.create")).toBe(true);
    expect(can("RECEPTIONIST", "queue.pauseResume")).toBe(true);
    expect(can("RECEPTIONIST", "services.manage")).toBe(false);
    expect(can("RECEPTIONIST", "staff.manage")).toBe(false);
    expect(can("RECEPTIONIST", "consultation.start")).toBe(false);
  });

  it("lets doctors handle consultations only", () => {
    expect(can("DOCTOR", "consultation.start")).toBe(true);
    expect(can("DOCTOR", "consultation.complete")).toBe(true);
    expect(can("DOCTOR", "doctor.availability")).toBe(true);
    expect(can("DOCTOR", "queue.callNext")).toBe(false);
    expect(can("DOCTOR", "clinic.settings")).toBe(false);
    expect(can("DOCTOR", "audit.view")).toBe(false);
  });

  it("lets clinic admins configure the clinic but not act as doctors", () => {
    expect(can("CLINIC_ADMIN", "clinic.settings")).toBe(true);
    expect(can("CLINIC_ADMIN", "staff.manage")).toBe(true);
    expect(can("CLINIC_ADMIN", "audit.view")).toBe(true);
    expect(can("CLINIC_ADMIN", "queue.callNext")).toBe(true);
    expect(can("CLINIC_ADMIN", "consultation.start")).toBe(false);
  });

  it("grants every action to at least one role", () => {
    const roles = Object.values(MembershipRole);
    for (const action of ACTIONS) {
      expect(
        roles.some((role) => can(role, action)),
        action,
      ).toBe(true);
    }
  });
});
