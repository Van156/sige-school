# Spec: SIGE — Parent portal (PAR)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query (web), Drizzle + Postgres, `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.2 `portal` grants, §4.3 scope, R1.14–R1.16, §12 #1 and #4, R2.16, R3.13), [`05-students.md`](./05-students.md) (`student_guardian`, `StudentSwitcher`, `StudentStrip`, `NoStudentBlock`), [`06-grades.md`](./06-grades.md) (`grade.studentGrades`, `GradeScaleLegend`), [`07-attendance.md`](./07-attendance.md) (`attendance.history`, `tally`, ATT-R8), [`08-observations.md`](./08-observations.md) (`observation.studentHistory`, `ObservationCard`), [`09-report-cards.md`](./09-report-cards.md) (`reportCard.studentHistory`, `reportCard.get`, `reportCard.pdf`), [`11-achievements.md`](./11-achievements.md) (`achievement.studentAchievements`, `AchievementCard`), [`01-auth-and-dashboards.md`](./01-auth-and-dashboards.md) (DASH-06, sidebar).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/parent/*`, `-components/parent-frame.tsx`, `-lib/calendar.ts` (`dayStatus`, `calendarCells`, `shiftMonth`), `-lib/use-student-scope.ts`. Inventory §3.14, F12. Requirement ids: `PAR-R<n>`. Phase P8.

## 1. Objective and scope

A read-only portal for guardians (`parent` role): one card per linked child with average, recent attendance, flagged observations and latest grades, plus five child pages (grades, attendance, observations, report cards, achievements) behind a tab strip. The portal adds **no parallel copies** of staff endpoints (R1.16): the child pages call the same procedures as the staff and student screens, authorized by `portal:read_child` and filtered by `ScopePolicy` to the linked children; the only new procedures are the two composite reads PAR-01 and PAR-03 need.

### In scope

| Screen | Title                      | Roles | Real route                                  |
| ------ | -------------------------- | ----- | ------------------------------------------- |
| PAR-01 | "Portal de Acudientes"     | P     | `/portal-padres`                            |
| PAR-02 | "Notas del hijo/a"         | P     | `/portal-padres/notas?student=`             |
| PAR-03 | "Asistencia del hijo/a"    | P     | `/portal-padres/asistencia?student=&month=` |
| PAR-04 | "Observaciones del hijo/a" | P     | `/portal-padres/observaciones?student=`     |
| PAR-05 | "Boletines del hijo/a"     | P     | `/portal-padres/boletines?student=`         |
| PAR-06 | "Logros del hijo/a"        | P     | `/portal-padres/logros?student=`            |

Also in scope: `parentPortal.overview` and `parentPortal.attendanceCalendar`, the `ParentChildPage` frame (tab strip, child switcher, section heading) and the reconciliation of DASH-06 with PAR-01 (foundation §12 #1).

### Out of scope

- Any write: guardians cannot edit grades, observations, attendance or contact data; no messaging, appointments or document upload.
- Guardians of children in several institutions (OD-22: one account per institution).
- A guardian's own profile (AUTH-04) and password change (module 01).

## 2. Data

No new tables or migrations. Reads join `student_guardian` (`guardian_person_id`, `student_id`, `relationship`; module 05) with the data of modules 06–11. Performance relies on `student_guardian(organization_id, guardian_person_id)` (module 05) and the indexes of the consumed modules.

## 3. Rules (`packages/sige-core/src/portal.ts`)

| Function                   | Definition                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initials(first, last)`    | first letters of first and last name, uppercase; `"?"` when unknown (PAR-01 avatar).                                                                                                     |
| `dayStatus(rows)`          | one status per calendar day over all offerings: any `ausente` → `ausente`; else any `justificado`/`excusado` → `justificado`; else `presente`; no rows → none (prototype `calendar.ts`). |
| `calendarCells(month)`     | leading blanks so the first of the month falls on its Monday-first weekday, then one cell per day (`YYYY-MM-DD`).                                                                        |
| `shiftMonth(month, delta)` | month arithmetic with year rollover.                                                                                                                                                     |
| `attendanceShare(rows)`    | `present / total × 100`, one decimal half-up; `null` for no rows (ATT-R8: "no records" is unknown, not 100%).                                                                            |

Tallies come from `sige-core` `tally` (07): `absent` = `ausente` only; `justified` = `justificado` + `excusado`.

## 4. API

Router `routers/sige/parent-portal.ts` (`parentPortalRouter`), `sigeProcedure.use(requirePermission({ portal: ["read_child"] }))`. A student id outside the caller's linked children → `NOT_FOUND` (R1.15). Errors per R3.5. The child pages call, with the same permission semantics:

| Screen | Data                               | Procedure (module)                                                   |
| ------ | ---------------------------------- | -------------------------------------------------------------------- |
| PAR-01 | child cards                        | `parentPortal.overview` (this module)                                |
| PAR-02 | grades per period, levels, KPIs    | `grade.studentGrades` (06)                                           |
| PAR-03 | month calendar, month/year tallies | `parentPortal.attendanceCalendar` (this module)                      |
| PAR-03 | detailed history table             | `attendance.history` with `date` dateRange = the month (07)          |
| PAR-04 | observations, counters             | `observation.studentHistory` (08)                                    |
| PAR-05 | cards, comments, PDF               | `reportCard.studentHistory`, `reportCard.get`, `reportCard.pdf` (09) |
| PAR-06 | earned + catalog                   | `achievement.studentAchievements` (11)                               |
| frame  | child switcher                     | `student.pick` (05; parent mode returns the linked children)         |

### 4.1 Procedures

| Procedure                         | Permission          | Input                                                                        | Output                                                                                                                                            | Notes                                                                                  |
| --------------------------------- | ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `parentPortal.overview`           | `portal:read_child` | –                                                                            | `{ children: PortalChild[] }` (ordered by last name, first name, locale `es`)                                                                     | PAR-01; empty array when nothing is linked                                             |
| `parentPortal.attendanceCalendar` | `portal:read_child` | `{ studentId, month?: string }` (`YYYY-MM`, default current month in Bogotá) | `{ month, days: { date, status: "presente" \| "ausente" \| "justificado" }[], monthTotals: Tally, yearTotals: Tally, yearMonthly: MonthTally[] }` | PAR-03; invalid month → `BAD_REQUEST` "Mes inválido."; `Tally`/`MonthTally` as 07 §4.1 |

```ts
type PortalChild = {
  studentId: string;
  name: string;
  initials: string;
  status: "activo" | "retirado" | "graduado";
  relationship: string;
  courseName: string | null;
  campusName: string;
  average: number | null; // mean of the child's finals of the current academic year, 2 decimals
  attendance30: number | null; // present share, last 30 days, all offerings; null without rows
  flagged: { id: string; type: "negativa" | "convivencia"; description: string }[]; // up to 3
  latestPeriod: { id: string; name: string } | null;
  latestGrades: {
    offeringId: string;
    subjectName: string;
    final: number | null;
    status: "ganada" | "perdida" | "no evaluado";
  }[];
};
```

`attendanceCalendar` covers **all offerings** of the child (a day is "ausente" if any class was missed, PAR-R4); the year totals and `yearMonthly` span the calendar year of `month`. It exists because 07 exposes no per-day, offering-agnostic read and the parent view must not page through the history table to draw a month (G-PAR-1).

### 4.2 Audit

None: reads are not audited (R3.26).

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- PAR-R1 **Who and what.** Only built-in role `parent` holds `portal:read_child`. A guardian sees exactly the children linked in `student_guardian` (any `status`, including `retirado` and `graduado`, shown with a status badge) and nothing else: a `studentId` that is not linked, belongs to another tenant, or does not exist yields `NOT_FOUND` in every procedure of §4 (identical responses, no existence leak). Staff and students cannot call `parentPortal.*` (`FORBIDDEN`). Impersonating the rector therefore shows an empty portal.
- PAR-R2 **PAR-01 card.** `average` = mean of the child's finals in the **current academic year**, shown with one decimal ("N/A" when null); `attendance30` over `[today − 30 days, today]` Bogotá, shown as an integer percent, "-" when null (the prototype printed 100%); `flagged` = the child's latest three observations that require notification (`negativa`/`convivencia`), regardless of date or notified state, listed under the block title **"Alertas Activas"** with the type label and the first 60 characters of the description (verbatim prototype copy; unrelated to `alert` rows, which guardians never read, OQ-PAR-2); `latestPeriod` = the latest period in which the child has at least one final; `latestGrades` = every offering of the child's course with its final in that period (null → badge "No evaluado"). Subject grade badge and status badge ("Aprobado" green, "Reprobado" red, "No evaluado") use the 06 bands.
- PAR-R3 **PAR-02 table.** Columns are the periods returned by `grade.studentGrades` (periods with at least one final; guardians hold no `period:read`, so empty future periods are not shown, G-PAR-2); one row per offering; each cell shows the final (06 display rule, colour by band `≥ 4.0`, `≥ 3.0`, below) and a trend arrow versus the previous column when both exist (up "Sube", down "Baja", equal "Igual"); "Estado" = the last known final: "Aprobado" (`≥ 3.0`), "Reprobado", or "Sin notas". The KPI "Promedio General" is `kpis.average` with badge "Aprobado" / "Reprobado" / "Sin notas". Levels and statuses use the contiguous bands (foundation §12 #8).
- PAR-R4 **PAR-03 calendar.** Month navigator "Anterior" / "{Mes} {año}" (capitalised, `Intl` `es-CO`) / "Siguiente" (disabled beyond the current Bogotá month); the month and year panels show counters "Presentes", "Ausentes", "Justificados" and "% Asistencia" (year: "% Asistencia Anual"), computed with `tally`/`attendanceShare`; the calendar colours a day by `dayStatus` (green Presente, red Ausente, amber Justificado) and leaves days without rows uncoloured; Saturdays and Sundays appear as ordinary cells. Charts "Distribución del Mes" (donut) and "Asistencia Mensual - {año}" (grouped bars Presentes/Ausentes/Justificados). The history table is `attendance.history` filtered to the month.
- PAR-R5 **PAR-04.** Counters "Total", "Positivas", "Negativas" and **"Seguimiento" = `seguimiento + convivencia`** (prototype tile), while the filter chips are one per type ("Todas", "Positivas", "Negativas", "Seguimiento", "Convivencia"), applied client-side to the timeline. Cards show the type colour bar, type label, category badge, "Notificada"/"Pendiente" (only for types that need notification), date `dd/mm/yyyy HH:MM`, description, "**Compromisos:**" when present and "Por: {autor}". Guardian contact data is not repeated here.
- PAR-R6 **PAR-05.** One card per generated report card of the child, ordered by period `order_num`, **whatever its delivery state** (OQ-PAR-1): period name, date range, badge "Entregado"/"Pendiente", "Generado: dd/mm/yyyy · Entregado: dd/mm/yyyy" ("N/A" when not delivered), "Observación General" and the table "Observaciones por Materia" read from the snapshot (`reportCard.get`, up to four cards in parallel). "Descargar PDF" calls `reportCard.pdf` with `download`; "Ver Boletín" opens RPT-04 (additive); "Ver Notas" → PAR-02.
- PAR-R7 **PAR-06.** "{n} logros obtenidos" and the earned grid with "Obtenido el dd/mm/yyyy"; card "Catálogo Completo de Logros" lists every active achievement, earned ones highlighted with a check, unearned ones dimmed. Guardians do not see the ranking of other children (ACH-03 masking applies if they open it).
- PAR-R8 **Frame.** Every child page shows the tab strip "Portal" › "Notas" · "Asistencia" · "Observaciones" · "Boletines" · "Logros" (current tab highlighted and inert), the child switcher "Hijo/a:" (`StudentSwitcher` parent mode, buttons per child), the heading "{Sección} de {nombre}" and the sub-line "{curso o 'Sin grado'} - Sede: {sede}". The selected child lives in `?student=`; without it the first child is selected; an invalid or non-linked id renders `NotFoundBlock` "Estudiante no encontrado" with "Volver al portal". A guardian with no children sees `NoStudentBlock`.
- PAR-R9 **DASH-06 reconciliation** (foundation §12 #1). `/dashboard` for a guardian renders DASH-06 (module 01: child cards with name, relationship, course badge, "Grado", "Documento", "Ver Notas" → PAR-02, and "Ir al portal completo" → PAR-01); the sidebar "Portal Padres" opens PAR-01. Both read the same linked children; DASH-06 stays minimal and uses `dashboard.parent` (OQ-PAR-3).
- PAR-R10 **Privacy.** Responses never contain other students, staff contact data, `alert` rows or internal ids beyond those needed for links; guardian-facing text (observations, comments) is exactly what staff wrote, with the author's name.

## 6. Web

Feature folder `apps/web/src/features/parent-portal`; thin routes under `routes/_auth/_org/portal-padres/`. The frame `ParentChildPage` (props: `screenId`, `title`, `section`, children render prop) wraps ScopedPage-style header, tab strip and switcher; page bodies reuse feature components exported by modules 06–11 (`GradeScaleLegend`, `ObservationCard`, `AchievementCard`, `ScoreBadge`, charts). Mobile-first: guardians use phones, so cards stack and tables scroll horizontally. Every screen has loading, error-with-retry, empty and permission states; description line "Seguimiento académico de tus hijos", back "Volver al portal" on child pages.

### 6.1 PAR-01 `/portal-padres`

Header "Portal de Acudientes" / "Seguimiento académico de tus hijos". One card per child (grid, two columns on wide screens): avatar with initials, name, "{curso o 'Sin grado'} · {sede}" (status badge when not `activo`); two stat boxes "Promedio General" and "Asistencia (30 días)"; the "Alertas Activas" block when `flagged` is non-empty (badge with type, 60-character description + "..."); buttons "Ver Notas" (PAR-02), "Asistencia" (PAR-03), "Observaciones" (PAR-04), "Boletines" (PAR-05), "Logros" (PAR-06), each with `?student=`; mini table "Últimas Notas - {periodo}" ("Materia", "Nota", "Estado"; empty "No hay notas registradas aún."). Empty: **"No hay estudiantes asignados"** / "Contacta al administrador para vincular a tus hijos."

### 6.2 PAR-02 `/portal-padres/notas`

Heading "Notas de {nombre}". Tile "Promedio General" (hint "Aprobado"/"Reprobado"/"Sin notas", destructive tone below 3.0) and a button "Detalle por criterio" (→ GRD-08 for the child). `GradeScaleLegend` ("Escala de Calificación": "4.6–5.0 Superior", "4.0–4.5 Alto", "3.0–3.9 Básico", "1.0–2.9 Bajo"). Card "Calificaciones por Periodo" per PAR-R3. Empty: **"No hay notas registradas"** / "Las notas aparecerán cuando los profesores las registren."

### 6.3 PAR-03 `/portal-padres/asistencia?month=`

Heading "Asistencia de {nombre}". Navigator, cards "Estadísticas del Mes" and "Estadísticas del Año ({año})" (four counters and a progress bar each), card "Calendario - {Mes} {año}" with weekday headers "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom", day cells with tooltip "{d}/{m}: {estado o 'Sin registro'}" and legend "Presente / Ausente / Justificado"; charts of PAR-R4; card "Historial Detallado" ("Fecha", "Estado" badge Presente/Ausente/Justificado/Excusado, "Observación" or "-"; 10 rows per page; action "Ver historial completo" → ATT-02). Empty table: "No hay registros de asistencia".

### 6.4 PAR-04 `/portal-padres/observaciones`

Heading "Observaciones de {nombre}". Tiles, chips ("Filtrar:" label) and cards of PAR-R5. Empty: **"No hay observaciones registradas"** / "Las observaciones aparecerán cuando los profesores las registren."

### 6.5 PAR-05 `/portal-padres/boletines`

Heading "Boletines de {nombre}" with the sub-line of PAR-R8. Cards of PAR-R6. Empty: **"No hay boletines generados"** / "Los boletines aparecerán cuando sean generados por el sistema."

### 6.6 PAR-06 `/portal-padres/logros`

Heading "Logros Obtenidos" (child name in the strip) with "Volver al Dashboard" semantics served by "Volver al portal", chip "{n} logros obtenidos", grid and catalog of PAR-R7. Empty: **"Aún no hay logros obtenidos"** / "Este estudiante aún no ha desbloqueado ningún logro."

## 7. Flows and audit

- **F12** Parent journey: sign-in → (F1 forced change) → DASH-06 or PAR-01 → tab strip PAR-02…06 per child; everything is read-only and limited to linked children; any other id → not found.
- Audit: none.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): `dayStatus` (absent wins, justified wins over present, empty → none), `calendarCells` (months starting on each weekday, February in a leap year), `shiftMonth` rollover both ways, `initials`, `attendanceShare` (empty → null, 2/3 → 66.7).
- **API integration** (Postgres): a guardian with two children sees both and no other student in `overview`; `overview` figures equal hand-computed values (average over the year, 30-day window edges, up to three flagged observations in date order, latest period and lines); a non-linked `studentId`, another tenant's id and a random UUID return identical `NOT_FOUND` for **every** procedure of the §4 table; a student, teacher, coordinator and viewer calling `parentPortal.*` get `FORBIDDEN`; `attendanceCalendar` (day status across several offerings, month and year totals, `Sáb` and `Dom` days, invalid month, month without rows); retired child still listed with its status; two-guardian child visible to both; guardian unlinked mid-session loses access on the next request; two-tenant isolation; permission matrix per role; no `organizationId` in schemas.
- **Web**: frame tab strip and child switcher (preserves `?student=`, defaults to the first child, not-found state), each page's empty copy, PAR-02 trend arrows and status column, PAR-03 navigator limits, calendar colours and legend, PAR-04 tile vs chip semantics, PAR-05 download and parallel loads, PAR-06 dimmed catalog; mobile viewport layout without horizontal page scroll; stories for the frame, the child card and the calendar.

### 8.2 Acceptance

- PAR-01…06: a parent sees exactly the linked children and every number equals the staff-side view of the same child; nothing outside the links is reachable (tests with a non-linked student id → `NOT_FOUND`, P8 exit criterion of foundation §8).
- No screen of the portal reads mock data; all seven dashboards show live data (P8).
- DASH-06 and PAR-01 agree on the list of children.

## 9. Open questions and notes

### 9.1 New open questions

| ID       | Question                                                                                                                | Recommended default                                                                                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-PAR-1 | Should guardians see report cards that are generated but still "Pendiente" (not yet handed over)?                       | Yes, as in the prototype (PAR-05 lists every card). If schools want a release gate, filter on `delivery_status = 'entregado'` in `reportCard.studentHistory` for portal callers. |
| OQ-PAR-2 | The block "Alertas Activas" in PAR-01 lists the latest observations that need notification, whatever their age or state | Keep the prototype behaviour and label; if it proves noisy, restrict to the current period or to un-notified ones, and consider renaming it to avoid confusion with module 12.   |
| OQ-PAR-3 | DASH-06 duplicates PAR-01 (foundation §12 #1)                                                                           | Keep both (DASH-06 is the post-login landing, PAR-01 the full portal). Alternative: redirect a guardian's `/dashboard` to `/portal-padres` and drop DASH-06.                     |

### 9.2 Gaps found in 00-foundation.md and 07

- G-PAR-1 `07-attendance.md` has no per-day, offering-agnostic read for a child (its `studentSummary`/`history` are per row or per month tally); PAR-03's calendar needs one. This spec adds `parentPortal.attendanceCalendar`; the cleaner home is an `attendance.calendar` procedure in module 07 (same permission semantics), after which this procedure can be dropped.
- G-PAR-2 Guardians and students hold no `period:read`, so a child page cannot list periods that have no finals; PAR-02 shows only periods that already have grades (the prototype showed empty "P3"/"P4" columns).
- G-PAR-3 R1.16 forbids parallel parent endpoints; the two composite reads of §4.1 are the deliberate exception because they aggregate several procedures (PAR-01) or reshape a month for drawing (PAR-03).
- G-PAR-4 Foundation §7 lists PAR-01…06 as `P` only, while the child pages also call procedures permitted to staff and students; permission names (`portal:read_child`) are consistent with §4.2 and need no change.
