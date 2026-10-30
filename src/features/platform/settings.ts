import { z } from "zod";

// Platform-wide settings, stored one row per key in platform_settings with a
// JSON value. Only the keys below are read; anything else is ignored.

const settingsSchema = z.object({
  // When false, the public /signup form refuses new clinics.
  signupsEnabled: z.boolean(),
  // Trial length for clinics that sign up themselves.
  defaultTrialDays: z.number().int().min(0).max(365),
});

export type PlatformSettings = z.infer<typeof settingsSchema>;
export type PlatformSettingKey = keyof PlatformSettings;

export const PLATFORM_SETTING_KEYS = Object.keys(
  settingsSchema.shape,
) as PlatformSettingKey[];

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  signupsEnabled: true,
  defaultTrialDays: 90,
};

// For PATCH requests: any subset of the known keys, nothing else.
export const platformSettingsUpdateSchema = settingsSchema.partial().strict();
export type PlatformSettingsUpdate = z.infer<
  typeof platformSettingsUpdateSchema
>;

// A missing or invalid row falls back to its default, so one bad value can't
// take signup down.
export function parsePlatformSettings(
  rows: readonly { key: string; value: unknown }[],
): PlatformSettings {
  const settings: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };
  for (const row of rows) {
    if (row.key === "signupsEnabled") {
      const parsed = settingsSchema.shape.signupsEnabled.safeParse(row.value);
      if (parsed.success) settings.signupsEnabled = parsed.data;
    } else if (row.key === "defaultTrialDays") {
      const parsed = settingsSchema.shape.defaultTrialDays.safeParse(row.value);
      if (parsed.success) settings.defaultTrialDays = parsed.data;
    }
  }
  return settings;
}
