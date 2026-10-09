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

import { mapSubmitError } from "../lib/server-form-error";
import {
  emptySubjectForm,
  SUBJECT_FIELD_BY_MESSAGE,
  SUBJECT_FIELDS,
  SUBJECT_SAVE_FALLBACK,
  subjectFormSchema,
  toSubjectInput,
  type SubjectFormValues,
  type SubjectInput,
} from "../lib/subject-form";

/**
 * INS-14 subject form (sige/02 §5.2). Presentational: `onSubmit` performs the create or update and
 * rejects with the server error, which this form maps onto its fields (a repeated code under
 * "Código") or an inline message. `onInvalid` fires when client validation blocks the submit.
 */
export default function SubjectForm({
  initialValues = emptySubjectForm,
  mode,
  onSubmit,
  onInvalid,
}: {
  initialValues?: SubjectFormValues;
  mode: "create" | "edit";
  onSubmit: (input: SubjectInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: subjectFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toSubjectInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: SUBJECT_FIELDS,
          fieldByMessage: SUBJECT_FIELD_BY_MESSAGE,
          fallback: SUBJECT_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos de la Asignatura</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nueva Asignatura" : "Editar Asignatura"}
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
                  label="Nombre de la Asignatura *"
                  description="💡 Nombre descriptivo de la asignatura (ej: Matemáticas, Ciencias Naturales)"
                >
                  {(control) => <Input {...control} placeholder="Ej: Matemáticas" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="code">
              {(field) => (
                <FormField
                  field={field}
                  label="Código"
                  description="💡 Código interno de la asignatura (opcional)"
                >
                  {(control) => <Input {...control} placeholder="Ej: MAT" />}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "✅ Crear Asignatura" : "💾 Actualizar Asignatura"}
                </SubmitButton>
                <Link to="/asignaturas" className={buttonVariants({ variant: "outline" })}>
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
