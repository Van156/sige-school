# SIGE — implementation specs from the prototype

- **Objective:** write the spec set to implement every SIGE feature for real (API, DB, web), using the clickable prototype as the source of truth.
- **Problem:** the prototype (`apps/web/src/routes/prototype/sige/**`, 94 screens, mock data) and its inventory (`odd/tasks/sige-prototype-inventory.md`) describe the product, but there is no implementation spec. There is no PRD; user decision 2026-10-07: base the specs on the prototype.
- **Scope:** documentation only, under `docs/specs/sige/` plus the `docs/README.md` index. No source code changes.
- **Constraints:** follow the existing spec format (`docs/specs/*.md`: status, date, stack, depends on, objective, scope, requirements with ids, decisions, acceptance). Build on the existing platform (better-auth orgs, RBAC, audit log, data table, frontend foundation) instead of re-specifying it. English prose; Spanish UI labels quoted verbatim.
- **TDD:** n/a (docs only). Checks: structural readback; `pnpm exec prettier --check docs/specs/sige` if prettier covers markdown.
- **Delivery strategy:** ask-on-risk (docs only; no source lines).

## Tasks

- [x] T1 — Roadmap and foundation spec: product overview, role mapping onto existing RBAC, institution ↔ organization mapping, domain model (entities, relations, grading scale), cross-cutting conventions, phased implementation order, module spec index, open decisions. Route: delegated (preparation trigger: inventory + 4+ existing specs/architecture docs).
- [ ] T2 — Module specs 01–07 (`01-auth-and-dashboards` … `07-attendance`), built on T1. Route: delegated (writer trigger: 7 non-trivial files).
- [ ] T3 — Module specs 08–14 (`08-observations` … `14-qr-access`), built on T1. Route: delegated (writer trigger: 7 non-trivial files).

## Progress

- Branch `docs/sige-specs` created from `main` (8b1c4bb).
- T1 done in d5eea4a (delegated writer): `docs/specs/sige/00-foundation.md` (§1–13, module index 01–14, phases P0–P10, 24 open decisions OD-1…OD-24 with recommended defaults, prototype-vs-inventory reconciliation). oxfmt clean (lefthook pre-commit passed). Module specs adopt the OD defaults until the user overrides them.
