# Requirements — Reviewer iteration-2 fixes

**Tier:** 2 (bug/enhancement bundle; one small core-mental reconciliation, the rest presentational)
**Source:** `docs/playtest/reviews/iter-01.md` — an independent first-time-user playtest that logged 13
findings. (Finding #13, favicon 404, is NOT reproducible — `/favicon.ico` returns 200 — and is skipped.)
**Mode:** non-interactive

## Problem

A first-time user played the app and hit issues the earlier v0.6.0 pass didn't cover. The most
serious: the plain-language **Mental Math** walk-through (an outs-only model) directly contradicts
the verdict engine — it tells the user to fold a 47%-equity made hand, then the engine grades the
call "Easy call." Layout also breaks below ~1000px (controls clip off-screen), pending-decision
feedback shows stale numbers, and units are mixed when BB mode is on.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | On 4A3 holding A2 (top pair + gutshot) Mental Math counts only the 4 gutshot outs → "~13% can't pay the 27% price → fold", while true equity ≈47% and the engine says "Easy call." | Mental Math must detect a made hand (pair or better) and never present an outs-only fold when the player is already ahead. The Step-6 conclusion is driven by the true equity the engine uses, not raw outs. |
| 2 | MAJOR | On the turn it says "free card — just take it" (check), then the engine grades the check "❌ Mistake — value bet missed (~66%)." | Mental Math's conclusion must never contradict the engine's post-action verdict for the same decision; a made hand on a free street should mention being ahead / value, not a pure free-card check. |
| 3 | MAJOR | "Check your work" always blames the hit%-vs-win% gap on "opponents + board danger," even when the real cause is a made hand the outs count ignores. | The gap explanation must reflect the REAL cause: a made hand says so; a pure draw keeps the opponents/board-danger explanation. |
| 4 | MAJOR | At 800×600 and 600×900 the Fold/Check/Raise buttons + seats clip off the viewport edges; the table never reflows below ~1000px. | Down to ~600px the primary action controls + slider stay fully visible/clickable; seats are not clipped off the edges. Keep the no-scroll contract. |
| 5 | MAJOR | While deciding a new street, Live Feedback shows the PREVIOUS street's verdict + equity alongside Mental Math's current numbers — two unlabeled win%/EV figures at once. | When a later street's decision is pending, replace the stale verdict with a "Deciding your <street>…" pending state so only ONE set of numbers describes the decision in front of the user. |
| 6 | MINOR | The central "THIS ROUND" log overlaps the You/center seats at short/narrow sizes. | The log must not hide the center/"You" seat at common sizes (1366×768, 1024×640, narrow). |
| 7 | MINOR | Toggling to BB converts the table/banner but the Live Feedback text and the action/bet buttons stay in dollars — both unit systems on screen. | When BB mode is active, the feedback text and the action/bet buttons (and central pot/log + seat badges) also show BB. |
| 8 | MINOR | Instant feedback OFF leaves the right panel blank during play (reads as broken); the post-hand review still appears. | The OFF state shows a brief intentional hint during play; the post-hand Hand review behavior is consistent/expected. |
| 9 | NIT | After a FOLD the recap reads "Result: you won $0". | Use neutral plain wording for a $0 result ("no money won or lost"). |
| 10 | NIT | References > Preflop chart defaults to BTN regardless of the player's seat. | Default to the player's current seat/position when known; fall back to BTN. User can still override. |
| 11 | NIT | Setup: unclear whether a preset overrides per-bot style/skill. | Add a one-line plain hint stating the truth (a preset fills/replaces the per-bot choices). |
| 12 | NIT | All-in hands settle with fewer than 5 community cards showing (e.g. only the turn). | When all remaining players are all-in, the full 5-card board is shown at showdown. |

## Acceptance criteria

- AC1 (#1/#2): A made-hand spot (top pair + gutshot at ~47%) does NOT produce a fold/"price too
  steep" conclusion; the Step-6 conclusion agrees with the engine's "Easy call."
- AC2 (#3): The gap explanation differs between a pure-draw spot (opponents + board danger) and a
  made-hand spot (the made hand).
- AC3 (#4): The play grid reflows below ~1000px and the action bar wraps (no fixed width exceeding
  the felt); controls stay reachable to ~600px.
- AC4 (#5): A pending later-street decision shows a "Deciding your <street>…" card, not the prior
  verdict.
- AC5 (#7): In BB mode the feedback text and action/bet buttons show BB, no conflicting `$`.
- AC6 (#8): Feedback OFF shows an intentional hint during play.
- AC7 (#9): A $0 fold result is worded neutrally, never "you won $0."
- AC8 (#10): The preflop chart defaults to the player's seat when known.
- AC9 (#11): The setup screen states the preset/per-bot relationship in plain words.
- AC10 (#12): An all-in run-out shows all five community cards at showdown.
- All: `npm run typecheck`, `npm run lint`, `npm test` pass. `core/*` stays React-free; the feedback
  panel reads `DecisionAnalysis`/equity and never recomputes verdicts. No `HandRecord` schema change.

## Out of scope
- Bot logic, equity math internals, the coaching skill, the hand-record schema.
- Finding #13 (favicon) — not reproducible.
