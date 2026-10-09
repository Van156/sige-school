import { Alert, AlertDescription, AlertTitle } from "@base-template/ui/components/alert";
import { buttonVariants } from "@base-template/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@base-template/ui/components/card";
import { FieldDescription, FieldGroup, FieldLabel } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@base-template/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { StandardSchemaV1 } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { AuthFormError } from "@/features/auth";
import { mapSubmitError } from "@/features/institution";
import FormField from "@/shared/components/form/form-field";
import PasswordInput from "@/shared/components/form/password-input";
import SubmitButton from "@/shared/components/form/submit-button";

import {
  countryOptions,
  createUserFormSchema,
  DOCUMENT_TYPE_OPTIONS,
  editUserFormSchema,
  GENDER_OPTIONS,
  USER_CREATE_FALLBACK,
  USER_FIELD_BY_MESSAGE,
  USER_FORM_FIELDS,
  USER_UPDATE_FALLBACK,
  type UserFormValues,
} from "../lib/user-form";
import { toAssignableRole, toRoleKind } from "../lib/user-roles";
import type { UsernamePreviewParts } from "../lib/username-preview";
import RoleBadge from "./role-badge";
import RoleSelect from "./role-select";

/**
 * USR-02 / USR-03 form (sige/03 §5.2, §5.3): personal data, contact data and the account (role,
 * and in edit mode the optional new password). Presentational: `onSubmit` performs the save and
 * rejects with the server error, which is mapped onto the fields (a taken document or email) or
 * shown inline above the button. Slots: `header` (e.g. the edit summary strip),
 * `renderUsernamePreview` (create mode) and `renderEmailStatus` receive the live values.
 */
export default function UserForm({
  mode,
  initialValues,
  onSubmit,
  onInvalid,
  header,
  renderUsernamePreview,
  renderEmailStatus,
}: {
  mode: "create" | "edit";
  initialValues: UserFormValues;
  onSubmit: (values: UserFormValues) => Promise<void>;
  onInvalid?: () => void;
  header?: ReactNode;
  renderUsernamePreview?: (parts: UsernamePreviewParts) => ReactNode;
  renderEmailStatus?: (email: string) => ReactNode;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const isCreate = mode === "create";

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      // Both schemas take `UserFormValues`; only their rules differ, and the container re-parses.
      onSubmit: validatorFor(mode),
    },
    onSubmitInvalid: () => onInvalid?.(),
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);
      try {
        await onSubmit(value);
      } catch (error) {
        const failure = mapSubmitError(error, {
          fields: USER_FORM_FIELDS,
          fieldByMessage: USER_FIELD_BY_MESSAGE,
          fallback: isCreate ? USER_CREATE_FALLBACK : USER_UPDATE_FALLBACK,
        });
        setFormError(failure.formError);
        formApi.setErrorMap({ onSubmit: { fields: failure.fieldErrors } });
      }
    },
  });

  return (
    <form
      noValidate
      aria-label={isCreate ? "Crear Nuevo Usuario" : "Editar Usuario"}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {isCreate ? "Nuevo Usuario" : "Datos del Usuario"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {header}
          {isCreate ? (
            <>
              <Callout title="Automático">
                El nombre de usuario se genera automáticamente. La contraseña inicial será el número
                de documento de identidad.
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

          <FormSection index={1} title="Información Personal">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <form.Field name="firstName">
                {(field) => (
                  <FormField
                    field={field}
                    label="Nombres *"
                    description="Nombre completo del usuario"
                  >
                    {(control) => (
                      <Input {...control} autoComplete="off" placeholder="Ej: Juan Carlos" />
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="lastName">
                {(field) => (
                  <FormField field={field} label="Apellidos *">
                    {(control) => (
                      <Input {...control} autoComplete="off" placeholder="Ej: Pérez García" />
                    )}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="documentType">
                {(field) => (
                  <FormField field={field} label="Tipo Documento">
                    {(control) => (
                      <NativeSelect {...control} className="w-full">
                        {DOCUMENT_TYPE_OPTIONS.map((option) => (
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
                  <FormField
                    field={field}
                    label="Nº Documento *"
                    description="Se usará como contraseña inicial"
                  >
                    {(control) => <Input {...control} autoComplete="off" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="birthDate">
                {(field) => (
                  <FormField field={field} label="Fecha Nacimiento">
                    {(control) => <Input {...control} type="date" />}
                  </FormField>
                )}
              </form.Field>
              <form.Field name="gender">
                {(field) => (
                  <FormField field={field} label="Género">
                    {(control) => (
                      <NativeSelect {...control} className="w-full">
                        {GENDER_OPTIONS.map((option) => (
                          <NativeSelectOption key={option.value} value={option.value}>
                            {option.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                )}
              </form.Field>
            </FieldGroup>
          </FormSection>

          <FormSection index={2} title="Información de Contacto">
            <FieldGroup className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="email">
                  {(field) => (
                    <FormField
                      field={field}
                      label="Correo Electrónico"
                      description={renderEmailStatus?.(field.state.value ?? "")}
                    >
                      {(control) => (
                        <Input
                          {...control}
                          type="email"
                          autoComplete="off"
                          placeholder="usuario@ejemplo.com (Opcional)"
                        />
                      )}
                    </FormField>
                  )}
                </form.Field>
                <form.Field name="phone">
                  {(field) => (
                    <FormField field={field} label="Teléfono / Celular">
                      {(control) => <Input {...control} type="tel" placeholder="3001234567" />}
                    </FormField>
                  )}
                </form.Field>
              </div>
              <form.Field name="address">
                {(field) => (
                  <FormField field={field} label="Dirección">
                    {(control) => (
                      <Input {...control} placeholder="Calle, Carrera, Número, Barrio" />
                    )}
                  </FormField>
                )}
              </form.Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <form.Field name="country">
                  {(field) => (
                    <FormField field={field} label="País">
                      {(control) => (
                        <NativeSelect {...control} className="w-full">
                          {countryOptions(field.state.value ?? "").map((option) => (
                            <NativeSelectOption key={option.value} value={option.value}>
                              {option.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      )}
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
                <form.Field name="municipality">
                  {(field) => (
                    <FormField field={field} label="Municipio">
                      {(control) => <Input {...control} placeholder="Ej: Bogotá" />}
                    </FormField>
                  )}
                </form.Field>
              </div>
            </FieldGroup>
          </FormSection>

          <FormSection
            index={3}
            title={isCreate ? "Información de la Cuenta" : "Cuenta y Seguridad"}
          >
            <FieldGroup className="gap-4">
              {isCreate ? (
                <form.Field name="role">
                  {(field) => (
                    <FormField
                      field={field}
                      label="Rol *"
                      description="Como admin, puedes crear coordinadores, profesores, estudiantes, acudientes y viewers. Root crea admins."
                    >
                      {(control) => (
                        <RoleSelect
                          id={control.id}
                          value={toAssignableRole(control.value) ?? ""}
                          onValueChange={(role) => field.handleChange(role)}
                          invalid={control["aria-invalid"]}
                          aria-describedby={control["aria-describedby"]}
                        />
                      )}
                    </FormField>
                  )}
                </form.Field>
              ) : (
                <>
                  <form.Subscribe selector={(state) => state.values.role}>
                    {(role) => (
                      <div className="flex flex-col gap-1.5">
                        <FieldLabel>Rol</FieldLabel>
                        <div>
                          <RoleBadge role={toRoleKind(role)} />
                        </div>
                        <FieldDescription>
                          El rol no se puede cambiar. Cree un usuario nuevo si necesita otro rol.
                        </FieldDescription>
                      </div>
                    )}
                  </form.Subscribe>
                  <form.Field name="newPassword">
                    {(field) => (
                      <FormField
                        field={field}
                        label="Nueva Contraseña (opcional)"
                        description="Dejar vacío para mantener la contraseña actual"
                      >
                        {(control) => <PasswordInput {...control} autoComplete="new-password" />}
                      </FormField>
                    )}
                  </form.Field>
                </>
              )}
            </FieldGroup>
            {isCreate ? (
              <Callout title="Seguridad">
                La contraseña inicial será el número de documento. El usuario deberá cambiarla
                obligatoriamente en su primer inicio de sesión.
              </Callout>
            ) : null}
          </FormSection>

          {formError ? <AuthFormError message={formError} /> : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <SubmitButton
                  isPending={isSubmitting}
                  pendingLabel={isCreate ? "Creando..." : "Guardando..."}
                >
                  {isCreate ? "✅ Crear Usuario" : "💾 Actualizar Usuario"}
                </SubmitButton>
                <Link to="/usuarios" className={buttonVariants({ variant: "outline" })}>
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

/** The schema of the mode, typed against the shared input shape so the compiler checks both. */
function validatorFor(mode: "create" | "edit"): StandardSchemaV1<UserFormValues, unknown> {
  return mode === "create" ? createUserFormSchema : editUserFormSchema;
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
