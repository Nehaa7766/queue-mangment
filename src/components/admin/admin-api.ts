import { ApiError } from "@/components/queue/api-client";
import type { ErrorBody } from "@/lib/errors/api-handler";

// Browser-side calls to the clinic admin API. Errors arrive in the stable
// shape from docs/PLAN.md §11 and are rethrown as ApiError.

export { ApiError };

export async function adminRequest<T>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
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

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong. Please try again.";
}
