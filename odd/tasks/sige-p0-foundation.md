# SIGE P0 — Foundation

- **Objective:** deliver phase P0 of `docs/specs/sige/00-foundation.md` §8: SIGE core package, roles and permission catalog, `person` + username sign-in, user provisioning, `sigeProcedure` + `ScopePolicy`, forced password change, minimal institution creation (INS-02), Spanish shell with role nav, audit actions, tenant-isolation and permission-matrix harnesses, seed skeleton.
- **Exit criterion (spec §8 P0):** root creates an institution and its rector; the rector signs in with username + document number, is forced to AUTH-03, then lands on DASH-02 with the correct sidebar; harnesses run green with one pilot router.
- **Specs:** `docs/specs/sige/00-foundation.md` (§4 platform mapping, §5 domain, §6 conventions), `docs/specs/sige/01-auth-and-dashboards.md`, `docs/specs/sige/02-institution.md` (INS-02), `docs/specs/sige/03-users.md` (provisioning). All open decisions follow their recommended defaults (user decision 2026-10-07).
- **Scope:** `packages/*`, `apps/server`, `apps/web` as needed for P0 only. P1+ screens stay out.
- **TDD:** on for server/auth/API/DB — source: project convention set by user choice in `odd/tasks/auth-multitenant-rbac.md` (2026-09-26) and reused by later features — runner: `bun test` (integration tests use the test DB via `TEST_DATABASE_URL`, prepare with `pnpm db:test:prepare`). Web UI: ordinary checks plus stories.
- **Checks per task:** focused `bun test` for touched packages, `pnpm check-types`, `pnpm lint`.
- **Delivery strategy:** ask-on-risk → chain strategy `stacked-to-main` (user choice 2026-10-07). Forecast ≈ 2,500–3,500 authored lines. Slices (commits per PR): S1 = T1 (`56a86ee`, `5a03919`); next slices follow task boundaries, about 400 authored lines each. Push/PRs remain user decisions.
- **Review cadence:** per user policy, one review per two tasks (T1+T2, T3+T4, T5+T6), base = last reviewed boundary (`5271e56` first).

## Tasks

- [x] T1 — `packages/sige-core` skeleton; SIGE roles and permission catalog (§4.2) wired into the existing access-control; SIGE audit action registry (§6.9). TDD. Route: delegated (writer, 2+ non-trivial files).
- [x] T2 — `person` table + migration (§5.2); better-auth `username` plugin; `provisionUser` service (username rule R1.19/OD-25, placeholder email OD-1, initial password OD-2, `must_change_password`). TDD. Route: delegated.
- [ ] T3 — `sigeProcedure` + `ScopePolicy` (§4 scope resolver); tenant-isolation and permission-matrix test harnesses with one pilot router. TDD. Route: delegated.
- [ ] T4 — forced-password-change gate (server + AUTH-03 page) and minimal institution creation INS-02 for root (creates org + rector via `provisionUser`). TDD server; web via react-staff. Route: delegated.
- [ ] T5 — Spanish SIGE shell with role-based sidebar (§1.2 nav, OD-19) and DASH-02 landing placeholder. Route: delegated (react-staff).
- [ ] T6 — seed skeleton (root, demo institution, rector) and P0 exit-criterion end-to-end check. Route: delegated.

## Progress

- Specs merged to `main` (fast-forward to `5271e56`); branch `feat/sige-p0-foundation` created from it.
- T1 done in 5a03919 (delegated writer, +754/−9). TDD: RED observed (sige-core missing module; auth 12 fails), GREEN: sige-core 18 pass; auth 142 pass/46 skip (integration skipped: no TEST_DATABASE_URL); api 78 pass/10 skip; web access-control 43 pass; check-types and lint exit 0. Parent spot check: `bun test` in packages/sige-core green. Decisions: catalog data in dependency-free `sige-core`, roles registered in `auth/permissions/org.ts`; new roles hold only SIGE grants. Note: owner/admin lack `portal`/`metric:read_own`, so the web no-escalation check hides teacher/student/parent from the org roles UI; provisioning assigns roles server-side (T2/T4). Spanish audit labels deferred to a UI task.
- Environment: Docker (colima) was stopped; started. Test DB default `localhost:5436` belongs to another project's container (`base-template-postgres`); SIGE tests must use the `sige-school-postgres` container: `TEST_DATABASE_URL=postgres://postgres:password@localhost:5438/sige_school_test`.
- T2 done in 64e892c (delegated writer; +2938/−4 incl. ~2,070-line generated migration snapshot) plus follow-ups 659e828, 999d595, a3ad6b7. TDD: RED observed (missing modules), GREEN: sige-core 28, auth 306, db 69, api 141 pass; integration tests ran against 5438 with no skips; check-types and lint exit 0. Parent spot check found a flaky concurrency test (2 of 4 runs failed): root cause was a real race (placeholder email collision classified as EMAIL_TAKEN instead of a username collision); fixed in 659e828 with a deterministic test; 5/5 parent reruns green. 999d595 restores mid-transaction rollback coverage (trigger: impossible `birthDate` "2020-02-31" rejected by Postgres at the person insert). Follow-up for module 03: validate impossible calendar dates as VALIDATION, then move the rollback test to another trigger. a3ad6b7 changes the default test DB to `5438/sige_school_test` (the old default `5436/base_template_test` was another project's container).
- Seams for T3/T4: caller rules (who may create owner/admin) belong to the calling procedure; `/change-password` hook clearing `must_change_password`, sign-in `last_login_at` hook and the `is_active = false` sign-in block are not built yet (T4); seed passes `mustChangePassword: false` (T6).
