import { Button } from "@base-template/ui/components/button";
import { Callout } from "../../-components/callout";
import { SelectField, SwitchField, TextField } from "../../-components/form-fields";
import {
  BackButton,
  FormCard,
  FormLayout,
  FormSection,
  HelpCard,
  HelpList,
  UsernamePreview,
} from "../../-components/form-layout";
import { ScreenLinkButton } from "../../-components/link-button";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScreenPage } from "../../-components/scoped-page";
import { RoleBadge } from "../../-components/tone-badge";
import { formatDate, formatDateTime } from "../../-lib/format";
import { ROLE_LABEL } from "../../-lib/roles";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useRole } from "../../-lib/use-role";
import { useIdParam, useRolParam } from "../../-lib/use-search-params";
import { generateUsername } from "../../-lib/usernames";
import {
  COUNTRY_OPTIONS,
  DOC_TYPE_OPTIONS,
  GENDER_OPTIONS,
  ROLE_DESCRIPTION_LONG,
  assignableRoles,
  blankToUndefined,
  isDocType,
  isRole,
  isValidEmail,
  newUserRecord,
  roleOptions,
  toGender,
} from "../../-lib/user-options";
import {
  INSTITUTION_ID,
  REFERENCE_DATE,
  institutionStore,
  mockAction,
  studentStore,
  userStore,
  useMockCollection,
} from "../../-mock";
import type { Role, User } from "../../-mock/types";

interface Values {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  birthDate: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  department: string;
  municipality: string;
  role: string;
  institutionId: string;
  password: string;
  isActive: boolean;
}

const ALL_ROLES: readonly Role[] = [
  "root",
  "admin",
  "coordinator",
  "teacher",
  "student",
  "parent",
  "viewer",
];

function initialValues(user: User | undefined, presetRole: string): Values {
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    documentType: user?.documentType ?? "CC",
    documentNumber: user?.documentNumber ?? "",
    birthDate: user?.birthDate ?? "",
    gender: user?.gender ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    country: user?.country ?? "Colombia",
    department: user?.department ?? "",
    municipality: user?.municipality ?? "",
    role: user?.role ?? presetRole,
    institutionId: user?.institutionId ? String(user.institutionId) : "",
    password: "",
    isActive: user?.isActive ?? true,
  };
}

/** USR-02: create a user; `?rol=` preselects the role (coming from a filtered list). */
export function UserCreateScreen() {
  return (
    <ScreenPage
      screenId="USR-02"
      title="Crear Nuevo Usuario"
      description="Complete los datos para registrar un nuevo usuario en el sistema"
      actions={<BackButton screenId="USR-01" label="Volver a la Lista" />}
    >
      <UserForm />
    </ScreenPage>
  );
}

/** USR-03: edit a user by `?id=`. */
export function UserEditScreen() {
  const id = useIdParam();
  const role = useRole();
  const userList = useMockCollection(userStore);
  const user = id === undefined ? undefined : userList.find((entry) => entry.id === id);
  // Admin can only reach users of their own institution.
  const reachable = user && (role === "root" || user.institutionId === INSTITUTION_ID);

  return (
    <ScreenPage
      screenId="USR-03"
      title="Editar Usuario"
      description={
        user ? `Editando: ${user.username} - ${user.firstName} ${user.lastName}` : undefined
      }
      actions={<BackButton screenId="USR-01" label="Volver a la Lista" />}
    >
      {reachable ? (
        <UserForm key={user.id} user={user} />
      ) : (
        <NotFoundBlock entity="El usuario" backScreenId="USR-01" />
      )}
    </ScreenPage>
  );
}

function UserForm({ user }: { user?: User }) {
  const viewer = useRole();
  const isRoot = viewer === "root";
  const presetParam = useRolParam();
  const userList = useMockCollection(userStore);
  const studentList = useMockCollection(studentStore);
  const institutions = useMockCollection(institutionStore);
  const goTo = useGoToScreen();
  const isEdit = user !== undefined;
  const studentProfile = user ? studentList.find((entry) => entry.userId === user.id) : undefined;

  const allowedRoles = assignableRoles(viewer);
  const presetRole =
    presetParam && isRole(presetParam) && allowedRoles.includes(presetParam)
      ? presetParam
      : "teacher";

  const form = useSimpleForm<Values>(initialValues(user, presetRole), (values) => {
    const errors: FormErrors<Values> = {};
    if (!values.firstName.trim()) errors.firstName = "Los nombres son obligatorios.";
    if (!values.lastName.trim()) errors.lastName = "Los apellidos son obligatorios.";
    if (values.documentNumber.trim().length < 5) {
      errors.documentNumber = "El documento debe tener al menos 5 dígitos.";
    }
    const email = values.email.trim();
    if (email) {
      if (!isValidEmail(email)) errors.email = "Ingresa un correo válido.";
      else if (userList.some((other) => other.id !== user?.id && other.email === email)) {
        errors.email = "Este correo ya está registrado.";
      }
    }
    if (values.password && values.password.length < 6) {
      errors.password = "La contraseña debe tener al menos 6 caracteres.";
    }
    return errors;
  });

  const username = isEdit
    ? user.username
    : generateUsername(
        form.values.firstName,
        form.values.lastName,
        form.values.documentNumber,
        new Set(userList.map((entry) => entry.username)),
      );

  const submit = form.handleSubmit((values) => {
    if (!isDocType(values.documentType)) return;
    const role = isRole(values.role) ? values.role : "teacher";
    const institutionId = isRoot
      ? values.institutionId
        ? Number(values.institutionId)
        : undefined
      : INSTITUTION_ID;
    const personal = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      documentType: values.documentType,
      documentNumber: values.documentNumber.trim(),
      birthDate: blankToUndefined(values.birthDate),
      gender: toGender(values.gender),
      email: blankToUndefined(values.email),
      phone: blankToUndefined(values.phone),
      address: blankToUndefined(values.address),
      country: blankToUndefined(values.country),
      department: blankToUndefined(values.department),
      municipality: blankToUndefined(values.municipality),
    };

    if (user) {
      userStore.update(user.id, {
        ...personal,
        ...(isRoot ? { role, institutionId } : {}),
        ...(user.role === "root" ? {} : { isActive: values.isActive }),
        ...(values.password ? { mustChangePassword: true } : {}),
      });
      mockAction("Usuario actualizado", "Los cambios no se guardan en el prototipo.");
    } else {
      const created = userStore.add({
        ...newUserRecord({
          username,
          firstName: personal.firstName,
          lastName: personal.lastName,
          documentType: personal.documentType,
          documentNumber: personal.documentNumber,
          role,
          institutionId,
          email: personal.email,
          phone: personal.phone,
          createdAt: REFERENCE_DATE,
        }),
        birthDate: personal.birthDate,
        gender: personal.gender,
        address: personal.address,
        country: personal.country,
        department: personal.department,
        municipality: personal.municipality,
      });
      if (role === "student") {
        // A student account is only half a student: continue with the academic profile (STU-03).
        mockAction("Usuario creado", `${username} · completa su perfil académico.`);
        goTo("STU-03", { user: String(created.id) });
        return;
      }
      mockAction("Usuario creado", `${username} · contraseña inicial: Nº de documento.`);
    }
    goTo("USR-01");
  });

  const roleChoices = isEdit && !isRoot ? roleOptions(ALL_ROLES) : roleOptions(allowedRoles);
  const selectedRole = isRole(form.values.role) ? form.values.role : "teacher";

  return (
    <FormLayout
      form={
        <FormCard
          title={isEdit ? "Datos del Usuario" : "Nuevo Usuario"}
          onSubmit={submit}
          submitLabel={isEdit ? "Actualizar Usuario" : "Crear Usuario"}
          cancelScreenId="USR-01"
        >
          {isEdit ? (
            <SummaryStrip user={user} />
          ) : (
            <>
              <Callout tone="info" title="Automático">
                El nombre de usuario se genera automáticamente. La contraseña inicial será el número
                de documento de identidad.
              </Callout>
              <UsernamePreview username={username} />
            </>
          )}
          <FormSection index={1} title="Información Personal">
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
                options={DOC_TYPE_OPTIONS}
                {...form.bind("documentType")}
              />
              <TextField
                label="Nº Documento"
                required
                hint="Se usará como contraseña inicial"
                {...form.bind("documentNumber")}
              />
              <TextField label="Fecha Nacimiento" type="date" {...form.bind("birthDate")} />
              <SelectField
                label="Género"
                placeholder="No especificado"
                options={GENDER_OPTIONS}
                {...form.bind("gender")}
              />
            </div>
          </FormSection>
          <FormSection index={2} title="Información de Contacto">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Correo Electrónico"
                type="email"
                placeholder="usuario@ejemplo.com (Opcional)"
                {...form.bind("email")}
              />
              <TextField
                label="Teléfono / Celular"
                type="tel"
                placeholder="3001234567"
                {...form.bind("phone")}
              />
            </div>
            <TextField
              label="Dirección"
              placeholder="Calle, Carrera, Número, Barrio"
              {...form.bind("address")}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="País" options={COUNTRY_OPTIONS} {...form.bind("country")} />
              <TextField
                label="Departamento"
                placeholder="Ej: Cundinamarca"
                {...form.bind("department")}
              />
              <TextField
                label="Municipio"
                placeholder="Ej: Bogotá"
                {...form.bind("municipality")}
              />
            </div>
          </FormSection>
          <FormSection index={3} title={isEdit ? "Cuenta y Seguridad" : "Información de la Cuenta"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Rol"
                required
                options={roleChoices}
                disabled={isEdit && !isRoot}
                hint={
                  isEdit && !isRoot
                    ? "Solo root puede cambiar el rol"
                    : !isRoot
                      ? "Como admin, puedes crear coordinadores, profesores, estudiantes, acudientes y viewers. Root crea admins."
                      : ROLE_DESCRIPTION_LONG[selectedRole]
                }
                {...form.bind("role")}
              />
              {isRoot ? (
                <SelectField
                  label="Institución"
                  placeholder="Sin institución asignada"
                  options={institutions.map((institution) => ({
                    value: String(institution.id),
                    label: institution.name,
                  }))}
                  {...form.bind("institutionId")}
                />
              ) : null}
            </div>
            {isEdit ? (
              <TextField
                label="Nueva Contraseña (opcional)"
                type="password"
                autoComplete="new-password"
                hint="Dejar vacío para mantener la contraseña actual (mínimo 6 caracteres)"
                {...form.bind("password")}
              />
            ) : (
              <Callout tone="warning" title="Seguridad">
                La contraseña inicial será el número de documento. El usuario deberá cambiarla
                obligatoriamente en su primer inicio de sesión.
              </Callout>
            )}
            {isEdit && user.role !== "root" ? (
              <SwitchField
                label={form.values.isActive ? "Usuario activo" : "Usuario inactivo"}
                {...form.bind("isActive")}
              />
            ) : null}
          </FormSection>
        </FormCard>
      }
      help={
        isEdit ? (
          <>
            <HelpCard title="Acciones Rápidas">
              <div className="flex flex-col gap-2">
                {user.role === "student" ? (
                  studentProfile ? (
                    <ScreenLinkButton screenId="STU-02" search={{ id: String(studentProfile.id) }}>
                      Ver Perfil Académico
                    </ScreenLinkButton>
                  ) : (
                    <ScreenLinkButton screenId="STU-03" search={{ user: String(user.id) }}>
                      Completar Perfil Académico
                    </ScreenLinkButton>
                  )
                ) : null}
                <Button
                  variant="outline"
                  disabled
                  title="Funcionalidad no disponible - El usuario puede cambiar su contraseña desde su perfil"
                >
                  Resetear Contraseña
                </Button>
                <Button variant="outline" disabled>
                  {user.isActive ? "Deshabilitar Usuario" : "Habilitar Usuario"}
                </Button>
              </div>
            </HelpCard>
            <HelpCard title="Información">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                <dt>Username</dt>
                <dd className="font-mono text-foreground">{user.username}</dd>
                <dt>Email</dt>
                <dd className="break-all text-foreground">{user.email ?? "-"}</dd>
                <dt>Documento</dt>
                <dd className="text-foreground">
                  {user.documentNumber
                    ? `${user.documentType}: ${user.documentNumber}`
                    : "No registrado"}
                </dd>
                <dt>Último acceso</dt>
                <dd className="text-foreground">
                  {user.lastLogin ? formatDateTime(user.lastLogin) : "Nunca"}
                </dd>
                <dt>Cambió contraseña</dt>
                <dd className="text-foreground">{user.mustChangePassword ? "Pendiente" : "Sí"}</dd>
              </dl>
            </HelpCard>
          </>
        ) : (
          <>
            <HelpCard title="¿Cómo funciona?">
              <HelpList
                items={[
                  "El username se genera con la inicial del nombre, el apellido y el documento.",
                  "La contraseña inicial es el número de documento.",
                  "En el primer inicio de sesión se obliga a cambiarla.",
                ]}
              />
            </HelpCard>
            <HelpCard title="Roles del Sistema">
              <ul className="flex flex-col gap-1.5">
                {ALL_ROLES.map((item) => (
                  <li key={item}>
                    <span className="font-medium text-foreground">{ROLE_LABEL[item]}:</span>{" "}
                    {ROLE_DESCRIPTION_LONG[item]}
                  </li>
                ))}
              </ul>
            </HelpCard>
          </>
        )
      }
    />
  );
}

function SummaryStrip({ user }: { user: User }) {
  return (
    <div className="grid gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[13px] sm:grid-cols-4">
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Username</span>
        <span className="font-mono">{user.username}</span>
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">Email</span>
        <span className="truncate">{user.email ?? "-"}</span>
      </div>
      <div className="flex flex-col items-start">
        <span className="text-xs text-muted-foreground">Rol</span>
        <RoleBadge role={user.role} />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">Creado</span>
        <span>{formatDate(user.createdAt)}</span>
      </div>
    </div>
  );
}
