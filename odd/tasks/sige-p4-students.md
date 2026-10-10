# SIGE P4 — Students & enrollment

- **Objective:** deliver phase P4 of `docs/specs/sige/00-foundation.md` §8: module 05 (`docs/specs/sige/05-students.md`) STU-01…05 and module 04 SCH-01/02 (enrollment) — three admission paths (form, "complete profile", Excel), guardians, bulk enrollment.
- **Exit criterion (spec §8 P4):** students created via form, "complete profile" and Excel; guardians linked; bulk enrollment creates students × offerings once (idempotent); status changes remove students from active lists.
- **Scope:** `packages/sige-core` (import row rules, status transitions, enrollment planner), `packages/db` (student, student_guardian, enrollment, course unique), `packages/api` (routers `student`, `guardian`, `enrollment`; scope resolvers; pg-errors; import runner generalisation; seed), `apps/web` (`features/students`, enrollment screens, nav), plus P1–P3 deferrals listed below.
- **Branch:** `feat/sige-p4-students` from local `main` (c87a120, includes P0–P3).
- **TDD:** on for sige-core/DB/API — source: project convention (P0–P3) — runner: `bun test` (integration on `TEST_DATABASE_URL`, default `postgres://postgres:password@localhost:5438/sige_school_test`; `pnpm db:test:prepare`; requires `colima start && docker start sige-school-postgres`; run db and api suites sequentially — shared test DB). Web: ordinary checks plus stories.
- **Checks per task:** focused `bun test`, `pnpm check-types`, `pnpm lint` (web adds the FULL `cd apps/web && bun test`, `bun test ./tests`, `pnpm build-storybook`).
- **Delivery strategy:** `stacked-to-main` (cached from P3). Forecast ≈ 9,000 authored lines. Integration into local `main` as one `--no-ff` merge commit per phase after user approval. Push/PRs remain user decisions.
- **Review cadence:** one review per two tasks in the detached worktree `../sige-school-worktrees/p3-bb3e249` (detach to the candidate head); first base = `c87a120`. Generated drizzle snapshots go in their own commit and are not reviewed.
- **Models:** Sonnet weekly limit until 2026-10-13 22:00 (Bogotá); delegated writers run on Opus until then (user choice, 2026-10-10), then back to `sonnet`.
- **Commits:** Conventional Commits, no AI attribution trailers (check `git log --format=%(trailers)` after delegated writers).

## Decisions

- D1 (default) Path A atomicity: add an optional caller-transaction seam to `provisionUser` (`packages/auth/src/provision-user.ts`) so login, profile and enrollments commit together; if the seam proves invasive, fall back to the spec's STU-R2 compensation with a fault-injection test. Either way a failure leaves no orphan login.
- D2 (default) Teacher student scope = students whose current `student.course_id` is a course where the teacher has an `activo`/`temporal` offering assignment or is course director (not enrollment-based).
- D3 (default) Capacity "current" = active students with `course_id = course`; students already in the course are not counted twice when re-selected.
- D4 (default) Seed maps prototype courses onto the real seed courses: 1-01→3-01, 11-01→10-01, others by code; the graduado stays in 10-01; existing demo student Julián López (`jlopez0001`) becomes one of the 40; demo parent Patricia Gómez is linked as a guardian.
- D5 (default) Linking an inactive guardian person reuses STU-R6 "El usuario seleccionado no es un acudiente.".
- D6 (spec defaults) OQ-STU-1 no side effects on status change; OQ-STU-2 teachers see health fields.
- D7 (default) STU-02 action cards pointing to screens that do not exist yet (observations, grades, …) are hidden in P4.
- D8 (default) Routers split per entity (`student`, `guardian`, `enrollment`) as in P1–P3.

## P1–P3 deferrals closed in P4

- P3 D2: enrollment restrict FK; `offering.delete` refuses "La materia del grado tiene estudiantes matriculados." before the slots message.
- P3: `schedule.get` student default (omitted `courseId` → own course; no course → NOT_FOUND "Sin curso asignado"), teacher course view via director course; student "Mi Horario" nav (R1.27).
- P2 D8: USR-02 student create → STU-03 complete with toast "Usuario creado · completa su perfil académico."; USR-01 "Ver Perfil Académico" (`studentId`).
- P1: INS-R6 course campus immutable with students; campus/course delete blocks "La sede tiene estudiantes asociados." / "El grado tiene estudiantes asociados.".
- Placeholder `studentCount` zeros in course, institution and offering queries.
- Gates: `user.previewUsername` accepts `user:create | student:create`; teacher STU-01 course/campus filters need a scoped source (teachers lack `course:read`).

## Tasks

Server (TDD; delegated writer):

- [ ] T1 — sige-core: student import row validation (all STU-R8 messages, date formats, gender aliases, course/campus resolution, in-file duplicates), campus/course consistency, status transitions, bulk-enrollment planner (skip existing, capacity arithmetic); zod `api/src/sige/schemas/student.ts` and `enrollment.ts` with §4.1 messages.
- [ ] T2 — DB: enums `student_status`/`guardian_relationship`/`enrollment_status`, `course` unique `(org, campus, id)`, tables `student`, `student_guardian`, `enrollment` (composite restrict FKs, checks, indexes), constraint-name constants, generated migration (snapshot in its own commit), constraint tests.
- [ ] T3 — pg-errors (student/guardian/enrollment uniques and FKs; campus/course/offering/person delete messages) + scope resolvers (`studentWhere`, `studentVisible` per kind; student/parent `offeringWhere`), scope tests.
- [ ] T4 — `enrollment.*` (list/stats/get/candidates/createBulk/update/delete; SCH-R5 one transaction, idempotent, capacity override, `isStale`), audit, matrix + isolation; close P3 D2 in `offering.delete`.
- [ ] T5 — `student.*` part 1: list/listIncomplete/get/pick/create/complete/update/delete (D1 path A, STU-R3 enroll, STU-R4/R5/R7), audit, matrix + isolation; widen `previewUsername`.
- [ ] T6 — `guardian.*` (candidates/link/unlink) + Excel import (field-agnostic workbook reader, `student.importPreview`/`importStart`/`importTemplate` on the import-job runner).
- [ ] T7 — cross-module closure: `schedule.get` student default + director course, real `studentCount`, `user-queries` `studentId`, INS-R6 course campus lock, campus/course delete blocks.
- [ ] T8 — seed: 40 active + 1 retirado + 1 graduado (D4), ≈ 26 guardians and links, bulk enrollment per course, idempotency test.

Web (react-staff):

- [ ] T9 — `features/students` scaffold, shared components (`StudentStrip`, `StudentSwitcher`, `NoStudentBlock`, `GuardianCard`, `StatusBadge`) + stories, STU-01 list.
- [ ] T10 — STU-03 form (create / complete / edit) and STU-02 detail tabs (info, horario via `WeeklySchedule`, acudientes).
- [ ] T11 — STU-04 guardians and STU-05 import.
- [ ] T12 — SCH-01 enrollments list/stats/stale badge, SCH-02 bulk create with capacity confirm, edit.
- [ ] T13 — nav/permission pass: Estudiantes, Matrículas, student "Mi Horario"; USR-02 → STU-03 redirect; USR-01 "Ver Perfil Académico"; action-permission test; story registry.

## Progress

- Mapping done (delegated explorer, Opus). Permission catalog and audit actions already complete for modules 04/05. `exceljs` already a dependency; `import_kind` already has `students`. Branch created from `c87a120`.
