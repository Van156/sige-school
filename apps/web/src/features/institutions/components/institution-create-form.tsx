import { Button, buttonVariants } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AuthFormError } from "@/features/auth";
import FormField from "@/shared/components/form/form-field";

import {
  DOCUMENT_TYPES,
  INSTITUTION_CREATE_FALLBACK_MESSAGE,
  emptyInstitutionForm,
  institutionFormSchema,
  toCreateInstitutionInput,
} from "../lib/institution-form";

export type CreateInstitutionInput = ReturnType<typeof toCreateInstitutionInput>;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

/**
 * INS-02 create form (sige/02 §5, P0 slice): institution name plus its mandatory rector.
 * Presentational: `onSubmit` performs the creation and rejects with a user-facing message, shown
 * inline above the submit button.
 */
export default function InstitutionCreateForm({
  onSubmit,
}: {
  onSubmit: (input: CreateInstitutionInput) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: emptyInstitutionForm,
    validators: { onSubmit: institutionFormSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await onSubmit(toCreateInstitutionInput(institutionFormSchema.parse(value)));
      } catch (error) {
        setServerError(
          error instanceof Error ? error.message : INSTITUTION_CREATE_FALLBACK_MESSAGE,
        );
      }
    },
  });

  return (
    <form
      noValidate
      aria-label="Nueva Institución"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-base font-semibold">Datos Institucionales</legend>
        <form.Field name="institutionName">
          {(field) => (
            <FormField field={field} label="Nombre de la Institución *">
              {(control) => <Input {...control} autoComplete="organization" />}
            </FormField>
          )}
        </form.Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">Crear Administrador (Obligatorio)</legend>
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          Requerido: Cada institución debe tener un administrador (Rector) que la gestione.
        </p>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <form.Field name="firstName">
            {(field) => (
              <FormField field={field} label="Nombres *">
                {(control) => <Input {...control} placeholder="Ej: Juan Carlos" />}
              </FormField>
            )}
          </form.Field>
          <form.Field name="lastName">
            {(field) => (
              <FormField field={field} label="Apellidos *">
                {(control) => <Input {...control} placeholder="Ej: Pérez García" />}
              </FormField>
            )}
          </form.Field>
          <form.Field name="documentType">
            {(field) => (
              <FormField field={field} label="Tipo Doc. *">
                {(control) => (
                  <select {...control} className={SELECT_CLASS}>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            )}
          </form.Field>
          <form.Field name="documentNumber">
            {(field) => (
              <FormField
                field={field}
                label="Nº Documento *"
                description="Se usará como contraseña inicial"
              >
                {(control) => <Input {...control} inputMode="numeric" />}
              </FormField>
            )}
          </form.Field>
          <form.Field name="email">
            {(field) => (
              <FormField field={field} label="Email *">
                {(control) => (
                  <Input
                    {...control}
                    type="email"
                    placeholder="rector@inst.edu.co"
                    autoComplete="email"
                  />
                )}
              </FormField>
            )}
          </form.Field>
          <form.Field name="phone">
            {(field) => (
              <FormField field={field} label="Teléfono">
                {(control) => <Input {...control} type="tel" placeholder="3001234567" />}
              </FormField>
            )}
          </form.Field>
        </FieldGroup>
        <p className="text-sm text-muted-foreground">
          El username se genera automáticamente con el nombre y el documento. Contraseña inicial: Nº
          de documento.
        </p>
      </fieldset>

      {serverError ? <AuthFormError message={serverError} /> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Institución con Admin"}
            </Button>
            <Link to="/admin/instituciones" className={buttonVariants({ variant: "outline" })}>
              Cancelar
            </Link>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
