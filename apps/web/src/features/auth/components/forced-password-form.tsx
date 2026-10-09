import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import FormField from "@/shared/components/form/form-field";
import PasswordInput from "@/shared/components/form/password-input";

import {
  FORCED_CHANGE_FALLBACK_MESSAGE,
  MIN_PASSWORD_LENGTH,
  forcedPasswordSchema,
} from "../lib/forced-password";
import AuthFormError from "./auth-form-error";
import PasswordStrengthMeter from "./password-strength-meter";

export type ForcedPasswordValues = { currentPassword: string; newPassword: string };

/**
 * AUTH-03 form (sige/01 §4.2). Presentational: `onSubmit` performs the change and rejects with a
 * user-facing message, shown inline above the submit button.
 */
export default function ForcedPasswordForm({
  fullName,
  username,
  onSubmit,
}: {
  fullName: string;
  username: string;
  onSubmit: (values: ForcedPasswordValues) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: { onSubmit: forcedPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await onSubmit({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        });
      } catch (error) {
        setServerError(error instanceof Error ? error.message : FORCED_CHANGE_FALLBACK_MESSAGE);
      }
    },
  });

  return (
    <form
      noValidate
      aria-label="Cambiar contraseña"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col rounded-lg border bg-card px-3 py-2">
        <span className="text-sm font-medium">{fullName}</span>
        <span className="text-[13px] text-muted-foreground">{username}</span>
      </div>
      <FieldGroup className="gap-6">
        <form.Field name="currentPassword">
          {(field) => (
            <FormField
              field={field}
              label="Contraseña Actual"
              description="Si es su primer acceso, es su número de documento."
            >
              {(control) => (
                <PasswordInput {...control} large autoFocus autoComplete="current-password" />
              )}
            </FormField>
          )}
        </form.Field>
        <form.Field name="newPassword">
          {(field) => (
            <FormField field={field} label="Nueva Contraseña">
              {(control) => (
                <>
                  <PasswordInput
                    {...control}
                    large
                    autoComplete="new-password"
                    placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  />
                  <PasswordStrengthMeter password={field.state.value} />
                </>
              )}
            </FormField>
          )}
        </form.Field>
        <form.Field name="confirmPassword">
          {(field) => (
            <FormField field={field} label="Confirmar Nueva Contraseña">
              {(control) => (
                <>
                  <PasswordInput {...control} large autoComplete="new-password" />
                  <form.Subscribe selector={(state) => state.values.newPassword}>
                    {(newPassword) =>
                      field.state.value.length > 0 ? (
                        <MatchMessage matches={newPassword === field.state.value} />
                      ) : null
                    }
                  </form.Subscribe>
                </>
              )}
            </FormField>
          )}
        </form.Field>
      </FieldGroup>
      {serverError ? <AuthFormError message={serverError} /> : null}
      <form.Subscribe
        selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Actualizando..." : "Actualizar Contraseña"}
          </Button>
        )}
      </form.Subscribe>
      <p className="text-center text-[13px] text-muted-foreground">
        Esta contraseña será su acceso permanente al sistema
      </p>
    </form>
  );
}

function MatchMessage({ matches }: { matches: boolean }) {
  return (
    <span
      aria-live="polite"
      className={matches ? "text-xs text-success" : "text-xs text-destructive"}
    >
      {matches ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}
    </span>
  );
}
