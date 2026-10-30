import type { StaffQueueResponse } from "./contracts";
import { queueNotFound } from "./errors";
import { parseUuid } from "./http";
import { findQueueClinicId, getQueueSummary } from "./queries";
import { changeQueueStatus, type QueueChange } from "./service";
import { requireClinicPermission } from "@/lib/auth/guards";

// Shared body of the pause, resume and close route handlers.
export async function handleQueueStatusChange(
  rawQueueId: string,
  change: QueueChange,
): Promise<Response> {
  const queueId = parseUuid(rawQueueId, queueNotFound);
  const clinicId = await findQueueClinicId(queueId);
  if (!clinicId) {
    throw queueNotFound();
  }
  const access = await requireClinicPermission(clinicId, "queue.pauseResume");

  await changeQueueStatus(queueId, change, access);
  const queue = await getQueueSummary(queueId);
  return Response.json({ queue } satisfies StaffQueueResponse);
}
