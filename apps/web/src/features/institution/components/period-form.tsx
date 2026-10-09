import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";
import SwitchField from "@/shared/components/form/switch-field";

import {
  mapPeriodSubmitError,
  periodFormSchema,
  toPeriodInput,
  type PeriodFormValues,
  type PeriodInput,
} from "../lib/period-form";

/**
 * INS-16 period form (sige/02 §5.2). Presentational: `onSubmit` performs the save (and the
 * `period.activate` call when the switch was turned on) and rejects with the server error, which
 * this form maps onto its fields (an overlap under both dates) or an inline message. `onInvalid`
 * fires when client validation blocks the submit, so the caller can toast.
 */
export default function PeriodForm({
  initialValues,
  mode,
  onSubmit,
  onInvalid,
}: {
  initialValues: PeriodFormValues;
  mode: "create" | "edit";
  onSubmit: (input: PeriodInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: periodFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toPeriodInput(value));
      } catch (error) {
        const failure = mapPeriodSubmitError(error);
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos del Periodo</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nuevo Periodo" : "Editar Periodo"}
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
                  label="Nombre del Periodo *"
                  description="💡 Ej: Primer Periodo, Segundo Periodo"
                >
                  {(control) => <Input {...control} placeholder="Ej: Primer Periodo" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="shortName">
              {(field) => (
                <FormField field={field} label="Nombre Corto *" description="💡 Ej: P1, P2, P3, P4">
                  {(control) => <Input {...control} placeholder="Ej: P1" />}
                </FormField>
              )}
            </form.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="startDate">
                {(field) => (
                  <FormField field={field} label="Fecha de Inicio *">
                    {(control) => <Input {...control} type="date" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="endDate">
                {(field) => (
                  <FormField field={field} label="Fecha de Fin *">
                    {(control) => <Input {...control} type="date" />}
                  </FormField>
                )}
              </form.Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="academicYear">
                {(field) => (
                  <FormField field={field} label="Año Académico *">
                    {(control) => (
                      <Input {...control} inputMode="numeric" maxLength={4} placeholder="2026" />
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="orderNum">
                {(field) => (
                  <FormField
                    field={field}
                    label="Orden"
                    description="💡 Orden del periodo (1, 2, 3, 4)"
                  >
                    {(control) => <Input {...control} type="number" min={1} max={4} step={1} />}
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="isActive">
              {(field) => (
                <SwitchField
                  field={field}
                  label="Periodo Activo"
                  description="Solo un periodo puede estar activo; activarlo desactiva el anterior"
                />
              )}
            </form.Field>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "✅ Crear Periodo" : "💾 Actualizar Periodo"}
                </SubmitButton>
                <Link to="/periodos" className={buttonVariants({ variant: "outline" })}>
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
