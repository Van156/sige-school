import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useState, type ReactNode } from "react";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  PROFILE_FIELD_BY_MESSAGE,
  PROFILE_FIELDS,
  PROFILE_SAVE_FALLBACK,
  profileFormSchema,
  toProfileInput,
  type ProfileFormValues,
  type ProfileInput,
} from "../lib/profile-form";
import { mapSubmitError } from "../lib/server-form-error";

/**
 * INS-06 "Datos de la Institución" card (sige/02 §5.2). Presentational: `onSubmit` performs the
 * save and rejects with the server error, mapped onto the fields (e.g. a taken NIT) or an inline
 * message. `readOnly` (`institution:read` without `update`) disables the fields and drops the
 * button. `logoField` is the logo control, rendered between the fields and the button.
 */
export default function InstitutionProfileForm({
  initialValues,
  readOnly = false,
  logoField,
  onSubmit,
  onInvalid,
}: {
  initialValues: ProfileFormValues;
  readOnly?: boolean;
  logoField?: ReactNode;
  onSubmit: (input: ProfileInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: profileFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toProfileInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: PROFILE_FIELDS,
          fieldByMessage: PROFILE_FIELD_BY_MESSAGE,
          fallback: PROFILE_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos de la Institución</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Configuración de Institución"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <fieldset disabled={readOnly} className="contents">
            <FieldGroup className="gap-4">
              <form.Field name="name">
                {(field) => (
                  <FormField field={field} label="Nombre de la Institución *">
                    {(control) => (
                      <Input
                        {...control}
                        autoComplete="organization"
                        placeholder="Ej: Institución Educativa Simón Bolívar"
                      />
                    )}
                  </FormField>
                )}
              </form.Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="nit">
                  {(field) => (
                    <FormField
                      field={field}
                      label="NIT"
                      description="Número de Identificación Tributaria"
                    >
                      {(control) => <Input {...control} placeholder="900.123.456-7" />}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="phone">
                  {(field) => (
                    <FormField field={field} label="Teléfono">
                      {(control) => <Input {...control} type="tel" placeholder="(601) 234 5678" />}
                    </FormField>
                  )}
                </form.Field>
              </div>
              <form.Field name="email">
                {(field) => (
                  <FormField field={field} label="Correo Electrónico">
                    {(control) => (
                      <Input
                        {...control}
                        type="email"
                        autoComplete="email"
                        placeholder="contacto@inst.edu.co"
                      />
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="address">
                {(field) => (
                  <FormField field={field} label="Dirección">
                    {(control) => (
                      <Input {...control} placeholder="Calle 123 # 45-67, Barrio Centro" />
                    )}
                  </FormField>
                )}
              </form.Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <form.Field name="municipality">
                  {(field) => (
                    <FormField field={field} label="Municipio">
                      {(control) => <Input {...control} placeholder="Ej: Bogotá" />}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="department">
                  {(field) => (
                    <FormField field={field} label="Departamento">
                      {(control) => <Input {...control} placeholder="Ej: Cundinamarca" />}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="academicYear">
                  {(field) => (
                    <FormField field={field} label="Año Lectivo *">
                      {(control) => <Input {...control} inputMode="numeric" maxLength={4} />}
                    </FormField>
                  )}
                </form.Field>
              </div>
              <form.Field name="resolution">
                {(field) => (
                  <FormField field={field} label="Resolución de Aprobación">
                    {(control) => (
                      <Input {...control} placeholder="Resolución No. 1234 del 01/01/2025" />
                    )}
                  </FormField>
                )}
              </form.Field>
            </FieldGroup>
          </fieldset>

          {logoField}

          {formError ? <AuthFormError message={formError} /> : null}
          {readOnly ? null : (
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <div>
                  <SubmitButton isPending={isSubmitting} pendingLabel="Guardando...">
                    Guardar Configuración
                  </SubmitButton>
                </div>
              )}
            </form.Subscribe>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
