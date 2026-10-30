import { subscriptionUpdateSchema } from "@/features/platform/schemas";
import {
  getSubscriptionEditor,
  updateSubscription,
} from "@/features/platform/subscriptions";
import { clinicNotFound } from "@/features/platform/clinics";
import { readJsonBody } from "@/features/queue/http";
import { withApiHandler } from "@/lib/errors/api-handler";

type Context = RouteContext<"/api/platform/clinics/[clinicId]/subscription">;

export const GET = withApiHandler(async (_request, context: Context) => {
  const editor = await getSubscriptionEditor((await context.params).clinicId);
  if (!editor) throw clinicNotFound();
  return Response.json(editor);
});

// PUT { planId, status, trialEndsAt, currentPeriodEnd } — creates the
// subscription when the clinic has none.
export const PUT = withApiHandler(async (request, context: Context) => {
  const { clinicId } = await context.params;
  const update = subscriptionUpdateSchema.parse(await readJsonBody(request));
  await updateSubscription(clinicId, update);
  const editor = await getSubscriptionEditor(clinicId);
  return Response.json({ subscription: editor?.row.subscription ?? null });
});
