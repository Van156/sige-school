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
- D9 (writer default, T1) Status transitions: activo→retirado/graduado, retirado→activo, graduado→activo (correct a mistaken graduation); retirado↔graduado refused; same status always allowed. Import with `grado` existing only in another campus → "El grado no pertenece a la sede seleccionada.".
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

- [x] T1 — sige-core: student import row validation (all STU-R8 messages, date formats, gender aliases, course/campus resolution, in-file duplicates), campus/course consistency, status transitions, bulk-enrollment planner (skip existing, capacity arithmetic); zod `api/src/sige/schemas/student.ts` and `enrollment.ts` with §4.1 messages.
- [x] T2 — DB: enums `student_status`/`guardian_relationship`/`enrollment_status`, `course` unique `(org, campus, id)`, tables `student`, `student_guardian`, `enrollment` (composite restrict FKs, checks, indexes), constraint-name constants, generated migration (snapshot in its own commit), constraint tests.
- [x] T3 — pg-errors (student/guardian/enrollment uniques and FKs; campus/course/offering/person delete messages) + scope resolvers (`studentWhere`, `studentVisible` per kind; student/parent `offeringWhere`), scope tests.
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
- T1 in 2b0e091 (+1190/−4) + 505f5e0 (+424/−3): sige-core `student.ts` (document types TI/RC/CC default TI, statuses, relationships, `checkCourseCampus`, `courseAfterCampusChange`, `canChangeStudentStatus`), `student-import.ts` (16 columns, header aliases, `parseImportBirthDate` 3 formats, gender aliases, `validateStudentImportRows` with ctx of active campuses/current-year courses/existing documents), `enrollment.ts` (`planBulkEnrollment` refusal order no_students → inactive_student → no_offerings → over_capacity, D3 capacity, `isStale`, `isValidFinalScore`, max 200); api schemas `student.ts`/`enrollment.ts` (P2 user field fragments exported for reuse; `readCell`/`ImportCell` exported). Authored: "No se puede cambiar el estado de "{from}" a "{to}".", "Solo se pueden matricular estudiantes activos.", "Fila n: Fecha de nacimiento inválida "{x}".", "Fila n: La columna "{col}" no puede superar {n} caracteres.", "Seleccione como máximo 200 estudiantes.", "Debes seleccionar un parentesco.". Open for T5: blank optional fields on edit become `undefined` (P2 precedent) — decide whether that clears to null. TDD: RED observed (5 files, missing modules); GREEN sige-core 257, api schemas 123; check-types/lint 0. Parent spot check: both suites re-run, no trailers. Route: delegated writer (Opus).
- T2 in 164d415 (+795/−1) + snapshot f16f34b (generated, +6262, not reviewed): migration `20261010134644_sige_students` (all drizzle-generated); enums built from the sige-core constants (`packages/db` now depends on `@base-template/sige-core`); `course` unique `(org, campus, id)` (`COURSE_CAMPUS_ID_UNIQUE`); `student` (`STUDENT_PERSON_UNIQUE`, `STUDENT_PERSON_FK`, `STUDENT_CAMPUS_FK`, `STUDENT_COURSE_CAMPUS_FK` (org, campus, course) restrict, stratum and enrolled-year checks); `student_guardian` (`GUARDIAN_LINK_UNIQUE`, `GUARDIAN_STUDENT_FK` cascade, `GUARDIAN_PERSON_FK` restrict); `enrollment` in `scheduling.ts` (`ENROLLMENT_UNIQUE` incl. org, student/offering FKs restrict — closes P3 D2 at DB level, final_score 1–5, status_note ≤ 500 text check, year check). The course FK has no ON UPDATE, so a course campus change with students is refused by the DB (INS-R6; T7 adds the message). TDD: RED = missing module (not 42P01); GREEN db 174, api 1514; check-types/lint 0. Flake: P3 `scheduling.integration.test.ts` teacher_assignment test reads unscoped rows (failed once, 5 clean reruns) → fix in T3. Parent spot check: db 174/0, no trailers. Route: delegated writer (Opus).
- Review T1+T2 (c87a120..164d415, 2468 lines, snapshot excluded): medium, 1 lens (reliability), worktree, approved with no correction and acknowledged (review-d062177db2088b68). Next boundary: f16f34b.
- T3 in 5812d1e (+9/−2, P3 flake fix: teacher_assignment reads scoped to orgA) + d44b30a (+190/−3) + f092015 (+430/−19): pg-errors — new 23514 branch → BAD_REQUEST (stratum, final_score, status_note; year checks unmapped = service bug), uniques (student person → "Ya existe un estudiante con este documento.", guardian link, enrollment → authored "El estudiante ya está matriculado en esta materia."), write FKs (course/campus mismatch, campus/student/offering not found, guardian person → STU-R6), delete dependents (offering/campus/course/student STU-R7, person via new `USER_DEPENDENTS_BY_FK` checked before the role lookup); exported `OFFERING_HAS_ENROLLMENTS_MESSAGE`, `CAMPUS_HAS_STUDENTS_MESSAGE`, `COURSE_HAS_STUDENTS_MESSAGE`, `STUDENT_HAS_RECORDS_MESSAGE`. Scope — correlated `exists` predicates: teacher `studentWhere` per D2 (director adds students, not offerings), student self + own-course offerings, parent linked children + their courses' offerings, managers unrestricted; no status filter (lists add it); `docs/architecture/authorization.md` updated. Authored: "El usuario no existe.", "El estudiante no existe.", "La materia del grado no existe." (FK writes), "El estudiante ya está matriculado en esta materia.". Carry-overs: T7 must pre-check students before a course campus change (the FK write maps to the mismatch message); T4 `offering.delete` and T7 campus/course deletes need pre-checks in spec order (Postgres FK order not guaranteed); later modules add their FKs to STU-R7. TDD: RED observed (pg-errors constants, 5 unit, 7/8 integration); flake fix is regression-only. GREEN db 174, api 1554; check-types/lint 0. Parent spot check: pg-errors + scope suites 108/0, no trailers. Route: delegated writer (Opus).
