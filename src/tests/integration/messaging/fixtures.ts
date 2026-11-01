import { expect } from "vitest";
import type { MembershipRole } from "@/generated/prisma/enums";
import { applyTokenAction, joinQueue } from "@/features/queue/service";
import type { ClinicAccess } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { deleteClinicFixtures, type ClinicFixture } from "../queue/fixtures";

export {
  actAs,
  createClinicFixture,
  type ClinicFixture,
} from "../queue/fixtures";

// Helpers for the messaging integration tests. Test files must still call
// vi.mock("@/lib/auth/session", ...) themselves (see ../queue/fixtures.ts).

export function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}

export function post(body?: unknown): Request {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function get(url = "http://test/api"): Request {
  return new Request(url);
}

export type Staff = { id: string; membershipId: string };

// A patient joins the fixture's queue (or another queue of its clinic).
export async function joinAs(
  fixture: ClinicFixture,
  patientName?: string,
  queueId: string = fixture.queue.id,
): Promise<{ tokenId: string; publicTokenId: string }> {
  const result = await joinQueue({
    queueId,
    patientName,
    idempotencyKey: crypto.randomUUID(),
  });
  return { tokenId: result.tokenId, publicTokenId: result.publicTokenId };
}

export function accessOf(
  fixture: ClinicFixture,
  staff: Staff,
  role: MembershipRole,
): ClinicAccess {
  return {
    user: { userId: staff.id, platformRole: null },
    clinicId: fixture.clinic.id,
    membershipId: staff.membershipId,
    role,
  };
}

// Another doctor in the fixture's clinic, assigned to the given services
// (none means every service).
export async function addDoctor(
  fixture: ClinicFixture,
  label: string,
  serviceIds: string[] = [],
): Promise<Staff> {
  const db = getDb();
  const user = await db.user.create({
    data: {
      name: `Dr ${label} ${fixture.run}`,
      email: `${label}-${fixture.run}@example.test`,
    },
  });
  const membership = await db.clinicMembership.create({
    data: { clinicId: fixture.clinic.id, userId: user.id, role: "DOCTOR" },
  });
  for (const serviceId of serviceIds) {
    await db.serviceAssignment.create({
      data: { membershipId: membership.id, serviceId },
    });
  }
  return { id: user.id, membershipId: membership.id };
}

// A second service with today's queue.
export async function addService(
  fixture: ClinicFixture,
  name: string,
  tokenPrefix: string,
): Promise<{ id: string; queueId: string }> {
  const db = getDb();
  const service = await db.service.create({
    data: { clinicId: fixture.clinic.id, name, tokenPrefix },
  });
  const queue = await db.queue.findFirstOrThrow({
    where: { clinicId: fixture.clinic.id },
    select: { queueDate: true },
  });
  const created = await db.queue.create({
    data: {
      clinicId: fixture.clinic.id,
      serviceId: service.id,
      queueDate: queue.queueDate,
    },
  });
  return { id: service.id, queueId: created.id };
}

// The doctor starts this token's consultation (the token is called first).
export async function startVisit(
  fixture: ClinicFixture,
  tokenId: string,
  doctor: Staff,
): Promise<void> {
  await getDb().queueToken.update({
    where: { id: tokenId },
    data: { status: "CALLED", calledAt: new Date() },
  });
  await applyTokenAction(tokenId, "start", accessOf(fixture, doctor, "DOCTOR"));
}

export async function expectError(
  response: Response,
  status: number,
  code: string,
): Promise<{ code: string; message: string }> {
  const body = await response.json();
  expect({ status: response.status, code: body.error?.code }).toEqual({
    status,
    code,
  });
  return body.error;
}

// Deletes what the messaging tests add on top of the queue fixtures.
export async function deleteMessagingFixtures(
  fixtures: readonly (ClinicFixture | undefined)[],
): Promise<void> {
  const db = getDb();
  const clinicIds = fixtures.flatMap((fixture) =>
    fixture ? [fixture.clinic.id] : [],
  );
  await db.broadcast.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.message.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await db.conversation.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await deleteClinicFixtures(fixtures);
}
