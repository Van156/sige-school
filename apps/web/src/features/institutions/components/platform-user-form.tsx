import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { AuthFormError } from "@/features/auth";
import { mapSubmitError } from "@/features/institution";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  PLATFORM_DOCUMENT_TYPES,
  PLATFORM_USER_CREATE_FALLBACK,
  PLATFORM_USER_FIELD_BY_MESSAGE,
  PLATFORM_USER_FIELDS,
  platformUserFormSchema,
  type PlatformUserFormValues,
} from "../lib/platform-user";
import PlatformRoleSelect from "./platform-role-select";

/** What the live preview needs from the form. */
export type PlatformUserNameParts = {
  firstName: string;
  lastName: string;
  documentNumber: string;
};

/**
 * INS-05 form (sige/02 §5.1): the data of the new user and its role. Presentational: `onSubmit`
 * performs the save and rejects with the server error, which is mapped onto the fields (a taken
 * document or email, a second owner) or shown inline above the button. `renderUsernamePreview`
 * receives the live names and document.
 */
export default function PlatformUserForm({
  institutionId,
  initialValues,
  onSubmit,
  onInvalid,
  renderUsernamePreview,
}: {
  institutionId: string;
  initialValues: PlatformUserFormValues;
  onSubmit: (values: PlatformUserFormValues) => Promise<void>;
  onInvalid?: () => void;
  renderUsernamePreview?: (parts: PlatformUserNameParts) => ReactNode;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: platformUserFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(value);
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: PLATFORM_USER_FIELDS,
          fieldByMessage: PLATFORM_USER_FIELD_BY_MESSAGE,
          fallback: PLATFORM_USER_CREATE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <form
      noValidate
      aria-label="Crear Usuario"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <Alert>
        <AlertTitle>Automático</AlertTitle>
        <AlertDescription>
          El nombre de usuario se genera automáticamente con la inicial del nombre + apellido +
          últimos 4 dígitos del documento.
        </AlertDescription>
      </Alert>
      {renderUsernamePreview ? (
        <form.Subscribe
          selector={(state) => ({
            firstName: state.values.firstName,
            lastName: state.values.lastName,
            documentNumber: state.values.documentNumber,
          })}
        >
          {(parts) => renderUsernamePreview(parts)}
        </form.Subscribe>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Datos del Usuario</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <form.Field name="firstName">
              {(field) => (
                <FormField field={field} label="Nombres *">
                  {(control) => (
                    <Input {...control} autoComplete="off" placeholder="Ej: Juan Carlos" />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="lastName">
              {(field) => (
                <FormField field={field} label="Apellidos *">
                  {(control) => (
                    <Input {...control} autoComplete="off" placeholder="Ej: Pérez García" />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="documentType">
              {(field) => (
                <FormField field={field} label="Tipo Documento">
                  {(control) => (
                    <NativeSelect {...control} className="w-full">
                      {PLATFORM_DOCUMENT_TYPES.map((option) => (
                        <NativeSelectOption key={option.value} value={option.value}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="documentNumber">
              {(field) => (
                <FormField field={field} label="Nº Documento *">
                  {(control) => <Input {...control} autoComplete="off" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="phone">
              {(field) => (
                <FormField field={field} label="Teléfono">
                  {(control) => <Input {...control} type="tel" placeholder="3001234567" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="email">
              {(field) => (
                <FormField
                  field={field}
                  label="Email *"
                  description="Correo válido para notificaciones"
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="email"
                      autoComplete="off"
                      placeholder="usuario@ejemplo.com"
                    />
                  )}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>
          <Alert>
            <AlertTitle>Contraseña automática</AlertTitle>
            <AlertDescription>
              La contraseña inicial será el número de documento ingresado arriba. El usuario deberá
              cambiarla en su primer inicio de sesión.
            </AlertDescription>
          </Alert>
          <form.Field name="role">
            {(field) => (
              <FormField field={field} label="Rol del Usuario *">
                {(control) => (
                  <PlatformRoleSelect
                    id={control.id}
                    value={control.value}
                    onValueChange={(role) => field.handleChange(role)}
                    invalid={control["aria-invalid"]}
                    aria-describedby={control["aria-describedby"]}
                  />
                )}
              </FormField>
            )}
          </form.Field>
          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting} pendingLabel="Creando...">
                  ✅ Crear Usuario
                </SubmitButton>
                <Link
                  to="/admin/instituciones/$institutionId/usuarios"
                  params={{ institutionId }}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Cancelar
                </Link>
              </div>
            )}
          </form.Subscribe>
        </CardContent>
      </Card>
    </form>
  );
}
