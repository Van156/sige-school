# Spec: SIGE — Metrics (MET)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query (web), Drizzle + Postgres (SQL aggregates), `exceljs` (`.xlsx` export), `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.2 `metric` grants, R1.17, §5.4 grading rules, §5.5 constants, R2.10, R2.17, R3.14, R3.22, OD-7, OD-9), [`06-grades.md`](./06-grades.md) (`final_grade`, `performanceLevel`, rounding), [`07-attendance.md`](./07-attendance.md) (absence rules), [`04-scheduling.md`](./04-scheduling.md) (`offering`), [`02-institution.md`](./02-institution.md) (courses, campuses, periods), [`03-users.md`](./03-users.md) (xlsx helper), [`01-auth-and-dashboards.md`](./01-auth-and-dashboards.md) (DASH-04 consumer, reference period DASH-R8), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/metrics/*`, `-lib/{metrics,use-metrics,use-teacher-scope}.ts`, `-components/metric-parts.tsx`, `-mock/helpers.ts` (`teacherGroupState`). Inventory §3.11, §2.4, F13. Requirement ids: `MET-R<n>`. Phase P7.

## 1. Objective and scope

Read-only analytics over final grades and attendance: institutional KPIs and Excel export, failure heatmap by course and subject, period trends, an anonymous teacher comparison, per-teacher analytics with suggested action plans, attendance-versus-grades correlation and the at-risk student list. The module owns the derived-metric rules of foundation §5.5 in `packages/sige-core` and exposes the two teacher reads the teacher dashboard (DASH-04) needs. It adds no tables.

### In scope

| Screen | Title                             | Roles            | Real route                                  |
| ------ | --------------------------------- | ---------------- | ------------------------------------------- |
| MET-01 | "Métricas Institucionales"        | R, A, C          | `/metricas`                                 |
| MET-02 | "Mapa de Calor de Rendimiento"    | R, A, C          | `/metricas/mapa-calor`                      |
| MET-03 | "Tendencias Académicas"           | R, A, C          | `/metricas/tendencias`                      |
| MET-04 | "Comparativa Anónima de Docentes" | R, A, C          | `/metricas/comparativa-docentes`            |
| MET-05 | "Métricas del Docente"            | R, A, C; T (own) | `/metricas/docente?teacher=`                |
| MET-06 | "Asistencia vs Rendimiento"       | R, A, C; T (own) | `/metricas/asistencia-rendimiento?teacher=` |
| MET-07 | "Estudiantes en Riesgo"           | R, A, C; T (own) | `/metricas/estudiantes-riesgo?threshold=`   |

Also in scope: `metric.teacherClassStats` and `metric.teacherSuggestions` (module 01, DASH-04), the Excel export of MET-01 and the client-side CSV of MET-02…04.

### Out of scope

- Configurable thresholds per institution (OD-9) and a year selector (OQ-MET-1): every read takes an optional `academicYear`, default `institution_profile.current_academic_year`, and the web does not offer a selector.
- Predictive models, comparisons across institutions, student-level drill-downs beyond the existing links (STU-02), scheduled reports.
- The dashboard widgets of module 01 (`dashboard.groupAverages`, `levelDistribution`, `approvalByGroup`), which use the reference period and live in module 01.

## 2. Data

No new tables. Every query starts from the same base set, scoped to the tenant and the year:

`final_grade` ⨝ `academic_period` (`academic_year = :year`) ⨝ `student` (`status = 'activo'`, R2.10) ⨝ `offering` ⨝ `course`/`subject`, with `attendance_record` joined through `offering → course.academic_year = :year`. Teacher reads add `offering.teacher_person_id = :teacherId` (the person, whatever the assignment status: a teacher whose assignment became `inactivo` loses access to the screens through `ScopePolicy` but historical figures of past finals stay computable by management). All finals of the year are included, also those of the still-active period (prototype `metrics.finals`).

Indexes already provided by modules 06/07 suffice (`final_grade(organization_id, offering_id, period_id)`, `final_grade(organization_id, student_id)`, `attendance_record(organization_id, offering_id, date)`). Aggregates use Postgres `numeric` (exact decimal): `round(avg(final_score), 2)` is half-up for positive values and matches the `sige-core` integer arithmetic (foundation §5.4 "SQL aggregates round the same way"); never `float`. Target: MET-01 ≤ 1 s on the seed and ≤ 3 s at 10× (foundation §8 P7, to verify); if exceeded, add a covering index before any cache.

## 3. Rules (`packages/sige-core/src/metrics.ts`)

Pure functions on plain rows, shared by API, seed tests and (for live labels) the web. Constants from `SIGE_RULES` (R2.17).

| Function / constant                | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mean(cents[])`                    | mean of integer hundredths, rounded half-up to hundredths; `null` for an empty list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `passRate(finals)`                 | `% of finals ≥ 3.00`, one decimal half-up; `0` for no finals (prototype); failing rate = 100 − pass rate computed from counts, **2 decimals** (so 30.00 vs 30.01 is testable, module 01 §7.1).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `studentSummary(finals)`           | per student over the given finals: `average = mean(...)` (rounded) and `failedSubjects` = number of offerings whose rounded mean final over the periods is `< 3.00`. **At risk** = `average < threshold` (rounded value vs threshold, default 3.0); state "Crítico" `< 2.0`, else "Alerta" (§5.5). Students without finals are not ranked.                                                                                                                                                                                                                                                                                                         |
| `heatBand(rate)`                   | on the integer-rounded failure rate: `≤ 10` Excelente, `≤ 20` Bueno, `≤ 30` Atención, `≤ 40` Riesgo, `> 40` Crítico; labels "0-10% (Excelente)", "10-20% (Bueno)", "20-30% (Atención)", "30-40% (Riesgo)", "Más de 40% (Crítico)", "Sin datos".                                                                                                                                                                                                                                                                                                                                                                                                    |
| `periodState(avg)`                 | `≥ 3.5` "Aceptable" (success), `≥ 3.0` "Regular" (warning), else "Deficiente" (destructive).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `trendDirection(periodAverages)`   | fewer than 2 periods → `estabilidad`; `middle = floor(n/2)`; `first = mean(first middle)`, `second = mean(rest)` (an odd middle period counts in the second half); `round(second − first, 2)` `> 0` `mejora`, `< 0` `deterioro`, `0` `estabilidad`.                                                                                                                                                                                                                                                                                                                                                                                                |
| `teacherGroupState(avg, failing)`  | `failing > 30` → `risk` "Riesgo Alto"; else `avg < 3.5` → `attention` "Atención Necesaria"; else `optimal` "Óptimo".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `anonymise(teacherRows)`           | order by `average` desc, then `passRate` desc, then person id; letters `A…Z`, then `AA, AB…` (the prototype wrapped at 26); `percentile = n = 1 ? 100 : round((n − 1 − index) / (n − 1) × 100)`; badge success `≥ 75`, warning `≥ 40`, else destructive.                                                                                                                                                                                                                                                                                                                                                                                           |
| `scoreBins(finals)`                | seven bins on rounded finals (upper bound exclusive): "Excelente (4.5-5.0)" `≥ 4.5`, "Muy Bien (4.0-4.4)", "Bien (3.5-3.9)", "Aceptable (3.0-3.4)", "Deficiente (2.5-2.9)", "Bajo (2.0-2.4)", "Muy Bajo (1.0-1.9)"; colours success, success, warning, warning, destructive ×3.                                                                                                                                                                                                                                                                                                                                                                    |
| `actionPlans(classRows, peers)`    | per class (offering) with an average, **at most one** plan, first match: pass rate `< 60` → "Reforzar temas básicos de {materia}. Se observa una tasa de aprobación crítica ({x}%)."; else average `< peersAverage − 0.5` (mean of the same subject taught by other teachers in the year) → "El rendimiento en {curso} es notablemente inferior al promedio de otros grupos en {materia}. Revisar metodología específica."; else average `< 3.5` → "Realizar actividades de nivelación preventiva para subir el promedio del grupo ({avg})." Chip "Avg: {1 decimal} / Pass: {1 decimal}%".                                                         |
| `dashboardSuggestions(classStats)` | over the **teacher's own** classes: per subject, if at least two classes and `best.average − worst.average > 0.7` → warning "Disparidad en {código o nombre}" / "Existe una diferencia de {gap, 2 decimals} puntos entre {mejor curso} y {peor curso}." / action "Revisar si el factor jornada ({jornada mejor} frente a {jornada peor}) influye en el rendimiento y aplicar técnicas de refuerzo usadas en {mejor curso}."; per class with `failingRate > 25` → danger "Alerta Crítica: {curso}" / "La tasa de reprobación en {materia} es del {n}%." / action "Implementar plan de nivelación inmediato y revisar la carga académica del grupo." |
| `quadrantOf(attendancePct, avg)`   | attendance `≥ 80` and average `≥ 3.0` "optimo" (Óptimo); `≥ 80` and `< 3.0` "refuerzo" (Refuerzo Académico); `< 80` and `≥ 3.0` "asistencia" (Atención Asistencia); else "critico" (Crítico).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pearson(points)`                  | Pearson r of attendance % vs average, `null` for fewer than two points or zero variance; `correlationLabel`: `> 0.7` "Fuerte positiva", `> 0.3` "Moderada positiva", `> 0` "Débil positiva", `> −0.3` "Débil negativa", `> −0.7` "Moderada negativa", else "Fuerte negativa", `null` "Sin datos". r is a display statistic (floating point is fine).                                                                                                                                                                                                                                                                                               |
| `regression(points)`               | least-squares segment over the attendance range, clamped to 1–5; `null` for fewer than two points or no x-variance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## 4. API

Router `routers/sige/metric.ts` (`metricRouter`), all `sigeProcedure.use(requirePermission(...))`. Management callers (`metric:read`) see the whole institution; a teacher (`metric:read_own`) only their own offerings (R1.17): for MET-05…07 and the two dashboard reads, `teacherId` is optional for management (default: first teacher with offerings, ordered by last name) and, for a teacher, must be absent or their own person id (otherwise `NOT_FOUND`). Errors per R3.5. No metric procedure accepts `organizationId`.

### 4.1 Procedures

| Procedure                   | Permission                         | Input                                                                  | Output                                                                                                                          | Notes                                                                                               |
| --------------------------- | ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `metric.institution`        | `metric:read`                      | `{ academicYear? }`                                                    | `{ year, kpis, campuses: PerfRow[], courses: PerfRow[], top: StudentRow[], atRisk: StudentRow[] }`                              | MET-01; `top`/`atRisk` capped at 10                                                                 |
| `metric.institutionExport`  | `metric:export`                    | `{ academicYear? }`                                                    | `File` (`metricas-institucionales-{año}.xlsx`)                                                                                  | MET-01 "Exportar Excel"; five sheets (§5, MET-R2)                                                   |
| `metric.heatmap`            | `metric:read`                      | `{ academicYear? }`                                                    | `{ year, subjects: { id, name, code }[], courses: { id, name, campusName }[], cells: HeatCell[] }`                              | MET-02; cells only where finals exist                                                               |
| `metric.trends`             | `metric:read`                      | `{ academicYear? }`                                                    | `{ year, periods: { periodId, name, shortName, average, passRate, count, state }[], direction, attendance: { month, rate }[] }` | MET-03                                                                                              |
| `metric.teacherComparison`  | `metric:read`                      | `{ academicYear? }`                                                    | `{ rows: { letter, groups, students, average, passRate, percentile }[] }`                                                       | MET-04; **no teacher id or name** in the payload                                                    |
| `metric.teacherOptions`     | `metric:read`                      | –                                                                      | `{ id, name }[]`                                                                                                                | teachers with at least one offering, by last name; MET-05/06 select                                 |
| `metric.teacherOverview`    | `metric:read` or `metric:read_own` | `{ teacherId?, academicYear? }`                                        | `TeacherOverview`                                                                                                               | MET-05                                                                                              |
| `metric.attendanceVsGrades` | `metric:read` or `metric:read_own` | `{ teacherId?, academicYear? }`                                        | `{ teacher: { id, name }, points: ScatterPoint[], kpis, correlation: { r, label }, regression, patterns }`                      | MET-06                                                                                              |
| `metric.riskStudents`       | `metric:read` or `metric:read_own` | `{ threshold?: 1 \| 1.5 \| 2 \| 2.5 \| 3 (default 3), academicYear? }` | `{ threshold, rows: RiskRow[], counts: { total, critical, medium } }`                                                           | MET-07; a teacher's averages count only finals of their own offerings (prototype)                   |
| `metric.teacherClassStats`  | `metric:read` or `metric:read_own` | `{ teacherId? }`                                                       | `TeacherClassStats[]`                                                                                                           | DASH-04 "Analítica de Desempeño" and "Promedio por clase" (module 01 `dashboard.teacher.analytics`) |
| `metric.teacherSuggestions` | `metric:read` or `metric:read_own` | `{ teacherId? }`                                                       | `TeacherSuggestion[]`                                                                                                           | DASH-04 "Sugerencias automáticas" (OD-15; module 01 `dashboard.teacher.suggestions`)                |

`dashboard.teacher` (module 01) calls the same service functions in-process for the signed-in teacher (its permission is `grade:read`); the two procedures exist for the web and for management previews. "Reference period" for the dashboard reads is DASH-R8 of module 01.

```ts
type PerfRow = {
  id: string;
  label: string;
  sublabel?: string;
  students: number;
  average: number | null;
  passRate: number;
  atRisk: number;
};
type StudentRow = {
  studentId: string;
  name: string;
  courseName: string;
  average: number;
  failedSubjects: number;
};
type HeatCell = {
  courseId: string;
  subjectId: string;
  total: number;
  failed: number;
  failureRate: number;
  average: number;
};
type ClassRow = {
  offeringId: string;
  courseName: string;
  subjectName: string;
  students: number;
  average: number | null;
  passRate: number | null;
  atRisk: number;
  state: "risk" | "attention" | "optimal";
};
type TeacherOverview = {
  teacher: { id: string; name: string };
  kpis: {
    average: number | null;
    passRate: number;
    absenceRate: number;
    absences: number;
    students: number;
  };
  actionPlans: { id: string; subject: string; course: string; text: string; chip: string }[];
  classes: ClassRow[];
  distribution: { label: string; count: number }[]; // 7 bins
  trend: { periodShortName: string; average: number }[];
  riskStudents: StudentRow[];
};
type ScatterPoint = {
  studentId: string;
  name: string;
  courseName: string;
  attendance: number;
  average: number;
  quadrant: "optimo" | "refuerzo" | "asistencia" | "critico";
};
type RiskRow = StudentRow & { state: "critico" | "alerta" };
type TeacherClassStats = {
  offeringId: string;
  subjectName: string;
  subjectCode: string | null;
  courseName: string;
  shift: string;
  students: number;
  average: number; // mean of finals up to and including the reference period
  failingRate: number; // % failing in the reference period, 2 decimals
  state: "risk" | "attention" | "optimal";
};
type TeacherSuggestion = {
  id: string;
  tone: "warning" | "danger";
  title: string;
  message: string;
  action: string;
};
```

### 4.2 Audit

None: reads and exports are not audited (R3.26 lists no metric action).

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- MET-R1 **Scope and population.** Active students only (R2.10), finals of the requested academic year. Teacher callers: offerings with `teacher_person_id = self` and an `activo`/`temporal` assignment (the same rule as `ScopePolicy`); management may pass any `teacherId` that has at least one offering (else `NOT_FOUND`). An invalid `threshold` → `BAD_REQUEST` "Umbral inválido.".
- MET-R2 **MET-01.** KPIs: "Promedio Institucional" (`mean` of all finals), "% Aprobación General" (`passRate`, one decimal), "Estudiantes en Riesgo" (students with average `< 3.0`), "Tasa de Inasistencia" (07 `absenceRate` over attendance rows of active students in the year, one decimal). Campus table: every campus with at least one active student (campus of the student record); course table: every course of the year with its campus; both with students, average, pass rate and at-risk count. "Top 10 Mejores Estudiantes": average desc then name (students with finals only), medals for 1–3, state "Sin pérdidas" or "{n} pérdida"/"{n} pérdidas". "Top 10 Estudiantes en Riesgo": average asc. The `.xlsx` export has the five sheets "KPIs Generales", "Rendimiento por Sede", "Rendimiento por Grado", "Top 10 Estudiantes", "Estudiantes en Riesgo" (the last one lists **all** at-risk students) with Spanish headers equal to the on-screen columns; cell text beginning with `=`, `+`, `-` or `@` is prefixed with `'` (formula-injection guard); built with the shared xlsx helper of module 03.
- MET-R3 **MET-02.** Rows = courses of the year (campus, level order, name); columns = subjects offered; a cell exists only when the course × subject has finals: `failureRate` = integer-rounded (half-up) share of finals `< 3.00`, `average` two decimals, `total`, `failed`. Cell shows "{x}%" and "Prom: {a}" (one decimal), colour by `heatBand`; tooltip "{asignatura} - {grado}: {x}% pérdida | Promedio: {a} | Total: {n} | Perdidas: {m}"; no data "-". All periods of the year with finals are pooled (the prototype has no period filter).
- MET-R4 **MET-03.** One point per period of the year that has finals (periods without finals are omitted); `state` by `periodState`; the callout direction by `trendDirection`; monthly attendance rate = `present / total` per `YYYY-MM` over active students' rows (one decimal; equals 100 − absence rate), ascending.
- MET-R5 **MET-04 anonymity.** The payload never carries teacher ids or names; letters are assigned per request from the ranking, so a letter is stable only inside one response. Only teachers with at least one final in the year appear; `groups` counts all their offerings, `students` the distinct students with finals. Management can still identify a teacher through MET-05 (accepted, OQ-MET-2); the screen is anonymous among teachers' peers and in exports, not against management.
- MET-R6 **MET-05.** KPIs "Promedio General", "% Aprobación", "Inasistencias" (non-`presente` share of attendance rows of the teacher's offerings, one decimal, plus the absolute count) and "Estudiantes a Cargo" (distinct students with a final in the teacher's offerings); class rows for **every** offering of the teacher (average `null` shown "-" when no finals; `students` = active students of the course); at most one action plan per class (`actionPlans`); at-risk students are those whose average over the teacher's finals is `< 3.0`. Management sees a teacher select ("Seleccionar docente..."); a teacher does not, and the footer card "Comparativa Anónima" (→ MET-04) is shown to management only (the prototype hides it from teachers because they cannot open MET-04).
- MET-R7 **MET-06.** One point per student with at least one attendance row **and** one final in the teacher's offerings; attendance % = present share over the teacher's offerings' rows (one decimal), average over the teacher's finals. Students with no attendance rows are not analysed (the prototype counted them as 100% attendance; 07 ATT-R8 treats "no records" as unknown). Lists "Baja Asistencia (< 80%)" and "Críticos (Baja Asistencia + Notas Bajas)" show the first five and "+{n} más".
- MET-R8 **MET-07.** Rows with average `< threshold` ordered by average asc, state "Crítico" (`< 2.0`) or "Alerta"; counts "Total en Riesgo", "Riesgo Alto (<2.0)", "Riesgo Medio (2.0-2.9)". Threshold options (labels verbatim): "1.0 - Solo desempeño muy bajo", "1.5 - Riesgo extremo", "2.0 - Riesgo alto", "2.5 - Riesgo medio-alto", "3.0 - Incluye desempeño básico bajo". Teachers' rows use their own finals only, so a student can show a different average to two teachers (and to management).
- MET-R9 **Dashboard reads.** `teacherClassStats.average` is the mean of the offering's finals in periods up to and including the reference period (DASH-R8); `failingRate` is the failing share of the reference period (2 decimals); `[]` when the teacher has no offerings; `state` per `teacherGroupState` (30.00 → not risk, 30.01 → risk; 3.49 → attention, 3.50 → optimal). Suggestions follow `dashboardSuggestions`.
- MET-R10 **Exports.** MET-01 uses the server export above. MET-02, MET-03 and MET-04 keep the prototype's "Exportar" button as a **client-side CSV** of the displayed data (UTF-8 BOM; heatmap in long format "Grado,Sede,Asignatura,Total,Perdidas,% Pérdida,Promedio"; trends "Periodo,Promedio,% Aprobación,Estado"; teachers "Profesor,Grupos,Estudiantes,Promedio,% Aprobación,Percentil"); MET-05…07 have no export.

## 6. Web

Feature folder `apps/web/src/features/metrics`; thin routes under `routes/_auth/_org/metricas/`. Charts reuse the prototype components (`SeriesChart` line/bar, `CategoryBarChart`, `DonutChart`, scatter) from `shared/components/sige/charts.tsx` with the palette of inventory §3.11; `PassRateBar` colours green `≥ 80`, amber `≥ 60`, red otherwise; `ScoreText` green `≥ 4.0`, amber `≥ 3.0`, red otherwise. Every screen has loading, error-with-retry, empty and permission states. The sub-screens MET-02…04 show "Volver a Métricas" (→ MET-01) and "Exportar" (MET-R10).

### 6.1 MET-01 `/metricas`

Header "Métricas Institucionales" / "Vista general del rendimiento académico"; actions "Exportar Excel" (`metric:export`), "Mapa de Calor" (→ MET-02), "Tendencias" (→ MET-03), "Comparativa Docentes" (→ MET-04). Tiles "Promedio Institucional", "% Aprobación General", "Estudiantes en Riesgo", "Tasa de Inasistencia". Cards "Rendimiento por Sede" (columns "Sede", "Estudiantes", "Promedio", "% Aprobación" with bar, "En Riesgo" red badge when `> 0`; empty "No hay datos de sedes disponibles."), "Rendimiento por Grado" (adds "Sede"; empty "No hay datos de grados disponibles."), "Top 10 Mejores Estudiantes" ("#", "Estudiante" → STU-02, "Grado", "Promedio", "Estado"; empty "No hay datos de estudiantes disponibles."), "Top 10 Estudiantes en Riesgo" ("Estudiante", "Grado", "Promedio" red, "Materias Perdidas"; empty "No hay estudiantes en riesgo académico.").

### 6.2 MET-02 `/metricas/mapa-calor`

Header "Mapa de Calor de Rendimiento" / "Matriz de porcentaje de pérdida por grado y asignatura". Card "Leyenda - Porcentaje de Pérdida" (the five bands plus "Sin datos"). Card "Matriz Grado x Asignatura": first column "Grado / Sede", one column per subject (code, name as title), cells as MET-R3, keyboard-focusable; clicking a cell opens the dialog **"Detalle de Celda"** ("Grado: {g} · Asignatura: {a}", tiles "% Pérdida", "Promedio", "Total Notas", "Perdidas", button "Cerrar"). Empty: **"No hay datos disponibles para el mapa de calor."**

### 6.3 MET-03 `/metricas/tendencias`

Header "Tendencias Académicas" / "Evolución del rendimiento a lo largo del año". Callout "Análisis de Tendencia": "El rendimiento institucional muestra una tendencia de **{MEJORA|DETERIORO|ESTABILIDAD}** en los últimos periodos analizados." (destructive tone for deterioro, info otherwise). Charts "Promedio Institucional por Periodo" (line, domain 0–5), "% Aprobación por Periodo" (bars, domain 0–100), "Tendencia de Asistencia Mensual" (line, "% Asistencia"; empty "No hay registros de asistencia disponibles."). Card "Detalle por Periodo": "Periodo", "Promedio", "% Aprobación" (bar), "Estado" badge. Empty: **"No hay datos de periodos disponibles"** / "Se necesitan periodos académicos con calificaciones registradas."

### 6.4 MET-04 `/metricas/comparativa-docentes`

Header "Comparativa Anónima de Docentes" / "Rendimiento anonimizado por profesor (A, B, C...)". Tiles "Total Docentes", "Promedio General", "Mejor Percentil" ("100%", hint "Profesor A"), "Mejor % Aprobación" (hint "Profesor {letra}"). Card "Tabla Comparativa Anónima": "Profesor" ("Profesor {letra}", trophy for A), "Grupos", "Estudiantes", "Promedio", "% Aprobación", "Percentil" badge. Charts "Comparativa de Promedios" (bar per letter) and "Distribución de Aprobación" (doughnut). Empty: **"No hay datos de docentes disponibles"** / "Se necesitan docentes con grupos y calificaciones asignadas."

### 6.5 MET-05 `/metricas/docente?teacher=`

Header "Métricas del Docente" / "Rendimiento, asistencia y planes de acción por docente"; line "Analizando: **{docente}**" and, for management, the select "Seleccionar docente..." (changing it reloads with `teacher`). No teachers: **"No hay docentes con asignaturas"**. Tiles "Promedio General", "% Aprobación", "Inasistencias" (hint "{n} totales"), "Estudiantes a Cargo". Card "Planes de Acción Sugeridos" (subject, course badge, text, chip; empty **"¡Todo en orden!"** / "No se han detectado desviaciones críticas que requieran intervención inmediata."). Card "Análisis por Grupo": "Grupo", "Materia", "Estudiantes", "Promedio", "% Aprobación", "En Riesgo" (empty "No hay datos de grupos disponibles."). Charts "Distribución de Notas" (7 bins, "Número de Estudiantes"; empty "No hay datos de notas disponibles.") and "Tendencia por Periodo" (line "Promedio General" with reference line "Mínimo aprobatorio (3.0)"; empty "No hay datos de periodos disponibles."). Card "Estudiantes en Riesgo" with chip "{n} con promedio < 3.0": "Estudiante" (→ STU-02), "Grado", "Promedio" (red), "Materias Afectadas" (empty **"No hay estudiantes en riesgo. ¡Excelente trabajo!"**). Footer links "Comparativa Anónima" / "Tu rendimiento vs. promedio institucional" (management) and "Asistencia vs Rendimiento" / "Correlación asistencia-notas" (→ MET-06 with the teacher).

### 6.6 MET-06 `/metricas/asistencia-rendimiento?teacher=`

Header "Asistencia vs Rendimiento" / "Correlación entre asistencia y notas de los estudiantes a cargo"; "Analizando: **{docente}**", the teacher select (management), back "Volver al Dashboard" (→ MET-05). Tiles "Estudiantes Analizados", "Asistencia Promedio" ("{n}%"), "Nota Promedio", "Correlación" (r with two decimals, hint = label). Chart "Gráfico de Dispersión: Asistencia vs Notas" (scatter; series "Óptimo (Asist. >= 80%, Nota >= 3.0)" green, "Refuerzo Académico (Asist. >= 80%, Nota < 3.0)" blue, "Atención Asistencia (Asist. < 80%, Nota >= 3.0)" amber, "Crítico (Asist. < 80%, Nota < 3.0)" red, grey "Tendencia" line; tooltip name, course and both values). Card "Patrones Identificados": counts "Aproban + Buena Asistencia", "Aproban + Baja Asistencia", "Reprueban + Buena Asistencia", "Reprueban + Baja Asistencia" and the two lists of MET-R7; empty "No se identificaron patrones de riesgo." / "No hay datos suficientes para analizar patrones." Card "Detalle por Estudiante": "Estudiante" (→ STU-02), "Grado", "% Asistencia" (bar), "Promedio Notas", "Estado" (quadrant badge). Empty: **"No hay datos de asistencia y notas disponibles."**

### 6.7 MET-07 `/metricas/estudiantes-riesgo?threshold=`

Header "Estudiantes en Riesgo" / "Estudiantes con rendimiento bajo en la institución" (teacher: "…en tus asignaturas"). Card "Filtro": "Umbral de Riesgo (promedio menor a):" select (MET-R8 labels) and "Restablecer". No rows: **"¡No hay estudiantes en riesgo!"** / "Todos los estudiantes tienen promedios iguales o superiores al umbral de {umbral}." + "Volver al Dashboard". Else tiles "Total en Riesgo", "Riesgo Alto (<2.0)", "Riesgo Medio (2.0-2.9)"; card "Lista de Estudiantes en Riesgo" (10 per page: "#", "Estudiante", "Grado", "Promedio" badge red `< 2.0` else amber, "Asignaturas", "Estado" "Crítico"/"Alerta", eye "Ver perfil de {nombre}" → STU-02); chart "Distribución de Riesgo" (doughnut "Riesgo Alto (<2.0)" / "Riesgo Medio (2.0+)") and callout "Umbral actual: {n}" ("Estudiantes con promedio menor a este valor se consideran en riesgo. Crítico: promedio menor a 2.0 (desempeño Bajo). Alerta: entre 2.0 y el umbral (desempeño Básico bajo).").

## 7. Flows and audit

- **F13** Metrics drill-down: MET-01 KPIs and tables → MET-02 cell dialog → MET-03 → MET-04 → MET-05 per teacher → MET-06 → MET-07 → STU-02; export MET-01 `.xlsx`.
- **F14** teacher route: DASH-04 → "Métricas" (sidebar entry → MET-05, foundation R1.27).
- Audit: none (§4.2).

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): `mean` half-up (2.995 → 3.00, 4.595 → 4.60), `passRate` (all pass, none, empty), `studentSummary` failed-subject count, `heatBand` at 10/11/20/21/30/31/40/41 on the rounded rate, `periodState` at 3.0/3.49/3.5, `trendDirection` (1, 2, 3 and 4 periods, equal halves), `teacherGroupState` (failing 30.00/30.01, average 3.49/3.50), `anonymise` (ties, letters beyond Z, one teacher → percentile 100), `scoreBins` boundaries (4.5, 3.99, 1.0), `actionPlans` precedence and chip format, `dashboardSuggestions` (gap 0.70/0.71, failing 25.00/25.01, subjects without code), `quadrantOf` at 79.9/80 and 2.99/3.0, `pearson` (perfect, none, zero variance, one point), `correlationLabel` boundaries, `regression` clamping.
- **API integration** (Postgres, seeded fixture with known finals/attendance): MET-01 KPIs equal hand-computed values (institution average, pass rate, at-risk count, absence rate), campus/course rows, top/risk lists and export sheet contents; heatmap cells equal per-(course, subject) counts and ignore retired students; trends skip periods without finals and compute direction and monthly attendance; comparison payload contains no teacher id/name and letters follow the ranking; teacher overview/MET-06/MET-07 for a teacher use only own offerings (another teacher's id → `NOT_FOUND`, `inactivo` assignment loses access), management can pass any `teacherId`; threshold validation; `teacherClassStats`/`teacherSuggestions` equal `dashboard.teacher` output; academic-year parameter; SQL rounding equals `sige-core` (parity over generated finals); two-tenant isolation; permission matrix per role (coordinator all reads, teacher `read_own` only, viewer and student none); no `organizationId` in schemas; MET-01 time budget on the seed.
- **Web**: each screen's empty states and copy, tile values, `PassRateBar`/`ScoreText` thresholds, heatmap cell dialog and keyboard focus, teacher select reload, MET-05 footer links per role, MET-07 threshold labels and teacher subtitle, CSV builders (BOM, quotes, accents); stories for `PassRateBar`, `HeatCell`, `TeacherSelect`.

### 8.2 Acceptance

- MET-01…04: figures match the database on the demo seed; the institutional average and pass rate are about 3.8 and 88% (foundation §9 R4.7); the `.xlsx` opens with five sheets.
- MET-05…07: a teacher sees only own offerings and students; the sidebar "Métricas" opens MET-05 for teachers (never a 403); management picks any teacher.
- DASH-04 shows the analytics and suggestions of this module for the signed-in teacher.
- P7 exit criterion of foundation §8 (performance budget, teachers see only own metrics) holds.

## 9. Open questions and notes

### 9.1 New open questions

| ID       | Question                                                                             | Recommended default                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-MET-1 | Year selector and period filter (the prototype pools all periods of its single year) | No UI in v1: the current academic year, all periods pooled; every read already accepts `academicYear`, so a selector is a web-only follow-up.         |
| OQ-MET-2 | Is "anonymous" enough when management can open MET-05 for any teacher?               | Yes: the anonymity protects the comparison table and its exports; if peers (teachers) ever see MET-04, add a minimum of 3 teachers before showing it. |
| OQ-MET-3 | MET-02…04 "Exportar" has no defined format in the foundation                         | Client-side CSV of the displayed data (MET-R10); an `.xlsx` for them can reuse the MET-01 helper later.                                               |

### 9.2 Gaps found in 00-foundation.md and 01

- G-MET-1 Foundation §5.5 defines "Teacher group state" with `failing rate > 30` but not the precision of the rate; module 01's tests exercise 30.0 and 30.01, so this spec fixes the failing rate to two decimals (`teacherClassStats.failingRate`), while the heatmap uses the integer-rounded rate of the prototype.
- G-MET-2 Foundation §5.5 "Student average (at risk)" does not say whether the comparison uses the rounded or the raw mean; this spec compares the rounded two-decimal average so the badge and the classification agree (as `statusOf` does for finals).
- G-MET-3 `dashboard.teacher` (module 01) is guarded by `grade:read` while the metrics procedures it mirrors are guarded by `metric:read_own`; the dashboard calls the shared service in-process and the procedures remain for direct use (§4.1).
- G-MET-4 Inventory §3.11 lists "Exportar" on MET-02…04 and the prototype ships a stub; only MET-01 has a specified export (R3.22), hence OQ-MET-3.
- G-MET-5 Inventory MET-06 treats students without attendance rows as 100% attendance (prototype `attendanceVsGrades`); this spec excludes them (MET-R7) for consistency with 07 ATT-R8.
