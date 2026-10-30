import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as setAvailability } from "@/app/api/doctor/availability/route";
import { GET as getDoctorPanel } from "@/app/api/doctor/queue/route";
import { POST as callNext } from "@/app/api/queues/[queueId]/call-next/route";
import { POST as joinQueue } from "@/app/api/queues/[queueId]/tokens/route";
import { POST as tokenAction } from "@/app/api/tokens/[tokenId]/[action]/route";
import type { DoctorPanelView } from "@/features/doctor/contracts";
import { getDoctorHistory } from "@/features/doctor/queries";
import { IDEMPOTENCY_KEY_HEADER } from "@/features/queue/contracts";
import {
  getPublicTokenView,
  getStaffQueueView,
} from "@/features/queue/queries";
import { getOrCreateTodayQueue } from "@/features/queue/service";
import { getDb } from "@/lib/db";
import {
  actAs,
  createClinicFixture,
  deleteClinicFixtures,
  type ClinicFixture,
} from "../queue/fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));

let clinic: ClinicFixture;
let other: ClinicFixture;
// A second service in `clinic`; the fixture doctor is assigned only to it.
let pediatrics: { serviceId: string; queueId: string };

beforeAll(async () => {
  [clinic, other] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
  ]);
  const db = getDb();
  const service = await db.service.create({
    data: { clinicId: clinic.clinic.id, name: "Pediatrics", tokenPrefix: "B" },
  });
  const queue = await getOrCreateTodayQueue(service.id);
  pediatrics = { serviceId: service.id, queueId: queue.id };
  await db.serviceAssignment.create({
    data: { membershipId: clinic.doctor.membershipId, serviceId: service.id },
  });
});

afterAll(async () => {
  await deleteClinicFixtures([clinic, other]);
});

function params<T>(value: T) {
  return { params: Promise.resolve(value) };
}

function post(body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function join(queueId: string, patientName: string) {
  const response = await joinQueue(
    post({ patientName }, { [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID() }),
    params({ queueId }),
  );
  expect(response.status).toBe(201);
  return (await response.json()).token as { publicTokenId: string };
}

async function callNextIn(queueId: string) {
  actAs(clinic.receptionist);
  const response = await callNext(post(), params({ queueId }));
  expect(response.status).toBe(200);
  return (await response.json()).token as { id: string; tokenLabel: string };
}

async function panel(url = "http://test/api/doctor/queue") {
  const response = await getDoctorPanel(new Request(url), {});
  return { status: response.status, body: await response.json() };
}

async function availability(body: unknown) {
  const response = await setAvailability(post(body), {});
  return { status: response.status, body: await response.json() };
}

describe("doctor availability", () => {
  it("updates the doctor's own availability and records an audit event", async () => {
    actAs(clinic.secondDoctor);
    const { status, body } = await availability({
      availability: "ON_BREAK",
      delayMinutes: 15,
      note: "Back after lunch",
    });

    expect(status).toBe(200);
    expect(body.doctor).toMatchObject({
      availability: "ON_BREAK",
      delayMinutes: 15,
      note: "Back after lunch",
    });
    const audit = await getDb().auditEvent.findFirstOrThrow({
      where: {
        clinicId: clinic.clinic.id,
        actorUserId: clinic.secondDoctor.id,
        action: "doctor.availability_changed",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toMatchObject({
      previousState: "AVAILABLE",
      newState: "ON_BREAK",
      metadata: { delayMinutes: 15, previousDelayMinutes: 0, hasNote: true },
    });

    // Reset for the other tests.
    await availability({ availability: "AVAILABLE" });
  });

  it("clears the delay when the doctor goes off duty", async () => {
    actAs(clinic.secondDoctor);
    const { body } = await availability({
      availability: "OFF_DUTY",
      delayMinutes: 30,
    });
    expect(body.doctor).toMatchObject({
      availability: "OFF_DUTY",
      delayMinutes: 0,
    });
    await availability({ availability: "AVAILABLE" });
  });

  it("rejects an invalid body", async () => {
    actAs(clinic.secondDoctor);
    const { status, body } = await availability({ availability: "LUNCH" });
    expect(status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("is only for doctors", async () => {
    actAs(clinic.receptionist);
    expect((await availability({ availability: "ON_BREAK" })).status).toBe(403);
    actAs(null);
    expect((await availability({ availability: "ON_BREAK" })).status).toBe(401);
  });
});

describe("doctor panel", () => {
  it("shows an assigned doctor only their services", async () => {
    await join(clinic.queue.id, "General patient");
    await join(pediatrics.queueId, "Pediatrics patient");
    const calledGeneral = await callNextIn(clinic.queue.id);

    actAs(clinic.doctor);
    const { status, body } = await panel();
    const view = body as DoctorPanelView;

    expect(status).toBe(200);
    expect(view.clinicId).toBe(clinic.clinic.id);
    expect(view.assignedOnly).toBe(true);
    expect(view.services.map((s) => s.name)).toEqual(["Pediatrics"]);
    expect(view.waiting.map((t) => t.serviceName)).toEqual(["Pediatrics"]);
    expect(view.called.map((t) => t.id)).not.toContain(calledGeneral.id);

    // A doctor without assignments sees every service.
    actAs(clinic.secondDoctor);
    const all = (await panel()).body as DoctorPanelView;
    expect(all.assignedOnly).toBe(false);
    expect(all.services.map((s) => s.name)).toEqual(["General", "Pediatrics"]);
    expect(all.called.map((t) => t.id)).toContain(calledGeneral.id);
  });

  it("refuses another clinic and non-doctors", async () => {
    actAs(clinic.doctor);
    const { status } = await panel(
      `http://test/api/doctor/queue?clinicId=${other.clinic.id}`,
    );
    expect(status).toBe(403);

    actAs(other.doctor);
    const own = (await panel()).body as DoctorPanelView;
    expect(own.clinicId).toBe(other.clinic.id);

    actAs(clinic.receptionist);
    expect((await panel()).status).toBe(403);
  });

  it("starts and completes a consultation and lists it in history", async () => {
    await join(pediatrics.queueId, "History patient");
    // Call until reception reaches our patient in Pediatrics.
    let called = await callNextIn(pediatrics.queueId);
    while (called.tokenLabel !== "B-2") {
      called = await callNextIn(pediatrics.queueId);
    }

    actAs(clinic.doctor);
    const started = await tokenAction(
      post(),
      params({ tokenId: called.id, action: "start" }),
    );
    expect(started.status).toBe(200);
    expect(((await panel()).body as DoctorPanelView).current?.id).toBe(
      called.id,
    );

    const completed = await tokenAction(
      post(),
      params({ tokenId: called.id, action: "complete" }),
    );
    expect(completed.status).toBe(200);
    const after = (await panel()).body as DoctorPanelView;
    expect(after.current).toBeNull();
    expect(after.seenToday).toBe(1);
    expect(after.averageConsultationMinutes).toBe(0);

    const history = await getDoctorHistory();
    expect(history.days).toHaveLength(1);
    expect(history.days[0].entries).toEqual([
      expect.objectContaining({
        id: called.id,
        tokenLabel: "B-2",
        patientName: "History patient",
        serviceName: "Pediatrics",
      }),
    ]);
  });
});

describe("availability banners", () => {
  it("tells reception and waiting patients when the doctors are away", async () => {
    const waiting = await join(pediatrics.queueId, "Banner patient");
    const notice = async () =>
      (await getPublicTokenView(waiting.publicTokenId))?.doctorNotice;

    // Both doctors serve Pediatrics and are available and on time.
    expect(await notice()).toBeNull();

    actAs(clinic.doctor);
    await availability({ availability: "ON_BREAK", delayMinutes: 10 });
    // Dr. 2 is still available, so patients aren't told about the break.
    expect(await notice()).toBeNull();

    actAs(clinic.receptionist);
    const pediatricsView = await getStaffQueueView(pediatrics.queueId);
    expect(pediatricsView?.doctors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.stringContaining("doctor "),
          availability: "ON_BREAK",
          delayMinutes: 10,
        }),
        expect.objectContaining({ availability: "AVAILABLE" }),
      ]),
    );
    // Dr. 1 only serves Pediatrics, so General lists Dr. 2 alone.
    const generalView = await getStaffQueueView(clinic.queue.id);
    expect(generalView?.doctors).toEqual([
      expect.objectContaining({ name: expect.stringContaining("doctor2 ") }),
    ]);

    actAs(clinic.secondDoctor);
    await availability({ availability: "ON_BREAK" });
    expect(await notice()).toEqual({ kind: "ON_BREAK", delayMinutes: 10 });

    await availability({ availability: "AVAILABLE", delayMinutes: 20 });
    expect(await notice()).toEqual({ kind: "DELAYED", delayMinutes: 20 });

    // Reset.
    await availability({ availability: "AVAILABLE" });
    actAs(clinic.doctor);
    await availability({ availability: "AVAILABLE" });
  });
});
