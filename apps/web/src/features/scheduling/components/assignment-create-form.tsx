import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { Option } from "@/shared/lib/data-table/types";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  assignFormSchema,
  emptyAssignForm,
  mapAssignSubmitError,
  toAssignInput,
  type AssignInput,
} from "../lib/assignment-form";

/**
 * SCH-04 create form (sige/04 §5.2): course, subject and teacher. Presentational: the three
 * option lists are the select choices and `onSubmit` performs `assignment.assign`, rejecting with
 * the server error, which this form maps onto its fields (a busy teacher under "Profesor") or an
 * inline message.
 */
export default function AssignmentCreateForm({
  courses,
  subjects,
  teachers,
  onSubmit,
  onInvalid,
}: {
  courses: readonly Option[];
  subjects: readonly Option[];
  teachers: readonly Option[];
  onSubmit: (input: AssignInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: emptyAssignForm,
    validators: { onSubmit: assignFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toAssignInput(value));
      } catch (error) {
        const failure = mapAssignSubmitError(error);
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Nueva Asignación</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Nueva Asignación"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-4">
            <form.Field name="courseId">
              {(field) => (
                <FormField field={field} label="Grado *">
                  {(control) => (
                    <NativeSelect {...control} className="w-full">
                      <NativeSelectOption value="">Seleccione un grado</NativeSelectOption>
                      {courses.map((course) => (
                        <NativeSelectOption key={course.value} value={course.value}>
                          {course.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="subjectId">
              {(field) => (
                <FormField field={field} label="Materia *">
                  {(control) => (
                    <NativeSelect {...control} className="w-full">
                      <NativeSelectOption value="">Seleccione una materia</NativeSelectOption>
                      {subjects.map((subject) => (
                        <NativeSelectOption key={subject.value} value={subject.value}>
                          {subject.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="teacherPersonId">
              {(field) => (
                <FormField field={field} label="Profesor *">
                  {(control) => (
                    <NativeSelect {...control} className="w-full">
                      <NativeSelectOption value="">Seleccione un profesor</NativeSelectOption>
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
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>Asignar Profesor</SubmitButton>
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
