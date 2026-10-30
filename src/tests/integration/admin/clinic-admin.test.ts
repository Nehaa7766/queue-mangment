import { verifyPassword } from "better-auth/crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as acceptRoute } from "@/app/api/invitations/[token]/accept/route";
import { POST as createServiceRoute } from "@/app/api/clinics/[clinicId]/services/route";
import { PATCH as settingsRoute } from "@/app/api/clinics/[clinicId]/settings/route";
import {
  getAdminAnalytics,
  getAdminDashboard,
  getAuditLog,
} from "@/features/analytics/admin-queries";
import {
  addHoliday,
  isClinicHoliday,
  removeHoliday,
} from "@/features/clinics/holidays";
import {
  getClinicSettings,
  updateClinicSettings,
} from "@/features/clinics/settings";
import {
  acceptInvitation,
  createInvitation,
  lookupInvitation,
  revokeInvitation,
} from "@/features/invitations/invitations";
import {
  getPublicClinicView,
  getStaffQueueView,
} from "@/features/queue/queries";
import { isOpenNow } from "@/features/queue/clinic-time";
import { getOrCreateTodayQueue, joinQueue } from "@/features/queue/service";
import {
  createService,
  listServices,
  updateService,
} from "@/features/services/service-admin";
import {
  listStaff,
  resetMemberPassword,
  setDoctorServices,
  updateMember,
} from "@/features/staff/staff-admin";
import { getDb } from "@/lib/db";
import {
  actAs,
  createAdminFixture,
  deleteAdminFixtures,
  errorCodeOf,
  type AdminFixture,
} from "./fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

let clinic: AdminFixture;
let other: AdminFixture;

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    createAdminFixture(),
    createAdminFixture(),
  ]);
});

afterAll(async () => {
  await deleteAdminFixtures([clinic, other]);
});

const QUEUE_SETTINGS = {
  waitTargetMinutes: 25,
  gracePeriodSeconds: 240,
  maxQueueSize: null,
  noShowAction: "SKIP",
  allowRequeue: false,
  patientDataRetentionDays: 14,
} as const;

function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://test/api", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function tokenFrom(acceptUrl: string): string {
  return new URL(acceptUrl).pathname.split("/").at(-1)!;
}

describe("access", () => {
  it("lets only this clinic's admins in", async () => {
    actAs(clinic.receptionist);
    expect(await errorCodeOf(listServices(clinic.clinic.id))).toBe("FORBIDDEN");
    expect(await errorCodeOf(getClinicSettings(clinic.clinic.id))).toBe(
      "FORBIDDEN",
    );

    actAs(other.admin);
    expect(await errorCodeOf(listStaff(clinic.clinic.id))).toBe("FORBIDDEN");
    expect(
      await errorCodeOf(updateService(clinic.service.id, { name: "Hacked" })),
    ).toBe("FORBIDDEN");

    actAs(null);
    expect(await errorCodeOf(listServices(clinic.clinic.id))).toBe(
      "UNAUTHENTICATED",
    );
  });

  it("answers an unknown clinic with 404 rather than 403", async () => {
    actAs(clinic.admin);
    expect(await errorCodeOf(listServices(crypto.randomUUID()))).toBe(
      "CLINIC_NOT_FOUND",
    );
  });
});

describe("services", () => {
  it("creates, edits and keeps prefixes unique", async () => {
    actAs(clinic.admin);
    const dental = await createService(clinic.clinic.id, {
      name: "Dental",
      description: null,
      tokenPrefix: "D",
      estimatedDurationMinutes: 15,
    });
    expect(dental).toMatchObject({ tokenPrefix: "D", isActive: true });

    const clash = await errorCodeOf(
      createService(clinic.clinic.id, {
        name: "Dermatology",
        description: null,
        tokenPrefix: "D",
        estimatedDurationMinutes: 10,
      }),
    );
    expect(clash).toBe("VALIDATION_ERROR");

    // The same prefix is fine at another clinic.
    actAs(other.admin);
    await createService(other.clinic.id, {
      name: "Dental",
      description: null,
      tokenPrefix: "D",
      estimatedDurationMinutes: 15,
    });

    actAs(clinic.admin);
    const renamed = await updateService(dental.id, {
      name: "Dental care",
      estimatedDurationMinutes: 20,
    });
    expect(renamed).toMatchObject({
      name: "Dental care",
      estimatedDurationMinutes: 20,
    });
  });

  it("turning a service off keeps its tokens and hides it from patients", async () => {
    actAs(clinic.admin);
    const physio = await createService(clinic.clinic.id, {
      name: "Physio",
      description: null,
      tokenPrefix: "P",
      estimatedDurationMinutes: 10,
    });
    const queue = await getOrCreateTodayQueue(physio.id);
    const joined = await joinQueue({
      queueId: queue.id,
      patientName: "Ravi",
      idempotencyKey: crypto.randomUUID(),
    });

    const off = await updateService(physio.id, { isActive: false });
    expect(off.isActive).toBe(false);
    expect(off.totalTokens).toBe(1);

    const token = await getDb().queueToken.findUniqueOrThrow({
      where: { id: joined.tokenId },
    });
    expect(token.status).toBe("WAITING");

    const publicView = await getPublicClinicView(clinic.clinic.slug);
    expect(publicView?.services.map((service) => service.name)).not.toContain(
      "Physio",
    );

    const audit = await getAuditLog(clinic.clinic.id, { category: "service" });
    expect(audit.entries.map((entry) => entry.action)).toContain(
      "service.disabled",
    );
  });

  it("creates through the route with 201", async () => {
    actAs(clinic.admin);
    const response = await createServiceRoute(
      jsonRequest("POST", {
        name: "Eye care",
        description: "",
        tokenPrefix: "eye",
        estimatedDurationMinutes: 12,
      }),
      params({ clinicId: clinic.clinic.id }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()).service.tokenPrefix).toBe("EYE");

    const bad = await createServiceRoute(
      jsonRequest("POST", { name: "X", tokenPrefix: "1" }),
      params({ clinicId: clinic.clinic.id }),
    );
    expect(bad.status).toBe(400);
  });
});

describe("settings", () => {
  it("queue settings reach the live queue view", async () => {
    actAs(clinic.admin);
    await updateClinicSettings(clinic.clinic.id, {
      section: "queue",
      ...QUEUE_SETTINGS,
    });

    const view = await getStaffQueueView(clinic.queue.id);
    expect(view?.settings).toEqual({
      waitTargetMinutes: 25,
      gracePeriodSeconds: 240,
      allowRequeue: false,
    });

    const audit = await getAuditLog(clinic.clinic.id, { category: "clinic" });
    expect(audit.entries[0]).toMatchObject({
      action: "clinic.queue_settings_updated",
      label: "Queue settings changed",
    });
  });

  it("stores opening hours in the format isOpenNow reads, and clears them", async () => {
    actAs(clinic.admin);
    const hours = { mon: [["09:00", "13:00"]] as [string, string][] };
    const saved = await updateClinicSettings(clinic.clinic.id, {
      section: "hours",
      openingHours: hours,
    });
    expect(saved.openingHours).toEqual(hours);

    const row = await getDb().clinic.findUniqueOrThrow({
      where: { id: clinic.clinic.id },
      select: { openingHours: true },
    });
    // Monday 26 Oct 2026, 10:30 in Kolkata.
    expect(
      isOpenNow(
        row.openingHours,
        "Asia/Kolkata",
        new Date("2026-10-26T05:00:00Z"),
      ),
    ).toBe(true);

    const cleared = await updateClinicSettings(clinic.clinic.id, {
      section: "hours",
      openingHours: null,
    });
    expect(cleared.openingHours).toBeNull();
  });

  it("saves through the route and rejects a bad section", async () => {
    actAs(clinic.admin);
    const ok = await settingsRoute(
      jsonRequest("PATCH", {
        section: "profile",
        name: `Renamed ${clinic.run}`,
        address: "MG Road",
        phone: "+91 98765 43210",
        timezone: "Asia/Kolkata",
      }),
      params({ clinicId: clinic.clinic.id }),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).settings.name).toBe(`Renamed ${clinic.run}`);

    const bad = await settingsRoute(
      jsonRequest("PATCH", { section: "billing" }),
      params({ clinicId: clinic.clinic.id }),
    );
    expect(bad.status).toBe(400);

    actAs(clinic.receptionist);
    const forbidden = await settingsRoute(
      jsonRequest("PATCH", { section: "queue", ...QUEUE_SETTINGS }),
      params({ clinicId: clinic.clinic.id }),
    );
    expect(forbidden.status).toBe(403);
  });

  it("adds and removes holidays", async () => {
    actAs(clinic.admin);
    const holiday = await addHoliday(clinic.clinic.id, {
      date: "2026-11-08",
      name: "Diwali",
    });
    expect(await isClinicHoliday(clinic.clinic.id, "2026-11-08")).toBe(true);
    expect(await isClinicHoliday(other.clinic.id, "2026-11-08")).toBe(false);
    expect(
      await errorCodeOf(
        addHoliday(clinic.clinic.id, { date: "2026-11-08", name: "Again" }),
      ),
    ).toBe("VALIDATION_ERROR");

    // Another clinic's admin can't remove it, even via their own clinic path.
    actAs(other.admin);
    expect(await errorCodeOf(removeHoliday(other.clinic.id, holiday.id))).toBe(
      "VALIDATION_ERROR",
    );

    actAs(clinic.admin);
    await removeHoliday(clinic.clinic.id, holiday.id);
    expect(await isClinicHoliday(clinic.clinic.id, "2026-11-08")).toBe(false);
  });
});

describe("staff", () => {
  it("changes roles and audits them, but never your own", async () => {
    actAs(clinic.admin);
    expect(
      await errorCodeOf(
        updateMember(clinic.clinic.id, clinic.admin.membershipId, {
          role: "RECEPTIONIST",
        }),
      ),
    ).toBe("FORBIDDEN");

    await updateMember(clinic.clinic.id, clinic.receptionist.membershipId, {
      role: "DOCTOR",
    });
    const changed = (await listStaff(clinic.clinic.id)).find(
      (member) => member.membershipId === clinic.receptionist.membershipId,
    );
    expect(changed?.role).toBe("DOCTOR");

    const audit = await getAuditLog(clinic.clinic.id, { category: "staff" });
    expect(audit.entries[0]).toMatchObject({
      action: "staff.role_changed",
      previousState: "RECEPTIONIST",
      newState: "DOCTOR",
    });

    await updateMember(clinic.clinic.id, clinic.receptionist.membershipId, {
      role: "RECEPTIONIST",
    });
  });

  it("refuses a member from another clinic's path", async () => {
    actAs(clinic.admin);
    expect(
      await errorCodeOf(
        updateMember(clinic.clinic.id, other.receptionist.membershipId, {
          status: "INACTIVE",
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });

  it("removing access ends the person's sessions", async () => {
    const db = getDb();
    await db.session.create({
      data: {
        userId: clinic.doctor.id,
        token: `session-${clinic.run}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    actAs(clinic.admin);
    await updateMember(clinic.clinic.id, clinic.doctor.membershipId, {
      status: "INACTIVE",
    });
    expect(
      await db.session.count({ where: { userId: clinic.doctor.id } }),
    ).toBe(0);

    await updateMember(clinic.clinic.id, clinic.doctor.membershipId, {
      status: "ACTIVE",
    });
  });

  it("resets a password with Better Auth's hash", async () => {
    actAs(clinic.admin);
    await resetMemberPassword(
      clinic.clinic.id,
      clinic.receptionist.membershipId,
      "a-new-password",
    );
    const account = await getDb().account.findUniqueOrThrow({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: clinic.receptionist.id,
        },
      },
    });
    expect(
      await verifyPassword({
        hash: account.password!,
        password: "a-new-password",
      }),
    ).toBe(true);
  });

  it("assigns doctors only to this clinic's services", async () => {
    actAs(clinic.admin);
    await setDoctorServices(clinic.clinic.id, clinic.doctor.membershipId, [
      clinic.service.id,
    ]);
    const doctor = (await listStaff(clinic.clinic.id)).find(
      (member) => member.membershipId === clinic.doctor.membershipId,
    );
    expect(doctor?.serviceIds).toEqual([clinic.service.id]);

    expect(
      await errorCodeOf(
        setDoctorServices(clinic.clinic.id, clinic.doctor.membershipId, [
          other.service.id,
        ]),
      ),
    ).toBe("VALIDATION_ERROR");
    expect(
      await errorCodeOf(
        setDoctorServices(clinic.clinic.id, clinic.receptionist.membershipId, [
          clinic.service.id,
        ]),
      ),
    ).toBe("VALIDATION_ERROR");
  });
});

describe("invitations", () => {
  it("invite → email queued → accept → signed-up member", async () => {
    actAs(clinic.admin);
    const email = `new-${clinic.run}@example.test`;
    const { invitation, acceptUrl } = await createInvitation(clinic.clinic.id, {
      name: "Neha",
      email,
      role: "DOCTOR",
    });
    expect(acceptUrl).toContain("/accept-invite/");

    const outbox = await getDb().outboxEvent.findFirstOrThrow({
      where: { aggregateId: invitation.id },
    });
    expect(outbox.eventType).toBe("staff.invited");
    expect(outbox.payload).toMatchObject({ email, acceptUrl, role: "DOCTOR" });

    const token = tokenFrom(acceptUrl);
    expect(await lookupInvitation(token)).toMatchObject({
      status: "valid",
      hasAccount: false,
    });

    actAs(null);
    await acceptInvitation(token, {
      name: "Neha S",
      password: "doctor-pass-1",
    });

    const user = await getDb().user.findUniqueOrThrow({
      where: { email },
      include: {
        memberships: true,
        accounts: true,
      },
    });
    expect(user.name).toBe("Neha S");
    expect(user.memberships).toMatchObject([
      { clinicId: clinic.clinic.id, role: "DOCTOR", status: "ACTIVE" },
    ]);
    expect(
      await verifyPassword({
        hash: user.accounts[0].password!,
        password: "doctor-pass-1",
      }),
    ).toBe(true);

    // The link works once.
    expect(await lookupInvitation(token)).toEqual({ status: "used" });
    expect(
      await errorCodeOf(
        acceptInvitation(token, { name: "Again", password: "doctor-pass-2" }),
      ),
    ).toBe("VALIDATION_ERROR");
  });

  it("rejects expired and cancelled links", async () => {
    actAs(clinic.admin);
    const expired = await createInvitation(clinic.clinic.id, {
      name: "Late",
      email: `late-${clinic.run}@example.test`,
      role: "RECEPTIONIST",
    });
    await getDb().staffInvitation.update({
      where: { id: expired.invitation.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await lookupInvitation(tokenFrom(expired.acceptUrl))).toEqual({
      status: "expired",
    });
    expect(
      await errorCodeOf(
        acceptInvitation(tokenFrom(expired.acceptUrl), {
          name: "Late",
          password: "late-pass-1",
        }),
      ),
    ).toBe("VALIDATION_ERROR");

    const cancelled = await createInvitation(clinic.clinic.id, {
      name: "Gone",
      email: `gone-${clinic.run}@example.test`,
      role: "RECEPTIONIST",
    });
    await revokeInvitation(clinic.clinic.id, cancelled.invitation.id);
    expect(await lookupInvitation(tokenFrom(cancelled.acceptUrl))).toEqual({
      status: "invalid",
    });
  });

  it("refuses inviting someone who already works here", async () => {
    actAs(clinic.admin);
    expect(
      await errorCodeOf(
        createInvitation(clinic.clinic.id, {
          name: "Doctor",
          email: clinic.doctor.email,
          role: "DOCTOR",
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });

  it("lets an existing account join without changing its password", async () => {
    actAs(other.admin);
    const { acceptUrl } = await createInvitation(other.clinic.id, {
      name: "Shared doctor",
      email: clinic.doctor.email,
      role: "DOCTOR",
    });
    const token = tokenFrom(acceptUrl);
    expect(await lookupInvitation(token)).toMatchObject({ hasAccount: true });

    await acceptInvitation(token, { name: "Shared doctor" });
    const memberships = await getDb().clinicMembership.findMany({
      where: { userId: clinic.doctor.id },
      select: { clinicId: true },
    });
    expect(memberships.map((row) => row.clinicId).sort()).toEqual(
      [clinic.clinic.id, other.clinic.id].sort(),
    );
    expect(
      await getDb().account.count({ where: { userId: clinic.doctor.id } }),
    ).toBe(0);
  });

  it("the accept route refuses a malformed link", async () => {
    const response = await acceptRoute(
      jsonRequest("POST", { name: "X", password: "whatever-1" }),
      params({ token: "short" }),
    );
    expect(response.status).toBe(400);
  });
});

describe("reports", () => {
  it("counts today's tokens in analytics", async () => {
    actAs(clinic.admin);
    const view = await getAdminAnalytics(clinic.clinic.id, "today");
    // The Physio join above, at least.
    expect(view.totals.joined).toBeGreaterThanOrEqual(1);
    expect(view.totals.qrJoins).toBe(view.totals.joined);

    actAs(clinic.doctor);
    expect(await errorCodeOf(getAdminAnalytics(clinic.clinic.id, "7d"))).toBe(
      "FORBIDDEN",
    );
  });

  it("builds the admin dashboard for admins only", async () => {
    actAs(clinic.admin);
    const view = await getAdminDashboard(clinic.clinic.id);
    expect(view.today.totals.joined).toBeGreaterThanOrEqual(1);
    expect(view.week.days).toHaveLength(7);
    expect(view.services.length).toBeGreaterThan(0);
    expect(view.waitTargetMinutes).toBeGreaterThan(0);

    actAs(clinic.receptionist);
    expect(await errorCodeOf(getAdminDashboard(clinic.clinic.id))).toBe(
      "FORBIDDEN",
    );
  });

  it("filters the audit log by person", async () => {
    actAs(clinic.admin);
    const mine = await getAuditLog(clinic.clinic.id, {
      actorUserId: clinic.admin.id,
    });
    expect(mine.entries.length).toBeGreaterThan(0);
    expect(new Set(mine.entries.map((entry) => entry.actorName))).toEqual(
      new Set([`admin ${clinic.run}`]),
    );
  });
});
