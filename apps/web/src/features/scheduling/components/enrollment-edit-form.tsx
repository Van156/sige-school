import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Textarea } from "@base-template/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";

import { AuthFormError } from "@/features/auth";
import { formatIsoDate, mapSubmitError } from "@/features/institution";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  ENROLLMENT_EDIT_FIELDS,
  ENROLLMENT_EDIT_SAVE_FALLBACK,
  enrollmentEditFormSchema,
  enrollmentToEditForm,
  toEnrollmentEditInput,
  type EnrollmentEditInput,
} from "../lib/enrollment-form";
import { ENROLLMENT_STATUS_OPTIONS } from "../lib/enrollment-list";
import type { EnrollmentRow } from "../types";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} value={value} readOnly disabled />
    </Field>
  );
}

/**
 * SCH-02 edit form (sige/04 §5.2): the student, subject and date are read-only; only the status,
 * the final score and the note change (SCH-R8). Presentational: `onSubmit` performs
 * `enrollment.update`, rejecting with the server error, which this form maps onto its fields or an
 * inline message.
 */
export default function EnrollmentEditForm({
  enrollment,
  onSubmit,
  onInvalid,
}: {
  enrollment: EnrollmentRow;
  onSubmit: (input: EnrollmentEditInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: enrollmentToEditForm(enrollment),
    validators: { onSubmit: enrollmentEditFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toEnrollmentEditInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: ENROLLMENT_EDIT_FIELDS,
          fallback: ENROLLMENT_EDIT_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos de la Matrícula</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Editar Matrícula"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Estudiante" value={enrollment.studentName} />
              <ReadOnlyField
                label="Materia"
                value={`${enrollment.subjectName} · ${enrollment.courseName}`}
              />
              <ReadOnlyField
                label="Fecha Matrícula"
                value={formatIsoDate(enrollment.enrollmentDate)}
              />
              <form.Field name="status">
                {(field) => (
                  <FormField field={field} label="Estado">
                    {(control) => (
                      <NativeSelect {...control} className="w-full">
                        {ENROLLMENT_STATUS_OPTIONS.map((status) => (
                          <NativeSelectOption key={status.value} value={status.value}>
                            {status.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="finalScore">
              {(field) => (
                <FormField
                  field={field}
                  label="Nota Final"
                  description="Opcional · escala 1.0 a 5.0"
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={5}
                      step={0.1}
                    />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="statusNote">
              {(field) => (
                <FormField field={field} label="Observaciones">
                  {(control) => (
                    <Textarea {...control} rows={3} placeholder="Motivo del cambio de estado" />
                  )}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>Guardar Cambios</SubmitButton>
                <Link to="/matriculas" className={buttonVariants({ variant: "outline" })}>
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
