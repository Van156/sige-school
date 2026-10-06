# SIGE prototype — back button on the left

- **Objective:** move every "Volver" / back navigation control in the SIGE prototype to the left side of the page header (above/before the title), out of the right-aligned actions slot.
- **Problem:** back buttons are passed through `actions` of `SigePageHeader` / `ScopedPage` / `ParentFrame`, which render right-aligned, against the common left-side back convention.
- **Scope:** `apps/web/src/routes/prototype/sige/**` only — add a `back` slot to the page header and its wrappers, migrate all screens using `BackButton` (or equivalent "Volver" links) in header actions.
- **Out of scope:** in-body CTAs (error screen, risk-students empty state, screen index link), form "Cancelar" buttons.
- **TDD:** off — source: `odd/tasks/sige-prototype.md` (prototype, no tests). Checks: `pnpm check-types`, `pnpm lint`.
- **Route:** T1 delegated to react-staff (writer trigger: ~30 TSX files).

## Tasks

- [ ] T1 — Add left `back` slot to the page header and migrate all screens

## Progress

- Pending.
