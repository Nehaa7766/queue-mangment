import { describe, expect, it } from "vitest";
import {
  clinicSlugSchema,
  isReservedSlug,
  suggestSlug,
} from "@/features/onboarding/slug";

describe("clinicSlugSchema", () => {
  it.each(["sharma-clinic", "abc", "clinic-24x7", "a1-b2-c3"])(
    "accepts %s",
    (slug) => {
      expect(clinicSlugSchema.parse(slug)).toBe(slug);
    },
  );

  it("trims and lowercases before checking", () => {
    expect(clinicSlugSchema.parse("  Sharma-Clinic ")).toBe("sharma-clinic");
  });

  it.each([
    ["ab", /at least 3/],
    ["a".repeat(41), /at most 40/],
    ["-sharma", /single hyphens/],
    ["sharma-", /single hyphens/],
    ["sharma--clinic", /single hyphens/],
    ["sharma_clinic", /single hyphens/],
    ["शर्मा", /single hyphens/],
    ["admin", /reserved/],
    ["super-admin", /reserved/],
  ])("rejects %s", (slug, message) => {
    const result = clinicSlugSchema.safeParse(slug);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(message);
  });

  it("knows the reserved words", () => {
    expect(isReservedSlug("queuecare")).toBe(true);
    expect(isReservedSlug("sharma-clinic")).toBe(false);
  });
});

describe("suggestSlug", () => {
  it.each([
    ["Dr. Sharma's Clinic, Pune", "dr-sharmas-clinic-pune"],
    ["  City   Care  ", "city-care"],
    ["Clínica Saúde", "clinica-saude"],
    ["24x7 Health & Care", "24x7-health-care"],
    ["!!!", ""],
  ])("turns %j into %j", (name, slug) => {
    expect(suggestSlug(name)).toBe(slug);
  });

  it("never ends with a hyphen after cutting to 40 characters", () => {
    const slug = suggestSlug(`${"a".repeat(39)} clinic`);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});
