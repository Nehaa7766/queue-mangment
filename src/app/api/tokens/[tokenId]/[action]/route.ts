import type {
  StaffTokenAction,
  StaffTokenResponse,
} from "@/features/queue/contracts";
import { tokenNotFound } from "@/features/queue/errors";
import { parseUuid } from "@/features/queue/http";
import { findTokenClinicId, getStaffTokenView } from "@/features/queue/queries";
import { applyTokenAction } from "@/features/queue/service";
import { requireClinicPermission } from "@/lib/auth/guards";
import type { Action } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors/app-error";
import { withApiHandler } from "@/lib/errors/api-handler";

// The permission each token action needs. Assumption: staff cancelling a
// waiting token is the same front-desk power as skipping one.
const ACTION_PERMISSIONS: Record<StaffTokenAction, Action> = {
  recall: "queue.recall",
  skip: "queue.skip",
  requeue: "queue.requeue",
  cancel: "queue.skip",
  start: "consultation.start",
  complete: "consultation.complete",
};

function isStaffTokenAction(value: string): value is StaffTokenAction {
  return Object.hasOwn(ACTION_PERMISSIONS, value);
}

// POST /api/tokens/[tokenId]/(recall|skip|requeue|cancel|start|complete)
export const POST = withApiHandler(
  async (_request, context: RouteContext<"/api/tokens/[tokenId]/[action]">) => {
    const params = await context.params;
    if (!isStaffTokenAction(params.action)) {
      throw new AppError("VALIDATION_ERROR", "Unknown token action.");
    }
    const tokenId = parseUuid(params.tokenId, tokenNotFound);
    const clinicId = await findTokenClinicId(tokenId);
    if (!clinicId) {
      throw tokenNotFound();
    }
    const access = await requireClinicPermission(
      clinicId,
      ACTION_PERMISSIONS[params.action],
    );

    await applyTokenAction(tokenId, params.action, access);
    const token = await getStaffTokenView(tokenId);
    return Response.json({ token } satisfies StaffTokenResponse);
  },
);
