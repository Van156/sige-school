# Spec: SIGE — Grades (GRD)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query + Form (web), Drizzle + Postgres, `exceljs` (`.xlsx`), `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.3 scope, §5.2 `grade_record` / `period_lock` / `final_grade`, §5.3 R2.10–R2.13, §5.4 grading rules, §5.5 constants, §6.5 R3.15–R3.17, OD-5, OD-8, OD-9), [`02-institution.md`](./02-institution.md) (periods, criteria, courses), [`04-scheduling.md`](./04-scheduling.md) (`offering`, `offering.options`), [`05-students.md`](./05-students.md) (`student.pick`), [`03-users.md`](./03-users.md) (xlsx helper), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/grades/*`, `-components/{grade-grid,score-badge,class-context}.tsx`, `-mock/{helpers,grading}.ts`, `-lib/class-stats.ts`. Inventory §3.7, §2.3, F5. Requirement ids: `GRD-R<n>`. Phase P5.

## 1. Objective and scope

Grade entry and the derived views: the weighted-criteria sheet per offering and period with live totals, bulk Excel upload, per-offering period locks, period finals, annual definitive (DEF), class summary analytics, and the per-student view shared with student and parent (GRD-08). The module owns the grading rules in `packages/sige-core` so the sheet, the server, the seed and the metrics modules cannot diverge (foundation §5.4).

### In scope

| Screen | Title                               | Roles                                             | Real route            |
| ------ | ----------------------------------- | ------------------------------------------------- | --------------------- |
| GRD-01 | "Ingreso de Notas"                  | R, A, C; T (own offerings)                        | `/notas`              |
| GRD-02 | "Ingreso de Notas" (planilla)       | R, A, C; T (own)                                  | `/notas/planilla`     |
| GRD-03 | "Carga Masiva de Notas desde Excel" | R, A, C; T (own)                                  | `/notas/carga-masiva` |
| GRD-04 | "Panel de Bloqueo de Periodos"      | R, A, C                                           | `/notas/bloqueo`      |
| GRD-05 | "Notas Finales del Periodo"         | R, A, C; T (own)                                  | `/notas/finales`      |
| GRD-06 | "Notas Anuales"                     | R, A, C; T (own)                                  | `/notas/anuales`      |
| GRD-07 | "Resumen de Notas"                  | R, A, C; T (own)                                  | `/notas/resumen`      |
| GRD-08 | "Notas del Estudiante"              | R, A, C, T (students in scope); S own; P children | `/notas/estudiante`   |

Also in scope: tables `grade_record`, `period_lock`, `final_grade`; the grading functions in `sige-core`; the recalculation port called by module 02 (OD-8); the shared sheet component and `GradeScaleLegend`.

### Out of scope

- Configurable grading scale or SIEE rules (OD-9); year close and annual snapshot table (OD-14); the DEF is derived on read.
- Report cards (module 09), metrics (10), alerts and achievements (11/12) consume `final_grade` but are specified elsewhere.
- Parent-portal wrappers PAR-02 (module 13) reuse `grade.studentGrades`.

## 2. Data

Conventions R2.1–R2.6. Tenant-safe composite FKs to `student`, `offering`, `academic_period`, `grade_criterion`, `person`.

| Table          | Columns and constraints                                                                                                                                                                                                                                                                                                                                                           | Indexes                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `grade_record` | `student_id`, `offering_id`, `period_id`, `criterion_id`, `score numeric(3,2) not null check (score between 1 and 5)`, `observation` text null ≤ 500, `created_by`, `updated_by` (→ `person`), `created_at`, `updated_at`. `unique(student_id, offering_id, period_id, criterion_id)`. FKs `restrict` (a period/criterion/offering with records cannot be deleted, module 02/04). | `(organization_id, offering_id, period_id)`, `(organization_id, student_id, period_id)`, `(organization_id, criterion_id)` |
| `period_lock`  | `offering_id` (cascade), `period_id`, `locked bool not null`, `locked_by` (→ `person`), `locked_at timestamptz`. `unique(offering_id, period_id)`. A missing row means open.                                                                                                                                                                                                      | `(organization_id, period_id)`                                                                                             |
| `final_grade`  | `student_id`, `offering_id`, `period_id`, `final_score numeric(3,2) not null check (between 1 and 5)`, `status` enum `ganada` \| `perdida` \| `no evaluado`, `observation` text null, `calculated_at timestamptz`. `unique(student_id, offering_id, period_id)`.                                                                                                                  | `(organization_id, offering_id, period_id)`, `(organization_id, student_id)`                                               |

`final_grade` is a derived cache (R2.12): a row exists exactly when the student has at least one `grade_record` for the offering × period; it is rewritten in the same transaction as any record or criterion change and deleted when the last record goes. The value `no evaluado` is part of the enum for read models; stored rows are `ganada` or `perdida`. The annual DEF is never stored.

Migration: enums, three tables, no backfill. Seed (R4) writes records through the same service so finals are produced by `sige-core`.

## 3. Grading rules (`packages/sige-core/src/grading.ts`)

All arithmetic is integer: scores in hundredths (`4.25 → 425`), weights in hundredths of a percent (`20.00 → 2000`). No float appears in the rule, so UI, server and seed agree bit for bit (R3.18; foundation §5.4).

| Function                        | Definition                                                                                                                                                                                                                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `periodFinal(scores, criteria)` | `num = Σ(scoreᵢ × weightᵢ)`, `den = Σ(weightᵢ)` over the criteria that have a score; `finalCents = roundHalfUp(num / den)` (integer division of `2·num + den` by `2·den`); clamped to 100–500; `null` when nothing is scored. With all criteria scored and Σ weights = 100 this equals `Σ score × weight/100`. |
| `statusOf(final)`               | `final ≥ 3.00 → ganada`, `< 3.00 → perdida`, `null → no evaluado` (evaluated on the rounded final: 2.995 → 3.00 → `ganada`).                                                                                                                                                                                   |
| `performanceLevel(final)`       | `≥ 4.60` Superior, `≥ 4.00` Alto, `≥ 3.00` Básico, else Bajo (on the rounded final).                                                                                                                                                                                                                           |
| `scoreClass(score)`             | `≥ 4.5` excellent, `≥ 4.0` good, `≥ 3.0` passing, `≥ 2.0` risk, else critical (badge tones).                                                                                                                                                                                                                   |
| `annualDef(finals)`             | mean of the available period finals in hundredths, round half-up; `annualStatus`: `≥ 3.00` aprobado, `<` reprobado, none → no evaluado.                                                                                                                                                                        |
| `scoreBuckets(finals)`          | counts in `1.0-1.9`, `2.0-2.9`, `3.0-3.9`, `4.0-4.9`, `5.0` (a final of exactly 5.00 is the last bucket); colours red, orange, amber, teal, blue.                                                                                                                                                              |
| `classStats(rows, criteria)`    | mean (2 decimals), pass rate (% of finals ≥ 3.00, one decimal), max, min, evaluated / total, per-criterion mean and count, failed count, not-evaluated count, **population** standard deviation (one decimal).                                                                                                 |
| `parseScore(text)`              | accepts `.` or `,`, up to 2 decimals, range 1.00–5.00; empty = no grade; anything else invalid.                                                                                                                                                                                                                |

Constants come from `SIGE_RULES` (R2.17): `PASSING_GRADE = 3.0`, `GOOD = 4.0`, `EXCELLENCE = 4.5`, level bounds 4.6 / 4.0 / 3.0. Cells display 1 decimal when the score has one significant decimal and 2 otherwise (`4.0`, `3.75`), so imported values are never shown rounded; the live final shows 2 decimals.

## 4. API

Router `routers/sige/grade.ts` (`gradeRouter`), all `sigeProcedure.use(requirePermission(...))`; `context.scope.assertOffering()` for every `offeringId`, `assertStudent()` for every `studentId`; other tenant or out-of-scope → `NOT_FOUND` (R1.15). Errors per R3.5; `PERIOD_LOCKED` (409) for writes to a locked offering × period (R2.11).

### 4.1 Procedures

| Procedure              | Permission                                               | Input                                                                                                                                                                                        | Output                                                                                                                                                 | Notes                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grade.classes`        | `grade:read`                                             | `{ periodId, courseId? }`                                                                                                                                                                    | `ClassRow[]` = `{ offeringId, courseId, courseName, studentCount, subjectName, teacherName \| null, lockState: "locked" \| "open" \| "empty" }`        | GRD-01 table; scope-filtered (teacher: own offerings); `empty` = no records                                                                                                    |
| `grade.sheet`          | `grade:read`                                             | `{ offeringId, periodId }`                                                                                                                                                                   | `GradeSheet` (below)                                                                                                                                   | students active and in the offering's course, ordered by last name then first name (locale `es`)                                                                               |
| `grade.saveSheet`      | `grade:write` (+ `grade:lock` when `lock: true`)         | `{ offeringId, periodId, cells: { studentId, criterionId, score: number \| null, observation: string \| null }[1..2000], lock?: boolean }`                                                   | `{ created, updated, deleted, finals: FinalRow[], locked: boolean }`                                                                                   | R3.15: one transaction; only changed cells are sent (R3.17); `score = null` deletes the cell                                                                                   |
| `grade.setLock`        | `grade:lock` or `grade:manage_locks`                     | `{ offeringId, periodId, locked: boolean }`                                                                                                                                                  | `{ lockState: "locked" \| "open" \| "empty" }`                                                                                                         | GRD-04 and the sheet's "Desbloquear"; rules GRD-R6                                                                                                                             |
| `grade.lockPanel`      | `grade:manage_locks`                                     | list input (`grade-lock-list-config.ts`: sort `course`, `subject`, `period`, `records`, `state`; filters `courseId` select, `periodId` select, `state` select `locked` \| `open` \| `empty`) | `{ rows: LockRow[], total }`; `LockRow` = `{ offeringId, periodId, courseName, subjectName, periodShortName, records, state, lockedByName, lockedAt }` | one row per offering × period of the offering's academic year (default year = current)                                                                                         |
| `grade.importPreview`  | `grade:import`                                           | `{ offeringId, periodId, file: File }` (`.xlsx`, ≤ 10 MB, ≤ 2,000 rows)                                                                                                                      | `{ total, valid, invalid, locked: boolean, rows: PreviewRow[], errors: { row, message }[] }`                                                           | no writes                                                                                                                                                                      |
| `grade.import`         | `grade:import`                                           | same as preview                                                                                                                                                                              | `{ created, updated, errors: { row, message }[] }`                                                                                                     | synchronous (no password hashing); `PERIOD_LOCKED` when locked; per-row all-or-nothing                                                                                         |
| `grade.importTemplate` | `grade:import`                                           | `{ offeringId }`                                                                                                                                                                             | `File` (`plantilla-notas.xlsx`)                                                                                                                        | header `documento` + one column per criterion (lower-case names) and one prefilled row per active student (an `estudiante` name column is informational and ignored on import) |
| `grade.finals`         | `grade:read`                                             | `{ offeringId, periodId }`                                                                                                                                                                   | `{ header, criteria, rows: FinalsRow[] }`; `FinalsRow` = `{ studentId, name, scores: (number\|null)[], final: number \| null, status }`                | GRD-05; footer averages computed client-side with `sige-core`                                                                                                                  |
| `grade.recalculate`    | `grade:recalculate`                                      | `{ offeringId, periodId }`                                                                                                                                                                   | `{ recalculated: number }`                                                                                                                             | "Recalcular Todas"; `PERIOD_LOCKED` when locked                                                                                                                                |
| `grade.annual`         | `grade:read`                                             | `{ offeringId }`                                                                                                                                                                             | `{ header, periods: { id, shortName }[], rows: { studentId, name, finals: (number\|null)[], def: number \| null, status }[] }`                         | GRD-06; periods of the offering's academic year                                                                                                                                |
| `grade.summary`        | `grade:read`                                             | `{ offeringId, periodId }`                                                                                                                                                                   | `ClassSummary` = `{ header, kpis, rows, distribution, criterionStats, quick }`                                                                         | GRD-07; computed with `classStats`                                                                                                                                             |
| `grade.studentGrades`  | `grade:read` or `portal:read_self` / `portal:read_child` | `{ studentId }`                                                                                                                                                                              | `StudentGrades` (below)                                                                                                                                | GRD-08 (R1.16): `ScopePolicy` decides the student; staff see every offering of the student's course                                                                            |

```ts
type GradeSheet = {
  offering: { id; subjectName; courseId; courseName; teacherName: string | null };
  period: { id; name; shortName };
  criteria: { id; name; weight: number }[]; // ordered by order_num
  students: { id; name; document: string }[];
  cells: { studentId; criterionId; score: number; observation: string | null }[];
  finals: { studentId; final: number | null; status: "ganada" | "perdida" | "no evaluado" }[];
  lock: { locked: boolean; lockedByName: string | null; lockedAt: string | null };
  can: { write: boolean; lock: boolean; unlock: boolean; import: boolean };
};
type StudentGrades = {
  student: { id; name; courseName: string | null; document: string; campusName: string; status };
  criteria: { id; name; weight: number }[];
  kpis: { average: number | null; passed: number; failed: number; records: number } | null;
  periods: {
    id;
    name;
    shortName;
    startDate;
    endDate;
    isActive: boolean;
    rows: {
      offeringId;
      subjectName;
      courseName;
      scores: (number | null)[];
      final: number | null;
      status: "ganada" | "perdida" | "no evaluado";
      level: "Superior" | "Alto" | "Básico" | "Bajo" | null;
    }[];
  }[];
};
```

`StudentGrades.periods` lists only periods with at least one final for the student; `kpis` is null without finals. `can.*` encode permission, scope and lock state so the web never re-derives them.

### 4.2 Recalculation port (consumed by module 02)

`gradeRecalculation.recomputeFinals({ scope: "open", criterionId? })` recomputes `final_grade` for every offering × period without a locked `period_lock` (OD-8), in batches inside the caller's transaction, and returns the number of rows rewritten. Locked offering × periods keep their finals even if weights changed. Registered at server start; module 02 calls it from `criterion.create/update/delete`.

### 4.3 Audit events (foundation §6.9)

| Operation                                            | Action               | Metadata (never full matrices)                                                                                          |
| ---------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `grade.saveSheet`                                    | `grade.sheet_saved`  | `{ offeringId, periodId, created, updated, deleted, students }`                                                         |
| `grade.saveSheet` with `lock`, `grade.setLock(true)` | `grade.locked`       | `{ offeringId, periodId, via: "sheet" \| "panel" }` (a "Guardar y Bloquear" writes both events in the same transaction) |
| `grade.setLock(false)`                               | `grade.unlocked`     | `{ offeringId, periodId, via, previousLockedBy }`                                                                       |
| `grade.import`                                       | `grade.imported`     | `{ offeringId, periodId, created, updated, skipped }`                                                                   |
| `grade.recalculate`                                  | `grade.recalculated` | `{ offeringId, periodId, recalculated }`                                                                                |

Per-record history is `updated_by`/`updated_at`; no per-cell audit rows (R3.15).

## 5. Business rules and validation

Messages verbatim from the prototype and inventory.

### 5.1 Rules

- GRD-R1 **Who writes.** `grade:write` (owner, admin, coordinator per OD-5, teacher) and, for teachers, the offering must be in their scope (`teacher_assignment` `activo` or `temporal`). Coordinators and admins write any offering. Sheet writes always set `updated_by`.
- GRD-R2 **Cell validation** (server and client, same `parseScore`): score 1.00–5.00 with at most 2 decimals; message **"La nota debe estar entre 1.0 y 5.0."** (client toast title "Hay notas fuera de rango" with body "Las notas deben estar entre 1.0 y 5.0."); observation ≤ 500 chars ("La observación no puede superar 500 caracteres."); an observation without a score is rejected (**"No se puede guardar una observación sin nota."**) instead of being dropped silently as in the prototype.
- GRD-R3 **Row integrity.** `studentId` must be an active student of the offering's course (`BAD_REQUEST` "El estudiante no pertenece a este grado."), `criterionId` an existing criterion, `periodId` a period of the offering's academic year. Duplicate cells in one request are rejected.
- GRD-R4 **Preconditions.** No criteria → `BAD_REQUEST` with code `NO_CRITERIA` and the UI state **"No hay criterios de evaluación configurados"** / "Configure los criterios primero." (+ "Configurar criterios" → INS-17); no periods → **"No hay periodos académicos configurados"** / "Configure los periodos primero."
- GRD-R5 **Finals.** After any record or criterion change the affected students' `final_grade` rows are rewritten with `periodFinal`; the last record's removal deletes the row. The sheet's live total, `grade.saveSheet`'s `finals` and the stored row are the same function of the same inputs (parity test).
- GRD-R6 **Locks** (`period_lock`, per offering × period; foundation §12 #2). Locking requires at least one record ("No hay notas registradas" / "No existen notas para esa asignatura y periodo.", `BAD_REQUEST`). Writers with `grade:lock` lock from the sheet ("Guardar y Bloquear" = save then lock, one transaction); `grade:manage_locks` (admin, coordinator) lock and unlock anything from the panel. **Unlock** needs `grade:lock` and either `grade:manage_locks` or being the person who locked it (`locked_by`): a teacher can reopen their own sheet, but not one a coordinator closed (OQ-GRD-1). Locked offering × periods reject `saveSheet`, `import`, `recalculate` and criterion-driven recomputation with `PERIOD_LOCKED` (409), regardless of the UI (R2.11). Reads are unaffected.
- GRD-R7 **Class access.** An out-of-scope or unknown `offeringId` yields the screen state **"Acceso prohibido"** / "No tienes permiso para editar esta asignatura." (GRD-02; "No tienes permiso para ver esta asignatura." elsewhere), implemented as `NOT_FOUND` mapped by the web to that block; a missing `offeringId` shows **"Selecciona una asignatura"** / "Elige un grado y una asignatura para continuar." + "Ir a la selección".
- GRD-R8 **Import** (GRD-03). Columns: `documento` (required) and one per criterion, matched by criterion name case- and accent-insensitively; unknown columns ignored; a criterion column missing from the file leaves that criterion untouched; a blank cell leaves the existing score unchanged. Students are matched by `document_number` among the offering's active students. A row is applied all-or-nothing in its own savepoint. Row messages (prefixed "Fila {n}: ", header = row 1): **"Documento no encontrado en el curso."**, **"Nota fuera de rango (1.0 - 5.0) en {criterio}."** (also for non-numeric text), "Falta el documento.", "El documento "{x}" está repetido en el archivo."; scores accept up to 2 decimals. Existing scores are updated (observation preserved), new ones created; the whole import is refused with `PERIOD_LOCKED` when the offering × period is locked (UI callout **"Periodo bloqueado"**: "Las notas de este periodo están cerradas. Desbloquéalas en el panel de bloqueo antes de cargar el archivo."). Result: callout "{n} notas creadas y {m} actualizadas"; card "Errores ({k})" listing the first 10 and "... y {j} errores más". Limits and errors for file type/size as USR-R12 ("Solo se permiten archivos Excel (.xlsx)."; `.xls` is dropped, OD-17).
- GRD-R9 **Annual** (GRD-06): periods = all `academic_period` rows of the offering's year ordered by `order_num`; DEF = mean of the available finals; status "Aprobado" / "Reprobado" / "No evaluado" / "Sin nota".
- GRD-R10 **Student view** (GRD-08, R1.16): one procedure for staff, student and parent; the student picker is `student.pick`. Staff (including teachers with the student in scope) see all offerings of the student's course, not only their own; student and parent see the same data for self and children. Retired or graduated students remain viewable by management.
- GRD-R11 **Active students only.** Sheets, finals, summary and imports list only `activo` students of the course (R2.10); history of retired students stays in GRD-08.
- GRD-R12 **Concurrency.** Last write wins per cell; the sheet sends only edited cells, so two teachers on different offerings never interfere and two editors of one cell resolve to the later save. The server never trusts client totals.

### 5.2 Messages

Flash/toast copy: "Notas guardadas exitosamente.", "Notas bloqueadas exitosamente.", "Notas desbloqueadas exitosamente.", "Notas recalculadas" (body "Las notas finales siempre se derivan de la planilla.").

## 6. Web

Feature folder `apps/web/src/features/grades`; thin routes under `routes/_auth/_org/notas/`; components ported from the prototype. Shared pieces: `ClassContext` (resolves `offeringId` and `periodId` search params, renders the GRD-R7 guard states and the not-found block), `ClassHeader`, `GradeGrid`, `ScoreBadge`, `GradeStatusBadge`, `LevelBadge`, `LockBadge` (Cerrado / Abierto / Sin datos), `GradeScaleLegend` (card "Escala de Calificación": Superior 4.6–5.0, Alto 4.0–4.5, Básico 3.0–3.9, Bajo 1.0–2.9 as display ranges, "Escala: 1.0 a 5.0 | Nota mínima de aprobación: 3.0"). Every screen has loading, error-with-retry, empty and permission states; stories for the presentational components. URL search keys: `periodId`, `offeringId`, `courseId`, `student`.

### 6.1 GRD-01 `/notas`

Header "Ingreso de Notas" / "Selecciona el periodo, el grado y la asignatura"; action "Cargar desde Excel" (→ GRD-03). Card "Seleccionar Periodo Académico": one pill per period of the current year (name; badge "Activo" on the active one; selected highlighted; default the active period). Card "Criterios de Evaluación" (when any): one mini-card per criterion (name, weight badge "{n}%", description). Card "Seleccionar Grado y Asignatura": `grade.classes` table, "Filtrar por grado"; columns "Grado" (+ badge "{n} estudiantes"), "Asignatura", "Docente" ("Sin docente"), "{P#}" (lock badge of the chosen period), actions "Ingresar Notas" (→ GRD-02) and "Ver Resumen" (→ GRD-07). Empty: **"No hay grados disponibles"** / "No hay grados con asignaturas para el año académico actual."; no periods: GRD-R4 state.

### 6.2 GRD-02 `/notas/planilla?offeringId&periodId`

Breadcrumb "Notas › {curso} › {asignatura} › {periodo}"; "Volver" (→ GRD-01 keeping the period). Summary tiles "Asignatura", "Grado", "Periodo" (short name + name), "Estudiantes". Status line: badge "Notas Bloqueadas" (destructive) / "Notas Desbloqueadas" (success), badge "Cambios sin guardar" when dirty, and "**Pesos:** {criterio}: {peso}% · … | Escala: 1.0 - 5.0 | Mínimo aprobación: 3.0". Locked callout **"Periodo bloqueado"**: "Las notas son de solo lectura. Desbloquéalas para editar la planilla." Card "Planilla de Calificaciones" with actions (hidden when locked): "Guardar Todas", "Guardar y Bloquear" (disabled without grades; confirm "¿Bloquear notas?" / "Esta acción impedirá futuras ediciones hasta que se desbloquee." / "Guardar y bloquear"), "Carga Masiva" (→ GRD-03); locked state shows "Desbloquear" when `can.unlock` (confirm "¿Desbloquear notas para edición?" / "La planilla volverá a ser editable." / "Desbloquear"); always "Notas finales" (→ GRD-05) and "Resumen" (→ GRD-07).

Grid: two header rows; columns "#", "Estudiante" (name + document small), per criterion a group "{criterio} ({peso}%)" split into "Nota" and "Observ.", then "Final", "Estado"; sticky name column. Cells (unlocked): number input `min 1 max 5 step 0.1`, comma accepted, red border and inline message when invalid, green when valid, formatted on blur; "Observ." text input (placeholder "Observación", max 500). Locked: plain text ("-" when empty, observation truncated to 20 chars). "Final" is the live `periodFinal` (2 decimals, class colour); "Estado" badge "Ganada" (green) / "Perdida" (red) / "N/A" (grey, nothing entered). Footer row "Promedio del Grupo": per-criterion average (1 decimal, coloured), final average (2 decimals), "-" for status; all update live. The page keeps a draft; unsaved changes trigger the browser `beforeunload` prompt and a router blocker dialog "Hay cambios sin guardar. ¿Salir de todas formas?" (R3.31). Only changed cells are submitted. Empty: **"No hay estudiantes activos en este grado."** Accessibility: each input has `aria-label` "{criterio} de {estudiante}" / "Observación de {criterio} de {estudiante}".

### 6.3 GRD-03 `/notas/carga-masiva`

Header "Carga Masiva de Notas desde Excel" / "Carga las notas de un grado y asignatura en un solo paso"; "Volver a Selección". Card "Cargar Archivo": "Grado y Asignatura" (`offering.options`, options "{grado} · {materia} - {docente o Sin docente}", placeholder "-- Seleccionar --", preselected from `offeringId`), "Periodo Académico" (default active), "Archivo Excel (.xlsx) *"; buttons "Cargar Notas" (disabled without file or when locked), "Limpiar"; after choosing a file the card "Vista previa" ("{archivo} · {n} filas, {m} válidas": columns `documento`, one per criterion, "Estado" = "Válida" or the row message). Right column: card "Instrucciones" (five steps adapted to `.xlsx`: choose course/subject, period, prepare the file with `documento` and one column per criterion on the 1.0–5.0 scale, matching by document within the course, out-of-range rejected and existing updated unless locked), card "Formato del Archivo Excel" (`documento | {criterios en minúscula}` and "Plantilla" → `grade.importTemplate`), `GradeScaleLegend`. Result per GRD-R8 with "Cargar otro archivo" and "Ver planilla".

### 6.4 GRD-04 `/notas/bloqueo`

Header "Panel de Bloqueo de Periodos" / "Controla qué periodos admiten cambios en las notas". Callout "Bloqueo de periodos": "Cuando un periodo está bloqueado, no se pueden editar ni agregar notas. Solo los administradores y coordinadores pueden bloquear o desbloquear periodos." Card "Bloquear/Desbloquear Periodo": selects "Asignatura - Grado" ("-- Seleccionar --", options "{materia} - {grado}") and "Periodo"; buttons "Bloquear" (confirm "¿Bloquear notas?" / "Esta acción impedirá editar o agregar notas en el periodo.") and "Desbloquear" (confirm "¿Desbloquear notas?" / "Las notas volverán a ser editables."); an empty combination errors with the GRD-R6 message. Card "Estado de Periodos": `grade.lockPanel` server table, filters "Filtrar por grado" and "Filtrar por periodo"; columns "Grado", "Asignatura", "Periodo", "Registros", "Estado" (badge Cerrado / Abierto / Sin datos), "Acciones" (inline "Desbloquear" when closed, "Bloquear" when open, none for "Sin datos"). Empty: **"No hay combinaciones disponibles"** / "No hay combinaciones de asignatura-grado y periodo disponibles."

### 6.5 GRD-05 `/notas/finales`

Header "Notas Finales del Periodo" / "Nota final ponderada por estudiante"; buttons "Volver a Planilla" (→ GRD-02) and "Recalcular Todas" (confirm "¿Recalcular todas las notas finales?" / "Se vuelven a calcular las notas finales de todos los estudiantes con las notas actuales." / "Recalcular"; disabled with tooltip when locked). `ClassHeader`: "Grado:", "Asignatura:", "Periodo:", "Docente:" (name or "N/A") and chips "Criterios y Ponderación" ("{criterio}: {peso}%"). Card "Notas Finales por Estudiante" ("{periodo} · calculadas con los pesos de cada criterio"): columns "#", "Estudiante" (link → GRD-08), per criterion "{criterio} ({peso}%)" (score or "-"), "Nota Final" (2 decimals or "-"), "Estado" (Ganada / Perdida / No evaluado / Sin nota); footer "PROMEDIO GENERAL" (criterion means 1 decimal, final mean 2 decimals or "-"). Empty "No hay estudiantes activos en este grado."

### 6.6 GRD-06 `/notas/anuales`

Header "Notas Anuales" / "Nota por periodo y definitiva del año"; back button; strip "Grado:", "Asignatura:", "Docente:". Card "Tabla de Notas por Periodo y Definitiva" ("DEF es el promedio de las notas finales de los periodos disponibles."): columns "#", "Estudiante" (link → GRD-08), one per period (`short_name`; score or "-"), "DEF", "Estado Anual" (Aprobado / Reprobado / No evaluado / Sin nota); footer "PROMEDIO GENERAL" (per-period means and DEF mean, 2 decimals). Empty "No hay estudiantes activos en este grado."

### 6.7 GRD-07 `/notas/resumen`

Header "Resumen de Notas" / "Promedios, aprobación y distribución del grupo"; sub-line "{materia} — {grado} — {periodo}"; "Volver a Planilla". KPI tiles: "Promedio General" (1 decimal; caption ≥ 4.0 "Excelente", ≥ 3.0 "Aceptable", else "Requiere Atención"), "Tasa de Aprobación" ("{n}%" + progress bar), "Máx / Mín" ("{max} / {min}", "Rango de notas"), "Evaluados / Total" ("{evaluados} / {total}", "{x}% completado"). Card "Resumen por Estudiante": "#", "Estudiante" (link → STU-02 when `student:read`; "Apellido, Nombre"), one column per criterion (badge by performance level), "Final", "Estado"; footer "PROMEDIOS". Card "Distribución de Notas" (bar chart of `scoreBuckets`, y integer ticks from 0, no legend), card "Estadísticas por Criterio" (label, mean 1 decimal or "N/A", bar width mean/5, "{n} estudiantes evaluados"), card "Estadísticas Rápidas" ("Reprobados", "No evaluados", "Desv. estándar"). Empty: "No hay estudiantes en este grado" + "Administrar Grados" (→ INS-11); no finals: **"No hay calificaciones registradas"** / "Aún no se han ingresado notas para este grupo en el periodo." + "Ir a la Planilla de Notas".

### 6.8 GRD-08 `/notas/estudiante?student=`

Header "Notas del Estudiante" / "Calificaciones por periodo, criterio y asignatura"; breadcrumb for staff "Estudiantes › {nombre} › Notas" and for student/parent "Dashboard › Notas"; staff button "Volver al Perfil". `StudentSwitcher` (staff: course then student; parent: children; student: none) and `StudentStrip`. KPI tiles (when finals exist): "Promedio General" (1 decimal), "Asignaturas Ganadas", "Asignaturas Perdidas", "Total Calificaciones". One card per period with grades (title = period name, badge "Activo", `dd/mm/yyyy – dd/mm/yyyy`): columns "Asignatura" (name + course small), per criterion "{criterio} ({peso}%)" ("-" when none), "Nota Final", "Estado" (Ganada / Perdida / No Evaluado), "Nivel de Desempeño" (Superior / Alto / Básico / Bajo badge: green, cyan, amber, red). `GradeScaleLegend`. Empty: **"No hay notas registradas"** / "No hay notas registradas para este estudiante aún."; no student chosen/in scope: `NoStudentBlock`.

## 7. Flows and audit

- **F5** Grading cycle: GRD-01 → GRD-02 (save) → GRD-03 (optional) → GRD-07/05 (review) → lock (sheet or GRD-04) → GRD-06 at year end; downstream readers: modules 09–13 and the alert/achievement engines read `final_grade`.
- **F14/F15** teacher and student daily routes link into GRD-02 and GRD-08.
- Audit: §4.3; `PERIOD_LOCKED` rejections are not audited.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`, `bun:test`): `periodFinal` with all/partial/none criteria, weights not summing to 100, boundary inputs yielding 2.995 → 3.00 (`ganada`), 2.99, 3.0, 4.595 → 4.60 (Superior), 4.59, 4.6, clamping, half-up at x.xx5 for 1,000 random cases against an exact `BigInt` reference; `statusOf`, `performanceLevel`, `scoreClass`, `annualDef`, `scoreBuckets` edges (1.99, 2.0, 4.99, 5.0), `classStats` (population SD), `parseScore` (comma, 3 decimals, 0.99, 5.01, blank).
- **API integration** (Postgres): `saveSheet` upserts only submitted cells, deletes on `null`, recomputes finals in the same transaction and returns them; **parity**: for generated score sets the stored `final_grade`, `saveSheet`'s `finals` and `periodFinal` agree; locked offering × period rejects `saveSheet`, `import`, `recalculate` with `PERIOD_LOCKED` even for admins; `lock: true` writes both audit events atomically; unlock rule (teacher own lock ok, coordinator's lock refused); `grade:manage_locks` for coordinator; student not in the course, inactive student, unknown criterion, period of another year, duplicate cells, observation without score, 501-char observation; criterion weight change via module 02 recomputes only open offering × periods; teacher scope (own offerings only, `inactivo` assignment loses access; `grade.classes` filtered); `studentGrades` scope matrix (staff, teacher in/out of scope, student self, parent linked/non-linked → `NOT_FOUND`); import (matching by document, accent-insensitive headers, blank cell keeps score, out-of-range row rejected whole, locked refused, 2,001 rows / `.xls` refused, preview writes nothing); `lockPanel` rows = offerings × periods with correct counts; permission matrix for every role (student/parent only `studentGrades`); generated tenant-isolation suite; no secret or full matrix in audit metadata.
- **Web**: sheet live totals equal `periodFinal` for the same draft (shared function), invalid-cell states, only changed cells submitted, dirty badge and leave warnings, locked read-only rendering, confirm dialogs; GRD-01 period pills and lock badges; GRD-03 preview/result states; GRD-04 filters and confirms; GRD-05/06/07/08 empty and populated states; stories for grid, badges, legend, `StudentSwitcher` variants.

### 8.2 Acceptance

- GRD-01…03: a teacher enters, saves and locks a sheet for an own offering; the live total equals the server `final_grade` (parity); other teachers' offerings are unreachable; import reports row errors and never touches locked periods.
- GRD-04: admin and coordinator lock and unlock any offering × period; every change is audited; a locked sheet is read-only in the UI and rejected by the API.
- GRD-05…07: finals, DEF and summary numbers equal `sige-core` over the stored records; averages and distributions match the buckets and rules above.
- GRD-08: staff, student and parent see consistent data; a parent requesting a non-linked student gets `NOT_FOUND`; levels and statuses use the contiguous bands (4.6 / 4.0 / 3.0).
- P5 exit criterion of foundation §8 (grade part) holds on the demo seed; `pnpm check-types`, lint, format and tests are green.

## 9. Open questions and notes

### 9.1 New open questions

| ID       | Question                                                                                                                                                 | Recommended default                                                                                                                            |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-GRD-1 | Who may unlock an offering × period? The prototype lets any teacher unlock from their sheet, while GRD-04 says only admins and coordinators manage locks | Teacher: only a lock they set themselves; coordinator/admin: any (§5.1 GRD-R6). Alternative: teachers never unlock (always ask a coordinator). |
| OQ-GRD-2 | Should students and parents see grades of a period that is still open (in progress)?                                                                     | Yes, as in the prototype (all periods with finals); an "En curso" badge on unlocked offering × periods is a cheap follow-up if schools object. |

### 9.2 Gaps found in 00-foundation.md

- G-GRD-1 §4.2 gives teachers `lock` but no unlock semantics and §5.4 says "Unlock is audited" without saying who may; defined in GRD-R6 (OQ-GRD-1). **Open decision OD-27 in 00-foundation §11 (see OQ-GRD-1).**
- G-GRD-2 §5.4 states half-up rounding on 2 decimals without prescribing the arithmetic; this spec mandates integer hundredths so 2.995 and 4.595 round deterministically (floating point gives 2.99 for `2.995 × 100`). **Resolved in 00-foundation (§5.4 integer hundredths half-up).**
- G-GRD-3 R3.8 lists "grade audit" among server lists, but no screen needs one; `grade.lockPanel` (GRD-04) is the only grade list. Audit browsing uses the existing activity pages filtered by `grade.*`. **Noted in 00-foundation: R3.8 "grade audit" list is satisfied by the activity pages; no new procedure.**
- G-GRD-4 §5.2 `final_grade.observation` has no UI in the 94 screens; kept nullable and unused in v1. **Noted in 00-foundation: `final_grade.observation` stays nullable and unused in v1.**
