import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Spinner } from "@base-template/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { Option } from "@/shared/lib/data-table/types";

import { AuthFormError } from "@/features/auth";
import CheckList, { type CheckItem } from "@/shared/components/form/check-list";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";
import { firstErrorMessage } from "@/shared/lib/form-errors";

import {
  calloutCourseDetail,
  emptyEnrollForm,
  enrollFormSchema,
  mapEnrollSubmitError,
  toEnrollInput,
  type EnrollInput,
} from "../lib/enrollment-form";
import type { EnrollmentCandidateCourse } from "../types";

/** The `enrollment.candidates` state of the chosen course, owned by the caller. */
export type EnrollmentCandidatesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; course: EnrollmentCandidateCourse; students: readonly CheckItem[] };

function emptyCandidates(candidates: EnrollmentCandidatesState): ReactNode {
  switch (candidates.status) {
    case "idle":
      return "Seleccione un grado primero";
    case "loading":
      return (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          Cargando estudiantes...
        </span>
      );
    case "error":
      return (
        <span className="inline-flex flex-wrap items-center justify-center gap-2">
          No se pudieron cargar los estudiantes.
          <Button type="button" variant="outline" size="xs" onClick={candidates.onRetry}>
            Reintentar
          </Button>
        </span>
      );
    case "ready":
      return "No hay estudiantes activos disponibles para este grado.";
  }
}

/**
 * SCH-02 create form (sige/04 §5.2): a current-year course, then the checklist of its candidates.
 * Presentational: the caller loads the candidates of the course reported by `onCourseChange` (the
 * selection resets on every course change) and `onSubmit` performs `enrollment.createBulk`,
 * resolving when the caller took over (saved, or asked for the capacity confirmation) and
 * rejecting with any other server error, which this form maps onto its fields or an inline message.
 */
export default function EnrollmentCreateForm({
  courses,
  candidates,
  onCourseChange,
  onSubmit,
  onInvalid,
}: {
  courses: readonly Option[];
  candidates: EnrollmentCandidatesState;
  onCourseChange: (courseId: string) => void;
  onSubmit: (input: EnrollInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: emptyEnrollForm,
    validators: { onSubmit: enrollFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toEnrollInput(value));
      } catch (error) {
        const failure = mapEnrollSubmitError(error);
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  const course = candidates.status === "ready" ? candidates.course : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Matricular Estudiantes</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Matricular Estudiantes"
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
                    <NativeSelect
                      {...control}
                      onChange={(event) => {
                        control.onChange(event);
                        form.setFieldValue("studentIds", []);
                        onCourseChange(event.target.value);
                      }}
                      className="w-full"
                    >
                      <NativeSelectOption value="">Seleccione un grado</NativeSelectOption>
                      {courses.map((option) => (
                        <NativeSelectOption key={option.value} value={option.value}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="studentIds">
              {(field) => (
                <CheckList
                  legend="Estudiantes"
                  required
                  items={candidates.status === "ready" ? candidates.students : []}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  error={firstErrorMessage(field.state.meta.errors)}
                  hint="Marque los estudiantes que serán matriculados."
                  empty={emptyCandidates(candidates)}
                />
              )}
            </form.Field>
            <Alert>
              <Info />
              <AlertTitle>Nota</AlertTitle>
              <AlertDescription>
                <p>
                  Al matricular, los estudiantes serán inscritos en{" "}
                  <strong className="font-medium text-foreground">todas las materias</strong>{" "}
                  asignadas a este grado{calloutCourseDetail(course)}.
                </p>
              </AlertDescription>
            </Alert>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>Matricular Estudiantes</SubmitButton>
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
