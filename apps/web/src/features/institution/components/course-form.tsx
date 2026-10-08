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

import {
  COURSE_FIELD_BY_MESSAGE,
  COURSE_FIELDS,
  COURSE_SAVE_FALLBACK,
  courseFormSchema,
  levelAfterCampusChange,
  levelChoices,
  SHIFT_OPTIONS,
  toCourseInput,
  type CourseFormValues,
  type CourseInput,
} from "../lib/course-form";
import { campusOptionLabel } from "../lib/level-form";
import { mapSubmitError } from "../lib/server-form-error";
import type { CampusOption, LevelRow } from "../types";

/**
 * INS-12 course form (sige/02 §5.2). Presentational: `campuses` and `levels` are the selects'
 * choices (the level select shows only the chosen campus's levels and resets when the campus
 * changes) and `onSubmit` performs the create or update, rejecting with the server error, which
 * this form maps onto its fields (a repeated course under "Nombre", a level of another campus
 * under "Nivel Académico") or an inline message. There is no director select yet (D2).
 */
export default function CourseForm({
  initialValues,
  mode,
  campuses,
  levels,
  onSubmit,
  onInvalid,
}: {
  initialValues: CourseFormValues;
  mode: "create" | "edit";
  campuses: readonly CampusOption[];
  levels: readonly LevelRow[];
  onSubmit: (input: CourseInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: courseFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toCourseInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: COURSE_FIELDS,
          fieldByMessage: COURSE_FIELD_BY_MESSAGE,
          fallback: COURSE_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos del Grado</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nuevo Grado" : "Editar Grado"}
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
                  label="Nombre del Grado *"
                  description="💡 Nombre del grupo educativo"
                >
                  {(control) => <Input {...control} placeholder="Ej: 6-1, 11°B, Transición A" />}
                </FormField>
              )}
            </form.Field>
            <form.Field name="campusId">
              {(field) => (
                <FormField field={field} label="Sede *">
                  {(control) => (
                    <NativeSelect
                      {...control}
                      onChange={(event) => {
                        control.onChange(event);
                        form.setFieldValue(
                          "levelId",
                          levelAfterCampusChange(
                            form.getFieldValue("levelId"),
                            event.target.value,
                            levels,
                          ),
                        );
                      }}
                      className="w-full"
                    >
                      <NativeSelectOption value="">Seleccione una sede...</NativeSelectOption>
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
                <form.Field name="levelId">
                  {(field) => (
                    <FormField
                      field={field}
                      label="Nivel Académico"
                      description={
                        campusId ? undefined : "Selecciona una sede para ver sus niveles"
                      }
                    >
                      {(control) => (
                        <NativeSelect {...control} disabled={!campusId} className="w-full">
                          <NativeSelectOption value="">Sin nivel (opcional)</NativeSelectOption>
                          {levelChoices(levels, campusId).map((level) => (
                            <NativeSelectOption key={level.value} value={level.value}>
                              {level.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                  )}
                </form.Field>
              )}
            </form.Subscribe>
            <div className="grid gap-4 sm:grid-cols-3">
              <form.Field name="academicYear">
                {(field) => (
                  <FormField field={field} label="Año Lectivo *">
                    {(control) => <Input {...control} inputMode="numeric" placeholder="2026" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="shift">
                {(field) => (
                  <FormField field={field} label="Jornada *">
                    {(control) => (
                      <NativeSelect {...control} className="w-full">
                        {SHIFT_OPTIONS.map((shift) => (
                          <NativeSelectOption key={shift.value} value={shift.value}>
                            {shift.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="maxStudents">
                {(field) => (
                  <FormField field={field} label="Capacidad Máxima">
                    {(control) => <Input {...control} type="number" min={1} max={60} step={1} />}
                  </FormField>
                )}
              </form.Field>
            </div>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "Crear Grado" : "Actualizar Grado"}
                </SubmitButton>
                <Link to="/cursos" className={buttonVariants({ variant: "outline" })}>
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
