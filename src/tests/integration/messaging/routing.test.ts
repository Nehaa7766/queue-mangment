import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  GET as getConversationMessages,
  POST as sendStaffMessage,
} from "@/app/api/messages/conversations/[conversationId]/messages/route";
import { GET as getInbox } from "@/app/api/messages/conversations/route";
import { POST as startConversation } from "@/app/api/messages/tokens/[tokenId]/[channel]/route";
import {
  GET as getPatientMessages,
  POST as sendPatientMessage,
} from "@/app/api/public/tokens/[publicTokenId]/messages/[channel]/route";
import { GET as getPatientSummary } from "@/app/api/public/tokens/[publicTokenId]/messages/route";
import type {
  InboxPage,
  MessagePage,
  PatientMessagingSummary,
} from "@/features/messaging/contracts";
import { DOCTOR_ASSIGNED } from "@/features/messaging/token-hooks";
import { applyTokenAction } from "@/features/queue/service";
import { getDb } from "@/lib/db";
import {
  accessOf,
  actAs,
  addDoctor,
  addService,
  createClinicFixture,
  deleteMessagingFixtures,
  expectError,
  get,
  joinAs,
  params,
  post,
  startVisit,
  type ClinicFixture,
  type Staff,
} from "./fixtures";

// Needs the test database with migrations applied (npm run db:deploy).
vi.mock("@/lib/auth/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

// The fixture's own two doctors have no service assignments, so they serve
// every service. Pediatrics also has its own doctor; generalOnly serves
// only General.
let clinic: ClinicFixture;
let pediatrics: { id: string; queueId: string };
let pediatrician: Staff;
let generalOnly: Staff;
// A clinic whose only doctors serve Dental: General has no doctor, so
// reception answers its doctor chats.
let fallbackClinic: ClinicFixture;

beforeAll(async () => {
  [clinic, fallbackClinic] = await Promise.all([
    createClinicFixture(),
    createClinicFixture(),
  ]);
  pediatrics = await addService(clinic, "Pediatrics", "P");
  pediatrician = await addDoctor(clinic, "peds", [pediatrics.id]);
  generalOnly = await addDoctor(clinic, "general", [clinic.service.id]);

  const dental = await addService(fallbackClinic, "Dental", "D");
  const db = getDb();
  for (const doctor of [fallbackClinic.doctor, fallbackClinic.secondDoctor]) {
    await db.serviceAssignment.create({
      data: { membershipId: doctor.membershipId, serviceId: dental.id },
    });
  }
});

afterAll(async () => {
  await deleteMessagingFixtures([clinic, fallbackClinic]);
});

const HOUR = 60 * 60_000;

function patientSend(publicTokenId: string, body: string, channel = "doctor") {
  return sendPatientMessage(
    post({ clientMessageId: crypto.randomUUID(), body }),
    params({ publicTokenId, channel }),
  );
}

async function summary(publicTokenId: string) {
  const response = await getPatientSummary(get(), params({ publicTokenId }));
  return (await response.json()) as PatientMessagingSummary;
}

async function patientPage(publicTokenId: string) {
  const response = await getPatientMessages(
    get(),
    params({ publicTokenId, channel: "doctor" }),
  );
  return (await response.json()) as MessagePage;
}

async function doctorChatOf(tokenId: string) {
  return getDb().conversation.findUniqueOrThrow({
    where: { tokenId_channel: { tokenId, channel: "DOCTOR" } },
  });
}

// The status each staff member gets when opening the chat.
async function statusFor(conversationId: string, staff: { id: string }) {
  actAs(staff);
  const response = await getConversationMessages(
    get(),
    params({ conversationId }),
  );
  return response.status;
}

async function inboxIds(staff: { id: string }, query = "?channel=doctor") {
  actAs(staff);
  const response = await getInbox(get(`http://test/api${query}`), {});
  return ((await response.json()) as InboxPage).items.map(
    (i) => i.conversationId,
  );
}

function staffSend(conversationId: string, body: string) {
  return sendStaffMessage(
    post({ clientMessageId: crypto.randomUUID(), body }),
    params({ conversationId }),
  );
}

async function doctorChatAudits(tokenId: string) {
  return getDb().auditEvent.findMany({
    where: { tokenId, action: DOCTOR_ASSIGNED },
  });
}

describe("before the consultation: the service's doctors", () => {
  it("lets doctors serving the service in, and nobody else", async () => {
    const token = await joinAs(clinic, "Child", pediatrics.queueId);
    expect(
      (await patientSend(token.publicTokenId, "Fever since morning")).status,
    ).toBe(201);
    const { id } = await doctorChatOf(token.tokenId);

    expect(await statusFor(id, pediatrician)).toBe(200);
    // No assignments: serves every service.
    expect(await statusFor(id, clinic.doctor)).toBe(200);
    expect(await statusFor(id, generalOnly)).toBe(404);
    expect(await statusFor(id, clinic.receptionist)).toBe(404);
    expect(await statusFor(id, clinic.admin)).toBe(404);
    expect(await inboxIds(pediatrician)).toContain(id);
    expect(await inboxIds(generalOnly)).not.toContain(id);
    expect(await inboxIds(clinic.admin)).not.toContain(id);
    expect((await summary(token.publicTokenId)).doctor.routing).toEqual({
      kind: "SERVICE_DOCTORS",
      serviceName: "Pediatrics",
    });
  });

  it("shows patients the doctor's own name and staff each other's names", async () => {
    const token = await joinAs(clinic, "Named", pediatrics.queueId);
    await patientSend(token.publicTokenId, "Hello doctor");
    const { id } = await doctorChatOf(token.tokenId);
    actAs(pediatrician);

    const reply = await staffSend(id, "Hello, how old is the child?");

    expect(reply.status).toBe(201);
    expect((await reply.json()).senderName).toBe(`Dr peds ${clinic.run}`);
    const page = await patientPage(token.publicTokenId);
    expect(page.messages.at(-1)!.senderName).toBe(`Dr peds ${clinic.run}`);
  });

  it("lets a serving doctor start the doctor chat, but not reception", async () => {
    const token = await joinAs(clinic, "Start", pediatrics.queueId);

    actAs(clinic.receptionist);
    await expectError(
      await startConversation(
        post(),
        params({ tokenId: token.tokenId, channel: "doctor" }),
      ),
      404,
      "CONVERSATION_NOT_FOUND",
    );
    actAs(generalOnly);
    await expectError(
      await startConversation(
        post(),
        params({ tokenId: token.tokenId, channel: "doctor" }),
      ),
      404,
      "CONVERSATION_NOT_FOUND",
    );
    actAs(pediatrician);
    const started = await startConversation(
      post(),
      params({ tokenId: token.tokenId, channel: "doctor" }),
    );
    expect(started.status).toBe(201);
    // Doctors never see the reception chat.
    await expectError(
      await startConversation(
        post(),
        params({ tokenId: token.tokenId, channel: "reception" }),
      ),
      404,
      "CONVERSATION_NOT_FOUND",
    );
  });
});

describe("reception fallback", () => {
  it("lets reception answer when no active doctor serves the service", async () => {
    const token = await joinAs(fallbackClinic, "No doctor");
    expect(
      (await patientSend(token.publicTokenId, "Who is my doctor?")).status,
    ).toBe(201);
    const { id } = await doctorChatOf(token.tokenId);

    expect((await summary(token.publicTokenId)).doctor.routing).toEqual({
      kind: "RECEPTION_FALLBACK",
    });
    expect(await statusFor(id, fallbackClinic.doctor)).toBe(404);
    expect(await statusFor(id, fallbackClinic.admin)).toBe(200);
    expect(await inboxIds(fallbackClinic.admin)).toContain(id);
    actAs(fallbackClinic.receptionist);
    const reply = await staffSend(id, "Reception here, the doctor is away.");
    expect(reply.status).toBe(201);
    expect(
      (await patientPage(token.publicTokenId)).messages.at(-1)!.senderName,
    ).toBe("Reception");
  });

  it("hands the chat back to doctors once one serves the service", async () => {
    const token = await joinAs(fallbackClinic, "Covered later");
    await patientSend(token.publicTokenId, "Hello?");
    const { id } = await doctorChatOf(token.tokenId);
    expect(await statusFor(id, fallbackClinic.receptionist)).toBe(200);

    const covering = await addDoctor(fallbackClinic, "covering", [
      fallbackClinic.service.id,
    ]);

    expect(await statusFor(id, covering)).toBe(200);
    expect(await statusFor(id, fallbackClinic.receptionist)).toBe(404);
    expect((await summary(token.publicTokenId)).doctor.routing).toMatchObject({
      kind: "SERVICE_DOCTORS",
    });
    await getDb().clinicMembership.update({
      where: { id: covering.membershipId },
      data: { status: "INACTIVE" },
    });
    expect(await statusFor(id, fallbackClinic.receptionist)).toBe(200);
  });
});

describe("after the consultation starts: the assigned doctor only", () => {
  it("moves the chat to the doctor who started the visit and records it", async () => {
    const token = await joinAs(clinic, "Assigned", pediatrics.queueId);
    await patientSend(token.publicTokenId, "Waiting");
    const { id } = await doctorChatOf(token.tokenId);
    expect(await statusFor(id, pediatrician)).toBe(200);

    await startVisit(clinic, token.tokenId, clinic.doctor);

    expect(await statusFor(id, clinic.doctor)).toBe(200);
    expect(await statusFor(id, pediatrician)).toBe(404);
    expect(await inboxIds(pediatrician)).not.toContain(id);
    expect((await summary(token.publicTokenId)).doctor.routing).toEqual({
      kind: "ASSIGNED_DOCTOR",
      doctorName: `doctor ${clinic.run}`,
    });
    const audits = await doctorChatAudits(token.tokenId);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorUserId: clinic.doctor.id,
      metadata: { conversationId: id },
    });

    // After the visit ends the doctor keeps read-only access.
    await applyTokenAction(
      token.tokenId,
      "complete",
      accessOf(clinic, clinic.doctor, "DOCTOR"),
    );
    await getDb().queueToken.update({
      where: { id: token.tokenId },
      data: { completedAt: new Date(Date.now() - 3 * HOUR) },
    });
    expect(await statusFor(id, clinic.doctor)).toBe(200);
    await expectError(
      await staffSend(id, "Follow-up"),
      409,
      "CONVERSATION_CLOSED",
    );
  });

  it("records nothing when the visit has no doctor chat", async () => {
    const token = await joinAs(clinic, "No chat", pediatrics.queueId);
    await patientSend(token.publicTokenId, "Reception only", "reception");

    await startVisit(clinic, token.tokenId, pediatrician);

    expect(await doctorChatAudits(token.tokenId)).toEqual([]);
    await applyTokenAction(
      token.tokenId,
      "complete",
      accessOf(clinic, pediatrician, "DOCTOR"),
    );
  });

  it("moves access again when another doctor starts the visit later", async () => {
    const token = await joinAs(clinic, "Moved", pediatrics.queueId);
    await patientSend(token.publicTokenId, "Hi");
    const { id } = await doctorChatOf(token.tokenId);
    await startVisit(clinic, token.tokenId, clinic.secondDoctor);
    expect(await statusFor(id, clinic.secondDoctor)).toBe(200);

    // As if requeued and called again; the queue rules only reach this
    // state through a requeue.
    await getDb().queueToken.update({
      where: { id: token.tokenId },
      data: { status: "CALLED" },
    });
    await startVisit(clinic, token.tokenId, pediatrician);

    expect(await statusFor(id, pediatrician)).toBe(200);
    expect(await statusFor(id, clinic.secondDoctor)).toBe(404);
    expect(await doctorChatAudits(token.tokenId)).toHaveLength(2);
    actAs(clinic.secondDoctor);
    await expectError(
      await staffSend(id, "Still mine?"),
      404,
      "CONVERSATION_NOT_FOUND",
    );
    await applyTokenAction(
      token.tokenId,
      "complete",
      accessOf(clinic, pediatrician, "DOCTOR"),
    );
  });
});

describe("a doctor starting the visit while the patient sends", () => {
  it("keeps both when the chat already exists", async () => {
    const token = await joinAs(clinic, "Race existing", pediatrics.queueId);
    await patientSend(token.publicTokenId, "First");
    const { id } = await doctorChatOf(token.tokenId);
    await getDb().queueToken.update({
      where: { id: token.tokenId },
      data: { status: "CALLED", calledAt: new Date() },
    });

    const [sent] = await Promise.all([
      patientSend(token.publicTokenId, "Sent during the start"),
      applyTokenAction(
        token.tokenId,
        "start",
        accessOf(clinic, pediatrician, "DOCTOR"),
      ),
    ]);

    expect(sent.status).toBe(201);
    expect(await doctorChatAudits(token.tokenId)).toHaveLength(1);
    expect(await statusFor(id, clinic.doctor)).toBe(404);
    actAs(pediatrician);
    const page = (await (
      await getConversationMessages(get(), params({ conversationId: id }))
    ).json()) as MessagePage;
    expect(page.messages.map((m) => m.body)).toEqual([
      "First",
      "Sent during the start",
    ]);
    await applyTokenAction(
      token.tokenId,
      "complete",
      accessOf(clinic, pediatrician, "DOCTOR"),
    );
  });

  it("keeps both when the patient's message creates the chat", async () => {
    const token = await joinAs(clinic, "Race new", pediatrics.queueId);
    await getDb().queueToken.update({
      where: { id: token.tokenId },
      data: { status: "CALLED", calledAt: new Date() },
    });

    const [sent] = await Promise.all([
      patientSend(token.publicTokenId, "First words"),
      applyTokenAction(
        token.tokenId,
        "start",
        accessOf(clinic, pediatrician, "DOCTOR"),
      ),
    ]);

    expect(sent.status).toBe(201);
    const { id } = await doctorChatOf(token.tokenId);
    // Recorded only if the chat existed when the visit started.
    expect((await doctorChatAudits(token.tokenId)).length).toBeLessThanOrEqual(
      1,
    );
    expect(await statusFor(id, pediatrician)).toBe(200);
    expect(await statusFor(id, clinic.doctor)).toBe(404);
    expect(await getDb().message.count({ where: { conversationId: id } })).toBe(
      1,
    );
    await applyTokenAction(
      token.tokenId,
      "complete",
      accessOf(clinic, pediatrician, "DOCTOR"),
    );
  });
});
