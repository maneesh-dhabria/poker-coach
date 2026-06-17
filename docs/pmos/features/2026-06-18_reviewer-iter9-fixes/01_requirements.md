# Requirements — Reviewer iteration-9 fixes

**Tier:** 2 (coaching-consistency + UX polish bundle — two MAJORs that pair a verdict with
self-contradicting numbers / leak numbers into a numbers-free depth; the rest MINOR/NIT)
**Source:** `docs/playtest/reviews/iter-09.md` — an independent, context-free first-time-user playtest
of v0.13.0. Layout/units/console were clean across five window sizes; the verdict/equity/Mental-Math
single-source held. The findings are about CONSISTENCY (a card whose verdict and visible numbers
disagree), a depth leak, discoverability of the live panel, and small copy/contrast/wording polish.

## Problem

- A preflop chart FOLD card praised folding as "standard, profitable" while, on the SAME card, its
  pot-odds line said "you only need ~17% … continuing makes money over time" and its EV table ranked
  fold ($0) below call/raise ($1). A newcomer trusting the green ✅ was pushed toward the worst-EV play.
- At Conceptual depth ("Plain words, no numbers") the Mental Math accordion still showed the full
  numeric body — percentages, outs/×4, pot-odds, and the literal "Rule-of-4 … exact hit chance (16.5%)".
- Because bots act instantly, the rich live panel (verdict + equity bar + Mental Math) was blanked to
  an empty "Deciding your <street>…" placeholder the moment the hero's action closed a round, so an
  instant-feedback newcomer often never read the feature they turned on.
- Small issues: an "out of position" warning fired on the BTN; an oversize open was tagged "⚠️ Thin";
  a ~31% air-shove was called "bluff no equity"; subtle card suit contrast; a river EV "$9" read as
  contradicting the whole-hand "lost $18"; Strict's chart voice didn't fire on a BB open-over-limpers.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | A preflop chart FOLD verdict ("folding is standard, profitable") contradicted its own "you only need ~17% … makes money over time" pot-odds line and its EV table (fold $0 < call/raise $1). Root: `showWhyLine = facingBet && need !== null` — a SB folding to the BB IS "facing a bet", so the postflop price frame fired on a preflop CHART decision. | The pot-odds whyLine, the equity-bar "need ~%" marker, AND the EV "Show the numbers" table must NOT appear on a preflop chart decision (`kind === "preflop"`) — they belong to the postflop price/odds frames. The equity % bar may still show, without the contradicting editorialization. Reword the preflop "good" copy so it never claims a FOLD is "profitable" (the EV of folding is $0); add a one-line reconciliation that raw equity can look tempting but a weak hand plays poorly OOP, so the standard play folds. |
| 2 | MAJOR | At Conceptual depth, Mental Math showed full numbers + Rule of 4 (iter-8 only hid the named jargon, not the numeric body). | At Conceptual depth, render NOTHING in the Mental Math section (the section, its toggle, and its caption) — Mental Math is fundamentally a numeric tool and Conceptual promises no numbers. Keep the full numeric Mental Math at Equity + Strict depths. |
| 3 | MINOR | The rich live panel was unreachable between decisions — blanked to an empty placeholder whenever the hero's action closed the round. | Instead of blanking, KEEP the prior decision's full feedback (verdict + equity bar + Mental Math) visible and readable, clearly RE-LABELED ("Your last decision — <street>" + "now deciding your <street>; this updates when you act") so it can't be mistaken for the current spot. Clearing at end-of-hand stays. |
| 4 | MINOR | 700×500 — table text barely legible (layout sound, just small). | Low-risk only: trim the stage's surrounding padding so the scale-to-fit box scales up a little before clamping, WITHOUT changing the fixed geometry (no clip/overlap, no-scroll preserved). |
| 5 | NIT | "out of position" claimed on the BTN oversize-open warning. | Make the OOP clause position-aware: only say "out of position" when the hero is actually OOP (UTG/MP/SB/BB); on the BTN/CO use the position-neutral "bloats the pot and risks a lot to win a little". |
| 6 | NIT | (a) oversize open tagged "⚠️ Thin" (reads as thin value); (b) ~31% air-shove tagged "bluff no equity". | (a) Show "⚠️ Oversized" for the oversize case (same ⚠️ icon/severity). (b) Reserve "no equity" for genuinely tiny equity (< ~20%); for ~20–33% with no made hand, word it as a thin/light semi-bluff (the -EV grade stays). |
| 7 | NIT | Strict's chart voice fired on an SB open (6♣8♦) but not on a BB open-over-limpers (7♥3♠). | Investigate. If legitimate, leave + explain. (RESULT: legitimate — the baseline RFI chart has no BB open-first-in range; the BB never opens unopened in standard play, so `chartApplies(BB,"unopened")` is false by design. Adding a fabricated BB RFI range would invent a chart claim that doesn't exist, violating the honesty invariant. Strict's chart voice fires for every spot the chart actually models, including BB-defend vs a raise.) |
| 8 | NIT | Card suit colors subtle on the dark felt (black misread as red). | Low-risk CSS only: brighter/more-saturated red + truer ink-black suit colors and a slightly larger suit glyph, no card sizing/layout change. |
| 9 | NIT | River EV "Average result if you check: $9" near "Result: you lost $18" reads as contradictory. | Add a short label to the EV table making clear it's "from here / going forward", not the whole-hand result. |

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity / kind /
  conceptTag / plain-math — components READ `DecisionAnalysis` (the `kind` discriminator drives the
  price-frame gating) and never recompute.
- HONESTY INVARIANT preserved: `gtoClaim` true ONLY for preflop chart feedback; equity is "vs an
  assumed range". #1 removes the price editorialization from preflop; it does NOT add any new claim.
  #7 is left as-is precisely to avoid inventing a chart claim.
- No `HandRecord` schemaVersion change — the only new surface is the additive optional
  `bluff_thin_equity` concept tag. Demo fixtures still validate.
- Plain language always; money via `core/money.ts`; no-scroll + scale-to-fit guarantees preserved;
  all prior passing tests stay green (the RightPanel "blanking" tests and the iter-06 preflop-open EV
  table test legitimately change because iter-09 #3/#1 reverse/supersede them).
