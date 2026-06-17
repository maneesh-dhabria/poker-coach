# Requirements — First-time-user UX fixes

**Tier:** 2 (enhancement bundle; multiple small UI fixes, no schema/engine change)
**Source:** `docs/playtest/scratchpad.md` — a first-time-user playtest that logged the
confusing/irritating moments (EMOTION entries) below.
**Mode:** non-interactive

## Problem

A first-time user who knows poker basics but nothing about *this app* hit several friction points
that produced negative emotions. The instant-feedback coaching itself is good; the friction is in
layout, empty states, sync, and unexplained jargon.

## Findings → requirements

| # | Sev | Finding (from playtest) | Requirement |
|---|-----|--------------------------|-------------|
| 1 | BLOCKER | On viewports < ~720px tall, the Fold/Call/Raise action bar falls below the fold with no scrollbar — the player cannot act. Hit on first load and at 1024×640. | The play view must keep the action bar reachable at any reasonable viewport: either fit-to-viewport so nothing is clipped, or allow the page to scroll with the action bar always visible (sticky). No primary control may be unreachable. |
| 2 | CONFUSING | The Live Feedback panel is a large blank pane before the first action and on every new hand — reads as "failed to load". | Show a friendly empty-state placeholder in the Live Feedback tab when there is no decision yet, telling the user feedback appears after their move. |
| 3 | CONFUSING | Live Feedback analyses the decision just made, but bots have already acted and the street/pot advanced, so the equity %, pot, and board it cites don't match the live table. | Anchor each live-feedback card (and ideally each hand-review row) to the street/board/pot it actually refers to — a caption like "when you called the flop (T♣ 9♠ K♠)" — so the numbers are unambiguous. |
| 4 | CONFUSING | Setup-screen jargon TAG/LAG/Nit unexplained for a basics-only player. | Add plain-language gloss/tooltips next to the opponent Style selectors (and table presets) — e.g. "TAG — tight & aggressive". |
| 5 | mild | "You won $X" shows beside a red ❌ mistake badge with no reconciliation. | Add one plain line reconciling result vs verdict (e.g. "You won this hand, but that call loses money on average"). |
| 6 | nit | 404 on /favicon.ico. | Provide a favicon so the request resolves. |

## Acceptance criteria

- AC1: At 1024×640 and 1280×720, the Fold/Call/Raise controls are visible/reachable without the
  layout clipping them; verified in-browser with a screenshot.
- AC2: A new hand (before any user action) shows a non-empty Live Feedback placeholder, not a blank pane.
- AC3: Each live-feedback verdict card shows which street/board it refers to.
- AC4: Setup screen exposes plain-language meaning for TAG/LAG/Nit/Calling Station and presets.
- AC5: A won hand whose decision was a mistake shows a reconciling sentence.
- AC6: No /favicon.ico 404 in console on load.
- All: `npm run typecheck`, `npm run lint`, `npm test` pass. core/* stays React-free; components read
  DecisionAnalysis without recomputing.

## Out of scope
- Changing bot logic, equity math, the coaching skill, or the hand-record schema.
