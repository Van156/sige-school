/** Whether `error` is an oRPC error carrying `code` (the server's typed error code). */
export function hasOrpcErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === code;
}

/** Whether a call failed because the target does not exist (`NOT_FOUND`, also another tenant's). */
export function isNotFoundError(error: unknown): boolean {
  return hasOrpcErrorCode(error, "NOT_FOUND");
}
