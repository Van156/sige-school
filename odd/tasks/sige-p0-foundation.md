# SIGE P0 — Foundation

- **Objective:** deliver phase P0 of `docs/specs/sige/00-foundation.md` §8: SIGE core package, roles and permission catalog, `person` + username sign-in, user provisioning, `sigeProcedure` + `ScopePolicy`, forced password change, minimal institution creation (INS-02), Spanish shell with role nav, audit actions, tenant-isolation and permission-matrix harnesses, seed skeleton.
- **Exit criterion (spec §8 P0):** root creates an institution and its rector; the rector signs in with username + document number, is forced to AUTH-03, then lands on DASH-02 with the correct sidebar; harnesses run green with one pilot router.
- **Specs:** `docs/specs/sige/00-foundation.md` (§4 platform mapping, §5 domain, §6 conventions), `docs/specs/sige/01-auth-and-dashboards.md`, `docs/specs/sige/02-institution.md` (INS-02), `docs/specs/sige/03-users.md` (provisioning). All open decisions follow their recommended defaults (user decision 2026-10-07).
- **Scope:** `packages/*`, `apps/server`, `apps/web` as needed for P0 only. P1+ screens stay out.
- **TDD:** on for server/auth/API/DB — source: project convention set by user choice in `odd/tasks/auth-multitenant-rbac.md` (2026-09-26) and reused by later features — runner: `bun test` (integration tests use the test DB via `TEST_DATABASE_URL`, prepare with `pnpm db:test:prepare`). Web UI: ordinary checks plus stories.
- **Checks per task:** focused `bun test` for touched packages, `pnpm check-types`, `pnpm lint`.
- **Delivery strategy:** ask-on-risk; forecast ≈ 2,500–3,500 authored lines across 6 tasks, so chained PR slices will be needed (strategy asked before the slice boundary).
- **Review cadence:** per user policy, one review per two tasks (T1+T2, T3+T4, T5+T6), base = last reviewed boundary (`5271e56` first).

## Tasks

- [ ] T1 — `packages/sige-core` skeleton; SIGE roles and permission catalog (§4.2) wired into the existing access-control; SIGE audit action registry (§6.9). TDD. Route: delegated (writer, 2+ non-trivial files).
- [ ] T2 — `person` table + migration (§5.2); better-auth `username` plugin; `provisionUser` service (username rule R1.19/OD-25, placeholder email OD-1, initial password OD-2, `must_change_password`). TDD. Route: delegated.
- [ ] T3 — `sigeProcedure` + `ScopePolicy` (§4 scope resolver); tenant-isolation and permission-matrix test harnesses with one pilot router. TDD. Route: delegated.
- [ ] T4 — forced-password-change gate (server + AUTH-03 page) and minimal institution creation INS-02 for root (creates org + rector via `provisionUser`). TDD server; web via react-staff. Route: delegated.
- [ ] T5 — Spanish SIGE shell with role-based sidebar (§1.2 nav, OD-19) and DASH-02 landing placeholder. Route: delegated (react-staff).
- [ ] T6 — seed skeleton (root, demo institution, rector) and P0 exit-criterion end-to-end check. Route: delegated.

## Progress

- Specs merged to `main` (fast-forward to `5271e56`); branch `feat/sige-p0-foundation` created from it.
