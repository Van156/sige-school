import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { Textarea } from "@base-template/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import { campusOptionLabel, mapSubmitError, type CampusOption } from "@/features/institution";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";

import { CLASSROOM_TYPE_OPTIONS } from "../lib/classroom-list";
import {
  CLASSROOM_FIELD_BY_MESSAGE,
  CLASSROOM_FIELDS,
  CLASSROOM_SAVE_FALLBACK,
  classroomFormSchema,
  toClassroomInput,
  type ClassroomFormValues,
  type ClassroomInput,
} from "../lib/classroom-form";

/**
 * SCH-08 classroom form (sige/04 §5.2). Presentational: `campuses` are the select's choices
 * (active campuses; the current one stays when editing) and `onSubmit` performs the create or
 * update, rejecting with the server error, which this form maps onto its fields (a repeated code
 * under "Código", a refused campus change under "Sede") or an inline message.
 */
export default function ClassroomForm({
  initialValues,
  mode,
  campuses,
  onSubmit,
  onInvalid,
}: {
  initialValues: ClassroomFormValues;
  mode: "create" | "edit";
  campuses: readonly CampusOption[];
  onSubmit: (input: ClassroomInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: classroomFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toClassroomInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: CLASSROOM_FIELDS,
          fieldByMessage: CLASSROOM_FIELD_BY_MESSAGE,
          fallback: CLASSROOM_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos del Salón</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nuevo Salón" : "Editar Salón"}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-4">
            <form.Field name="campusId">
              {(field) => (
                <FormField field={field} label="Sede *">
                  {(control) => (
                    <NativeSelect {...control} className="w-full">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="name">
                {(field) => (
                  <FormField field={field} label="Nombre *">
                    {(control) => <Input {...control} placeholder="Ej: Aula 101" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="code">
                {(field) => (
                  <FormField
                    field={field}
                    label="Código *"
                    description="Ej: AULA-101, LAB-CIENCIAS"
                  >
                    {(control) => <Input {...control} placeholder="AULA-101" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="capacity">
                {(field) => (
                  <FormField field={field} label="Capacidad">
                    {(control) => <Input {...control} type="number" min={10} max={100} step={1} />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="classroomType">
                {(field) => (
                  <FormField field={field} label="Tipo">
                    {(control) => (
                      <NativeSelect {...control} className="w-full">
                        {CLASSROOM_TYPE_OPTIONS.map((type) => (
                          <NativeSelectOption key={type.value} value={type.value}>
                            {type.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="building">
                {(field) => (
                  <FormField field={field} label="Edificio">
                    {(control) => <Input {...control} placeholder="Ej: A" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="floor">
                {(field) => (
                  <FormField field={field} label="Piso">
                    {(control) => <Input {...control} type="number" min={1} step={1} />}
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="resources">
              {(field) => (
                <FormField
                  field={field}
                  label="Recursos (JSON)"
                  description="Lista de recursos disponibles en formato JSON"
                >
                  {(control) => (
                    <Textarea
                      {...control}
                      rows={4}
                      className="font-mono text-xs"
                      placeholder='{"proyector": true, "computadoras": 30}'
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
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "Crear Salón" : "Guardar Cambios"}
                </SubmitButton>
                <Link to="/salones" className={buttonVariants({ variant: "outline" })}>
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
