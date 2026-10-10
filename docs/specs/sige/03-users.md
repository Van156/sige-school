# Spec: SIGE — User Management and Provisioning (USR)

- **Status:** Approved (product owner accepted every recommended default on 2026-10-07)
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query + Form (web), Drizzle + Postgres, better-auth `1.7.5` (`admin` + `username` plugins), `exceljs` (`.xlsx`), `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.1 R1.9–R1.24 identity and provisioning, §6.7 imports, OD-1, OD-2, OD-4, OD-17, OD-18, OD-22), [`01-auth-and-dashboards.md`](./01-auth-and-dashboards.md) (`person`, `sigeProcedure`, forced-password gate), [`02-institution.md`](./02-institution.md) (INS-04/05 screens, `institutionAdmin.create`), [`data-table.md`](../data-table.md), [`auth-multitenant-rbac.md`](../auth-multitenant-rbac.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/users/*`, `-screens/institution/{institution-users-screen,institution-user-form-screen}.tsx`, `-lib/usernames.ts`, `-mock/admin.ts` (`deleteUser`). Inventory §3.4, §3.3 (INS-04/05), F1, F4. Requirement ids: `USR-R<n>`.

## 1. Objective and scope

Create, list, edit, deactivate, delete and bulk-import the institution's users with the SIGE provisioning model: usernames generated from name and document, initial password = document number with a forced first-login change, optional email, one role per user (R1.9). This module owns the `provisionUser` service every other entry point calls (USR-02, INS-02, INS-05, STU-03, STU-05, USR-04, the seed) and the platform-side user procedures behind INS-04/05.

### In scope

| Screen                 | Title                                                 | Roles | Real route                                                                 |
| ---------------------- | ----------------------------------------------------- | ----- | -------------------------------------------------------------------------- |
| USR-01                 | "Gestión de Usuarios"                                 | R, A  | `/usuarios` (`?role=teacher\|coordinator\|student\|parent\|admin\|viewer`) |
| USR-02                 | "Crear Nuevo Usuario"                                 | R, A  | `/usuarios/nuevo` (`?role=` preselects)                                    |
| USR-03                 | "Editar Usuario"                                      | R, A  | `/usuarios/$personId/editar`                                               |
| USR-04                 | "Importar Usuarios desde Excel"                       | R, A  | `/usuarios/importar`                                                       |
| INS-04 / 05 (API only) | root user list and creation (screens specified in 02) | R     | `platformUser.*` (§3.4)                                                    |

"R" on USR-01…04 is a superadmin impersonating the rector (foundation §4.4); the prototype's root-only "Institución" column and institution select do not exist in tenant screens.

### Out of scope

- Roles/permissions editor and dynamic roles (existing `/settings/roles`, template feature).
- The student academic profile (module 05): USR-02 with role student only creates the login; STU-03 completes the profile.
- Changing a user's role (OQ-USR-1), self-service password change (module 01), email flows for placeholder users (module 01, OD-1).

## 2. Data

No new domain table beyond what module 01 defines (`person`) and the better-auth tables. One support table:

### 2.1 `import_job` (new; shared with module 05)

| Column                                      | Type                   | Notes                                                                                            |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `id`                                        | text PK                | UUID (R2.1); `unique(organization_id, id)`                                                       |
| `organization_id`                           | text not null          | FK → `organization` cascade                                                                      |
| `kind`                                      | enum `import_kind`     | `users`, `students`                                                                              |
| `status`                                    | enum `import_status`   | `running`, `done`, `failed`                                                                      |
| `total`, `processed`, `imported`, `skipped` | int not null default 0 |                                                                                                  |
| `errors`                                    | jsonb not null         | `{ row: number, message: string }[]`, capped at 200 entries (the count stays exact in `skipped`) |
| `created_by`                                | text not null          | FK `(organization_id, created_by) → person(organization_id, id)`                                 |
| `started_at`, `finished_at`                 | timestamptz            |                                                                                                  |

Index `(organization_id, created_at desc)`. Rows older than 30 days are purged by the same sweep that owns the audit retention job pattern. Rows left `running` after a server restart are marked `failed` ("Importación interrumpida") on startup (USR-R12).

### 2.2 Constraints relied on

`person`: `unique(organization_id, document_number)`, `unique(user_id)`; `user.username` and `user.email` are globally unique (better-auth). Hence username and email conflicts can come from another tenant; messages never reveal the tenant (USR-R5).

Migration: `import_job` + enums only.

## 3. API

Router file `routers/sige/user.ts` exports `userRouter`, `importJobRouter`, `platformUserRouter`. Tenant procedures are `sigeProcedure.use(requirePermission(...))`; platform procedures are `platformProcedure({ institution: ["manage_users"] })` and take `institutionId`. Services take an explicit `organizationId` so both routers share them. Errors per foundation R3.5.

### 3.1 Provisioning service (`provisionUser`, `packages/auth/src/provision-user.ts`)

```ts
type ProvisionInput = {
  organizationId: string;
  role: "owner" | "admin" | "coordinator" | "teacher" | "student" | "parent" | "viewer";
  firstName: string;
  lastName: string;
  documentType: "TI" | "CC" | "RC" | "CE" | "Pasaporte";
  documentNumber: string;
  birthDate?: string;
  gender?: "M" | "F" | "Otro";
  email?: string;
  phone?: string;
  address?: string;
  country?: string;
  department?: string;
  municipality?: string;
  mustChangePassword?: boolean; // default true (the seed overrides it)
  actor: { userId: string; impersonatorUserId?: string } | "system";
};
type Provisioned = { userId: string; personId: string; username: string; hasRealEmail: boolean };
```

Steps, in order (USR-R1):

1. Validate input (§4.1) and check uniqueness: `document_number` in the organization, `email` globally. Reject early with the messages of §4.1.
2. `username = generateUsername(...)` from `sige-core` (USR-R2), checked against `user.username` globally.
3. Email: provided → store lowercased, `has_real_email = true`; absent → `<username>@sin-correo.<org-slug>.invalid`, `has_real_email = false` (OD-1). Both with `emailVerified = true` (an administrator vouches for the address; see G-USR-4).
4. Create the better-auth user (`name = "first last"`), the credential `account` with the **document number** as initial password hashed through better-auth's hasher (no length check, R1.24), and the `member` row with exactly one role.
5. Insert `person` (`must_change_password = true` unless overridden, `is_active = true`).
6. Write audit `user.created` (`metadata`: `{ role, personId, hasRealEmail }`; never the password).
7. Any failure after step 4 compensates by deleting, in reverse order, what was created (better-auth adapters do not share the Drizzle transaction, R1.18); a fault-injection test covers every step.

Caller rules (USR-R3): `owner` only from `institutionAdmin.create`; `admin` only from platform procedures; org callers (`user.create`, `user.import`, STU-03/05) may provision `coordinator`, `teacher`, `student`, `parent`, `viewer`. A disallowed role → `BAD_REQUEST` "Solo la plataforma puede crear administradores."

### 3.2 `generateUsername` (`packages/sige-core/src/username.ts`, pure)

USR-R2 `base = initial(firstName) + lastName + last4(document)`, all lowercase, accents stripped, anything outside `a-z0-9` removed from the names (spaces too). `last4` takes the last four alphanumeric characters of the document. On collision append `_2`, `_3`, … until free. Empty `base` (names with no letters) → `BAD_REQUEST` "No se pudo generar el nombre de usuario." The function receives the set of taken usernames and is deterministic, so the seed and tests reproduce it. See G-USR-3 for the divergence from the prototype helper.

### 3.3 Tenant procedures

| Procedure              | Permission                                             | Input                                                                                                                                                                                                                                                                                                                                                            | Output                                                                                           | Scope / notes                                                                                                                                               |
| ---------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.list`            | `user:read`                                            | shared list input (`user-list-config.ts`: sort `username`, `name`, `role`, `status`, `createdAt`, `lastLoginAt`; filters `name` text (matches first/last name, username, email), `username` text, `role` select (`admin`, `coordinator`, `teacher`, `student`, `parent`, `viewer`; `admin` matches `owner` and `admin`), `status` select (`active`, `inactive`)) | `{ rows: UserRow[], total }`                                                                     | default sort `createdAt` desc; the caller's own row is flagged `isSelf`                                                                                     |
| `user.stats`           | `user:read`                                            | –                                                                                                                                                                                                                                                                                                                                                                | `{ total, teachers, students, active }`                                                          | KPI tiles; `teachers`/`students` count members by role                                                                                                      |
| `user.get`             | `user:read`                                            | `{ personId }`                                                                                                                                                                                                                                                                                                                                                   | `UserDetail`                                                                                     | `NOT_FOUND` outside the tenant                                                                                                                              |
| `user.options`         | any of `user:read`, `course:update`, `offering:update` | `{ role: "teacher" \| "parent", search?: string, limit?: number (≤ 50, default 20) }`                                                                                                                                                                                                                                                                            | `{ personId, name, username, document }[]` of **active** persons                                 | feeds the director (INS-12) and teacher (SCH-04/06) selects; never returns other roles (guardian candidates are served by `guardian.candidates`, module 05) |
| `user.previewUsername` | `user:create` or `student:create` (STU-03 "new")       | `{ firstName, lastName, documentNumber }`                                                                                                                                                                                                                                                                                                                        | `{ username: string \| null, documentTaken: boolean }`                                           | null while any input is empty; no write                                                                                                                     |
| `user.checkEmail`      | `user:create`                                          | `{ email }`                                                                                                                                                                                                                                                                                                                                                      | `{ available: boolean }`                                                                         | reveals only that an address is in use, not by whom; limited to 30 calls/min per user                                                                       |
| `user.create`          | `user:create`                                          | `userCreateInput` (below)                                                                                                                                                                                                                                                                                                                                        | `{ user: UserRow, username, next: { screen: "STU-03", personId } \| null }`                      | `next` set when `role = student` (profile to complete, F4 path B)                                                                                           |
| `user.update`          | `user:update`                                          | `{ personId, ...userEditInput }`                                                                                                                                                                                                                                                                                                                                 | `UserDetail`                                                                                     | role immutable (OQ-USR-1); admin/owner rows rejected for org callers (USR-R4)                                                                               |
| `user.setActive`       | `user:update`                                          | `{ personId, active: boolean }`                                                                                                                                                                                                                                                                                                                                  | `UserRow`                                                                                        | revokes all sessions on deactivation (USR-R6)                                                                                                               |
| `user.resetPassword`   | `user:reset_password`                                  | `{ personId, mode: "document" } \| { personId, mode: "custom", newPassword }`                                                                                                                                                                                                                                                                                    | `{ ok: true }`                                                                                   | re-arms `must_change_password`; revokes sessions                                                                                                            |
| `user.delete`          | `user:delete`                                          | `{ personId }`                                                                                                                                                                                                                                                                                                                                                   | `{ deleted: true }`                                                                              | only a fresh, unreferenced user (USR-R7)                                                                                                                    |
| `user.importPreview`   | `user:import`                                          | `{ file: File }` (`.xlsx`, ≤ 10 MB, ≤ 2,000 rows)                                                                                                                                                                                                                                                                                                                | `{ total, valid, invalid, rows: PreviewRow[] (first 50), errors: {row, message}[] (first 200) }` | no writes; per-row validation only                                                                                                                          |
| `user.importStart`     | `user:import`                                          | `{ file: File }`                                                                                                                                                                                                                                                                                                                                                 | `{ jobId }`                                                                                      | parses and validates, then provisions valid rows in the background (USR-R12)                                                                                |
| `user.importTemplate`  | `user:import`                                          | –                                                                                                                                                                                                                                                                                                                                                                | `File` (`plantilla-usuarios.xlsx`)                                                               | header row plus one example row                                                                                                                             |
| `importJob.get`        | `user:import` or `student:import`                      | `{ jobId }`                                                                                                                                                                                                                                                                                                                                                      | `{ kind, status, total, processed, imported, skipped, errors, startedAt, finishedAt }`           | only the job's creator (or any caller with the import permission of that `kind`) sees it; else `NOT_FOUND`                                                  |

```ts
type UserRow = {
  personId: string; userId: string; username: string; email: string | null; // null when placeholder
  firstName: string; lastName: string; name: string;
  role: "owner" | "admin" | "coordinator" | "teacher" | "student" | "parent" | "viewer";
  isActive: boolean; mustChangePassword: boolean; lastLoginAt: string | null;
  createdAt: string; isSelf: boolean;
};
type UserDetail = UserRow & {
  documentType; documentNumber; birthDate: string | null; gender: "M" | "F" | "Otro" | null;
  phone: string | null; address: string | null; country: string | null;
  department: string | null; municipality: string | null; hasRealEmail: boolean;
  studentId: string | null; // set when the user has an academic profile ("Ver Perfil Académico")
};
const userCreateInput = z.object({
  firstName, lastName, documentType, documentNumber, birthDate?, gender?,
  email?, phone?, address?, country?, department?, municipality?,
  role: z.enum(["coordinator", "teacher", "student", "parent", "viewer"]),
});
// userEditInput = userCreateInput minus role, plus newPassword?: string (optional)
```

### 3.4 Platform procedures (INS-04/05)

| Procedure                      | Permission                 | Input                                                                               | Output                                                 |
| ------------------------------ | -------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `platformUser.list`            | `institution:manage_users` | `{ institutionId, ...listInput }` (same config as `user.list`)                      | `{ rows: UserRow[], total }`                           |
| `platformUser.stats`           | `institution:manage_users` | `{ institutionId }`                                                                 | `{ admins, coordinators, teachers, students }`         |
| `platformUser.create`          | `institution:manage_users` | `{ institutionId, ...userCreateInput, role: "admin" \| ...tenant roles }`           | `{ user: UserRow, username }`                          |
| `platformUser.setActive`       | `institution:manage_users` | `{ institutionId, personId, active }`                                               | `UserRow`                                              |
| `platformUser.resetPassword`   | `institution:manage_users` | `{ institutionId, personId, newPassword }` (custom only, like the prototype dialog) | `{ ok: true }`                                         |
| `platformUser.previewUsername` | `institution:manage_users` | `{ institutionId?, firstName, lastName, documentNumber }`                           | `{ username: string \| null, documentTaken: boolean }` |

`platformUser.create` with role `admin` provisions an `admin` member (never a second `owner`, OD-4). The audit actor is the superadmin; `institutionId` is stored as the audit `organizationId`.

### 3.5 Audit events (foundation §6.9)

| Operation                                      | Action                                  | Metadata (never secrets)                                                                   |
| ---------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| create (`provisionUser` callers except import) | `user.created`                          | `{ role, personId, hasRealEmail }`                                                         |
| `user.update`                                  | `user.updated`                          | `{ changed: string[], before, after }` for non-sensitive fields; document changes included |
| `user.setActive(false)` / `(true)`             | `user.deactivated` / `user.reactivated` | `{ personId, role }`                                                                       |
| `user.resetPassword`                           | `user.password_reset`                   | `{ personId, mode: "document" \| "custom" }`                                               |
| import (once per job)                          | `user.imported`                         | `{ jobId, total, imported, skipped, byRole }`; no per-user `user.created` rows             |
| `user.delete`                                  | `user.deleted`                          | name and role snapshot (action added, G-USR-2)                                             |

## 4. Business rules and validation

Spanish messages verbatim from the prototype and inventory; server returns them as field issues.

### 4.1 Field rules (USR-02, USR-03, INS-05, import)

| Field                        | Rule                                               | Message                                                                                    |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `firstName`                  | required, trimmed, ≤ 100                           | "Los nombres son obligatorios."                                                            |
| `lastName`                   | required, trimmed, ≤ 100                           | "Los apellidos son obligatorios."                                                          |
| `documentType`               | `TI`, `CC` (default), `RC`, `CE`, `Pasaporte`      | "Tipo de documento inválido."                                                              |
| `documentNumber`             | ≥ 5 chars, alphanumeric; unique per institution    | "El documento debe tener al menos 5 dígitos." / "Ya existe un usuario con este documento." |
| `email`                      | optional; valid; unique globally; stored lowercase | "Ingresa un correo válido." / "Ya existe un usuario con este correo."                      |
| `birthDate`                  | optional, not in the future                        | "La fecha de nacimiento no puede ser futura."                                              |
| `gender`                     | `M`, `F`, `Otro` or empty ("No especificado")      | –                                                                                          |
| `newPassword` (edit / reset) | platform policy minimum (default 8, R1.24)         | "La contraseña debe tener al menos 8 caracteres."                                          |
| `role`                       | one of the five tenant roles for org callers       | "Solo la plataforma puede crear administradores."                                          |

The prototype's "mínimo 6" becomes the platform policy (R1.24); only the provisioned initial password (the document) bypasses the length check.

### 4.2 Behavioural rules

- USR-R1 **Provisioning** as §3.1; one code path for every entry point; no raw inserts into `user`/`member`/`person` outside it (lint-enforced by a repository-level test that greps for the three inserts).
- USR-R2 **Username** as §3.2. Live preview in the forms comes from `user.previewUsername` (debounced 300 ms); the preview box shows "Username auto-generado" and "Contraseña inicial: Nº de documento".
- USR-R3 **Roles creatable by callers** as §3.1. Creating a `student` returns `next` and the web navigates to STU-03 in "complete" mode with toast "Usuario creado · completa su perfil académico."; other roles toast "Usuario creado · contraseña inicial: Nº de documento."
- USR-R4 **Protected members.** `owner` and `admin` members are managed by the platform only: org callers see them in lists (filter "Administradores") without edit/delete/deactivate actions, and `user.update|setActive|resetPassword|delete` on them → `FORBIDDEN`. A user cannot deactivate or delete themselves ("No puede desactivar su propia cuenta."); the institution must keep at least one active `owner` ("La institución debe conservar al menos un administrador activo.", R1.3).
- USR-R5 **Cross-tenant uniqueness.** Username and email conflicts are detected globally but reported without naming the tenant; `user.checkEmail` is rate-limited (§3.3).
- USR-R6 **Deactivation** sets `is_active = false`, revokes every session of the user and blocks new sign-ins (module 01 hook). It does not change `student.status`, teacher assignments or authored records. Deactivated persons disappear from `user.options` and new-record selects but stay visible in historical rows. Reactivation restores access with the existing password.
- USR-R7 **Delete** only for a fresh user (foundation §6.4): no academic or authored row references the person. Otherwise `HAS_DEPENDENTS` with, by role: teacher "El profesor tiene asignaturas o grupos a cargo."; student with a profile "El estudiante tiene un perfil académico con notas y matrículas."; parent "El acudiente tiene estudiantes vinculados."; any other reference "El usuario tiene registros asociados. Desactívelo en su lugar." A student user without an academic profile (incomplete) can be deleted. Deletion removes `person`, `member`, `account`, sessions and `user` in compensating order and writes `user.deleted`.
- USR-R8 **Edit.** Document type/number are editable by admins here (uniqueness re-checked; the username does not change; audit records before/after). Email: a non-empty address sets `has_real_email = true` and updates the better-auth user (`emailVerified = true`); clearing it reverts to the placeholder. `user.name` is kept in sync (`syncUserName`). The optional "Nueva Contraseña" field behaves as `resetPassword` mode `custom` ("Dejar vacío para mantener la contraseña actual").
- USR-R9 **Reset** (`user.resetPassword`): `document` resets to the document number; `custom` sets the given password; both set `must_change_password = true`, revoke sessions and audit. Callout in every reset UI: "El usuario deberá cambiar esta contraseña en su próximo inicio de sesión."
- USR-R10 **Teacher selects** use `user.options`, so coordinators (who lack `user:read`) can still pick teachers (SCH-04/06) without listing users.
- USR-R11 **Import columns** (replaces the prototype's legacy `username | email | password | first_name | last_name | role`, which cannot satisfy R1.19/R1.21, G-USR-1): header row, case and accent insensitive:

  | Column           | Required | Values                                                                                                                                                  |
  | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `nombres`        | yes      | text                                                                                                                                                    |
  | `apellidos`      | yes      | text                                                                                                                                                    |
  | `tipo_documento` | no       | TI, CC (default), RC, CE, Pasaporte                                                                                                                     |
  | `documento`      | yes      | ≥ 5 chars; becomes the initial password                                                                                                                 |
  | `rol`            | yes      | `coordinador`, `profesor`, `estudiante`, `acudiente`, `consulta` (English tokens `coordinator`, `teacher`, `student`, `parent`, `viewer` also accepted) |
  | `correo`         | no       | valid email                                                                                                                                             |
  | `telefono`       | no       | text                                                                                                                                                    |

  Row messages (prefixed "Fila {n}: ", n = Excel row number, header = row 1): "Falta el documento.", "Falta el nombre.", "Falta el apellido.", "El documento "{documento}" ya existe.", "Rol inválido "{rol}".", "Correo inválido "{correo}".", "El correo "{correo}" ya está en uso.", "Tipo de documento inválido "{tipo}".", "El documento "{documento}" está repetido en el archivo." Invalid rows are skipped and reported; valid rows import. Students imported here are created without an academic profile; the UI reminds: "Para estudiantes con grado y acudiente use «Cargar Estudiantes desde Excel»."

- USR-R12 **Import execution.** `exceljs` reads the `.xlsx` in memory (resolves the library choice of OD-17; fallback `read-excel-file`; verify maintenance and bundle size on adoption). Limits: ≤ 10 MB, ≤ 2,000 rows, declared uncompressed size ≤ 50 MB (zip-bomb guard); other extensions → `BAD_REQUEST` "Solo se permiten archivos Excel (.xlsx)." Hashing 2,000 initial passwords is CPU-bound, so `user.importStart` returns a job id immediately; the server provisions valid rows with concurrency 4, updating `import_job` every 25 rows; the UI polls `importJob.get` every 2 s. A restart marks running jobs failed; re-uploading is safe because existing documents are skipped. A second concurrent job of the same kind in one institution is rejected with `CONFLICT` "Ya hay una importación en curso." (OQ-USR-2 records the synchronous alternative).
- USR-R13 **Result copy.** "{n} usuarios importados exitosamente" (callout); error card "Errores ({n})" listing the first 10 messages and "... y {m} errores más"; "Importar otro archivo" and "Ver usuarios" actions.

## 5. Web

Feature folder `apps/web/src/features/users` (components `users-list-page`, `user-form`, `user-import-page`, `reset-password-dialog`); routes are thin files under `routes/_auth/_org/usuarios/`. Lists use the shared server-driven `DataTable`/`SimpleListTable`; forms use TanStack Form with the shared zod fragments; each screen has loading, error-with-retry and empty states.

### 5.1 USR-01 `/usuarios`

Header: title by filter ("Gestión de Usuarios", "Profesores", "Coordinadores", "Estudiantes", "Acudientes", "Administradores", "Usuarios de Consulta"); description with filter "Mostrando {plural en minúsculas}" else "Usuarios de {institución}". Actions: "Importar Excel" (→ USR-04, needs `user:import`), "Nuevo {Rol}" / "Nuevo Usuario" (→ USR-02 with `?role=`). Institution banner badge "Admin" (or "Vista Root"). KPI tiles "Total Usuarios", "Profesores", "Estudiantes", "Activos" (`user.stats`). Card "Lista de Usuarios" with chip "{n} usuarios". Toolbar: text filter placeholder "Buscar por nombre, apellido, email o username"; filters "Rol" (default "Todos los roles"; label of `?role=`), "Estado" (Activo/Inactivo). Columns:

| Column            | Content                                                                                 | Sort | Filter          |
| ----------------- | --------------------------------------------------------------------------------------- | ---- | --------------- |
| "Usuario"         | role-coloured icon, username, email small ("Sin correo" in muted text for placeholders) | yes  | text `username` |
| "Nombre Completo" | full name                                                                               | yes  | text `name`     |
| "Rol"             | badge (Administrador, Coordinador, Profesor, Estudiante, Acudiente, Consulta)           | yes  | select          |
| "Estado"          | "Activo" / "Inactivo" badge                                                             | yes  | select          |
| (actions)         | "Editar" (→ USR-03), "Eliminar" (hidden for self and for `owner`/`admin` rows)          | –    | –               |

Delete dialog: title "Confirmar eliminación", "¿Estás seguro que deseas eliminar al usuario {username}? Esta acción no se puede deshacer.", buttons "Cancelar" / "Sí, Eliminar"; `HAS_DEPENDENTS` → toast "No se puede eliminar {username}" + the USR-R7 message. Empty: **"No hay usuarios registrados"** / "No hay usuarios en tu institución. Crea el primer usuario." + "Crear Primer Usuario" (with active filters: "Ningún usuario coincide con los filtros.").

### 5.2 USR-02 `/usuarios/nuevo`

Header sub "Complete los datos para registrar un nuevo usuario en el sistema"; "Volver a la Lista". Callout "Automático: El nombre de usuario se genera automáticamente. La contraseña inicial será el número de documento de identidad." and the live preview box (§4.2 USR-R2). Three numbered sections:

1. "Información Personal": "Nombres *" (tip "Nombre completo del usuario", placeholder "Ej: Juan Carlos"), "Apellidos *" ("Ej: Pérez García"), "Tipo Documento" (TI - Tarjeta de Identidad, CC - Cédula de Ciudadanía [default], RC - Registro Civil, CE - Cédula de Extranjería, Pasaporte), "Nº Documento *" (tip "Se usará como contraseña inicial"), "Fecha Nacimiento", "Género" (No especificado, Masculino, Femenino, Otro).
2. "Información de Contacto": "Correo Electrónico" (optional, placeholder "usuario@ejemplo.com (Opcional)", live availability via `user.checkEmail`), "Teléfono / Celular" ("3001234567"), "Dirección" ("Calle, Carrera, Número, Barrio"), "País" (Colombia [default], México, Venezuela, Ecuador, Perú, Otro), "Departamento" ("Ej: Cundinamarca"), "Municipio" ("Ej: Bogotá").
3. "Información de la Cuenta": "Rol *" (Coordinador, Profesor, Estudiante, Acudiente, Consulta; help "Como admin, puedes crear coordinadores, profesores, estudiantes, acudientes y viewers. Root crea admins."), callout "Seguridad: La contraseña inicial será el número de documento. El usuario deberá cambiarla obligatoriamente en su primer inicio de sesión."

Buttons "✅ Crear Usuario", "Cancelar". Side cards "¿Cómo funciona?" (3 bullets) and "Roles del Sistema" (descriptions of inventory USR-02, "Viewer" shown as "Consulta"). The root-only "Institución" select of the prototype does not exist (tenant fixed).

### 5.3 USR-03 `/usuarios/$personId/editar`

Header "Editar Usuario", sub "Editando: {username} - {nombre completo}"; "Volver a la Lista". Summary strip: Username, Email ("Sin correo"), Rol (badge), Creado (`dd/mm/yyyy`). Same sections as USR-02 prefilled, section 3 titled "Cuenta y Seguridad": "Rol" read-only text (help "El rol no se puede cambiar. Cree un usuario nuevo si necesita otro rol."), "Nueva Contraseña (opcional)" (hint "Dejar vacío para mantener la contraseña actual"), switch "Usuario activo" / "Usuario inactivo" (hidden for `owner`/`admin` rows and for self). Button "💾 Actualizar Usuario". Side card "Acciones Rápidas": for students "Ver Perfil Académico" (→ STU-02 when `studentId`, else "Completar Perfil Académico" → STU-03), "Resetear Contraseña" (confirm "¿Restablecer la contraseña al número de documento?", mode `document`), "Deshabilitar Usuario" / "Habilitar Usuario". Side card "Información": Username, Email, Documento ("{tipo}: {número}" or "No registrado"), "Último acceso" (`dd/mm/yyyy HH:MM` or "Nunca"), "Cambiado contraseña" (badge "Pendiente" when `must_change_password`, else "Sí"). Not-found state for a bad id or an out-of-tenant id.

### 5.4 USR-04 `/usuarios/importar`

Header sub "Carga masiva de usuarios desde archivo Excel"; "Volver". Card "Archivo Excel": file input (`.xlsx`, help "Solo archivos .xlsx (máx 10MB)") and "Descargar Plantilla" (`user.importTemplate`). On select: `user.importPreview`; card "Vista previa" ("{archivo} · {n} filas, {m} válidas") with columns `nombres`, `apellidos`, `documento`, `rol`, "Estado" (badge "Válida" or the row message). Button "Importar Usuarios" (disabled without valid rows) → `user.importStart` → progress "Importando… {processed} de {total}" → result (USR-R13). Card "Formato Requerido": the column table of USR-R11 with an example row (`María | Londoño | CC | 1101234501 | profesor | maria@colegio.edu.co | 3001234567`) and "Roles válidos: coordinador, profesor, estudiante, acudiente, consulta". Errors: file too large → AUTH-05 413 copy inline; wrong extension → "Solo se permiten archivos Excel (.xlsx)."

### 5.5 INS-04 / INS-05 wiring

INS-04 uses `platformUser.list|stats|setActive|resetPassword`; INS-05 uses `platformUser.create` and `platformUser.previewUsername` (screens specified in module 02 §5.1). The root's "Editar" action starts the "Gestionar" impersonation and opens USR-03.

### 5.6 Shared components

`UserCell` (role icon, username, email small), `RoleBadge` (labels and tones from module 01), `RoleSelect`, `ResetPasswordDialog` (used by USR-03 side card via `document` mode and by INS-04 with a custom password field), `ImportResultCallout`/`ImportErrorList` (reused by STU-05 and GRD-03). Components are ported from the prototype screens; each presentational one has a story.

## 6. Flows and audit

- **F1** Provisioned users start with `must_change_password = true`; admin/root reset re-arms it (USR-R9).
- **F2** step 4 and **F3** step 3: INS-04/05 and USR-02 create staff; `user.options` feeds SCH-04/06.
- **F4** Path B: USR-02 role student → STU-01 "Perfiles Académicos Incompletos" → STU-03 complete; guardians are created here (role `parent`) and linked in STU-04.
- Audit: §3.5.

## 7. Testing and acceptance

### 7.1 Tests

- **Unit** (`sige-core`): `generateUsername` (accents, ñ, spaces and hyphens in surnames, short or alphanumeric documents, empty names → error, collisions `_2`/`_3`, determinism); import row validation (every message of USR-R11, duplicate-in-file, role aliases); header normalisation.
- **API integration**: `provisionUser` creates user + credential + member + person + audit, initial password verifies against the document, flag set; fault injection at each step leaves no residue; username and email conflicts across tenants succeed/fail as specified without leaking the tenant; role matrix (org admin cannot create `admin`/`owner`; platform can create `admin`); `user.update` cannot target `owner`/`admin` for org callers, cannot change role, rewrites `user.name`; `setActive(false)` revokes sessions and sign-in fails with the message of module 01; self-protection and last-owner rule; `resetPassword` modes re-arm the flag and revoke sessions; delete matrix (fresh user ok, teacher with offering, director, student with profile, parent with link, authored record) with exact messages; `user.options` returns only active teachers/parents and works for a coordinator; import: dry-run writes nothing, a 100-row file with 6 bad rows reports row-numbered errors, 2,001 rows and 10 MB + 1 rejected, concurrent job rejected, restart marks the job failed; permission matrix (coordinator/teacher/student/parent/viewer get `FORBIDDEN` on every `user.*` except `options` where allowed) and the generated tenant-isolation suite; no secret in any audit `metadata` (assertion over all events).
- **Web**: USR-01 filters, role-titled header, hidden actions for self and admin rows, delete flow messages; USR-02 live preview (debounced), email availability, role preselect, student redirect to STU-03; USR-03 read-only role, reset confirm, "Nunca"/"Pendiente" states; USR-04 preview → progress → result with the "y N errores más" line; stories for new presentational components.

### 7.2 Acceptance

- USR-01: list obeys the shared contract (server paging/sort/filter, URL state); KPI tiles equal `user.stats`; an admin never sees users of another institution.
- USR-02: one user per tenant role can be created and signs in with the generated username and the document, then is forced through AUTH-03; a student create leads to STU-03.
- USR-03: edits persist and are audited with before/after; deactivation blocks sign-in immediately and ends open sessions; reset re-arms the forced change; role cannot change.
- USR-04: importing a 100-row workbook reports row errors and creates the valid users; progress is visible; existing documents are skipped, not duplicated; the P2 exit criterion of foundation §8 holds.
- INS-04/05: root can list, create (incl. admin), deactivate and reset passwords for any institution; every action is in the activity log with the superadmin as actor.
- Every audit action of §3.5 yields exactly one entry (no per-user rows for imports).

## 8. Open questions and notes

### 8.1 New open questions

| ID       | Question                                                                      | Recommended default                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-USR-1 | Can an admin or root change a user's role (prototype: root only, in USR-03)?  | No in v1: roles carry linked data (student profile, guardian links, teacher scope). Deactivate and create the user again. A platform-only "change role" can follow.    |
| OQ-USR-2 | Run imports as background jobs with polling, or synchronously in the request? | Background job + `import_job` (§2.1): 2,000 password hashes can exceed request timeouts. Synchronous is acceptable if measurements show < 30 s at the 2,000-row limit. |

### 8.2 Gaps found in 00-foundation.md

- G-USR-1 §6.7 names USR-04 but not its columns; the prototype's legacy columns (`username`, `password`) contradict R1.19 and R1.21 and omit the document. USR-R11 defines the real columns. **Noted in 00-foundation: USR-R11 owns the USR-04 columns (R3.21 unchanged); no foundation change needed.**
- G-USR-2 §6.9 has no `user.deleted` action though §6.4 allows deleting a fresh user; added here (also relevant to student delete in module 05). **Resolved in 00-foundation (§6.9 `user.deleted`).**
- G-USR-3 R1.19 builds the username from the whole last name with spaces removed and "appends a counter"; the prototype helper (`-lib/usernames.ts`) uses only the first surname token and, on collision, increments the four digits. This spec follows the foundation (counter `_2`); confirm which rule the product owner wants, since seeded demo logins (R4.3) depend on it. **Open decision OD-25 in 00-foundation §11 (this spec adopts the recommended default).**
- G-USR-4 R1.20 covers placeholder emails only; this spec marks administrator-entered real emails `emailVerified = true` as well so username sign-in is not blocked by `requireEmailVerification`. A typo in the address then reaches reset emails; consider a verification step in a later phase. **Noted in 00-foundation: administrator-entered emails are `emailVerified = true`, consistent with R1.20; verification step stays a later-phase option.**
