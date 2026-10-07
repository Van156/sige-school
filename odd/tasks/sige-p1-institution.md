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

- [ ] T1 — sige-core pure rules (`sumWeights`, `periodsOverlap`, weight/order/capacity validators) with spec §7.1 boundary tests; zod fragments `packages/api/src/sige/schemas/institution.ts` with §4.1 Spanish messages.
- [ ] T2 — DB schema + migration: enums `jornada`, `course_shift`; tables `institution_profile`, `campus`, `grade_level`, `course`, `subject`, `academic_period`, `grade_criterion` (indexes, checks, partial uniques, composite FKs, D6); constraint tests.
- [ ] T3 — shared service helpers: pg 23503/23505 → `HAS_DEPENDENTS`/`CONFLICT` mapper by constraint name, audit-record helper (one event, before/after of changed fields), matrix harness accepts `HAS_DEPENDENTS` as "passed the gate".
- [ ] T4 — `campus` and `level` routers: CRUD, one-main rule, campus immutability on level, delete blocks, audit; tenant-isolation and permission-matrix suites.
- [ ] T5 — `subject` and `criterion` routers: unique code, `totalWeight`, no-op recompute port, `affectedFinals: 0`.
- [ ] T6 — `period` router: CRUD, atomic `activate`, overlap check under `for update`, reject deactivating the only active period; concurrency test.
- [ ] T7 — `course` router: list contract config, list/stats/options, level-in-campus rule, uniqueness.
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
