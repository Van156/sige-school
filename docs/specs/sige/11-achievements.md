# Spec: SIGE — Achievements (ACH)

- **Status:** Draft
- **Date:** 2026-10-07
- **Stack:** Hono + oRPC (server, Bun), TanStack Router + Query (web), Drizzle + Postgres, `bun:test`
- **Depends on:** [`00-foundation.md`](./00-foundation.md) (§4.2 `achievement` grants, §4.3 scope, §5.2 `achievement` / `student_achievement`, §5.5 achievement rules, R2.10, R3.18–R3.19, OD-10), [`06-grades.md`](./06-grades.md) (`final_grade`), [`07-attendance.md`](./07-attendance.md) (attendance rows), [`08-observations.md`](./08-observations.md) (positive observations), [`02-institution.md`](./02-institution.md) (periods, `seedInstitutionDefaults`), [`05-students.md`](./05-students.md) (`student.pick`, `StudentStrip`, `StudentSwitcher`), [`data-table.md`](../data-table.md).

Prototype sources: `apps/web/src/routes/prototype/sige/-screens/achievements/*`, `-components/achievement-card.tsx`, `-lib/achievements.ts`, `-mock/achievement-engine.ts`, `-mock/base.ts` (`achievements`), `-screens/parent/child-achievements-screen.tsx`. Inventory §3.12, §2.2, F10. Requirement ids: `ACH-R<n>`. Phase P7.

## 1. Objective and scope

Rule-based recognition: a catalog of seven achievements, an engine that awards them from final grades, attendance and positive observations, manual awards by management, the per-student view (shared with the student and the guardians) and the student ranking with podium. The engine runs on explicit user action (OD-10, R3.19) and is idempotent.

### In scope

| Screen | Title                                     | Roles                                        | Real route                    |
| ------ | ----------------------------------------- | -------------------------------------------- | ----------------------------- |
| ACH-01 | "🏆 Logros y Gamificación"                | R, A, C (award, run engine); T read          | `/logros`                     |
| ACH-02 | "🏆 Logros del Estudiante" ("Mis Logros") | R, A, C; T (own students); S own; P children | `/logros/estudiante?student=` |
| ACH-03 | "🏆 Ranking Estudiantil"                  | R, A, C, T (own students); S, P (masked)     | `/logros/ranking`             |

Also in scope: tables `achievement` and `student_achievement`; the pure rules and the default catalog in `packages/sige-core/src/achievements.ts`; the seven-row seed consumed by module 02. PAR-06 (module 13) reuses `achievement.studentAchievements`.

### Out of scope

- Creating, editing or deactivating achievements from the UI (the table has `is_active` for later; the prototype has no editor), custom rules, badges images beyond the emoji icon.
- Points, levels, notifications when an achievement is earned (OD-11), revoking an award.

## 2. Data

Conventions R2.1–R2.6. Tenant-safe composite FKs to `student`, `academic_period`, `person`.

| Table                 | Columns and constraints                                                                                                                                                                                                                                                                                                | Indexes                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `achievement`         | `name`, `description` ≤ 300, `icon` (emoji text), `rule_key` text not null, `category` enum `achievement_category` (`académico`, `mejora`, `asistencia`, `comportamiento`), `is_active bool default true`, `created_at`. `unique(organization_id, rule_key)`.                                                          | –                                                                    |
| `student_achievement` | `student_id`, `achievement_id`, `period_id` null, `earned_at timestamptz not null`, `awarded_by` null (→ `person`; null = engine), `created_at`. `unique(student_id, achievement_id, coalesce(period_id, ''))` (a unique index on the expression). FKs `restrict` (a period or student with awards cannot be deleted). | `(organization_id, student_id)`, `(organization_id, achievement_id)` |

Migration: enum + two tables. `seedInstitutionDefaults` (module 02 §2.1) inserts `DEFAULT_ACHIEVEMENTS` (below) for every new institution; the demo seed inserts two manual awards directly and lets the engine derive the rest (R4.5).

## 3. Rules (`packages/sige-core/src/achievements.ts`)

### 3.1 Default catalog (`DEFAULT_ACHIEVEMENTS`)

| `rule_key`            | Name                  | Icon | Category         | Description (verbatim)                        |
| --------------------- | --------------------- | ---- | ---------------- | --------------------------------------------- |
| `superador`           | "Superador"           | 📈   | `mejora`         | "Subió 1+ punto entre periodos consecutivos"  |
| `excelencia`          | "Excelencia"          | ⭐   | `académico`      | "Nota >= 4.5 en un periodo"                   |
| `asistencia_perfecta` | "Asistencia Perfecta" | ✅   | `asistencia`     | "0 inasistencias en un periodo"               |
| `todo_terreno`        | "Todo Terreno"        | 🏅   | `académico`      | "Todas las materias ganadas en el periodo"    |
| `resiliente`          | "Resiliente"          | 💪   | `mejora`         | "Recuperó una materia perdida entre periodos" |
| `constancia`          | "Constancia"          | 🔥   | `académico`      | "3 periodos seguidos con promedio >= 4.0"     |
| `companero`           | "Compañero"           | 🤝   | `comportamiento` | "Recibió una observación positiva"            |

Category labels: "Académico", "Mejora", "Asistencia", "Comportamiento"; badge tones info, success, warning, secondary.

### 3.2 Engine rules

`evaluate(student, closedPeriods)` is a pure function over plain inputs: for each **closed period** (a period of the current academic year that is not the active one and has at least one final for some student, ordered by `order_num`; the active period never awards, as in the prototype) and index `i`:

| Rule                  | Condition (all on the student, period `P = closed[i]`)                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `excelencia`          | mean of the student's finals in `P` `≥ 4.50` (rounded half-up to hundredths).                                                                          |
| `todo_terreno`        | at least 3 finals in `P` and every one `≥ 3.00`.                                                                                                       |
| `superador`           | the previous closed period has a mean and `mean(P) − mean(previous) ≥ 1.00`.                                                                           |
| `resiliente`          | a previous closed period exists and some offering has final `≥ 3.00` in `P` and `< 3.00` in the previous period.                                       |
| `constancia`          | `i ≥ 2` and the means of `closed[i−2]`, `closed[i−1]`, `P` all exist and are `≥ 4.00`.                                                                 |
| `asistencia_perfecta` | at least 5 attendance rows with `date` inside `[P.start_date, P.end_date]` and none different from `presente` (no rows or fewer than 5 → not awarded). |
| `companero`           | at least one `positiva` observation whose Bogotá date falls inside `[P.start_date, P.end_date]`.                                                       |

No finals for the student in `P` → nothing is awarded for `P`. Only active students (R2.10) and active catalog entries are evaluated. Each satisfied rule yields `(achievement, P)`. The pure function takes aggregated inputs (per student × period: finals list, attendance `{ total, nonPresent }`, `hasPositiveObservation`), so the service loads aggregates with SQL, not row sets.

`leaderboard(rows)`: students with at least one award, ordered by count desc then name (locale `es`); `rank` = position (no shared ranks); the prototype podium shows ranks 1–3.

## 4. API

Router `routers/sige/achievement.ts` (`achievementRouter`), all `sigeProcedure.use(requirePermission(...))`; `context.scope.assertStudent()` for every `studentId`. Other tenant or out-of-scope student → `NOT_FOUND` (R1.15). Errors per R3.5.

### 4.1 Procedures

| Procedure                         | Permission                                                     | Input                                                               | Output                                                                                                                                        | Notes                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `achievement.list`                | `achievement:read`                                             | `{ category?: Category }`                                           | `{ id, name, description, icon, category, ruleKey, timesAwarded }[]`                                                                          | ACH-01 grid; active catalog only; `timesAwarded` = all `student_achievement` rows of the achievement (tenant-wide count, no student data) |
| `achievement.studentAchievements` | `achievement:read` or `portal:read_self` / `portal:read_child` | `{ studentId }`                                                     | `{ student: StudentStripData, counts: { total, academico, mejora, asistencia, comportamiento }, earned: EarnedRow[], catalog: CatalogRow[] }` | ACH-02 and PAR-06 (R1.16); `earned` newest first; `catalog` = every active achievement with `earned: boolean`                             |
| `achievement.leaderboard`         | `achievement:read` or `portal:read_self` / `portal:read_child` | `{ courseId?: string, limit?: 10 \| 25 \| 50 \| 100 (default 50) }` | `{ rows: { rank, studentId, name, courseName, count, canOpen }[] }`                                                                           | ACH-03; scope and masking per ACH-R7                                                                                                      |
| `achievement.award`               | `achievement:award`                                            | `{ achievementId, studentId, periodId?: string \| null }`           | `{ id }`                                                                                                                                      | manual award; ACH-R3                                                                                                                      |
| `achievement.runEngine`           | `achievement:run_engine`                                       | `{ studentId?: string }`                                            | `{ awarded: number, perAchievement: { achievementId, count }[] }`                                                                             | ACH-01 (all active students) / ACH-02 (one student); ACH-R4; idempotent                                                                   |

```ts
type EarnedRow = {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  category: Category;
  periodShortName: string | null;
  earnedAt: string;
  awardedByName: string | null; // null = automatic
};
type CatalogRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: Category;
  earned: boolean;
};
```

Student selectors use `student.pick` (05); period selects use `period.list` (02); course selects `course.options`.

### 4.2 Audit

| Procedure               | Action                   | Metadata                                                        |
| ----------------------- | ------------------------ | --------------------------------------------------------------- |
| `achievement.award`     | `achievement.awarded`    | `{ achievementId, studentId, periodId }`                        |
| `achievement.runEngine` | `achievement.engine_run` | `{ studentId?: string, awarded, perAchievement }` (counts only) |

Engine awards are not audited one by one (`awarded_by` is null and the run event carries the counts). Reads are not audited.

## 5. Business rules and validation

Messages verbatim from the prototype and inventory (accents restored).

- ACH-R1 **Who.** `achievement:read` (owner, admin, coordinator, teacher) opens ACH-01; `award` and `run_engine` belong to owner, admin and coordinator. A teacher sees the catalog read-only (no "Otorgar Manualmente", no "Ejecutar Motor Automático") and only students in their scope in ACH-02 and ACH-03. Students and guardians reach ACH-02 for themselves / linked children through the portal permissions and ACH-03 as ACH-R7 describes.
- ACH-R2 **Earned date.** `earned_at` is the end of the period's `end_date` (Bogotá, 23:59:59) when the award has a period, otherwise `now`; the UI shows `dd/mm/yyyy` (the prototype stores the period end date; the legacy `HH:MM` of the inventory is not shown because it carried no information). The "Periodo" meta shows the period short name ("P2 · 15/09/2026").
- ACH-R3 **Manual award.** Requires `achievementId` and `studentId` (client field error **"Debe seleccionar un estudiante."**, server `BAD_REQUEST` **"Debe seleccionar un logro y un estudiante."**); the achievement must be active and the student `activo` (`BAD_REQUEST` "El estudiante no está activo."); an out-of-scope student → `NOT_FOUND` "Estudiante no encontrado.". An optional period must exist in the tenant. A duplicate `(student, achievement, period)` (null period counts as one slot) → `CONFLICT` **"El estudiante ya tiene este logro para el periodo seleccionado."**, shown as an info toast. Success toast `Logro "{nombre}" otorgado` with sub-line "Estudiante: {nombre}" (modal) or "Logro otorgado" (quick award). `awarded_by` = caller. A manual award without period can coexist with the engine's per-period awards of the same achievement.
- ACH-R4 **Engine.** `runEngine` evaluates §3.2 for all active students (or the given one) and inserts each satisfied `(student, achievement, period)` with `ON CONFLICT DO NOTHING`; `awarded` counts only inserted rows, so a second run returns 0. Result toasts: **"{n} logros otorgados"** or info **"No se encontraron nuevos logros para otorgar."**. Confirms: all students **"¿Ejecutar el motor de logros para todos los estudiantes?"** / "Se evaluarán las siete reglas sobre las notas, la asistencia y las observaciones."; one student **"¿Ejecutar el motor para este estudiante?"** / "Se evaluarán las reglas de logros solo para este estudiante." The run is one transaction and shows a spinner; with no closed periods it returns 0. The engine never revokes: a later grade change that no longer satisfies a rule keeps the award (OQ-ACH-2).
- ACH-R5 **Catalog filter.** ACH-01 chips "Todos" and one per category ("Académico", "Mejora", "Asistencia", "Comportamiento"); the filter is a query parameter of `list`, `aria-pressed` on the active chip.
- ACH-R6 **Student view.** Counters "Logros" (total), "Académicos" and "Mejora"; earned grid newest first (by `earned_at`, then period order desc, then name). A retired or graduated student's awards remain readable here.
- ACH-R7 **Leaderboard.** Counts awards of **active** students. Staff and teachers: scope-filtered (teacher: students of own courses, OD-21), real names, "Ver Logros" for every listed row. Student and parent: the ranking is institution-wide (so it is meaningful) but names of students other than their own / linked children are masked to "{Nombre} {inicial del apellido}." and `canOpen` is false for them (OQ-ACH-1); this is the single exception to R1.14 for portal callers (G-ACH-1). `courseId` filters by the student's course; `limit` caps rows. Podium appears when at least three rows exist.
- ACH-R8 **Consumers.** PAR-06 renders `earned` plus `catalog` of the same procedure; no other module reads `student_achievement` in v1.
- ACH-R9 **Seed and storylines.** The engine must reproduce the achievement leaderboard of foundation §9 on the demo seed (R4.5/R4.7); the two manual awards are inserted directly with `awarded_by` set.

## 6. Web

Feature folder `apps/web/src/features/achievements`; thin routes under `routes/_auth/_org/logros/`. `AchievementCard` (emoji, name, description, category badge, optional meta line, optional footer; `muted` dims unearned) lives in the feature and is shared with PAR-06; its story covers earned, muted and footer variants. Every screen has loading, error-with-retry, empty and permission states.

### 6.1 ACH-01 `/logros`

Header "🏆 Logros y Gamificación" / "Catálogo de logros y reconocimientos estudiantiles"; actions "Ranking" (→ ACH-03) and "⚙️ Ejecutar Motor Automático" (`achievement:run_engine`, confirm ACH-R4, spinner). Card "Filtrar por categoría" with the chips of ACH-R5. Grid of cards: icon, name, description, category badge, "Otorgado {n} veces" and, with `achievement:award`, button "🏆 Otorgar Manualmente". Empty: **"Sin logros disponibles"** / "No hay logros configurados para esta institución." Dialog **"🏆 Otorgar Logro"**: "Logro a otorgar: {icono} {nombre}", "Estudiante" (required, "-- Seleccionar estudiante --", options "{nombre} - {curso o 'Sin grado'}" from `student.pick`, sorted), "Periodo (opcional)" ("-- Sin periodo específico --"), buttons "Cancelar", "Otorgar Logro".

### 6.2 ACH-02 `/logros/estudiante?student=`

Header "🏆 Logros del Estudiante" / "Reconocimientos obtenidos por periodo". `StudentSwitcher` (staff by course; parent child buttons; student hidden) and `StudentStrip`; actions "Ranking" (→ ACH-03), "Volver al Estudiante" (staff, → STU-02) and "Ejecutar Motor" (`run_engine`, confirm ACH-R4). Tiles "Logros", "Académicos", "Mejora". Grid of earned achievements with meta "{P#} · {dd/mm/yyyy}". Empty: **"📋 Sin logros aún"** / "Este estudiante aún no ha obtenido logros. Ejecuta el motor automático o otorga logros manualmente." + (`run_engine`) "Ejecutar Motor para este Estudiante". Side card (`achievement:award`) **"🏆 Otorgar Logro Rápido"**: select "Logro" ("-- Seleccionar --", options "{icono} {nombre}") and "Otorgar" (disabled until chosen; no period). The student sidebar "Mis Logros" opens this route for the student's own record.

### 6.3 ACH-03 `/logros/ranking`

Header "🏆 Ranking Estudiantil" / "Estudiantes con más logros obtenidos". Podium (three or more rows): 2nd (🥈, left), 1st (🏆 with "👑 1° Lugar", centre, raised) and 3rd (🥉, right), each with name, course, count + "logros", "Ver Logros" (when `canOpen`) and caption "2° Lugar" / "3° Lugar". Card "Ranking Completo" with filters "Grado" ("-- Todos los grados --") and "Mostrar" (Top 10, Top 25, Top 50 default, Top 100); columns "#", "Medalla" (🏆 🥈 🥉 or ☆), "Estudiante", "Grado", "Logros" (count badge), "Ver Logros"; top three rows tinted; 15 rows per page client-side. Empty: **"📋 Sin datos de ranking"** / "Aún no hay estudiantes con logros. Ejecuta el motor automático para generar logros." + (`run_engine`) "⚙️ Ejecutar Motor Automático".

## 7. Flows and audit

- **F10** Achievements: ACH-01 "Ejecutar Motor Automático" or ACH-02 "Ejecutar Motor" → awards; manual award from an ACH-01 card or the ACH-02 quick card (duplicate warned); consumption in ACH-02, ACH-03 and PAR-06.
- **F15** student route ends in ACH-02 ("Mis Logros"); **F12** guardians see PAR-06.
- Audit: §4.2.

## 8. Testing and acceptance

### 8.1 Tests

- **Unit** (`sige-core`): each rule at its boundaries (mean 4.49/4.50, `todo_terreno` with 2 vs 3 finals and a 2.99, `superador` +0.99/+1.00, `resiliente` with a recovered and a never-failed offering, `constancia` windows of 2 vs 3 closed periods and 3.99, `asistencia_perfecta` with 4/5 rows and one `justificado`, `companero` on the first and last day of the period); closed-period selection (active period never awards, periods without finals skipped); `leaderboard` ordering and rank; `DEFAULT_ACHIEVEMENTS` matches the table of §3.1.
- **API integration** (Postgres): `runEngine` on a fixture derives exactly the expected awards, a second run returns 0 and changes no rows, a single-student run only touches that student, retired students are skipped, inactive catalog entries are skipped, `earned_at` follows ACH-R2; manual award duplicate (same period, null period), inactive student, out-of-scope student (`NOT_FOUND`), missing fields; audit rows with counts only; `studentAchievements` scope matrix (staff, teacher own/other, student self, parent linked/non-linked → `NOT_FOUND`) and `catalog.earned` flags; `leaderboard` for staff (real names), teacher (scope), student/parent (masking, `canOpen`), course filter, limit; `list` counters and category filter; two-tenant isolation; permission matrix per role (teacher cannot award/run; viewer none; student/parent only portal reads); no `organizationId` in schemas; seed storylines (top 3).
- **Web**: ACH-01 chips, award dialog validation and duplicate toast, engine confirm and result toasts; ACH-02 counters, empty copy per role, quick award; ACH-03 podium placement, masking, limits, empty state; stories for `AchievementCard` and the podium.

### 8.2 Acceptance

- ACH-01/02: management runs the engine and awards manually; a second run awards nothing; teachers cannot award.
- ACH-03: the ranking matches the stored awards; students and guardians see masked names for others.
- PAR-06 shows the same earned list plus the full catalog.
- P7 exit criterion of foundation §8 (engine reproduces the leaderboard top 3 on the seed, idempotent) holds.

## 9. Open questions and notes

### 9.1 New open questions

| ID       | Question                                                                                    | Recommended default                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-ACH-1 | May students and guardians see other children's full names in the ranking (prototype: yes)? | No: mask to first name + last-name initial; own and linked children in full. Switching to full names is a one-line change in `achievement.leaderboard`. |
| OQ-ACH-2 | Revoke an automatic award when later edits to grades or attendance make the rule false?     | No in v1 (awards are stable once granted, as in the prototype); a "recalcular" action can be added with an audit trail if schools need it.              |
| OQ-ACH-3 | Do manual awards without period count for the leaderboard like per-period ones?             | Yes, one award = one count; duplicates are prevented only per `(student, achievement, period or none)`.                                                 |

### 9.2 Gaps found in 00-foundation.md and 02

- G-ACH-1 R1.14/R1.16 scope students to self/children for portal callers; the ranking only makes sense institution-wide, so ACH-R7 introduces a documented exception with masking (OQ-ACH-1). **Resolved in 00-foundation (§4.3 R1.16 records the ranking exception).**
- G-ACH-2 §5.5 states the seven rules in one line each; this spec fixes the details the prototype engine implements (closed periods only, at least five attendance rows, at least three finals for "Todo Terreno", `≥ 1.00` for "Superador" while the alert rule uses `> 1.0`). **Resolved in 00-foundation (§5.5 achievement constants and `MIN_SAMPLE_ROWS`).**
- G-ACH-3 §6.9 lists `achievement.awarded` and `achievement.engine_run`; no event exists for engine awards per student, by design (counts in the run event). **Noted in 00-foundation: no per-student engine award event, by design.**
- G-ACH-4 Module 02 §2.1 calls `seedInstitutionDefaults`; the list it inserts is `DEFAULT_ACHIEVEMENTS` of §3.1 (module 02 only needs to import it). **Noted in 00-foundation: module 02 imports `DEFAULT_ACHIEVEMENTS` (R4.2 provisioning copy); no change needed.**
