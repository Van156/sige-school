import { Button, buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { AuthFormError } from "@/features/auth";
import {
  PROFILE_FIELD_BY_MESSAGE,
  mapSubmitError,
  type ProfileInput,
} from "@/features/institution";
import type { UsernamePreviewParts } from "@/features/users";
import FormField from "@/shared/components/form/form-field";

import {
  DOCUMENT_TYPES,
  INSTITUTION_CREATE_FALLBACK_MESSAGE,
  INSTITUTION_FORM_FIELDS,
  INSTITUTION_UPDATE_FALLBACK_MESSAGE,
  createInstitutionFormSchema,
  editInstitutionFormSchema,
  toCreateInstitutionInput,
  toUpdateInstitutionInput,
  type InstitutionFormValues,
} from "../lib/institution-form";

export type CreateInstitutionInput = ReturnType<typeof toCreateInstitutionInput>;
export type UpdateInstitutionInput = ProfileInput;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

type SubmitProps =
  | { mode: "create"; onSubmit: (input: CreateInstitutionInput) => Promise<void> }
  | { mode: "edit"; onSubmit: (input: UpdateInstitutionInput) => Promise<void> };

/**
 * INS-02 form (sige/02 §5.2): the institution profile and, when creating, its mandatory rector.
 * Presentational: `onSubmit` performs the save and rejects with the server error, which is mapped
 * onto the fields (e.g. a taken NIT) or shown inline above the button. `logoField` is the logo
 * control, rendered between the fields and the button; the container owns what picking does
 * (stage a file on create, upload on edit). `renderRectorUsernamePreview` is the live
 * "Username auto-generado" box of the create form; it receives the rector's names and document.
 */
export default function InstitutionForm({
  initialValues,
  logoField,
  onInvalid,
  renderRectorUsernamePreview,
  ...submit
}: SubmitProps & {
  initialValues: InstitutionFormValues;
  logoField?: ReactNode;
  onInvalid?: () => void;
  renderRectorUsernamePreview?: (parts: UsernamePreviewParts) => ReactNode;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const isCreate = submit.mode === "create";

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      // Both schemas take the same input; only their outputs differ, and `onSubmit` re-parses.
      onSubmit: (isCreate
        ? createInstitutionFormSchema
        : editInstitutionFormSchema) as typeof createInstitutionFormSchema,
    },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        if (submit.mode === "create") {
          await submit.onSubmit(toCreateInstitutionInput(createInstitutionFormSchema.parse(value)));
        } else {
          await submit.onSubmit(toUpdateInstitutionInput(editInstitutionFormSchema.parse(value)));
        }
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: INSTITUTION_FORM_FIELDS,
          fieldByMessage: PROFILE_FIELD_BY_MESSAGE,
          fallback: isCreate
            ? INSTITUTION_CREATE_FALLBACK_MESSAGE
            : INSTITUTION_UPDATE_FALLBACK_MESSAGE,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <form
      noValidate
      aria-label={isCreate ? "Nueva Institución" : "Editar Institución"}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Datos Institucionales</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup className="gap-4">
            <form.Field name="name">
              {(field) => (
                <FormField field={field} label="Nombre de la Institución *">
                  {(control) => (
                    <Input
                      {...control}
                      autoComplete="organization"
                      placeholder="Ej: Institución Educativa Simón Bolívar"
                    />
                  )}
                </FormField>
              )}
            </form.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="nit">
                {(field) => (
                  <FormField
                    field={field}
                    label="NIT"
                    description="Número de Identificación Tributaria"
                  >
                    {(control) => <Input {...control} placeholder="900.123.456-7" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="phone">
                {(field) => (
                  <FormField field={field} label="Teléfono">
                    {(control) => <Input {...control} type="tel" placeholder="(601) 234 5678" />}
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="email">
              {(field) => (
                <FormField field={field} label="Correo Electrónico">
                  {(control) => (
                    <Input
                      {...control}
                      type="email"
                      autoComplete="email"
                      placeholder="contacto@inst.edu.co"
                    />
                  )}
                </FormField>
              )}
            </form.Field>
            <form.Field name="address">
              {(field) => (
                <FormField field={field} label="Dirección">
                  {(control) => (
                    <Input {...control} placeholder="Calle 123 # 45-67, Barrio Centro" />
                  )}
                </FormField>
              )}
            </form.Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <form.Field name="municipality">
                {(field) => (
                  <FormField field={field} label="Municipio">
                    {(control) => <Input {...control} placeholder="Ej: Bogotá" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="department">
                {(field) => (
                  <FormField field={field} label="Departamento">
                    {(control) => <Input {...control} placeholder="Ej: Cundinamarca" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="academicYear">
                {(field) => (
                  <FormField field={field} label="Año Lectivo *">
                    {(control) => <Input {...control} inputMode="numeric" maxLength={4} />}
                  </FormField>
                )}
              </form.Field>
            </div>
            <form.Field name="resolution">
              {(field) => (
                <FormField field={field} label="Resolución de Aprobación">
                  {(control) => (
                    <Input {...control} placeholder="Resolución No. 1234 del 01/01/2025" />
                  )}
                </FormField>
              )}
            </form.Field>
          </FieldGroup>
          {logoField}
        </CardContent>
      </Card>

      {isCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Crear Administrador (Obligatorio)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              Requerido: Cada institución debe tener un administrador (Rector) que la gestione.
            </p>
            <fieldset className="flex flex-col gap-4">
              <legend className="mb-2 text-sm font-medium">Datos Básicos del Admin</legend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <form.Field name="rectorFirstName">
                  {(field) => (
                    <FormField field={field} label="Nombres *">
                      {(control) => <Input {...control} placeholder="Ej: Juan Carlos" />}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="rectorLastName">
                  {(field) => (
                    <FormField field={field} label="Apellidos *">
                      {(control) => <Input {...control} placeholder="Ej: Pérez García" />}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="rectorDocumentType">
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
                <form.Field name="rectorDocumentNumber">
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
                <form.Field name="rectorEmail">
                  {(field) => (
                    <FormField field={field} label="Email *">
                      {(control) => (
                        <Input
                          {...control}
                          type="email"
                          placeholder="rector@inst.edu.co"
                          autoComplete="off"
                        />
                      )}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="rectorPhone">
                  {(field) => (
                    <FormField field={field} label="Teléfono">
                      {(control) => <Input {...control} type="tel" placeholder="3001234567" />}
                    </FormField>
                  )}
                </form.Field>
              </FieldGroup>
            </fieldset>
            {renderRectorUsernamePreview ? (
              <form.Subscribe
                selector={(state) => ({
                  firstName: state.values.rectorFirstName,
                  lastName: state.values.rectorLastName,
                  documentNumber: state.values.rectorDocumentNumber,
                })}
              >
                {(parts) => renderRectorUsernamePreview(parts)}
              </form.Subscribe>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Contraseña inicial: Nº de documento. El username se genera automáticamente al escribir
              los datos.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {formError ? <AuthFormError message={formError} /> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isCreate
                ? isSubmitting
                  ? "Creando..."
                  : "Crear Institución con Admin"
                : isSubmitting
                  ? "Guardando..."
                  : "Actualizar Institución"}
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
