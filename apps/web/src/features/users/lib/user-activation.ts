import type { UserRow } from "../types";

/** Confirmation copy of the activate/deactivate action on a USR-01 row. */
export type ActivationCopy = {
  /** The new state the confirmation asks for. */
  active: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
};

/** The confirmation for flipping `row`'s state (deactivation ends its sessions, D10). */
export function activationCopy(row: Pick<UserRow, "username" | "isActive">): ActivationCopy {
  if (row.isActive) {
    return {
      active: false,
      title: `¿Deshabilitar al usuario ${row.username}?`,
      description: "No podrá iniciar sesión y se cerrarán sus sesiones abiertas.",
      confirmLabel: "Sí, deshabilitar",
      successMessage: "Usuario deshabilitado",
    };
  }
  return {
    active: true,
    title: `¿Habilitar al usuario ${row.username}?`,
    description: "Podrá volver a iniciar sesión.",
    confirmLabel: "Sí, habilitar",
    successMessage: "Usuario habilitado",
  };
}

const FALLBACK_MESSAGE = "Intente de nuevo en unos minutos.";

/** The server message of a failed `user.setActive` (last owner, own account, ...), or a fallback. */
export function activationFailureMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const { message } = error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return FALLBACK_MESSAGE;
}
