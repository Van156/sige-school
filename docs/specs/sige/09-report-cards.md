# Spec: SIGE — Report cards (RPT)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query + Form (web), Drizzle + Postgres, `@react-pdf/renderer` (PDF, RPT-D1), `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.2 `report_card` grants, §4.3 scope, §5.2 `report_card` / `report_card_observation`, §5.4 grading rules, §6.8 R3.24–R3.25, §6.9 audit, OD-16), [`06-grades.md`](./06-grades.md) (`final_grade`, `performanceLevel`, score display), [`07-attendance.md`](./07-attendance.md) (`tally`), [`08-observations.md`](./08-observations.md) (observation tone, foundation dependency), [`02-institution.md`](./02-institution.md) (periods, `course.director`, logo port), [`05-students.md`](./05-students.md) (`student.pick`, `StudentSwitcher`, `StudentStrip`), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/report-cards/*` (`report-cards-screen.tsx`, `generate-report-card-screen.tsx`, `report-card-history-screen.tsx`, `report-card-view-screen.tsx`, `report-card-document.tsx`), `-mock/grading.ts` (`generateReportCard`, `generateReportCards`, `setReportDelivery`, `deleteReportCard`), `-screens/parent/child-report-cards-screen.tsx`. Inventory §3.10, F8. Requirement ids: `RPT-R<n>`. Phase P6.

## 1. Objective and scope

Report cards ("Boletines"): one document per student and period with the final score, performance level and status of every subject of the student's course, teacher comments, a general observation by the group director, the attendance summary and signature lines. Management generates them individually or in bulk, reviews them, marks them delivered ("Entregado") and can delete them. Teachers generate for students in their scope; students and guardians read and download them. The PDF is rendered on demand from a frozen snapshot, so a delivered card does not change when grades change until someone regenerates it (foundation R3.24).

### In scope

| Screen | Title                                            | Roles                                                     | Real route                      |
| ------ | ------------------------------------------------ | --------------------------------------------------------- | ------------------------------- |
| RPT-01 | "Gestión de Boletines de Calificaciones"         | R, A, C                                                   | `/boletines`                    |
| RPT-02 | "Generar Boletín de Calificaciones"              | R, A, C; T (own students); S own (read-only)              | `/boletines/generar?student=`   |
| RPT-03 | "Historial de Boletines"                         | R, A, C; T (own students); S own                          | `/boletines/historial?student=` |
| RPT-04 | "Boletín de Calificaciones" (A4 preview and PDF) | R, A, C, T (own students); S own; P children (via PAR-05) | `/boletines/$reportCardId`      |

Also in scope: tables `report_card` and `report_card_observation`; the snapshot builder and the PDF renderer; the shared `ReportCardDocument` preview. PAR-05 (module 13) reuses `reportCard.studentHistory` and RPT-04.

### Out of scope

- Official signatures, digital signing, QR verification of the document, and report cards for years other than the stored periods.
- Automatic generation on period close, e-mail or WhatsApp delivery (OD-11): "Entregado" is a manual flag.
- Rendering logo or crest images from user uploads beyond the institution logo of `FileStoragePort` (the crest "ESCUDO" stays a placeholder, OQ-RPT-3).

## 2. Data

Conventions R2.1–R2.6. Tenant-safe composite FKs to `student`, `academic_period`, `offering`, `person`.

| Table                     | Columns and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Indexes                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `report_card`             | `student_id`, `period_id`, `generated_at timestamptz`, `generated_by` (→ `person`), `general_observation` text null ≤ 1000, `snapshot jsonb not null`, `delivery_status` enum `pendiente` \| `entregado` default `pendiente`, `delivered_at` null, `delivered_by` null, `created_at`, `updated_at`. `unique(student_id, period_id)`. `check ((delivery_status = 'entregado') = (delivered_at is not null))`. FKs `restrict`: a period with cards cannot be deleted (module 02, "El periodo tiene notas registradas."). | `(organization_id, period_id, delivery_status)`, `(organization_id, student_id)`, `(organization_id, generated_at desc)` |
| `report_card_observation` | `report_card_id` (cascade), `offering_id`, `observation text not null` ≤ 500, `author_person_id`, `created_at`, `updated_at`. `unique(report_card_id, offering_id)`.                                                                                                                                                                                                                                                                                                                                                   | `(organization_id, report_card_id)`                                                                                      |

The `student_id` is the only link to the course: a card keeps showing the course it was generated for through the snapshot. Migration: enum + two tables. The seed (R4) generates about 120 cards through the same service (3 closed periods × 40 students).

### 2.1 Snapshot (`report_card.snapshot`, version 1)

Scores are integer hundredths (06 §3), so the snapshot has no floats.

```ts
type ReportCardSnapshot = {
  version: 1;
  generatedAt: string; // ISO
  institution: {
    name: string;
    nit: string | null;
    resolution: string | null;
    municipality: string | null;
    department: string | null;
    hasLogo: boolean;
  };
  student: {
    id: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    courseName: string;
    campusName: string;
    directorName: string | null;
  };
  period: {
    id: string;
    name: string;
    shortName: string;
    academicYear: string;
    startDate: string;
    endDate: string;
  };
  lines: {
    offeringId: string;
    subjectName: string;
    teacherName: string | null;
    finalCents: number | null;
    level: "Superior" | "Alto" | "Básico" | "Bajo" | null;
    status: "ganada" | "perdida" | "no evaluado";
  }[];
  attendance: { present: number; absent: number; justified: number; total: number } | null;
  generalObservation: string | null;
  subjectObservations: {
    offeringId: string;
    subjectName: string;
    teacherName: string | null;
    observation: string;
  }[];
  signatures: { director: string | null; coordinator: string | null; rector: string | null };
};
```

Grades, levels, attendance, names and the institution header are frozen at generation. The two narrative fields (`generalObservation`, `subjectObservations`) are authoritative in their own column/table and **patched into the snapshot in the same transaction** whenever they are edited (RPT-R9); that keeps "render from the snapshot" true while allowing delivery-time comments.

## 3. Rules (`packages/sige-core/src/report-card.ts`)

Pure functions shared by the generator, the preview and the PDF.

| Function                        | Definition                                                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `buildLines(offerings, finals)` | one line per offering of the course ordered by subject name (locale `es`); `finalCents`, `level` (`performanceLevel`, 06) and `status` (`statusOf`) from the student's `final_grade` of the period; no row → `finalCents: null`, `level: null`, `status: "no evaluado"`. |
| `attendanceSummary(rows)`       | `tally` of 07 over the student's rows dated inside `[period.start_date, period.end_date]` across all offerings; `null` when `total = 0` (section omitted).                                                                                                               |
| `statusLabel(status)`           | `ganada` → "APROBADO", `perdida` → "REPROBADO", `no evaluado` → "N/E" (green, red, grey).                                                                                                                                                                                |
| `SCALE_ROWS`                    | from `SIGE_RULES`: "Superior (4.6 - 5.0)" "Mínimo: 4.6", "Alto (4.0 - 4.5)" "Mínimo: 4.0", "Básico (3.0 - 3.9)" "Mínimo: 3.0", "Bajo (1.0 - 2.9)" "Máximo: 2.9". Display ranges only; classification uses the contiguous bounds (foundation §12 #8).                     |
| `REPORT_CARD_SECTIONS`          | ordered list of the nine sections of RPT-04 (§6.4); both renderers iterate it and a parity test asserts both emit every label (RPT-D1).                                                                                                                                  |
| `formatFinal(cents)`            | same display rule as 06 §3 (`4.0`, `3.75`, `4.55`): 1 decimal when the second decimal is 0, else 2; `"N/A"` for null.                                                                                                                                                    |

## 4. API

Router `routers/sige/report-card.ts` (`reportCardRouter`), all `sigeProcedure.use(requirePermission(...))`; `context.scope.assertStudent()` first. Other tenant or out-of-scope student/card → `NOT_FOUND` (R1.15). Errors per R3.5. Lists use the shared list contract (R3.8).

### 4.1 Procedures

| Procedure                          | Permission                                                                       | Input                                                                                                                                                                                                                                                          | Output                                                                                                                                       | Notes                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reportCard.list`                  | `report_card:deliver`                                                            | list input (`report-card-list-config.ts`: sort `generatedAt`, `student`, `course`, `period`, `delivery`; filters `search` text (student), `periodId` select, `courseId` select, `delivery` select `pendiente` \| `entregado`; default sort `generatedAt` desc) | `{ rows: CardRow[], total }`                                                                                                                 | RPT-01 table (R3.8). RPT-01 is the management screen, so its reads are gated by `deliver` (RPT-R1)                                                              |
| `reportCard.stats`                 | `report_card:deliver`                                                            | –                                                                                                                                                                                                                                                              | `{ total, delivered, pending }`                                                                                                              | RPT-01 tiles                                                                                                                                                    |
| `reportCard.generate`              | `report_card:generate`                                                           | `{ studentId, periodId }`                                                                                                                                                                                                                                      | `{ card: CardSummary, regenerated: boolean }`                                                                                                | RPT-02 and RPT-01 individual form; RPT-R2…R4                                                                                                                    |
| `reportCard.generateBulk`          | `report_card:generate` and `report_card:deliver`                                 | `{ courseId, periodId, regenerate?: boolean }`                                                                                                                                                                                                                 | `{ total, generated, skipped, errors, entries: { studentId, studentName, outcome: "generado" \| "omitido" \| "error", reason?: string }[] }` | RPT-01 bulk; one transaction with a savepoint per student (R3.6); RPT-R5                                                                                        |
| `reportCard.get`                   | `report_card:read` or `portal:read_self` / `portal:read_child`                   | `{ id }`                                                                                                                                                                                                                                                       | `{ card: CardSummary, snapshot: ReportCardSnapshot, can: { regenerate, deliver, edit, delete } }`                                            | RPT-04 and the editing dialogs; the snapshot is the whole document                                                                                              |
| `reportCard.studentHistory`        | `report_card:read` or `portal:read_self` / `portal:read_child`                   | `{ studentId }`                                                                                                                                                                                                                                                | `{ student: StudentStripData & { documentType, documentNumber, status }, periods: { period: PeriodRow, card: CardSummary \| null }[] }`      | RPT-02 tiles, RPT-03 table and chips, PAR-05 cards (R1.16); periods of every year ordered by year desc, `orderNum`; `can.generate` per student inside `student` |
| `reportCard.setDelivery`           | `report_card:deliver` (+ `report_card:update` when `generalObservation` is sent) | `{ id, status: "entregado" \| "pendiente", generalObservation?: string \| null }`                                                                                                                                                                              | `CardSummary`                                                                                                                                | RPT-01 "Estado de Entrega" dialog; RPT-R7                                                                                                                       |
| `reportCard.setSubjectObservation` | `report_card:update`, or `report_card:generate` for own offerings                | `{ id, offeringId, observation: string \| null }`                                                                                                                                                                                                              | `{ offeringId, observation: string \| null }`                                                                                                | RPT-R9; `null` or empty deletes the comment                                                                                                                     |
| `reportCard.delete`                | `report_card:delete`                                                             | `{ id }`                                                                                                                                                                                                                                                       | `{ deleted: true }`                                                                                                                          | RPT-01 trash; audited                                                                                                                                           |
| `reportCard.pdf`                   | same as `reportCard.get`                                                         | `{ id, download?: boolean }`                                                                                                                                                                                                                                   | `File` (`application/pdf`, `boletin-{documento}-{P#}-{año}.pdf`)                                                                             | RPT-R10; cached by `(id, updated_at)`                                                                                                                           |

```ts
type CardSummary = {
  id: string;
  studentId: string;
  studentName: string;
  periodId: string;
  periodShortName: string;
  academicYear: string;
  generatedAt: string;
  generatedByName: string;
  deliveryStatus: "pendiente" | "entregado";
  deliveredAt: string | null;
  generalObservation: string | null;
  commentCount: number;
};
type CardRow = CardSummary & { courseName: string | null };
```

`CardRow.courseName` is the course in the snapshot (the course the card was generated for), "N/A" when the student has none.

### 4.2 Audit

| Procedure                          | Action                    | Metadata                                                                                                             |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `reportCard.generate` (new)        | `report_card.generated`   | `{ reportCardId, studentId, periodId }`                                                                              |
| `reportCard.generate` (existing)   | `report_card.regenerated` | `{ reportCardId, studentId, periodId, wasDelivered }`                                                                |
| `reportCard.generateBulk`          | `report_card.generated`   | one event per call: `{ bulk: true, courseId, periodId, generated, regenerated, skipped, errors }` (not one per card) |
| `reportCard.setDelivery`           | `report_card.delivered`   | `{ reportCardId, from, to }` (both directions; `generalObservationChanged` when sent)                                |
| `reportCard.setSubjectObservation` | `report_card.updated`     | `{ reportCardId, offeringId, deleted: boolean }` (G-RPT-3)                                                           |
| `reportCard.delete`                | `report_card.deleted`     | `{ studentId, periodId, wasDelivered }`                                                                              |

Reads, PDF downloads and previews are not audited.

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- RPT-R1 **Who.** Management (owner, admin, coordinator) holds every `report_card` action. Teachers hold `read` and `generate`: they generate and read cards of students in their scope (OD-21) and write comments for their own offerings (RPT-R9); they have no RPT-01 (the sidebar entry and the RPT-01 reads are gated by `report_card:deliver`, G-RPT-2). Students and guardians read through the portal permissions: a student sees RPT-02 as a read-only period list (no "Generar Boletín"/"Regenerar"; the prototype allowed students to generate, which contradicts foundation §4.2), RPT-03 and RPT-04 of their own cards; guardians reach the same data through PAR-05.
- RPT-R2 **Generation preconditions** (foundation R3.25), checked in this order, each a `BAD_REQUEST`: student is `activo` ("El estudiante no está activo."), has a course (**"El estudiante no tiene un grado asignado."**), the course has offerings (**"No hay asignaturas configuradas para este grado."**), and the student has at least one `final_grade` in the period (**"No hay calificaciones registradas para este estudiante en este periodo."**). Unknown period → `NOT_FOUND`. A period still in progress is allowed (it prints the finals available, others "N/E").
- RPT-R3 **Content.** Lines cover **every offering of the student's current course** (06 GRD-08 rule), including subjects with no final ("N/A"/"-"/"N/E"); finals come from `final_grade` (the 06 cache), never recomputed here. The attendance summary spans all offerings inside the period dates. `directorName` is the course director (`course.director_person_id`); `signatures` per RPT-R11. A student who changed course mid-year gets a card for the current course only (finals of the previous course are not shown).
- RPT-R4 **Regeneration.** Generating where a card exists rebuilds the snapshot, `generated_at` and `generated_by`; it **keeps** `general_observation`, the subject comments and the delivery state. A teacher cannot regenerate an `entregado` card (`FORBIDDEN` "Solo coordinación puede regenerar un boletín entregado."); management can, after the confirm below, and the event records `wasDelivered`. Confirm (RPT-02 tile): **"¿Regenerar este boletín?"** / "Se recalcula con las notas actuales y se actualiza la fecha de generación." (for a delivered card the description adds "El boletín ya fue entregado."). The prototype's auto-written comments and canned general remark are fixtures and are **not** reproduced: a new card has no general observation and no comments until someone writes them (RPT-R9).
- RPT-R5 **Bulk generation.** `generateBulk` processes the active students of the course ordered by name. Outcomes: `generado` (created or regenerated), `omitido` (no grades for the period; or a card already exists and `regenerate` is false: "Ya existe un boletín para este periodo."; or a delivered card and the caller lacks regeneration right), `error` (unexpected failure of that student, its savepoint rolled back, message "Error al generar el boletín."). The call fails as a whole with "No hay asignaturas configuradas para este grado." or **"No hay estudiantes activos en este grado"**. `regenerate` defaults to false; the prototype regenerated silently (OQ-RPT-1). The result modal shows the first 20 entries (RPT-01 §6.1).
- RPT-R6 **List and counters.** `stats` count every card of the institution (all years); the table filters are period, course (of the snapshot) and delivery. The prototype "ID" column is dropped (UUID ids carry no meaning); the default sort is newest first.
- RPT-R7 **Delivery.** `entregado` sets `delivered_at = now`, `delivered_by = caller`; `pendiente` clears both. The dialog may also edit the general observation (≤ 1000: "La observación general no puede superar 1000 caracteres."; empty → null), which patches the snapshot (RPT-R9). Toast "Estado de entrega actualizado". Setting the status it already has is a no-op.
- RPT-R8 **Delete.** `report_card:delete` (owner, admin, coordinator); confirm **"¿Eliminar este boletín?"** / "Esta acción no se puede deshacer."; toast "Boletín eliminado"; cascades to its comments. Regenerating afterwards creates a fresh card in `pendiente`.
- RPT-R9 **Narrative fields.** Comments per subject (≤ 500: "La observación no puede superar 500 caracteres.") may be written by management for any line of the card and by a teacher only for lines whose offering they teach (scope); the offering must be one of the snapshot lines. The general observation is written by management only (the director-of-group role is not a permission). Each edit rewrites the matching part of `snapshot` and bumps `updated_at`, not `generated_at`. The prototype has no editor for comments; the additive RPT-02 dialog "Observaciones por Asignatura" provides it (OQ-RPT-3).
- RPT-R10 **PDF.** `reportCard.pdf` renders from the snapshot, never from live grades, with `@react-pdf/renderer` on the Bun server (RPT-D1). The logo is read from `FileStoragePort` at render time when `institution.hasLogo`, otherwise the "LOGO" placeholder box; "ESCUDO" stays a placeholder. Result cached in memory by `(id, updated_at)` (LRU, ≤ 200 entries). `Content-Disposition` inline for RPT-04 preview opening, attachment when `download`. Paper A4 portrait, rows never split across pages, Helvetica (WinAnsi covers accents, ñ, ¿, ¡).
- RPT-R11 **Signature names.** The three signature lines carry the label and the word "Firma": "Director(a) de Grupo", "Coordinador(a) Académico(a)", "Rector(a)". The snapshot stores `directorName` (course director), `rector` (the oldest `owner` member's name) and `coordinator` only when the institution has exactly one active coordinator; otherwise null and the line stays blank (OQ-RPT-4). Names print under the line when present.
- RPT-R12 **Concurrency.** Two simultaneous generations of the same student × period collapse on `unique(student_id, period_id)` (upsert); the later call reports `regenerated: true`.

## 6. Web

Feature folder `apps/web/src/features/report-cards`; thin routes under `routes/_auth/_org/boletines/`. Shared kit and student components as in module 08. `ReportCardDocument` is the on-screen A4 view of the snapshot (white sheet, dark text in both themes) and is the layout reference of the PDF renderer. Dates `dd/mm/yyyy`; date-times `dd/mm/yyyy HH:MM`.

### 6.1 RPT-01 `/boletines`

Header "Gestión de Boletines de Calificaciones" / "Genera, revisa y entrega los boletines por periodo". Three tiles: "Total Generados", "Entregados", "Pendientes". Card "Generar Boletines" with two sub-forms:

- **"Boletín Individual"**: "Grado" ("Seleccione un grado...", `course.options`), "Estudiante" ("Seleccione un estudiante...", `student.pick` for the course, disabled until a course is chosen), "Periodo Académico" ("Seleccione un periodo...", options "{periodo} ({año})" from `period.list`); button "Generar Boletín" (disabled until all three are set). Success toast "Boletín generado exitosamente." (or "Boletín regenerado"); errors as a toast "No se pudo generar el boletín" with the RPT-R2 reason.
- **"Generación Masiva por Grado"**: "Grado", "Periodo Académico"; checkbox "Regenerar los existentes" (additive, OQ-RPT-1); button "Generar Todos los Boletines" (disabled until both set). While running: progress bar with "Generando boletines..."; then "¡Completado!" or "Error en la generación." (client state of the single request). Result modal **"Resultado de Generación Masiva"** / "Resumen de los boletines procesados.": four counters "Total", "Generados", "Omitidos", "Errores"; list of the first 20 entries ("✓", "–", "✗" glyphs) as "{estudiante}: {generado|omitido|error} ({motivo})" then "... y {n} más"; buttons "Cerrar" and "Actualizar" (refetch).

Card "Boletines Generados" (`reportCard.list`): search "Buscar estudiante o grado", filters "Todos los periodos", "Todos los grados", "Toda entrega" (options "Entregados", "Pendientes"). Columns "Estudiante", "Grado" ("N/A"), "Periodo" (badge short name), "Generado" (`dd/mm/yyyy HH:MM`), "Entrega" (badge "Entregado" green / "Pendiente" amber), actions: eye "Ver boletín de {nombre}" (→ RPT-04), download "Descargar boletín de {nombre}" (`reportCard.pdf` with `download`), truck "Estado de entrega de {nombre}" (dialog), clock "Historial de boletines de {nombre}" (→ RPT-03), trash "Eliminar boletín de {nombre}". Empty: **"No hay boletines generados aún."** / "Genera el primer boletín con los formularios de arriba."; load failure "No se pudieron cargar los boletines." with retry.

Dialog **"Estado de Entrega"**: "Estudiante: **{nombre}**", radio group "Cambiar estado a" ("Entregado", "Pendiente"), textarea "Observación general" (3 rows), buttons "Cancelar", "Guardar".

### 6.2 RPT-02 `/boletines/generar?student=`

Header "Generar Boletín de Calificaciones" / "Elige el periodo y genera el boletín del estudiante"; back "Volver a Gestión" (management). `StudentSwitcher` (staff by course; student hidden) and `StudentStrip` with action "Ver Historial" (→ RPT-03). Card "Seleccionar Periodo": one tile per period (name, year, `dd/mm/yyyy - dd/mm/yyyy`, badge "Activo"). With a card: "Estado:" badge, "Generado: dd/mm/yyyy HH:MM", buttons "Ver" (→ RPT-04), "Regenerar" (confirm RPT-R4, hidden for a teacher on a delivered card and for students), "Observaciones" (additive dialog "Observaciones por Asignatura": one textarea per snapshot line, teacher limited to own offerings, buttons "Cancelar"/"Guardar"); without a card: "Generar Boletín" (not for students). No periods: **"No hay periodos académicos configurados"** / "Contacte al administrador para configurar los periodos académicos."

### 6.3 RPT-03 `/boletines/historial?student=`

Header "Historial de Boletines" / "Boletines generados y su estado de entrega"; actions "Generar Nuevo Boletín" (→ RPT-02, `report_card:generate`) and "Volver a Gestión" (management). Card "Información del Estudiante": "Nombre completo", "Documento" ("{tipo} {número}"), "Grado" ("N/A"), "Estado" (Activo/Retirado/Graduado). Card "Boletines Generados" (newest first): "Periodo" (short name, bold), "Año Académico", "Fecha Generación" ("N/A"), "Estado Entrega" ("Entregado" + `dd/mm/yyyy` small, or "Pendiente"), "Observación General" (truncated at 50 characters, italic "Sin observaciones"), actions "Ver PDF" (→ RPT-04) and "Descargar PDF". Empty: **"No hay boletines generados para este estudiante"** / "Los boletines generados aparecerán aquí." + "Generar Primer Boletín" (with `generate`). Card "Todos los Periodos Académicos": a chip per period (short name, year), badge "Generado" or "Sin generar", tag "Activo" for the active period.

### 6.4 RPT-04 `/boletines/$reportCardId`

Header "Boletín de Calificaciones" / "Vista de impresión del boletín"; actions "Imprimir" (`window.print()`, print stylesheet hides shell and header actions) and "Descargar PDF" (`reportCard.pdf`); back "Volver a Gestión" (management). `document.title` = "Boletín de Calificaciones - {estudiante} - {P#}". Unknown or out-of-scope id: `NotFoundBlock` "Boletín no encontrado". The document, in this order (`REPORT_CARD_SECTIONS`):

1. **Header**: "LOGO" placeholder (or the logo), institution name (uppercase, bold), "NIT: {nit}", "Resolución: {resolución}", "{municipio}, {departamento}" (each only when present), "ESCUDO" placeholder; banner "Boletín de Calificaciones - {P#} {año}".
2. **"Datos del Estudiante"**: "Nombre completo", "Documento" ("{tipo} {número}"), "Grado", "Sede", "Director de Grupo" (when present), "Fecha de generación" (`dd/mm/yyyy`); missing values "N/A".
3. **"Calificaciones por Asignatura"** table: "Asignatura", "Nota Final" (`formatFinal`), "Desempeño" (level or "-"), "Estado" ("APROBADO" / "REPROBADO" / "N/E").
4. **"Escala Valorativa Institucional"**: the four cells of `SCALE_ROWS`.
5. **"Observaciones por Asignatura"** (only when comments exist): "{asignatura} - {docente o 'Sin docente'}" and the text.
6. **"Observación General del Director de Grupo"**: text, or italic "Sin observaciones generales registradas."
7. **"Resumen de Asistencia - {P#}"** (only when the summary exists): tiles "Presentes", "Ausencias", "Justificadas", "Total Registros".
8. **Signatures**: "Director(a) de Grupo", "Coordinador(a) Académico(a)", "Rector(a)", each with "Firma".
9. **Footer**: "{institución} - Sistema Integral de Gestión Escolar (SIGE)" and "Documento generado el {d de mes de año a las HH:MM}. Este boletín es un documento oficial." (month name via `Intl` `es-CO`).

## 7. Flows and audit

- **F8** Report card generation, review, delivery: RPT-01 individual or bulk generation → table (Pendiente) → RPT-04 review/download → "Estado de entrega" → RPT-03 history; RPT-02 regenerates when grades change; guardians read PAR-05 and download the PDF.
- Teacher variant: DASH-04/STU-02 → RPT-02 for a student in scope; student variant: RPT-03/RPT-04 own cards.
- Audit: §4.2.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): `buildLines` (subject ordering, missing final → N/E, 2.995 → 3.00 `ganada`, levels at 4.595/4.6), `attendanceSummary` (inclusive period bounds, empty → null, justificado + excusado merge), `formatFinal` (`4.0`, `3.75`, `4.55`, null), `SCALE_ROWS`, `REPORT_CARD_SECTIONS` order.
- **API integration** (Postgres): each precondition message (retired student, no course, no offerings, no finals); generation creates snapshot, `final_grade`-exact lines, attendance within period bounds; **snapshot immutability**: change a grade afterwards, the delivered card's `get`/`pdf` is unchanged until `generate` again; regeneration keeps observations and delivery state, teacher on a delivered card `FORBIDDEN`, management allowed with `wasDelivered`; bulk (mixed students: with grades, without grades, existing card with and without `regenerate`, delivered card, one forced failure inside a savepoint) returns the exact counters and leaves other cards intact; `setDelivery` stamps and clears; `generalObservation` and subject comments patch the snapshot, `generated_at` unchanged, teacher limited to own offerings; `delete` cascades comments and audits; period delete blocked by cards; scope matrix (teacher own/other, director, student self, parent linked/non-linked → `NOT_FOUND`); `list` filters/sort/pagination; `reportCard.list` `FORBIDDEN` for a teacher; two-tenant isolation; permission matrix per role; no `organizationId` in schemas; audit rows once per call with counts only.
- **PDF**: generated bytes start with `%PDF`; extracted text contains every `REPORT_CARD_SECTIONS` label, student name and each line's subject/final/status (RPT-D1 parity); accents render; a 14-subject card paginates without splitting rows; logo missing and present; cache hit on the second request and miss after a comment edit.
- **Web**: RPT-01 disabled-until-complete buttons, bulk modal counters and "... y n más", delivery dialog, delete confirm, filters; RPT-02 tile states per role (student read-only, teacher on delivered card); RPT-03 table, chips and empty copy; RPT-04 renders every section from a snapshot and hides optional sections; print stylesheet class presence; stories for `ReportCardDocument`, period tile and delivery dialog.

### 8.2 Acceptance

- RPT-01/02: bulk generation for a course reports generated/skipped/errors exactly; individual generation honors the preconditions with their messages.
- RPT-04: the PDF has every section of §6.4 and is produced from the snapshot; changing a grade after generation does not alter a delivered card until "Regenerar".
- RPT-03: the history shows the same cards as RPT-01 for that student; a student sees only their own; guardians see them in PAR-05.
- P6 exit criterion of foundation §8 holds on the demo seed.

## 9. Decisions, open questions and notes

### 9.1 Decisions

- RPT-D1 **PDF engine (resolves OD-16).** `@react-pdf/renderer` (pure JS, no headless browser). Foundation R3.25 asks for "the same component tree as the on-screen A4 preview", which is impossible with a pure-JS engine because react-pdf renders its own primitives, not DOM nodes (G-RPT-1). Equivalent guarantee: one snapshot, one section list (`REPORT_CARD_SECTIONS`), shared layout constants (paper, margins, colours, copy) and the parity tests of §8.1. Spike required before implementation: run it under Bun with the A4 layout and a 14-subject card; fallback `pdfmake` (also pure JS) with the same section list.

### 9.2 New open questions

| ID       | Question                                                                               | Recommended default                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-RPT-1 | Should bulk generation regenerate cards that already exist (prototype: silently yes)?  | No: existing cards are "omitido" unless the new checkbox "Regenerar los existentes" is ticked; delivered cards additionally require management. |
| OQ-RPT-2 | Final score printed with 1 decimal (prototype/inventory) or with its stored precision? | Stored precision via `formatFinal` (4.0, 3.75): avoids printing 4.6 for a 4.55 that the card classifies as "Alto".                              |
| OQ-RPT-3 | Editor for subject comments and crest image (neither exists in the prototype)          | Additive dialog on RPT-02 for comments (RPT-R9); crest stays the "ESCUDO" placeholder, logo from `FileStoragePort`.                             |
| OQ-RPT-4 | Which coordinator signs when the institution has several (the seed has two)?           | Print a coordinator name only when exactly one active coordinator exists; otherwise the line is blank for manual signing.                       |

### 9.3 Gaps found in 00-foundation.md and 01

- G-RPT-1 §6.8 R3.25 "same component tree" vs OD-16 "pure-JS PDF library": see RPT-D1. **Resolved in 00-foundation (§6.8 R3.25 aligned with RPT-D1 / OD-16).**
- G-RPT-2 `01-auth-and-dashboards.md` §5.2 gates the "Boletines" sidebar entry (RPT-01) by `report_card:generate`, which teachers also hold; RPT-01 is management-only in the prototype (`-nav.ts`: RAC). This spec gates RPT-01 and its reads by `report_card:deliver`; the nav row of module 01 should use it. **Resolved: `01-auth-and-dashboards.md` nav row "Boletines" now gates on `report_card:deliver`.**
- G-RPT-3 §6.9 lists no event for narrative edits; `report_card.updated` is added (comment and general-observation changes). **Resolved in 00-foundation (§6.9 `report_card.updated`).**
- G-RPT-4 §5.2 `report_card` needs `updated_at` (cache key and narrative edits) and its index set; added in §2. The module index (§7) lists RPT-04 roles as "S, P" but teachers hold `report_card:read`; RPT-04 is open to teachers for their students (as `-screens.ts`). **Resolved in 00-foundation (§5.2 `report_card.updated_at`; §7 index lists RPT-04 for T, S, P).**
