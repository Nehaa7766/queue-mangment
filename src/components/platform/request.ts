import type { ErrorBody } from "@/lib/errors/api-handler";

// Browser-side JSON calls for the platform and onboarding screens. Errors
// arrive in the stable shape from docs/PLAN.md §11 and are rethrown.

export class RequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
  }
}

export async function requestJson<T>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(options.body !== undefined && {
          "content-type": "application/json",
        }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    throw new RequestError(
      0,
      "NETWORK_ERROR",
      "Can't reach the server. Check the connection and try again.",
    );
  }
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  throw new RequestError(
    response.status,
    body?.error.code ?? "INTERNAL_ERROR",
    body?.error.message ?? "Something went wrong. Please try again.",
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof RequestError
    ? error.message
    : "Something went wrong. Please try again.";
}
