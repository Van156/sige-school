import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";
import SwitchField from "@/shared/components/form/switch-field";

import {
  CAMPUS_FIELD_BY_MESSAGE,
  CAMPUS_SAVE_FALLBACK,
  campusFormSchema,
  emptyCampusForm,
  JORNADA_OPTIONS,
  toCampusInput,
  type CampusFormValues,
  type CampusInput,
} from "../lib/campus-form";
import { mapSubmitError } from "../lib/server-form-error";

/**
 * INS-08 campus form (sige/02 §5.2). Presentational: `onSubmit` performs the create or update and
 * rejects with the server error, which this form maps onto its fields (e.g. the one-main-campus
 * rule under "Sede Principal") or an inline message. `onInvalid` fires when client validation
 * blocks the submit, so the caller can toast.
 */
export default function CampusForm({
  initialValues = emptyCampusForm,
  mode,
  onSubmit,
  onInvalid,
}: {
  initialValues?: CampusFormValues;
  mode: "create" | "edit";
  onSubmit: (input: CampusInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: campusFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toCampusInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fieldByMessage: CAMPUS_FIELD_BY_MESSAGE,
          fallback: CAMPUS_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos de la Sede</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nueva Sede" : "Editar Sede"}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-4">
            <form.Field name="name">
              {(field) => (
                <FormField
                  field={field}
                  label="Nombre de la Sede *"
                  description="💡 Nombre descriptivo de la ubicación física"
                >
                  {(control) => (
                    <Input {...control} placeholder="Ej: Sede Principal, Sede Norte, etc." />
                  )}
                </FormField>
              )}
            </form.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="code">
                {(field) => (
                  <FormField
                    field={field}
                    label="Código"
                    description="💡 Código único identificador (opcional)"
                  >
                    {(control) => <Input {...control} placeholder="Ej: SEDE001" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="jornada">
                {(field) => (
                  <FormField
                    field={field}
                    label="Jornada"
                    description="Horario de funcionamiento de la sede"
                  >
                    {(control) => (
                      <NativeSelect {...control} className="w-full">
                        {JORNADA_OPTIONS.map((option) => (
                          <NativeSelectOption key={option.value} value={option.value}>
                            {option.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="address">
              {(field) => (
                <FormField
                  field={field}
                  label="Dirección"
                  description="Ubicación física completa de la sede"
                >
                  {(control) => <Input {...control} placeholder="Calle 123 # 45-67, Barrio" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="active">
              {(field) => (
                <SwitchField
                  field={field}
                  label="Sede Activa"
                  description="Las sedes inactivas no estarán disponibles para selección"
                />
              )}
            </form.Field>
            <form.Field name="isMain">
              {(field) => (
                <SwitchField
                  field={field}
                  label="🌟 Sede Principal"
                  description="Solo puede haber una sede principal por institución"
                />
              )}
            </form.Field>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "Crear Sede" : "Actualizar Sede"}
                </SubmitButton>
                <Link to="/sedes" className={buttonVariants({ variant: "outline" })}>
                  Cancelar
                </Link>
              </div>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
