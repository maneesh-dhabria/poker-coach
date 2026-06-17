# Requirements — Reviewer iteration-8 fixes

**Tier:** 2 (coaching-correctness + bot-realism polish bundle; no structural defects — every prior
fix held)
**Source:** `docs/playtest/reviews/iter-08.md` — an independent, context-free first-time-user playtest
of v0.12.0. The reviewer found NO MAJOR issues: one consistent win-% per decision across
verdict/odds-bar/Mental Math, no false "you already have a hand", legal-only EV tables, clean
layout/units/console at five window sizes. The remaining findings are MINOR/NIT polish.

## Problem

A handful of small correctness/realism gaps remained:

- A gross UNDER-bet ($2 into a $360 pot) was praised as good value, even though a preflop OVER-size in
  the same hand was correctly flagged. Sizing awareness was asymmetric.
- On a value BET, the Mental Math dollar-EV line said "**Calling** is worth …" — wrong action verb;
  the verdict header correctly said "Betting for value".
- Calling-station bots called/stacked off vs gross overbets with trash — the loose call-down was not
  price-aware.
- Jargon leaked into the numbers-free Conceptual depth (the "Rule of 2 & 4" name + a Preflop Chart
  reference).
- The Equity+Heuristics copy named "the baseline chart" — a chart citation at a non-Strict depth.
- Two identical "Turn —" rows when the hero bet then called a raise on the same street.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MINOR | $2 into a $360 pot graded ✅ GOOD "get money in while ahead" — a comical underbet praised as standard value; oversized OPENS are flagged but gross UNDER-sizes weren't. | Give the postflop value-bet path bet-SIZE awareness, symmetric to the preflop oversize check. When a CLEAN bet (no bet to call) is grossly small relative to the pot (< ~15% pot — conservative so 25–33% small bets are NOT penalized), do not praise it as value: downgrade to ⚠️ thin, add a `bet_too_small` tag, and reword to say the bet is too small to charge draws / build the pot. Thread the bet-to amount the same additive way as the preflop oversize size (already on `analyze`). |
| 2 | MINOR | On a value BET the Mental Math dollar-EV line read "Calling is worth about $X" — same action labeled "Betting" (header) and "Calling" (EV line) in one panel. | Make the dollar-EV verb match the ACTUAL action: "Betting is worth …" when there is no bet to call (`toCall === 0`), "Calling is worth …" only when facing a bet (`toCall > 0`). The math is unchanged (`toCall` is 0 for a bet); only the label changes. |
| 3 | MINOR | Five bots cold-called a 30 BB open and later stacked off 100 BB with trash/bottom-pair vs a gross overbet — the loose station call-down ignored the price. | Make the loose/station call-down PRICE-AWARE: only take the random light call-down when the price is not bad (`potOdds` below a cap), and shrink `stationSlack` toward 0 as `potOdds` rises. Facing a gross overbet, even a Calling Station folds trash; facing a normal ~half-pot bet, a station still calls loosely (preserve the flavor — don't turn stations into nits). |
| 4 | MINOR/NIT | In Conceptual ("plain words, no numbers") the Mental Math drawer surfaced "The Rule of 2 & 4 … see the Preflop Chart tab" and a "Rule of 2 & 4" label. | In Conceptual depth, suppress the "Rule of 2 & 4" jargon name and the Preflop Chart reference; use plain wording. Keep the jargon at Equity/Strict depths. The section reads the depth from the session store. |
| 5 | NIT | Equity+Heuristics fold/raise copy said "…which is what the baseline chart recommends too" / "(the baseline chart agrees)" — a chart citation at a non-Strict depth. | At Equity depth, refer to it as "the standard play"; reserve explicit chart citations for Strict depth (which keeps its chart badge + "the baseline chart says…"). Preserve the honest meaning — it IS the standard recommendation. |
| 6 | NIT | Two identical "Turn —" rows in the hand review when the hero bet then called a raise on the same street. | Disambiguate a 2nd+ same-street hero action by prefixing it with "then" → "Turn — you then called $54". |

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity — components
  read it, never recompute. `core/bots/*` is pure bot logic; `core/mental/*` is pure/sync.
- HONESTY INVARIANT preserved: `gtoClaim` stays true only for preflop chart feedback. #5 only changes
  the wording at Equity depth; it never claims chart-correctness where it shouldn't, and Strict keeps
  its chart citation.
- The under-size flag must not contradict a genuinely fine 25–33% small bet (conservative cutoff). The
  bot price-awareness must not make stations fold normal bets. The EV-verb fix must match the verdict's
  action verb.
- No `HandRecord` schemaVersion change — new surface is the additive optional `bet_too_small` concept
  tag and an additive optional `betTooSmall` field on `ExplanationInput`. Demo fixtures still validate.
- Plain language always; money via `core/money.ts`; no-scroll preserved; all prior passing tests stay
  green.
