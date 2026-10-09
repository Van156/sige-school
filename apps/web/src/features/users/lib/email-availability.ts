import { userCheckEmailInput } from "@base-template/api/sige/schemas/user";

/** Wait after the last keystroke before asking `user.checkEmail` (30 calls/min per user, USR-R5). */
export const EMAIL_CHECK_DEBOUNCE_MS = 500;

/**
 * The address to check, normalised like the server does, or `null` when there is nothing worth a
 * request: blank or not a valid address (the form's own validation reports that).
 */
export function emailCheckCandidate(email: string): string | null {
  const parsed = userCheckEmailInput.safeParse({ email });
  return parsed.success ? parsed.data.email : null;
}

/** What the email field's availability line shows. */
export type EmailAvailability =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken" }
  | { status: "unknown"; message: string };

const CHECK_FAILED_MESSAGE = "No se pudo verificar el correo.";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return CHECK_FAILED_MESSAGE;
}

/**
 * Availability line from the debounced query state. `candidate` is the checked address (`null`
 * when nothing is checked) and `pending` means the typed value has not reached the query yet.
 */
export function emailAvailability(state: {
  candidate: string | null;
  pending: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  data: { available: boolean } | undefined;
}): EmailAvailability {
  if (state.candidate === null) {
    return { status: "idle" };
  }
  if (state.pending || state.isFetching) {
    return { status: "checking" };
  }
  if (state.isError) {
    return { status: "unknown", message: errorMessage(state.error) };
  }
  if (state.data === undefined) {
    return { status: "idle" };
  }
  return { status: state.data.available ? "available" : "taken" };
}

/** Copy of the availability line, or `null` when there is nothing to say. */
export function emailAvailabilityText(availability: EmailAvailability): string | null {
  switch (availability.status) {
    case "idle":
      return null;
    case "checking":
      return "Verificando disponibilidad...";
    case "available":
      return "Correo disponible.";
    case "taken":
      return "Ya existe un usuario con este correo.";
    case "unknown":
      return availability.message;
  }
}
