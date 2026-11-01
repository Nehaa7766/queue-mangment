import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { tokenNotFound } from "@/features/queue/errors";
import { requireSession } from "@/lib/auth/guards";
import { can, type Action } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import type { Channel, DoctorRouting } from "./contracts";
import { conversationNotFound } from "./errors";
import {
  canStaffAccess,
  doctorRoutingKind,
  type ChatTarget,
  type DoctorRoutingKind,
  type StaffViewer,
} from "./rules";

// Who may see which chat (docs/MESSAGING.md, "Routing"). The rule itself is
// in rules.ts; this file loads what it needs. Access is computed from the
// token's current state on every request, never stored, and never taken
// from ids the client sends: a chat in another clinic, or one the caller may
// not see, is CONVERSATION_NOT_FOUND.

type Db = Prisma.TransactionClient;

const uuidSchema = z.uuid();

// ---- Staff ----

export type StaffMember = StaffViewer & {
  membershipId: string;
  name: string;
  clinicTimezone: string;
};

const memberSelect = {
  id: true,
  role: true,
  clinicId: true,
  user: { select: { name: true } },
  clinic: { select: { timezone: true } },
  serviceAssignments: { select: { serviceId: true } },
} satisfies Prisma.ClinicMembershipSelect;

// The user's active membership in the given clinic, or their first one
// (as getStaffContext does) when no clinic is given. Same active checks as
// the guards: user, membership and clinic.
export async function loadStaffMember(
  userId: string,
  clinicId?: string,
): Promise<StaffMember | null> {
  const membership = await getDb().clinicMembership.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      user: { status: "ACTIVE" },
      clinic: { status: "ACTIVE" },
      ...(clinicId ? { clinicId } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: memberSelect,
  });
  if (!membership) return null;
  return {
    userId,
    clinicId: membership.clinicId,
    role: membership.role,
    membershipId: membership.id,
    name: membership.user.name,
    clinicTimezone: membership.clinic.timezone,
    doctorServiceIds:
      membership.role === "DOCTOR"
        ? membership.serviceAssignments.map((a) => a.serviceId)
        : [],
  };
}

function usesMessaging(member: StaffMember): boolean {
  return (
    can(member.role, "messages.reception") ||
    can(member.role, "messages.doctor")
  );
}

// The signed-in staff member for endpoints that are not about one chat
// (inbox, unread count, live stream, announcements).
export async function requireStaffMember(
  action?: Action,
): Promise<StaffMember> {
  const user = await requireSession();
  const member = await loadStaffMember(user.userId);
  if (
    !member ||
    !usesMessaging(member) ||
    (action && !can(member.role, action))
  ) {
    throw new AppError("FORBIDDEN", "You don't have access to messages.");
  }
  return member;
}

// ---- Tokens ----

export const chatTokenSelect = {
  id: true,
  clinicId: true,
  queueId: true,
  serviceId: true,
  tokenLabel: true,
  patientName: true,
  status: true,
  joinedAt: true,
  completedAt: true,
  cancelledAt: true,
  skippedAt: true,
  assignedDoctorId: true,
  service: { select: { name: true } },
  assignedDoctor: { select: { name: true } },
} satisfies Prisma.QueueTokenSelect;

export type ChatToken = Prisma.QueueTokenGetPayload<{
  select: typeof chatTokenSelect;
}>;

// The patient's own token. The private link is the only credential.
export async function findPatientToken(
  publicTokenId: string,
): Promise<ChatToken> {
  const token = await getDb().queueToken.findUnique({
    where: { publicTokenId },
    select: chatTokenSelect,
  });
  if (!token) throw tokenNotFound();
  return token;
}

// Locks the token row (FOR SHARE) until the transaction ends, then reads it.
// A concurrent start, complete or cancel waits for this transaction, so a
// write here always sees the routing and closing state it commits with.
export async function lockChatToken(
  tx: Db,
  tokenId: string,
): Promise<ChatToken> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM queue_tokens
    WHERE id = ${tokenId}::uuid
    FOR SHARE`;
  if (locked.length === 0) throw tokenNotFound();
  return tx.queueToken.findUniqueOrThrow({
    where: { id: tokenId },
    select: chatTokenSelect,
  });
}

// ---- Doctor coverage ----

// Which services have at least one active doctor (role, membership and user
// active), using the doctor screens' rule: a doctor with service assignments
// serves only those; one without serves every service.
export type ServiceCoverage = {
  everyService: boolean;
  serviceIds: ReadonlySet<string>;
};

const activeDoctorWhere = (clinicId: string) =>
  ({
    clinicId,
    role: "DOCTOR",
    status: "ACTIVE",
    user: { status: "ACTIVE" },
  }) satisfies Prisma.ClinicMembershipWhereInput;

export async function loadServiceCoverage(
  db: Db,
  clinicId: string,
): Promise<ServiceCoverage> {
  const doctors = await db.clinicMembership.findMany({
    where: activeDoctorWhere(clinicId),
    select: { serviceAssignments: { select: { serviceId: true } } },
  });
  const serviceIds = new Set<string>();
  let everyService = false;
  for (const doctor of doctors) {
    if (doctor.serviceAssignments.length === 0) everyService = true;
    for (const assignment of doctor.serviceAssignments) {
      serviceIds.add(assignment.serviceId);
    }
  }
  return { everyService, serviceIds };
}

export function coversService(
  coverage: ServiceCoverage,
  serviceId: string,
): boolean {
  return coverage.everyService || coverage.serviceIds.has(serviceId);
}

export async function serviceHasDoctor(
  db: Db,
  clinicId: string,
  serviceId: string,
): Promise<boolean> {
  const count = await db.clinicMembership.count({
    where: {
      ...activeDoctorWhere(clinicId),
      OR: [
        { serviceAssignments: { none: {} } },
        { serviceAssignments: { some: { serviceId } } },
      ],
    },
  });
  return count > 0;
}

// Null for the reception channel.
export async function resolveRouting(
  db: Db,
  token: Pick<ChatToken, "clinicId" | "serviceId" | "assignedDoctorId">,
  channel: Channel,
): Promise<DoctorRoutingKind | null> {
  if (channel === "RECEPTION") return null;
  if (token.assignedDoctorId) return "ASSIGNED_DOCTOR";
  return doctorRoutingKind(
    null,
    await serviceHasDoctor(db, token.clinicId, token.serviceId),
  );
}

export function toDoctorRouting(
  kind: DoctorRoutingKind | null,
  token: Pick<ChatToken, "assignedDoctor" | "service">,
): DoctorRouting | null {
  switch (kind) {
    case "ASSIGNED_DOCTOR":
      return {
        kind,
        doctorName: token.assignedDoctor?.name ?? "Your doctor",
      };
    case "SERVICE_DOCTORS":
      return { kind, serviceName: token.service.name };
    case "RECEPTION_FALLBACK":
      return { kind };
    default:
      return null;
  }
}

export function chatTarget(
  token: Pick<ChatToken, "clinicId" | "serviceId" | "assignedDoctorId">,
  channel: Channel,
  routing: DoctorRoutingKind | null,
): ChatTarget {
  return {
    clinicId: token.clinicId,
    channel,
    serviceId: token.serviceId,
    assignedDoctorId: token.assignedDoctorId,
    routing,
  };
}

// ---- Staff chats ----

export const conversationSelect = {
  id: true,
  clinicId: true,
  tokenId: true,
  channel: true,
  lastMessageAt: true,
  unreadByStaff: true,
  unreadByPatient: true,
  staffReadAt: true,
  patientReadAt: true,
} satisfies Prisma.ConversationSelect;

export type ConversationRow = Prisma.ConversationGetPayload<{
  select: typeof conversationSelect;
}>;

export type StaffChat = {
  member: StaffMember;
  conversation: ConversationRow;
  token: ChatToken;
  routing: DoctorRoutingKind | null;
};

// A chat the signed-in staff member may see right now, or
// CONVERSATION_NOT_FOUND. The member is the one in the chat's own clinic.
export async function requireStaffChat(
  conversationId: string,
): Promise<StaffChat> {
  const user = await requireSession();
  if (!uuidSchema.safeParse(conversationId).success) {
    throw conversationNotFound();
  }
  const db = getDb();
  const found = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { ...conversationSelect, token: { select: chatTokenSelect } },
  });
  if (!found) throw conversationNotFound();
  const member = await loadStaffMember(user.userId, found.clinicId);
  if (!member) throw conversationNotFound();

  const { token, ...conversation } = found;
  const routing = await resolveRouting(db, token, conversation.channel);
  if (
    !canStaffAccess(member, chatTarget(token, conversation.channel, routing))
  ) {
    throw conversationNotFound();
  }
  return { member, conversation, token, routing };
}

// A token the signed-in staff member may start a chat with: one in a clinic
// where they are active staff. TOKEN_NOT_FOUND otherwise.
export async function requireStaffToken(
  tokenId: string,
): Promise<{ member: StaffMember; token: ChatToken }> {
  const user = await requireSession();
  if (!uuidSchema.safeParse(tokenId).success) throw tokenNotFound();
  const token = await getDb().queueToken.findUnique({
    where: { id: tokenId },
    select: chatTokenSelect,
  });
  if (!token) throw tokenNotFound();
  const member = await loadStaffMember(user.userId, token.clinicId);
  if (!member) throw tokenNotFound();
  return { member, token };
}

// The chats a staff member may see, as a Prisma filter, so the inbox and the
// unread count never load chats only to drop them.
export async function staffConversationWhere(
  db: Db,
  member: StaffMember,
): Promise<Prisma.ConversationWhereInput> {
  const scopes: Prisma.ConversationWhereInput[] = [];
  if (can(member.role, "messages.reception")) {
    scopes.push({ channel: "RECEPTION" });
    const fallback = await fallbackServiceIds(db, member.clinicId);
    if (fallback.length > 0) {
      scopes.push({
        channel: "DOCTOR",
        token: { assignedDoctorId: null, serviceId: { in: fallback } },
      });
    }
  }
  if (can(member.role, "messages.doctor")) {
    scopes.push({
      channel: "DOCTOR",
      token: { assignedDoctorId: member.userId },
    });
    scopes.push({
      channel: "DOCTOR",
      token: {
        assignedDoctorId: null,
        ...(member.doctorServiceIds.length > 0
          ? { serviceId: { in: [...member.doctorServiceIds] } }
          : {}),
      },
    });
  }
  return { clinicId: member.clinicId, OR: scopes };
}

// Services no active doctor serves, whose doctor chats reception answers.
async function fallbackServiceIds(db: Db, clinicId: string): Promise<string[]> {
  const coverage = await loadServiceCoverage(db, clinicId);
  if (coverage.everyService) return [];
  const services = await db.service.findMany({
    where: { clinicId, id: { notIn: [...coverage.serviceIds] } },
    select: { id: true },
  });
  return services.map((service) => service.id);
}
