# SIGE P2 — Users

- **Objective:** deliver phase P2 of `docs/specs/sige/00-foundation.md` §8: module 03 (`docs/specs/sige/03-users.md`) USR-01…04, INS-04/05 (deferred from P1), Excel user import, password reset, deactivation; plus the P1 deferrals that need `user.options` (course director select, D2).
- **Exit criterion (spec §8 P2):** admin creates one user per role; importing a 100-row file reports row errors; a deactivated user cannot sign in; reset re-arms the forced change; every action is in the activity log.
- **Scope:** `packages/sige-core`, `packages/db`, `packages/auth` (only where needed), `packages/api`, `apps/server` (import restart sweep, seed), `apps/web` (`features/users`, INS-04/05, course director select).
- **Branch:** `feat/sige-p2-users`, stacked on `feat/sige-p1-institution` (`665619c`).
- **TDD:** on for sige-core/DB/API — source: project convention (P0/P1) — runner: `bun test` (integration on `TEST_DATABASE_URL`, default `postgres://postgres:password@localhost:5438/sige_school_test`; `pnpm db:test:prepare`; requires `colima start && docker start sige-school-postgres`). Web: ordinary checks plus stories.
- **Checks per task:** focused `bun test`, `pnpm check-types`, `pnpm lint` (web adds `pnpm build-storybook`).
- **Delivery strategy:** `stacked-to-main` (cached from P0/P1). Forecast ≈ 9,000–11,000 authored lines incl. tests/stories. Push/PRs remain user decisions.
- **Review cadence:** one review per two tasks; first base = `665619c`. Combined ranges over the lens budget are reviewed per task (intermediate slices in a detached worktree under `../sige-school-worktrees/`).

## Decisions (defaults chosen by the orchestrator, recorded for the user)

- D1 Document minimum: "al menos 5 caracteres" (alphanumeric; passports have letters), matching `provisionUser`.
- D2 Editing the document number does not change the existing password; `user.updated` records before/after.
- D3 Role filter matches `member.role` by token (comma-separated multi-role); `admin` filter matches owner and admin.
- D4 `UserDetail.studentId` is `null` until module 05.
- D5 `user.delete` dependents rely on `restrict` FKs + the shared mapper with role-specific messages (P1 D1 pattern).
- D6 Self-protection and last-active-owner rules live in the shared service, so platform and import paths obey them too.
- D7 Import runs as an in-process background job (OQ-USR-2 default); restart sweep marks running jobs failed at server start; concurrent-job guard is DB-enforced (partial unique index or advisory lock).
- D8 INS-05/USR-02 student creation: STU-03 does not exist yet → toast and return to the list; the "complete profile" link stays hidden until P4/module 05.
- D9 Course director select (INS-12) is admin-only in P2 (coordinator lacks `course:update`); director must be an active teacher, validated in the course router.
- D10 Password reset and deactivation revoke sessions in the same transaction as the write (delete from `session` by `userId`).
- D11 Import role aliases exclude `admin`/`owner`; role-escalation checks live in the shared service.

## Tasks

Server (TDD; delegated writer):

- [x] T1 — sige-core pure rules (`user-import.ts`: header normalisation, row validation, role aliases, duplicate-in-file, every USR-R11 message) + zod fragments `packages/api/src/sige/schemas/user.ts` (§4.1 messages).
- [x] T2 — DB: `import_job` table + `import_kind`/`import_status` enums, index, running-job uniqueness (D7), migration, constraint tests.
- [ ] T2-fix — Review warnings: `cellText` must read exceljs hyperlink/rich-text/formula-result cells and reject non-integer or unsafe numbers instead of emitting `1e+21`/`12.5`; normalise email before validating; birthDate "not future" compared in the institution timezone (America/Bogota), not UTC. Route: delegated with T3.
- [ ] T3 — user read side: `lib/user-list-config.ts` (role token filter, multi-column name filter), `user.list/stats/get/options/previewUsername/checkEmail` (rate limit), tenant-isolation + permission-matrix suites.
- [ ] T4 — user create/update/setActive/delete: shared user service, USR-R3/R4/R6/R7/R8 rules, session revocation, pg-errors additions, audit, last-owner race test.
- [ ] T5 — `user.resetPassword` (document/custom), forced-change re-arm, session revocation, sign-in blocked for inactive users, no secrets in audit metadata.
- [ ] T6 — `platformUser.*` (list/stats/create/setActive/resetPassword/previewUsername) over shared services; admin allowed, second owner never; superadmin actor in audit.
- [ ] T7 — import: xlsx parser (size/rows/zip-bomb guards), `importPreview`, `importTemplate`, `importStart`, `importJob.get`, background job (concurrency 4, progress every 25), concurrent-job CONFLICT, restart sweep in `apps/server`.
- [ ] T8 — seed through the shared path, repo guard test for raw user/member/person inserts (USR-R1), `import_job` 30-day purge.

Web (react-staff):

- [ ] T9 — `features/users` kit (`UserCell`, `RoleBadge`, `RoleSelect`) + USR-01 list, delete flow, nav, route.
- [ ] T10 — USR-02/03 forms (live username preview, email check, student redirect per D8), side card, `ResetPasswordDialog`.
- [ ] T11 — USR-04 import (upload, preview, progress polling, result callout, error list, template download).
- [ ] T12 — INS-04/05 pages (platform users of an institution), "Editar" via impersonation, INS-02 `previewUsername` preview.
- [ ] T13 — course director select (INS-12) via `user.options`; drop the resend-current-director workaround (P1 T15).

## Progress

- Mapping done (delegated explorer). Branch created from `665619c`.
- T1 in b6c1047 (+1038): `sige-core/src/user-import.ts` (headers + aliases, role tokens without admin/owner, `validateImportRows` with "Fila {n}: " messages, in-file duplicates flag the later row, `MAX_IMPORT_ERRORS = 200`) and `api/src/sige/schemas/user.ts` (create/edit/update/setActive/resetPassword/options/previewUsername/checkEmail). T2 in 207b554: `import_job` + enums, migration `20261008234529_sige_import_job` (generated), D7 = partial unique index `import_job_organizationId_kind_running_unique` (status = 'running') → 23505 for the concurrent-import CONFLICT; composite restrict FK to person (raises 23001); added `created_at` (spec omits it). Writer-authored messages listed in the writer report (missing role, invalid document, length limits, duplicate email in file). TDD: RED observed; GREEN sige-core 144, api sige 218, db 101; check-types/lint 0. Parent spot check: user-import 85, import-job 13 pass.
- Review T1+T2 (665619c..207b554): medium, 1 lens (reliability), approved and acknowledged. Warnings + suggestion → T2-fix. Next boundary: 207b554.
