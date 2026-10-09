# SIGE P3 — Academic offering & schedule

- **Objective:** deliver phase P3 of `docs/specs/sige/00-foundation.md` §8: module 04 (`docs/specs/sige/04-scheduling.md`) SCH-03…12 — offerings ("Materias por Grado"), teacher assignments, classrooms, time blocks, schedule generation and the weekly grid (manager/teacher/student views). SCH-01/02 (enrollment) belong to P4.
- **Exit criterion (spec §8 P3):** on the seed (≈ 58 offerings) generation yields 0 conflicts; DB and service tests make classroom and teacher double-booking impossible; a teacher sees only own slots.
- **Scope:** `packages/sige-core` (schedule rules + solver), `packages/db` (tables, migration, exclusion constraints), `packages/api` (routers, scope resolvers, pg-errors, seed), `apps/web` (`features/scheduling`, `shared/components/sige/weekly-schedule.tsx`, routes, nav).
- **Branch:** `feat/sige-p3-schedule` from local `main` (1d273d5, includes P0–P2).
- **TDD:** on for sige-core/DB/API — source: project convention (P0–P2) — runner: `bun test` (integration on `TEST_DATABASE_URL`, default `postgres://postgres:password@localhost:5438/sige_school_test`; `pnpm db:test:prepare`; requires `colima start && docker start sige-school-postgres`). Web: ordinary checks plus stories.
- **Checks per task:** focused `bun test`, `pnpm check-types`, `pnpm lint` (web adds `bun test tests`, `pnpm build-storybook`).
- **Delivery strategy:** `stacked-to-main` (cached). Integration into local `main` as one `--no-ff` merge commit per phase (user preference, 2026-10-09). Push/PRs remain user decisions (SSH access currently blocked).
- **Review cadence:** one review per two tasks; first base = `1d273d5`.
- **Commits:** Conventional Commits, no AI attribution trailers (user rule; check `git log --format=%(trailers)` after delegated writers).

## Decisions

- D1 (user, 2026-10-09) DB-level double-booking: `schedule_slot` carries denormalised `teacher_person_id` (nullable) and `course_id`, kept in sync with the offering; three GiST exclusion constraints (`btree_gist`) reject overlapping `[start,end)` on the same day and academic year for classroom, teacher (when not null) and course. Deviates from spec G-SCH-4 ("no schema change"); sync is safe because SCH-R3 refuses reassigning an offering that has slots. SQLSTATE 23P01 mapped to CONFLICT with the SCH-R9 messages.
- D2 (default) The `enrollment` table ships in P4 with module 05; `offering.delete` dependents refusals (enrollments, grades, attendance) come from restrict FKs added in P4/P5 via the shared mapper (P1 D1 pattern). In P3 `offering.delete` is refused only while slots exist.
- D3 (default) A teacher sees slots only for offerings whose assignment is `activo`/`temporal` (00 §4.3); `inactivo` removes them from the teacher view.
- D4 (default) Teacher grid rows = union of the non-break blocks over the campuses/shifts of the teacher's courses; course grid rows = its campus/shift blocks for the current year.
- D5 (default) `schedule_slot.is_active` is always written `true` in v1.
- D6 (default) Time block `academic_year` = institution current year at creation; no rollover in P3.
- D7 (default) Seed: 12 teachers via `provisionUser`, ≈ 15 classrooms and ≈ 14 blocks from the prototype mocks, an explicit offering list of 58 subject–course pairs (two pairs omitted, taken from the prototype data), then generation; seed test asserts 0 conflicts and idempotency.
- D8 (default) Routers split per entity (`classroom`, `time-block`, `offering`, `assignment`, `schedule`) as in P1, instead of one `scheduling.ts`.
- D9 (spec defaults) OQ-SCH-1 hours editable without moving slots; OQ-SCH-2 room-type name heuristic in core; OQ-SCH-3 `Sabatina` courses always skipped.

## Tasks

Server (TDD; delegated writer):

- [ ] T1 — sige-core: `timesOverlap`, `WeeklySchedule` types + `buildScheduleRows` (moved from the prototype), `preferredRoomType`, deterministic solver `generateSchedule` (port of prototype `school-actions.ts`), tests (determinism, no overlaps, busy sets, skipped courses); zod fragments `api/src/sige/schemas/scheduling.ts` with §4.1 messages.
- [ ] T2 — DB: enums + `offering`, `teacher_assignment`, `classroom`, `time_block`, `schedule_slot` (with D1 denormalised columns and exclusion constraints, `btree_gist`), constraint-name constants, generated migration + hand-written exclusion SQL, constraint tests.
- [ ] T3 — pg-errors (new uniques, dependents, 23P01) + ScopePolicy offering resolvers (teacher: own `activo`/`temporal`) wired in `procedure.ts`, scope tests.
- [ ] T4 — `classroom.*` and `timeBlock.*` routers: CRUD, stats, list config, overlap/in-use/campus rules, audit, matrix + isolation.
- [ ] T5 — `offering.*` (list/stats/createBulk/update/delete/options) and `assignment.*` (assign/update/delete, SCH-R3 sync, busy-teacher conflict), audit, matrix + isolation.
- [ ] T6 — `schedule.generate` (advisory lock, replace target courses, busy sets, persist, audit), `schedule.get` (course/teacher/student scoping), `schedule.deleteSlot`; overlap and concurrency tests; teacher sees only own slots; parent FORBIDDEN.
- [ ] T7 — seed extension (D7) + 0-conflict / idempotency tests.

Web (react-staff):

- [ ] T8 — `features/scheduling` scaffold + SCH-07/08 classrooms and SCH-09/10 time blocks (lists, forms, stories).
- [ ] T9 — SCH-05/06 offerings list, "Editar intensidad" dialog, bulk assign form.
- [ ] T10 — SCH-03/04 assignments list and forms.
- [ ] T11 — `shared/components/sige/weekly-schedule.tsx` + SCH-11 schedules (manager filter, teacher/student views, delete slot).
- [ ] T12 — SCH-12 generation (parameters, confirm replace, result, skipped list).
- [ ] T13 — nav/routes wiring, story registry, permission-hiding pass.

## Progress

- Mapping done (delegated explorer). Branch created from `1d273d5`. Permission catalog already complete for module 04 (no gaps). D1 chosen by the user.
