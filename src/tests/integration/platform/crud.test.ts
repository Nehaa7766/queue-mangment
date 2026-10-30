import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as logoRoute } from "@/app/api/public/clinics/[clinicSlug]/logo/route";
import { hashInvitationToken } from "@/features/invitations/tokens";
import {
  checkClinicSlug,
  createClinic,
  deleteClinic,
  getClinicDetail,
  listClinicsPage,
  updateClinic,
} from "@/features/platform/clinics";
import {
  clinicCreateSchema,
  clinicDetailsSchema,
} from "@/features/platform/schemas";
import {
  adminCreateTicket,
  adminUpdateTicket,
  deleteTicket,
} from "@/features/platform/support";
import {
  addClinicAdmin,
  deleteUser,
  listUsers,
  sendUserPasswordReset,
  setUserStatus,
  updateUser,
} from "@/features/platform/users";
import { getDb } from "@/lib/db";
import {
  actAs,
  cleanUp,
  createActiveClinic,
  createUser,
  createdTracker,
} from "./fixtures";

// Needs the test database migrated.
// Every row this file creates is tracked and removed at the end.
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

const created = createdTracker();
let admin: { id: string };

function run(): string {
  return crypto.randomUUID().slice(0, 8);
}

const MON_SAT = {
  openingTime: "09:00",
  closingTime: "18:00",
  workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
};

// A 1×1 PNG, as the form sends it.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PNG_LOGO = {
  contentType: "image/png",
  base64: `data:image/png;base64,${PNG_BASE64}`,
};

function clinicInput(overrides: Record<string, unknown> = {}) {
  const id = run();
  return clinicCreateSchema.parse({
    name: `Crud Clinic ${id}`,
    slug: `crud-clinic-${id}`,
    timezone: "Asia/Kolkata",
    status: "ACTIVE",
    clinicType: "GENERAL",
    email: null,
    address: "12 MG Road",
    phone: "+91 98765 43210",
    city: null,
    state: null,
    pinCode: null,
    hours: MON_SAT,
    serviceName: "General",
    tokenPrefix: "A",
    adminName: "Asha Admin",
    adminEmail: `crud-admin-${id}@example.test`,
    ...overrides,
  });
}

// An edit body: every field, hours left as they are unless given.
function detailsInput(slug: string, overrides: Record<string, unknown> = {}) {
  return clinicDetailsSchema.parse({
    name: "Edited Clinic",
    slug,
    timezone: "Asia/Kolkata",
    status: "ACTIVE",
    clinicType: "GENERAL",
    email: null,
    phone: null,
    address: null,
    city: null,
    state: null,
    pinCode: null,
    hours: null,
    ...overrides,
  });
}

async function serveLogo(slug: string) {
  return logoRoute(new Request(`http://test/api/public/clinics/${slug}/logo`), {
    params: Promise.resolve({ clinicSlug: slug }),
  });
}

async function addClinic(overrides: Record<string, unknown> = {}) {
  actAs(admin, "SUPER_ADMIN");
  const result = await createClinic(clinicInput(overrides));
  created.clinicIds.push(result.clinicId);
  return result;
}

// A queue token makes the clinic one with patient history.
async function addToken(clinicId: string) {
  const db = getDb();
  const service = await db.service.findFirstOrThrow({ where: { clinicId } });
  const queue = await db.queue.create({
    data: { clinicId, serviceId: service.id, queueDate: new Date() },
  });
  await db.queueToken.create({
    data: {
      queueId: queue.id,
      clinicId,
      serviceId: service.id,
      sequenceNumber: 1,
      sortKey: 1,
      tokenLabel: "A-1",
    },
  });
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

async function latestAudit(targetId: string) {
  return getDb().platformAuditEvent.findFirst({
    where: { targetId },
    orderBy: { createdAt: "desc" },
    select: { action: true, actorUserId: true, metadata: true },
  });
}

beforeAll(async () => {
  admin = await createUser(created, "crud-super", "SUPER_ADMIN");
});

afterAll(async () => {
  const db = getDb();
  const { clinicIds, userIds } = created;
  const invitations = await db.staffInvitation.findMany({
    where: { clinicId: { in: clinicIds } },
    select: { id: true },
  });
  await db.outboxEvent.deleteMany({
    where: {
      aggregateId: {
        in: [...invitations.map((row) => row.id), ...userIds],
      },
    },
  });
  await db.verification.deleteMany({ where: { value: { in: userIds } } });
  await db.queueToken.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.queue.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.auditEvent.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await cleanUp(created);
});

describe("clinics", () => {
  it("adds an active clinic with a service and an invited admin", async () => {
    const result = await addClinic();
    const db = getDb();

    const clinic = await db.clinic.findUniqueOrThrow({
      where: { id: result.clinicId },
      select: {
        status: true,
        address: true,
        services: { select: { name: true, tokenPrefix: true } },
      },
    });
    expect(clinic.status).toBe("ACTIVE");
    expect(clinic.address).toBe("12 MG Road");
    expect(clinic.services).toEqual([{ name: "General", tokenPrefix: "A" }]);

    expect(result.admin.kind).toBe("invited");
    if (result.admin.kind !== "invited") return;
    const token = result.admin.acceptUrl.split("/accept-invite/")[1];
    const invitation = await db.staffInvitation.findUniqueOrThrow({
      where: { tokenHash: hashInvitationToken(token) },
      select: { id: true, role: true, clinicId: true },
    });
    expect(invitation).toMatchObject({
      role: "CLINIC_ADMIN",
      clinicId: result.clinicId,
    });
    // Only the hash is stored; the email goes through the outbox.
    const outbox = await db.outboxEvent.findFirst({
      where: { eventType: "staff.invited", aggregateId: invitation.id },
    });
    expect(outbox).not.toBeNull();
    expect(await latestAudit(result.clinicId)).toMatchObject({
      action: "clinic.created",
      actorUserId: admin.id,
    });
  });

  it("adds an existing account as the admin straight away", async () => {
    const existing = await createUser(created, "existing-admin");
    const result = await addClinic({ adminEmail: existing.email });

    expect(result.admin).toEqual({ kind: "added", email: existing.email });
    const membership = await getDb().clinicMembership.findUnique({
      where: {
        clinicId_userId: { clinicId: result.clinicId, userId: existing.id },
      },
    });
    expect(membership?.role).toBe("CLINIC_ADMIN");
    expect(
      await getDb().staffInvitation.count({
        where: { clinicId: result.clinicId },
      }),
    ).toBe(0);
  });

  it("refuses an address that is taken and reports it in the slug check", async () => {
    const first = await addClinic();

    expect(await codeOf(createClinic(clinicInput({ slug: first.slug })))).toBe(
      "VALIDATION_ERROR",
    );
    expect(await checkClinicSlug(first.slug)).toEqual({
      available: false,
      reason: expect.any(String),
    });
    expect(await checkClinicSlug(first.slug, first.clinicId)).toEqual({
      available: true,
    });
  });

  it("edits the details and audits the changed fields", async () => {
    const { clinicId, slug } = await addClinic();
    const newSlug = `${slug}-new`;

    await updateClinic(
      clinicId,
      detailsInput(newSlug, { name: "Renamed Clinic", timezone: "Asia/Dubai" }),
    );

    const clinic = await getDb().clinic.findUniqueOrThrow({
      where: { id: clinicId },
    });
    expect(clinic).toMatchObject({
      name: "Renamed Clinic",
      slug: newSlug,
      timezone: "Asia/Dubai",
      address: null,
      phone: null,
    });
    const audit = await latestAudit(clinicId);
    expect(audit?.action).toBe("clinic.updated");
    expect(audit?.metadata).toMatchObject({
      changed: ["name", "slug", "timezone", "phone", "address"],
    });
  });

  it("adds a clinic with every profile field, its hours and a logo that serves", async () => {
    const { clinicId, slug } = await addClinic({
      status: "INACTIVE",
      clinicType: "DENTAL",
      email: "Front@Crud.Example",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      hours: {
        openingTime: "10:00",
        closingTime: "17:30",
        workingDays: ["mon", "tue", "wed", "thu", "fri"],
      },
      logo: PNG_LOGO,
    });

    const clinic = await getDb().clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        status: true,
        clinicType: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        pinCode: true,
        openingHours: true,
        logo: { select: { contentType: true } },
      },
    });
    expect(clinic).toMatchObject({
      status: "INACTIVE",
      clinicType: "DENTAL",
      email: "front@crud.example",
      phone: "+91 98765 43210",
      address: "12 MG Road",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      logo: { contentType: "image/png" },
    });
    const range = [["10:00", "17:30"]];
    expect(clinic.openingHours).toEqual({
      mon: range,
      tue: range,
      wed: range,
      thu: range,
      fri: range,
    });

    const response = await serveLogo(slug);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      Buffer.from(PNG_BASE64, "base64"),
    );

    // Added inactive: off until activated, not waiting for approval.
    const detail = await getClinicDetail(clinicId);
    expect(detail).toMatchObject({
      lifecycle: "SUSPENDED",
      hours: {
        kind: "simple",
        hours: {
          openingTime: "10:00",
          closingTime: "17:30",
          workingDays: ["mon", "tue", "wed", "thu", "fri"],
        },
      },
    });
    expect(detail?.logoUrl).toMatch(
      new RegExp(`^/api/public/clinics/${slug}/logo\\?v=\\d+$`),
    );
  });

  it("refuses a logo whose bytes aren't the image type it claims", async () => {
    actAs(admin, "SUPER_ADMIN");
    const input = clinicInput({
      logo: { contentType: "image/png", base64: btoa("<svg></svg>") },
    });
    expect(await codeOf(createClinic(input))).toBe("VALIDATION_ERROR");
    expect(await getDb().clinic.count({ where: { slug: input.slug } })).toBe(0);
  });

  it("edits the profile, keeps custom hours unless replaced, and swaps or removes the logo", async () => {
    const { clinicId, slug } = await addClinic();
    const custom = {
      mon: [
        ["09:00", "13:00"],
        ["17:00", "20:00"],
      ],
      sat: [["09:00", "12:00"]],
    };
    await getDb().clinic.update({
      where: { id: clinicId },
      data: { openingHours: custom },
    });
    expect((await getClinicDetail(clinicId))?.hours).toEqual({
      kind: "custom",
    });

    await updateClinic(
      clinicId,
      detailsInput(slug, {
        clinicType: "PEDIATRIC",
        email: "desk@crud.example",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001",
        logo: PNG_LOGO,
      }),
    );
    let clinic = await getDb().clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        clinicType: true,
        email: true,
        city: true,
        pinCode: true,
        openingHours: true,
        logo: { select: { contentType: true } },
      },
    });
    expect(clinic).toMatchObject({
      clinicType: "PEDIATRIC",
      email: "desk@crud.example",
      city: "Mumbai",
      pinCode: "400001",
      logo: { contentType: "image/png" },
    });
    expect(clinic.openingHours).toEqual(custom);
    expect((await latestAudit(clinicId))?.metadata).toMatchObject({
      changed: expect.not.arrayContaining(["openingHours"]),
    });

    await updateClinic(
      clinicId,
      detailsInput(slug, {
        clinicType: "PEDIATRIC",
        hours: MON_SAT,
        logo: null,
      }),
    );
    clinic = await getDb().clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        clinicType: true,
        email: true,
        city: true,
        pinCode: true,
        openingHours: true,
        logo: { select: { contentType: true } },
      },
    });
    expect(clinic.logo).toBeNull();
    expect((await getClinicDetail(clinicId))?.hours).toEqual({
      kind: "simple",
      hours: MON_SAT,
    });
    expect((await latestAudit(clinicId))?.metadata).toMatchObject({
      changed: expect.arrayContaining(["openingHours", "logo"]),
    });
    expect((await serveLogo(slug)).status).toBe(404);

    // The same simple hours again are no change at all.
    const before = await getDb().platformAuditEvent.count({
      where: { targetId: clinicId },
    });
    await updateClinic(
      clinicId,
      detailsInput(slug, { clinicType: "PEDIATRIC", hours: MON_SAT }),
    );
    expect(
      await getDb().platformAuditEvent.count({ where: { targetId: clinicId } }),
    ).toBe(before);
  });

  it("suspends or activates when the status is changed on edit", async () => {
    const { clinicId, slug } = await addClinic();

    await updateClinic(clinicId, detailsInput(slug, { status: "INACTIVE" }));
    expect((await getClinicDetail(clinicId))?.lifecycle).toBe("SUSPENDED");
    expect(
      await getDb().platformAuditEvent.count({
        where: { targetId: clinicId, action: "clinic.suspended" },
      }),
    ).toBe(1);

    await updateClinic(clinicId, detailsInput(slug, { status: "ACTIVE" }));
    expect((await getClinicDetail(clinicId))?.lifecycle).toBe("ACTIVE");
  });

  it("leaves a pending sign-up pending when it is edited or gets an admin", async () => {
    const { clinicId, slug } = await addClinic({ status: "INACTIVE" });
    await getDb().platformAuditEvent.create({
      data: {
        actorUserId: admin.id,
        action: "clinic.signed_up",
        targetType: "clinic",
        targetId: clinicId,
      },
    });

    await updateClinic(
      clinicId,
      detailsInput(slug, { status: "INACTIVE", city: "Nashik" }),
    );
    await addClinicAdmin({
      name: "Second Admin",
      email: `pending-admin-${run()}@example.test`,
      clinicId,
    });

    expect((await getClinicDetail(clinicId))?.lifecycle).toBe("PENDING");
  });

  it("pages clinics, telling pending from suspended before paging", async () => {
    const tag = `paging-${run()}`;
    const pending: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const { clinicId } = await addClinic({
        name: `${tag} pending ${index}`,
        slug: `${tag}-pending-${index}`,
        status: "INACTIVE",
      });
      await getDb().platformAuditEvent.create({
        data: {
          actorUserId: admin.id,
          action: "clinic.signed_up",
          targetType: "clinic",
          targetId: clinicId,
        },
      });
      pending.push(clinicId);
    }
    // Inactive but not a sign-up: suspended, never in the pending pages.
    await addClinic({
      name: `${tag} suspended`,
      slug: `${tag}-suspended`,
      status: "INACTIVE",
    });

    const first = await listClinicsPage({
      search: tag,
      lifecycle: "PENDING",
      page: 1,
      pageSize: 2,
    });
    const second = await listClinicsPage({
      search: tag,
      lifecycle: "PENDING",
      page: 2,
      pageSize: 2,
    });
    expect(first).toMatchObject({ total: 3, page: 1, pageCount: 2 });
    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(1);
    expect([...first.rows, ...second.rows].map((row) => row.id).sort()).toEqual(
      [...pending].sort(),
    );

    const all = await listClinicsPage({ search: tag, page: 1, pageSize: 10 });
    expect(all.total).toBe(4);
  });

  it("keeps the address of a clinic with patient history", async () => {
    const { clinicId, slug } = await addClinic();
    await addToken(clinicId);
    const details = detailsInput(slug, { name: "Still Renameable" });

    expect(
      await codeOf(updateClinic(clinicId, { ...details, slug: `${slug}-x` })),
    ).toBe("INVALID_STATE_TRANSITION");
    await updateClinic(clinicId, details);
    expect(
      (await getDb().clinic.findUniqueOrThrow({ where: { id: clinicId } }))
        .name,
    ).toBe("Still Renameable");
  });

  it("won't delete a clinic with patient history", async () => {
    const { clinicId, slug } = await addClinic();
    await addToken(clinicId);

    expect(await codeOf(deleteClinic(clinicId, slug))).toBe(
      "INVALID_STATE_TRANSITION",
    );
    expect(await getDb().clinic.count({ where: { id: clinicId } })).toBe(1);
  });

  it("needs the address typed to confirm", async () => {
    const { clinicId } = await addClinic();

    expect(await codeOf(deleteClinic(clinicId, "something-else"))).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("deletes a clinic without history, deactivates its only-here staff and keeps tickets", async () => {
    const db = getDb();
    const { clinicId, slug } = await addClinic();
    // One staff member works only here, another also at a second clinic.
    const onlyHere = await createUser(created, "only-here");
    const elsewhere = await createActiveClinic(created);
    await db.clinicMembership.createMany({
      data: [
        { clinicId, userId: onlyHere.id, role: "RECEPTIONIST" },
        { clinicId, userId: elsewhere.staff.id, role: "DOCTOR" },
      ],
    });
    await db.session.create({
      data: {
        userId: onlyHere.id,
        token: `crud-session-${run()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const service = await db.service.findFirstOrThrow({ where: { clinicId } });
    await db.queue.create({
      data: { clinicId, serviceId: service.id, queueDate: new Date() },
    });
    const ticket = await db.supportTicket.create({
      data: { clinicId, subject: "Keep me", body: "This ticket must stay." },
    });
    created.ticketIds.push(ticket.id);

    const result = await deleteClinic(clinicId, slug.toUpperCase());

    expect(result).toEqual({ deactivatedUsers: 1 });
    expect(await db.clinic.count({ where: { id: clinicId } })).toBe(0);
    expect(await db.queue.count({ where: { clinicId } })).toBe(0);
    expect(await db.service.count({ where: { clinicId } })).toBe(0);
    expect(await db.clinicMembership.count({ where: { clinicId } })).toBe(0);
    expect(await db.staffInvitation.count({ where: { clinicId } })).toBe(0);
    expect(
      (await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } }))
        .clinicId,
    ).toBeNull();
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: onlyHere.id } })).status,
    ).toBe("INACTIVE");
    expect(await db.session.count({ where: { userId: onlyHere.id } })).toBe(0);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: elsewhere.staff.id } }))
        .status,
    ).toBe("ACTIVE");
    expect(await latestAudit(clinicId)).toMatchObject({
      action: "clinic.deleted",
      metadata: { slug, deactivatedUsers: 1 },
    });
  });
});

describe("users", () => {
  it("invites a new clinic admin by email, storing only the token's hash", async () => {
    actAs(admin, "SUPER_ADMIN");
    const { clinic } = await createActiveClinic(created);
    const email = `new-admin-${run()}@example.test`;

    const result = await addClinicAdmin({
      name: "Neha Admin",
      email,
      clinicId: clinic.id,
    });

    expect(result).toMatchObject({
      kind: "invited",
      email,
      clinicName: clinic.name,
    });
    if (result.kind !== "invited") throw new Error("Expected an invitation.");
    const token = result.acceptUrl.split("/accept-invite/")[1];
    const invitation = await getDb().staffInvitation.findUniqueOrThrow({
      where: { tokenHash: hashInvitationToken(token) },
    });
    expect(invitation).toMatchObject({
      clinicId: clinic.id,
      email,
      role: "CLINIC_ADMIN",
      invitedByUserId: admin.id,
      acceptedAt: null,
      revokedAt: null,
    });
    expect(invitation.tokenHash).not.toBe(token);
    expect(
      await getDb().outboxEvent.count({
        where: { eventType: "staff.invited", aggregateId: invitation.id },
      }),
    ).toBe(1);
    expect(await latestAudit(clinic.id)).toMatchObject({
      action: "admin.invited",
      actorUserId: admin.id,
      metadata: { email, invitationId: invitation.id },
    });
    // No account exists until the invitation is accepted.
    expect(await getDb().user.count({ where: { email } })).toBe(0);
  });

  it("adds an existing account as an admin at once, and refuses a repeat", async () => {
    actAs(admin, "SUPER_ADMIN");
    const { clinic, staff: firstAdmin } = await createActiveClinic(created);
    const person = await createUser(created, "second-admin");

    // A clinic may have several admins.
    const result = await addClinicAdmin({
      name: person.name,
      email: person.email,
      clinicId: clinic.id,
    });

    expect(result).toEqual({
      kind: "added",
      email: person.email,
      clinicName: clinic.name,
      userId: person.id,
    });
    expect(
      await getDb().clinicMembership.findMany({
        where: { clinicId: clinic.id },
        select: { userId: true, role: true, status: true },
        orderBy: { createdAt: "asc" },
      }),
    ).toEqual([
      { userId: firstAdmin.id, role: "CLINIC_ADMIN", status: "ACTIVE" },
      { userId: person.id, role: "CLINIC_ADMIN", status: "ACTIVE" },
    ]);
    expect(await latestAudit(person.id)).toMatchObject({
      action: "admin.added",
      actorUserId: admin.id,
      metadata: { clinicId: clinic.id, clinicName: clinic.name },
    });
    expect(
      await getDb().staffInvitation.count({
        where: { clinicId: clinic.id, email: person.email },
      }),
    ).toBe(0);

    // Already a member of this clinic, whatever the role.
    for (const email of [person.email, firstAdmin.email]) {
      expect(
        await codeOf(
          addClinicAdmin({ name: "Again", email, clinicId: clinic.id }),
        ),
      ).toBe("VALIDATION_ERROR");
    }
  });

  it("refuses the super admin's email, a deactivated account and an unknown clinic", async () => {
    actAs(admin, "SUPER_ADMIN");
    const { clinic } = await createActiveClinic(created);
    const inactive = await createUser(created, "inactive-admin");
    await getDb().user.update({
      where: { id: inactive.id },
      data: { status: "INACTIVE" },
    });
    const superAdmin = await getDb().user.findUniqueOrThrow({
      where: { id: admin.id },
    });

    expect(
      await codeOf(
        addClinicAdmin({
          name: "Super",
          email: superAdmin.email,
          clinicId: clinic.id,
        }),
      ),
    ).toBe("VALIDATION_ERROR");
    expect(
      await codeOf(
        addClinicAdmin({
          name: inactive.name,
          email: inactive.email,
          clinicId: clinic.id,
        }),
      ),
    ).toBe("INVALID_STATE_TRANSITION");
    expect(
      await codeOf(
        addClinicAdmin({
          name: "Nobody",
          email: `nobody-${run()}@example.test`,
          clinicId: crypto.randomUUID(),
        }),
      ),
    ).toBe("CLINIC_NOT_FOUND");
    expect(
      await getDb().clinicMembership.count({
        where: {
          clinicId: clinic.id,
          userId: { in: [admin.id, inactive.id] },
        },
      }),
    ).toBe(0);
    // Adding an admin never grants a platform role.
    expect(
      await getDb().user.findUniqueOrThrow({
        where: { id: inactive.id },
        select: { platformRole: true },
      }),
    ).toEqual({ platformRole: null });
  });

  it("never deactivates or deletes a super admin", async () => {
    // A second SUPER_ADMIN row (e.g. one left from before there was only
    // one) stands in for the super admin seen from another session.
    const other = await createUser(created, "other-super", "SUPER_ADMIN");
    actAs(admin, "SUPER_ADMIN");

    expect(await codeOf(setUserStatus(other.id, "INACTIVE"))).toBe(
      "INVALID_STATE_TRANSITION",
    );
    expect(await codeOf(deleteUser(other.id))).toBe("INVALID_STATE_TRANSITION");
    expect(
      await getDb().user.findUniqueOrThrow({
        where: { id: other.id },
        select: { status: true, platformRole: true },
      }),
    ).toEqual({ status: "ACTIVE", platformRole: "SUPER_ADMIN" });
  });

  it("lists admins and staff in separate tabs, without the super admin", async () => {
    actAs(admin, "SUPER_ADMIN");
    const tag = `tabs-${run()}`;
    const { clinic: first } = await createActiveClinic(created);
    const { clinic: second } = await createActiveClinic(created);
    const onlyAdmin = await createUser(created, `${tag}-admin`);
    const onlyDoctor = await createUser(created, `${tag}-doctor`);
    const both = await createUser(created, `${tag}-both`);
    const gone = await createUser(created, `${tag}-gone`);
    await getDb().clinicMembership.createMany({
      data: [
        { clinicId: first.id, userId: onlyAdmin.id, role: "CLINIC_ADMIN" },
        { clinicId: first.id, userId: onlyDoctor.id, role: "DOCTOR" },
        { clinicId: first.id, userId: both.id, role: "CLINIC_ADMIN" },
        { clinicId: second.id, userId: both.id, role: "RECEPTIONIST" },
      ],
    });
    await getDb().user.update({
      where: { id: gone.id },
      data: { status: "INACTIVE" },
    });
    await createUser(created, `${tag}-super`, "SUPER_ADMIN");

    // Someone who is admin at one clinic and staff at another is in both.
    const admins = await listUsers({ tab: "admins", search: tag });
    expect(admins.rows.map((row) => row.id).sort()).toEqual(
      [onlyAdmin.id, both.id].sort(),
    );
    expect(admins.counts).toEqual({ admins: 2, staff: 3 });

    // Staff also lists people with no clinic left, so they can be removed.
    const staff = await listUsers({ tab: "staff", search: tag });
    expect(staff.rows.map((row) => row.id).sort()).toEqual(
      [onlyDoctor.id, both.id, gone.id].sort(),
    );
    const bothRow = staff.rows.find((row) => row.id === both.id);
    expect(bothRow?.memberships).toEqual([
      {
        clinicId: first.id,
        clinicName: first.name,
        role: "CLINIC_ADMIN",
        status: "ACTIVE",
      },
      {
        clinicId: second.id,
        clinicName: second.name,
        role: "RECEPTIONIST",
        status: "ACTIVE",
      },
    ]);
    expect(bothRow?.deleteBlocker).toMatch(/Deactivate instead/);
    expect(
      staff.rows.find((row) => row.id === gone.id)?.deleteBlocker,
    ).toBeNull();

    const inactive = await listUsers({
      tab: "staff",
      search: tag,
      status: "INACTIVE",
    });
    expect(inactive.rows.map((row) => row.id)).toEqual([gone.id]);
    expect(inactive.counts).toEqual({ admins: 0, staff: 1 });
  });

  it("pages a tab in a stable order and shows the last page for one past the end", async () => {
    actAs(admin, "SUPER_ADMIN");
    const tag = `paging-${run()}`;
    // Staff tab: people with no clinic left. Same creation time order is
    // broken by id, so the pages never overlap.
    for (let index = 0; index < 5; index += 1) {
      await createUser(created, `${tag}-${index}`);
    }

    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        listUsers({ tab: "staff", search: tag, page, pageSize: 2 }),
      ),
    );
    expect(pages.map((result) => result.rows.length)).toEqual([2, 2, 1]);
    expect(pages[0]).toMatchObject({ total: 5, page: 1, pageCount: 3 });
    const ids = pages.flatMap((result) => result.rows.map((row) => row.id));
    expect(new Set(ids).size).toBe(5);

    const pastTheEnd = await listUsers({
      tab: "staff",
      search: tag,
      page: 9,
      pageSize: 2,
    });
    expect(pastTheEnd.page).toBe(3);
    expect(pastTheEnd.rows.map((row) => row.id)).toEqual(
      pages[2].rows.map((row) => row.id),
    );
  });

  it("edits a user's name and email, refusing an email in use", async () => {
    actAs(admin, "SUPER_ADMIN");
    const user = await createUser(created, "editable");
    const other = await createUser(created, "taken");
    const email = `renamed-${run()}@example.test`;

    await updateUser(user.id, { name: "Renamed", email });
    expect(
      await getDb().user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject({ name: "Renamed", email });
    expect(
      await codeOf(
        updateUser(user.id, { name: "Renamed", email: other.email }),
      ),
    ).toBe("VALIDATION_ERROR");
    expect((await latestAudit(user.id))?.action).toBe("user.updated");
  });

  it("sends a password reset only to active users", async () => {
    actAs(admin, "SUPER_ADMIN");
    const user = await createUser(created, "reset-me");

    await sendUserPasswordReset(user.id);
    expect(
      await getDb().outboxEvent.count({
        where: {
          eventType: "auth.password-reset-requested",
          aggregateId: user.id,
        },
      }),
    ).toBe(1);
    expect((await latestAudit(user.id))?.action).toBe(
      "user.password_reset_sent",
    );

    await setUserStatus(user.id, "INACTIVE");
    expect(await codeOf(sendUserPasswordReset(user.id))).toBe(
      "INVALID_STATE_TRANSITION",
    );
  });

  it("deletes a user without access or history, but not one with clinic access or yourself", async () => {
    actAs(admin, "SUPER_ADMIN");
    const free = await createUser(created, "deletable");
    const { staff } = await createActiveClinic(created);

    await deleteUser(free.id);
    expect(await getDb().user.count({ where: { id: free.id } })).toBe(0);
    expect((await latestAudit(free.id))?.action).toBe("user.deleted");

    expect(await codeOf(deleteUser(staff.id))).toBe("INVALID_STATE_TRANSITION");
    expect(await codeOf(deleteUser(admin.id))).toBe("VALIDATION_ERROR");
    expect(await codeOf(setUserStatus(admin.id, "INACTIVE"))).toBe(
      "VALIDATION_ERROR",
    );
  });
});

describe("support tickets", () => {
  it("opens, edits and deletes a ticket, auditing each step", async () => {
    actAs(admin, "SUPER_ADMIN");
    const { clinic } = await createActiveClinic(created);

    const ticket = await adminCreateTicket({
      clinicId: clinic.id,
      subject: "Printer for tokens",
      body: "The clinic asked how to print token slips at reception.",
      status: "OPEN",
    });
    created.ticketIds.push(ticket.id);
    expect(ticket).toMatchObject({
      clinicId: clinic.id,
      clinicName: clinic.name,
      status: "OPEN",
    });
    expect((await latestAudit(ticket.id))?.action).toBe(
      "support_ticket.created",
    );

    const edited = await adminUpdateTicket(ticket.id, {
      subject: "Printing token slips",
      body: "Explained browser printing; thermal printers come later.",
      status: "RESOLVED",
    });
    expect(edited).toMatchObject({
      subject: "Printing token slips",
      status: "RESOLVED",
    });
    expect(await latestAudit(ticket.id)).toMatchObject({
      action: "support_ticket.updated",
      metadata: { previousStatus: "OPEN", newStatus: "RESOLVED" },
    });

    await deleteTicket(ticket.id);
    expect(
      await getDb().supportTicket.count({ where: { id: ticket.id } }),
    ).toBe(0);
    expect((await latestAudit(ticket.id))?.action).toBe(
      "support_ticket.deleted",
    );
  });

  it("opens a ticket with no clinic, and refuses an unknown clinic", async () => {
    actAs(admin, "SUPER_ADMIN");
    const ticket = await adminCreateTicket({
      clinicId: null,
      subject: "Platform question",
      body: "Asked about adding a second branch next year.",
      status: "IN_PROGRESS",
    });
    created.ticketIds.push(ticket.id);
    expect(ticket.clinicId).toBeNull();

    expect(
      await codeOf(
        adminCreateTicket({
          clinicId: crypto.randomUUID(),
          subject: "Unknown clinic",
          body: "This clinic id does not exist anywhere.",
          status: "OPEN",
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });
});

describe("access", () => {
  it("refuses clinic staff and signed-out callers on every call", async () => {
    const { clinic, staff } = await createActiveClinic(created);
    const id = crypto.randomUUID();
    const calls = () => [
      createClinic(clinicInput()),
      updateClinic(clinic.id, detailsInput(clinic.slug, { name: "Nope" })),
      deleteClinic(clinic.id, clinic.slug),
      checkClinicSlug("anything-free"),
      addClinicAdmin({
        name: "Nope",
        email: `nope-${run()}@example.test`,
        clinicId: clinic.id,
      }),
      listUsers({ tab: "admins" }),
      updateUser(id, { name: "Nope", email: "nope@example.test" }),
      sendUserPasswordReset(id),
      deleteUser(id),
      adminCreateTicket({
        clinicId: null,
        subject: "Nope",
        body: "Should never be created.",
        status: "OPEN",
      }),
      adminUpdateTicket(id, {
        subject: "Nope",
        body: "Should never be saved.",
        status: "OPEN",
      }),
      deleteTicket(id),
    ];

    actAs(staff);
    for (const code of await Promise.all(calls().map(codeOf))) {
      expect(code).toBe("FORBIDDEN");
    }
    actAs(null);
    for (const code of await Promise.all(calls().map(codeOf))) {
      expect(code).toBe("UNAUTHENTICATED");
    }
    expect(
      (await getDb().clinic.findUniqueOrThrow({ where: { id: clinic.id } }))
        .name,
    ).toBe(clinic.name);
  });
});
