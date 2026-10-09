import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { Textarea } from "@base-template/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  CRITERION_FIELDS,
  CRITERION_SAVE_FALLBACK,
  criterionFormSchema,
  toCriterionInput,
  type CriterionFormValues,
  type CriterionInput,
} from "../lib/criterion-form";
import { mapSubmitError } from "../lib/server-form-error";

/**
 * INS-18 criterion form (sige/02 §5.2). Presentational: `onSubmit` performs the create or update
 * and rejects with the server error, which this form maps onto its fields or an inline message.
 * `onWeightChange` reports the weight text as it is typed (for the side card's live total), and
 * `onInvalid` fires when client validation blocks the submit.
 */
export default function CriterionForm({
  initialValues,
  mode,
  onSubmit,
  onWeightChange,
  onInvalid,
}: {
  initialValues: CriterionFormValues;
  mode: "create" | "edit";
  onSubmit: (input: CriterionInput) => Promise<void>;
  onWeightChange?: (weight: string) => void;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: criterionFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toCriterionInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: CRITERION_FIELDS,
          fallback: CRITERION_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos del Criterio</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nuevo Criterio" : "Editar Criterio"}
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
                  label="Nombre del Criterio *"
                  description="💡 Nombre descriptivo (ej: Seguimiento, Formativo, Cognitivo)"
                >
                  {(control) => <Input {...control} placeholder="Ej: Seguimiento" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="weight">
              {(field) => (
                <FormField
                  field={field}
                  label="Peso (%) *"
                  description="💡 Porcentaje del criterio (ej: 20, 30)"
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      onChange={(event) => {
                        control.onChange(event);
                        onWeightChange?.(event.target.value);
                      }}
                    />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <FormField field={field} label="Descripción">
                  {(control) => (
                    <Textarea
                      {...control}
                      rows={4}
                      placeholder="Descripción detallada del criterio de evaluación"
                    />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="orderNum">
              {(field) => (
                <FormField
                  field={field}
                  label="Orden"
                  description="💡 Orden de visualización en listas"
                >
                  {(control) => <Input {...control} type="number" min={1} step={1} />}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "✅ Crear Criterio" : "💾 Actualizar Criterio"}
                </SubmitButton>
                <Link to="/criterios" className={buttonVariants({ variant: "outline" })}>
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
