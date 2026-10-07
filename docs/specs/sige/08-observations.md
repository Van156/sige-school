# Spec: SIGE — Observations (OBS)

- **Status:** Approved (product owner accepted every recommended default on 2026-10-07)
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query + Form (web), Drizzle + Postgres, `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.2 `observation` grants, §4.3 scope, §5.2 `observation`, §5.3 R2.10, §6.4 delete policy, §6.9 audit, §6.10 notifications, OD-11, OD-21), [`05-students.md`](./05-students.md) (`student.pick`, `StudentStrip`, `StudentSwitcher`), [`07-attendance.md`](./07-attendance.md) (G-ATT-1), [`01-auth-and-dashboards.md`](./01-auth-and-dashboards.md) (DASH-03 consumer), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/observations/*`, `-components/observation-parts.tsx`, `-lib/observations.ts`, `-mock/engagement.ts` (`markObservationNotified`), `-screens/parent/child-observations-screen.tsx`. Inventory §3.9, F7. Requirement ids: `OBS-R<n>`. Phase P5.

## 1. Objective and scope

Behaviour observations ("Observaciones de Comportamiento"): staff record positive, negative, follow-up and coexistence ("convivencia") notes about a student; negative and convivencia notes are flagged as needing guardian notification, which staff then mark manually. The student and the guardians read the same records (OBS-05, PAR-04). Observations feed the dashboards (DASH-03 recent list, PAR-01 block), the achievement "Compañero" (module 11) and the report-card workflow only as context.

### In scope

| Screen | Title                                              | Roles                               | Real route                                                     |
| ------ | -------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| OBS-01 | "Observaciones de Comportamiento"                  | R, A, C; T (own students)           | `/observaciones`                                               |
| OBS-02 | "Detalle de Observación"                           | R, A, C; T (own students)           | `/observaciones/$observationId`                                |
| OBS-03 | "Nueva Observación" / "Editar Observación"         | R, A, C; T (own students; edit own) | `/observaciones/nueva`, `/observaciones/$observationId/editar` |
| OBS-04 | "Observación Rápida"                               | R, A, C; T (own students)           | `/observaciones/rapida?student=`                               |
| OBS-05 | "Historial de Observaciones" ("Mis Observaciones") | R, A, C; T (own students); S own    | `/observaciones/historial?student=`                            |

"R" means a superadmin impersonating the rector (foundation §4.4). The static segments `nueva`, `rapida` and `historial` never collide with `$observationId` (ids are UUIDs).

Also in scope: table `observation`; the pure rules in `packages/sige-core/src/observations.ts`; the CSV export; the recent-observations read used by DASH-03.

### Out of scope

- Real messaging to guardians: "notificada" is a manual flag (OD-11, R3.29). A `NotificationPort` is the later extension point.
- PAR-04 (module 13) reuses `observation.studentHistory`; there is no parent copy of the endpoint (R1.16).
- Attachments, comment threads, editing history beyond `updated_at`, and a student's own authorship of observations.

## 2. Data

Conventions R2.1–R2.6. Tenant-safe composite FKs to `student` and `person`.

| Table         | Columns and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Indexes                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observation` | `student_id`, `author_person_id`, `type` enum `observation_type` (`positiva`, `negativa`, `seguimiento`, `convivencia`), `category` text null (one of the 7 values of §3), `description text not null` ≤ 2000, `commitments` text null ≤ 1000, `observed_at timestamptz not null`, `notified bool not null default false`, `notified_at` null, `notified_by` null (→ `person`), `requires_notification bool` **stored generated** (`type in ('negativa','convivencia')`), `created_at`, `updated_at`. `check (notified = (notified_at is not null))`. FKs `restrict` (a student with observations is never deleted, §6.4). | `(organization_id, student_id, observed_at desc)`, `(organization_id, observed_at desc)`, `(organization_id, author_person_id)`, partial `(organization_id, observed_at desc) where requires_notification and not notified` |

The foundation's `requires_notification` is "derived" (§5.2); a stored generated column keeps the pending filter and its partial index in SQL. No other table. Migration: enum + table. The seed (R4) writes about 35 observations, including the positive ones that drive "Compañero".

## 3. Rules (`packages/sige-core/src/observations.ts`)

Pure, shared by API, web, seed, achievement engine and dashboards (R3.18).

| Item                         | Definition                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OBSERVATION_TYPES`          | `positiva` "Positiva" 👍 (green), `negativa` "Negativa" ⚠️ (red), `seguimiento` "Seguimiento" 📋 (blue), `convivencia` "Convivencia" 🤝 (amber). Hints for OBS-04: "Reconocimiento de buen comportamiento o logro", "Comportamiento inadecuado o falta grave", "Monitoreo de progreso o situación", "Aspectos relacionados con la convivencia escolar". |
| `OBSERVATION_CATEGORIES`     | "Disciplina", "Rendimiento", "Valores", "Convivencia", "Responsabilidad", "Participación", "Otro". OBS-04 offers the first six (prototype).                                                                                                                                                                                                             |
| `requiresNotification(type)` | `negativa` or `convivencia`.                                                                                                                                                                                                                                                                                                                            |
| `isPending(o)`               | `requiresNotification(o.type) && !o.notified`.                                                                                                                                                                                                                                                                                                          |
| `countObservations(rows)`    | `{ total, positiva, negativa, seguimiento, convivencia, notified, pending }`.                                                                                                                                                                                                                                                                           |

## 4. API

Router `routers/sige/observation.ts` (`observationRouter`), all `sigeProcedure.use(requirePermission(...))`; `context.scope.assertStudent()` first. Other tenant or out-of-scope student or observation → `NOT_FOUND` (R1.15). Errors per R3.5. Lists use the shared list contract (R3.8).

### 4.1 Procedures

| Procedure                    | Permission                                                     | Input                                                                                                                                                                                                                                                                                   | Output                                                                                                        | Notes                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observation.list`           | `observation:read`                                             | list input (`observation-list-config.ts`: sort `observedAt`, `student`, `type`, `category`, `author`; filters `search` text (student name, description, category, author), `type` select, `category` select, `authorId` select, `observedAt` dateRange; default sort `observedAt` desc) | `{ rows: ObservationRow[], total }`                                                                           | OBS-01 table (server-driven, R3.8); scope-filtered                                                                                                    |
| `observation.stats`          | `observation:read`                                             | –                                                                                                                                                                                                                                                                                       | `ObservationCounts` (§3)                                                                                      | OBS-01 tiles; scope only, **not** the table filters (prototype)                                                                                       |
| `observation.filterOptions`  | `observation:read`                                             | –                                                                                                                                                                                                                                                                                       | `{ categories: string[], authors: { id, name }[] }`                                                           | categories and authors that occur in the caller's scope                                                                                               |
| `observation.get`            | `observation:read`                                             | `{ id }`                                                                                                                                                                                                                                                                                | `ObservationDetail` = `ObservationRow & { authorRoleLabel, createdAt, notifiedAt, notifiedByName }`           | OBS-02 and the edit form; `can` flags inside                                                                                                          |
| `observation.create`         | `observation:create`                                           | `{ studentId, type, category?: string \| null, description, commitments?: string \| null, observedOn?: string }` (`observedOn` `yyyy-mm-dd`, default today Bogotá)                                                                                                                      | `ObservationDetail`                                                                                           | OBS-03 and OBS-04; sets `author_person_id` = caller, `notified = false`                                                                               |
| `observation.update`         | `observation:update`                                           | `{ id, type, category?, description, commitments?, observedOn? }` (student immutable)                                                                                                                                                                                                   | `ObservationDetail`                                                                                           | OBS-R5                                                                                                                                                |
| `observation.delete`         | `observation:delete`                                           | `{ id }`                                                                                                                                                                                                                                                                                | `{ deleted: true }`                                                                                           | A, C; audited with a description snapshot                                                                                                             |
| `observation.markNotified`   | `observation:notify`                                           | `{ id }`                                                                                                                                                                                                                                                                                | `ObservationDetail`                                                                                           | OBS-R4; idempotent                                                                                                                                    |
| `observation.studentHistory` | `observation:read` or `portal:read_self` / `portal:read_child` | `{ studentId }`                                                                                                                                                                                                                                                                         | `{ student: StudentStripData, counts: ObservationCounts, rows: TimelineRow[], guardians: GuardianContact[] }` | OBS-05 and PAR-04 (R1.16); `ScopePolicy` decides the student; rows newest first (≤ 500); `guardians` empty unless the caller holds `observation:read` |
| `observation.recent`         | `observation:read`                                             | `{ limit?: number (≤ 20, default 10) }`                                                                                                                                                                                                                                                 | `{ id, studentId, studentName, type, description, authorName, observedAt }[]`                                 | DASH-03 "Observaciones recientes" (module 01); scope-filtered                                                                                         |
| `observation.export`         | `observation:export`                                           | same filters as `list`, no paging                                                                                                                                                                                                                                                       | `File` (`text/csv; charset=utf-8`, UTF-8 BOM, RFC 4180)                                                       | scope applies; columns below                                                                                                                          |

```ts
type ObservationRow = {
  id: string;
  observedAt: string; // ISO timestamptz
  studentId: string;
  studentName: string;
  courseName: string | null;
  type: "positiva" | "negativa" | "seguimiento" | "convivencia";
  category: string | null;
  description: string;
  commitments: string | null;
  authorId: string;
  authorName: string;
  requiresNotification: boolean;
  notified: boolean;
  pending: boolean;
  can: { update: boolean; delete: boolean; notify: boolean };
};
type TimelineRow = Omit<ObservationRow, "studentId" | "studentName" | "courseName" | "can"> & {
  notifiedAt: string | null;
};
type GuardianContact = {
  name: string;
  relationship: string;
  phone: string | null;
  email: string | null;
};
```

CSV columns (Spanish): "Fecha,Estudiante,Grado,Tipo,Categoría,Descripción,Compromisos,Autor,Notificada". The truncation to 100 characters is a web concern; the API returns full text.

### 4.2 Audit

| Procedure                  | Action                 | Metadata                                                    |
| -------------------------- | ---------------------- | ----------------------------------------------------------- |
| `observation.delete`       | `observation.deleted`  | `{ studentId, type, descriptionSnapshot (≤ 200 chars) }`    |
| `observation.markNotified` | `observation.notified` | `{ observationId, studentId }`                              |
| `observation.update`       | `observation.updated`  | `{ observationId, studentId, changed: string[] }` (G-OBS-1) |

Creation is not audited (the row carries author and timestamps). Reads and exports are not audited.

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- OBS-R1 **Scope.** Staff see observations of students in their `ScopePolicy`: owner, admin and coordinator all; a teacher the students of every course where they have an `activo`/`temporal` offering **or are director** (OD-21), so a group director records and reads observations for their group without teaching every subject. This satisfies inventory INS-12 ("puede … registrar observaciones") for observations; the attendance counterpart stays open (G-ATT-1 in `07-attendance.md`, which grants directors no extra offerings). Out of scope → `NOT_FOUND` ("Estudiante no encontrado." / "Observación no encontrada.").
- OBS-R2 **Create.** Required: student, type, description. Per-field messages **"Debes seleccionar un estudiante."**, **"Debes seleccionar un tipo."**, **"La descripción es obligatoria."** (client and server `BAD_REQUEST` issues). Only `activo` students can receive observations (R2.10; `BAD_REQUEST` "El estudiante no está activo."); history of retired students stays readable. Category must be one of the seven values of §3 or empty. Text is trimmed; empty commitments → null. Description ≤ 2000 ("La descripción no puede superar 2000 caracteres."), commitments ≤ 1000 ("Los compromisos no pueden superar 1000 caracteres.").
- OBS-R3 **Date.** `observedOn` defaults to today (Bogotá), may be in the past, never in the future (`BAD_REQUEST` "No se puede registrar una observación con fecha futura."). `observed_at` = that date at the current Bogotá time when it is today, otherwise 08:00 (the prototype stores `T08:00`); OBS-02 shows `dd/mm/yyyy HH:MM`.
- OBS-R4 **Notification flag.** Negative and convivencia observations "require notification". Creating one shows the info toast **"Observación creada exitosamente"** with the sub-line **"El director de grupo será notificado."** (verbatim prototype copy; no recipient exists in v1, OQ-OBS-2); other types show only the title. `markNotified` sets `notified`, `notified_at = now`, `notified_by = caller`; it requires the observation to need notification (`BAD_REQUEST` "Esta observación no requiere notificación.") and is a no-op when already notified. There is no "un-notify". Confirm copy: row **"¿Marcar esta observación como notificada?"** / "Se registrará que los acudientes ya fueron informados."; detail **"¿Marcar esta observación como notificada a los acudientes?"**. Success toast "Observación marcada como notificada".
- OBS-R5 **Edit.** `update` allows the roles of foundation §4.2: admin/owner and coordinator any observation in scope; a teacher only observations they authored (`FORBIDDEN` "Solo el autor puede editar esta observación." because the row is visible, no existence leak). The prototype let any teacher edit any in-scope observation and a coordinator only their own; the foundation grant wins (G-OBS-3). The student cannot be changed ("No se puede cambiar el estudiante de una observación existente"). Changing the type keeps `notified`: a `positiva` turned into `negativa` becomes pending, a notified `negativa` turned into `positiva` keeps its notified stamp. Toast "Observación actualizada".
- OBS-R6 **Delete.** Hard delete by `observation:delete` (owner, admin, coordinator); confirm **"¿Eliminar esta observación?"** (list, "Esta acción no se puede deshacer.") and **"¿Está seguro de eliminar esta observación?"** (detail, button "Sí, eliminar"); toast "Observación eliminada". A deleted row disappears from OBS-05/PAR-04; the "Compañero" achievement already awarded is not revoked (module 11).
- OBS-R7 **Student and guardian reads.** `observation.studentHistory` shows every type, including `seguimiento` and `convivencia`, with category, commitments, author name and notification state, as the prototype PAR-04 does (OQ-OBS-1). The guardians card ("Acudientes": name, relationship, phone, email) is returned only to callers with `observation:read`; the student's own history omits it (contact data of the guardians is governed by `student.get`). Teachers see the history of students in their scope, not only their own rows (the history is about the student).
- OBS-R8 **Counters.** OBS-01 tiles are over the caller's whole scope. "Pendientes" = `requires_notification and not notified` (the legacy "seguimiento + convivencia" meaning is dropped; OBS-05 "Pendientes" uses the same definition with hint "Notificación al acudiente"); PAR-04 keeps its own tile "Seguimiento" = `seguimiento + convivencia` (prototype), computed client-side from the same `counts`.
- OBS-R9 **Recent list.** `observation.recent` returns the latest observations by `observed_at` desc within scope; the web shows type badge, truncated description, author and date.
- OBS-R10 **Consumers.** The achievement rule "Compañero" reads `positiva` rows whose `observed_at` falls inside a closed period (module 11); PAR-01's "Alertas Activas" block lists the latest `requires_notification` observations of each child (module 13) and is not related to the `alert` table (module 12).

## 6. Web

Feature folder `apps/web/src/features/observations`; thin routes under `routes/_auth/_org/observaciones/`. Shared kit components (`StatTile`, `SectionCard`, `ToneBadge`, `StudentStrip`, `ConfirmDelete`, `FormCard`, `HelpCard`) come from `shared/components/sige` (module 01); `ObservationTypeBadge`, `NotificationBadge` and `ObservationCard` (timeline entry, shared with PAR-04) live in the feature and are exported through its `index.ts`. Type colours: Positiva green, Negativa red, Seguimiento blue, Convivencia amber. Every screen has loading, error-with-retry, empty and permission states.

### 6.1 OBS-01 `/observaciones`

Header "Observaciones de Comportamiento" / "Gestión y seguimiento de observaciones estudiantiles"; action "Nueva Observación" (→ OBS-03, `observation:create`). Five tiles: "Positivas", "Negativas", "Seguimiento", "Convivencia", "Notificadas" (hint "{n} pendientes"). Card "Lista de Observaciones" with chip "{n} observaciones" and "Exportar CSV" (`observation.export`; visible to callers with `observation:export` (owner, admin, coordinator), scope applies, G-OBS-2). Toolbar: search "Buscar por estudiante o descripción", filters "Todos los tipos", "Todas las categorías", "Todos los autores", date inputs "Desde"/"Hasta", "Limpiar" (when active). Columns: "Fecha" (`dd/mm/yyyy`), "Estudiante" (link → OBS-05 for that student), "Tipo" (badge), "Categoría" ("-" when none), "Descripción" (first 100 chars + "...", full text as tooltip), "Autor", "Estado" ("Notificada" badge, or button "Marcar como notificada" when pending, nothing for types that do not need notification), actions: eye "Ver detalle" (→ OBS-02), pencil "Editar observación" (`can.update`), trash "Eliminar observación" (`can.delete`). Empty: **"No hay observaciones"** / "Aún no se han registrado observaciones." (with filters: "No se encontraron observaciones con los filtros aplicados.") + "Crear primera observación".

### 6.2 OBS-02 `/observaciones/$observationId`

Header "Detalle de Observación" / "ID: #{short id}" (first 8 characters of the UUID); back "Volver a la lista". Main card "Observación": type badge, category badge, "Estudiante" (name + course badge or "Sin grado"), "Descripción", "Compromisos" (only when present); actions "Historial" (→ OBS-05) and "Editar" (`can.update`). Side card "Información": "Fecha" (`dd/mm/yyyy HH:MM`), "Autor" (name and role label), "Notificación a Acudientes" (badge "Notificada"/"Pendiente" plus info badge "Requerida" for negativa/convivencia). Buttons "Marcar como Notificada" (when pending, `can.notify`) and "Eliminar" (`can.delete`, outline destructive). Unknown or out-of-scope id: `NotFoundBlock` "Observación no encontrada" with back to the list.

### 6.3 OBS-03 `/observaciones/nueva?student=` and `/observaciones/$observationId/editar`

Header "Nueva Observación" / "Complete el formulario para crear la observación" or "Editar Observación" / "Complete el formulario para actualizar la observación"; back "Volver a la lista" (new) or "Volver al detalle" (edit). Card "Datos de la Observación": "Estudiante *" (select "Seleccionar estudiante...", options "{nombre} - {curso o 'Sin grado'} ({documento})" from `student.pick`, sorted by name; preselected by `?student=`; disabled with the help text of OBS-R5 on edit), "Tipo *" ("Seleccionar tipo...", options with emoji), "Categoría" ("Seleccionar categoría..."), "Descripción *" (5 rows, placeholder "Describa la observación detalladamente...", help "Proporcione una descripción clara y detallada de la observación"), "Compromisos" (3 rows, "Compromisos adquiridos (opcional)...", help "Opcional: acuerdos o compromisos derivados de la observación"), "Fecha" (date, default today, help "Fecha en que ocurrió la observación (por defecto hoy)"). Buttons "Crear Observación" / "Actualizar Observación", "Cancelar". Help card "Información importante": "Las observaciones negativas y de convivencia requieren notificación automática a los acudientes del estudiante." plus the list "Sea específico y objetivo en la descripción." / "Registre los compromisos cuando existan acuerdos." / "La notificación se marca manualmente desde la lista o el detalle." Success → toast per OBS-R4 and redirect to OBS-01. Edit without `can.update` renders the `NoPermission` state.

### 6.4 OBS-04 `/observaciones/rapida?student=`

Header "Observación Rápida" / "Crear observación para el estudiante"; "Volver al perfil" (→ STU-02). `StudentStrip` (name, "Grado: {curso}"). Card "Nueva Observación": "Tipo de Observación *" as four radio tiles (👍 Positiva, ⚠️ Negativa, 📋 Seguimiento, 🤝 Convivencia), "Categoría" ("Seleccionar..." + six categories; help "Categoría opcional para clasificar la observación"), "Descripción *" (4 rows, "Describa la observación con detalle...", help "Sea específico y objetivo en la descripción"), "Compromisos" (2 rows, "Compromisos adquiridos (opcional)...", help "Compromisos que adquiere el estudiante (opcional)"). Error for the tiles: **"Selecciona el tipo de observación."**. Buttons "Crear Observación", "Cancelar" (→ STU-02). The date is always today. Success → toast per OBS-R4 and redirect to OBS-05 of that student. Side card "Tipos de Observación" lists the four hints of §3. A student outside scope: `NotFoundBlock` "Estudiante no encontrado".

### 6.5 OBS-05 `/observaciones/historial?student=`

Header "Historial de Observaciones" / "Línea de tiempo de observaciones del estudiante". `StudentSwitcher` (staff: course then student via `student.pick`; student: hidden, own record) and `StudentStrip`; staff actions "Nueva Observación" (→ OBS-04, `observation:create`) and "Ver Perfil" (→ STU-02). Tiles "Total", "Positivas", "Negativas", "Pendientes". Card "Línea de Tiempo": newest first, one entry per observation with type dot and pill ("👍 Positiva"…), category pill, "Ver detalle" (→ OBS-02, staff only), description, "Compromisos:" block, footer "dd/mm/yyyy HH:MM", author name and **"Notificada al acudiente"** / **"Pendiente de notificación"** (the latter only for types that need notification). Side card "Acudientes" (staff, when any) with name, "({relationship})", phone ("Sin teléfono") and email ("Sin email"). Empty: **"Sin observaciones"** / "Este estudiante aún no tiene observaciones registradas." + (staff) "Crear primera observación". The student sidebar entry "Mis Observaciones" opens the same route for their own student.

## 7. Flows and audit

- **F7** Behaviour observation and guardian notification: STU-01/02 "Observación" → OBS-04, or OBS-01 "Nueva Observación" → OBS-03; creation of a negativa/convivencia row leaves it "Pendiente"; the teacher or coordinator marks it "Notificada" from OBS-01/OBS-02; guardians read it in PAR-04; positive ones feed "Compañero" (module 11).
- **F14/F15** teacher daily route (DASH-04 "Observaciones" → OBS-03) and student route ("Mis Observaciones" → OBS-05).
- Audit: §4.2.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): `requiresNotification` for the four types, `isPending`, `countObservations` (notified vs pending, empty list), category list.
- **API integration** (Postgres): create for each type; validation messages (missing student/type/description, 2001-character description, unknown category, future date, retired student); `observedAt` stamping (today now, past 08:00, Bogotá midnight boundary); scope matrix (teacher with an offering in the course, teacher-director without an offering, teacher of another course → `NOT_FOUND`, coordinator/admin all); `update` matrix (author teacher yes, other teacher `FORBIDDEN`, coordinator any, type change toggles pending); `markNotified` (pending → notified once, repeated call no-op, positive type `BAD_REQUEST`); `delete` allowed for admin/coordinator, `FORBIDDEN` for teacher, audit row with snapshot; `studentHistory` for staff in scope, student self, parent linked, parent non-linked and other student → `NOT_FOUND`, guardians returned only to staff; `stats` unaffected by list filters; `list` sort/filter/search and server pagination; `export` obeys scope and filters and matches the table; `recent` limit and scope; two-tenant isolation; permission matrix per role (viewer none; student/parent only the portal read); no `organizationId` in schemas.
- **Web**: OBS-01 tiles, filters, mark-notified confirm, delete confirm, truncation with tooltip, empty states; OBS-03 required-field messages, preselected student, edit disables the student select, redirect and toast copy; OBS-04 radio-tile selection and error; OBS-05 timeline order, notification labels, guardian card visibility, student read-only view; stories for `ObservationTypeBadge`, `NotificationBadge`, `ObservationCard`.

### 8.2 Acceptance

- OBS-01…04: a teacher creates, edits and sees only their own students' observations; a coordinator deletes; a pending negative observation turns "Notificada" with one click and the OBS-01 tiles update.
- OBS-05: staff see the timeline and guardians; the student sees only their own timeline; counts equal the stored rows.
- P5 exit criterion of foundation §8 (observation notification flag, matrix tests) holds on the demo seed.

## 9. Open questions and notes

### 9.1 New open questions

| ID       | Question                                                                                           | Recommended default                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-OBS-1 | Should guardians and students see `seguimiento`/`convivencia` notes written as internal follow-up? | Yes, as in the prototype (PAR-04 lists every type). If schools need private notes, add a `visible_to_family` boolean (default true) without a model change elsewhere.        |
| OQ-OBS-2 | The creation toast says "El director de grupo será notificado." but nobody is notified in v1       | Keep the prototype copy (verbatim rule); reword to "Queda pendiente la notificación a los acudientes." once the product owner confirms, or when a `NotificationPort` exists. |

### 9.2 Gaps found in 00-foundation.md and the prototype

- G-OBS-1 §6.9 lists only `observation.{deleted,notified}`. This spec adds `observation.updated` (changed field names only) because edits by someone other than the author otherwise leave no trail. **Resolved in 00-foundation (§6.9 `observation.updated`).**
- G-OBS-2 §4.2 has no `observation:export`; the CSV is gated by `observation:read` within scope (R3.22 "exports obey the caller's scope"). The prototype hides the button from teachers; if that must hold, add `export` to the catalog and grant it to owner, admin and coordinator. **Resolved in 00-foundation (§4.2 `observation:export` for owner, admin, coordinator); this spec gates `observation.export` accordingly.**
- G-OBS-3 Prototype edit rule (author, or any teacher/admin/root) contradicts foundation §4.2 ("teacher: update (own authored)"; coordinator: all). The foundation wins (OBS-R5). **Open decision OD-29 in 00-foundation §11 (this spec adopts the recommended default).**
- G-OBS-4 Inventory INS-12 gives the group director attendance and observation rights; foundation scope covers observations through OD-21 but not attendance (G-ATT-1, unchanged). **Open decision OD-28 in 00-foundation §11 (shared with G-ATT-1).**
