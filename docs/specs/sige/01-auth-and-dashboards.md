# Spec: SIGE — Authentication, Profile, Errors and Dashboards (AUTH, DASH)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query + Form (web), Drizzle + Postgres, better-auth `1.7.5` (`username` plugin added), `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (platform mapping §4, `person` §5.2, conventions §6, OD-1…OD-24), [`dashboard-shell-and-auth-ui.md`](../dashboard-shell-and-auth-ui.md), [`account-and-org-settings.md`](../account-and-org-settings.md), [`auth-multitenant-rbac.md`](../auth-multitenant-rbac.md), [`data-table.md`](../data-table.md), [`frontend-foundation.md`](../frontend-foundation.md). Widgets read data owned by modules 02–12; those modules are not prerequisites (§6.3).

Prototype sources: `apps/web/src/routes/prototype/sige/{auth,_shell/dashboard.tsx,_shell/perfil.tsx}`, `-screens/{login-screen,force-password-screen,profile-screen,error-screen}.tsx`, `-screens/dashboards/*`, `-nav.ts`. Inventory §3.1, §3.2, §1.2, F1. Requirement ids: `AUTH-R<n>` (authentication, profile, errors, request context) and `DASH-R<n>` (dashboards, navigation shell).

## 1. Objective and scope

Make the platform shell, sign-in, account pages and dashboard a SIGE product: sign in with username or email, force the first-login password change server-side, block deactivated users, translate the template pages (OD-19), build the role-aware sidebar, and deliver the seven dashboards. This module is the P0 foundation of the program (foundation §8): it adds the `person` table, the SIGE request context (`sigeProcedure`, `ScopePolicy`) that every other module builds on, and the shared UI kit.

### In scope

| Screen  | Title (UI)                                      | Delivered as                                                          |
| ------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| AUTH-01 | "SIGE" login                                    | `/sign-in` (existing platform page, adapted)                          |
| AUTH-02 | "Cerrar Sesión" (menu action)                   | existing user-menu sign-out, translated                               |
| AUTH-03 | "Cambiar Contraseña" (forced)                   | new route `/cambiar-contrasena`                                       |
| AUTH-04 | "Mi Perfil"                                     | `/account/profile` + `/account/security` (existing), extended         |
| AUTH-05 | Error pages 400/401/403/404/413/429/500         | router default components + `/error/$code`                            |
| DASH-01 | "Panel de Administración General"               | `/dashboard`, caller kind root                                        |
| DASH-02 | "Dashboard Administrador"                       | `/dashboard`, kind owner/admin                                        |
| DASH-03 | "Dashboard Coordinador"                         | `/dashboard`, kind coordinator                                        |
| DASH-04 | "Dashboard Profesor"                            | `/dashboard`, kind teacher                                            |
| DASH-05 | "Mi Dashboard"                                  | `/dashboard`, kind student                                            |
| DASH-06 | "Portal de Acudientes" landing (children cards) | `/dashboard`, kind parent (foundation §12 #1: built, links to PAR-01) |
| DASH-07 | "Dashboard de Consulta"                         | `/dashboard`, kind viewer or custom role                              |

Also in scope: `person` table; `sigeProcedure` + `requireActivePerson`; `ScopePolicy` interface; forced-password and deactivation enforcement; `username` plugin and sign-in hooks; SIGE-mode switches (§3.6); the permission catalog and built-in role definitions of foundation §4.2 (code in `packages/auth/src/permissions/org.ts`, `platform.ts`); the Spanish translation of platform pages (§5.6); sidebar navigation table (§5.2); shared SIGE UI kit (§5.7).

### Out of scope

- User provisioning, username generation, import, password reset by admins (module 03). This module only consumes `provisionUser`'s output.
- The widgets' source queries owned by other modules (metrics 10, alerts 12, observations 08, schedule 04): this spec fixes the dashboard contract and the empty fallbacks only.
- Parent portal screens PAR-01…06 (module 13); QR-01 "Mi Código QR" (module 14), only its nav entry is listed here.
- Email-based flows for SIGE users (verification, invitation): disabled by OD-20; reset-by-email stays for users with a real email (§3.5).

## 2. Data

### 2.1 Table `person` (new, P0)

Owned here, referenced by every module. Columns per foundation §5.2; one addition is required by the prototype and recorded in §8 (G-AUTH-1):

| Column                       | Type                 | Constraints / notes                                                                    |
| ---------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `id`                         | text PK              | `crypto.randomUUID()` (R2.1)                                                           |
| `organization_id`            | text not null        | FK → `organization(id)` on delete cascade; `unique(organization_id, id)` (R2.3)        |
| `user_id`                    | text not null        | FK → `user(id)` on delete restrict; `unique(user_id)` (one institution per user, R1.9) |
| `first_name`                 | text not null        | ≤ 100 chars, trimmed                                                                   |
| `last_name`                  | text not null        | ≤ 100 chars, trimmed                                                                   |
| `document_type`              | `document_type` enum | `TI`, `CC`, `RC`, `CE`, `Pasaporte`; default `CC`                                      |
| `document_number`            | text not null        | `unique(organization_id, document_number)`; digits and letters, 5–20 chars             |
| `birth_date`                 | date null            |                                                                                        |
| `gender`                     | `gender` enum null   | `M`, `F`, `Otro`                                                                       |
| `phone`, `address`           | text null            | ≤ 30 / ≤ 200                                                                           |
| `country`                    | text null            | default `Colombia`                                                                     |
| `department`, `municipality` | text null            | ≤ 100                                                                                  |
| `has_real_email`             | boolean not null     | default false; OD-1                                                                    |
| `is_active`                  | boolean not null     | default true; R1.22                                                                    |
| `must_change_password`       | boolean not null     | default true; R1.21                                                                    |
| `last_login_at`              | timestamptz null     | **added** (G-AUTH-1); set by the sign-in after-hook; feeds "Último Acceso"             |
| `created_at`, `updated_at`   | timestamptz not null | R2.4                                                                                   |

Indexes (organization first, R2.2): `(organization_id, last_name, first_name)`, `(organization_id, is_active)`, unique `(organization_id, document_number)`, unique `(user_id)`.

`user.name` mirrors `"{first_name} {last_name}"` and is rewritten by `me.updateProfile` and module 03's update (single helper `syncUserName`).

### 2.2 better-auth changes

- Add the `username` plugin: columns `user.username` (unique) and `user.display_username`. Generated with the better-auth CLI into `packages/db/src/schema/auth.ts` and migrated by Drizzle (never hand-edited).
- No other platform table changes. `member.role` stores exactly one built-in role name (R1.9): `owner`, `admin`, `coordinator`, `teacher`, `student`, `parent`, `viewer`.

### 2.3 Migration notes

- One migration: `person` + enums + the username columns. No data backfill (greenfield; template users do not become `person`s).
- Template users that already exist in a pre-SIGE database have no `person`; `requireActivePerson` rejects them with `NO_PERSON` (403). They can only use platform pages (`/account/*`, `/admin/*`). Superadmins never have a `person` and never call `sigeProcedure`s (they use platform procedures or impersonation, foundation §4.4).

## 3. API

### 3.1 Request context (all SIGE modules)

AUTH-R1 `sigeProcedure` = `orgProcedure` + `requireActivePerson`, in `packages/api/src/sige/procedure.ts`. `requireActivePerson`:

1. Loads `person` by `(organization_id = context.org.id, user_id = session.user.id)`; missing → `FORBIDDEN` with code `NO_PERSON`.
2. `is_active = false` → `FORBIDDEN` with code `ACCOUNT_DISABLED` (belt and braces: the sign-in hook already refuses new sessions, §3.4).
3. `must_change_password = true` → `FORBIDDEN` with code `PASSWORD_CHANGE_REQUIRED` for every procedure except the allowlist `{ me.get }`. better-auth's own endpoints (`/change-password`, sign-out, session reads) are not oRPC procedures and are never blocked.
4. Injects `context.person: PersonContext` and `context.scope: ScopePolicy`.

```ts
type CallerKind =
  "owner" | "admin" | "coordinator" | "teacher" | "student" | "parent" | "viewer" | "custom"; // dynamic role: institution-wide, no row scope (R1.10)

type PersonContext = {
  id: string;
  userId: string;
  kind: CallerKind;
  roleName: string;
  firstName: string;
  lastName: string;
  mustChangePassword: false;
};
```

AUTH-R2 `ScopePolicy` (foundation §4.3, `packages/api/src/sige/scope.ts`) is resolved once per request and is the only way module code restricts student-linked rows:

```ts
interface ScopePolicy {
  readonly kind: CallerKind;
  /** True for owner, admin, coordinator, viewer, custom: no row restriction. */
  readonly unrestricted: boolean;
  /** Drizzle predicates over `student` / `offering` to AND into every query; undefined = unrestricted. */
  studentWhere(): SQL | undefined;
  offeringWhere(): SQL | undefined;
  /** Throw NOT_FOUND (never FORBIDDEN, R1.15) when the row is outside tenant or scope. */
  assertStudent(studentId: string): Promise<void>;
  assertOffering(offeringId: string): Promise<void>;
}
```

Teacher scope = offerings with `teacher_person_id = self` whose `teacher_assignment.status` is `activo` or `temporal`, and students of any course with such an offering or where the teacher is `director` (OD-21). Student scope = own `student` row. Parent scope = `student_guardian` links. `ScopePolicy` is unit-tested per kind and by the generated isolation suites (R3.3).

AUTH-R3 Roles and statements. `packages/auth/src/permissions/org.ts` defines the foundation §4.2 catalog and the roles `owner`, `admin`, `coordinator`, `teacher`, `student`, `parent`, `viewer` exactly as the grant table of foundation §4.2; `platform.ts` adds `institution` and `qr: ["simulate"]` for `superadmin`. The `project` example feature and `routers/project.ts` are removed in the same PR (R1.11). A test asserts that every role's statements match the foundation table (the table is transcribed into `permission-matrix.ts` and shared with module tests, R1.13).

### 3.2 Procedures

All are `sigeProcedure` unless stated. Errors follow foundation R3.5.

| Procedure                     | Permission                                               | Input                                                 | Output                                                                                          | Scope / notes                                                                          |
| ----------------------------- | -------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `me.get`                      | any member (exempt from the password gate)               | –                                                     | `Me` (below)                                                                                    | self only                                                                              |
| `me.updateProfile`            | any member                                               | `{ firstName, lastName, phone?, address? }` (zod, §4) | `Me`                                                                                            | self only; rewrites `user.name`; no audit event (self-service, like `account.profile`) |
| `dashboard.counts`            | `overview: ["read"]`                                     | –                                                     | `{ students, teachers, courses, subjects }` (active students; members with role `teacher`)      | DASH-02/03/07                                                                          |
| `dashboard.groupAverages`     | `overview: ["read"]`                                     | –                                                     | `{ period: PeriodRef \| null, rows: { courseId, courseName, average: number \| null }[] }`      | DASH-02 chart "Promedio por grupo"; reference period §6.3                              |
| `dashboard.levelDistribution` | `overview: ["read"]`                                     | –                                                     | `{ period: PeriodRef \| null, rows: { level: "Superior"\|"Alto"\|"Básico"\|"Bajo", count }[] }` | DASH-02 chart "Niveles de desempeño"; level bands foundation §5.4                      |
| `dashboard.approvalByGroup`   | `overview: ["read"]`                                     | –                                                     | `{ period: PeriodRef \| null, rows: { courseId, courseName, approvalRate: number \| null }[] }` | DASH-07; `ganada` share of `final_grade`                                               |
| `dashboard.teacher`           | `grade: ["read"]` and kind `teacher`                     | –                                                     | `TeacherDashboard` (below)                                                                      | own offerings (scope); other kinds → `FORBIDDEN`                                       |
| `dashboard.student`           | `portal: ["read_self"]`                                  | –                                                     | `StudentDashboard`                                                                              | own student row                                                                        |
| `dashboard.parent`            | `portal: ["read_child"]`                                 | –                                                     | `{ children: { studentId, name, courseName: string \| null, document, relationship }[] }`       | linked students                                                                        |
| `dashboard.root`              | platform `institution: ["create"]` (`platformProcedure`) | –                                                     | `RootDashboard`                                                                                 | all institutions; no tenant context                                                    |

```ts
type Me = {
  user: { id: string; username: string; email: string | null; name: string }; // email null when placeholder (OD-1)
  person: {
    id;
    firstName;
    lastName;
    documentType;
    documentNumber;
    phone: string | null;
    address: string | null;
    hasRealEmail: boolean;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
  };
  kind: CallerKind;
  roleName: string;
  org: { id: string; name: string; slug: string; logo: string | null };
  institution: {
    municipality: string | null;
    department: string | null;
    currentAcademicYear: string;
  };
  impersonating: boolean; // session.impersonatedBy present: UI shows the "Vista Root" badge
};
type PeriodRef = { id: string; name: string; shortName: string };
type TeacherDashboard = {
  counts: { offerings: number; students: number; courses: number };
  classes: { offeringId; subjectName; subjectCode: string | null; courseId; courseName }[];
  analytics: TeacherClassStats[]; // module 10 (`metric.teacherClassStats`); [] until it lands
  suggestions: TeacherSuggestion[]; // module 10 rules (foundation §5.5); [] until it lands
};
type StudentDashboard =
  | { profile: null }
  | {
      profile: { studentId; name; courseName: string | null; document: string };
      periodScores: { period: PeriodRef | null; rows: { subjectName; score: number | null }[] };
      schedule: WeeklySchedule | null;
    }; // module 04 type; null when the course has no schedule
type RootDashboard = {
  totals: { institutions; users; students; teachers; admins };
  institutions: {
    id;
    name;
    nit: string | null;
    municipality;
    department;
    academicYear;
    counts: { admins; campuses; teachers; students; users };
  }[];
};
```

AUTH-R4 `me.get` resolves `kind` from `member.role` (single built-in name; any other value → `custom`). The web derives navigation and the dashboard variant from `kind` and `useCan` (R1.25/R1.26), never from `roleName`.

AUTH-R5 Dashboard counts are single aggregate queries per procedure (`count(*) filter`), tenant-filtered, `students` = `student.status = 'activo'` (R2.10), `teachers` = members with role `teacher` and `person.is_active`. `dashboard.root` counts `admins` as members with role `owner` or `admin`; `students` per institution counts active students.

### 3.3 Audit

No new action names. Existing `user.password_changed` (account spec R3.5) is written by the better-auth after-hook; for a forced change its `metadata` carries `{ forced: true }`. Dashboard reads are not audited.

### 3.4 Authentication hooks (`packages/auth`)

AUTH-R6 `username` plugin enabled. Sign-in accepts one identifier: contains `@` → `signIn.email`, otherwise `signIn.username`; the web decides, the server exposes both endpoints.

AUTH-R7 Before-hook on `/sign-in/email` and `/sign-in/username`: resolve the user's `person` (any organization); `is_active = false` → reject with message **"Su cuenta está desactivada. Contacte al administrador."** and create no session. Users without a `person` (platform admins) pass.

AUTH-R8 After-hook on sign-in success: set `person.last_login_at = now()`.

AUTH-R9 After-hook on `/change-password` (and the platform reset-password completion): `person.must_change_password = false`, other sessions revoked (account spec R3.5), audit `user.password_changed`. A module-03 admin reset sets the flag back to true (R1.21).

AUTH-R10 Rate limit (better-auth `rateLimit.customRules`): sign-in endpoints and `/change-password` allow 5 requests per 60 s per IP + path; the response maps to AUTH-05 code 429. Verify the window against load tests; the initial password is guessable (OD-2), so this is the primary mitigation.

AUTH-R11 Placeholder-email users (`has_real_email = false`) cannot use email flows: the web hides "¿Olvidó su contraseña?" results for them by design (the endpoint answers identically, account spec R3.2) and the email-change control in AUTH-04 is read-only (OQ-AUTH-1).

### 3.5 SIGE mode

AUTH-R12 One deployment switch `SIGE_MODE` (server env, boolean, default `false`; exposed to web as `VITE_SIGE_MODE`). When true: self sign-up and `/onboarding` org creation are disabled (R1.12: `DEFAULT_MAX_ORGS_PER_USER=0`), invitation UI and `/accept-invitation/*` are hidden and rejected, `/account/danger` (self account deletion) is hidden, the sidebar is the SIGE table of §5.2, and `provisionUser` is the only way to add members. When false the template behaves as before (template tests keep passing). The flag name is a spec decision (OQ-AUTH-2).

## 4. Business rules and validation

Spanish copy is verbatim from the prototype (`-screens/*`) and inventory §3.1.

### 4.1 AUTH-01 sign-in

| Case                             | Behaviour                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Empty identifier or password     | Inline warning (amber) **"Por favor ingrese usuario y contraseña."**; no request                      |
| Wrong credentials / unknown user | Inline error (red) **"Usuario o contraseña incorrectos."** (identical for both, no user enumeration)  |
| Deactivated person               | Inline error **"Su cuenta está desactivada. Contacte al administrador."** (AUTH-R7)                   |
| Success, `must_change_password`  | Toast **"⚠️ Debe cambiar su contraseña antes de continuar."**, redirect `/cambiar-contrasena`         |
| Success                          | Toast **"Bienvenido/a, {nombre}!"** (first name), redirect to `redirect` search param or `/dashboard` |
| Too many attempts (429)          | Inline error "Demasiados intentos. Intente de nuevo en unos minutos."                                 |

### 4.2 AUTH-03 forced change

Fields: "Contraseña Actual", "Nueva Contraseña", "Confirmar Nueva Contraseña" (each with show/hide toggle). The submit "Actualizar Contraseña" is disabled until all three are filled, the new password satisfies the platform policy (default minimum 8; verify the configured value, R1.24) and equals the confirmation. Live match message: **"Las contraseñas coinciden"** / **"Las contraseñas no coinciden"**. Strength meter levels (labels verbatim): "Ingrese una contraseña" (empty), "Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"; five checks: length ≥ 8, length ≥ 12, uppercase, digit, symbol (prototype's 6/8 thresholds shift up with the policy; the pure function lives in `features/auth/lib/password-strength.ts` with unit tests).

Server errors (mapped from better-auth): **"La contraseña actual es incorrecta."**, **"La nueva contraseña debe tener al menos 8 caracteres."** (number from config), **"Las contraseñas nuevas no coinciden."** (client), **"La nueva contraseña debe ser diferente a la actual."** (client + server). Success: toast **"✅ Contraseña actualizada exitosamente. Ahora puede acceder al sistema."**, redirect `/dashboard`.

The "Contraseña Actual" helper reads **"Si es su primer acceso, es su número de documento."** The prototype prints the document number itself; that is dropped because an admin reset can set a different temporary password (AUTH-R9) and the page would then lie.

Page content: header "Cambiar Contraseña", sub "Es obligatorio cambiar su contraseña antes de continuar", user box (full name + username), footer "Esta contraseña será su acceso permanente al sistema". No sidebar; no navigation except sign-out.

### 4.3 AUTH-04 profile

- "Información Personal" form: "Nombre *", "Apellido *", "Correo Electrónico *", "Teléfono", "Dirección"; button "Actualizar Información". Errors: **"El nombre es obligatorio."**, **"El apellido es obligatorio."**, **"El correo es obligatorio."**. Success toast "Información actualizada".
- "Correo Electrónico" is editable only when `person.has_real_email`; it then uses the existing verified email-change flow (account spec R2). For placeholder users it is a disabled field with help "Contacte al administrador para registrar un correo." (OQ-AUTH-1).
- "Información de Cuenta" (read-only): "Usuario", "Rol" (badge), "Documento" (`{tipo} {número}`), "Último Acceso" (`dd/mm/yyyy HH:MM` in `America/Bogota`, or **"Nunca"**).
- "Cambiar Contraseña" card (on `/account/security`): "Contraseña Actual *", "Nueva Contraseña *" (hint "Mínimo 8 caracteres"), "Confirmar Contraseña *"; button "Cambiar Contraseña"; errors as §4.2 plus "Completa los tres campos de contraseña."

### 4.4 AUTH-05 error pages

One layout, copy verbatim:

| Code | Title                      | Message                                                                 |
| ---- | -------------------------- | ----------------------------------------------------------------------- |
| 400  | Solicitud Incorrecta       | La solicitud no pudo ser procesada. Verifica los datos enviados.        |
| 401  | No Autorizado              | Debes iniciar sesión para acceder a esta página.                        |
| 403  | Acceso Prohibido           | No tienes permiso para acceder a esta página.                           |
| 404  | Página No Encontrada       | La página que buscas no existe o fue movida.                            |
| 413  | Archivo Demasiado Grande   | El archivo que intentas subir supera el tamaño máximo permitido.        |
| 429  | Demasiadas Solicitudes     | Has realizado demasiadas solicitudes. Intenta de nuevo en unos minutos. |
| 500  | Error Interno del Servidor | Ha ocurrido un error inesperado. Por favor intente nuevamente.          |

Buttons: "Volver Atrás" (history back) and "Ir al Dashboard"; 403 shows a single "Volver al Inicio". Codes ≥ 500 add the note **"Nota: Si el problema persiste, contacta al administrador del sistema."** Unknown codes render 404. No shell.

### 4.5 Dashboard rules

- DASH-R1 The landing role is decided by `kind` (foundation R1.26). `kind = custom` renders DASH-07's layout without the "Modo Solo Lectura" callout copy changed: the callout shows **"Tienes acceso de consulta a la información del sistema. Contacte al administrador si necesita permisos adicionales."** only for `viewer`; a custom role sees its permitted KPI blocks (each widget is gated by its own permission).
- DASH-R2 Every KPI/link block is hidden, not disabled, when the caller lacks the target permission (`useCan`).
- DASH-R3 "Teacher state" labels and thresholds (foundation §5.5): failing rate > 30 → "Riesgo Alto"; else average < 3.5 → "Atención Necesaria"; else "Óptimo". The rate bar tone is destructive > 30, warning > 15, success otherwise (prototype `RateBar`).
- DASH-R4 "Sugerencias IA" is renamed **"Sugerencias automáticas"** (OD-15); empty state **"¡Excelente trabajo!"** + "No se detectan anomalías críticas en el rendimiento de tus grupos."
- DASH-R5 Student chart bands (display vocabulary, foundation §12 #8): "Excelente (4.5 a 5.0)", "Bueno (4.0 a 4.4)", "Aceptable (3.0 a 3.9)", "En riesgo (menos de 3.0)".

## 5. Web

Routes follow foundation R3.30: thin files under `routes/_auth/`, features in `apps/web/src/features/`. New feature folders: `features/dashboard` (widgets), `features/navigation` (sidebar table), `features/auth` (extended), `features/sige-shell` is not created; the shared kit lives in `shared/components/sige` (§5.7).

### 5.1 Routes

| Route                                   | Screen     | Guard                                                                            | Notes                                                                                      |
| --------------------------------------- | ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/sign-in` (`/login` redirects)         | AUTH-01    | public; signed-in users redirect to `/dashboard`                                 | `AuthLayout`/`AuthCard` of the shell spec; brand panel shows "SIGE" and the tagline        |
| `/cambiar-contrasena`                   | AUTH-03    | session; reachable only when `me.person.mustChangePassword`, else → `/dashboard` | no shell                                                                                   |
| `/dashboard`                            | DASH-01…07 | session + active org (superadmin without org: root dashboard)                    | variant by `kind` (§5.3)                                                                   |
| `/account/profile`, `/account/security` | AUTH-04    | session                                                                          | existing routes extended (§4.3)                                                            |
| `/error/$code`                          | AUTH-05    | public                                                                           | also `defaultNotFoundComponent` (404), `defaultErrorComponent` (500), `NoPermission` (403) |

AUTH-R13 Route guard order in `_auth/route.tsx`: session → `me.get` → if `mustChangePassword` and the path is not `/cambiar-contrasena` → redirect there (everything else, including `/dashboard`, is unreachable) → org guard. Server enforcement is AUTH-R1; the redirect is UX.

AUTH-R14 oRPC error mapping in one place (`shared/lib/orpc-errors.ts`): `UNAUTHORIZED` → sign-in with `redirect`; `PASSWORD_CHANGE_REQUIRED` → `/cambiar-contrasena`; `ACCOUNT_DISABLED` → sign out + sign-in with the §4.1 message; `FORBIDDEN` → `NoPermission` page; `NOT_FOUND` → `NotFoundBlock`; `BAD_REQUEST` → field errors (`shared/lib/form-errors.ts`); 413/429/5xx → AUTH-05.

### 5.2 Sidebar (DASH-R6)

Source: prototype `-nav.ts`, ported to `features/navigation/sige-nav.ts` as data; `filterNavGroups` (existing) keeps children whose `requires` the caller holds. Sections "Gestión", "Académico", "Familia", "Acceso" (foundation §12 #10). A leaf is shown iff the caller holds its permission (R1.25), so custom roles work. Student entries "Mi Horario", "Mis Notas", "Mi Asistencia", "Mis Observaciones", "Mis Logros" and the teacher "Métricas" → MET-05 (R1.27) are separate leaves guarded by `portal:read_self` / `metric:read_own`.

| Label (section)                                                                                                    | Screen                                     | Route                                                                                                        | Requires                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Dashboard                                                                                                          | DASH-*                                     | `/dashboard`                                                                                                 | any member (root: platform)                                                                               |
| Institución › Gestionar Instituciones (root)                                                                       | INS-01                                     | `/admin/instituciones`                                                                                       | platform `institution:create`                                                                             |
| Institución › Datos Institución                                                                                    | INS-06                                     | `/configuracion-institucion`                                                                                 | `institution:update`                                                                                      |
| Institución › Sedes                                                                                                | INS-07                                     | `/sedes`                                                                                                     | `campus:create` (management only; coordinators reach it by link, §5.5)                                    |
| Institución › Niveles Académicos                                                                                   | INS-09                                     | `/niveles`                                                                                                   | `level:create`                                                                                            |
| Institución › Cursos                                                                                               | INS-11                                     | `/cursos`                                                                                                    | `course:create`                                                                                           |
| Institución › Asignaturas                                                                                          | INS-13                                     | `/asignaturas`                                                                                               | `subject:create`                                                                                          |
| Institución › Periodos                                                                                             | INS-15                                     | `/periodos`                                                                                                  | `period:create`                                                                                           |
| Institución › Criterios Evaluación                                                                                 | INS-17                                     | `/criterios`                                                                                                 | `criterion:create`                                                                                        |
| Usuarios › Todos / Profesores / Coordinadores / Estudiantes / Acudientes                                           | USR-01                                     | `/usuarios` (`?role=`)                                                                                       | `user:read`                                                                                               |
| Usuarios › Nuevo Usuario                                                                                           | USR-02                                     | `/usuarios/nuevo`                                                                                            | `user:create`                                                                                             |
| Matrícula y Programación › Matrículas, Asignar Profesores, Materias por Grado, Salones, Horarios, Bloques Horarios | SCH-01/03/05/07/11/09                      | `/matriculas`, `/asignaciones`, `/materias-por-grado`, `/salones`, `/horarios`, `/bloques`                   | `enrollment:read`, `offering:read`, `offering:read`, `classroom:read`, `schedule:read`, `time_block:read` |
| Estudiantes                                                                                                        | STU-01                                     | `/estudiantes`                                                                                               | `student:read`                                                                                            |
| Notas                                                                                                              | GRD-01                                     | `/notas`                                                                                                     | `grade:write` or `grade:read` (non-portal)                                                                |
| Asistencia                                                                                                         | ATT-01                                     | `/asistencia`                                                                                                | `attendance:record`                                                                                       |
| Observaciones                                                                                                      | OBS-01                                     | `/observaciones`                                                                                             | `observation:read`                                                                                        |
| Boletines                                                                                                          | RPT-01                                     | `/boletines`                                                                                                 | `report_card:generate`                                                                                    |
| Métricas                                                                                                           | MET-01                                     | `/metricas`                                                                                                  | `metric:read`                                                                                             |
| Métricas (teacher)                                                                                                 | MET-05                                     | `/metricas/docente`                                                                                          | `metric:read_own`                                                                                         |
| Logros                                                                                                             | ACH-01                                     | `/logros`                                                                                                    | `achievement:read`                                                                                        |
| Alertas Tempranas (+ badge)                                                                                        | ALR-01                                     | `/alertas`                                                                                                   | `alert:read`                                                                                              |
| Mi Horario / Mis Notas / Mi Asistencia / Mis Observaciones / Mis Logros (student)                                  | SCH-11 / GRD-08 / ATT-02 / OBS-05 / ACH-02 | `/horarios`, `/notas/estudiante`, `/asistencia/estudiante`, `/observaciones/historial`, `/logros/estudiante` | `portal:read_self`                                                                                        |
| Portal Padres (Familia)                                                                                            | PAR-01                                     | `/portal-padres`                                                                                             | `portal:read_child`                                                                                       |
| Monitoreo QR (Acceso)                                                                                              | QR-03                                      | `/qr/monitoreo`                                                                                              | `qr:monitor`                                                                                              |
| Mi Código QR (Acceso)                                                                                              | QR-01                                      | `/qr`                                                                                                        | any member                                                                                                |

Collapsible parents open when a child path is active. The "Alertas Tempranas" badge uses `alert.countActive` (module 12), cap "99+", refetch on window focus and after alert mutations (R1.28); hidden at 0 and when the caller lacks `alert:read`.

Header: breadcrumbs, user menu with "Dashboard", "Mi Perfil", divider, "Cerrar Sesión" (destructive); role badge from `ROLE_TONE` (root = default, admin/owner = success, coordinator = info, teacher = warning, student/parent = secondary, viewer = outline). `shared/lib/role-label.ts` maps role names to the labels "Root", "Administrador" (owner and admin), "Coordinador", "Profesor", "Estudiante", "Acudiente", "Consulta". Sidebar footer: avatar initials, full name, role badge. The org switcher is hidden in SIGE mode (one institution per user).

### 5.3 Dashboards (DASH-R7…)

Layout: `PageHeader` (title + description) and `StatGrid`/`StatTile` KPI rows, `SectionCard` blocks, `ActionLink`/`config_link` cards. All data from §3.2; each widget has loading skeleton, `LoadError` with retry and an empty state.

| Screen  | Header (title / description)                                                                                                                                 | Blocks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Source                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| DASH-01 | "Panel de Administración General" / "Gestión centralizada de todas las instituciones educativas"; action "Nueva Institución" (→ INS-02)                      | 5 KPI tiles "Instituciones", "Usuarios", "Estudiantes", "Profesores", "Admins" (`toLocaleString("es-CO")`); "Instituciones Registradas": cards with name, "NIT: …", "{municipio}, {departamento}", badge year, "Distribución de Usuarios" stacked bar (Estudiantes/Profesores/Admins %; **"Sin usuarios registrados aún"** at 0), mini counters "Admins", "Sedes", "Profesores", "Estudiantes", actions "Usuarios" (→ INS-04), "Editar" (→ INS-02), "Gestionar Sedes" (starts impersonation of the rector, then `/sedes`, foundation §4.4); empty **"No hay instituciones creadas"** / "Comience creando la primera institución educativa del sistema." + "Crear Primera Institución"; "Accesos Rápidos": "Gestionar Usuarios" ("Crear, editar y eliminar usuarios", → `/admin/users`), "Lista Instituciones" (→ INS-01), "Ver Admins" ("Gestionar administradores", → INS-01, whose rows open INS-04), "Cambiar Institución" ("Alternar contexto activo", → INS-03) | `dashboard.root`                                                   |
| DASH-02 | "Dashboard Administrador" / "Gestión integral de tu institución educativa"; institution banner badge "Tu Institución" (**"Vista Root"** while impersonating) | KPIs "Estudiantes", "Profesores", "Grados", "Asignaturas"; "Acciones Rápidas" (Gestionar Estudiantes → STU-01, Matrícula y Programación → SCH-01, Ingresar Notas → GRD-01, Generar Boletines → RPT-01, Ver Métricas → MET-01); "Configuración del Sistema" six links: "Datos Institución" (Nombre, NIT, contacto), "Gestión de Sedes" (Crear y editar sedes), "Gestión de Grados" (Grados y grupos), "Asignaturas" (Materias y códigos), "Periodos Académicos" (Periodos y fechas), "Criterios Evaluación" (Ponderación de notas); charts "Promedio por grupo" (description "{periodo}, escala 1.0 a 5.0"; "Sin periodo" when none) and "Niveles de desempeño" ("Notas finales de {periodo}").                                                                                                                                                                                                                                                                       | `dashboard.counts/groupAverages/levelDistribution`                 |
| DASH-03 | "Dashboard Coordinador" / "Supervisión académica y seguimiento institucional · {nombre}"; banner badge "Coordinación"                                        | Same four KPIs (all populated, inventory quirk fixed); "Acciones Rápidas" (Ver Estudiantes, Matrícula y Programación, Observaciones, Métricas, Alertas); "Resumen Académico" (Grados — Gestión académica, Asignaturas — Materias, Periodos — Periodos académicos, Criterios — Evaluación); "Alertas activas" chart by severity ("{n} sin resolver") and "Observaciones recientes" table (Estudiante, Tipo, Descripción, Autor, Fecha; last 10).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `dashboard.counts` + alert summary (12) + recent observations (08) |
| DASH-04 | "Dashboard Profesor" / "Bienvenido/a, {nombre completo}"                                                                                                     | KPIs "Asignaturas", "Estudiantes a Cargo", "Grados"; "Analítica de Desempeño" (chip "Longitudinal por Materia"; columns "Materia / Grado", "Jornada", "Promedio", "Reprobación" bar + "{n}%", "Estado" with icon; empty "Sin datos de desempeño" / "Aún no hay notas finales registradas."); "Sugerencias automáticas" (alert per suggestion + "**Sugerencia:** …"); chart "Promedio por clase" (bar colour by state); "Gestión de Clases" table (Asignatura + code, Grado badge, buttons "Notas" → GRD-02, "Asistencia" → ATT-01, "Observaciones" → OBS-03; empty **"No tienes asignaturas asignadas aún"** / "Contacta al administrador para que te asigne materias y grados.").                                                                                                                                                                                                                                                                                   | `dashboard.teacher`                                                |
| DASH-05 | "Mi Dashboard" / "Bienvenido/a, {nombre}"                                                                                                                    | Profile card (avatar, name, "Grado: {curso}" or "No asignado", document, badge course / "Sin grado"); link cards "Mis Notas" (Ver calificaciones por periodo), "Mi Asistencia" (Historial de asistencia), "Mis Observaciones" (Seguimiento de comportamiento); chart "Mis notas de {periodo}" ("Nota final por asignatura, escala 1.0 a 5.0"; empty "Sin notas registradas"); "Mi Horario de Clases" weekly grid (empty **"No se ha generado el horario para tu grado todavía."**). No profile: **"Perfil académico no configurado"** / "Contacta al administrador para que asigne tu grado y grupo."                                                                                                                                                                                                                                                                                                                                                                | `dashboard.student`                                                |
| DASH-06 | "Portal de Acudientes" / "Bienvenido/a, {nombre}"; action "Ir al portal completo" (→ PAR-01)                                                                 | Child cards: name, relationship, badge course, "Grado", "Documento", button "Ver Notas" (→ PAR-02 for the child); empty **"No tienes estudiantes asignados"** / "Contacta al administrador."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `dashboard.parent`                                                 |
| DASH-07 | "Dashboard de Consulta" / "Bienvenido/a, {nombre} - Modo solo lectura"; banner badge "Solo lectura"                                                          | KPIs as DASH-02; callout "Modo Solo Lectura"; chart "Aprobación por grupo" ("Porcentaje de asignaturas ganadas en {periodo}").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `dashboard.counts/approvalByGroup`                                 |

Dashboard UI components are ported from the prototype screens; charts reuse `-components/charts.tsx` palettes (R3.32), moved to `shared/components/sige/charts.tsx`.

### 5.4 Account area

`/account/profile` shows the two profile cards of §4.3 (replaces the single "name" form in SIGE mode); `/account/security` keeps the platform sections (sessions, security log) and the "Cambiar Contraseña" card; `/account/preferences` (theme) unchanged; `/account/danger` hidden (AUTH-R12). Email-change and sessions sections are translated.

### 5.5 Coordinator and teacher access to configuration lists

Coordinators have `read` on campus/level/course/period and teachers on subject/criterion (foundation §4.2). They have no sidebar group "Institución" (matches the prototype: inventory §1.2) but reach the lists from dashboard links and breadcrumbs; list routes are guarded by `*:read`, create/edit routes by `*:create|update`. The sidebar rows of §5.2 use `*:create` for the group so only management sees it.

### 5.6 Translation of platform pages (OD-19)

Copy-only change; no i18n framework (out of scope). Pages: sign-in, forgot/reset password, verify-email, account (profile, security, preferences), organization settings (general, members, roles editor with permission labels, activity log with action labels from foundation §6.9), admin area (users, user detail, organizations, activity), error and empty states of shared components (`EmptyState`, `LoadError`, `NoPermission`, `ConfirmDialog`, data-table chrome: "Buscar", "Filtros", "Columnas", "Anterior", "Siguiente", "Filas por página", "Sin resultados"). Dates `dd/mm/yyyy`, times 24 h via `Intl` `es-CO` (R3.12). Hidden pages (`sign-up`, invitations, onboarding) are translated too so enabling them later needs no copy work.

### 5.7 Shared SIGE UI kit

Ported from `prototype/sige/-components` to `apps/web/src/shared/components/sige` (domain-agnostic, no data fetching, one story each per `storybook.md`): `StatTile`/`StatGrid`, `SectionCard`, `Callout`, `ToneBadge`, `ScoreBadge`, `InstitutionBanner`, `EmptyBlock` (wraps `EmptyState`), `NotFoundBlock`, `ActionLink`, `FormLayout`/`FormCard`/`HelpCard`/`HelpList`, `CheckList`, `ConfirmDelete`, `PasswordInput`, `StrengthMeter`, `StudentStrip`, `WeeklySchedule`, `charts`. List screens use the existing `DataTable`/`SimpleListTable` (data-table spec), not the prototype's `SimpleTable`. Modules 02–14 import this kit; none re-implements a stat tile or callout.

## 6. Flows and audit

### 6.1 Flows touched

F1 (first login and forced password change) end to end: sign-in (AUTH-01) → `/cambiar-contrasena` (AUTH-03) → role dashboard; later changes in AUTH-04; admin reset re-arms the flag (module 03). F2 step 1 (root creates an institution) lands on DASH-01 cards (module 02). F12/F14/F15 start at DASH-06/04/05.

### 6.2 Audit events

`user.password_changed` (`forced` metadata). No other events; sign-in and dashboard reads are not audited. Deactivation events belong to module 03.

### 6.3 Reference period

DASH-R8 Dashboard charts use the **reference period** (prototype `referencePeriod`): the latest non-active period of the current academic year (by `end_date`) that has at least one `final_grade`; if none, the active period when it has finals; otherwise `period: null` and the widget renders "Sin periodo" / "Sin datos". "Closed" here means "no longer the active period", not locked: locks are per offering × period (foundation §12 #2).

## 7. Testing and acceptance

### 7.1 Tests

- **Unit** (`packages/sige-core`, `bun:test`): password-strength levels (5 checks, boundary lengths 7/8/11/12); reference-period selection (no periods, only the active period, closed periods without finals, several closed periods ordered by `end_date`); teacher state thresholds (30.0 / 30.01, 3.49 / 3.5); distribution bands at 2.995, 3.0, 3.995, 4.0, 4.595, 4.6.
- **API integration** (Postgres): `sigeProcedure` gate matrix (no person, inactive, must-change, active) for `me.get` and a pilot procedure (P0 exit criterion); `me.updateProfile` rewrites `user.name`; deactivated user cannot create a session (AUTH-R7); after-hook clears the flag and revokes other sessions; rate limit returns 429 on the 6th attempt; `dashboard.root` forbidden for a rector; each `dashboard.*` returns counts equal to seeded rows and only the caller's tenant (two-tenant fixture); `dashboard.teacher` is `FORBIDDEN` for a coordinator; `dashboard.parent` lists only linked children; permission-matrix test generated from `permission-matrix.ts` for every role.
- **Web** (component + `bun:test`): sign-in identifier routing (`@` → email), all four error messages of §4.1; AUTH-03 submit-enabled rules and match message; route guard redirect when `mustChangePassword`; nav filtering per `kind` and custom role; each dashboard variant renders its empty states; error page copy for each code; story per new presentational component (`autodocs`, light/dark). A denylist test asserts no template English strings ("Welcome back", "Sign in", "Members", …) render on translated pages.

### 7.2 Acceptance

- AUTH-01: username and email both sign in; the five outcomes of §4.1 show the exact copy; a deactivated user gets no session.
- AUTH-03: a freshly provisioned user cannot reach any page or call any SIGE procedure except `me.get` until the password changes (`PASSWORD_CHANGE_REQUIRED`); after the change they land on their dashboard.
- AUTH-04: profile edits persist and update the header name; "Último Acceso" shows "Nunca" before the first login.
- AUTH-05: every code renders title, message and the right buttons; unknown code → 404; the 403 page has one button.
- DASH-01…07: each role lands on its dashboard; KPI numbers equal the database; widgets with no data show the specified empty copy; no widget calls a procedure the role lacks; DASH-06 links to PAR-01/PAR-02.
- Sidebar: for each of the 7 kinds the visible entries equal inventory §1.2 as adapted by foundation §12 #10; a custom role sees exactly the entries its permissions allow.
- P0 exit criterion of foundation §8 (rector signs in with username + document number, is forced to AUTH-03, lands on DASH-02).

## 8. Open questions and notes for the foundation

### 8.1 New open questions

| ID        | Question                                                           | Recommended default                                                                                                                                          |
| --------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OQ-AUTH-1 | Can a user without a real email register one themselves (AUTH-04)? | No in v1: only an admin (module 03) sets a real email for placeholder users, so the verification mail path is never exercised against an `.invalid` address. |
| OQ-AUTH-2 | Name and shape of the SIGE deployment switch (R1.12, OD-20)        | Single boolean `SIGE_MODE` / `VITE_SIGE_MODE` (§3.5); template behaviour unchanged when off.                                                                 |
| OQ-AUTH-3 | Meaning of "Recordarme" with better-auth sessions                  | Maps to `rememberMe`: unchecked = browser-session cookie; checked = the configured session lifetime (better-auth default).                                   |

### 8.2 Gaps found in 00-foundation.md (for the owner of that file)

- G-AUTH-1 `person` lacks `last_login_at`, needed by "Último Acceso" (AUTH-04, USR-03). Added here; foundation §5.2 should list it.
- G-AUTH-2 §4.5 R1.21 says the flag clears "in the `/change-password` after-hook": the platform reset-password completion must also clear it (AUTH-R9).
- G-AUTH-3 §4.2 has no permission for "dashboard teacher": this spec gates it on `grade:read` + kind `teacher`; consider an explicit `overview.read_own` if custom roles need it.
