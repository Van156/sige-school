# SIGE prototype — back button on the left

- **Objective:** move every "Volver" / back navigation control in the SIGE prototype to the left side of the page header (above/before the title), out of the right-aligned actions slot.
- **Problem:** back buttons are passed through `actions` of `SigePageHeader` / `ScopedPage` / `ParentFrame`, which render right-aligned, against the common left-side back convention.
- **Scope:** `apps/web/src/routes/prototype/sige/**` only — add a `back` slot to the page header and its wrappers, migrate all screens using `BackButton` (or equivalent "Volver" links) in header actions.
- **Scope note:** `StudentStrip` (student attendance/grades/achievements) also gained a `back` slot.
- **Out of scope:** in-body CTAs (error screen, risk-students empty state, screen index link), form "Cancelar" buttons.
- **TDD:** off — source: `odd/tasks/sige-prototype.md` (prototype, no tests). Checks: `pnpm check-types`, `pnpm lint`.
- **Route:** T1 delegated to react-staff (writer trigger: ~30 TSX files).

## Tasks

- [x] T1 — Add left `back` slot to the page header and migrate all screens

## Progress

- T1 done in 0f020fd (react-staff). `pnpm check-types` exit 0, `pnpm lint` exit 0 (parent spot check). `back` slot on `SigePageHeader`, `ScreenPage`/`ScopedPage`, `ParentFrame`, `StudentStrip`; `BackButton` is now ghost/sm; `MetricsActions` split into `MetricsBack` + `MetricsActions`. Review: medium risk (under budget, reviewed as final odd task), consent auto-granted, reliability lens approved and acknowledged; advisories R3-001/R3-002 (possible unused `ScreenLinkButton` import) are false positives — imports still used; R3-003 back row is `print:hidden`, intended. No browser run.
