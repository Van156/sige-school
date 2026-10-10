import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { AuthFormError } from "@/features/auth";
import { campusOptionLabel, mapSubmitError, type CampusOption } from "@/features/institution";
import type { UsernamePreviewParts } from "@/features/users";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  COURSE_CHANGE_HELP,
  courseAfterCampusSelect,
  courseChoices,
  hasCourseChanged,
  STUDENT_CREATE_FALLBACK,
  STUDENT_DOCUMENT_TYPE_OPTIONS,
  STUDENT_FIELD_BY_MESSAGE,
  STUDENT_FORM_FIELDS,
  STUDENT_GENDER_OPTIONS,
  STUDENT_UPDATE_FALLBACK,
  statusChoices,
  studentFormValidator,
  type StudentCourseOption,
  type StudentFormMode,
  type StudentFormValues,
} from "../lib/student-form";
import { isStudentStatus } from "../lib/student-status";

const FORM_LABELS: Record<StudentFormMode, string> = {
  create: "Nuevo Estudiante",
  complete: "Completar Perfil Académico",
  edit: "Editar Estudiante",
};

/**
 * STU-03 form (sige/05 §5.3) in its three modes: new (personal + academic + guardian data, live
 * username), complete (academic + guardian data of an existing login; `header` shows that login)
 * and edit (plus "Estado del Estudiante"; the document is immutable). The "Grado" choices follow
 * the chosen "Sede" and a campus change drops a course of another campus (STU-R4). Presentational:
 * `onSubmit` saves and rejects with the server error, mapped onto the fields or shown above the
 * buttons.
 */
export default function StudentForm({
  mode,
  initialValues,
  campuses,
  courses,
  currentCourse,
  onSubmit,
  onInvalid,
  header,
  renderUsernamePreview,
  cancelTo,
}: {
  mode: StudentFormMode;
  initialValues: StudentFormValues;
  /** "Sede" choices (`campus.options`, plus the student's campus on edit). */
  campuses: readonly CampusOption[];
  /** "Grado" choices of every campus; the form shows those of the chosen one. */
  courses: readonly StudentCourseOption[];
  /** Edit: the stored course, offered even when `courses` no longer lists it. */
  currentCourse?: StudentCourseOption | null;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  onInvalid?: () => void;
  /** Complete mode: the existing login banner. */
  header?: ReactNode;
  /** New mode: the live username preview for the typed names and document. */
  renderUsernamePreview?: (parts: UsernamePreviewParts) => ReactNode;
  /** "Cancelar": USR-01 in complete mode, STU-01 otherwise (sige/05 §5.3). */
  cancelTo: "/estudiantes" | "/usuarios";
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = mode === "edit";
  const knownCourses =
    currentCourse && !courses.some((course) => course.id === currentCourse.id)
      ? [...courses, currentCourse]
      : courses;
  const initialStatus = isStudentStatus(initialValues.status) ? initialValues.status : "activo";

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: studentFormValidator(mode) },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(value);
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: STUDENT_FORM_FIELDS,
          fieldByMessage: STUDENT_FIELD_BY_MESSAGE,
          fallback: isEdit ? STUDENT_UPDATE_FALLBACK : STUDENT_CREATE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  const textField = (
    name: keyof StudentFormValues,
    label: string,
    props: { placeholder?: string; type?: string } = {},
  ) => (
    <form.Field name={name}>
      {(field) => (
        <FormField field={field} label={label}>
          {(control) => <Input {...control} {...props} autoComplete="off" />}
        </FormField>
      )}
    </form.Field>
  );

  // Complete mode renders no "Información del Usuario", so the later sections move up one.
  const offset = mode === "complete" ? 0 : 1;

  return (
    <form
      noValidate
      aria-label={FORM_LABELS[mode]}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Datos del Estudiante</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {mode === "complete" ? (
            <>
              {header}
              <Callout title="Información personal ya registrada">
                Nombre, documento, email y teléfono fueron creados. Ahora solo necesita completar la
                información académica y del acudiente.
              </Callout>
            </>
          ) : null}
          {mode === "create" ? (
            <>
              <Callout title="Usuario automático">
                Se generará automáticamente. Contraseña inicial: Nº de documento.
              </Callout>
              {renderUsernamePreview ? (
                <form.Subscribe
                  selector={(state) => ({
                    firstName: state.values.firstName,
                    lastName: state.values.lastName,
                    documentNumber: state.values.documentNumber,
                  })}
                >
                  {(parts) => renderUsernamePreview(parts)}
                </form.Subscribe>
              ) : null}
            </>
          ) : null}

          {mode === "complete" ? null : (
            <FormSection index={1} title="Información del Usuario">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                {textField("firstName", "Nombre *")}
                {textField("lastName", "Apellido *")}
                <form.Field name="documentType">
                  {(field) => (
                    <FormField
                      field={field}
                      label="Tipo de Documento"
                      description={isEdit ? "No editable después de crear" : undefined}
                    >
                      {(control) => (
                        <NativeSelect {...control} disabled={isEdit} className="w-full">
                          {STUDENT_DOCUMENT_TYPE_OPTIONS.map((option) => (
                            <NativeSelectOption key={option.value} value={option.value}>
                              {option.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="documentNumber">
                  {(field) => (
                    <FormField field={field} label="Número de Documento *">
                      {(control) => <Input {...control} readOnly={isEdit} autoComplete="off" />}
                    </FormField>
                  )}
                </form.Field>
                {textField("phone", "Teléfono", { type: "tel" })}
                {textField("birthDate", "Fecha de Nacimiento", { type: "date" })}
                <form.Field name="gender">
                  {(field) => (
                    <FormField field={field} label="Género">
                      {(control) => (
                        <NativeSelect {...control} className="w-full">
                          {STUDENT_GENDER_OPTIONS.map((option) => (
                            <NativeSelectOption key={option.value} value={option.value}>
                              {option.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                  )}
                </form.Field>
                {textField("address", "Dirección")}
              </FieldGroup>
            </FormSection>
          )}

          <FormSection index={1 + offset} title="Información Académica">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <form.Field name="campusId">
                {(field) => (
                  <FormField field={field} label="Sede *">
                    {(control) => (
                      <NativeSelect
                        {...control}
                        onChange={(event) => {
                          control.onChange(event);
                          form.setFieldValue(
                            "courseId",
                            courseAfterCampusSelect(
                              form.getFieldValue("courseId"),
                              event.target.value,
                              knownCourses,
                            ),
                          );
                        }}
                        className="w-full"
                      >
                        <NativeSelectOption value="">Seleccionar sede...</NativeSelectOption>
                        {campuses.map((campus) => (
                          <NativeSelectOption key={campus.id} value={campus.id}>
                            {campusOptionLabel(campus)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.campusId}>
                {(campusId) => (
                  <form.Field name="courseId">
                    {(field) => (
                      <FormField
                        field={field}
                        label="Grado"
                        description={
                          campusId ? undefined : "Selecciona una sede para ver sus grados"
                        }
                      >
                        {(control) => (
                          <NativeSelect {...control} disabled={!campusId} className="w-full">
                            <NativeSelectOption value="">Sin asignar</NativeSelectOption>
                            {courseChoices(courses, campusId, currentCourse).map((option) => (
                              <NativeSelectOption key={option.value} value={option.value}>
                                {option.label}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                        )}
                      </FormField>
                    )}
                  </form.Field>
                )}
              </form.Subscribe>
              {textField("neighborhood", "Barrio / Vereda", { placeholder: "Ej: El Centro" })}
              <form.Field name="stratum">
                {(field) => (
                  <FormField field={field} label="Estrato">
                    {(control) => (
                      <Input {...control} type="number" min={1} max={6} inputMode="numeric" />
                    )}
                  </FormField>
                )}
              </form.Field>
              {textField("bloodType", "Tipo de Sangre", { placeholder: "Ej: O+" })}
              {textField("eps", "EPS", { placeholder: "Ej: Sanitas" })}
            </FieldGroup>
          </FormSection>

          <FormSection index={2 + offset} title="Información del Acudiente">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {textField("guardianName", "Nombre del Acudiente")}
              {textField("guardianPhone", "Teléfono del Acudiente", { type: "tel" })}
              <div className="sm:col-span-2">
                {textField("guardianEmail", "Email del Acudiente", { type: "email" })}
              </div>
            </FieldGroup>
          </FormSection>

          {isEdit ? (
            <FormSection index={3 + offset} title="Estado del Estudiante">
              <FieldGroup className="gap-4">
                <form.Field name="status">
                  {(field) => (
                    <FormField field={field} label="Estado">
                      {(control) => (
                        <NativeSelect {...control} className="w-full sm:w-64">
                          {statusChoices(initialStatus).map((option) => (
                            <NativeSelectOption key={option.value} value={option.value}>
                              {option.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                  )}
                </form.Field>
                <form.Subscribe selector={(state) => state.values.courseId}>
                  {(courseId) =>
                    hasCourseChanged(initialValues.courseId, courseId) ? (
                      <Callout title="Cambio de grado">{COURSE_CHANGE_HELP}</Callout>
                    ) : null
                  }
                </form.Subscribe>
              </FieldGroup>
            </FormSection>
          ) : null}

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex flex-wrap gap-2">
                <SubmitButton isPending={isSubmitting} pendingLabel="Guardando...">
                  {isEdit ? "Actualizar" : "✅ Completar Matrícula"}
                </SubmitButton>
                <Link to={cancelTo} className={buttonVariants({ variant: "outline" })}>
                  Cancelar
                </Link>
              </div>
            )}
          </form.Subscribe>
        </CardContent>
      </Card>
    </form>
  );
}

function FormSection({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full bg-muted text-xs"
        >
          {index}
        </span>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
