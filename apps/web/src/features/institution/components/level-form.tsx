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
  campusOptionLabel,
  emptyLevelForm,
  LEVEL_FIELD_BY_MESSAGE,
  LEVEL_FIELDS,
  LEVEL_SAVE_FALLBACK,
  levelFormSchema,
  toLevelInput,
  type LevelFormValues,
  type LevelInput,
} from "../lib/level-form";
import { mapSubmitError } from "../lib/server-form-error";
import type { CampusOption } from "../types";

/**
 * INS-10 level form (sige/02 §5.2). Presentational: `campuses` are the select's choices and
 * `onSubmit` performs the create or update, rejecting with the server error, which this form maps
 * onto its fields (e.g. a repeated name) or an inline message. The campus is fixed once the level
 * exists, so the select is disabled on edit. `onInvalid` fires when client validation blocks the
 * submit, so the caller can toast.
 */
export default function LevelForm({
  initialValues = emptyLevelForm,
  mode,
  campuses,
  onSubmit,
  onInvalid,
}: {
  initialValues?: LevelFormValues;
  mode: "create" | "edit";
  campuses: readonly CampusOption[];
  onSubmit: (input: LevelInput) => Promise<void>;
  onInvalid?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: initialValues,
    validators: { onSubmit: levelFormSchema },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(toLevelInput(value));
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: LEVEL_FIELDS,
          fieldByMessage: LEVEL_FIELD_BY_MESSAGE,
          fallback: LEVEL_SAVE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Datos del Nivel</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={mode === "create" ? "Nuevo Nivel Académico" : "Editar Nivel Académico"}
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
                <FormField
                  field={field}
                  label="Sede *"
                  description={
                    mode === "edit" ? "La sede de un nivel no se puede cambiar" : undefined
                  }
                >
                  {(control) => (
                    <NativeSelect {...control} disabled={mode === "edit"} className="w-full">
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
            <form.Field name="name">
              {(field) => (
                <FormField field={field} label="Nombre del Nivel *">
                  {(control) => (
                    <Input {...control} placeholder="Ej: Primero, Sexto, Once, Transición" />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="orderNum">
              {(field) => (
                <FormField
                  field={field}
                  label="Orden"
                  description="💡 Número para ordenar los niveles (0=primero)"
                >
                  {(control) => <Input {...control} type="number" min={0} step={1} />}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton isPending={isSubmitting}>
                  {mode === "create" ? "Crear Nivel" : "Actualizar Nivel"}
                </SubmitButton>
                <Link to="/niveles" className={buttonVariants({ variant: "outline" })}>
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
