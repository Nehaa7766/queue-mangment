import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getLogo } from "@/app/api/public/clinics/[clinicSlug]/logo/route";
import { setClinicLogo } from "@/features/clinics/logo";
import { getDb } from "@/lib/db";

// Needs the test database with migrations applied (npm run db:deploy).
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);
const run = crypto.randomUUID().slice(0, 8);
const withLogo = `logo-test-${run}`;
const withoutLogo = `logo-none-${run}`;

function get(slug: string, headers?: HeadersInit) {
  return getLogo(
    new Request(`http://test/api/public/clinics/${slug}/logo`, { headers }),
    { params: Promise.resolve({ clinicSlug: slug }) },
  );
}

beforeAll(async () => {
  const db = getDb();
  const clinic = await db.clinic.create({
    data: { name: "Logo Clinic", slug: withLogo },
  });
  await db.clinic.create({ data: { name: "No Logo", slug: withoutLogo } });
  await db.$transaction((tx) =>
    setClinicLogo(tx, clinic.id, {
      contentType: "image/png",
      base64: PNG.toString("base64"),
    }),
  );
});

afterAll(async () => {
  // Logos are removed with their clinic (cascade).
  await getDb().clinic.deleteMany({
    where: { slug: { in: [withLogo, withoutLogo] } },
  });
});

describe("GET /api/public/clinics/[clinicSlug]/logo", () => {
  it("serves the stored image with caching and a locked-down policy", async () => {
    const response = await get(withLogo);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("public");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("answers 304 when the browser already has this version", async () => {
    const etag = (await get(withLogo)).headers.get("etag")!;

    const response = await get(withLogo, { "if-none-match": etag });

    expect(response.status).toBe(304);
  });

  it("answers 404 for a clinic without a logo or an unknown clinic", async () => {
    expect((await get(withoutLogo)).status).toBe(404);
    expect((await get(`missing-${run}`)).status).toBe(404);
  });

  it("removes the logo when set to null", async () => {
    const clinic = await getDb().clinic.findUniqueOrThrow({
      where: { slug: withLogo },
    });
    await getDb().$transaction((tx) => setClinicLogo(tx, clinic.id, null));

    expect((await get(withLogo)).status).toBe(404);
  });
});
