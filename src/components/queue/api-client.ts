import { IDEMPOTENCY_KEY_HEADER } from "@/features/queue/contracts";
import type { ErrorBody } from "@/lib/errors/api-handler";

// Browser-side calls to the queue API. Errors arrive in the stable shape
// from docs/PLAN.md §11 and are rethrown as ApiError.

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    idempotencyKey?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.idempotencyKey)
    headers[IDEMPOTENCY_KEY_HEADER] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Can't reach the server. Check the connection and try again.",
    );
  }

  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  throw new ApiError(
    response.status,
    body?.error.code ?? "INTERNAL_ERROR",
    body?.error.message ?? "Something went wrong. Please try again.",
  );
}

// crypto.randomUUID() only exists in secure contexts (HTTPS or localhost),
// so build a v4 UUID from getRandomValues, which works everywhere.
export function newIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
