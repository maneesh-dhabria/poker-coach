# Requirements — Reviewer iteration-20 fixes

**Tier:** 2 (one MAJOR self-contradiction + four MINOR + one NIT; two are regressions from recent rounds)
**Source:** `docs/playtest/reviews/iter-20.md` — an independent, context-free first-time-user playtest of
build v0.24.0. The large `## POSITIVES` list (decision-not-outcome grading, principled thin/mistake
buckets, Strict-shows-numbers / Conceptual-digit-free, chart cross-checks, $/BB toggle, responsive
layout, merged recap rows) must **not** regress.

All items live in the copy/presentation/state-wiring layers. The math itself (equity / EV / pot odds)
and the verdict bucketing are correct and **not** changed. No `HandRecord` schemaVersion bump — every
change is component-render-only, store-wiring, or a UI display cap; the only additive engine/flow output
(`TableView.effectiveOpponentRaiseTo`) is not persisted.

## Problem

- **MAJOR.** A fold at the break-even boundary contradicts itself. Repro (Hand 6): folding QTo (CO, $2
  to win a $9 pot, need ~22%) with ~22% equity (equity == need, exactly break-even) showed headline
  "✅ Good / Good discipline — …Folding is right — you don't have the odds, though it's close," while the
  equity-bar whyLine DIRECTLY below said the opposite: "You win ~22% but only need ~22% — that gap is why
  continuing makes money over time." Two contradictory conclusions on one card. The whyLine picked its
  template off raw `equity >= need` regardless of the hero's action (so it ran the call-positive
  "continuing makes money" line under a FOLD), and the headline's "you don't have the odds" is FALSE at
  break-even. The iter-18 borderline reconciliation only covered CALLS, not a borderline FOLD.
- **MINOR #1 (REGRESSION).** Conceptual leaks numbers on every freshly-dealt hand. With depth =
  Conceptual selected in the panel, dealing a NEW hand and acting rendered the full Equity view (dollar
  pot odds, "~14% / need ~16%", equity bar, "Show the numbers") even though the dropdown still read
  "Conceptual [selected]"; only a manual re-toggle made it digit-free. Reproduced twice.
- **MINOR #2.** A "called too wide" preflop MISTAKE lacked the need-marker + EV expander the priced fold
  shows. Repro (Hand 3): a preflop call graded "❌ Mistake / Called too wide" had no "Show the numbers"
  expander and no "need ~X%" marker, while the preflop FOLD (also priced) showed both.
- **MINOR #3.** The bet slider offered an uncallable overbet. Repro (Hand 7): "Bet $584" when the largest
  still-in opponent could cover only ~$200 (result "you lost $200").
- **MINOR #4.** "The play to review" named a trivial play over the real leak. Repro (Hand 7): after losing
  the $200 stack to a $584 oversized all-in (⚠️ thin, severity 1), the recap named "your preflop call of
  $2" (a ❌ mistake) as "where the leak is" — severity-first ranking made a $2 mistake outrank a
  stack-losing thin play.
- **NIT #5.** Merged recap row showed a misleading single pot. "Preflop — you called $2, then called $8 ·
  pot $3" tagged the merged row with the FIRST action's pot ($3); the $8 call was into pot $26.

## Findings → requirements

| # | Sev | Finding | Requirement |
|---|-----|---------|-------------|
| MAJOR | MAJOR | Break-even fold's headline + equity-bar contradict. | Extend the borderline-band (`abs(equityPct - potOddsPct) <= 3`) coherent treatment to FOLDS. Inside the band BOTH the headline copy (`explain.ts price()` / `conceptual()`) AND the equity-bar whyLine (`FeedbackPanel.whyLine`) say the SAME break-even thing for a fold; NEVER "you don't have the odds" (false at break-even) NOR "continuing makes money over time" attached to a fold. The whyLine keys off the band + the hero's action, not raw `equity >= need`. Verdict stays ✅ good (a break-even fold is not a leak). Outside the band a clear fold keeps the confident "Folding is right — you don't have the odds". |
| 1 | MINOR (regression) | Conceptual leaks numbers on a fresh deal. | STATE-WIRING (`gameStore.setCoachingDepth`): mirror the new depth into `gameStore.settings.coachingDepth` (the field `newHand()` reads when building the fresh hand's flow), so an in-play depth switch makes the active depth ONE source of truth for both the next deal AND the in-play re-derive. A fresh hand dealt while Conceptual is active is digit-free on its first decision with no re-toggle. |
| 2 | MINOR | "Called too wide" call lacks need-marker + EV table. | GATE (`FeedbackPanel`): a PRICED preflop CALL facing a real bet (`kind==="preflop"`, `action==="call"`, `toCall>0`, `potOddsPct!=null`) gets the "need ~%" marker + whyLine + "Show the numbers" EV table, matching the priced fold — regardless of good/thin/mistake. A preflop FOLD / open-raise stays suppressed (the iter-09 #1 carve-out for chart-fold cards). `potOddsPct` is already populated on every price decision. |
| 3 | MINOR | Slider offers an uncallable overbet. | UI CAP (`ActionBar`, fed by `gameEngine.effectiveOpponentRaiseTo` → `TableView.effectiveOpponentRaiseTo`): the slider + button OFFER no more than the effective stack = the largest raise-to level any single still-in opponent could match (`committedStreet + stack`), never below `minRaiseTo`. Engine legality (`legal.maxRaiseTo`) is untouched; if the hero is the short stack the max stays the hero's all-in. |
| 4 | MINOR | Leak pointer names a trivial play. | RANK (`HandRecap.mostSevereFlagged`): rank flagged plays by CHIP MAGNITUDE primarily (`max(heroAction.amount, spot.toCall)`), severity as the tiebreaker — so the $584 stack-losing overbet outranks the $2 preflop mistake. A lone flagged play is still named; a big clear mistake still outranks a small thin play. |
| 5 | NIT | Merged row shows a misleading single pot. | COPY (`HandRecap`): drop the "· pot $X" suffix on a MERGED multi-action row (`group.length > 1`); single-action rows keep their (unambiguous) pot. |

## Honesty / architecture invariants (unchanged)

- `core/analysis/*` remains the single source of verdict/equity/kind/conceptTag. Components read
  `DecisionAnalysis` and never recompute. The MAJOR + #2 + #5 are copy/gate-only; #4 reads only the
  decision's `heroAction.amount`/`spot.toCall`/`severity`; #3 adds a read-only engine introspection
  (`effectiveOpponentRaiseTo`) consumed purely as a DISPLAY cap.
- Decision-not-outcome integrity is intact. The break-even fold stays ✅ good (the engine cannot
  confidently say folding a break-even spot is −EV); #4 changes only WHICH flagged play is named, not the
  verdicts.
- No `HandRecord` schemaVersion change — every change is component-render-only or store/UI wiring; the
  new `TableView.effectiveOpponentRaiseTo` is an in-memory render field, not persisted.
