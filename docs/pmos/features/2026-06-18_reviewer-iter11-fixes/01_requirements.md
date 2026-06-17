# Requirements — Reviewer iteration-11 fixes

**Tier:** 2 (coaching-consistency + UX polish bundle — three MAJORs, all REGRESSIONS/edge-cases the
previous round's fixes introduced; the rest MINOR/NIT copy + depth-gating + legibility)
**Source:** `docs/playtest/reviews/iter-11.md` — an independent, context-free first-time-user playtest
of v0.15.0. The reviewer confirmed the big wins now hold (per-street equity accurate, BB/$ toggle
consistent everywhere, clean rebuy, plain-language verdicts, Conceptual verdict card number-free,
References BB-unopened explainer, Strict chart badge limited to preflop). The remaining findings are
self-inflicted edge cases of the iter-10 fixes plus small copy/depth/legibility polish — so each fix
must NOT reopen what the previous round closed.

## Problem

- The iter-10 #3 fix (flag a grossly under-sized bet for SIZE even with a made hand) ran its
  `bet_too_small` "you're ahead, size up to get paid while you're in front" branch FIRST and
  UNCONDITIONALLY. So a min-bet ($2) into a ~$42 pot holding A-high (~13% equity) was graded ⚠️ "Bet
  too small / you're AHEAD with ~13%… size up WHILE YOU'RE IN FRONT" — value framing on an airball,
  contradicting the same card's EV table (bet = −$26 vs check = +$6). 13% was called "ahead/in front".
- The iter-10 #1 fix (Facing selector + explanatory panel) only special-cased `BB + unopened`. Every
  OTHER unmodeled (position, facing) combo still rendered the grid, so Facing = "vs a raise" at
  UTG/MP/CO/BTN/SB folded all 169 hands — the detail card literally read "AA — Fold from BTN".
- `HandRecap`'s "Good decision, unlucky result — variance / played well" footer gated on
  `c.mistake === 0`, not `c.thin === 0`. A loss whose only flaw was a ⚠️ thin play (an oversized
  shove) still got "played well". And a loss WITH a ❌ mistake hit neither branch, so it silently
  showed nothing — the inconsistency the reviewer noticed.
- Mental Math Step 6 on a free street with no made hand flatly returned "It's a free card — just take
  it" even when the same card's "Show the dollar EV" said betting was +EV (~$9) — two opposite
  recommendations, unreconciled.
- A CO fold (62o) was praised as folding "especially out of position" — CO is LATE position.
- At Conceptual depth the verdict CARD was number-free, but the section below still showed "Result:
  you lost 1 BB" and "0 good · 1 thin · 1 mistake" — digits against the "no numbers" promise.
- Sub-800px seat text is small (legible, nothing clipped) — a recurring scale-to-fit tradeoff.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | A min-bet at ~13% (A-high) graded ⚠️ "Bet too small / you're AHEAD… size up while you're in front", contradicting its own EV table (bet −$26 vs check +$6). | Gate the `bet_too_small` (undersize value) branch to genuine value bets: only treat an undersized bet as "too small for value" when the hero is plausibly value-betting (made hand present OR equity ≥ 50). An undersized bet with LOW equity and NO made hand falls through to the existing low-equity bluff branch (`bluff_no_equity` < 20%, else `bluff_thin_equity`) — a ❌ mistake that AGREES with the EV table and never claims a lead. KEEP iter-10 #3: an undersized bet WITH a made hand still flags `bet_too_small`. Make the undersize copy not assert "in front"/"ahead" when a made hand is at low (<50%) equity. |
| 2 | MAJOR | References chart "vs a raise" folds all 169 hands at every non-BB position ("AA — Fold from BTN"). | Generalize the guard: show the explanatory panel (no grid, no detail) whenever `!chartApplies(position, facing)`, for ANY position/facing. BB + unopened keeps its existing copy; non-BB + vs-a-raise gets honest position-aware copy ("no separate <POS>-vs-a-raise range — switch to first in to see <POS>'s opening range"). NEVER show a Fold action for AA/KK (or any hand) in an unmodeled spot. |
| 3 | MAJOR | "Played well, unlucky variance" footer shown after an ⚠️ oversized shove loss; absent on a ❌ mistake loss (inconsistent). | Gate the variance footer on `!flagged` (`mistake === 0 && thin === 0`) so ANY ⚠️/❌ suppresses "played well". For a flagged LOSS, show a consistent honest "review the flagged play" note (mirroring the won-but-flagged wording) instead of silence. |
| 4 | MINOR | Mental Math Step 6 "It's a free card — just take it" vs "Betting is worth ~$9" on the same card. | Thread the bet-vs-check EV the panel already computes into `conclusionFrom` (`betBeatsCheck`). On a free street with no made hand: if betting is the higher-EV action, Step 6 recommends betting (a +EV semi-bluff); only if checking is at least as good keep the free-card line. Step 6's recommended action must never contradict the EV table's winner. |
| 5 | NIT | A CO fold praised as folding "especially out of position". | Only add the "especially out of position" clause to the preflop chart-fold copy for genuinely OOP seats (blinds/UTG/MP). CO and BTN are late position → drop the clause there. Reuse the existing `isOutOfPosition` helper (same family as the iter-9 oversize OOP fix). |
| 6 | NIT | Conceptual depth shows digits in the result/review section ("Result: you lost 1 BB", "0 good · 1 thin · 1 mistake"). | At Conceptual depth render the result line WITHOUT a numeric amount ("You lost this hand." / "You won this hand." / "No money won or lost this hand.") and the tally in words ("one thin · one mistake"), so the whole panel is digit-free. Equity/Strict keep the numbers/counts. |
| 7 | NIT | Tiny seat text at 700×500 / 800×600 (legible, nothing clipped). | Make ONE low-risk legibility improvement IF safe (without breaking no-scroll + scale-to-fit + no-clip). If no safe win, leave it and document sub-800px legibility as an accepted scale-to-fit tradeoff. |

## Excluded (no code change, documented)

- The oversized open incrementing the "thin" tally rather than "mistake" is consistent with its ⚠️
  thin verdict/severity and is intentional — left as-is. The real bug was the variance-footer
  false-praise, fixed in #3.

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity / kind /
  conceptTag / plain-math — components READ `DecisionAnalysis` and never recompute. The chart guard and
  the recap depth-gating are pure presentation.
- HONESTY INVARIANT preserved: chart/`gtoClaim` true ONLY for spots the baseline chart models. #2
  fixes a misleading PRESENTATION; it does NOT invent any range (it uses `chartApplies`).
- No `HandRecord` schemaVersion change — changes are additive copy / display. Demo fixtures still
  validate (additive).
- Plain language always; money via `core/money.ts`; no-scroll + scale-to-fit guarantees preserved; all
  prior passing tests stay green (any that change do so because a copy clause was legitimately reworded).
</content>
