import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { recordPlatformAudit } from "./audit";
import {
  PLATFORM_SETTING_KEYS,
  parsePlatformSettings,
  type PlatformSettings,
  type PlatformSettingsUpdate,
} from "./settings";

// No authorization: signup reads these on behalf of anonymous visitors.
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await getDb().platformSetting.findMany({
    where: { key: { in: PLATFORM_SETTING_KEYS } },
    select: { key: true, value: true },
  });
  return parsePlatformSettings(rows);
}

export async function updatePlatformSettings(
  update: PlatformSettingsUpdate,
): Promise<PlatformSettings> {
  const admin = await requirePlatformAdmin();
  const before = await getPlatformSettings();
  const changed = Object.fromEntries(
    Object.entries(update).filter(
      ([key, value]) => before[key as keyof PlatformSettings] !== value,
    ),
  );

  await getDb().$transaction(async (tx) => {
    for (const [key, value] of Object.entries(update)) {
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    await recordPlatformAudit(tx, {
      actorUserId: admin.userId,
      action: "platform_settings.updated",
      targetType: "platform_setting",
      metadata: { changed, before: pick(before, Object.keys(changed)) },
    });
  });
  return getPlatformSettings();
}

function pick(settings: PlatformSettings, keys: string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, settings[key as keyof PlatformSettings]]),
  );
}
