import {
  API,
  IDEMPOTENCY_KEY_HEADER,
  type JoinQueueBody,
  type PublicTokenResponse,
} from "@/features/queue/contracts";
import type { ErrorCode } from "@/lib/errors/app-error";
import type { ErrorBody } from "@/lib/errors/api-handler";

export type ApiFailureCode = ErrorCode | "NETWORK_ERROR";

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; code: ApiFailureCode; status: number };

async function request<T>(
  url: string,
  init: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { accept: "application/json", ...init.headers },
    });
  } catch {
    // Offline or the server didn't answer; the outcome is unknown.
    return { ok: false, code: "NETWORK_ERROR", status: 0 };
  }

  if (response.ok) {
    return { ok: true, data: (await response.json()) as T };
  }
  const body = (await response
    .json()
    .catch(() => null)) as Partial<ErrorBody> | null;
  return {
    ok: false,
    code: body?.error?.code ?? "INTERNAL_ERROR",
    status: response.status,
  };
}

export function joinQueue(
  queueId: string,
  body: JoinQueueBody,
  idempotencyKey: string,
): Promise<ApiResult<PublicTokenResponse>> {
  return request(API.queueTokens(queueId), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

export function fetchPublicToken(
  publicTokenId: string,
): Promise<ApiResult<PublicTokenResponse>> {
  return request(API.publicToken(publicTokenId), { method: "GET" });
}

export function cancelPublicToken(
  publicTokenId: string,
): Promise<ApiResult<PublicTokenResponse>> {
  return request(API.publicTokenCancel(publicTokenId), { method: "POST" });
}
