# SIGE P5 — Daily academic operations

- **Objective:** deliver phase P5 of `docs/specs/sige/00-foundation.md` §8: module 06 grades (GRD-01…08, `docs/specs/sige/06-grades.md`), module 07 attendance (ATT-01…04, `07-attendance.md`), module 08 observations (OBS-01…05, `08-observations.md`), plus the student/parent-scoped reads (GRD-08, ATT-02, OBS-05).
- **Exit criterion (spec §8 P5):** a teacher enters and locks a sheet; the live total equals the server `final_grade` (parity test); a locked sheet rejects writes server-side; attendance upsert; observation notification flag; matrix tests pass for these modules.
- **Scope:** `packages/sige-core` (rules, grading arithmetic, attendance/observation rules, CSV), `packages/db` (`grade_record`, `period_lock`, `final_grade`, `attendance_record`, `observation` + enums), `packages/api` (routers `grade`, `attendance`, `observation`; finals service and real recalculation port; pg-errors; delete pre-checks; seed), `apps/server` (wire `gradeRecalculation`), `apps/web` (`features/grades`, `features/attendance`, `features/observations`, nav, STU-01/02 action restore).
- **Branch:** `feat/sige-p5-academic-ops` from local `main` (40d9161, includes P0–P4).
- **TDD:** on for sige-core/DB/API — source: project convention (P0–P4) — runner: `bun test` (integration on `TEST_DATABASE_URL`, default `postgres://postgres:password@localhost:5438/sige_school_test`; `pnpm db:test:prepare`; requires `colima start && docker start sige-school-postgres`; run db and api suites sequentially — shared test DB). Web: ordinary checks plus stories.
- **Checks per task:** focused `bun test`, `pnpm check-types`, `pnpm lint`, root `bun test ./tests`; web adds the FULL `cd apps/web && bun test` and `pnpm build-storybook`.
- **Delivery strategy:** `stacked-to-main` (cached). Forecast ≈ 24,000 authored lines (server ≈ 12k, web ≈ 12.5k). Integration into local `main` as one `--no-ff` merge commit per phase after user approval. Push/PRs remain user decisions.
- **Review cadence:** one review per two tasks in the detached worktree `../sige-school-worktrees/p3-bb3e249`; first base = `40d9161`. Ranges over ≈ 2,000 lines are split per task or per commit up front (P4 lesson). Generated drizzle snapshots go in their own commit and are not reviewed.
- **Models:** delegated writers on Opus until the Sonnet reset 2026-10-13 22:00 (Bogotá), then `sonnet`.
- **Commits:** Conventional Commits, no AI attribution trailers.

## Decisions

- D1 (default) Keep the existing recalculation port signature (`recomputeFinals({ scope: "open" }, executor) → { affectedFinals }`); implement it in `sige/grade-finals.ts` (recomputes unlocked offering × period pairs with records) and wire it in `apps/server/src/context.ts` and the test context.
- D2 (default) Criteria are institution-wide; the sheet uses the current criteria ordered by `order_num`.
- D3 (default, P4 `previewUsername` precedent) Widen `period.list` to `period:read | grade:read` so teachers get GRD-01 pills and the GRD-03 period select; update the 02 spec table.
- D4 (default) ATT-R5 teacher rows via `offeringWhere`; GRD-08 and OBS via `studentWhere`.
- D5 (spec defaults) OD-27/28/29, OQ-GRD-1/2, OQ-ATT-1, OQ-OBS-1/2.
- D6 (default) `PERIOD_LOCKED` is an `ORPCError` code with status 409 (`HAS_DEPENDENTS` pattern).
- D7 (default) Grade import is synchronous (per-row savepoint) and reuses `import-workbook.ts`, not `import_job`.
- D8 (SCH-R8) `enrollment.final_score` stays independent of `final_grade`.
- D9 (default) Person FKs (author, recorded_by, created_by, locked_by, notified_by) map to the USR-R7 fallback "El usuario tiene registros asociados. Desactívelo en su lugar.".
- D10 (deviation from R4.1) Seed generators live in `api/src/sige/seed-*.ts` (P4 precedent), not `sige-core/src/seed`.
- D11 (default) The server CSV builder lives in sige-core; the web roll-sheet export reuses it or the existing web csv lib.
- D12 (default) Grade parity: `sige-core/src/grading.ts` + `rules.ts` are the single source for web sheet, `saveSheet`, finals, recalculation, import, seed and later metrics. Integer arithmetic only (scores and weights in hundredths parsed from strings, never floats); `finalCents = (2·Σ(s·w) + Σw) div (2·Σw)` over scored criteria, clamped 100–500, `null` when nothing scored; status/level on the rounded value; DEF = half-up mean of period finals.

## Earlier-phase deferrals closed in P5

- P3 D2 / 04 §4.2: `offering.delete` third check "La materia del grado tiene notas o asistencia registradas.".
- STU-R7 `deleteStudent` pre-check adds grade, attendance and observation records (message already says "…notas o asistencia…").
- `institutionAdmin.delete` `hasAcademicRecords` adds grade records.
- `period.delete` "El periodo tiene notas registradas.", `criterion.delete` "El criterio tiene notas registradas." (pre-checks + FK mapping).
- P4 D7: restore STU-02 action cards "Observación", "Notas", "Asistencia", "Historial de observaciones" and the STU-01 "Observación" row action ("Boletines"/"Logros" stay hidden).

## Tasks

Server (TDD; delegated writer):

- [x] T1 — sige-core `rules.ts` (`SIGE_RULES`, `roundHalfUp`, cents parsing) + `grading.ts` (all 06 §3 functions, 1,000-case BigInt reference) + zod `api/src/sige/schemas/grade.ts` with exact messages.
- [ ] T2 — sige-core `attendance.ts` (school days incl. Sabatina, tallies/bands), `observations.ts`, `csv.ts`; zod `attendance.ts` / `observation.ts`.
- [ ] T3 — DB: enums, `grade_record`, `period_lock`, `final_grade`, `attendance_record` (isodow check), `observation` (stored generated `requires_notification`, notified check, partial index), constraint constants, migration (snapshot in its own commit), constraint tests.
- [ ] T4 — pg-errors + delete pre-checks (offering, period, criterion, student, institution, person) + D3 period gate + ATT-R5 row predicate.
- [ ] T5 — `grade.*` core: classes/sheet/saveSheet/setLock/lockPanel/recalculate, finals service + real port wired (D1), `PERIOD_LOCKED`, audit, parity test, matrix + isolation.
- [ ] T6 — `grade.*` reads + import: finals/annual/summary/studentGrades, importPreview/import/importTemplate.
- [ ] T7 — `attendance.*` (sheet/save/groupSummary/report/studentSummary/history/calendar/export), Bogotá boundary tests.
- [ ] T8 — `observation.*` (list/stats/filterOptions/get/create/update/delete/markNotified/studentHistory/recent/export).
- [ ] T9 — seed: grades (P1–P3 locked, P4 partial, §9 storylines), 8 weeks of attendance through the service, ≈ 35 observations; R4.7 average ≈ 3.8 / pass ≈ 88 % assertions.

Web (react-staff):

- [ ] T10 — `features/grades` scaffold (ClassContext, ClassHeader, ScoreBadge, status/level/lock badges, GradeScaleLegend, GradeGrid + stories) + GRD-01.
- [ ] T11 — GRD-02 sheet (draft, live `periodFinal`, changed cells only, save/lock/unlock, navigation blocker) + GRD-04.
- [ ] T12 — GRD-03, GRD-05, GRD-06, GRD-07.
- [ ] T13 — GRD-08 + ATT-02 (student/parent reads, switcher, charts).
- [ ] T14 — ATT-01 + ATT-03 + ATT-04 (print stylesheet).
- [ ] T15 — OBS-01 + OBS-02 (+ type/notification badges, ObservationCard stories).
- [ ] T16 — OBS-03/04/05.
- [ ] T17 — nav/permission pass: Notas, Asistencia, Observaciones, student "Mis Notas"/"Mi Asistencia"/"Mis Observaciones"; STU-01/02 action restore; action-permission tests per role; story registry.

## Progress

- Mapping done (delegated explorer, Opus). Permission catalog and audit actions already complete for modules 06/07/08; none of the five tables exist; recalculation port is a no-op already called by `criterion.*` and not wired in `apps/server`; `offering.options` already accepts `grade:read | attendance:read`; teachers lack `period:read` (→ D3). Branch created from `40d9161`.
- T1 in 2eb527a (+816, sige-core `rules.ts`: `SIGE_RULES` grade constants + `CENTS`, `gradeMessages`, exact integer `divHalfUp`/`roundHalfUp`, regex `parseCents`/`parseScore`/`parseWeight`, `centsFromNumber` (shortest decimal form; 2.995 refused); `grading.ts`: `periodFinal`, `statusOf`, `performanceLevel`, `scoreClass`, `annualDef`, `annualStatus`, `scoreBuckets`, `classStats`, `formatScore`/`formatCellScore`/`formatFinal`, `meanCents`; 1,000-case seeded BigInt reference test with forced x.xx5 ties) + 0b01cde (+281, `api/src/sige/schemas/grade.ts`: saveSheet 1..2000 cells, optional `lock`, cells output `scoreCents` (integer — T5 reads it), observation trim/≤500/needs score, duplicate (student, criterion) refused; setLock, classes, offering-period, offering, student, import inputs). Decisions: `classStats` mean/max/min in hundredths, passRate one-decimal percent over evaluated finals, SD in score units one decimal; `performanceLevel(null)` → null; "Sin nota" is a display state; `SIGE_RULES` holds grade constants only (others in T2+). Authored: "No hay notas para guardar.", "No se pueden guardar más de 2000 notas a la vez.", "La planilla tiene notas repetidas para el mismo estudiante y criterio.". Carry-overs: T5 checks GRD-R3 against the DB and builds `lib/grade-lock-list-config.ts`; optional tidy-up `enrollment.isValidFinalScore` float tolerance → `centsFromNumber`. TDD: RED missing modules (sige-core 0/2, api 0/1); GREEN sige-core 296, api schemas 136; root tests 38; check-types/lint 0. Parent spot check: sige-core 296/0, schemas 136/0, no trailers. Route: delegated writer (Opus).
