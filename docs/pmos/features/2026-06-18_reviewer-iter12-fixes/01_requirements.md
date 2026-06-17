# Requirements — Reviewer iteration-12 fixes

**Tier:** 2 (coaching-consistency + UX polish bundle — three MAJORs clustered in the Mental Math
block's internal consistency, plus small copy / signed-money / unit-label NITs)
**Source:** `docs/playtest/reviews/iter-12.md` — an independent, context-free first-time-user playtest
of v0.16.0. The reviewer confirmed the big wins now hold (Conceptual depth digit-free; end-of-hand
result/verdict always agree, never "played well/variance" after a flagged play; the preflop chart
never shows "Fold AA/KK" and explains off-model spots instead of faking a grid; BB/$ toggle
exhaustive with no mixing; all-in badges / side-pots / rebuy solid; low-equity small bet agrees with
its EV table). The remaining findings are real contradictions WITHIN the Mental Math panel plus minor
copy — so each fix must NOT regress those confirmed wins.

## Problem

- `components/MentalMathSection.tsx` built its six-step routine from the LIVE `useGameStore`
  (`s.hole`, `s.board`, `s.street`, re-derived on `tick`) while it was rendered UNDER a FROZEN
  `DecisionAnalysis` verdict (the panel persists the last decision's verdict between decisions since
  iter-9 #3). After the hero acts and the engine deals the next card, the verdict stayed frozen on
  (say) the flop while Mental Math recomputed on the now-live turn. That single live-vs-frozen
  mismatch produced finding #2 (a "TWO PAIR" Mental Math line under a "MIDDLE PAIR" verdict) AND the
  two consistency MINORs (#4 stale opponent count, #5 hand-label drift across streets).
- Step 3 "Shade for opponents" labels the shaded number "~X% to win". The shaded number is the
  draw-HIT chance (outs only). With a made hand present, that is NOT the win % — so on a turn with a
  made pair the equity bar + Step 1 + Step 6 said "~54% to win" while Step 3 said "~14–16% to win":
  two contradictory "to win" figures in one panel.
- In Strict depth, a chart-modeled spot shows a "chart-based" badge + "the baseline chart says…"; an
  OFF-model spot (a limped multiway pot, or any postflop spot) silently fell back to plain pot-odds
  with NO badge — looking identical to Equity, with no signal that no chart applies. Separately, an
  iso-raise over a lone limper was ❌-flagged via the RFI chart, which over-punishes a standard iso.
- A player who folded with no blind posted showed "+$0" (a signed zero) in the per-seat P&L.
- In BB mode the Mental Math EV expander still read "Show the dollar EV" while the value was in BB.
- A turn check graded ✅ read "you only win about 44%, so there's little to bet for" — 44% is near a
  coin-flip; "little to bet for" undersells it.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 2 | MAJOR | A flop-bet card's verdict said "MIDDLE PAIR" while Mental Math right below said "TWO PAIR" (it had advanced to the already-dealt turn). | Pin Mental Math to the SAME frozen decision the verdict uses. Add optional `board?: string[]` + `street?: Street` to `ExplanationInput` (ADDITIVE, no schemaVersion bump); populate in `analyze.ts`. `FeedbackPanel` passes the frozen hole/board/street/opponent-count/made-hand into `MentalMathSection`, which builds the estimate from those frozen props — using the frozen `madeHand` label so Mental Math's hand description is IDENTICAL to the verdict's. Keep the outs-override on the frozen board; keep a live-state fallback only when the frozen context is absent (older records). |
| 1 | MAJOR | Step 3 "Shade for opponents" labels a draw-hit % as a WIN %, contradicting the equity bar (~54% vs ~14–16%, both "to win"). | When a made hand is present, label Step 3's shaded figure as a chance to HIT/IMPROVE the draw, not "to win", and say the real win % (Step 6 / the bar) already includes the made hand. With no made hand, hitting the draw IS basically winning, so "to win" stays honest. After the fix no two figures in the panel are both labeled "to win" with different values. |
| 3 | MAJOR | Strict silently mimics Equity on off-chart spots, and ❌-grades an iso-raise over a limper via the RFI chart. | PRESENTATION: in Strict depth, when the decision is NOT chart-backed (`gtoClaim` false) show an explicit "No baseline chart covers this spot — grading by equity and pot odds instead" note, so Strict never masquerades as chart-authoritative. GRADING: detect a LIMPED pot (`facing === "unopened"` but `potBefore` exceeds the posted blinds) and treat it as OFF-MODEL — do NOT apply the RFI chart / emit a chart-deviation ❌ for an iso-raise; grade by equity/heuristics and present via the off-model note. The chart cell "KTo = fold from MP" is a legitimately tight baseline RFI range — left as-is. |
| 4 | NIT | A folded player with no blind posted shows "+$0" (signed zero). | Normalize to plain "$0"/"0 BB" — no "+"/"−" on a zero. Extend `core/money.ts` (which already normalizes "-$0" → "$0") with a `formatSignedMoney` helper; use it in the per-seat P&L chip. |
| 5 | NIT | In BB mode the EV expander reads "Show the dollar EV" while the value is in BB. | Make the EV expander label unit-aware in `MentalMathSection` ("Show the BB EV" in BB mode, "Show the dollar EV" in USD). |
| 6 | NIT | A turn check graded ✅ "you only win about 44%, so there's little to bet for" — undersells a near coin-flip. | Soften the `valuecheck` good copy in `core/analysis/explain.ts`: near a coin-flip (~44–51%, the band where valuecheck-good fires below the 52% value cutoff) say "you're roughly a coin-flip, so checking to keep the pot small is fine"; a genuinely weak hand keeps "little to bet for". |

## Excluded (no code change, documented)

- (a) The same min-bet getting "Bet too small" at $2-into-$48 (~4%) but only "Thin value" at
  $2-into-$12 (~17%) — correct pot-RELATIVE sizing (17% is above the undersize threshold).
- (b) The same-street river calls graded ❌ then ✅ as the pot/price changed — correct pot-odds.
- (c) The ⚠️ "Oversized" all-in counting as "1 thin" in the tally — consistent with its thin
  severity, intentional (same as iter-11's exclusion).
- (d) Sub-800px legibility — accepted scale-to-fit tradeoff (nothing clipped/overlapping).

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity / kind /
  conceptTag / plain-math — components READ `DecisionAnalysis` and never recompute. Pinning Mental
  Math to the frozen snapshot is the "read the single source, don't recompute" rule applied literally.
- HONESTY INVARIANT preserved: chart/`gtoClaim` true ONLY for spots the baseline chart models. #3
  TIGHTENS that (a limped pot is no longer claimed as chart-graded) and never invents a range.
- No `HandRecord` schemaVersion change — `board`/`street` on `ExplanationInput` are new optional
  fields the validator ignores. Demo fixtures still validate (additive).
- Plain language always; money via `core/money.ts`; no-scroll + scale-to-fit preserved; all prior
  passing tests stay green.
</content>
