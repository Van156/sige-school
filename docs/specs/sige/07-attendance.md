# Spec: SIGE — Attendance (ATT)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query + Form (web), Drizzle + Postgres, `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.3 scope, §5.2 `attendance_record`, §5.3 R2.10, §5.5 absence rules, R3.10, R3.13, OD-7), [`04-scheduling.md`](./04-scheduling.md) (`offering`, `offering.options`), [`05-students.md`](./05-students.md) (`student.pick`), [`06-grades.md`](./06-grades.md) (shared `ClassContext` and class header), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/attendance/*`, `-components/attendance-charts.tsx`, `-lib/{class-stats,calendar}.ts`, `-mock/{helpers,grading}.ts` (`saveAttendance`, `absenceRate`). Inventory §3.8, F6. Requirement ids: `ATT-R<n>`. Phase P5.

## 1. Objective and scope

Daily attendance per class session: the roll sheet teachers fill, the student history (also read by the student and the guardians), the group summary with the at-risk list, and the printable date-range report. Attendance feeds the alert engine ("Inasistencia Crítica", module 12), the achievements ("Asistencia Perfecta", module 11) and the attendance metrics (module 10) through one set of pure rules.

### In scope

| Screen | Title                     | Roles                                              | Real route               |
| ------ | ------------------------- | -------------------------------------------------- | ------------------------ |
| ATT-01 | "Tomar Asistencia"        | R, A, C; T (own offerings)                         | `/asistencia`            |
| ATT-02 | "Historial de Asistencia" | R, A, C; T (own offerings only); S own; P children | `/asistencia/estudiante` |
| ATT-03 | "Resumen de Asistencia"   | R, A, C; T (own)                                   | `/asistencia/resumen`    |
| ATT-04 | "Reporte de Asistencia"   | R, A, C; T (own)                                   | `/asistencia/reporte`    |

Also in scope: table `attendance_record`; the pure attendance rules in `packages/sige-core`; CSV exports.

### Out of scope

- Per-hour or per-period attendance and late arrivals: "tarde" does not exist as a status (inventory §0.4).
- Automatic notifications to guardians (OD-11) and the alert/achievement rules themselves (modules 11/12).
- Parent-portal wrapper PAR-03 (module 13) reuses `attendance.studentSummary`, `attendance.history` and `attendance.calendar`.
- School calendar (holidays, vacations) and a year-calendar view (the prototype's `calendar.ts` helper is not used by these four screens).

## 2. Data

Conventions R2.1–R2.6.

| Table               | Columns and constraints                                                                                                                                                                                                                                                                                                                                                                                                                     | Indexes                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `attendance_record` | `student_id`, `offering_id`, `date date not null`, `status` enum `attendance_status` (`presente`, `ausente`, `justificado`, `excusado`), `observation` text null ≤ 300, `recorded_by` (→ `person`, the last editor), `created_at`, `updated_at`. `unique(student_id, offering_id, date)` (save = upsert). `check (extract(isodow from date) between 1 and 6)` (never Sunday; the Saturday rule is a service check, ATT-R3). FKs `restrict`. | `(organization_id, offering_id, date)`, `(organization_id, student_id, date desc)` |

`date` is a calendar date with no time zone; "today", the weekday and future checks use `America/Bogota` on the server (R3.13). No other table.

Migration: enum + table. The seed (R4) generates eight weeks of records through the same service.

## 3. Attendance rules (`packages/sige-core/src/attendance.ts`)

Pure functions shared by API, web (live counters), seed, metrics, alert and achievement engines (R3.18).

| Function                      | Definition                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tally(rows)`                 | `{ total, present, absent, justified }` where `absent` counts `ausente` only and `justified` counts `justificado` + `excusado` (the prototype's three-way split).                                     |
| `absenceRate(rows)`           | `100 − attendancePct`, i.e. the share of rows whose status is **not** `presente` (OD-7), one decimal, half-up; `0` for no rows. `attendancePct = round(present / total × 100, 1)`, `100` for no rows. |
| `absenceBand(rate)`           | `> 20` "Crítico" (destructive), `> 10` "Atención" (warning), otherwise "Normal" (success). Boundaries are exclusive: 20.0 is "Atención", 10.0 is "Normal".                                            |
| `monthlyTally(rows)`          | per `YYYY-MM` `{ month, total, present, absent, justified }` sorted ascending.                                                                                                                        |
| `byStudent(studentIds, rows)` | per student `{ studentId, total, present, absent, justified, attendancePct, absenceRate, band }`; students without rows have `total = 0` and no band.                                                 |
| `atRisk(perStudent)`          | students with `absenceRate > 20`, ordered by rate desc.                                                                                                                                               |
| `isSchoolDay(date, shift)`    | Monday–Friday; Saturday only when the course shift is `Sabatina`; never Sunday.                                                                                                                       |

Constants from `SIGE_RULES`: critical 20, attention 10, low-attendance 80 (used by metrics). Rounding is the same half-up helper as grading.

## 4. API

Router `routers/sige/attendance.ts` (`attendanceRouter`), all `sigeProcedure.use(requirePermission(...))`; `context.scope.assertOffering()` and `assertStudent()` first; other tenant or out-of-scope → `NOT_FOUND` (R1.15). Errors per R3.5. Lists use the shared list contract (R3.8); CSV exports re-run the same filtered query without paging (R3.10).

### 4.1 Procedures

| Procedure                   | Permission                                                    | Input                                                                                                                                                                                  | Output                                                                                                                                                              | Notes                                                                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attendance.sheet`          | `attendance:record`                                           | `{ offeringId, date?: string }` (default: today in Bogotá)                                                                                                                             | `{ offering: { id, subjectName, courseId, courseName, shift }, date, today, isSchoolDay, students: { id, name }[], records: { studentId, status, observation }[] }` | students = active students of the course (last name, first name, locale `es`); `records` = saved rows of that date                                                                                                                                            |
| `attendance.save`           | `attendance:record`                                           | `{ offeringId, date, records: { studentId, status, observation?: string \| null }[1..200] }`                                                                                           | `{ created, updated, total }`                                                                                                                                       | upsert in one transaction (ATT-R2); sets `recorded_by`                                                                                                                                                                                                        |
| `attendance.groupSummary`   | `attendance:read`                                             | `{ offeringId }`                                                                                                                                                                       | `{ header, totals, monthly, atRisk, rows: StudentTally[] }`                                                                                                         | ATT-03; all dates of the offering's academic year                                                                                                                                                                                                             |
| `attendance.report`         | `attendance:read`                                             | `{ offeringId, from: string, to: string }`                                                                                                                                             | `{ header, from, to, totals, daily: { date, present, absent, justified }[], rows: StudentTally[] }`                                                                 | ATT-04; ATT-R6                                                                                                                                                                                                                                                |
| `attendance.studentSummary` | `attendance:read` or `portal:read_self` / `portal:read_child` | `{ studentId }`                                                                                                                                                                        | `{ student, totals, rate, band, monthly: MonthTally[] }`                                                                                                            | ATT-02 KPIs, charts, "Desglose Mensual"; teacher: only own offerings' rows (ATT-R5)                                                                                                                                                                           |
| `attendance.history`        | same as `studentSummary`                                      | `{ studentId } & list input` (`attendance-list-config.ts`: sort `date`, `subject`, `status`; filters `offeringId` select, `status` select, `date` dateRange; default sort `date` desc) | `{ rows: HistoryRow[], total }`; `HistoryRow` = `{ id, date, subjectName, status, observation, recordedByName }`                                                    | ATT-02 table (server-driven, R3.8)                                                                                                                                                                                                                            |
| `attendance.calendar`       | `attendance:read` or `portal:read_self` / `portal:read_child` | `{ studentId, month?: string }` (`YYYY-MM`, default current month in Bogotá)                                                                                                           | `{ month, days: { date, status: "presente" \| "ausente" \| "justificado" }[], monthTotals: Tally, yearTotals: Tally, yearMonthly: MonthTally[] }`                   | PAR-03 calendar (G-PAR-1); covers all offerings of the student, a day is "ausente" if any class was missed (PAR-R4); year totals span the calendar year of `month`; invalid month → `BAD_REQUEST` "Mes inválido."; teacher: own offerings' rows only (ATT-R5) |
| `attendance.export`         | same permission as the matching read                          | `{ kind: "student", studentId, filters? } \| { kind: "group", offeringId } \| { kind: "report", offeringId, from, to }`                                                                | `File` (`text/csv; charset=utf-8`, UTF-8 BOM, comma separated, RFC 4180 quoting)                                                                                    | scope applies; columns below                                                                                                                                                                                                                                  |

```ts
type StudentTally = {
  studentId: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  justified: number;
  attendancePct: number | null;
  absenceRate: number | null;
  band: "critical" | "attention" | "normal" | null;
};
type Tally = { total: number; present: number; absent: number; justified: number };
type MonthTally = {
  month: string;
  total: number;
  present: number;
  absent: number;
  justified: number;
};
```

CSV columns (headers in Spanish): student history "Fecha,Asignatura,Estado,Observación,Registrado por"; group and report "Estudiante,Presentes,Ausentes,Justificados,% Asistencia,% Ausencia,Estado"; the roll sheet export of ATT-01 is generated client-side from the on-screen state ("Estudiante,Estado,Observación").

### 4.2 Audit

One event per save, counts only (the per-row trail is `recorded_by`/`updated_at`): `attendance.saved` `{ offeringId, date, created, updated, changedStatuses }` (action added to the catalog, G-ATT-2). Reads and exports are not audited.

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- ATT-R1 **Who records.** `attendance:record` (owner, admin, coordinator, teacher). A teacher only for offerings in their scope (`teacher_assignment` `activo` or `temporal`); others get the screen state **"Acceso prohibido"** / "No tienes permiso para ver esta asignatura." (server: `NOT_FOUND`; message "No tienes permiso para esta asignatura." in API errors). Course directors are not granted extra offerings (G-ATT-1).
- ATT-R2 **Save is an upsert** of `(student, offering, date)`; every submitted student must be an active student of the offering's course (`BAD_REQUEST` "El estudiante no pertenece a este grado."); duplicates in one request rejected; at least one record ("No hay estudiantes para registrar"); statuses limited to the four values ("Datos inválidos"). Existing rows are updated (status, observation, `recorded_by`, `updated_at`), new ones inserted. The UI sends every listed student, so saving a sheet is idempotent.
- ATT-R3 **Date rules** (R3.13, server-side in `America/Bogota`): missing date → "Faltan datos requeridos"; malformed → **"Fecha inválida"**; in the future → **"No se puede registrar asistencia en una fecha futura."**; not a school day for the course shift (weekend; Saturday allowed only for `Sabatina`) → "Las clases se dictan de lunes a viernes." (UI callout **"Fin de semana"**: "Las clases se dictan de lunes a viernes; elige otra fecha para guardar la asistencia."). Past dates are unrestricted in v1 and holidays are not modelled (OQ-ATT-1).
- ATT-R4 **Absence definition** (OD-7): every non-`presente` status is an absence for rates, bands, alerts and metrics; tallies still split `ausente` from `justificado`/`excusado`. Bands per §3.
- ATT-R5 **Row scope for history.** A teacher sees and tallies only rows of their own offerings (so the same student may show different totals to two teachers); management sees all; student and parent see all offerings of self/children. `attendance.studentSummary` and `history` apply the same filter, so the table and the KPIs always agree.
- ATT-R6 **Report range** (ATT-04): `from ≤ to` ("La fecha inicial no puede ser posterior a la final."), at most 366 days ("El rango no puede superar un año."), both inclusive; defaults `to` = today, `from` = today − 30 days (prototype; the inventory suggested the current month). Rows outside the offering's academic year are included if inside the range.
- ATT-R7 **Active students only** (R2.10): sheets, summaries and reports list active students of the course; history of retired students remains in ATT-02.
- ATT-R8 **Students with no records** show "-" for percentages and the badge "Sin registros" in tables (the prototype printed 100%/Normal, which reads as perfect attendance); they are excluded from the at-risk list.
- ATT-R9 **Observation** ≤ 300 chars ("La observación no puede superar 300 caracteres."); trimmed; empty → null.
- ATT-R10 **Consumers.** The alert engine ("Inasistencia Crítica": absence `> 20%` in the last 30 days), the achievement rule "Asistencia Perfecta" and MET-06 call `sige-core` functions over `attendance_record` rows; none re-implements them (R2.17).

## 6. Web

Feature folder `apps/web/src/features/attendance`; thin routes under `routes/_auth/_org/asistencia/`. Charts reuse the prototype components (`MonthlyAttendanceChart` bar/line, donut, stacked daily series) with the palette Presentes green, Ausentes red, Justificados amber (inventory §3.8). Every screen has loading, error-with-retry, empty and permission states; stories for the roll row, tiles, charts and band badge. Dates `dd/mm/yyyy`; month labels via `Intl` `es-CO` ("octubre de 2026").

### 6.1 ATT-01 `/asistencia?courseId&offeringId&date`

Header "Tomar Asistencia" / "Registro diario de asistencia estudiantil"; action "Ver Resumen" (→ ATT-03 for the selected offering). Step 1 card "Seleccione Grado y Asignatura": "Grado" ("-- Seleccione un grado --", only courses with an offering in the caller's scope), "Asignatura" (dependent; "-- Seleccione primero un grado --", then "-- Seleccione una asignatura --", options "{materia} - {docente o Sin docente}"), "Fecha" (date input, default today from the server). Choices live in the URL. Step 2 appears once an offering is chosen (`ClassContext` guards: "Selecciona una asignatura" / "Elige un grado y una asignatura para continuar."; unknown offering `NotFoundBlock`; forbidden state per ATT-R1). Content:

- Tiles "Presentes", "Ausentes", "Justificados", "Excusados" updating live.
- Callouts: **"Fin de semana"** (ATT-R3; "Guardar" disabled) and **"Registro existente"**: "Se cargaron {n} registros de esta fecha; al guardar se actualizan."
- Card "{materia} - {curso}" / "Marca el estado de cada estudiante y guarda al terminar." Actions: "Todos Presentes" (info toast "Hecho" / "Todos marcados como presente"), "Solo Ausentes" ↔ "Mostrar Todos" (filter, `aria-pressed`), "Exportar" (client-side CSV). Search "Buscar estudiante".
- Table: "#", "Estudiante", "Estado" (four toggle buttons, exactly one active per row: "✓ Presente" green, "✗ Ausente" red, "⚑ Justificado" amber, "ℹ Excusado" blue/grey; default "presente" for students without a saved row), "Observación" (placeholder "Observación...", max 300), quick actions "Marcar ausente" / "Marcar presente". Paginated client-side at 20 rows (a course holds ≤ 60 students).
- Footer button "Guardar Asistencia ({n} estudiantes)" → `attendance.save`; success toast **"Asistencia guardada"** with "{n} registros del {dd/mm/yyyy}."; errors map to the §5 messages ("Seleccione una asignatura y fecha" client-side when missing, "No hay estudiantes para registrar", "Error de conexión").
- Changing the date or offering reloads the sheet (`attendance.sheet`); with unsaved edits a confirm "Hay cambios sin guardar. ¿Descartarlos?" precedes it, and a "Cambios sin guardar" badge plus `beforeunload` guard the page.

Empty: "No hay estudiantes activos en este grado." ("Ningún estudiante coincide con el filtro." when filtered).

### 6.2 ATT-02 `/asistencia/estudiante?student=`

Header "Historial de Asistencia" / "Asistencia por asignatura, mes y estado"; `StudentSwitcher` + `StudentStrip` (name, course badge, document badge); staff get "Volver al Perfil" (→ STU-02) and "Tomar Asistencia" (→ ATT-01, `attendance:record`). Alert banner by band: `> 20` destructive **"¡Alerta de Inasistencia Crítica!"** — "Este estudiante tiene una tasa de inasistencia del **{x}%**, que supera el umbral crítico del 20%. Se recomienda notificar a coordinación y al acudiente."; `> 10` warning **"Atención: Tendencia de Inasistencia"** — "Este estudiante tiene una tasa de inasistencia del **{x}%**. Monitorear de cerca para evitar ausencias críticas." Tiles "Total Registros", "Presentes" (+ "{%}"), "Ausentes" (+ "{%}"), "Justificados" (+ "{%}"; justificado + excusado). Cards "Distribución General" (donut) and "Tendencia Mensual" (grouped bars per month); "Desglose Mensual" (newest first: "**{mes}** ({n} registros)", "{p} presentes", "{a} ausentes", "{j} justificados", "**{x}% ausencias**"); card "Historial de Asistencia" with "Exportar CSV" and the server-driven table: "Fecha", "Asignatura" ("N/A" when missing), "Estado" (badge with glyph), "Observación", "Registrado por" (name or "Usuario"); filters by asignatura, estado and date range; default sort newest first. Empty: **"Sin registros de asistencia"** / "No hay registros de asistencia para este estudiante." Students and parents see no staff actions; teachers see only their offerings' rows (ATT-R5).

### 6.3 ATT-03 `/asistencia/resumen?offeringId=`

Header "Resumen de Asistencia" / "Asistencia acumulada del grupo"; sub "{materia} - {curso}"; actions "Tomar Asistencia" (→ ATT-01), "Reporte por Rango" (→ ATT-04), "Ver Estudiantes" (→ STU-01 filtered by course). Tiles "Total Registros", "Presentes", "Ausentes", "Justificados" (+ %). Card "Estudiantes en Riesgo por Inasistencia (>20%)" (only when any): each student links to ATT-02 with "{n} ausencias de {total}" and a "{x}%" badge. Card "Tendencia Mensual" (line chart). Card "Detalle por Estudiante" with "Exportar CSV": columns "#", "Estudiante" (link → ATT-02), "Presentes", "Ausentes", "Justificados", "% Asistencia" (value + bar), "% Ausencia" (value + bar), "Estado" (badge "Crítico" / "Atención" / "Normal" / "Sin registros"). Empty: **"Sin registros de asistencia"** / "Aún no se ha tomado asistencia en {materia} - {curso}." + "Tomar Asistencia"; no students: "Sin estudiantes" / "No hay estudiantes activos en este grado."

### 6.4 ATT-04 `/asistencia/reporte?offeringId&from&to`

Header "Reporte de Asistencia" / "Asistencia por rango de fechas, lista para imprimir"; actions "Imprimir" (`window.print`), "CSV", back (→ ATT-03). Card "Rango del reporte" (hidden in print): "Desde" (max = Hasta) and "Hasta" (min = Desde). Printable block: title "Reporte de Asistencia", "{materia} - {curso} · {desde} a {hasta}", tiles "Total Registros", "Presentes", "Ausentes", "Justificados", card "Asistencia por día" (stacked bars per date, labels `dd/mm`), card "Detalle por Estudiante" (as ATT-03 columns without links) with footer row **"Totales"**. Print stylesheet: hides sidebar, header actions and filters, keeps A4 portrait with the table, avoids row splits. Empty: **"Sin registros"** / "No hay registros de asistencia en el periodo seleccionado."

## 7. Flows and audit

- **F6** Take attendance: DASH-04 "Asistencia" or the sidebar → ATT-01 (grade → subject → date) → mark exceptions → "Guardar Asistencia"; follow-ups ATT-03, ATT-02, ATT-04.
- **F9** Absence above 20% in the last 30 days later raises "Inasistencia Crítica" (module 12); **F10** perfect attendance feeds achievements (module 11); **F12/F15** guardians and students read ATT-02 through PAR-03 and the student sidebar.
- Audit: §4.2.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): `tally` (justificado + excusado merge), `absenceRate` (empty, all present, rounding at x.x5), `absenceBand` at 10.0 / 10.1 / 20.0 / 20.1, `monthlyTally` ordering and month rollover, `byStudent` with absent students and no-record students, `atRisk` ordering, `isSchoolDay` for each weekday and shift including `Sabatina` Saturdays, CSV builder (BOM, quotes, commas, accents, embedded newlines).
- **API integration** (Postgres): `save` creates then updates the same `(student, offering, date)` rows (idempotent re-save, `recorded_by` changes to the last editor, counts correct); date rules: Saturday/Sunday rejected, Saturday accepted for a `Sabatina` course, future date rejected, Bogotá midnight boundary (23:30 local Sunday is still Sunday; 00:10 Monday local is allowed even when UTC is Sunday), malformed date; student not in course, inactive student, duplicate student, 201 records, invalid status, 301-char observation; teacher scope (own offerings only; `inactivo` assignment loses access; `groupSummary`/`report` for another teacher's offering → `NOT_FOUND`); coordinator and admin record any offering; `studentSummary`/`history` scope matrix (teacher sees own-offering rows only and totals match the table; student self; parent linked / non-linked → `NOT_FOUND`); report range validation (inverted, 367 days); exports obey scope and filters and match the on-screen totals; two-tenant isolation; permission matrix per role (viewer none; student/parent only the portal reads); DB check rejects a Sunday insert; `attendance.saved` written once per save with counts.
- **Web**: ATT-01 live counters, "Todos Presentes", "Solo Ausentes", search, default "presente", weekend callout disabling save, "Registro existente", dirty guard on date change, save toast, dependent selects; ATT-02 banners at 10/20 thresholds and per-month breakdown; ATT-03 at-risk card visibility and "Sin registros" rows; ATT-04 range validation and print styles (class presence, hidden controls); stories for the new presentational components.

### 8.2 Acceptance

- ATT-01: a teacher records a class in one save; re-opening the date shows the saved statuses; a weekend or future date cannot be saved; another teacher's offering is unreachable.
- ATT-02: the student and the guardian see the full history of the student; a teacher sees only their own subject; banners and bands follow the thresholds; the table, tiles and CSV agree.
- ATT-03/04: totals equal the stored rows; the at-risk list contains exactly students above 20% absence; the report prints cleanly and exports the same figures.
- P5 exit criterion of foundation §8 (attendance upsert, matrix tests) holds on the demo seed.

## 9. Open questions and notes

### 9.1 New open questions

| ID       | Question                                          | Recommended default                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-ATT-1 | Back-dating window, holidays and Saturday classes | v1: no limit on past dates, no holiday calendar, Saturday only for `Sabatina` courses, future dates and Sundays rejected. Add an institution calendar and a teacher back-dating window (e.g. 30 days, management unrestricted) if schools ask. |

### 9.2 Gaps found in 00-foundation.md

- G-ATT-1 Inventory INS-12 says the group director "puede tomar asistencia y registrar observaciones", but foundation §4.3 / OD-21 gives directors only student visibility, not offerings. Attendance follows the foundation; if directors must record for subjects they do not teach, `ScopePolicy.offeringWhere()` needs a rule (module 08 faces the same question for observations). **Open decision OD-28 in 00-foundation §11 (this spec adopts the recommended default).**
- G-ATT-2 §6.9 lists no attendance audit action; `attendance.saved` (counts only) is added for symmetry with `grade.sheet_saved`. **Resolved in 00-foundation (§6.9 `attendance.saved`).**
- G-ATT-3 §5.2 `attendance_record` has no weekday constraint; this spec adds a DB check against Sundays and a service rule for Saturdays (ATT-R3), because `schedule_slot.day_of_week` only covers Monday–Friday (module 04 OQ-SCH-3). **Resolved in 00-foundation (§5.2 `attendance_record` Sunday check and Saturday rule).**
