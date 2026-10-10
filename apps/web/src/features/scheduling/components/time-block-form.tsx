import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import { campusOptionLabel, mapSubmitError, type CampusOption } from "@/features/institution";
import FormField from "@/shared/components/form/form-field";
import SubmitButton from "@/shared/components/form/submit-button";
import SwitchField from "@/shared/components/form/switch-field";

import {
  nextOrderNum,
  TIME_BLOCK_FIELD_BY_MESSAGE,
  TIME_BLOCK_FIELDS,
  TIME_BLOCK_SAVE_FALLBACK,
  timeBlockFormSchema,
  toTimeBlockInput,
  type TimeBlockFormValues,
  type TimeBlockInput,
} from "../lib/time-block-form";
import { SHIFT_OPTIONS } from "../lib/time-block-list";
import type { TimeBlockRow } from "../types";

/**
 * SCH-10 time block form (sige/04 §5.2). Presentational: `campuses` are the select's choices and
 * `onSubmit` performs the create or update, rejecting with the server error, which this form maps
 * onto its fields (a repeated name under "Nombre") or shows on the form as a whole (an overlap
 * with another block, or a block in use that cannot be moved). On create, "Orden" follows the
 * chosen campus and jornada (`existing` are the listed blocks) until the user types an order.
 */
export default function TimeBlockForm({
  initialValues,
  mode,
  campuses,
  existing = [],
  onSubmit,
  onInvalid,
}: {
  initialValues: TimeBlockFormValues;
  mode: "create" | "edit";
  campuses: readonly CampusOption[];
  existing?: readonly Pick<TimeBlockRow, "campusId" | "shift" | "orderNum">[];
  onSubmit: (input: TimeBlockInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: timeBlockFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toTimeBlockInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: TIME_BLOCK_FIELDS,
          fieldByMessage: TIME_BLOCK_FIELD_BY_MESSAGE,
          fallback: TIME_BLOCK_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  /** On create, keeps "Orden" at the next free one for the chosen campus and jornada until typed. */
  const followNextOrder = (campusId: string, shift: string) => {
    if (mode === "create" && !form.getFieldMeta("orderNum")?.isDirty) {
      form.setFieldValue("orderNum", String(nextOrderNum(existing, campusId, shift)), {
        dontUpdateMeta: true,
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos del Bloque</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nuevo Bloque de Tiempo" : "Editar Bloque"}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="campusId">
                {(field) => (
                  <FormField field={field} label="Sede *">
                    {(control) => (
                      <NativeSelect
                        {...control}
                        onChange={(event) => {
                          control.onChange(event);
                          followNextOrder(event.target.value, form.getFieldValue("shift"));
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
              <form.Field name="shift">
                {(field) => (
                  <FormField field={field} label="Jornada *">
                    {(control) => (
                      <NativeSelect
                        {...control}
                        onChange={(event) => {
                          control.onChange(event);
                          followNextOrder(form.getFieldValue("campusId"), event.target.value);
                        }}
                        className="w-full"
                      >
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
            </div>
            <form.Field name="name">
              {(field) => (
                <FormField field={field} label="Nombre *">
                  {(control) => <Input {...control} placeholder="Ej: Bloque 1, Recreo, Almuerzo" />}
                </FormField>
              )}
            </form.Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <form.Field name="startTime">
                {(field) => (
                  <FormField field={field} label="Hora Inicio *">
                    {(control) => <Input {...control} type="time" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="endTime">
                {(field) => (
                  <FormField field={field} label="Hora Fin *">
                    {(control) => <Input {...control} type="time" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="orderNum">
                {(field) => (
                  <FormField field={field} label="Orden" description="Orden en el día">
                    {(control) => <Input {...control} type="number" min={1} step={1} />}
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="isBreak">
              {(field) => (
                <SwitchField
                  field={field}
                  label="Es descanso/recreo"
                  description="Los bloques de descanso no se asignan con materias"
                />
              )}
            </form.Field>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "Crear Bloque" : "Guardar Cambios"}
                </SubmitButton>
                <Link to="/bloques" className={buttonVariants({ variant: "outline" })}>
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
