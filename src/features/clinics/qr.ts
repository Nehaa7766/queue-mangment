import QRCode from "qrcode";
import { getEnv } from "@/lib/env";

// The clinic's permanent QR code points at its public page. It only changes
// if the clinic's slug does, which the admin panel never allows.

const QR_COLORS = { dark: "#2a2d34", light: "#ffffff" };

export function clinicPublicUrl(slug: string): string {
  return new URL(`/q/${slug}`, getEnv().BETTER_AUTH_URL).toString();
}

export type ClinicQrCode = {
  url: string;
  svg: string;
  pngDataUrl: string;
};

export async function createClinicQrCode(slug: string): Promise<ClinicQrCode> {
  const url = clinicPublicUrl(slug);
  // Medium error correction survives a scuffed or partly covered print.
  const [svg, pngDataUrl] = await Promise.all([
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: QR_COLORS,
    }),
    QRCode.toDataURL(url, {
      type: "image/png",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 1024,
      color: QR_COLORS,
    }),
  ]);
  return { url, svg, pngDataUrl };
}
