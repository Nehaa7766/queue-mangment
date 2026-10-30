import { recordAudit } from "@/features/audit/record-audit";
import { getDb } from "@/lib/db";
import { requireDoctorAccess } from "./access";
import type { AvailabilityUpdate } from "./availability";
import type { DoctorSelfView } from "./contracts";
import { doctorSelfSelect, toDoctorSelfView } from "./queries";

// The signed-in doctor sets their availability, announced delay and note.
// One transaction with its audit event.
export async function updateDoctorAvailability(
  update: AvailabilityUpdate,
  clinicId?: string,
): Promise<DoctorSelfView> {
  const access = await requireDoctorAccess("doctor.availability", clinicId);

  return getDb().$transaction(async (tx) => {
    const before = await tx.clinicMembership.findUniqueOrThrow({
      where: { id: access.membershipId },
      select: { availability: true, delayMinutes: true },
    });
    const updated = await tx.clinicMembership.update({
      where: { id: access.membershipId },
      data: {
        availability: update.availability,
        delayMinutes: update.delayMinutes,
        availabilityNote: update.note,
        availabilityUpdatedAt: new Date(),
      },
      select: doctorSelfSelect,
    });
    await recordAudit(tx, {
      clinicId: access.clinicId,
      actorUserId: access.user.userId,
      action: "doctor.availability_changed",
      previousState: before.availability,
      newState: update.availability,
      // The note itself is free text, so only record that there was one.
      metadata: {
        delayMinutes: update.delayMinutes,
        previousDelayMinutes: before.delayMinutes,
        hasNote: update.note !== null,
      },
    });
    return toDoctorSelfView(updated);
  });
}
