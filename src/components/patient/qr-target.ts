// What a scanned QR code may open: only a QueueCare clinic page, /q/<slug>.
// Clinic QR codes hold a full link (https://<site>/q/<slug>); only its path is
// used, so a code can never send a patient to another website.
const CLINIC_PATH = /^\/q\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

export function clinicPathFromQr(text: string): string | null {
  const value = text.trim();
  let path: string;
  try {
    path = new URL(value, "https://queuecare.invalid").pathname;
  } catch {
    return null;
  }
  const match = CLINIC_PATH.exec(path.toLowerCase());
  return match ? `/q/${match[1]}` : null;
}

// A clinic code typed by hand: the slug, or a pasted clinic link.
export function clinicPathFromCode(code: string): string | null {
  const value = code.trim().toLowerCase();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return `/q/${value}`;
  return clinicPathFromQr(value);
}
