// Structured server logs. Never pass passwords, session tokens or patient details.
export function logError(
  message: string,
  fields: { requestId: string; error?: unknown },
): void {
  const { requestId, error } = fields;
  console.error(
    JSON.stringify({
      level: "error",
      message,
      requestId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error === undefined
            ? undefined
            : String(error),
    }),
  );
}
