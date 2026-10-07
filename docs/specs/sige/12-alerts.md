# Spec: SIGE — Early alerts (ALR)

- **Status:** Approved (product owner accepted every recommended default on 2026-10-07)
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query (web), Drizzle + Postgres, `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.2 `alert` grants, R1.28, §5.2 `alert`, §5.3 R2.10 and R2.15, §5.5 alert rules, §6.6 R3.18–R3.19, §6.9 audit, OD-7, OD-10), [`06-grades.md`](./06-grades.md) (`final_grade`, score display), [`07-attendance.md`](./07-attendance.md) (`absenceRate`), [`01-auth-and-dashboards.md`](./01-auth-and-dashboards.md) (sidebar badge, DASH-03, reference period DASH-R8), [`05-students.md`](./05-students.md) (STU-02 link), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/alerts/*`, `-components/alert-parts.tsx`, `-mock/alert-engine.ts` (`ALERT_RULES`, `runAllAlertRules`, `runAlertRule`), `-mock/engagement.ts` (`resolveAlert`). Inventory §3.13, §2.2, F9. Requirement ids: `ALR-R<n>`. Phase P7.

## 1. Objective and scope

Early alerts: a rule engine that detects academic risk, negative trends, critical absence, failing groups, dropout risk and notable improvement; a panel to review them, a detail page to resolve them with notes, and the engine runner. Alerts are staff-only (owner, admin, coordinator); students and guardians never read the `alert` table. The sidebar shows the number of active alerts as a badge.

### In scope

| Screen | Title                       | Roles   | Real route          |
| ------ | --------------------------- | ------- | ------------------- |
| ALR-01 | "Alertas Tempranas"         | R, A, C | `/alertas`          |
| ALR-02 | "Alerta #{id}" (detail)     | R, A, C | `/alertas/$alertId` |
| ALR-03 | "Ejecutar Motor de Alertas" | R, A, C | `/alertas/motor`    |

Also in scope: table `alert`; the pure rules in `packages/sige-core/src/alerts.ts`; the engine service; `alert.countActive` (sidebar badge) and `alert.summary` (ALR-01 KPIs/charts and DASH-03 "Alertas activas"); CSV export.

### Out of scope

- Notifying guardians or staff when an alert is raised (OD-11, R3.29); scheduling the engine (OD-10: manual, idempotent, so a nightly run can be added later).
- Editing or deleting alerts; reopening a resolved alert; assigning alerts to users.
- The "Alertas Activas" block of PAR-01, which lists recent observations of the child (modules 08/13), not rows of this table.

## 2. Data

Conventions R2.1–R2.6. Tenant-safe composite FKs to `student`, `offering`, `person`.

| Table   | Columns and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Indexes                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `alert` | `student_id`, `offering_id` null (set by `grupo_riesgo` and `riesgo_academico`), `alert_type` enum `alert_type` (`riesgo_academico`, `tendencia_negativa`, `inasistencia_critica`, `grupo_riesgo`, `riesgo_desercion`, `mejora_destacable`), `severity` enum `alert_severity` (`alta`, `media`, `baja`), `title` ≤ 200, `description` text, `triggered_at timestamptz`, `resolved bool default false`, `resolved_at` null, `resolved_by` null (→ `person`), `notes` text null ≤ 1000, `created_at`. `check (resolved = (resolved_at is not null))`, `check (not resolved or resolved_by is not null)`. **Partial unique `(organization_id, student_id, alert_type) where not resolved`** (foundation R2.15). | `(organization_id, resolved, triggered_at desc)`, `(organization_id, student_id)`, `(organization_id, alert_type)` |

Migration: two enums + table. The seed derives six active alerts through the engine and inserts four resolved ones directly (foundation R4.5).

## 3. Rules (`packages/sige-core/src/alerts.ts`)

Pure functions over plain inputs, with `asOf` (R3.18): the services load aggregates and call them. Constants live in `SIGE_RULES` (R2.17): `ALERT_WINDOW_DAYS = 30`, `ALERT_MIN_ROWS = 5`, `ALERT_DESERTION_ABSENCE = 15`.

### 3.1 Catalog (`ALERT_RULES`)

| `alert_type`           | Label                  | Short label    | Condition text (ALR-03, verbatim)                    | Severity |
| ---------------------- | ---------------------- | -------------- | ---------------------------------------------------- | -------- |
| `riesgo_academico`     | "Riesgo Académico"     | "Académico"    | "Promedio < 3.0 en cualquier materia"                | `alta`   |
| `tendencia_negativa`   | "Tendencia Negativa"   | "Tendencia"    | "Bajó más de 0.5 puntos entre periodos"              | `media`  |
| `inasistencia_critica` | "Inasistencia Crítica" | "Inasistencia" | "Más del 20% de inasistencias en el mes"             | `media`  |
| `grupo_riesgo`         | "Grupo en Riesgo"      | "Grupo"        | "Más del 30% del grupo pierde con el mismo profesor" | `alta`   |
| `riesgo_desercion`     | "Riesgo de Deserción"  | "Deserción"    | "Ausencias y notas bajas combinadas"                 | `alta`   |
| `mejora_destacable`    | "Mejora Destacable"    | "Mejora"       | "Subió más de 1.0 punto entre periodos"              | `baja`   |

Severity tones: `alta` destructive, `media` warning, `baja` success; labels "Alta", "Media", "Baja".

### 3.2 Evaluation

Reference periods follow module 01 DASH-R8: `current` = the latest **closed** period (not the active one) of the current academic year that has finals, `previous` = the closed period before it (by `order_num`); period-based rules yield nothing without `current` (and trend/improvement rules nothing without `previous`). The attendance window is `[asOf − 30 days, asOf]` on Bogotá dates. Only active students (R2.10). "Mean" is the half-up two-decimal mean of the student's finals in a period.

| Rule                   | Candidate when                                                                                                                                                 | Row produced (`student`, `offering`, title, description)                                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `riesgo_academico`     | some final in `current` is `< 3.00`; the lowest one (ties by subject name) is reported                                                                         | the student; that offering; "Riesgo Académico"; "El estudiante {nombre} tiene nota final de {x} en {materia} durante {periodo}. La nota está por debajo del mínimo (3.0)."                                                        |
| `tendencia_negativa`   | means exist in `previous` and `current` and `mean(previous) − mean(current) > 0.50`                                                                            | the student; none; "Tendencia Negativa"; "El promedio de {nombre} bajó de {a} a {b} entre {P_prev} y {P_curr}."                                                                                                                   |
| `inasistencia_critica` | at least 5 attendance rows in the window and `absenceRate > 20` (07: every non-`presente` status, OD-7)                                                        | the student; none; "Inasistencia Crítica"; "El estudiante {nombre} acumula {n}% de inasistencias en los últimos 30 días." (`n` rounded to an integer)                                                                             |
| `grupo_riesgo`         | an offering with at least 5 finals in `current` and failing share `> 30%` (exact ratio `failed × 100 > 30 × total`; the prototype rounded to an integer first) | the group's lowest-scoring student (ties by name); that offering; "Grupo en Riesgo: {curso} {materia}"; "El {n}% del grupo {curso} perdió {materia} en el {periodo} con {docente}." (`{docente}` = "el profesor" when unassigned) |
| `riesgo_desercion`     | at least 5 attendance rows in the window, `absenceRate > 15`, and `mean(current) < 3.00`                                                                       | the student; none; "Riesgo de Deserción"; "El estudiante {nombre} combina promedio bajo ({avg}) con {n}% de inasistencias en los últimos 30 días."                                                                                |
| `mejora_destacable`    | means exist in both periods and `mean(current) − mean(previous) > 1.00`                                                                                        | the student; none; "Mejora Destacable"; "{nombre} subió su promedio de {a} a {b} entre {P_prev} y {P_curr}."                                                                                                                      |

Numbers inside descriptions use the display rule of 06 (`4.0`, `3.75`) instead of the prototype's fixed one decimal, so a 2.96 never prints as "3.0" next to "por debajo del mínimo". `triggered_at` = `asOf`.

`planInserts(candidates, existingUnresolved)` removes candidates whose `(student, type)` already has an unresolved alert; the persistence layer inserts with `ON CONFLICT DO NOTHING` on the partial unique index, so the engine is idempotent and race-safe (R2.15, R3.18).

## 4. API

Router `routers/sige/alert.ts` (`alertRouter`), all `sigeProcedure.use(requirePermission(...))`. Alerts are tenant-wide (staff only, no row scope beyond the tenant). Other tenant → `NOT_FOUND` (R1.15). Errors per R3.5. Lists use the shared list contract (R3.8).

### 4.1 Procedures

| Procedure           | Permission         | Input                                                                                                                                                                                                                                                                          | Output                                                                                                    | Notes                                                                                                                     |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `alert.list`        | `alert:read`       | list input (`alert-list-config.ts`: sort `triggeredAt`, `student`, `type`, `severity`, `title`, `state`; filters `search` text (student name, title, type label), `alertType` select, `severity` select, `resolved` select `false` \| `true`; default sort `triggeredAt` desc) | `{ rows: AlertRow[], total }`                                                                             | ALR-01 table (R3.8)                                                                                                       |
| `alert.summary`     | `alert:read`       | –                                                                                                                                                                                                                                                                              | `{ active, resolved, total, activeHigh, byType: { type, active }[], bySeverity: { severity, active }[] }` | ALR-01 tiles and charts; **DASH-03 "Alertas activas"** (module 01) reads `bySeverity` and `active`; ignores table filters |
| `alert.countActive` | `alert:read`       | –                                                                                                                                                                                                                                                                              | `{ count: number }`                                                                                       | **sidebar badge** (R1.28); same definition of "active" as `summary.active`                                                |
| `alert.get`         | `alert:read`       | `{ id }`                                                                                                                                                                                                                                                                       | `AlertDetail`                                                                                             | ALR-02                                                                                                                    |
| `alert.resolve`     | `alert:resolve`    | `{ id, notes?: string \| null }`                                                                                                                                                                                                                                               | `AlertDetail`                                                                                             | ALR-R4                                                                                                                    |
| `alert.runEngine`   | `alert:run_engine` | `{ rule?: AlertType }` (omit = all six)                                                                                                                                                                                                                                        | `{ total: number, results: { type: AlertType, created: number, error?: string }[] }`                      | ALR-03; ALR-R5                                                                                                            |
| `alert.export`      | `alert:read`       | same filters as `list`, no paging                                                                                                                                                                                                                                              | `File` (`text/csv; charset=utf-8`, UTF-8 BOM, RFC 4180)                                                   | columns below                                                                                                             |

```ts
type AlertRow = {
  id: string;
  studentId: string;
  studentName: string;
  alertType: AlertType;
  severity: "alta" | "media" | "baja";
  title: string;
  triggeredAt: string;
  resolved: boolean;
};
type AlertDetail = AlertRow & {
  description: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  notes: string | null;
  student: { id: string; name: string; document: string | null; courseName: string | null };
  offering: { id: string; subjectName: string; courseName: string } | null;
  can: { resolve: boolean };
};
```

CSV columns (Spanish): "ID,Estudiante,Tipo,Severidad,Título,Descripción,Fecha,Estado,Resuelta el,Resuelta por,Notas". `id` is the first 8 characters of the UUID wherever a human-readable "#id" is shown (list "ID" column, "Alerta #{id}", CSV).

### 4.2 Audit

| Procedure         | Action             | Metadata                                                                                |
| ----------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `alert.resolve`   | `alert.resolved`   | `{ alertId, studentId, alertType, hasNotes: boolean }`                                  |
| `alert.runEngine` | `alert.engine_run` | `{ rule: AlertType \| "all", total, created: Record<AlertType, number> }` (counts only) |

Engine-created alerts are not audited one by one. Reads and exports are not audited.

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- ALR-R1 **Who.** `alert:read` opens the three screens; `alert:resolve` resolves; `alert:run_engine` runs the engine. All three belong to owner, admin and coordinator only (foundation §4.2); teachers, students, guardians and viewers have no access (the sidebar entry and badge are hidden without `alert:read`).
- ALR-R2 **Active.** An alert is **active** when it is unresolved and its student is `activo` (R2.10: the alerts of a retired or graduated student stop counting, the rows stay readable and resolvable). `summary.active`, `countActive`, the "Alertas Activas" tile, the charts and DASH-03 all use this definition; "Resueltas" counts resolved rows; "Total Histórico" counts every row (OQ-ALR-3).
- ALR-R3 **Engine idempotency.** The partial unique index keeps one unresolved alert per student and type; a rule never creates a duplicate and never updates an existing alert (its description keeps the figures of the day it fired). Once an alert is resolved, the next run may raise a new one if the condition still holds (prototype behaviour, OQ-ALR-2).
- ALR-R4 **Resolve.** Allowed on any unresolved alert (also those of retired students); `resolved = true`, `resolved_at = now`, `resolved_by = caller`, `notes` trimmed (empty → null, ≤ 1000: "Las notas no pueden superar 1000 caracteres."). Already resolved → `CONFLICT` **"La alerta ya fue resuelta."**. Empty notes are allowed after the client confirm **"No has agregado notas de resolución"** / "¿Deseas continuar de todas formas?" (the server does not require notes). Toast "Alerta marcada como resuelta" with sub-line "El contador del menú se actualizó.". There is no reopen.
- ALR-R5 **Run.** `runEngine` runs the requested rule, or all six, each rule in its own savepoint inside one request: a failing rule returns `{ created: 0, error: "Error al ejecutar la regla." }` for that rule and does not block the others (inventory ALR-03 "error: label + red message"). `created` counts inserted rows only. Toast: total `> 0` → **"Motor ejecutado: {n} alertas nuevas"**, else **"Motor ejecutado"** with sub-line "No se encontraron nuevas alertas (no se duplican las activas).". Confirm for the full run: **"Ejecutar el motor completo"** / "Se ejecutarán todas las reglas de alerta. ¿Deseas continuar?" (the prototype's wording; the inventory's "Esto puede tomar unos segundos" is dropped because the run is synchronous and short). Missing rule selection: the "Ejecutar Regla" button stays disabled.
- ALR-R6 **Badge.** The sidebar badge shows `countActive` capped at "99+", hidden at 0, refetched on window focus and invalidated after `resolve` and `runEngine` (R1.28); no push.
- ALR-R7 **Anchors.** `grupo_riesgo` is stored on the group's lowest-scoring student and the offering, so it competes for the single unresolved slot of that student and type; a second failing group with the same lowest student is skipped until the first is resolved (G-ALR-1). Positive alerts (`mejora_destacable`, severity `baja`) count as active like any other (OQ-ALR-4).
- ALR-R8 **Consumers.** DASH-03 reads `alert.summary`; the sidebar reads `alert.countActive`; the drill-down alert → STU-02 → OBS-04 and MET-07 is navigation only (F9).

## 6. Web

Feature folder `apps/web/src/features/alerts`; thin routes under `routes/_auth/_org/alertas/`. `SeverityBadge`, `AlertTypeBadge` (icon + label) and `AlertStatusBadge` ("Activa" / "Resuelta") live in the feature. Type icons: book, down-arrow chart, calendar-x, people, person-x, up-arrow chart; severity icons: triangle-exclamation filled (alta), circle-exclamation (media), check-circle (baja). Chart colours: one per type (`--chart-1…5`, `--success` for `mejora_destacable`), severity red/amber/green. Every screen has loading, error-with-retry, empty and permission states.

### 6.1 ALR-01 `/alertas`

Header "Alertas Tempranas" / "Detección automática de riesgo académico, inasistencia y deserción"; actions "Ejecutar Motor" (→ ALR-03, `alert:run_engine`) and "Exportar CSV". Tiles "Alertas Activas", "Resueltas", "Total Histórico", "Severidad Alta" (active `alta`). Charts "Alertas por Tipo" (bars, series "Alertas Activas", short labels) and "Alertas por Severidad" (doughnut: Alta, Media, Baja). Card "Listado de Alertas" with chip "{n} alertas", search "Buscar por estudiante o título", filters "Todos los tipos", "Todas las severidades", "Todas" (estado: "Activas", "Resueltas") and "Limpiar" when any is set. Columns "ID" (`#{id}`), "Estudiante", "Tipo" (badge), "Severidad" (badge), "Título" (truncated at 50, tooltip full), "Fecha" (`dd/mm/yyyy HH:MM`), "Estado" (badge), action eye "Ver detalle de la alerta #{id}" (→ ALR-02). Empty: **"No hay alertas"** / "No se encontraron alertas con los filtros aplicados."

### 6.2 ALR-02 `/alertas/$alertId`

Header "Alerta #{id}" with severity, type and status badges; back "Volver al listado". Main card: title and description. Card "Información": "Fecha Detección", "Tipo", "Severidad" and, when `offering` is present, "Asignatura" ("{materia} - {curso}", additive). If resolved, card "Resolución": "Fecha Resolución", "Resuelto Por" ("Desconocido" when null), "Notas". Side card "Estudiante": name (link → STU-02), document or "Sin documento", "Grado: {curso o 'Sin grado'}". If active and `can.resolve`: card "Resolver Alerta" with textarea "Notas de Resolución" (4 rows, placeholder "Describe las acciones tomadas para resolver esta alerta...") and button "Marcar como Resuelta" (with the confirm of ALR-R4 when notes are empty). Unknown id: `NotFoundBlock` "Alerta no encontrada".

### 6.3 ALR-03 `/alertas/motor`

Header "Ejecutar Motor de Alertas" / "Evalúa las reglas sobre las notas y la asistencia actuales"; back "Volver al listado". Card "Reglas del Motor de Alertas": columns "Alerta", "Condición", "Severidad" with the six rows of §3.1. Card "Ejecutar Todas las Reglas": "Ejecuta las 6 reglas de alerta simultáneamente." and button "Ejecutar Motor Completo". Card "Ejecutar Regla Individual": select "Seleccionar Regla" ("-- Selecciona una regla --" + six labels) and "Ejecutar Regla". After a run, card "Resultados de la Ejecución" (action "Ver Alertas Generadas" → ALR-01): one row per rule with label and badge "{n} alertas" (success when `> 0`), or the error message in red.

## 7. Flows and audit

- **F9** Early alerts lifecycle: ALR-01 → "Ejecutar Motor" → ALR-03 (all rules or one) → new alerts → ALR-01 filters → ALR-02 → "Notas de Resolución" → "Marcar como Resuelta" → badge decreases; drill-down to STU-02, OBS-04 or MET-07.
- Dashboards: DASH-03 "Alertas activas"; sidebar badge.
- Audit: §4.2.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): each rule at its boundaries (final 2.99/3.00; drop 0.50/0.51; absence 20.0/20.1 with 4 vs 5 rows; group failing 30.0%/30.1% with 4 vs 5 finals; desertion absence 15.0/15.1 and mean 2.99/3.00; rise 1.00/1.01); lowest-score and tie selection; reference-period selection (no closed period, one closed period, active period ignored); description text and number display (2.96 → "2.96"); `planInserts` dedupe; window edges at `asOf − 30 days`; severity map; determinism for a fixed `asOf`.
- **API integration** (Postgres): `runEngine` on a seeded fixture produces the expected alerts and **a second run creates none**; one rule failing (forced) does not block the others and reports its error; two concurrent runs insert each (student, type) once; resolving then re-running re-raises only conditions that still hold; `resolve` sets the three fields, rejects a second resolve (`CONFLICT`), keeps notes ≤ 1000, writes one audit event; retired student's alerts leave `countActive`/`summary.active` but stay in `list`; `list` filters, sort and pagination; `summary` totals equal row counts and ignore table filters; `countActive` equals `summary.active`; `export` matches the filtered table; permission matrix (coordinator/admin/owner all, teacher/student/parent/viewer `FORBIDDEN`); two-tenant isolation; no `organizationId` in schemas; seed storylines (six active alerts, four historical resolved).
- **Web**: ALR-01 tiles/charts/filters/empty copy, badge cap "99+" and hidden at 0, refetch after resolve and run; ALR-02 resolve with and without notes (confirm), resolved view, offering row; ALR-03 rule table, disabled single-rule button, results card with an error row; stories for `SeverityBadge`, `AlertTypeBadge`, `AlertStatusBadge`.

### 8.2 Acceptance

- ALR-03: running the full engine on the demo seed yields the six storyline alerts and a second run reports "0 alertas" per rule.
- ALR-01/02: filters narrow the list; resolving an alert moves it to "Resueltas", lowers the badge and DASH-03 chart, and records who resolved it and when.
- Only owner, admin and coordinator can see or call anything of this module.
- P7 exit criterion of foundation §8 (engine reproduces the six active alerts, idempotent) holds.

## 9. Open questions and notes

### 9.1 New open questions

| ID       | Question                                                                              | Recommended default                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-ALR-1 | Should a second failing group of the same lowest student be tracked as its own alert? | Not in v1 (foundation unique index). If needed, widen the partial unique index to `(student_id, alert_type, coalesce(offering_id, ''))` for `grupo_riesgo` only.                      |
| OQ-ALR-2 | A resolved alert whose condition persists reappears on the next run                   | Accept (prototype): resolution means "attended", not "snoozed". A snooze (suppress for N days) can be added with a column without changing the engine contract.                       |
| OQ-ALR-3 | Alerts of students who are no longer `activo`                                         | Excluded from "active" counters and the badge, kept in the list and resolvable (ALR-R2). Alternative: auto-resolve on status change (module 05 would call `alert.resolveForStudent`). |
| OQ-ALR-4 | Does a positive alert ("Mejora Destacable") belong in the active count and the badge? | Yes (prototype and inventory count every unresolved alert); the severity tone (`baja`, green) distinguishes it. A "needs action" counter can be derived later.                        |

### 9.2 Gaps found in 00-foundation.md

- G-ALR-1 §5.2's partial unique `(student_id, alert_type)` cannot hold two simultaneous `grupo_riesgo` alerts anchored on the same student (ALR-R7, OQ-ALR-1). **Resolved in 00-foundation (§5.2 `alert` constraint note and §5.3 R2.15); OQ-ALR-1 stays open.**
- G-ALR-2 §5.5 states the six rules in one line each; this spec adds what the prototype engine implements and the table omits: closed periods only (`current`/`previous`), minimum five rows/finals for attendance and group rules, and the desertion thresholds (`absenceRate > 15` and period mean `< 3.0`). These constants should be added to the §5.5 table. **Resolved in 00-foundation (§5.5 alert constants).**
- G-ALR-3 §5.5 "absence `> 20%` in last 30 days" leaves the minimum sample open; five rows (prototype) avoid raising an alert from one absence in the first week. **Resolved in 00-foundation (§5.5 `MIN_SAMPLE_ROWS`).**
- G-ALR-4 `alert` has no human-readable number; the UI uses the first 8 characters of the UUID as "#id" (a per-tenant sequence is a possible later addition). **Noted in 00-foundation: the UI keeps the first 8 characters of the UUID; a sequence is a later addition.**
