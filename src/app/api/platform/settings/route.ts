import { platformSettingsUpdateSchema } from "@/features/platform/settings";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/features/platform/settings-store";
import { readJsonBody } from "@/features/queue/http";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { withApiHandler } from "@/lib/errors/api-handler";

export const GET = withApiHandler(async () => {
  await requirePlatformAdmin();
  return Response.json({ settings: await getPlatformSettings() });
});

// PATCH with any subset of the settings; unknown keys are rejected.
export const PATCH = withApiHandler(async (request) => {
  const update = platformSettingsUpdateSchema.parse(
    await readJsonBody(request),
  );
  return Response.json({ settings: await updatePlatformSettings(update) });
});
