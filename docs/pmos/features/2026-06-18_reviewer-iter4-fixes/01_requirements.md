# Requirements — Reviewer iteration-4 fixes

**Tier:** 2 (bug/enhancement bundle; analysis-copy + analysis-tag changes in `core/analysis`, a
display-semantics change threaded through `core/handFlow` → table/recap components, plus depth-aware
presentation in the feedback panel)
**Source:** `docs/playtest/reviews/iter-03.md` — an independent, context-free first-time-user
playtest of v0.8.0. The reviewer praised the setup screen, references, EV table, unit toggle, and
feedback/depth toggles, but logged a fresh round of negatives — **including TWO regressions the
iter-3 fixes introduced** (the board lagging a street; depth wording leaking).
**Mode:** non-interactive

## Problem

The most damaging finding is a regression: the community board renders one full street behind the
action, so the player decides the flop with 0 cards showing, the turn with only the flop, the river
with only 4. Two analysis-copy bugs actively mislead a newcomer: a ❌ river bet whose headline says
it "makes money over time" (a call/draw pot-odds template mis-applied to a bet), and a correct
Q-high river fold explained as "the pot isn't big enough" when the pot is huge (the real reason is
near-zero equity). Verdict tags contradict the action/street they judge ("call too wide" after a
RAISE; "good preflop discipline" after a RIVER fold). The "raise to N" number differs between the
button (total) and the round summary / recap (increment). The depth feature leaks (Conceptual shows
chart jargon; Strict shows an equity %). The EV table offers a "call" line when calling is illegal.
And the table still overlaps the hero seat at small/narrow window sizes.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR (regression) | The board lags one street: "Deciding your flop" → 0 cards; turn → 3; river → 4. The player never sees the street they're deciding. | Cap the board count ONLY during the bot-reveal animation. On a static hero decision (and at showdown) show the full live board (`view.board`), so the hero always sees their street's cards. Keep the bot-reveal cadence and the showdown run-out. |
| 2 | MAJOR | A ❌ river bet (raise EV −0.3 BB) whose headline read "you win ~32% but only need ~0% — that gap is why continuing makes money." Opposite messages in one view. | The "you only need ~Y% / makes money over time" pot-odds headline applies ONLY to a facing-a-bet CALL decision. For a bet/raise (or unopened) it must never render. A ❌-graded bet must not claim it makes money. |
| 3 | MAJOR (regression/incomplete) | At 800×600 the hero seat hides the center "Pot" label; at 600×900 the "THIS ROUND" box overlaps the hero seat. | The center pot + round-summary occupies a bounded upper-middle zone that ends clear of the bottom hero seat at any size; the felt scales so seats stay inside the viewport. No-scroll contract preserved. |
| 4 | MINOR | "call too wide" tag after a preflop RAISE; "good preflop discipline" tag after a RIVER fold. | Concept tags must match the action + street. A preflop raise that should fold is tagged action-neutrally (not "call"); a sound non-preflop fold gets a street-neutral discipline tag. |
| 5 | MINOR | Folding Q-high to ~61 BB into a ~298 BB pot was explained "the pot isn't big enough" — but it's huge; the honest reason is near-zero equity. | When a fold is correct because equity is far below the price (not because the pot is small), cite the low win-chance vs the price, not a "pot isn't big enough" rationale. |
| 6 | MINOR | Button "Raise to 2 BB" (total) vs round summary / recap "Raise 1 BB" / "raised to 1 BB" (increment) — same phrasing, different number. | Use ONE semantics for the displayed "raise to" number — the TOTAL the player raised TO — consistently across the button, round summary, and hand review. |
| 7 | MINOR/MOD | Depth wording leaks: Conceptual surfaced chart language + a "chart-based" badge; Strict showed "~57%" equity. | Conceptual = plain words, NO equity %, NO "chart-based" badge / jargon chips. Equity = lead with win-rate %. Strict = chart/GTO citation (badge OK), no bare equity %. The badge/chips respect depth. |
| 8 | MINOR | The EV table listed "Average result if you call: 2.6 BB" on an unopened river where calling was illegal. | The EV table lists only the actions actually legal in the spot (fold/check/bet unopened; fold/call/raise facing a bet). |
| 9 | NIT | Q7o on A-2-K quoted ~47% reads surprisingly high. | Do NOT change the equity math. Make the "vs an assumed range" context legible near a surprising equity figure so a newcomer understands why. |

## Non-goals / explicitly NOT bugs (per the brief)

- The "ReferenceError: resultLine is not defined at HandRecap.tsx:241" was a stale hot-reload
  artifact (`resultLine` is defined at line 45, used at 139; line 241 doesn't exist). SAFETY step
  only: add a recap render test on the hand-complete path for a win and a loss.
- `/favicon.ico` 404 was a stale artifact — skipped.

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; the decision **analysis** remains the single source of verdict / conceptTag /
  plain sentence / gtoClaim — components read it. Depth-aware PRESENTATION (which numbers to surface)
  is a presentational concern in the feedback panel; it never recomputes a verdict.
- `gtoClaim` stays true only for preflop chart feedback; equity is "vs an assumed range."
- No `HandRecord` schemaVersion bump (the new `toAmount` is an additive optional field).
- Plain language always; money via `formatMoney`; no-scroll contract preserved.
