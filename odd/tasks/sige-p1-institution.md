# SIGE P1 — Institution structure

- **Objective:** deliver phase P1 of `docs/specs/sige/00-foundation.md` §8: module 02 (`docs/specs/sige/02-institution.md`) INS-01…18 — profile, campuses, levels, courses, subjects, periods, criteria — and the root institution switcher via impersonation (OD-3).
- **Exit criterion (spec §8 P1):** admin builds sede → nivel → curso, subjects, 4 periods (exactly one active) and criteria (Σ warning at ≠ 100); deletes are blocked by dependents; the demo seed loads structure.
- **Scope:** `packages/sige-core`, `packages/db`, `packages/api`, `apps/server` (seed), `apps/web` for module 02 only. Out: INS-04/05 (need module 03 APIs, P2).
- **Branch:** `feat/sige-p1-institution`, stacked on `feat/sige-p0-foundation` (`de7b7ab`).
- **TDD:** on for sige-core/DB/API — source: project convention (`odd/tasks/auth-multitenant-rbac.md`, reused in P0) — runner: `bun test` (integration on `TEST_DATABASE_URL`, default `postgres://postgres:password@localhost:5438/sige_school_test`; prepare with `pnpm db:test:prepare`; requires `colima start && docker start sige-school-postgres`). Web: ordinary checks plus stories.
- **Checks per task:** focused `bun test` for touched packages, `pnpm check-types`, `pnpm lint`.
- **Delivery strategy:** ask-on-risk → `stacked-to-main` (cached from P0, user choice 2026-10-07). Forecast ≈ 5,000–6,000 authored lines (excluding generated migration snapshots); slices follow task boundaries, about 400 authored lines each. Push/PRs remain user decisions.
- **Review cadence:** one review per two tasks (T1+T2, T3+T4, …); first base = `de7b7ab`.

## Decisions (defaults chosen by the orchestrator, recorded for the user)

- D1 Deletes check only dependents that exist in P1 (campus → level/course, level → course); later modules add `restrict` FKs, which the shared FK-violation mapper turns into `HAS_DEPENDENTS`. No dependents registry.
- D2 `course.director_person_id` column ships nullable; the INS-12 director select is deferred to P2 (needs `user.options`, module 03).
- D3 INS-04/05 deferred to P2.
- D4 Demo usernames keep the P0 seed values (deviation from §9 already recorded in P0).
- D5 Impersonation lifetime 1 h accepted (OQ-INS-1).
- D6 Add `unique(organization_id, academic_year, order_num)` on `academic_period` (spec has no rule for duplicate order numbers; order 1..4 per year implies uniqueness).
- D7 `institutionAdmin.list` moves from `institution:update` to `institution:read` (platform statement exists; spec G-INS-1).

## Tasks

Server (TDD; delegated writer):

- [x] T1 — sige-core pure rules (`sumWeights`, `periodsOverlap`, weight/order/capacity validators) with spec §7.1 boundary tests; zod fragments `packages/api/src/sige/schemas/institution.ts` with §4.1 Spanish messages.
- [x] T2 — DB schema + migration: enums `jornada`, `course_shift`; tables `institution_profile`, `campus`, `grade_level`, `course`, `subject`, `academic_period`, `grade_criterion` (indexes, checks, partial uniques, composite FKs, D6); constraint tests.
- [x] T2-fix — Review warnings: optional `nit`/`email` must treat "" as absent; ISO date fields must be calendar-valid (reject 2026-02-31). Route: delegated with T3.
- [x] T3 — shared service helpers: pg 23503/23505 → `HAS_DEPENDENTS`/`CONFLICT` mapper by constraint name, audit-record helper (one event, before/after of changed fields), matrix harness accepts `HAS_DEPENDENTS` as "passed the gate".
- [x] T4 — `campus` and `level` routers: CRUD, one-main rule, campus immutability on level, delete blocks, audit; tenant-isolation and permission-matrix suites.
- [x] T4-fix — Review warnings: campus/level update and delete must check affected rows (`returning`) and return NOT_FOUND without auditing when a concurrent delete wins. Route: delegated with T5.
- [x] T5 — `subject` and `criterion` routers: unique code, `totalWeight`, no-op recompute port, `affectedFinals: 0`.
- [x] T6 — `period` router: CRUD, atomic `activate`, overlap check under `for update`, reject deactivating the only active period; concurrency test.
- [x] T6-fix — Review warnings: reject deleting the active period (keep exactly one active; lock like activate); deterministic academic year in the period tenant-isolation seed. Route: delegated with T7.
- [x] T7 — `course` router: list contract config, list/stats/options, level-in-campus rule, uniqueness.
- [ ] T8 — `institution` router (get/update/setLogo/removeLogo) + `FileStoragePort` with local adapter.
- [ ] T9 — `institutionAdmin` upgrade: profile insert in create, list contract, stats/get/update/delete/manage, D7.
- [ ] T10 — seed: demo structure (2 active + 1 inactive campus, 5 levels, 6 courses, 10 subjects, 4 periods with P4 active, criteria 20/20/30/30), idempotent.

Web (react-staff):

- [ ] T11 — tenant UI kit + nav: list-page shell, `ConfirmDelete`, `InstitutionBanner`, active-institution guard, `HAS_DEPENDENTS` error mapping, nav entries added with their routes.
- [ ] T12 — INS-06 profile + INS-07/08 campuses.
- [ ] T13 — INS-09/10 levels + INS-13/14 subjects.
- [ ] T14 — INS-15/16 periods + INS-17/18 criteria.
- [ ] T15 — INS-11/12 courses (URL-driven table; no director select, D2).
- [ ] T16 — INS-01/02 completion (KPIs, filters, detail, edit, delete, full form with logo) + INS-03 selector with impersonation.

## Progress

- Mapping done (delegated explorer). Branch created from `de7b7ab`.
- T1 done in 62b4987, T2 in faaa497 (delegated writer, ≈1,000 authored lines, mostly tests; migration `20261007232722_sige_institution` generated). TDD: RED observed (missing modules); GREEN sige-core 59, api `src/sige` 134, db 88 pass (integration ran on 5438, no skips); check-types/lint 0. Parent spot check: db institution integration 19 pass. Notes for T3: `ON DELETE RESTRICT` raises 23001 (restrict_violation), inserts raise 23503 — the mapper must handle both. Bounded columns are `varchar(n)`; year columns have a 4-digit check. NIT format and max-length messages are not in spec §4.1 (writer-authored).
- Review T1+T2 (de7b7ab..faaa497): 1 lens (reliability), approved and acknowledged. Warnings → T2-fix. Suggestion not taken: R3-default-drift (`current_academic_year` default emitted without `::text`). Next boundary: faaa497.
- T2-fix in 3ff07af, T3 in 9eac677, T4 in e838faf (delegated writer, +1,608/−18 incl. doc). T2-fix: blank optional nit/email treated as absent; calendar-valid dates. T3: `mapDbError`/`rethrowDbError` (`pg-errors.ts`: 23505→CONFLICT, 23001/23503 on delete→HAS_DEPENDENTS, 23503 on write→BAD_REQUEST/NOT_FOUND), `recordAudit` + `changedFields` (`audit.ts`), matrix counts HAS_DEPENDENTS as gate passed. T4: `campus` (list/get/create/update/delete/options) and `level` routers with tenant-isolation and permission-matrix suites. TDD: RED observed per task (5 schema fails; missing modules); GREEN api 452, sige-core 59, db 88 (no skips); check-types/lint 0. Parent spot check: campus/level/pg-errors 137 pass. Deviations: per-entity router files instead of one `institution.ts` (matches P0 layout); added `campus.options` (INS-R3); audit recorded after the mutation (AuditLogger uses its own connection, same as P0); writer-authored messages for period unique constraints and generic fallbacks.
- Review T3+T4 (faaa497..e838faf): 1 lens (reliability), approved and acknowledged. Warnings → T4-fix. Suggestions not taken: audit not atomic with the mutation (known, P0 pattern); update with `isMain: false` demotes the main campus (allowed by spec). Next boundary: e838faf.
- T4-fix in ede2cd5, T5 in 4e3938e (delegated writer; `racingDb` test seam, subject/criterion routers, no-op `gradeRecalculation` port, `affectedFinals: 0`). T6 in a336399 (resumed delegated writer, +918/−7): period list/get/create/update/delete/activate plus `summary` (new, backs the INS-R5 "{n} de 4 periodos" warning). Writes serialize per institution with `pg_advisory_xact_lock` and then read `for update` (addition to spec: row locks alone don't serialize the first concurrent create). `update`/`create` with `isActive: true` while another period is active → CONFLICT (the form calls `activate`). Writer-authored message: "El periodo no existe.". TDD: RED observed (missing `./period`); GREEN period 76, api 637 (no skips); check-types/lint 0. Parent spot check: period 76 pass.
- Review T5+T6 (e838faf..a336399, includes T4-fix): 1 lens (reliability), approved and acknowledged. Warnings → T6-fix (delete of the active period; flaky random-year seed). Next boundary: a336399.
- T6-fix in abd09fd: `period.delete` runs under the same lock (`lockPeriods`) and rejects the active period with BAD_REQUEST "No se puede eliminar el periodo activo. Active otro periodo primero." (writer-authored; spec has none); isolation seed uses a counter. RED observed (1 fail); race test (delete vs activate, 5 rounds) passed before the fix (regression guard only). T7 in bbc6aee (+967): course router reusing P0 `createListInput`/`buildListQuery` (`lib/course-list-config.ts`), list/stats/options/get/create/update/delete; level-in-campus composite FK → BAD_REQUEST "El nivel no pertenece a la sede seleccionada."; director audit as `{ director: { from, to } }`. Deferred until dependents exist: `studentCount` constant 0, active-teacher director check, INS-R6 campus immutability, course delete blocks (FK mapper covers them later). TDD: RED observed (missing `./course`); GREEN period 79, course 78, api 721 (no skips); check-types/lint 0. Parent spot check: course 78 pass. Review pending: T7 pairs with T8.
