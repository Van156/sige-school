import { Alert, AlertDescription } from "@base-template/ui/components/alert";
import { Button } from "@base-template/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@base-template/ui/components/dialog";
import { FieldGroup } from "@base-template/ui/components/field";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import { mapSubmitError } from "@/features/institution";
import FormField from "@/shared/components/form/form-field";
import PasswordInput from "@/shared/components/form/password-input";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  RESET_FALLBACK,
  RESET_FORCES_CHANGE_NOTICE,
  resetPasswordFormSchema,
  type ResetPasswordRequest,
} from "../lib/reset-password";

/**
 * Password reset dialog (sige/03 §5.6, USR-R9). `document` mode asks to reset to the document
 * number (USR-03); `custom` mode asks for a new password of at least 8 characters (INS-04).
 * Presentational: `onSubmit` performs the reset and rejects with the server error, which is shown
 * inline; the dialog closes only when it resolves.
 */
export default function ResetPasswordDialog({
  open,
  onOpenChange,
  mode,
  userLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ResetPasswordRequest["mode"];
  /** Whom the reset is about, e.g. the full name. */
  userLabel: string;
  onSubmit: (request: ResetPasswordRequest) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ResetPasswordForm
          mode={mode}
          userLabel={userLabel}
          onSubmit={onSubmit}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordForm({
  mode,
  userLabel,
  onSubmit,
  onClose,
}: {
  mode: ResetPasswordRequest["mode"];
  userLabel: string;
  onSubmit: (request: ResetPasswordRequest) => Promise<void>;
  onClose: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const isCustom = mode === "custom";

  const form = useForm({
    defaultValues: { newPassword: "" },
    validators: isCustom ? { onSubmit: resetPasswordFormSchema } : undefined,
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(isCustom ? { mode, newPassword: value.newPassword } : { mode });
        onClose();
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: ["newPassword"],
          fallback: RESET_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <form
      noValidate
      aria-label={isCustom ? "Cambiar Contraseña" : "Resetear Contraseña"}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle>{isCustom ? "Cambiar Contraseña" : "Resetear Contraseña"}</DialogTitle>
        <DialogDescription>
          {isCustom
            ? `Restablece la contraseña de ${userLabel}.`
            : `¿Restablecer la contraseña al número de documento? Usuario: ${userLabel}.`}
        </DialogDescription>
      </DialogHeader>
      {isCustom ? (
        <FieldGroup>
          <form.Field name="newPassword">
            {(field) => (
              <FormField
                field={field}
                label="Nueva Contraseña *"
                description="La contraseña debe tener al menos 8 caracteres."
              >
                {(control) => <PasswordInput {...control} autoComplete="new-password" />}
              </FormField>
            )}
          </form.Field>
        </FieldGroup>
      ) : null}
      <Alert>
        <AlertDescription>{RESET_FORCES_CHANGE_NOTICE}</AlertDescription>
      </Alert>
      {formError ? <AuthFormError message={formError} /> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <SubmitButton isPending={isSubmitting}>
              {isCustom ? "Actualizar Contraseña" : "Restablecer"}
            </SubmitButton>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}
