import { describe, expect, it } from "vitest";
import {
  adminCreateSchema,
  clinicCreateSchema,
  clinicDetailsSchema,
  supportTicketAdminCreateSchema,
  supportTicketEditSchema,
  userInputSchema,
} from "@/features/platform/schemas";
import { userDeleteBlocker } from "@/features/platform/users";

// What the add-clinic sheet sends with only the required fields filled in.
const CLINIC = {
  name: "  Sharma Clinic ",
  slug: "Sharma-Clinic",
  timezone: "Asia/Kolkata",
  status: "ACTIVE",
  clinicType: "GENERAL",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  hours: {
    openingTime: "09:00",
    closingTime: "18:00",
    workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
  },
  serviceName: "General",
  tokenPrefix: "a",
  adminName: "Asha Sharma",
  adminEmail: " Asha@Example.COM ",
};

// A 1×1 PNG.
const PNG_LOGO = {
  contentType: "image/png",
  base64:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
};

function errorFields(result: { success: boolean; error?: unknown }) {
  if (result.success) return [];
  const error = result.error as { issues: { path: PropertyKey[] }[] };
  return error.issues.map((issue) => issue.path.join("."));
}

describe("clinicCreateSchema", () => {
  it("normalises the address, prefix, email and empty optional fields", () => {
    expect(clinicCreateSchema.parse(CLINIC)).toEqual({
      name: "Sharma Clinic",
      slug: "sharma-clinic",
      timezone: "Asia/Kolkata",
      status: "ACTIVE",
      clinicType: "GENERAL",
      email: null,
      phone: null,
      address: null,
      city: null,
      state: null,
      pinCode: null,
      hours: CLINIC.hours,
      serviceName: "General",
      tokenPrefix: "A",
      adminName: "Asha Sharma",
      adminEmail: "asha@example.com",
    });
  });

  it("keeps every profile field and an optional logo", () => {
    const parsed = clinicCreateSchema.parse({
      ...CLINIC,
      status: "INACTIVE",
      clinicType: "DENTAL",
      email: " Front@Sharma.Example ",
      phone: "+91 98765 43210",
      address: "12 MG Road",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      logo: PNG_LOGO,
    });
    expect(parsed).toMatchObject({
      status: "INACTIVE",
      clinicType: "DENTAL",
      email: "front@sharma.example",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      logo: PNG_LOGO,
    });
  });

  // The form validates first and sends its parsed values; the API parses
  // them again with the same schema.
  it("accepts its own output, with empty optional fields as null", () => {
    const parsed = clinicCreateSchema.parse({ ...CLINIC, logo: PNG_LOGO });
    expect(clinicCreateSchema.parse(parsed)).toEqual(parsed);
  });

  it("needs a clinic type, valid hours and a known status", () => {
    expect(
      errorFields(
        clinicCreateSchema.safeParse({
          ...CLINIC,
          clinicType: "",
          status: "CLOSED",
          hours: {
            openingTime: "18:00",
            closingTime: "09:00",
            workingDays: [],
          },
        }),
      ).sort(),
    ).toEqual([
      "clinicType",
      "hours.closingTime",
      "hours.workingDays",
      "status",
    ]);
    expect(
      errorFields(clinicCreateSchema.safeParse({ ...CLINIC, hours: null })),
    ).toEqual(["hours"]);
  });

  it("rejects a bad PIN code, state, logo type or clinic email", () => {
    expect(
      errorFields(
        clinicCreateSchema.safeParse({
          ...CLINIC,
          pinCode: "01234",
          state: "Atlantis",
          email: "not-an-email",
          logo: { contentType: "image/svg+xml", base64: "PHN2Zz4=" },
        }),
      ).sort(),
    ).toEqual(["email", "logo.contentType", "pinCode", "state"]);
  });

  it("rejects a reserved or malformed address", () => {
    expect(
      errorFields(clinicCreateSchema.safeParse({ ...CLINIC, slug: "admin" })),
    ).toEqual(["slug"]);
    expect(
      errorFields(
        clinicCreateSchema.safeParse({ ...CLINIC, slug: "two--hyphens" }),
      ),
    ).toEqual(["slug"]);
  });

  it("rejects a bad token prefix, time zone and admin email", () => {
    expect(
      errorFields(
        clinicCreateSchema.safeParse({
          ...CLINIC,
          tokenPrefix: "AB1",
          timezone: "Mars/Olympus",
          adminEmail: "not-an-email",
        }),
      ).sort(),
    ).toEqual(["adminEmail", "timezone", "tokenPrefix"]);
  });
});

describe("clinicDetailsSchema", () => {
  // The add body without the first service and admin.
  const details = Object.fromEntries(
    Object.entries(CLINIC).filter(
      ([key]) =>
        !["serviceName", "tokenPrefix", "adminName", "adminEmail"].includes(
          key,
        ),
    ),
  );

  it("keeps a phone number with digits, spaces, + and -", () => {
    expect(
      clinicDetailsSchema.parse({ ...details, phone: "+91 98765-43210" }).phone,
    ).toBe("+91 98765-43210");
  });

  it("rejects letters in the phone number", () => {
    expect(
      errorFields(
        clinicDetailsSchema.safeParse({ ...details, phone: "call me" }),
      ),
    ).toEqual(["phone"]);
  });

  // Null hours keep custom hours; a left-out logo keeps it, null removes it.
  it("lets an edit keep custom hours and keep or remove the logo", () => {
    const keep = clinicDetailsSchema.parse({ ...details, hours: null });
    expect(keep.hours).toBeNull();
    expect("logo" in keep).toBe(false);
    expect(
      clinicDetailsSchema.parse({ ...details, logo: null }).logo,
    ).toBeNull();
    expect(clinicDetailsSchema.parse(keep)).toEqual(keep);
  });
});

describe("userInputSchema", () => {
  it("trims the name and lower-cases the email", () => {
    expect(
      userInputSchema.parse({ name: " Ravi ", email: "Ravi@Example.com" }),
    ).toEqual({ name: "Ravi", email: "ravi@example.com" });
  });
});

describe("adminCreateSchema", () => {
  const clinicId = "6f1c2b6e-8a51-4a43-9b8f-2a7f1c9f3d10";

  it("needs a clinic as well as a name and email", () => {
    expect(
      adminCreateSchema.parse({
        name: " Ravi ",
        email: "Ravi@Example.com",
        clinicId,
      }),
    ).toEqual({ name: "Ravi", email: "ravi@example.com", clinicId });
    expect(
      errorFields(
        adminCreateSchema.safeParse({
          name: "Ravi",
          email: "ravi@example.com",
          clinicId: "",
        }),
      ),
    ).toEqual(["clinicId"]);
  });
});

describe("support ticket schemas", () => {
  const ticket = {
    subject: "Queue page is slow",
    body: "Patients say the token page takes a long time to load.",
    status: "OPEN",
  };

  it("allows a ticket with no clinic", () => {
    expect(
      supportTicketAdminCreateSchema.parse({ ...ticket, clinicId: null })
        .clinicId,
    ).toBeNull();
  });

  it("rejects an unknown status or a malformed clinic id", () => {
    expect(
      errorFields(
        supportTicketEditSchema.safeParse({ ...ticket, status: "DONE" }),
      ),
    ).toEqual(["status"]);
    expect(
      errorFields(
        supportTicketAdminCreateSchema.safeParse({
          ...ticket,
          clinicId: "clinic-1",
        }),
      ),
    ).toEqual(["clinicId"]);
  });
});

describe("userDeleteBlocker", () => {
  const free = {
    isSelf: false,
    isSuperAdmin: false,
    memberships: 0,
    historyCount: 0,
  };

  it("allows a user with no clinic access or history", () => {
    expect(userDeleteBlocker(free)).toBeNull();
  });

  it("blocks yourself, the super admin, and anyone with access or history", () => {
    expect(userDeleteBlocker({ ...free, isSelf: true })).toMatch(/your own/);
    expect(userDeleteBlocker({ ...free, isSuperAdmin: true })).toMatch(
      /can't be deactivated or deleted/,
    );
    expect(userDeleteBlocker({ ...free, memberships: 1 })).toMatch(
      /Deactivate instead/,
    );
    expect(userDeleteBlocker({ ...free, historyCount: 2 })).toMatch(
      /Deactivate instead/,
    );
  });
});
