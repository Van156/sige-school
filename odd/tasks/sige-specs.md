# SIGE — implementation specs from the prototype

- **Objective:** write the spec set to implement every SIGE feature for real (API, DB, web), using the clickable prototype as the source of truth.
- **Problem:** the prototype (`apps/web/src/routes/prototype/sige/**`, 94 screens, mock data) and its inventory (`odd/tasks/sige-prototype-inventory.md`) describe the product, but there is no implementation spec. There is no PRD; user decision 2026-10-07: base the specs on the prototype.
- **Scope:** documentation only, under `docs/specs/sige/` plus the `docs/README.md` index. No source code changes.
- **Constraints:** follow the existing spec format (`docs/specs/*.md`: status, date, stack, depends on, objective, scope, requirements with ids, decisions, acceptance). Build on the existing platform (better-auth orgs, RBAC, audit log, data table, frontend foundation) instead of re-specifying it. English prose; Spanish UI labels quoted verbatim.
- **TDD:** n/a (docs only). Checks: structural readback; `pnpm exec prettier --check docs/specs/sige` if prettier covers markdown.
- **Delivery strategy:** ask-on-risk (docs only; no source lines).

## Tasks

- [x] T1 — Roadmap and foundation spec: product overview, role mapping onto existing RBAC, institution ↔ organization mapping, domain model (entities, relations, grading scale), cross-cutting conventions, phased implementation order, module spec index, open decisions. Route: delegated (preparation trigger: inventory + 4+ existing specs/architecture docs).
- [x] T2 — Module specs 01–07 (`01-auth-and-dashboards` … `07-attendance`), built on T1. Route: delegated (writer trigger: 7 non-trivial files).
- [x] T3 — Module specs 08–14 (`08-observations` … `14-qr-access`), built on T1. Route: delegated (writer trigger: 7 non-trivial files).

- [x] T4 — Reconcile gaps reported by T2/T3 (G-* items) into `00-foundation.md`, `01-auth-and-dashboards.md` and `07-attendance.md`; genuine product forks become open decisions with a recommended default. Route: delegated (writer trigger: 3 non-trivial files).

## Progress

- Branch `docs/sige-specs` created from `main` (8b1c4bb).
- T1 done in d5eea4a (delegated writer): `docs/specs/sige/00-foundation.md` (§1–13, module index 01–14, phases P0–P10, 24 open decisions OD-1…OD-24 with recommended defaults, prototype-vs-inventory reconciliation). oxfmt clean (lefthook pre-commit passed). Module specs adopt the OD defaults until the user overrides them.
- T2 done in 1b438af (01–03) and fdadb00 (04–07), delegated writer; oxfmt check clean. 23 foundation gaps (G-AUTH/INS/USR/SCH/STU/GRD/ATT) and 15 module open questions recorded in each spec's §8.
- T3 done in cff02df (08–11) and e7f6cef (12–14), delegated writer; oxfmt check clean. New gaps G-RPT/QR/ALR/ACH/OBS/MET/PAR and open questions recorded in each spec's §8.
- Review T1+T2: group exceeded the lens context budget, so it was reviewed one commit at a time (policy). d5eea4a approved (passive) and acknowledged; 1b438af high (auth signal), 4-lens review approved and acknowledged; fdadb00 low, approved and acknowledged.
- T4 done in 6d57f30 (delegated writer): gaps folded into 00-foundation and modules (each gap tagged Resolved/Open decision/Noted); new OD-25…OD-29 (username algorithm, institution deletion rule, unlock semantics, group director attendance, observation edit rights); consolidated "Module open questions" table (39 rows) in §11. oxfmt check clean.
- Review T3+T4: group exceeded the lens context budget; per commit: cff02df low, approved and acknowledged; e7f6cef low, approved and acknowledged; 6d57f30 alone still exceeds the lens budget (single commit, cannot be split further), so native review is unavailable for it; structural readback done (OD-25…29 present, gap tags in every module, `parentPortal.attendanceCalendar` removed). 682344c (feature doc) not reviewed separately.
- Next step: user confirms or overrides the open decisions (§11 OD-1…OD-29 and module open questions); then implementation starts at phase P0. Branch not pushed.
- User decision 2026-10-07: accept every recommended default (OD-1…OD-29 and all module open questions). Specs marked Approved; §11 records the resolution.
