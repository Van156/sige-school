import { Callout } from "../../-components/callout";
import { SelectField, TextField } from "../../-components/form-fields";
import {
  BackButton,
  FormCard,
  FormLayout,
  FormSection,
  HelpCard,
  HelpList,
  UsernamePreview,
} from "../../-components/form-layout";
import { NotFoundBlock } from "../../-components/not-found-block";
import { ScopedPage } from "../../-components/scoped-page";
import { ToneBadge } from "../../-components/tone-badge";
import {
  STUDENT_DOC_OPTIONS,
  STUDENT_STATUS_OPTIONS,
  campusOptions,
  gradeOptions,
  toStratum,
  toStudentStatus,
} from "../../-lib/school-options";
import { useGoToScreen } from "../../-lib/use-go-to-screen";
import { useSimpleForm, type FormErrors } from "../../-lib/use-form";
import { useSchool, type School } from "../../-lib/use-school";
import { useIdParam, useIntParam } from "../../-lib/use-search-params";
import { generateUsername } from "../../-lib/usernames";
import {
  GENDER_OPTIONS,
  blankToUndefined,
  isDocType,
  isValidEmail,
  newUserRecord,
  toGender,
} from "../../-lib/user-options";
import { REFERENCE_DATE, enrollStudents, mockAction, studentStore, userStore } from "../../-mock";
import type { AcademicStudent, Institution, User } from "../../-mock/types";

type Mode =
  | { kind: "new" }
  | { kind: "complete"; user: User }
  | { kind: "edit"; student: AcademicStudent; user: User };

const COPY = {
  new: {
    title: "Nuevo Estudiante",
    description: "Complete los datos para matricular un nuevo estudiante",
  },
  complete: {
    title: "Completar Perfil Académico",
    description: "Complete la información académica del estudiante",
  },
  edit: { title: "Editar Estudiante", description: "Modifica los datos del estudiante" },
} as const;

/**
 * STU-03: one form, three modes decided by the URL. New (no params) creates the user and the
 * profile; complete (`?user=`) adds the profile to an existing student account; edit (`?id=`)
 * updates both.
 */
export function StudentFormScreen() {
  const studentId = useIdParam();
  const userId = useIntParam("user");
  const kind = studentId !== undefined ? "edit" : userId !== undefined ? "complete" : "new";

  return (
    <ScopedPage
      screenId="STU-03"
      title={COPY[kind].title}
      description={COPY[kind].description}
      back={<BackButton screenId={kind === "complete" ? "USR-01" : "STU-01"} />}
      target="Estudiantes"
    >
      {(institution) => (
        <ModeLoader institution={institution} studentId={studentId} userId={userId} />
      )}
    </ScopedPage>
  );
}

function ModeLoader({
  institution,
  studentId,
  userId,
}: {
  institution: Institution;
  studentId?: number;
  userId?: number;
}) {
  const school = useSchool(institution.id);

  if (studentId !== undefined) {
    const student = school.students.find((entry) => entry.id === studentId);
    const user = student ? school.userOfStudent(student) : undefined;
    return student && user ? (
      <StudentForm
        key={`edit-${student.id}`}
        institution={institution}
        school={school}
        mode={{ kind: "edit", student, user }}
      />
    ) : (
      <NotFoundBlock entity="Estudiante" backScreenId="STU-01" />
    );
  }
  if (userId !== undefined) {
    const user = school.users.find(
      (entry) =>
        entry.id === userId && entry.role === "student" && entry.institutionId === institution.id,
    );
    const hasProfile = school.students.some((entry) => entry.userId === userId);
    return user && !hasProfile ? (
      <StudentForm
        key={`complete-${user.id}`}
        institution={institution}
        school={school}
        mode={{ kind: "complete", user }}
      />
    ) : (
      <NotFoundBlock entity="Usuario" backScreenId="STU-01" />
    );
  }
  return <StudentForm key="new" institution={institution} school={school} mode={{ kind: "new" }} />;
}

interface Values {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  birthDate: string;
  gender: string;
  address: string;
  campusId: string;
  gradeId: string;
  neighborhood: string;
  stratum: string;
  bloodType: string;
  eps: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  status: string;
}

function initialValues(mode: Mode): Values {
  const user = mode.kind === "new" ? undefined : mode.user;
  const student = mode.kind === "edit" ? mode.student : undefined;
  return {
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    documentType: user?.documentType ?? "TI",
    documentNumber: user?.documentNumber ?? "",
    phone: user?.phone ?? "",
    birthDate: user?.birthDate ?? "",
    gender: user?.gender ?? "",
    address: user?.address ?? "",
    campusId: student ? String(student.campusId) : "",
    gradeId: student?.gradeId ? String(student.gradeId) : "",
    neighborhood: student?.neighborhood ?? "",
    stratum: student?.stratum ? String(student.stratum) : "",
    bloodType: student?.bloodType ?? "",
    eps: student?.eps ?? "",
    guardianName: student?.guardianName ?? "",
    guardianPhone: student?.guardianPhone ?? "",
    guardianEmail: student?.guardianEmail ?? "",
    status: student?.status ?? "activo",
  };
}

function StudentForm({
  institution,
  school,
  mode,
}: {
  institution: Institution;
  school: School;
  mode: Mode;
}) {
  const goTo = useGoToScreen();
  const isEdit = mode.kind === "edit";
  const isComplete = mode.kind === "complete";
  const existingUser = mode.kind === "new" ? undefined : mode.user;

  const form = useSimpleForm<Values>(initialValues(mode), (values) => {
    const errors: FormErrors<Values> = {};
    if (!isComplete) {
      if (!values.firstName.trim()) errors.firstName = "El nombre es obligatorio.";
      if (!values.lastName.trim()) errors.lastName = "El apellido es obligatorio.";
      const document = values.documentNumber.trim();
      if (document.length < 5)
        errors.documentNumber = "El documento debe tener al menos 5 dígitos.";
      else if (
        !isEdit &&
        school.users.some(
          (user) => user.documentNumber === document && user.id !== existingUser?.id,
        )
      ) {
        errors.documentNumber = "Ya existe un usuario con este documento.";
      }
    }
    if (!values.campusId) errors.campusId = "Debes seleccionar una sede.";
    if (values.stratum.trim() && !toStratum(values.stratum)) {
      errors.stratum = "El estrato debe estar entre 1 y 6.";
    }
    const guardianEmail = values.guardianEmail.trim();
    if (guardianEmail && !isValidEmail(guardianEmail)) {
      errors.guardianEmail = "Ingresa un correo válido.";
    }
    return errors;
  });

  // The courses offered depend on the chosen campus (legacy client-side filter).
  const gradesOfCampus = school.grades.filter(
    (grade) => String(grade.campusId) === form.values.campusId,
  );
  const campusBinding = form.bind("campusId");

  const username =
    mode.kind === "new"
      ? generateUsername(
          form.values.firstName,
          form.values.lastName,
          form.values.documentNumber,
          new Set(school.users.map((user) => user.username)),
        )
      : "";

  const submit = form.handleSubmit((values) => {
    const profile = {
      institutionId: institution.id,
      campusId: Number(values.campusId),
      gradeId: gradesOfCampus.some((grade) => String(grade.id) === values.gradeId)
        ? Number(values.gradeId)
        : undefined,
      neighborhood: blankToUndefined(values.neighborhood),
      stratum: toStratum(values.stratum),
      bloodType: blankToUndefined(values.bloodType),
      eps: blankToUndefined(values.eps),
      guardianName: blankToUndefined(values.guardianName),
      guardianPhone: blankToUndefined(values.guardianPhone),
      guardianEmail: blankToUndefined(values.guardianEmail),
    };

    if (mode.kind === "edit") {
      userStore.update(mode.user.id, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: blankToUndefined(values.phone),
        birthDate: blankToUndefined(values.birthDate),
        gender: toGender(values.gender),
        address: blankToUndefined(values.address),
      });
      studentStore.update(mode.student.id, { ...profile, status: toStudentStatus(values.status) });
      mockAction("Estudiante actualizado", "Los cambios no se guardan en el prototipo.");
      goTo("STU-01");
      return;
    }

    let userId: number;
    if (mode.kind === "complete") {
      userId = mode.user.id;
    } else {
      if (!isDocType(values.documentType)) return;
      const created = userStore.add({
        ...newUserRecord({
          username,
          email: `${username}@estudiantes.colegiosanjose.edu.co`,
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          documentType: values.documentType,
          documentNumber: values.documentNumber.trim(),
          role: "student",
          institutionId: institution.id,
          phone: blankToUndefined(values.phone),
          createdAt: REFERENCE_DATE,
        }),
        birthDate: blankToUndefined(values.birthDate),
        gender: toGender(values.gender),
        address: blankToUndefined(values.address),
      });
      userId = created.id;
    }
    const student = studentStore.add({
      ...profile,
      userId,
      enrolledYear: institution.academicYear,
      status: "activo",
    });
    // "Completar Matrícula": a course chosen here enrolls the student in all its subjects.
    if (student.gradeId !== undefined) {
      enrollStudents(student.gradeId, [student.id], institution.academicYear);
    }
    mockAction(
      "Matrícula completada",
      student.gradeId !== undefined
        ? "El estudiante quedó inscrito en las materias de su grado."
        : "Asigna un grado desde Matrículas para inscribirlo en materias.",
    );
    goTo("STU-01");
  });

  return (
    <FormLayout
      form={
        <FormCard
          title="Datos del Estudiante"
          onSubmit={submit}
          submitLabel={isEdit ? "Actualizar" : "Completar Matrícula"}
          cancelScreenId={isComplete ? "USR-01" : "STU-01"}
        >
          {isComplete ? (
            <>
              <ExistingUserBanner user={mode.user} />
              <Callout tone="info" title="Información personal ya registrada">
                Nombre, documento, email y teléfono fueron creados. Ahora solo necesita completar la
                información académica y del acudiente.
              </Callout>
            </>
          ) : null}
          {mode.kind === "new" ? (
            <>
              <UsernamePreview username={username} />
              <Callout tone="info" title="Usuario automático">
                Se generará automáticamente. La contraseña inicial es el número de documento y debe
                cambiarse en el primer inicio de sesión.
              </Callout>
            </>
          ) : null}

          {isComplete ? null : (
            <FormSection index={1} title="Información del Usuario">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Nombre" required {...form.bind("firstName")} />
                <TextField label="Apellido" required {...form.bind("lastName")} />
                <SelectField
                  label="Tipo de Documento"
                  options={STUDENT_DOC_OPTIONS}
                  disabled={isEdit}
                  hint={isEdit ? "No editable después de crear" : undefined}
                  {...form.bind("documentType")}
                />
                <TextField
                  label="Número de Documento"
                  required
                  readOnly={isEdit}
                  {...form.bind("documentNumber")}
                />
                <TextField label="Teléfono" type="tel" {...form.bind("phone")} />
                <TextField label="Fecha de Nacimiento" type="date" {...form.bind("birthDate")} />
                <SelectField
                  label="Género"
                  placeholder="Seleccionar..."
                  options={GENDER_OPTIONS}
                  {...form.bind("gender")}
                />
              </div>
              <TextField label="Dirección" {...form.bind("address")} />
            </FormSection>
          )}

          <FormSection index={isComplete ? 1 : 2} title="Información Académica">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Sede"
                required
                placeholder="Seleccionar sede..."
                options={campusOptions(school.campuses)}
                {...campusBinding}
                onValueChange={(value) => {
                  campusBinding.onValueChange(value);
                  form.set("gradeId", "");
                }}
              />
              <SelectField
                label="Grado"
                placeholder="Sin asignar"
                options={gradeOptions(gradesOfCampus)}
                {...form.bind("gradeId")}
              />
              <TextField
                label="Barrio / Vereda"
                placeholder="Ej: El Centro"
                {...form.bind("neighborhood")}
              />
              <TextField label="Estrato" type="number" min={1} max={6} {...form.bind("stratum")} />
              <TextField label="Tipo de Sangre" placeholder="Ej: O+" {...form.bind("bloodType")} />
              <TextField label="EPS" placeholder="Ej: Sanitas" {...form.bind("eps")} />
            </div>
          </FormSection>

          <FormSection index={isComplete ? 2 : 3} title="Información del Acudiente">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nombre del Acudiente" {...form.bind("guardianName")} />
              <TextField
                label="Teléfono del Acudiente"
                type="tel"
                {...form.bind("guardianPhone")}
              />
            </div>
            <TextField label="Email del Acudiente" type="email" {...form.bind("guardianEmail")} />
          </FormSection>

          {isEdit ? (
            <FormSection index={4} title="Estado del Estudiante">
              <SelectField
                label="Estado"
                options={STUDENT_STATUS_OPTIONS}
                {...form.bind("status")}
              />
            </FormSection>
          ) : null}
        </FormCard>
      }
      help={
        <HelpCard title="Información">
          <HelpList
            items={
              isEdit
                ? [
                    "El tipo y número de documento no se pueden modificar.",
                    "Cambiar el grado aquí no modifica las matrículas por materia.",
                    "Retirado o Graduado oculta al estudiante de la lista de activos.",
                  ]
                : [
                    "El username se genera con la inicial del nombre, el apellido y el documento.",
                    "La contraseña inicial es el número de documento.",
                    "Si eliges un grado, el estudiante se inscribe en todas sus materias.",
                    "Los acudientes con cuenta se vinculan después desde el perfil.",
                  ]
            }
          />
        </HelpCard>
      }
    />
  );
}

function ExistingUserBanner({ user }: { user: User }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[13px]">
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">
          {user.firstName} {user.lastName}
        </span>
        <span className="truncate text-muted-foreground">
          {user.username} | {user.documentType}: {user.documentNumber}
          {user.email ? ` | ${user.email}` : ""}
        </span>
      </div>
      <ToneBadge tone="success">Usuario Creado</ToneBadge>
    </div>
  );
}
