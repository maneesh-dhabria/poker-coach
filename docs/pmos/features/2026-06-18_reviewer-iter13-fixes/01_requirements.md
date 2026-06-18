# Requirements — Reviewer iteration-13 fixes

**Tier:** 2 (coaching-consistency + UX polish bundle — one MAJOR Mental-Math contradiction, two MINOR
UX/grading gaps, plus copy/positivity NITs)
**Source:** `docs/playtest/reviews/iter-13.md` — an independent, context-free first-time-user playtest
of v0.17.0. The reviewer confirmed the prior wins now hold (Mental Math pinned to the frozen verdict
snapshot; Strict off-model note explicit; Conceptual rigorously digit-free; the chart never folds
AA/KK; variance/"played well" correctly withheld after any ⚠️/❌; BB/$ toggle exhaustively consistent;
made-hand value bets and `betBeatsCheck` +EV semi-bluffs already reconcile). Each fix must NOT regress
those confirmed wins.

## Problem

- On a FREE street with no made hand, when the hero BET a low-equity draw/air, the verdict graded the
  bet "❌ Mistake · Light semi-bluff" while the Mental Math directly below issued a present-tense
  PASSIVE instruction: Step 5 "It's free to see the next card — no price to pay" and Step 6 "It's a
  free card — just take it. You're winning ~20%." One panel both graded the BET a mistake AND told the
  beginner to CHECK — two different actions for the same card. (Made-hand value bets and `betBeatsCheck`
  +EV semi-bluffs already reconciled; this misfired ONLY when the hero BET a -EV low-equity airball.)
- A grossly oversized bet/raise drew no SIZE critique: shoving 92 BB into a 7 BB pot (~13×-pot overbet
  4-bet) with AJo graded "✅ Good · Raising for value with ~63% is good." The direction/equity is fine,
  but the absurd size went uncritiqued. The existing oversize check only covered a first-in preflop
  OPEN (sized in big blinds); non-open raises (3-bets/4-bets/shoves) and postflop overbets were size-blind.
- Coaching depth + instant-feedback could only be set when creating a session — no in-game way to
  change depth or toggle feedback, forcing a New session to compare modes.
- Even with NO made hand (a pure draw), Step 3's opponent-shaded ESTIMATE and the final true-equity
  figure were BOTH phrased "to win" with different numbers.
- A fully clean all-✅ hand got only the neutral result line — the app correctly withholds praise after
  a flagged play but never congratulated a genuinely clean hand.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | Mental Math tells you to "take the free card" (check) directly under a verdict that graded your BET a mistake. | On a free street, the Mental Math conclusion (Step 5 + Step 6) must AGREE with the verdict's grade of the action the hero ACTUALLY took. Thread the frozen `explanationInput.action` into `MentalMathSection` → `conclusionFrom` as `heroBet`. When the hero BET/RAISED a no-made-hand free street AND betting is NOT the higher-EV line (`betBeatsCheck` false), Step 6 RECONCILES with the ❌/⚠️ verdict — acknowledges the bet, frames the free card as the cheaper ALTERNATIVE — never "just take it" now. Step 5 likewise says "a check would have been free — but you chose to bet." A CHECK (or genuinely recommended check) keeps "just take it"; the `betBeatsCheck` +EV and made-hand paths are unchanged. |
| 2 | MINOR | Grossly oversized bets/raises aren't flagged for size (92 into 7 ≈ 13×). | Add a GROSS-overbet flag for any bet/raise whose size is a very large multiple of the pot (≥5×), applied to NON-open preflop raises (3-bets/4-bets/shoves) AND postflop bets/raises. Conservative threshold so standard sizing (pot-sized bet ≈ 1×, 3-bet/4-bet ≈ 2× the small preflop pot, forced short-stack shove ≈ 1×) never flags. Keep the correct direction, add a ⚠️ size critique ("…but shoving ~13× the pot risks a huge amount to win a tiny pot — size down"). New additive `oversize_bet` tag. |
| 3 | MINOR | Coaching depth + instant-feedback only settable at session creation. | Add a COMPACT in-play control (right-panel header on the live-feedback tab) to change coaching depth (Conceptual / Equity / Strict) and toggle instant feedback, writing through `useSessionStore().setSettings(...)`. Changing depth re-renders the current feedback at the new depth; toggling feedback behaves like the setup-screen toggle. Update the "Turn instant feedback back on from New session" copy. |
| 4 | NIT | Two "to win" figures in one Mental Math walkthrough (Step 3 estimate vs the true %). | Extend the iter-12 relabel to ALL cases: Step 3's shaded figure is ALWAYS an ESTIMATE labeled "to hit"; "to win" is reserved for the single true-equity figure, with or without a made hand. |
| 5 | NIT | No positive reinforcement on a fully clean hand. | Add a brief positive line in `HandRecap` when EVERY hero decision graded good (`thin === 0 && mistake === 0`) — shown on a clean WIN. A clean-but-lost hand keeps the existing variance bridge (no double-up). |
| 6 | NIT (verify) | "no equity"/"with no made hand" wording felt slightly overstated on ~20%+ air. | Confirm thresholds: < ~20% may say "no equity" (`bluff_no_equity`); ~20–33% is already the "light semi-bluff" (`bluff_thin_equity`); "no made hand" is factually accurate for air. Verified CORRECT — no change. |

## Excluded (no code change, documented)

- Sub-700/800px legibility — small but never clips/overlaps; accepted scale-to-fit tradeoff.

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity / kind /
  conceptTag / plain-math — components READ `DecisionAnalysis` and never recompute. The free-street
  reconciliation reads the SAME equity + frozen action the verdict used (no recompute).
- HONESTY INVARIANT preserved: chart/`gtoClaim` true ONLY for chart-modeled spots; the overbet flag is
  a pure SIZE critique that never claims a chart.
- No `HandRecord` schemaVersion change — `overbetPotMultiple` on `ExplanationInput` (and the threaded
  action) are additive optional fields the validator ignores. Demo fixtures still validate (additive).
- Plain language always; money via `core/money.ts`; no-scroll + scale-to-fit preserved; all prior
  passing tests stay green.
</content>
