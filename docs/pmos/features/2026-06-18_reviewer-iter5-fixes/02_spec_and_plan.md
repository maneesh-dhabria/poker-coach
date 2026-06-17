# Spec + Plan — Reviewer iteration-5 fixes

Tier 2. Combined design + task breakdown. Changes span: a decisive scale-to-fit rebuild of the table
surface in `components/table/PokerTable.tsx` (#1), multiway equity copy + the "raiseing" verb fix +
Conceptual action variety in `core/analysis/explain.ts` (#2/#4/#8), a structured-amounts addition to
`DecisionAnalysis` + a `formatExplanation` presentation helper threaded into `FeedbackPanel.tsx` and
`HandRecap.tsx` (#3), a Strict-only "chart-based" badge gate (#7), and a contested-loss guard on the
variance footer (#6). #5 is an audit + production-build confirmation (no code bug). #9 is deferred
(the existing context line already names the street; no clean clarifier without risk). No
`HandRecord` schemaVersion change — `explanationInput` is additive/optional and the validator ignores
extra keys. Components still read `DecisionAnalysis` as ground truth; `formatExplanation` re-runs the
same pure builder with a different unit (presentation), never recomputing a verdict.

## Design decisions

### FR-1 Scale-to-fit the whole table as ONE unit (#1, PERSISTENT) — MAJOR
- Root cause (analyzed across 3 prior rounds): the felt preserved aspect ratio and seats were
  positioned by PERCENT, but the seat tiles and the center box were FIXED-PIXEL components. On a
  height-constrained 800×600 felt the felt became very short, so the fixed-size tiles occupied a
  large fraction of it and overlapped the percent-positioned center pot. Percentage positioning alone
  can't fix this because the tile sizes don't shrink with the felt.
- Fix: render the table interior — the felt oval + all seat tiles + the center pot/round-summary +
  the board — at a FIXED design size (`DESIGN_W=760 × DESIGN_H=520`, keeping the current fixed-px
  tiles), inside a measured "stage" container. Apply `transform: scale(s)` to that fixed box, where
  `s = min(1, containerW/DESIGN_W, containerH/DESIGN_H)`, centered. The container is measured with a
  `ResizeObserver` (`useFitScale` hook; `'use client'` — a component, not core).
- Guarantee: because the geometry is FIXED and the scale is UNIFORM (one factor for both axes), if
  nothing overlaps at scale 1 it cannot overlap at any smaller scale. So 800×600 (and every size) is
  safe — the seat tile can never cover the pot. The percent seat positions and the center block's
  `top: 36%` / `maxHeight: 68%` bounds now resolve against the fixed 760×520 box (the geometry they
  were tuned for), so the center block ends clear of the bottom hero seat at scale 1 ⇒ at every scale.
- Action bar stays OUTSIDE the scaled box (`flex:0 0 auto`, full-size, tappable). The stage is
  `overflow:hidden` so no stray scrollbars — no-scroll contract preserved; the stage absorbs
  shrinkage while the bar stays put.
- Tests: a pure unit test of `fitScale` (`min(1, w/DESIGN_W, h/DESIGN_H)`, clamped ≤1, single uniform
  factor, zero-guard, the 800×600 case scales down cleanly) + a source guard that the interior is a
  fixed `DESIGN_W × DESIGN_H` box with `transform: scale(${scale})` and the old `aspectRatio` is gone.
  True pixel verification at 800×600 is the next reviewer's Playwright step.

### FR-2 Multiway equity label, not "a random hand" (#2) — MAJOR
- `explain.ts` `preflop()` (equity depth): the win% is MULTIWAY (vs all live opponents' assumed
  ranges), so it now reads "~N% to win against the N opponents still in" via `opponentPhrase()`
  (1 → "the 1 opponent still in"; N → "the N opponents still in"; unknown → "the players still in").
  The misleading singular "against a random hand" is removed. `numActiveOpponents` is threaded from
  `analyze()` (already on `AnalyzeInput`, sourced from `spot.numActiveOpponents = contenders − 1`).
- The References chart's "vs a random hand" is a separate 1-on-1 teaching number — different by
  design; the live copy now distinguishes multiway from heads-up so the two no longer contradict.
- Tests: the equity copy does not contain "random hand" and names the opponent count; an unknown
  count falls back to "players still in".

### FR-3 Explanation sentence in the display unit (#3) — MAJOR
- `DecisionAnalysis` gains an additive optional `explanationInput` (kind/action/amounts/equity/odds/
  chart context) — the minimal slice needed to RE-FORMAT the sentence. `analyze()` populates it.
- `explain.ts` exports `formatExplanation(analysis, unit, bigBlind)`: re-runs the pure
  `buildExplanation` with the stored verdict/depth/amounts and the chosen unit (in bb mode the money
  divides by the big blind, matching `formatMoney`). Falls back to the stored sentence for older
  records. This is presentation only — the verdict is read, not recomputed.
- `FeedbackPanel` and `HandRecap` render `formatExplanation(analysis, displayUnit, BIG_BLIND)` instead
  of the raw `plainExplanation`. The persisted USD `plainExplanation` is untouched (coach-skill canon).
- Tests: BB mode renders the cost/pot in BB ("54 BB"/"280 BB", not "$108"/"$560"); USD mode unchanged.

### FR-4 "raising", not "raiseing" (#4) — MINOR
- `explain.ts`: a `CHART_VERB_ING` map ("raise"→"raising", "call"→"calling", "fold"→"folding")
  replaces the naive `${rec}ing` concatenation in the equity preflop copy.
- Tests: the raise copy contains "raising", never "raiseing"; no verb produces a "*sing"/"*eing"
  artifact across all chart actions × deviates.

### FR-5 Console-error audit + production build (#5) — MINOR
- Audited `FeedbackPanel.tsx` and `HandRecap.tsx`: no state/store WRITE in a render body (all
  `set...` calls live in `useEffect`/handlers, none in these two components); `resultLine` is a
  module function defined and called in scope; `showNumbers` is not referenced anywhere. The reported
  ReferenceErrors are stale Next.js HMR artifacts. `npm run build` compiles clean (no TS/lint errors).
- No code change required; no new test beyond the existing recap-render-on-complete safety tests.

### FR-6 Variance footer only on a contested loss (#6) — NIT
- `HandRecap`: a `contested` flag — true if any decision is a voluntary `call`/`bet`/`raise` OR on a
  street past preflop. The variance footer now requires `heroNet < 0 && c.mistake === 0 && contested`.
  A correct preflop fold that loses only the blind is NOT contested ⇒ no "played well, lost anyway".
- Tests: a preflop fold-and-lose-blind hand → no `recap-variance`; a contested river-bet showdown
  loss with no mistakes → `recap-variance` shows.

### FR-7 Strict-only "chart-based" badge (#7) — NIT
- `FeedbackPanel`: the badge renders only when `gtoClaim && depth === "strict"` (was
  `gtoClaim && showJargon`, which included Equity). `HandRecap` mirrors it
  (`gtoClaim && coachingDepth === "strict"`). Equity leads with the win-rate; its sentence still
  notes the chart agrees (honesty), but the Strict-mode badge no longer dominates.
- Tests: the badge appears in Strict, not in Equity.

### FR-8 Conceptual aggression copy varies by action (#8) — NIT
- `explain.ts` `conceptual()` aggression branch: a raise vs a bet now get distinct sentences at each
  verdict ("a marginal raise — fine to push a thin edge…" vs "a marginal bet — fine as thin value…").
- Tests: a thin raise and a thin bet (and a good raise vs good bet) don't produce identical text.

### FR-9 Same-line street-to-street grading clarifier (#9) — DEFERRED
- The grading is correct poker (a hand strengthens vs ranges as the board develops). The feedback
  card already prints "Your <street> decision · pot was X when you acted", which anchors each verdict
  to its street. No additional clarifier was clean without risking new copy contradictions, so this
  is intentionally left as-is (per the brief's "leave it and say so" option).

## Task list (TDD where it fits)
1. Scale-to-fit table + `fitScale`/`useFitScale` + tests (FR-1) — `PokerTable.tsx`, new
   `PokerTable.scale.test.ts`, update `PokerTable.handrecap.test.tsx` source guard.
2. Multiway label + "raising" + Conceptual variety (FR-2/4/8) — `explain.ts`, extend `explain.test.ts`.
3. Structured amounts + `formatExplanation` threaded into panels (FR-3) — `types.ts`, `analyze.ts`,
   `explain.ts`, `FeedbackPanel.tsx`, `HandRecap.tsx`, extend `FeedbackPanel.test.tsx`.
4. Strict-only badge (FR-7) — `FeedbackPanel.tsx`, `HandRecap.tsx`, extend `FeedbackPanel.test.tsx`.
5. Contested-loss variance guard (FR-6) — `HandRecap.tsx`, extend `HandRecap.test.tsx`.
6. Audit + production build (FR-5).
7. Gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green/clean.

## Tests changed (not weakened)
- `PokerTable.handrecap.test.tsx` — the layout source guard now asserts the fixed-design-box +
  `transform: scale(${scale})` + `useFitScale(stageRef)` and that the old `aspectRatio: "760 / 520"`
  is GONE; the center-block bound guard (`top: 36%`/`maxHeight: 68%`) is split into its own case and
  unchanged. Intentional behavior/source change (the decisive #1 fix), not a weakening.
