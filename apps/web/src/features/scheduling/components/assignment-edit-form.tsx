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
  ASSIGNMENT_EDIT_FIELDS,
  ASSIGNMENT_EDIT_SAVE_FALLBACK,
  assignmentEditFormSchema,
  assignmentToEditForm,
  toAssignmentEditInput,
  type AssignmentEditInput,
} from "../lib/assignment-form";
import { ASSIGNMENT_STATUS_OPTIONS } from "../lib/assignment-list";
import type { AssignmentRow } from "../types";

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
 * SCH-04 edit form (sige/04 §5.2): the assignment's teacher, subject, course and date are
 * read-only; only the status and the notes change. Presentational: `onSubmit` performs
 * `assignment.update`, rejecting with the server error, which this form maps onto its fields or an
 * inline message.
 */
export default function AssignmentEditForm({
  assignment,
  onSubmit,
  onInvalid,
}: {
  assignment: AssignmentRow;
  onSubmit: (input: AssignmentEditInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: assignmentToEditForm(assignment),
    validators: { onSubmit: assignmentEditFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toAssignmentEditInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: ASSIGNMENT_EDIT_FIELDS,
          fallback: ASSIGNMENT_EDIT_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos de la Asignación</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Editar Asignación"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Profesor" value={assignment.teacherName} />
              <ReadOnlyField label="Materia" value={assignment.subjectName} />
              <ReadOnlyField label="Grado" value={assignment.courseName} />
              <ReadOnlyField
                label="Fecha Asignación"
                value={formatIsoDate(assignment.assignmentDate)}
              />
            </div>
            <form.Field name="status">
              {(field) => (
                <FormField field={field} label="Estado">
                  {(control) => (
                    <NativeSelect {...control} className="w-full">
                      {ASSIGNMENT_STATUS_OPTIONS.map((status) => (
                        <NativeSelectOption key={status.value} value={status.value}>
                          {status.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="notes">
              {(field) => (
                <FormField field={field} label="Observaciones">
                  {(control) => (
                    <Textarea
                      {...control}
                      rows={3}
                      placeholder="Ej: Reemplazo temporal por incapacidad"
                    />
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
                <Link to="/asignaciones" className={buttonVariants({ variant: "outline" })}>
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
