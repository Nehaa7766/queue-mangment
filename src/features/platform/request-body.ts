import { AppError } from "@/lib/errors/app-error";

// Clinic add and edit bodies carry the logo as base64: 512 KB of image is
// about 700 KB of text, so 1 MB leaves room for the other fields.
export const CLINIC_BODY_MAX_BYTES = 1024 * 1024;

function tooLarge(): AppError {
  return new AppError(
    "VALIDATION_ERROR",
    "The request is too large. Use a logo of 512 KB or smaller.",
  );
}

// Reads a JSON body, refusing it as soon as it passes `maxBytes`, so a huge
// upload is never held in memory whole. An empty body reads as {}.
export async function readJsonBodyWithin(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION_ERROR", "The request body must be JSON.");
  }
}
