import { describe, expect, it } from "vitest";
import { decodeLogo } from "@/features/clinics/logo";
import {
  clinicDetailsSchema,
  hoursFromSimple,
  LOGO_MAX_BYTES,
  simpleFromHours,
  simpleHoursSchema,
} from "@/features/clinics/profile-fields";
import { AppError } from "@/lib/errors/app-error";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from("WEBPVP8 "),
]);

describe("clinicDetailsSchema", () => {
  it("accepts a full profile and normalises it", () => {
    expect(
      clinicDetailsSchema.parse({
        clinicType: "DENTAL",
        email: " Front.Desk@Clinic.IN ",
        city: " Pune ",
        state: "Maharashtra",
        pinCode: "411001",
      }),
    ).toEqual({
      clinicType: "DENTAL",
      email: "front.desk@clinic.in",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
    });
  });

  it("turns empty optional fields into null", () => {
    expect(
      clinicDetailsSchema.parse({
        clinicType: "GENERAL",
        email: "",
        city: "  ",
        state: "",
        pinCode: "",
      }),
    ).toEqual({
      clinicType: "GENERAL",
      email: null,
      city: null,
      state: null,
      pinCode: null,
    });
  });

  it.each([
    ["pinCode", "011001"],
    ["pinCode", "41100"],
    ["email", "not-an-email"],
    ["state", "Atlantis"],
    ["clinicType", "SPA"],
  ])("rejects an invalid %s", (field, value) => {
    const result = clinicDetailsSchema.safeParse({
      clinicType: "GENERAL",
      [field]: value,
    });
    expect(result.success).toBe(false);
  });
});

describe("simple working hours", () => {
  const simple = {
    openingTime: "09:00",
    closingTime: "18:30",
    workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"] as const,
  };

  it("builds stored opening hours for the working days only", () => {
    const hours = hoursFromSimple({
      ...simple,
      workingDays: [...simple.workingDays],
    });

    expect(hours.mon).toEqual([["09:00", "18:30"]]);
    expect(hours.sat).toEqual([["09:00", "18:30"]]);
    expect(hours.sun).toBeUndefined();
  });

  it("round-trips through stored hours", () => {
    const back = simpleFromHours(
      hoursFromSimple({ ...simple, workingDays: [...simple.workingDays] }),
    );
    expect(back).toEqual({ ...simple, workingDays: [...simple.workingDays] });
  });

  it("returns null for hours the simple form can't show", () => {
    expect(simpleFromHours(null)).toBeNull();
    expect(simpleFromHours({})).toBeNull();
    expect(
      simpleFromHours({
        mon: [
          ["09:00", "13:00"],
          ["17:00", "20:00"],
        ],
      }),
    ).toBeNull();
    expect(
      simpleFromHours({ mon: [["09:00", "18:00"]], tue: [["10:00", "18:00"]] }),
    ).toBeNull();
  });

  it("requires closing after opening and at least one day", () => {
    expect(
      simpleHoursSchema.safeParse({ ...simple, closingTime: "08:00" }).success,
    ).toBe(false);
    expect(
      simpleHoursSchema.safeParse({ ...simple, workingDays: [] }).success,
    ).toBe(false);
  });
});

describe("decodeLogo", () => {
  function code(fn: () => unknown): string | undefined {
    try {
      fn();
      return undefined;
    } catch (error) {
      return error instanceof AppError ? error.code : "other";
    }
  }

  it.each([
    ["image/png", PNG],
    ["image/jpeg", JPEG],
    ["image/webp", WEBP],
  ] as const)("accepts a real %s", (contentType, bytes) => {
    const logo = decodeLogo({ contentType, base64: bytes.toString("base64") });
    expect(logo.data.equals(bytes)).toBe(true);
  });

  it("accepts a data: URL", () => {
    const base64 = `data:image/png;base64,${PNG.toString("base64")}`;
    expect(decodeLogo({ contentType: "image/png", base64 }).data.length).toBe(
      PNG.length,
    );
  });

  it("rejects a file that isn't what it claims to be", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(
      code(() =>
        decodeLogo({
          contentType: "image/png",
          base64: svg.toString("base64"),
        }),
      ),
    ).toBe("VALIDATION_ERROR");
    expect(
      code(() =>
        decodeLogo({
          contentType: "image/jpeg",
          base64: PNG.toString("base64"),
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });

  it("rejects a logo over 512 KB", () => {
    const big = Buffer.concat([PNG, Buffer.alloc(LOGO_MAX_BYTES)]);
    expect(
      code(() =>
        decodeLogo({
          contentType: "image/png",
          base64: big.toString("base64"),
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });
});
