# Feature: SIGE School full-system prototype

- **Source:** user request 2026-10-04 — "create a prototype using the prototype lab based on SISTEMA_ESCOLAR of all screens in this system but adapted to the system design".
- **Branch:** `prototype/sige-school` from `main` (`2b42e69`). Throwaway per `apps/web/src/routes/prototype/README.md`: never merged into `main`.
- **Delivery:** strategy `exception-ok` — throwaway prototype branch, no PRs, no slicing. Forecast ~8k–12k authored lines (mock UI).
- **TDD:** off — source: prototype skill rule "no tests" + project convention (TDD only for server/auth/API). Checks: `pnpm check-types`, `pnpm lint`.
- **Review (RDD):** on (global); user policy: review every two tasks, auto-consent. Groups: T1+T2, T3+T4, T5 alone. First boundary: `2b42e69`.
- **Legacy inventory:** `odd/tasks/sige-prototype-inventory.md` (generated from `../SISTEMA_ESCOLAR`).

## Objective

A clickable, login-free prototype of every SISTEMA_ESCOLAR screen (~100 Jinja templates), rebuilt with `@base-template/ui` and the institutional design system (design-refresh tokens, IBM Plex, compact density, ink sidebar), backed by in-memory mock data, to judge the whole product in the new design before specifying the real modules.

## Decisions

- One design-system adaptation per legacy screen (not 3 variants per screen): the question is "how does the whole system look in our design system", not a layout comparison.
- Lives at `/prototype/sige/*` with its own app shell mirroring the real authenticated shell (sidebar per role, header, breadcrumbs) and a role switcher (root, admin, coordinator, teacher, parent, student, viewer) instead of auth.
- UI copy in Spanish to match the legacy product; code and identifiers in English.
- Actions are local stubs (toast / in-memory state); no oRPC, no auth, no DB.

## Constraints

- Only `@base-template/ui` components + Tailwind tokens; no new deps unless already in the workspace (charts via `chart.tsx`/recharts).
- Files prefixed `-` inside `routes/prototype/` are ignored by the router; route files stay thin.
- Prototype rules: no tests, minimal error handling, no persistence.

## Tasks

- [x] **T1 — Shell, mock data, auth & dashboards.** `/prototype/sige` layout with role switcher + role nav, shared mock dataset, login / force-password-change / error pages, profile, the 7 role dashboards; register in lab catalog. Route: delegated (react-staff) — writer trigger (many non-trivial files).
- [ ] **T2 — Institution & users.** Institutions, campuses, grade levels, grades/groups, subjects, periods, criteria, config, institution users/admins, users list/create/edit/import. Route: delegated (react-staff).
- [ ] **T3 — Students & scheduling.** Students list/form/profile/upload/assign parent; classrooms, blocks, subject-grades, assignments, enrollments, schedules generate/list. Route: delegated (react-staff).
- [ ] **T4 — Grades, report cards, attendance.** Grade select/input/upload/lock/summary/student/final/annual; report cards generate/manage/history/view/PDF; attendance take/summary/group/report. Route: delegated (react-staff).
- [ ] **T5 — Observations, alerts, achievements, metrics, QR, parent portal.** Route: delegated (react-staff).

## Acceptance criteria

- Every legacy template (except `macros/`) has a reachable prototype screen, listed in a screen index.
- Navigation per role mirrors the legacy menu; switching role changes nav and dashboard.
- Light and dark mode render correctly; layout works at phone width.
- `pnpm check-types` and `pnpm lint` pass.

## Progress

- 2026-10-04: branch created; legacy inventory written (1,462 lines). It lists 94 screens in 15 modules: AUTH 5, DASH 7, INS 18, USR 4, SCH 12, STU 5, GRD 8, ATT 4, OBS 5, RPT 4, MET 7, ACH 3, ALR 3, PAR 6, QR 3. It also covers 7 roles and 9 legacy quirks, with fixes in 5.16.
- T1 delegated to react-staff (writer trigger). Shell, mock data, auth/error/profile, 7 dashboards, screen index and pending placeholder built; `recharts` added to apps/web (peer of `@base-template/ui` chart). Checks: `pnpm check-types` exit 0, `pnpm lint` exit 0.

## Next step

T2 — Institution & users (delegated, react-staff); then review group T1+T2.
