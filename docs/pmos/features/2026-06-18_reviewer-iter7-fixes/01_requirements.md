# Requirements — Reviewer iteration-7 fixes

**Tier:** 2 (coaching-correctness bundle; the headline is a single-source-of-equity bug where the
Mental Math block shows a DIFFERENT win-% than the verdict for the same decision, plus a
made-hand-detection bug and a pending-copy nit)
**Source:** `docs/playtest/reviews/iter-07.md` — an independent, context-free first-time-user
playtest of v0.11.0. The reviewer CONFIRMED the prior structural wins held (layout clean at every
window size, board always matches the street, BB/$ reconciles everywhere, verdict tags match the
action/street, no "-$0", no spelling errors, clean console) and logged a fresh round of negatives,
all about the Mental Math panel disagreeing with the verdict.

## Problem

The Feedback panel showed TWO different win-percentages for the SAME decision. The verdict and the
equity bar use `analysis.numbers.equityPct` (e.g. 35%, multiway vs the live opponents' ranges),
while the Mental Math block below ran its OWN separate `requestEquity(...)` Monte Carlo that returned
a different number (e.g. 64%). A newcomer saw "You win ~35% / thin" directly above "True win ≈ 64% /
you're often ahead" and could not reconcile them. Two sub-symptoms made it worse: (a) a board-only
pair was reported as "your" made hand (J-high on a paired board read as "you already have a pair"),
and (b) the made-hand "often ahead" line fired regardless of equity, so top pair at 35% multiway
wrongly read "often ahead".

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | Same panel, two win-%: verdict "You win ~35%" / "thin" vs Mental Math "True win ≈ 64%" / "$109 EV" — its own separate Monte Carlo on a different basis. | Make `analysis.numbers.equityPct` (the verdict/equity-bar figure) the SINGLE source of the Mental Math "true win": its "True win ≈ X%", the Step-6 `conclusionFrom`, the `gapExplanation`, AND the "$ value of calling" EV. Pass the verdict equity into `MentalMathSection` as a prop from `FeedbackPanel` and REMOVE the independent `requestEquity` call (and its loading state) so they can never drift. Add a test that the Mental Math true win equals the verdict's `equityPct` for the same spot. |
| 2a | MAJOR | `detectMadeHand` returned a made hand even when the hero's HOLE cards contribute nothing — 6♠J♥ (J-high) on 8♦8♣Q♦ returned "a pair" because the board pairs the 8s. The hero plays the board. | `detectMadeHand` returns a made hand ONLY when the hero's hole cards improve on the board alone (hole-card participation): a pair counts only if a hole card pairs the board OR the hole is a pocket pair; board-only two-pair/trips/straight/flush (no hole card participates) returns `null`. Principled "must beat the board-alone category" check, not a special-case for 8s. This also flows into the iter-6 analysis aggression branch, so a board-paired no-contribution hand correctly grades as a bluff again. |
| 2b | MAJOR | "You already have <made hand> — so you're often ahead already" fired whenever a made hand existed, regardless of equity — top pair at 35% multiway wrongly read "often ahead". | Gate the "often ahead" claim on the unified equity from #1: only say "often ahead" when the win-% is actually high (≳55%). Below that, say something honest that matches the verdict, e.g. "you have top pair, but with N players still in you're only ~35% to win — it's marginal." The made-hand statement must never contradict the verdict's grade. |
| 3 | MINOR | The "Deciding your <street>…" pending card says "The numbers below (Mental Math) are for this <street> decision," but the pending card REPLACES the FeedbackPanel (which holds Mental Math), so "below" points at nothing. | Reword the pending copy so it does not promise "numbers below (Mental Math)" when none are shown; keep its purpose (the last verdict was for an earlier street) intact. Adjust the `RightPanel` test for the corrected copy. |

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity — components
  read it, never recompute. `core/mental/*` is pure/sync; the equity is passed IN by the component.
- After #1 there is exactly ONE win-% per decision across the whole panel (verdict, equity bar,
  Mental Math "true win", made-hand line, gap explanation, EV). The made-hand line never claims a
  lead the equity contradicts.
- `detectMadeHand` lives in pure `core/mental/estimate.ts`; the participation check uses the existing
  pure evaluator (`rank5`/`categoryOf`). No React/DOM in core.
- No `HandRecord` schemaVersion change — the only new surface is an additive optional
  `verdictEquityPct` prop on `MentalMathSection` (a component prop, not persisted). The demo fixtures
  are unaffected and still validate.
- Plain language always; money via `core/money.ts`; no-scroll preserved; all prior passing tests stay
  green.
