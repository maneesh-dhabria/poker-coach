# Spec + Plan — Reviewer iteration-12 fixes

Tier 2. Combined design + task breakdown. The three MAJORs cluster in the Mental Math block's
internal consistency; the rest are signed-money / unit-label / copy NITs. No `HandRecord`
schemaVersion change — `board`/`street` on `ExplanationInput` are additive optional fields the schema
validator ignores.

## Design decisions

### FR-2 Mental Math pinned to the frozen decision snapshot (#2 + #4 + #5) — MAJOR
- Root cause: `MentalMathSection` derived its `MentalInput` from the LIVE `useGameStore` (re-derived on
  `tick`) while rendered under a FROZEN persisted verdict. After the hero acted, the verdict stayed on
  the flop while Mental Math recomputed on the dealt turn → contradictory hand label (#2), stale
  opponent count (#4), and label drift across streets (#5).
- Fix (`core/analysis/types.ts`): add optional `board?: string[]` + `street?: Street` to
  `ExplanationInput` (ADDITIVE; cards as raw strings to avoid importing `core/cards`).
- Fix (`core/analysis/analyze.ts`): populate `board`/`street` in `explanationInput` from the decision's
  `input.board`/`input.street` (spread-guarded so absent inputs stay omitted).
- Fix (`components/FeedbackPanel.tsx`): `frozenMentalContext(analysis)` reads
  `analysis.explanationInput` (hole/board/street/potBefore/toCall/numActiveOpponents/madeHand) and
  passes it as a `frozen` prop; returns null when the record predates the additive fields → live
  fallback.
- Fix (`components/MentalMathSection.tsx`): new `FrozenDecisionContext` prop. When `frozen` is present
  the `MentalInput` is built from it (NOT the `tick`-driven `liveInput`), and `withFrozenMadeHand`
  forces `estimate.madeHand` to the verdict's frozen made-hand label — so Mental Math's hand
  description is IDENTICAL to the verdict's, never a re-detection on a later board. The outs-override,
  `equityKey`, and header context all key off the (now frozen) `input`, so the override still works on
  the frozen board. Live fallback retained when `frozen` is absent (older records / pre-decision).
- Tests (`MentalMathSection.test.tsx`): with a frozen FLOP decision (middle pair, 2 opponents) and a
  CONFLICTING live TURN flow (board two pair, 4 opponents), Mental Math shows "middle pair" (never
  "two pair"), "Flop → ×4" (not the live turn ×2), and the frozen flop header. The existing live-hand
  tracking regression test (no `frozen` prop) still passes — live fallback intact.

### FR-1 Step 3 shaded figure labeled hit/improve, not win, with a made hand (#1) — MAJOR
- Root cause: Step 3 rendered "~X% to win" for the shaded draw-hit figure; with a made hand that
  figure is the draw-improvement chance, not the win chance — so it read as a second, lower "to win".
- Fix (`components/MentalMathSection.tsx` Step 3): when `estimate.madeHand` is present, label the
  shaded figure "to hit your draw" (testid `mm-shade-figure`) and add a note (`mm-shade-madehand-note`)
  "you already have <label>, so your real win chance is higher (~<trueWin>%) — Step 6 reconciles to the
  true win %." With no made hand the label stays "to win" (hitting the draw ≈ winning). No change to
  `core/mental/estimate.ts`'s `shadeFor` math (the shade sentence never said "to win").
- Tests (`MentalMathSection.test.tsx`): with a made hand the shaded figure is labeled "to hit your
  draw", not "to win"; the made-hand note names the label; the only "to win" figure is the true-win.

### FR-3 Strict off-model note + limped-pot off-model grading (#3) — MAJOR
- PRESENTATION (`components/FeedbackPanel.tsx`): when `depth === "strict" && !analysis.gtoClaim`, render
  an `off-model-note`: "No baseline chart covers this spot — grading by equity and pot odds instead."
  Strict-only (Equity/Conceptual never imply a chart).
- GRADING (`core/analysis/analyze.ts`): add optional `smallBlind?` to `AnalyzeInput` (additive). In
  `route`, compute `isLimpedPot = street === "preflop" && facing === "unopened" && potBefore >
  smallBlind + bigBlind + bigBlind/2` (the ½-BB epsilon guards float/rounding so a clean blinds-only
  pot never false-positives). When `isLimpedPot`, SKIP the preflop chart branch — the decision falls
  through to the heuristic branches (`aggressionBranch` for an iso-raise) with `gtoClaim` false and no
  `chart`/`preflop_chart_deviation`. `core/handFlow.ts` now passes `smallBlind` into `analyze`.
- Honesty: this TIGHTENS the invariant — a limped pot is no longer claimed as chart-graded. It invents
  no range; the chart cell "KTo = fold from MP" is untouched (a legitimately tight baseline RFI range).
- Detection IS cleanly possible without engine/schema changes: handFlow already carries both blinds, so
  `smallBlind` is just threaded through additively. So the grading fix is IMPLEMENTED, not deferred.
- Tests (`analyze.test.ts`): an iso-raise over a limper (potBefore $5 on a $3-blind table) → `gtoClaim`
  false, no `chart`, no `preflop_chart_deviation`; a clean RFI (potBefore $3) → `gtoClaim` true, chart
  applies; with no blind info supplied → unchanged (no false detection). `FeedbackPanel.test.tsx`: the
  off-model note renders for a non-chart Strict spot, NOT for a chart-backed spot, NOT in Equity depth.

### FR-4 Signed-zero P&L normalized (#4) — NIT
- Fix (`core/money.ts`): add `displaysAsZero(dollars, unit, bigBlind)` and `formatSignedMoney`, which
  prepends "+" only for a non-zero positive and otherwise returns plain `formatMoney` ("$0"/"0 BB",
  "-$15"). `components/table/Seat.tsx` uses `formatSignedMoney(seatNet, …)` instead of the inline
  `seatNet >= 0 ? "+" : ""` (which added "+" to an exact/rounded zero).
- Tests (`core/money.test.ts`): `formatSignedMoney(0)` → "$0"; `formatSignedMoney(0.3)` → "$0" (no "+");
  positive → "+$20"/"+1.5 BB"; negative keeps "-$15"; near-zero negative → "$0".

### FR-5 Unit-aware EV expander label (#5) — NIT
- Fix (`components/MentalMathSection.tsx` TrueEquityCheck): the `<summary>` reads "Show the BB EV" when
  `displayUnit === "bb"`, else "Show the dollar EV".
- Tests (`MentalMathSection.test.tsx`): BB mode → "Show the BB EV", no "dollar"; USD → "Show the dollar
  EV".

### FR-6 valuecheck good copy doesn't undersell a near-coin-flip (#6) — NIT
- Fix (`core/analysis/explain.ts valuecheck()`): for a good check at `equityPct >= 44` (the band where
  valuecheck-good fires, since ≥52% grades thin/value-missed), say "at ~X% you're roughly a coin-flip,
  not far enough ahead to bet for value, so keeping the pot small is fine"; below 44% keep "you only
  win about X%, so there's little to bet for".
- Tests (`explain.test.ts`): a ~44% check reads "coin-flip", not "little to bet for"; a ~12% check
  still reads "little to bet for".

## Excluded (no code change, documented)
- (a) Pot-relative undersize threshold ($2-into-$48 "too small" vs $2-into-$12 "thin value") — correct.
- (b) Same-street river calls graded ❌ then ✅ as the price changed — correct pot-odds behavior.
- (c) Oversized all-in counting as "1 thin" in the tally — consistent with its thin severity (kept).
- (d) Sub-800px legibility — accepted scale-to-fit tradeoff; nothing clipped/overlapping.

## Test / verification plan
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.
- Self-review for new contradictions: (a) Mental Math's hand label / board / street / opponent count
  always match the verdict it sits under; (b) no two figures in the Mental Math panel are both labeled
  "to win" with different values; (c) Strict depth visibly distinguishes chart-backed from off-model.
- Demo fixtures `samples/session-demo/hand-*.json` re-validated by the schema test (additive only).
</content>
