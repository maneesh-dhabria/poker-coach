# Requirements — Reviewer iteration-6 fixes

**Tier:** 2 (bug/correctness + UX bundle; the headline is a coaching-honesty correctness bug in
`core/analysis/*`, plus EV-table/copy/money-format polish in `core/analysis/*`, `core/money.ts`, and
`components/FeedbackPanel.tsx`)
**Source:** `docs/playtest/reviews/iter-06.md` — an independent, context-free first-time-user
playtest of v0.10.0. The reviewer CONFIRMED the big prior fixes held (table layout clean at every
window size, board always matches the street, BB/$ reconciles everywhere, no win-vs-verdict
contradictions, clean console) and logged a fresh round of negatives.
**Mode:** non-interactive

## Problem

One MAJOR correctness/honesty bug: a genuine made hand (two pair — 4♠2♠ on a 3♠4♣3♦ flop) had its
value bet graded "❌ Mistake · bluff no equity · …there's not enough behind it." Calling a real made
hand a "bluff with no equity" directly contradicts the cards in the hero's own hand and would
confuse a newcomer. The remaining findings are smaller copy/UX defects: a "beting" typo, an
unflagged absurd preflop open size, wrong EV-mini-table row labels for a preflop open-raise, a
"-$0" negative-zero render, and a near-breakeven call graded a hard mistake.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | A made two-pair value bet was tagged `bluff_no_equity` / "❌ Mistake" / "bluff … nothing behind it". Root cause: `aggressionBranch(equityPct)` classifies on equity alone, no made-hand awareness. | Give the aggression branch made-hand awareness via the existing pure `detectMadeHand(hole, board)`. A bet/raise holding a made hand (pair or better) must NOT be tagged `bluff_no_equity` and must NOT be described as a "bluff"/"no equity"/"nothing behind it". Reframe as a (thin/vulnerable-multiway) VALUE bet that NAMES the made hand. Keep `bluff_no_equity` ONLY for a genuine no-made-hand low-equity bet. New tag `made_hand_thin_value`. Thread optional `hole`/`board` into `analyze()` (additive; card-less callers keep today's behavior). |
| 2 | MINOR | Conceptual flop verdict read "You're beting with little behind it" — typo. Root cause: `\`${act}ing\`` where `act="bet"`. | Build the present-participle explicitly ("bet"→"betting"). Grep the repo for "beting"/"raiseing"/"caling". Test the copy contains "betting", not "beting". |
| 3 | MINOR | A deliberate $104 (~52 BB) UTG open of a $3 pot was praised "✅ Good · the standard, profitable play". `preflopBranch` compares the ACTION class (raise vs fold) only, never the SIZE. | When a preflop OPEN/raise size is clearly absurd (≥ ~10 BB open), the verdict must NOT call it "the standard, profitable play"; add a `preflop_oversize` tag and reword to flag that the size is far larger than a standard open (raising can still be right — the SIZE is off). Thread optional raise-to + big blind into `analyze()`. Conservative: never false-positive a normal 2–4 BB open. |
| 4 | MINOR | After a preflop RAISE, the "Show the numbers" EV table showed "if you check / if you bet" — neither matches the action (raise) and there was no check option. Root cause: `evRows(ev, facingBet)` only handles facing-bet vs check/bet. | Make `evRows` reflect the legal action set: facing a bet → fold/call/raise; preflop open-raise (no bet to call) → fold/raise (no phantom "check"); unopened postflop → check/bet. |
| 5 | NIT | "Average result if you bet: -$0" (negative zero) reads awkwardly. | Normalize a magnitude that rounds to zero to "$0"/"0 BB" (no leading minus) in `formatMoney`. |
| 6 | NIT | A 4♠2♠ BB call at ~14% equity vs ~13.5% needed (essentially breakeven) was reportedly a flat ❌ mistake. | VERIFY first: the reported "mistake" was the PREFLOP CHART override (chart says fold BB), not the price-branch `callBranch`. `callBranch` already grades a +0.5-edge call "thin". Still, widen the thin band slightly (`edge >= -2`) so an essentially-breakeven price-branch call grades ⚠️ thin, not ❌ mistake; clearly -EV calls stay mistakes. |

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / conceptTag / plain
  sentence / gtoClaim — components read it, never recompute. `detectMadeHand` lives in the pure
  `core/mental/estimate.ts`; importing it into `core/analysis` is fine (both are pure core).
- HONESTY: a made hand is described as value, never a bluff; equity stays "vs an assumed range" of
  the live opponents, never their real cards. `gtoClaim` stays true only for preflop chart feedback.
- No `HandRecord` schemaVersion bump — `hole`/`board`/`raiseToAmount`/`bigBlind` are additive
  optional `analyze()` inputs and `madeHand`/`openSizeBb` are additive optional keys on
  `explanationInput`; the schema validator ignores extra keys. The demo fixtures gain an additive
  `explanationInput.madeHand` (the app↔coach contract; they still validate).
- Plain language always; money via `core/money.ts` / the explain builder's unit; no-scroll preserved.
