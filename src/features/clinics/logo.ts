import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors/app-error";
import { LOGO_MAX_BYTES, type LogoUpload } from "./profile-fields";

type Tx = Prisma.TransactionClient;

// First bytes of each allowed format. The declared type must match the file,
// so a renamed SVG or HTML file is never stored or served as an image.
const SIGNATURES: Record<
  LogoUpload["contentType"],
  (bytes: Buffer) => boolean
> = {
  "image/png": (b) =>
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) =>
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP",
};

const INVALID = "Use a PNG, JPG or WebP image of 512 KB or smaller.";

export function decodeLogo(upload: LogoUpload): {
  contentType: LogoUpload["contentType"];
  data: Buffer;
} {
  const base64 = upload.base64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new AppError("VALIDATION_ERROR", INVALID);
  }
  const data = Buffer.from(base64, "base64");
  if (
    data.length === 0 ||
    data.length > LOGO_MAX_BYTES ||
    !SIGNATURES[upload.contentType](data)
  ) {
    throw new AppError("VALIDATION_ERROR", INVALID);
  }
  return { contentType: upload.contentType, data };
}

// Sets or (with null) removes a clinic's logo inside the caller's transaction.
export async function setClinicLogo(
  tx: Tx,
  clinicId: string,
  upload: LogoUpload | null,
): Promise<void> {
  if (upload === null) {
    await tx.clinicLogo.deleteMany({ where: { clinicId } });
    return;
  }
  const { contentType, data } = decodeLogo(upload);
  // Prisma's Bytes field takes a Uint8Array backed by a plain ArrayBuffer.
  const bytes = new Uint8Array(data);
  await tx.clinicLogo.upsert({
    where: { clinicId },
    create: { clinicId, contentType, data: bytes },
    update: { contentType, data: bytes },
  });
}

// Public: logos aren't sensitive, so any clinic's logo can be read by slug.
export async function readClinicLogo(clinicSlug: string) {
  return getDb().clinicLogo.findFirst({
    where: { clinic: { slug: clinicSlug } },
    select: { contentType: true, data: true, updatedAt: true },
  });
}

// Where pages load a clinic's logo from, with a version so a new upload shows
// at once despite caching.
export function clinicLogoUrl(clinicSlug: string, updatedAt: Date): string {
  return `/api/public/clinics/${encodeURIComponent(clinicSlug)}/logo?v=${updatedAt.getTime()}`;
}
