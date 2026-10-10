# Spec: SIGE — Students and Guardians (STU)

- **Status:** Approved (product owner accepted every recommended default on 2026-10-07)
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query + Form (web), Drizzle + Postgres, `exceljs` (`.xlsx`), `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.3 scope, §5.2 `student` / `student_guardian`, §5.3 R2.8–R2.10, R2.16, §6.7 imports, OD-18, OD-21), [`01-auth-and-dashboards.md`](./01-auth-and-dashboards.md) (`person`, `ScopePolicy`), [`02-institution.md`](./02-institution.md) (campuses, courses), [`03-users.md`](./03-users.md) (`provisionUser`, `import_job`, import helper), [`04-scheduling.md`](./04-scheduling.md) (enrollment routine, `schedule.get`), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/students/*`, `-mock/school-actions.ts` (`deleteStudent`, `enrollStudents`), `-lib/usernames.ts`. Inventory §3.6, F4. Requirement ids: `STU-R<n>`. Phase P4.

## 1. Objective and scope

The student academic profile and its guardians: the three admission paths of F4 (form, "complete profile" for a pre-created login, Excel import), the student list with scope-aware access, the profile page, guardian links, and the student picker that every student-linked screen of modules 06–13 reuses.

### In scope

| Screen | Title                                                                   | Roles                         | Real route                                                                                 |
| ------ | ----------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------ |
| STU-01 | "Gestión de Estudiantes"                                                | R, A, C; T read (own courses) | `/estudiantes`                                                                             |
| STU-02 | "Perfil del Estudiante"                                                 | R, A, C; T read (own courses) | `/estudiantes/$studentId`                                                                  |
| STU-03 | "Nuevo Estudiante" / "Completar Perfil Académico" / "Editar Estudiante" | R, A, C                       | `/estudiantes/nuevo`, `/estudiantes/completar/$personId`, `/estudiantes/$studentId/editar` |
| STU-04 | "Asignar Acudientes"                                                    | R, A, C                       | `/estudiantes/$studentId/acudientes`                                                       |
| STU-05 | "Cargar Estudiantes desde Excel"                                        | R, A, C                       | `/estudiantes/importar`                                                                    |

Also in scope: `student` and `student_guardian` tables; `student.pick` (shared picker); the "Perfiles Académicos Incompletos" table; the effect of admission on enrollments.

### Out of scope

- Login creation rules, usernames, passwords (module 03 `provisionUser`); students are provisioned with initial password = document number (the legacy `estudiante123` is not reproduced, foundation §2).
- Enrollment screens (module 04), observations, grades, report cards (modules 06–09), photos (OD-12).
- Students without a login (OD-18) and year rollover / promotion (OD-14).

## 2. Data

Tables per foundation §5.2 and R2.1–R2.6.

### 2.1 `student`

| Column                                              | Type / constraint                                                                                                                                                                                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                | text PK (UUID); `unique(organization_id, id)`                                                                                                                                                                                                                              |
| `person_id`                                         | text not null, `unique`; FK `(organization_id, person_id) → person`; the person must have member role `student` (service check, R2.16)                                                                                                                                     |
| `campus_id`                                         | text not null; FK `(organization_id, campus_id) → campus`                                                                                                                                                                                                                  |
| `course_id`                                         | text null; composite FK `(organization_id, campus_id, course_id) → course(organization_id, campus_id, id)` so the course always belongs to the student's campus (needs `unique(organization_id, campus_id, id)` on `course`, added in the same migration set as module 02) |
| `neighborhood`                                      | text null, ≤ 100 ("Barrio / Vereda")                                                                                                                                                                                                                                       |
| `stratum`                                           | smallint null, `check (stratum between 1 and 6)`                                                                                                                                                                                                                           |
| `blood_type`                                        | text null, ≤ 5                                                                                                                                                                                                                                                             |
| `eps`                                               | text null, ≤ 100                                                                                                                                                                                                                                                           |
| `guardian_name`, `guardian_phone`, `guardian_email` | text null, ≤ 150 / ≤ 30 / ≤ 100 (contact fallback independent of `student_guardian`, foundation §5.2)                                                                                                                                                                      |
| `enrolled_year`                                     | text not null (the institution's current academic year at creation)                                                                                                                                                                                                        |
| `status`                                            | enum `student_status`: `activo` (default) \| `retirado` \| `graduado`                                                                                                                                                                                                      |
| `created_at`, `updated_at`                          | timestamptz                                                                                                                                                                                                                                                                |

Indexes: `(organization_id, status)`, `(organization_id, course_id)`, `(organization_id, campus_id)`, unique `(person_id)`.

### 2.2 `student_guardian`

`guardian_person_id`, `student_id` (cascade from `student`), `relationship` enum `guardian_relationship` (`Acudiente`, `Padre`, `Madre`, `Tío/a`, `Abuelo/a`, `Hermano/a`, `Otro`), `created_at`. `unique(guardian_person_id, student_id)`; index `(organization_id, student_id)` and `(organization_id, guardian_person_id)`. The guardian must hold member role `parent` (service check). A student may have many guardians and a guardian many students.

Migration: enums, both tables, the extra unique on `course`. No data backfill.

## 3. API

Router `routers/sige/student.ts`: `studentRouter`, `guardianRouter`. All `sigeProcedure.use(requirePermission(...))`; row scope through `context.scope` (teacher: students of own courses, OD-21); out-of-scope or other-tenant ids → `NOT_FOUND` (R1.15). Lists use the shared list contract (R3.8). Errors per R3.5.

### 3.1 Procedures

| Procedure                | Permission                                                     | Input                                                                                                                                                                                                                                           | Output                                                                                                       | Notes                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `student.list`           | `student:read`                                                 | list input (`student-list-config.ts`: sort `name`, `document`, `course`, `campus`, `status`; filters `name` text (name, document or guardian name), `campusId` select, `courseId` select, `status` select `activo` \| `retirado` \| `graduado`) | `{ rows: StudentRow[], total }`                                                                              | default sort name; the web sends `status = activo` by default; scope-filtered                                                                                                                    |
| `student.listIncomplete` | `student:create`                                               | list input (sort `name`, `createdAt`; filter `name` text)                                                                                                                                                                                       | `{ rows: { personId, name, documentType, documentNumber, username, email: string \| null }[], total }`       | persons with member role `student` and no `student` row                                                                                                                                          |
| `student.getIncomplete`  | `student:create`                                               | `{ personId }`                                                                                                                                                                                                                                  | the `listIncomplete` row                                                                                     | STU-03 complete banner (added in P4 T10); unknown, non-student or completed person → `NOT_FOUND` "El usuario no existe."                                                                         |
| `student.get`            | `student:read`                                                 | `{ id }`                                                                                                                                                                                                                                        | `StudentDetail`                                                                                              | `NOT_FOUND` when outside scope                                                                                                                                                                   |
| `student.pick`           | any of `student:read`, `portal:read_self`, `portal:read_child` | `{ courseId?: string, search?: string, limit?: number (≤ 100, default 50) }`                                                                                                                                                                    | `{ id, name, document, courseId: string \| null, courseName: string \| null, status }[]`                     | scope-filtered: staff all/own, student self, parent linked children; used by every per-student switcher (GRD-08, ATT-02, OBS-05, ACH-02, RPT-02/03, MET-07)                                      |
| `student.filterOptions`  | `student:read`                                                 | –                                                                                                                                                                                                                                               | `{ campuses: { id, name }[], courses: { id, name, campusId }[] }`                                            | STU-01 "Filtrar por sede" / "Filtrar por grado": distinct campuses and current courses of the students in the caller's scope (any status); the teacher source, since teachers lack `course:read` |
| `student.create`         | `student:create`                                               | `studentCreateInput` (below)                                                                                                                                                                                                                    | `{ student: StudentDetail, username: string, enrolled: { created: number, overCapacity: boolean } \| null }` | provisions the login (role `student`, module 03), inserts the profile, enrolls when a course is given                                                                                            |
| `student.complete`       | `student:create`                                               | `{ personId } & studentAcademicInput`                                                                                                                                                                                                           | same as `student.create` minus `username`                                                                    | person must be a `student`-role person without a profile; personal data untouched                                                                                                                |
| `student.update`         | `student:update`                                               | `{ id } & studentEditInput` (personal + academic + `status`)                                                                                                                                                                                    | `StudentDetail`                                                                                              | document type/number immutable; never touches enrollments (STU-R4)                                                                                                                               |
| `student.delete`         | `student:delete`                                               | `{ id }`                                                                                                                                                                                                                                        | `{ deleted: true }`                                                                                          | empty profile only (STU-R7); also removes guardian links and the login                                                                                                                           |
| `student.importPreview`  | `student:import`                                               | `{ file: File }` (`.xlsx`, ≤ 10 MB, ≤ 2,000 rows)                                                                                                                                                                                               | `{ total, valid, invalid, rows: PreviewRow[] (first 50), errors: { row, message }[] (first 200) }`           | no writes                                                                                                                                                                                        |
| `student.importStart`    | `student:import`                                               | `{ file: File }`                                                                                                                                                                                                                                | `{ jobId }`                                                                                                  | background job of kind `students` (module 03 §2.1, USR-R12); poll `importJob.get`                                                                                                                |
| `student.importTemplate` | `student:import`                                               | –                                                                                                                                                                                                                                               | `File` (`plantilla-estudiantes.xlsx`)                                                                        | header row, one example row                                                                                                                                                                      |
| `guardian.candidates`    | `student:guardians`                                            | `{ studentId, search?: string, limit?: number (≤ 50) }`                                                                                                                                                                                         | `{ personId, name, username, document }[]`                                                                   | active `parent` persons not yet linked to the student                                                                                                                                            |
| `guardian.link`          | `student:guardians`                                            | `{ studentId, guardianPersonId, relationship }`                                                                                                                                                                                                 | `GuardianLink`                                                                                               | STU-R6                                                                                                                                                                                           |
| `guardian.unlink`        | `student:guardians`                                            | `{ studentId, guardianPersonId }`                                                                                                                                                                                                               | `{ deleted: true }`                                                                                          |                                                                                                                                                                                                  |

```ts
type StudentRow = {
  id: string; personId: string; name: string; documentType: string; documentNumber: string;
  courseId: string | null; courseName: string | null; campusId: string; campusName: string;
  status: "activo" | "retirado" | "graduado"; guardianName: string | null;
};
type StudentDetail = StudentRow & {
  username: string; email: string | null; phone: string | null;       // email null when placeholder
  birthDate: string | null; gender: "M" | "F" | "Otro" | null; address: string | null;
  neighborhood: string | null; stratum: number | null; bloodType: string | null; eps: string | null;
  guardianPhone: string | null; guardianEmail: string | null; enrolledYear: string;
  guardians: GuardianLink[];
};
type GuardianLink = { guardianPersonId: string; name: string; username: string; relationship: string;
                      email: string | null; phone: string | null };
const studentAcademicInput = z.object({
  campusId, courseId: z.string().nullable(), neighborhood?, stratum?: int 1..6, bloodType?, eps?,
  guardianName?, guardianPhone?, guardianEmail?,
});
const studentCreateInput = studentAcademicInput.extend({
  firstName, lastName, documentType: z.enum(["TI", "RC", "CC"]), documentNumber, phone?, birthDate?, gender?, address?,
});
// studentEditInput = personal (names, phone, birthDate, gender, address) + academic + status
```

The picker is the single source for "which student" on student-scoped screens (R1.16): the web resolves the default (student: self; parent: first child; staff: none until chosen) from it and passes `studentId` to the datum procedures of other modules.

### 3.2 Audit events (foundation §6.9)

| Operation                                | Action                                  | Metadata                                                                                                                                                                                |
| ---------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `student.create` / `complete` / `update` | `student.created` / `student.updated`   | `{ mode, changed[] }`; the login provisioning also writes `user.created`; changes of `courseId`, `campusId`, guardian text fields are listed in `changed` (action names added, G-STU-1) |
| status change (in `update`)              | `student.status_changed`                | `{ from, to }`                                                                                                                                                                          |
| import (once per job)                    | `student.imported`                      | `{ jobId, total, imported, skipped }`                                                                                                                                                   |
| `student.delete`                         | `student.deleted`                       | name and document snapshot (action added, G-STU-1)                                                                                                                                      |
| `guardian.link` / `unlink`               | `guardian.linked` / `guardian.unlinked` | `{ studentId, guardianPersonId, relationship }`                                                                                                                                         |

## 4. Business rules and validation

Messages verbatim from the prototype (`student-form-screen.tsx`, `students-import-screen.tsx`, `assign-guardians-screen.tsx`).

### 4.1 Field rules (STU-03)

| Field                   | Rule                                                 | Message                                                                                    |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `firstName`, `lastName` | required (new and edit; not shown in complete mode)  | "El nombre es obligatorio." / "El apellido es obligatorio."                                |
| `documentNumber`        | ≥ 5 chars; unique per institution (new)              | "El documento debe tener al menos 5 dígitos." / "Ya existe un usuario con este documento." |
| `documentType`          | `TI` (default), `RC`, `CC`; immutable after creation | hint "No editable después de crear"                                                        |
| `campusId`              | required, active campus                              | "Debes seleccionar una sede."                                                              |
| `courseId`              | optional; must belong to the chosen campus           | "El grado no pertenece a la sede seleccionada."                                            |
| `stratum`               | empty or integer 1–6                                 | "El estrato debe estar entre 1 y 6."                                                       |
| `guardianEmail`         | empty or valid                                       | "Ingresa un correo válido."                                                                |
| `birthDate`             | empty, not in the future                             | "La fecha de nacimiento no puede ser futura."                                              |

### 4.2 Behavioural rules

- STU-R1 **Scope.** Teachers read only students of courses where they have an active/temporal offering or are director (`ScopePolicy.studentWhere()`); the list, picker and detail all apply it. Management roles see all. Deactivating the teacher's assignment removes the student from their view.
- STU-R2 **Three admission paths** (F4). A: STU-03 "new" provisions the login (`provisionUser`, role `student`, password = document, forced change) and inserts the profile in one operation; failure after the login compensates by deleting it (R1.18). B: USR-02 with role `student` creates only the login; it appears in "Perfiles Académicos Incompletos" and STU-03 "complete" inserts the profile. C: STU-05 import.
- STU-R3 **Admission enrolls.** When `courseId` is set on create, complete or import, the same routine as SCH-02 runs inside the transaction (module 04 SCH-R5): one `activa` enrollment per offering of the course for the course's year. Over capacity is a warning here (`enrolled.overCapacity`, toast "El grado supera su capacidad máxima ({n} estudiantes)."), never a block. Without a course the toast reads "Asigna un grado desde Matrículas para inscribirlo en materias."; with one, "El estudiante quedó inscrito en las materias de su grado." (title "Matrícula completada").
- STU-R4 **Edit never moves enrollments.** `student.update` may change campus and course; existing enrollments stay (foundation R2.8, module 04 SCH-R7: they show as "Grado anterior"). The form shows the help text "Cambiar el grado no modifica las matrículas existentes. Use Matrículas para inscribir al estudiante en el nuevo grado." when the course changes. Changing the campus clears the course unless the course belongs to the new campus.
- STU-R5 **Status.** `activo` → `retirado` or `graduado` removes the student from active lists, grade and attendance sheets, metrics, alert and achievement scans (R2.10) but keeps all history and the login (OQ-STU-1). `student.status_changed` is audited. Reactivation (`retirado` → `activo`) is allowed.
- STU-R6 **Guardian links.** The guardian must be an active person with role `parent`: "El usuario seleccionado no es un acudiente."; duplicate: "Este acudiente ya está vinculado a este estudiante."; none chosen (client): "Selecciona un acudiente." Guardians are created in USR-02 (module 03); STU-04 only links. The text fields `guardianName/Phone/Email` are a separate "Acudiente Principal" contact and never create links or accounts.
- STU-R7 **Delete** only an empty profile: no enrollments, grade records, attendance, observations, report cards, alerts or achievements. Otherwise `HAS_DEPENDENTS` "El estudiante tiene matrículas, notas o asistencia registradas." (prototype copy; the check covers every referencing table). A successful delete removes guardian links, the `student` row and the login (`person`, `member`, `user`) in compensating order; guardians' accounts are untouched.
- STU-R8 **Import columns** (inventory STU-05; header row, case and accent insensitive; singular and plural names accepted for `nombre`/`apellido`):

  | Column                                                 | Required | Notes                                                                                     |
  | ------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------- |
  | `nombre`, `apellido`                                   | yes      |                                                                                           |
  | `documento`                                            | yes      | becomes the initial password                                                              |
  | `tipo_documento`                                       | no       | TI (default), RC, CC                                                                      |
  | `fecha_nacimiento`                                     | no       | `yyyy-mm-dd` or `dd/mm/yyyy` or an Excel date                                             |
  | `genero`                                               | no       | M, F, Otro (also Masculino, Femenino)                                                     |
  | `grado`                                                | no       | course name in the current academic year; with `sede` it disambiguates; enrolls as STU-R3 |
  | `sede`                                                 | no       | campus name or code; default = the course's campus, else the main campus                  |
  | `acudiente`, `telefono_acudiente`, `email_acudiente`   | no       | fill the "Acudiente Principal" text fields only                                           |
  | `direccion`, `barrio`, `estrato`, `tipo_sangre`, `eps` | no       |                                                                                           |

  Row messages (prefixed "Fila {n}: "): "Falta el documento.", "Falta el nombre.", "Falta el apellido.", "Ya existe un estudiante con este documento.", "Ya existe un usuario con este documento.", `Tipo de documento inválido "{x}".`, `El grado "{x}" no existe.`, `El grado "{x}" es ambiguo; indique la sede.`, `La sede "{x}" no existe.`, "El estrato debe estar entre 1 y 6.", `Género inválido "{x}".`, "Ingresa un correo válido.", `El documento "{x}" está repetido en el archivo.` Existing documents are skipped and reported (R3.21). Results: "{n} estudiantes importados exitosamente"; card "Errores ({m})" listing the first 10 and "... y {k} errores más"; limits and file-type errors as USR-R12 ("Solo se permiten archivos Excel (.xlsx).", "No se seleccionó ningún archivo.").

- STU-R9 **Username and email.** Student logins use the standard generated username (module 03); without an email the placeholder of OD-1 is used (the prototype's invented `@estudiantes…` address is not reproduced). The guardian email field is contact data only.
- STU-R10 **Phase dependency.** STU-03/05 may enroll only when module 04 enrollment exists; until then `courseId` is stored without enrollments and `enrolled` is `null`.

## 5. Web

Feature folder `apps/web/src/features/students`; thin routes under `routes/_auth/_org/estudiantes/`; components ported from the prototype screens. Lists use the shared server-driven `SimpleListTable`; forms use TanStack Form with the shared zod schemas. Every screen has loading, error-with-retry, empty and not-found states (a bad or out-of-scope id shows `NotFoundBlock` "Estudiante" with a back link).

### 5.1 STU-01 `/estudiantes`

Header "Gestión de Estudiantes" / "Administra los estudiantes de la institución"; actions "Cargar Excel" (→ STU-05, `student:import`), "Nuevo Estudiante" (→ STU-03, `student:create`). Card "Lista de Estudiantes" (chip "{n} estudiantes"). Toolbar: text filter placeholder "Buscar por nombre, documento o acudiente"; filters "Filtrar por sede" (Todas), "Filtrar por grado" (Todos; options of the chosen campus), "Filtrar por estado" (Activos [default], Retirados, Graduados, Todos); "Limpiar". URL-stateful (data-table spec). Columns:

| Column       | Content                                                                                                                                                                                                                   | Sort |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| "Estudiante" | full name + "Acudiente: {nombre}" small                                                                                                                                                                                   | yes  |
| "Documento"  | badge "{tipo} {número}"                                                                                                                                                                                                   | yes  |
| "Grado"      | badge or "-"                                                                                                                                                                                                              | yes  |
| "Sede"       | name or "-"                                                                                                                                                                                                               | yes  |
| "Estado"     | badge Activo / Retirado / Graduado                                                                                                                                                                                        | yes  |
| (actions)    | "Ver perfil" (→ STU-02), "Editar" (→ STU-03; `student:update`), "Observación" (→ OBS-04; `observation:create`), "Eliminar" (`student:delete`; confirm "¿Eliminar este estudiante?" / "Esta acción no se puede deshacer.") | –    |

Empty: **"No se encontraron estudiantes con perfil académico completo"** / "Intenta cambiar los filtros o crea un nuevo estudiante." + "Crear Estudiante". Teachers get no create/edit/delete actions and see only their scope. Second card "Perfiles Académicos Incompletos" (chip "{n} pendientes", description "Usuarios con rol estudiante que aún no tienen perfil académico.", shown only when `student.listIncomplete.total > 0` and the caller has `student:create`): columns "Estudiante" (name + "Sin perfil académico"), "Documento", "Username" (monospace), "Email" ("-" for placeholders), actions "Completar" (→ STU-03 complete) and "Editar usuario" (→ USR-03 when `user:update`).

### 5.2 STU-02 `/estudiantes/$studentId`

Header "Perfil del Estudiante" / "Información académica, horario y acudientes"; actions "Editar" (`student:update`), "Asignar Acudientes" (`student:guardians`), "Volver" (→ STU-01). Left column: card "Identidad" (avatar initials, full name, "{tipo} {número}", status badge, then "Usuario", "Email", "Teléfono" or "N/A") and card "Acciones" with link cards shown only when the caller holds the target permission: "Observación" (→ OBS-04), "Notas" (→ GRD-08), "Asistencia" (→ ATT-02), "Boletines" (→ RPT-03), "Historial de observaciones" (→ OBS-05), "Logros" (→ ACH-02), each preselecting the student. Right column: tabs (`?tab=info|horario|acudientes`, default `info`):

- **Información**: card "Información Académica" ("Sede", "Curso / Grado" badge or "Sin curso asignado", "Fecha de Nacimiento" `dd/mm/yyyy`, "Género" (Masculino/Femenino/Otro), "Tipo de Sangre"); card "Información de Contacto y Salud" ("Dirección de Residencia", "Barrio / Sector", "Estrato", "EPS"); every empty value shows "N/A" (OQ-STU-2 on teacher visibility).
- **Horario**: card "Horario Semanal: {curso}" with link "Ver en pantalla completa" (→ SCH-11 with the course) rendering `WeeklySchedule` from `schedule.get({ view: "course", courseId })`; empty **"No hay un horario generado para este curso todavía."** / "Contacta con coordinación académica."; without course **"El estudiante no está asignado a ningún curso."** / "Asigne un curso en la pestaña de edición para ver el horario."
- **Acudientes**: card "Información de Acudientes" with "Gestionar" (→ STU-04); sub-card "Acudiente Principal" ("Nombre", "Teléfono", "Email" from the student record, "N/A" when empty); then one card per link: name, relationship badge, "Usuario", "Teléfono", "Email"; none: "No hay acudientes vinculados con cuenta de usuario."

### 5.3 STU-03

Routes and titles: `/estudiantes/nuevo` "Nuevo Estudiante" / "Complete los datos para matricular un nuevo estudiante"; `/estudiantes/completar/$personId` "Completar Perfil Académico" / "Complete la información académica de {nombre}"; `/estudiantes/$studentId/editar` "Editar Estudiante" / "Modifica los datos del estudiante". Card "Datos del Estudiante":

- **New**: callout "Usuario automático: Se generará automáticamente. Contraseña inicial: Nº de documento." and a live preview "Username auto-generado" (`user.previewUsername`).
- **Complete**: banner with the existing user (name, "{username} | {tipo}: {documento} | {email}", badge "Usuario Creado") and callout "Información personal ya registrada: Nombre, documento, email y teléfono fueron creados. Ahora solo necesita completar la información académica y del acudiente."; personal fields are not rendered.
- Section 1 "Información del Usuario" (new/edit): "Nombre *", "Apellido *", "Tipo de Documento" (TI, RC, CC; disabled on edit), "Número de Documento *" (read-only on edit), "Teléfono", "Fecha de Nacimiento", "Género" (Seleccionar..., Masculino, Femenino, Otro), "Dirección".
- Section "Información Académica": "Sede *" (Seleccionar sede...), "Grado" (Sin asignar; options of the chosen campus, reset on campus change), "Barrio / Vereda" (placeholder "Ej: El Centro"), "Estrato" (1–6), "Tipo de Sangre" ("Ej: O+"), "EPS" ("Ej: Sanitas").
- Section "Información del Acudiente": "Nombre del Acudiente", "Teléfono del Acudiente", "Email del Acudiente".
- Edit only: section "Estado del Estudiante": "Estado" (Activo, Retirado, Graduado) and the STU-R4 help.

Buttons "✅ Completar Matrícula" (new/complete) / "Actualizar" (edit); "Cancelar" (→ USR-01 in complete mode, STU-01 otherwise). Success: toast per STU-R3 then STU-01; edit: toast "Estudiante actualizado". A user without a profile reached through a bad `personId` shows `NotFoundBlock` "Usuario".

### 5.4 STU-04 `/estudiantes/$studentId/acudientes`

Header "Asignar Acudientes" / "Vincula las cuentas de acudientes con el estudiante"; buttons "Volver al Perfil", "Lista de Estudiantes". Student banner: name, "{documento} | {curso o Sin grado} | {sede}". Card "Asignar Nuevo Acudiente": "Seleccionar Acudiente" (placeholder "-- Seleccione un acudiente --", options "{nombre} ({username}) - {documento}", search-as-you-type through `guardian.candidates`; empty "No hay acudientes creados en la institución." with link "Crear acudiente primero" (→ USR-02 `?role=parent`) when the caller has `user:create`, otherwise "Pida al administrador que cree la cuenta del acudiente."), "Parentesco / Relación" (Acudiente, Padre, Madre, Tío/a, Abuelo/a, Hermano/a, Otro), button "Asignar Acudiente"; toast "Acudiente asignado". Card "Acudientes Asignados": row = name, relationship badge, "{email} | {teléfono o Sin teléfono}", trash (confirm "¿Eliminar este acudiente?" / "{nombre} dejará de estar vinculado a este estudiante."; toast "Acudiente desvinculado"); empty "No hay acudientes asignados a este estudiante".

### 5.5 STU-05 `/estudiantes/importar`

Header "Cargar Estudiantes desde Excel" / "Carga masiva de estudiantes desde archivo Excel"; "Volver". Card "Subir Archivo": "Archivo Excel (.xlsx) *" (help "Tamaño máximo: 10MB"), callout "Importante: Los estudiantes que ya existen (mismo documento) serán omitidos. La contraseña inicial de cada estudiante es su número de documento. Se generará usuario automáticamente." After selecting a file the server preview (`student.importPreview`) fills card "Vista previa" ("{archivo} · {n} filas, {m} válidas": columns nombre, apellido, documento, grado, "Estado" badge "Válida" or the row message); buttons "Cargar Estudiantes" (→ `student.importStart`, progress "Importando… {processed} de {total}", then the result callout/error card of STU-R8), "Cancelar"/"Limpiar". Card "Formato Requerido": columns Columna / Obligatorio (✅/❌) of STU-R8 and "Descargar Plantilla" (`student.importTemplate`).

### 5.6 Shared components

`StudentStrip` (identity card used by GRD-08, ATT-02, OBS-05, ACH-02), `StudentSwitcher` (staff: course then student via `student.pick`; parent: child buttons "Hijo/a:"; student: hidden), `NoStudentBlock`, `GuardianCard`, `StatusBadge` ("Activo" success, "Retirado" secondary, "Graduado" info). Each has a story; they live in `features/students` and are exported through its `index.ts` (features import each other only through it).

## 6. Flows and audit

- **F4** (admission, guardians, enrollment) end to end: paths A/B/C (STU-R2), guardians (STU-04 after USR-02 for parents), enrollment (STU-R3 and module 04), status changes (STU-R5).
- **F7** starts from STU-01/02 "Observación"; **F5/F6/F8/F12/F15** consume `student.pick`.
- Audit: §3.2, one event per user action; imports write one `student.imported` (no per-student rows).

## 7. Testing and acceptance

### 7.1 Tests

- **Unit** (`sige-core`): import row validation (every message of STU-R8, dates in three formats, gender aliases, ambiguous/unknown course or campus, in-file duplicates); campus/course consistency helper; status transition table.
- **API integration**: path A creates login + profile + enrollments atomically and compensates on failure (fault injection after login, after profile, mid-enrollment); path B/complete rejects a person that is not a `student` or already has a profile; `student.update` never changes enrollments and flags them stale (module 04); status change audited and student drops out of `student.pick`'s active default… and out of sheets; delete matrix (empty profile ok; with each dependent kind refused with the exact message; guardian links and login removed); guardian rules (non-parent, duplicate, inactive guardian, other tenant) and unlink; **scope matrix** per procedure: teacher sees only own-course students (also via `get`/`pick`/`list`), student only self, parent only linked children (non-linked id → `NOT_FOUND`), coordinator/viewer rules per foundation; permission matrix for every role; two-tenant isolation suite; import: dry-run writes nothing, 100-row file with mixed errors, existing documents skipped, job progress, limits (10 MB, 2,000 rows, `.xls` rejected).
- **Web**: STU-01 default `activo` filter, teacher read-only actions, incomplete-profiles card visibility; STU-03 campus→course reset and the three modes' field sets; STU-04 candidate search and empty states; STU-05 preview → progress → result; STU-02 tab state in the URL and permission-gated action cards; stories for shared components.

### 7.2 Acceptance

- STU-01: server-driven list with scope, filters and URL state; incomplete profiles listed with "Completar".
- STU-02: three tabs; action links appear only with permission; schedule tab renders or shows the specified empties.
- STU-03: creating a student with a course yields a login (document as password, forced change), a profile and one enrollment per offering; completing a pre-created login adds only the profile; editing a course keeps enrollments.
- STU-04: link/unlink with the messages above; the parent's portal lists the child immediately (module 13 test).
- STU-05: a mixed workbook imports valid rows, skips existing documents and reports row errors; P4 exit criterion of foundation §8 holds (three admission paths, guardians, idempotent enrollment, status changes remove students from active lists).

## 8. Open questions and notes

### 8.1 New open questions

| ID       | Question                                                                                      | Recommended default                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-STU-1 | On `retirado` / `graduado`, should the login be deactivated and open enrollments retired?     | No automatic side effects (prototype); staff do it manually (USR-03 deactivate, SCH-01 status). Revisit if schools expect retired students to lose access.                                        |
| OQ-STU-2 | Should teachers see health and socio-economic fields (EPS, tipo de sangre, estrato, address)? | Keep the prototype's visibility for v1, but run a data-protection review (Ley 1581 sensitive data) before production; the alternative is returning these fields as `null` for the `teacher` kind. |

### 8.2 Gaps found in 00-foundation.md

- G-STU-1 §6.9 has no `student.created`, `student.updated` or `student.deleted`; added here (status change, import and guardian events exist). **Resolved in 00-foundation (§6.9 `student.{created,updated,deleted}`).**
- G-STU-2 §5.2 `student.course_id` does not bind the course to the student's campus; this spec adds the composite FK and the `unique(organization_id, campus_id, id)` on `course`. **Resolved in 00-foundation (§5.2 `course` unique and `student` composite FK).**
- G-STU-3 R2.8 delegated "course change vs enrollments" to modules 04/05; defined in STU-R4 and module 04 SCH-R7 (no automatic change, stale flag). **Noted in 00-foundation (R2.8 defers to STU-R4 / SCH-R7); no change needed.**
- G-STU-4 §4.2 gives `student:guardians` to administrators and coordinators but there is no permission to _create_ guardian accounts for coordinators (`user:create` is admin-only); STU-04 shows "Pida al administrador…" in that case. **Noted in 00-foundation: coordinators cannot create guardian accounts (`user:create` is admin-only); STU-04 copy stands.**
