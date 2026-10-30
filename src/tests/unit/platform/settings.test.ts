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
      parsePlatformSettings([{ key: "signupsEnabled", value: false }]),
    ).toEqual({ signupsEnabled: false });
  });

  it("falls back to the default for an invalid value", () => {
    expect(
      parsePlatformSettings([{ key: "signupsEnabled", value: "no" }]),
    ).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  // Rows for removed settings (the trial length) stay in the table, unread.
  it("ignores keys it doesn't know", () => {
    expect(
      parsePlatformSettings([
        { key: "theme", value: "dark" },
        { key: "defaultTrialDays", value: 14 },
      ]),
    ).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  it("lists every known key", () => {
    expect([...PLATFORM_SETTING_KEYS]).toEqual(["signupsEnabled"]);
  });
});

describe("platformSettingsUpdateSchema", () => {
  it("accepts any subset of the settings", () => {
    expect(platformSettingsUpdateSchema.parse({})).toEqual({});
    expect(
      platformSettingsUpdateSchema.parse({ signupsEnabled: false }),
    ).toEqual({ signupsEnabled: false });
  });

  it("rejects unknown keys and bad values", () => {
    expect(
      platformSettingsUpdateSchema.safeParse({ theme: "dark" }).success,
    ).toBe(false);
    expect(
      platformSettingsUpdateSchema.safeParse({ defaultTrialDays: 30 }).success,
    ).toBe(false);
    expect(
      platformSettingsUpdateSchema.safeParse({ signupsEnabled: "yes" }).success,
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
