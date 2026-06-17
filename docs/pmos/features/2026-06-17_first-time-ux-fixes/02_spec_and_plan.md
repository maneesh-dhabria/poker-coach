# Spec + Plan — First-time-user UX fixes

Tier 2. Combined design + task breakdown. All changes are presentational (`components/*`, `app/*`,
`globals.css`); no `core/` logic, equity math, or `HandRecord` schema changes. Components keep
reading `DecisionAnalysis` as ground truth.

## Design decisions

### FR-1 Action bar always reachable (BLOCKER)
- Root cause: `components/table/PokerTable.tsx` renders the felt at a hard `height: 580`, inside
  `PlayShell`'s `left-col` (a `100vh`, `overflow:hidden`, flex-column region). On short viewports
  the felt + action bar exceed the column and the action bar is clipped (no scroll by contract).
- Fix: make `PokerTable`'s `<section>` a full-height flex column; the felt becomes
  `flex: 1 1 auto; minHeight: 0; maxHeight: 580` so it **shrinks to fit** while the action area
  stays `flex: 0 0 auto` and always renders in view. Seats are %-positioned, so they scale with the
  felt. Preserves the no-scroll contract (no new scroll regions; `PlayShell` untouched).
- Verify: Playwright screenshots at 1024×640 and 1280×720 show Fold/Call/Raise visible.

### FR-2 Live Feedback empty state (CONFUSING)
- `FeedbackPanel` must keep returning `null` for `analysis === null` (a unit test asserts this).
  So the empty state lives in `RightPanel`: when the Live Feedback tab is active, feedback is
  enabled, and there's no `feedback?.analysis`, render a friendly placeholder card ("Make your
  move — I'll break down the math and the verdict right here.").

### FR-3 Anchor feedback to its street/pot (CONFUSING)
- Add an optional `context?: { street; potBefore; toCall }` prop to `FeedbackPanel`; `RightPanel`
  fills it from the live `feedback` decision (`feedback.street`, `feedback.spot`). Render a caption
  under the verdict badge: "Your <street> decision · pot was $X when you acted". No schema change —
  uses existing `HeroDecisionRecord.street` + `.spot.potBefore`. Mirror a compact "· pot $X" on each
  `HandRecap` row for consistency.

### FR-4 Setup jargon gloss (CONFUSING)
- Native `title` tooltips already exist on the style `<select>` but aren't discoverable. Add a
  always-visible compact legend under the Opponents heading expanding TAG/LAG/Nit/Calling Station in
  plain words, and add `title` gloss to the table-preset buttons (PRESET_INFO).

### FR-5 Result-vs-verdict reconciliation (mild)
- In `HandRecap`'s footer, when the hero won (`heroNet >= 0`) but a decision was flagged
  (`mistake > 0` or `thin > 0`), add one plain line: results swing hand-to-hand; the verdicts grade
  the decision, not the outcome.

### FR-6 Favicon (nit)
- Add `app/icon.svg` (Next App Router auto-injects `<link rel="icon">`) + `app/favicon.ico` so the
  default `/favicon.ico` request resolves. Reference via `metadata.icons` in `app/layout.tsx`.

## Task list (TDD where it fits)
1. PokerTable responsive felt (FR-1) — edit + Playwright verify.
2. RightPanel empty-state placeholder (FR-2) — edit + extend RightPanel.test.tsx.
3. FeedbackPanel `context` caption + HandRecap pot caption (FR-3) — edit + extend tests.
4. SetupScreen style legend + preset tooltips (FR-4) — edit + extend SetupScreen.test.tsx.
5. HandRecap result/verdict reconciliation (FR-5) — edit + extend HandRecap.test.tsx.
6. Favicon (FR-6) — add files + layout metadata.
7. Gate: typecheck + lint + test; then Playwright re-playtest as a fresh user.
