import { Callout } from "../../-components/callout";
import { SelectField, TextField } from "../../-components/form-fields";
import {
  BackButton,
  FormCard,
  FormLayout,
  HelpCard,
  HelpList,
  UsernamePreview,
} from "../../-components/form-layout";
import { InstitutionBanner } from "../../-components/institution-banner";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScreenPage } from "../../-components/scoped-page";
import { ROLE_LABEL } from "../../-lib/roles";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useIdParam } from "../../-lib/use-search-params";
import { generateUsername } from "../../-lib/usernames";
import {
  ROLE_DESCRIPTION_LONG,
  STAFF_DOC_TYPE_OPTIONS,
  blankToUndefined,
  isDocType,
  isRole,
  isValidEmail,
  newUserRecord,
  roleOptions,
} from "../../-lib/user-options";
import {
  REFERENCE_DATE,
  institutionStore,
  mockAction,
  useMockCollection,
  userStore,
} from "../../-mock";
import type { Institution } from "../../-mock/types";

interface Values {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  email: string;
  role: string;
}

const INITIAL: Values = {
  firstName: "",
  lastName: "",
  documentType: "CC",
  documentNumber: "",
  phone: "",
  email: "",
  role: "teacher",
};

/** Roles offered inside an institution: everything except root. */
const ROLE_OPTIONS = roleOptions([
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
]);

/** INS-05: root adds a user (typically an admin) to a given institution. */
export function InstitutionUserFormScreen() {
  const id = useIdParam();
  const institutions = useMockCollection(institutionStore);
  const institution = id === undefined ? undefined : institutions.find((entry) => entry.id === id);

  return (
    <ScreenPage
      screenId="INS-05"
      title={
        institution ? `Crear Usuario en ${institution.name}` : "Crear Usuario en la institución"
      }
      description={institution ? `Crear nuevo usuario para ${institution.name}` : undefined}
      back={
        <BackButton screenId="INS-04" search={id === undefined ? undefined : { id: String(id) }} />
      }
    >
      {institution ? (
        <InstitutionUserForm institution={institution} />
      ) : (
        <NotFoundBlock entity="Institución" feminine backScreenId="INS-01" />
      )}
    </ScreenPage>
  );
}

function InstitutionUserForm({ institution }: { institution: Institution }) {
  const userList = useMockCollection(userStore);
  const goTo = useGoToScreen();
  const back = { id: String(institution.id) };

  const form = useSimpleForm<Values>(INITIAL, (values) => {
    const errors: FormErrors<Values> = {};
    if (!values.firstName.trim()) errors.firstName = "Los nombres son obligatorios.";
    if (!values.lastName.trim()) errors.lastName = "Los apellidos son obligatorios.";
    if (values.documentNumber.trim().length < 5) {
      errors.documentNumber = "El documento debe tener al menos 5 dígitos.";
    }
    if (!isValidEmail(values.email)) errors.email = "Ingresa un correo válido.";
    return errors;
  });

  const username = generateUsername(
    form.values.firstName,
    form.values.lastName,
    form.values.documentNumber,
    new Set(userList.map((user) => user.username)),
  );

  const submit = form.handleSubmit((values) => {
    if (!isRole(values.role) || !isDocType(values.documentType)) return;
    userStore.add(
      newUserRecord({
        username,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        documentType: values.documentType,
        documentNumber: values.documentNumber.trim(),
        role: values.role,
        institutionId: institution.id,
        email: values.email.trim(),
        phone: blankToUndefined(values.phone),
        createdAt: REFERENCE_DATE,
      }),
    );
    mockAction("Usuario creado", `${username} · contraseña inicial: Nº de documento.`);
    goTo("INS-04", back);
  });

  return (
    <>
      <InstitutionBanner institution={institution} badge="Root Admin" />
      <FormLayout
        form={
          <FormCard
            title="Datos del Usuario"
            onSubmit={submit}
            submitLabel="Crear Usuario"
            cancelScreenId="INS-04"
            cancelSearch={back}
          >
            <Callout tone="info" title="Automático">
              El nombre de usuario se genera con la inicial del nombre + apellido + últimos 4
              dígitos del documento.
            </Callout>
            <UsernamePreview username={username} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nombres"
                required
                placeholder="Ej: Juan Carlos"
                {...form.bind("firstName")}
              />
              <TextField
                label="Apellidos"
                required
                placeholder="Ej: Pérez García"
                {...form.bind("lastName")}
              />
              <SelectField
                label="Tipo Documento"
                options={STAFF_DOC_TYPE_OPTIONS}
                {...form.bind("documentType")}
              />
              <TextField
                label="Nº Documento"
                required
                hint="Número de identificación"
                {...form.bind("documentNumber")}
              />
              <TextField
                label="Teléfono"
                type="tel"
                placeholder="3001234567"
                {...form.bind("phone")}
              />
              <TextField
                label="Email"
                required
                type="email"
                placeholder="admin@ejemplo.com"
                hint="Correo válido para notificaciones"
                {...form.bind("email")}
              />
            </div>
            <Callout tone="warning" title="Contraseña automática">
              La contraseña inicial será el número de documento ingresado arriba. El usuario deberá
              cambiarla en su primer inicio de sesión.
            </Callout>
            <SelectField
              label="Rol del Usuario"
              required
              options={ROLE_OPTIONS}
              hint={ROLE_DESCRIPTION_LONG[isRole(form.values.role) ? form.values.role : "teacher"]}
              {...form.bind("role")}
            />
          </FormCard>
        }
        help={
          <>
            <HelpCard title="Información">
              <HelpList
                items={[
                  "El username se genera automáticamente.",
                  "La contraseña inicial es el número de documento.",
                  "El acceso queda limitado a esta institución.",
                  "Deberá cambiar la contraseña en su primer inicio de sesión.",
                ]}
              />
            </HelpCard>
            <HelpCard title="Roles del Sistema">
              <ul className="flex flex-col gap-1.5">
                {(
                  [
                    "root",
                    "admin",
                    "coordinator",
                    "teacher",
                    "student",
                    "parent",
                    "viewer",
                  ] as const
                ).map((role) => (
                  <li key={role}>
                    <span className="font-medium text-foreground">{ROLE_LABEL[role]}:</span>{" "}
                    {ROLE_DESCRIPTION_LONG[role]}
                  </li>
                ))}
              </ul>
            </HelpCard>
          </>
        }
      />
    </>
  );
}
