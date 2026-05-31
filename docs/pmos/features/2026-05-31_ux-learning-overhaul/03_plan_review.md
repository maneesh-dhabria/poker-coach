# Plan Review — ux-learning-overhaul (sidecar)

## Loop 1 — self-review (structural + design)

### Structural checklist
1. **Every FR mapped to a task?** Yes — all 43 FRs (FR-01..72) verified present in `03_plan.md` (grep check, 0 missing). G1–G8 trace through the wave phases.
2. **Inline verification w/ exact commands?** Yes — every task has an Inline verification block with `npm test -- <path>` + expected outcome.
3. **TDD red/green in code tasks?** Yes — all code-producing tasks (T1,T2,T4–T19) use write-failing-test → fail → implement → pass → commit. T3 is css-only (declared exception, no behavior change).
4. **Exact file paths?** Yes — every task lists Create/Modify/Test files; File Map indexes them.
5. **Exact commands w/ expected output?** Yes.
6. **No placeholder language?** Yes — illustrative test code is real (FR-103); no TBD/TODO.
7. **Type consistency across tasks?** Checked — `Bankroll`/`MoneyUnit`/`TabKey`/`toAct`/`winners` names are consistent across T4/T6/T9/T12.
8. **TN concrete + complete?** Yes — lint/type/test, core-purity grep, no-LLM grep, FR-72 money sweep, Playwright no-scroll + smoke (hard-reload + error-path), UX polish, wireframe diff, Done-when walkthrough, cleanup.
9. **Verification proves behavior?** Yes — reducer/formatter/eval tests assert values; route tests round-trip; component tests assert rendered output, not just "renders".
10. **Wireframe linkage?** Every UI task cites `**Wireframe refs:**`; non-UI core tasks omit it correctly. Both wireframes (01_setup, 02_play-screen) referenced.
11. **TN polish coverage?** Hard-reload, error-path, UX polish checklist, wireframe diff all present.
12. **Refactor-before-modify?** T6 (TableView fields) and T5 (eval helpers) are sequenced as refactor-prep before their UI consumers (T7/T8).
13. **Vertical-slice shape?** T1 is the tracer bullet (no-scroll shell end-to-end). Each `## Phase` is a deployable slice. Pure-core/IO/spike tasks declare `**Slice shape:**` exceptions (refactor-prep/spike/css-only) with rationale.

### Design-level findings
- **F1 (high-risk, RESOLVED via D1):** Spec S1 claimed `TableView.winners` + `TableSeatView.isActing` + `TableView.reveal` already exist; code study proved they don't (`TableView` has only `isOver`/`isHeroTurn`/`heroNet`; winners live on `HandRecord.outcome`). Resolution: add pure `toAct` + `winners` to `TableView` (T6, additive, no engine-logic change). **This is a documented override of S1 — flagged for user review at the pause.** Drift detection (FR-31b): `spec_hash` recorded in plan frontmatter.
- **F2 (med, RESOLVED via D3):** No `scripts/` dir, no `tsx`/`ts-node`. Generator runs via `npx vite-node` (ships with vitest) + `gen:equity` script.
- **F3 (med, RESOLVED via D4):** No Playwright dependency (only the MCP tool); jsdom has no layout engine. No-scroll asserted structurally in tests + visually via Playwright MCP in TN.
- **F4 (low, RESOLVED via D6):** Spec FR-50 names `allHands169()` which doesn't exist; added as a pure helper.
- **F5 (low, RESOLVED via D2):** Money formatter folded as the first W2 task (its first consumer is the net chip), full FR-72 sweep deferred to TN.

### Disposition
All five findings resolved in-plan via Decision Log D1–D6. The single finding requiring user judgement (F1 — the S1 override) is surfaced at the plan-review pause, per the user's "plan then pause before execute" build choice. No findings deferred to Open Questions.
