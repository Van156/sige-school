# SIGE prototype — QA fixes

- **Objective:** fix the defects from the 2026-10-05 functional QA report of the deployed SIGE prototype.
- **Scope:** theme toggle, prototype tab title, per-field errors on empty password change, "Mis Notas" chart legend/ticks, "no encontrado" copy.
- **Out of scope:** data persistence and real downloads (CSV/Excel/PDF/carnet) — expected prototype limitations, already announced in-UI.
- **TDD:** off — source: `odd/tasks/sige-prototype.md` (prototype, no tests). Checks: `pnpm check-types`, `pnpm lint`.
- **Route:** T1 delegated to react-staff (writer trigger: 5 non-trivial TSX files).

## Tasks

- [x] T1 — Apply QA fixes
  - `ModeToggle` becomes a one-click light/dark toggle (was a dropdown whose trigger alone changed nothing); system choice stays in account preferences.
  - `/prototype/sige` sets tab title "SIGE" instead of the `Base Template` brand.
  - Force-password screen marks each empty field with an error on submit.
  - Student dashboard "Mis Notas" chart: legend for both series, uniform Y ticks over the 1.0–5.0 scale.
  - `NotFoundBlock` copy reads "Estudiante no encontrado".

## Progress

- T1 done in a08daaa (react-staff). `pnpm check-types` exit 0, `pnpm lint` exit 0 (parent spot check). Extra: `NotFoundBlock` gained `feminine` for gender agreement; `CategoryBarChart` gained optional `ticks`/`legend`. Review: high risk, consent auto-granted, reliability lens approved and acknowledged; 2 non-blocking advisories (force-password-screen.tsx:40 WARNING, student-dashboard.tsx:135 SUGGESTION). No browser run.
