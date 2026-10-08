/** The oRPC code a tenant delete returns while dependents block it (sige/02 §4.2, HTTP 409). */
const HAS_DEPENDENTS_CODE = "HAS_DEPENDENTS";

const FALLBACK_MESSAGE = "Intente de nuevo en unos minutos.";

export function isHasDependentsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === HAS_DEPENDENTS_CODE
  );
}

function errorMessage(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return undefined;
}

export type DeleteFailure = {
  title: string;
  description: string;
  /** `true` when dependents block the delete: expected, so the dialog closes instead of retrying. */
  blockedByDependents: boolean;
};

/**
 * The toast for a failed delete. `HAS_DEPENDENTS` carries the server's §4.2 message verbatim under
 * "No se puede eliminar {nombre}"; anything else is a generic failure that keeps the dialog open.
 */
export function describeDeleteFailure(entityName: string, error: unknown): DeleteFailure {
  const description = errorMessage(error) ?? FALLBACK_MESSAGE;
  if (isHasDependentsError(error)) {
    return {
      title: `No se puede eliminar ${entityName}`,
      description,
      blockedByDependents: true,
    };
  }
  return {
    title: `No se pudo eliminar ${entityName}`,
    description,
    blockedByDependents: false,
  };
}
