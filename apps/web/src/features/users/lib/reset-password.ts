import { passwordSchema } from "@base-template/api/sige/schemas/user";
import { z } from "zod";

/** What the reset dialog asks for (`user.resetPassword` without the person, USR-R9). */
export type ResetPasswordRequest = { mode: "document" } | { mode: "custom"; newPassword: string };

/** Custom mode: the platform policy minimum, with the API's own message (sige/03 §4.1). */
export const resetPasswordFormSchema = z.object({ newPassword: passwordSchema });

export type ResetPasswordFormValues = z.input<typeof resetPasswordFormSchema>;

/** Shown in every reset UI (USR-R9). */
export const RESET_FORCES_CHANGE_NOTICE =
  "El usuario deberá cambiar esta contraseña en su próximo inicio de sesión.";

export const RESET_FALLBACK = "No se pudo restablecer la contraseña. Intente nuevamente.";

/** Toast after a successful reset. */
export function resetSuccessMessage(request: ResetPasswordRequest): string {
  return request.mode === "document"
    ? "Contraseña restablecida al número de documento"
    : "Contraseña actualizada";
}

/** The `user.resetPassword` input for `personId`. */
export function toResetPasswordInput(personId: string, request: ResetPasswordRequest) {
  return request.mode === "document"
    ? ({ personId, mode: "document" } as const)
    : ({ personId, mode: "custom", newPassword: request.newPassword } as const);
}
