import type { Prisma } from "@/generated/prisma/client";
import type { QueueDoctorView } from "@/features/queue/contracts";

type Db = Prisma.TransactionClient;

// Active doctors who serve each of the given services, keyed by service ID.
// A doctor with service assignments serves only those services; a doctor
// without any serves every service in the clinic (schema assumption).
export async function findServingDoctors(
  db: Db,
  clinicId: string,
  serviceIds: readonly string[],
): Promise<Map<string, QueueDoctorView[]>> {
  const result = new Map<string, QueueDoctorView[]>(
    serviceIds.map((serviceId) => [serviceId, []]),
  );
  if (serviceIds.length === 0) return result;

  const doctors = await db.clinicMembership.findMany({
    where: {
      clinicId,
      role: "DOCTOR",
      status: "ACTIVE",
      user: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      availability: true,
      delayMinutes: true,
      availabilityNote: true,
      availabilityUpdatedAt: true,
      user: { select: { name: true } },
      serviceAssignments: { select: { serviceId: true } },
    },
  });

  for (const doctor of doctors) {
    const view: QueueDoctorView = {
      name: doctor.user.name,
      availability: doctor.availability,
      delayMinutes: doctor.delayMinutes,
      note: doctor.availabilityNote,
      updatedAt: doctor.availabilityUpdatedAt?.toISOString() ?? null,
    };
    const assigned = doctor.serviceAssignments.map((a) => a.serviceId);
    for (const serviceId of serviceIds) {
      if (assigned.length === 0 || assigned.includes(serviceId)) {
        result.get(serviceId)!.push(view);
      }
    }
  }
  return result;
}
