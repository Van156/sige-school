import z from "zod";

import { betterAuthErrorBody, betterAuthErrorCode } from "./auth-errors";

/** Platform minimum (auth spec R3.3); the server stays the authority (`PASSWORD_TOO_SHORT`). */
export const MIN_PASSWORD_LENGTH = 8;

export const CURRENT_PASSWORD_WRONG_MESSAGE = "La contraseña actual es incorrecta.";
export const PASSWORD_TOO_SHORT_MESSAGE = `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
export const PASSWORD_MISMATCH_MESSAGE = "Las contraseñas nuevas no coinciden.";
export const PASSWORD_UNCHANGED_MESSAGE = "La nueva contraseña debe ser diferente a la actual.";
export const FORCED_CHANGE_FALLBACK_MESSAGE =
  "No se pudo actualizar la contraseña. Intente nuevamente.";
export const GATE_NOT_CLEARED_MESSAGE =
  "Su contraseña se cambió, pero no pudimos completar la activación de su cuenta. Vuelva a cambiarla para continuar.";
export const FORCED_CHANGE_SUCCESS_MESSAGE =
  "✅ Contraseña actualizada exitosamente. Ahora puede acceder al sistema.";

/** AUTH-03 form rules (sige/01 §4.2); the confirmation is form-only and never sent. */
export const forcedPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Este campo es obligatorio"),
    newPassword: z.string().min(1, "Este campo es obligatorio"),
    confirmPassword: z.string().min(1, "Este campo es obligatorio"),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword.length > 0 && value.newPassword.length < MIN_PASSWORD_LENGTH) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: PASSWORD_TOO_SHORT_MESSAGE });
    }
    if (value.confirmPassword.length > 0 && value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: PASSWORD_MISMATCH_MESSAGE,
      });
    }
    if (value.newPassword.length > 0 && value.newPassword === value.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: PASSWORD_UNCHANGED_MESSAGE });
    }
  });

/** Maps a failed `authClient.changePassword` to the AUTH-03 copy; unknown failures use the fallback. */
export function forcedPasswordErrorMessage(error: unknown): string {
  switch (betterAuthErrorCode(error)) {
    case "INVALID_PASSWORD":
      return CURRENT_PASSWORD_WRONG_MESSAGE;
    case "PASSWORD_TOO_SHORT":
      return PASSWORD_TOO_SHORT_MESSAGE;
    case "PASSWORD_UNCHANGED":
      return betterAuthErrorBody(error)?.message || PASSWORD_UNCHANGED_MESSAGE;
    case "PASSWORD_CHANGED_GATE_NOT_CLEARED":
      return GATE_NOT_CLEARED_MESSAGE;
    default:
      return FORCED_CHANGE_FALLBACK_MESSAGE;
  }
}
