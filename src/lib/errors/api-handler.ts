import { z } from "zod";
import { logError } from "@/lib/log";
import { AppError, type ErrorCode } from "./app-error";

export const REQUEST_ID_HEADER = "x-request-id";

// Accept a caller's request ID only if it is short and plain, so it is safe to log.
const VALID_REQUEST_ID = /^[\w-]{1,64}$/;

export type ErrorBody = {
  error: { code: ErrorCode; message: string; requestId: string };
};

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  requestId: string,
): Response {
  const body: ErrorBody = { error: { code, message, requestId } };
  return Response.json(body, {
    status,
    headers: { [REQUEST_ID_HEADER]: requestId },
  });
}

// Maps any thrown value to the stable error shape in docs/PLAN.md §11.
// Unknown errors are logged and never leak details to the client.
export function toErrorResponse(error: unknown, requestId: string): Response {
  if (error instanceof AppError) {
    return errorResponse(error.status, error.code, error.message, requestId);
  }
  if (error instanceof z.ZodError) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Some fields are missing or invalid.",
      requestId,
    );
  }
  logError("Unhandled API error", { requestId, error });
  return errorResponse(
    500,
    "INTERNAL_ERROR",
    "Something went wrong. Please try again.",
    requestId,
  );
}

// Wraps a route handler: assigns a request ID, returns it in the
// x-request-id header, and turns thrown errors into safe responses.
export function withApiHandler<Context>(
  handler: (
    request: Request,
    context: Context,
    requestId: string,
  ) => Promise<Response>,
) {
  return async (request: Request, context: Context): Promise<Response> => {
    const incoming = request.headers.get(REQUEST_ID_HEADER);
    const requestId =
      incoming && VALID_REQUEST_ID.test(incoming)
        ? incoming
        : crypto.randomUUID();
    try {
      const response = await handler(request, context, requestId);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      return response;
    } catch (error) {
      return toErrorResponse(error, requestId);
    }
  };
}
