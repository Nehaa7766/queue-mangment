import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as activityRoute } from "@/app/api/platform/activity/route";
import {
  GET as clinicRoute,
  PATCH as patchClinic,
} from "@/app/api/platform/clinics/[clinicId]/route";
import { PUT as putSubscription } from "@/app/api/platform/clinics/[clinicId]/subscription/route";
import { GET as clinicsRoute } from "@/app/api/platform/clinics/route";
import { PATCH as patchSettings } from "@/app/api/platform/settings/route";
import { PATCH as patchTicket } from "@/app/api/platform/support/[ticketId]/route";
import { PATCH as patchUser } from "@/app/api/platform/users/[userId]/route";
import { GET as usersRoute } from "@/app/api/platform/users/route";
import {
  GET as clinicTicketsRoute,
  POST as createTicketRoute,
} from "@/app/api/support/tickets/route";
import { listClinics } from "@/features/platform/clinics";
import { getPlatformSettings } from "@/features/platform/settings-store";
import { loadStaffContext } from "@/lib/auth/staff-context";
import { getDb } from "@/lib/db";
import {
  actAs,
  cleanUp,
  createActiveClinic,
  createUser,
  createdTracker,
} from "./fixtures";

// Needs the test database migrated and seeded (the "pilot" plan).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

const created = createdTracker();
let admin: { id: string };
let target: Awaited<ReturnType<typeof createActiveClinic>>;

beforeAll(async () => {
  admin = await createUser(created, "platform-admin", "SUPER_ADMIN");
  target = await createActiveClinic(created);
});

afterAll(async () => {
  await cleanUp(created);
});

const params = <T>(value: T) => ({ params: Promise.resolve(value) });

function json(method: string, body: unknown): Request {
  return new Request("http://test/api", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function auditFor(targetId: string) {
  return getDb().platformAuditEvent.findMany({
    where: { targetId },
    orderBy: { createdAt: "asc" },
    select: { action: true, actorUserId: true },
  });
}

describe("platform endpoints are for super admins only", () => {
  it("rejects signed-out callers with 401", async () => {
    actAs(null);
    const response = await clinicsRoute(new Request("http://test/api"), {});
    expect(response.status).toBe(401);
  });

  it("rejects clinic staff with 403 everywhere", async () => {
    actAs(target.staff);
    const responses = await Promise.all([
      clinicsRoute(new Request("http://test/api"), {}),
      usersRoute(new Request("http://test/api"), {}),
      activityRoute(new Request("http://test/api"), {}),
      clinicRoute(
        new Request("http://test/api"),
        params({ clinicId: target.clinic.id }),
      ),
      patchClinic(
        json("PATCH", { status: "INACTIVE" }),
        params({ clinicId: target.clinic.id }),
      ),
      patchUser(
        json("PATCH", { status: "INACTIVE" }),
        params({ userId: admin.id }),
      ),
      patchSettings(json("PATCH", { signupsEnabled: false }), {}),
      putSubscription(
        json("PUT", {
          planId: crypto.randomUUID(),
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodEnd: null,
        }),
        params({ clinicId: target.clinic.id }),
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("FORBIDDEN");
    }
    // Nothing changed.
    expect(
      (
        await getDb().clinic.findUniqueOrThrow({
          where: { id: target.clinic.id },
        })
      ).status,
    ).toBe("ACTIVE");
  });
});

describe("clinic status", () => {
  it("suspending blocks staff; reactivating restores them; both audited", async () => {
    actAs(admin, "SUPER_ADMIN");

    const suspended = await patchClinic(
      json("PATCH", { status: "INACTIVE" }),
      params({ clinicId: target.clinic.id }),
    );
    expect(suspended.status).toBe(200);
    expect((await suspended.json()).clinic.lifecycle).toBe("SUSPENDED");
    expect(await loadStaffContext(target.staff.id)).toBeNull();
    expect(
      (await listClinics({ lifecycle: "SUSPENDED" })).some(
        (clinic) => clinic.id === target.clinic.id,
      ),
    ).toBe(true);

    await patchClinic(
      json("PATCH", { status: "ACTIVE" }),
      params({ clinicId: target.clinic.id }),
    );
    expect((await loadStaffContext(target.staff.id))?.clinic.id).toBe(
      target.clinic.id,
    );

    expect(await auditFor(target.clinic.id)).toEqual([
      { action: "clinic.suspended", actorUserId: admin.id },
      { action: "clinic.activated", actorUserId: admin.id },
    ]);
  });

  it("returns 404 for an unknown clinic", async () => {
    actAs(admin, "SUPER_ADMIN");
    const response = await patchClinic(
      json("PATCH", { status: "ACTIVE" }),
      params({ clinicId: crypto.randomUUID() }),
    );
    expect(response.status).toBe(404);
  });
});

describe("users", () => {
  it("deactivating signs the user out and is audited", async () => {
    actAs(admin, "SUPER_ADMIN");
    const user = await createUser(created, "member");
    await getDb().session.create({
      data: {
        userId: user.id,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const response = await patchUser(
      json("PATCH", { status: "INACTIVE" }),
      params({ userId: user.id }),
    );
    expect(response.status).toBe(200);
    expect(
      (await getDb().user.findUniqueOrThrow({ where: { id: user.id } })).status,
    ).toBe("INACTIVE");
    expect(await getDb().session.count({ where: { userId: user.id } })).toBe(0);

    await patchUser(
      json("PATCH", { status: "ACTIVE" }),
      params({ userId: user.id }),
    );
    expect(await auditFor(user.id)).toEqual([
      { action: "user.deactivated", actorUserId: admin.id },
      { action: "user.reactivated", actorUserId: admin.id },
    ]);
  });

  it("won't let a super admin deactivate themselves", async () => {
    actAs(admin, "SUPER_ADMIN");
    const response = await patchUser(
      json("PATCH", { status: "INACTIVE" }),
      params({ userId: admin.id }),
    );
    expect(response.status).toBe(400);
  });
});

describe("subscriptions", () => {
  it("creates then updates a subscription, auditing both", async () => {
    actAs(admin, "SUPER_ADMIN");
    const plan = await getDb().plan.findUniqueOrThrow({
      where: { code: "pilot" },
    });

    const first = await putSubscription(
      json("PUT", {
        planId: plan.id,
        status: "TRIALING",
        trialEndsAt: "2026-12-31",
        currentPeriodEnd: null,
      }),
      params({ clinicId: target.clinic.id }),
    );
    expect(first.status).toBe(200);
    const second = await putSubscription(
      json("PUT", {
        planId: plan.id,
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodEnd: "2027-01-31",
      }),
      params({ clinicId: target.clinic.id }),
    );
    expect((await second.json()).subscription).toMatchObject({
      status: "ACTIVE",
      trialEndsAt: null,
      currentPeriodEnd: "2027-01-31",
    });

    const subscription = await getDb().subscription.findUniqueOrThrow({
      where: { clinicId: target.clinic.id },
    });
    expect(await auditFor(subscription.id)).toEqual([
      { action: "subscription.created", actorUserId: admin.id },
      { action: "subscription.updated", actorUserId: admin.id },
    ]);
  });

  it("rejects an unknown plan", async () => {
    actAs(admin, "SUPER_ADMIN");
    const response = await putSubscription(
      json("PUT", {
        planId: crypto.randomUUID(),
        status: "ACTIVE",
        trialEndsAt: null,
        currentPeriodEnd: null,
      }),
      params({ clinicId: target.clinic.id }),
    );
    expect(response.status).toBe(400);
  });
});

describe("support tickets", () => {
  it("staff open tickets for their clinic; super admins move them along", async () => {
    actAs(target.staff);
    const createdResponse = await createTicketRoute(
      json("POST", {
        subject: "Call next is slow",
        body: "Takes a few seconds on the reception tablet.",
      }),
      {},
    );
    expect(createdResponse.status).toBe(201);
    const { ticket } = await createdResponse.json();
    created.ticketIds.push(ticket.id);

    const list = await (
      await clinicTicketsRoute(new Request("http://test/api"), {})
    ).json();
    expect(list.tickets.map((t: { id: string }) => t.id)).toContain(ticket.id);

    // Staff can't change status.
    const forbidden = await patchTicket(
      json("PATCH", { status: "RESOLVED" }),
      params({ ticketId: ticket.id }),
    );
    expect(forbidden.status).toBe(403);

    actAs(admin, "SUPER_ADMIN");
    const resolved = await patchTicket(
      json("PATCH", { status: "RESOLVED" }),
      params({ ticketId: ticket.id }),
    );
    expect((await resolved.json()).ticket.status).toBe("RESOLVED");
    expect(await auditFor(ticket.id)).toEqual([
      { action: "support_ticket.status_changed", actorUserId: admin.id },
    ]);
  });

  it("signed-out visitors can't open tickets", async () => {
    actAs(null);
    const response = await createTicketRoute(
      json("POST", { subject: "Hello", body: "Is anyone there at all?" }),
      {},
    );
    expect(response.status).toBe(401);
  });
});

describe("platform settings", () => {
  it("saves settings and audits the change", async () => {
    actAs(admin, "SUPER_ADMIN");
    const current = await getPlatformSettings();

    // Same values as before, so other tests sharing the database see no change.
    const response = await patchSettings(
      json("PATCH", { defaultTrialDays: current.defaultTrialDays }),
      {},
    );
    expect(response.status).toBe(200);
    expect((await response.json()).settings).toEqual(current);

    const audit = await getDb().platformAuditEvent.findFirst({
      where: { actorUserId: admin.id, action: "platform_settings.updated" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects unknown settings", async () => {
    actAs(admin, "SUPER_ADMIN");
    const response = await patchSettings(json("PATCH", { theme: "dark" }), {});
    expect(response.status).toBe(400);
  });
});
