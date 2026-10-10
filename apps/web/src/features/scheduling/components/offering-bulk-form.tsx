import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { Option } from "@/shared/lib/data-table/types";

import { AuthFormError } from "@/features/auth";
import { mapSubmitError } from "@/features/institution";
import CheckList, { type CheckItem } from "@/shared/components/form/check-list";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";
import { firstErrorMessage } from "@/shared/lib/form-errors";

import {
  BULK_OFFERING_FIELDS,
  BULK_OFFERING_SAVE_FALLBACK,
  bulkOfferingFormSchema,
  toBulkOfferingInput,
  type BulkOfferingFormValues,
  type BulkOfferingInput,
} from "../lib/offering-form";

/**
 * SCH-06 bulk assignment form (sige/04 §5.2): courses x subjects, optional teacher and hours.
 * Presentational: `courses`, `subjects` and `teachers` are the choices and `onSubmit` performs
 * `offering.createBulk`, rejecting with the server error, which this form maps onto its fields or
 * an inline message.
 */
export default function OfferingBulkForm({
  initialValues,
  courses,
  subjects,
  teachers,
  onSubmit,
  onInvalid,
}: {
  initialValues: BulkOfferingFormValues;
  courses: readonly CheckItem[];
  subjects: readonly CheckItem[];
  teachers: readonly Option[];
  onSubmit: (input: BulkOfferingInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: bulkOfferingFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toBulkOfferingInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: BULK_OFFERING_FIELDS,
          fallback: BULK_OFFERING_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Asignar Materias</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Asignar Materias"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-4">
            <form.Field name="courseIds">
              {(field) => (
                <CheckList
                  legend="Grados"
                  required
                  items={courses}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  error={firstErrorMessage(field.state.meta.errors)}
                  empty="No hay grados registrados en la institución."
                />
              )}
            </form.Field>
            <form.Field name="subjectIds">
              {(field) => (
                <CheckList
                  legend="Materias"
                  required
                  items={subjects}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  error={firstErrorMessage(field.state.meta.errors)}
                  empty="No hay materias registradas en la institución."
                />
              )}
            </form.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="teacherPersonId">
                {(field) => (
                  <FormField field={field} label="Profesor (opcional)">
                    {(control) => (
                      <NativeSelect {...control} className="w-full">
                        <NativeSelectOption value="">Sin asignar</NativeSelectOption>
                        {teachers.map((teacher) => (
                          <NativeSelectOption key={teacher.value} value={teacher.value}>
                            {teacher.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="hoursPerWeek">
                {(field) => (
                  <FormField
                    field={field}
                    label="Intensidad Horaria (Horas/Semana) *"
                    description="¿Cuántas horas de esta materia recibe el grado a la semana?"
                  >
                    {(control) => <Input {...control} type="number" min={1} max={20} step={1} />}
                  </FormField>
                )}
              </form.Field>
            </div>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>Asignar Materias</SubmitButton>
                <Link to="/materias-por-grado" className={buttonVariants({ variant: "outline" })}>
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
