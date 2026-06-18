# Requirements — Reviewer iteration-22 fixes

**Tier:** 3 (a SYSTEMIC preflop grading defect — two MAJORs that mis-teach — plus four MINORs and one NIT).
**Source:** `docs/playtest/reviews/iter-22.md` — an independent, context-free first-time-user playtest of
build v0.26.0. The large `## POSITIVES` list must **not** regress — especially: postflop Mental Math and
postflop verdicts (the deliberate bad pot-size bluff → "checking is clearly better, loses money", EV −$17
vs +$7), the FOLD-side preflop coaching (J7o UTG fold "plays poorly after the flop, especially out of
position"), showdown reveal (folded players stay mucked), depth control taking effect instantly /
retroactively, Conceptual digit-free, responsive layout, no console errors, References tab.

The fix is in the analysis **routing** (`core/analysis/analyze.ts`) and depth-aware copy
(`core/analysis/explain.ts`), plus a chart-rationale copy fix, a review-list CSS polish, and a slider
step. The math (equity / EV / pot odds), the postflop branches, and the `HandRecord` schemaVersion are
**not** touched (additive optional fields only).

## Problem

Every preflop OPEN the reviewer made was graded "❌ Mistake" with postflop **bluff/semi-bluff** language,
and a correctly-priced BB **call** was graded "❌ Mistake — the math favors folding" while its own number
(equity ≥ needed) said the opposite. Root cause: preflop decisions in off-chart / limped-pot / cheap-call
spots fell through to the **postflop aggression heuristic** (and to the chart's fold range for calls,
ignoring pot odds), which evaluates a hand on raw equity-vs-everyone — the wrong yardstick preflop, where
position, the chart, fold equity, and pot odds matter. A beginner would learn to never open and to
over-fold the BB.

## Findings → requirements

| # | Sev | Finding | Requirement |
|---|-----|---------|-------------|
| MAJOR-1a | MAJOR | A limped-pot / off-chart preflop OPEN of a chart-fold hand (J9o CO, 47s MP) fell through to the postflop `aggressionBranch(equity, madeHand=null)` → "Light semi-bluff", "raising ~22% with no made hand … not enough to push here, so it loses money on average". Nonsense preflop (no made hand exists; an open isn't a bluff; "push" implies all-in but the hero min-raised). | ROUTING (`analyze.ts`): no preflop RAISE may reach `aggressionBranch`. Route every preflop open through a preflop-aware path — a chart-open hand in a limped pot → ✅ iso-raise; a chart-fold hand → a `loose_open` branch graded ⚠️ thin / ❌ mistake by its EV magnitude, with PREFLOP copy (position + strength, correct "raise" verb), gtoClaim=false, reconciling with the chart ("the chart opens first-in; here there are limpers and this hand is too weak to raise from this seat"). |
| MAJOR-1b | MAJOR | A cheap BB CALL ($4 into a ~$32 pot, needs ~11%, equity ~18%) hit the BB-vs-raise chart branch → chart folds A7o → `call_too_wide` ❌ "the math favors folding". The number (18% ≥ 11%) DIRECTLY contradicts the verdict. | ROUTING (`analyze.ts`): a preflop CALL facing a price is graded by POT ODDS. When the price is clearly met (callBranch grades it good/thin) DEFER to the price (gtoClaim=false, copy reconciles with the chart's default fold). Below the price the existing `call_too_wide` mistake stands, with an agreeing number. |
| MAJOR-2 | MAJOR | Conceptual (beginner depth) gave the vague "You're raising with little behind it — there's not enough here" — reads like stack depth, never says WHY the hand is weak. | Consequence of MAJOR-1a routing: a loose open routes through the existing `conceptualPreflopDeviation` plain-reason machinery → "This hand is too weak to raise from early position — hands like it play poorly after the flop, so folding is the standard line here." Digit-free, a real strength reason. |
| 4 | MINOR | Severity inflation: a marginal −$1 EV min-raise got the same ❌ as a −$17 blunder; the ⚠️ thin tier was unused. | An EV-magnitude gate in BB (`LOOSE_OPEN_LOSS_BB`, analogous to `THIN_VALUE_LOSS_BB`): a marginally-loose open (≈ −1 BB, e.g. J9o CO) stays ⚠️ thin; a clearly-losing junk open escalates to ❌ mistake. |
| 5 | MINOR | "Strict (charts)" said "you're betting" (wrong verb) and "Bluff (no equity)" for a preflop RAISE. | Fixed as a consequence of #1: the loose open routes through preflop copy (kind `preflop`), not the aggression branch; the Strict loose-open copy reads as a raise with a position/strength reason and the honest off-grid banner is kept where it applies. |
| 6 | MINOR | `cellRationale` gave 22 (a FOLD cell) a set-mining paragraph that argues equally against 33/44/55 (which the chart RAISES), and the raise cells got only a win% line. | COPY (`core/charts/preflop.cellRationale`): re-word the 22-fold note as the BOTTOM of the range / a close threshold fold (not a blanket small-pair condemnation), and EXTEND the helper so the small-pair RAISE cells (33/44/55) get a brief "why raise" line. Chart RANGE unchanged. |
| 7 | MINOR | Review-list sub-rows render the verdict icon glued to the text ("❌You're…") and feel cluttered when one street has two graded actions. | CSS (`HandRecap`): lay each stacked sub-row as flex with a gap so the icon sits in its own column with clear space, and give multi-action sub-rows vertical breathing room. |
| 8 | NIT | Coarse bet slider — one ArrowRight jumped ~$48; >pot overbets allowed with no cue. | UI (`ActionBar`): a fine slider step (1 small blind = $1) for precise keyboard sizing, keeping the min-raise/all-in bounds and the effective-stack cap; a subtle "overbet" hint when the chosen size exceeds the pot (no hard block). |
| 9 | NIT | Equity bounced across streets (18%→31%→9%), unexplained. | SKIP — this is correct per-street range-narrowing recompute, not a bug. Faking/altering equities is out of scope; explaining per-street range dynamics is risky for no clear win. |
| 10 | NIT | Two depth controls; tally wording varies by depth. | SKIP — the controls already sync and Conceptual is digit-free BY DESIGN; changing behavior risks regressing the praised instant/retroactive depth control. |

## Honesty / architecture invariants (unchanged)

- `core/analysis/analyze.ts` stays the single source of verdict/severity/conceptTags/kind; `explain.ts`
  owns depth-aware copy. The HONESTY INVARIANT holds: no verdict's words contradict the number beside it
  (the BB-call fix exists precisely to remove the one place they did).
- `gtoClaim` is true ONLY where the chart genuinely models the spot. Loose opens and price-deferred calls
  are off-model → gtoClaim=false, and the copy reconciles with the chart in words.
- POSTFLOP grading is untouched: the loose-open routing only fires for a preflop RAISE/CALL; every
  postflop bet/raise/check/fold path is unchanged (all postflop aggression tests preserved).
- No `HandRecord` schemaVersion change — the one new persisted field (`explanationInput.looseOpen`) is
  additive/optional; the schema validator ignores extra keys. Demo fixtures (`samples/session-demo/`) are
  static records and still validate.
