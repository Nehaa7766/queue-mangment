import { describe, expect, it } from "vitest";
import {
  ACTIVATED_ACTION,
  SIGNED_UP_ACTION,
  SUSPENDED_ACTION,
  clinicLifecycle,
} from "@/features/platform/lifecycle";
import {
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_SETTING_KEYS,
  parsePlatformSettings,
  platformSettingsUpdateSchema,
} from "@/features/platform/settings";

describe("parsePlatformSettings", () => {
  it("uses the defaults when nothing is stored", () => {
    expect(parsePlatformSettings([])).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  it("reads stored values", () => {
    expect(
      parsePlatformSettings([
        { key: "signupsEnabled", value: false },
        { key: "defaultTrialDays", value: 14 },
      ]),
    ).toEqual({ signupsEnabled: false, defaultTrialDays: 14 });
  });

  it("falls back to the default for an invalid value", () => {
    expect(
      parsePlatformSettings([
        { key: "signupsEnabled", value: "no" },
        { key: "defaultTrialDays", value: 1000 },
      ]),
    ).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  it("ignores keys it doesn't know", () => {
    expect(parsePlatformSettings([{ key: "theme", value: "dark" }])).toEqual(
      DEFAULT_PLATFORM_SETTINGS,
    );
  });

  it("lists every known key", () => {
    expect([...PLATFORM_SETTING_KEYS].sort()).toEqual([
      "defaultTrialDays",
      "signupsEnabled",
    ]);
  });
});

describe("platformSettingsUpdateSchema", () => {
  it("accepts any subset of the settings", () => {
    expect(
      platformSettingsUpdateSchema.parse({ defaultTrialDays: 30 }),
    ).toEqual({ defaultTrialDays: 30 });
  });

  it("rejects unknown keys and bad values", () => {
    expect(
      platformSettingsUpdateSchema.safeParse({ theme: "dark" }).success,
    ).toBe(false);
    expect(
      platformSettingsUpdateSchema.safeParse({ defaultTrialDays: 2.5 }).success,
    ).toBe(false);
    expect(
      platformSettingsUpdateSchema.safeParse({ defaultTrialDays: -1 }).success,
    ).toBe(false);
  });
});

describe("clinicLifecycle", () => {
  it("is active whenever the clinic is ACTIVE", () => {
    expect(clinicLifecycle("ACTIVE", SUSPENDED_ACTION)).toBe("ACTIVE");
  });

  it("is pending while the last action is still the sign-up", () => {
    expect(clinicLifecycle("INACTIVE", SIGNED_UP_ACTION)).toBe("PENDING");
  });

  it("is suspended after a suspension or with no history", () => {
    expect(clinicLifecycle("INACTIVE", SUSPENDED_ACTION)).toBe("SUSPENDED");
    expect(clinicLifecycle("INACTIVE", ACTIVATED_ACTION)).toBe("SUSPENDED");
    expect(clinicLifecycle("INACTIVE", null)).toBe("SUSPENDED");
  });
});
