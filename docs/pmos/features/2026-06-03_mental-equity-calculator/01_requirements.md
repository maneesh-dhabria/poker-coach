# Mental Math Tab (Outs & Equity Calculator) — Requirements

**Date:** 2026-06-03
**Last updated:** 2026-06-03
**Status:** Draft
**Tier:** 2 — Enhancement

## Problem

The Poker Coach app already computes exact equity (Monte Carlo) and gives a verdict after each
decision. But at a real table there is **no solver** — you have to estimate equity in your head:
count your outs, apply the Rule of 2 and 4, shade for opponents and dangerous boards, compare to the
price. `docs/mental-equity-guide.md` documents that whole mental process, but it is a static document.
**There is no way to practice that estimation against your actual hand and immediately see how close
your mental number was to the truth.**

### Who experiences this?

The single user of the app — a 6-max NLHE cash player who is **explicitly not a math person**
(per project memory) and wants to build the *in-head* estimation habit, not just read about it. They
are mid-hand, looking at a flop or turn, and want to walk the guide's steps for *this* situation and
then check their work.

### Why now?

The mental-equity guide was just written (`docs/mental-equity-guide.md`, v0.1, 2026-06-03) and is
explicitly marked as "the source content for a planned Mental Math tab." The app already exposes every
input the calculator needs (hole cards, board, pot, cost-to-call, active opponents) and already has the
Monte Carlo engine to provide the "true" answer for comparison. The teaching loop — *estimate, then
verify* — is the missing piece.

## Goals & Non-Goals

### Goals

- The player can open a **Mental Math tab** and see the guide's estimation process worked through for
  their **current live hand**, step by step — measured by: every step in the guide (outs → Rule of 2&4
  → opponent discount → taint discount → pot odds → decision) renders for a flop/turn hand with no
  manual data entry.
- The player learns to **count outs**, because the tab auto-detects their draws and names each one in
  plain language ("9 spades left = flush draw") — measured by: each counted out group has a one-line
  plain explanation, and the player can **override** the count if they disagree.
- The player sees **how good their mental estimate is**, because the tab reveals the app's Monte Carlo
  "true" equity alongside the hand-estimated number — measured by: a side-by-side "you estimated ~X% /
  true ≈ Y%" comparison with a plain "you were close / you over-counted" note.
- Every number is **plain-language and visual**, never bare math — measured by: no un-explained formula
  or decimal appears without a sentence a non-math person can read (consistent with the project's
  plain-language requirement and the existing FeedbackPanel style).

### Non-Goals

- **NOT** a standalone manual-input calculator (type/pick arbitrary cards) — because the user explicitly
  scoped v1 to the live hand only ("Don't need an independent calculator interface for now"). Manual
  entry is a candidate future enhancement, not v1.
- **NOT** a "guess first, then reveal" active-recall quiz mode — because the user chose the guided
  walk-through for v1; quiz mode is a documented future enhancement.
- **NOT** preflop range/equity estimation — because the guide's Rule of 2 and 4 is a post-flop tool
  (cards still to come); preflop has its own chart tab already.
- **NOT** river estimation math — because on the river there are no cards to come, so out-counting and
  the Rule do not apply (the tab will say so plainly rather than show a misleading number).
- **NOT** a new persisted data model — because the calculator is a read-only view over live game state;
  nothing new is saved to `data/`.
- **NOT** changing the existing instant-feedback verdict, the analyze() output, or the equity engine —
  because the tab is additive; it reuses those, it does not alter them.

## Solution Direction

Add a sixth tab, **"Mental Math"**, to the existing right-panel tab strip. It is a **read-only lens over
the current in-progress hand** — it pulls hero hole cards, the board, the pot, the cost-to-call, and the
number of active opponents from game state. It never asks the user to type anything except an optional
outs override.

The tab renders the guide's six steps as a **vertical, scannable walk-through**, each step a small
labeled card with a plain sentence and the running number. The same dark-felt visual language as the
existing FeedbackPanel (verdict colors, equity bar, chips for concept labels).

```
 Mental Math  ── (reads your current hand: Q♥ J♥ on 10♥ 9♣ 2♥, pot $60, to call $20, 2 opponents)

 ┌ Step 1 · Your outs ─────────────────────────────┐
 │ Flush draw — 9 hearts left                       │
 │ Open-ended straight — 8 cards (K, 8)             │
 │ Overlap: K♥, 8♥ counted once                     │
 │ ➜ 15 outs        [ I count differently ▸ ]       │
 └──────────────────────────────────────────────────┘
 ┌ Step 2 · Chance you hit (Rule of 2 & 4) ─────────┐
 │ Flop → ×4 → about 57% to hit by the river        │
 └──────────────────────────────────────────────────┘
 ┌ Step 3 · Shade for opponents ────────────────────┐
 │ 2 opponents (multiway) → trim a little → ~48%     │
 └──────────────────────────────────────────────────┘
 ┌ Step 4 · Tainted outs (board danger) ────────────┐
 │ Two-tone board; your flush is Q-high → stay a     │
 │ touch conservative                                │
 └──────────────────────────────────────────────────┘
 ┌ Step 5 · The price (pot odds) ───────────────────┐
 │ Call $20 into $80 → you need about 25% to break   │
 │ even   [▓▓▓▓▓░░░░░] need 25%                       │
 └──────────────────────────────────────────────────┘
 ┌ Step 6 · The call ───────────────────────────────┐
 │ ~48% beats the 25% price → calling is profitable  │
 └──────────────────────────────────────────────────┘
 ┌ Check your work ─────────────────────────────────┐
 │ You estimated ~48%   ·   True ≈ 51%               │
 │ Nice — your mental math was close (within 5%).    │
 │ [ Show the dollar EV ▸ ]                          │
 └──────────────────────────────────────────────────┘
```

The "true ≈ Y%" number comes from the existing Monte Carlo equity client (the same engine the instant
feedback uses), called for the current hand. The mental estimate is computed by a new, **deterministic**
out-counting + Rule-of-2&4 + discount routine that mirrors the guide exactly (so the teaching matches
the document, not a black box).

## User Journeys

### Primary Journey — walk a flop draw

1. The player is in a hand; the flop is out and it's their decision (or they just want to think).
2. They click the **Mental Math** tab in the right panel.
3. The tab reads the live hand and shows **Step 1 · Your outs**: it has auto-detected the draws,
   listed each in plain language, handled overlaps, and shows a total outs count.
4. The player reads **Step 2** (Rule of 2 & 4 → estimated hit %), **Step 3** (opponent shade),
   **Step 4** (taint warning for the board texture), **Step 5** (pot odds / break-even %), and
   **Step 6** (the estimate-vs-price decision sentence).
5. The player scrolls to **Check your work** and sees their estimated % beside the app's true
   Monte Carlo %, with a one-line "close / you over-counted / you under-counted" note.
6. (Optional) They expand **Show the dollar EV** for the EV-of-calling figure.

### Alternate Journey — disagree with the out count

1. At Step 1, the player thinks an out is tainted (or the auto-count missed one).
2. They click **"I count differently"**, adjust the number (and optionally toggle the suggested
   tainted outs on/off).
3. Steps 2–6 and the comparison **recompute live** from the player's number, so they see how the
   estimate and decision change. (The true Monte Carlo number does not change — it is ground truth.)

### Error / Edge-Case Journeys

| Scenario | Condition | Expected behavior |
|----------|-----------|-------------------|
| No hand in progress | No active hand / pre-deal | Empty state: "Deal a hand and reach the flop to use Mental Math." No numbers shown. |
| Preflop | Street is preflop | Plain note: "The Rule of 2 and 4 is for the flop and turn. Check the Preflop Chart tab for preflop." No outs math. |
| River | Street is river (5 board cards) | Plain note: "No cards left to come on the river — you either have your hand or you don't. Nothing to estimate." Still shows pot-odds + true equity if useful. |
| No draw detected | Made hand or air, no countable draw | Step 1 shows "No clear drawing outs detected (you may already have the best hand, or be drawing thin)." Estimate is conservative; true equity still shown. |
| Hero has folded / not in hand | Hero seat folded | Empty state as "no hand in progress." |
| True equity still computing | Monte Carlo in flight | "Check your work" shows a small "calculating true equity…" state, then fills in; the mental steps never block on it. |

## Design Decisions

| # | Decision | Options Considered | Rationale |
|---|----------|-------------------|-----------|
| D1 | Calculator operates on the **live hand only**, no manual entry | (a) standalone manual-input calc, (b) live hand only, (c) both | User explicitly scoped to live-hand-only for v1; removes the need for a card-picker component and keeps the tab focused. Manual entry is a future non-goal. |
| D2 | Show **mental estimate AND the app's true Monte Carlo** | (a) mental only, (b) true only, (c) both side-by-side | The teaching loop *is* estimate-then-verify; showing both is the core value. Mental-only never closes the loop; true-only abandons the guide. |
| D3 | **Auto-count outs + plain explanation, with manual override** | (a) user enters outs, (b) auto only, (c) auto + override | Auto-counting teaches what the draws are; override respects the player's read and lets them explore "what if 4 of these are tainted." |
| D4 | Mental estimate uses a **new deterministic routine that mirrors the guide**, not the Monte Carlo engine | (a) reuse Monte Carlo for the "estimate" too, (b) deterministic guide-faithful routine | The whole point is to reproduce the *in-head* method so the teaching matches `mental-equity-guide.md` and is comparable against the true number. A second Monte Carlo call would just be the true number twice. |
| D5 | Applies on **flop and turn only**; preflop/river show plain guidance instead | (a) all streets, (b) flop+turn only | The Rule of 2 and 4 is defined only when cards are still to come; faking a preflop/river number would teach the wrong thing. |
| D6 | Tab is **read-only over game state**, persists nothing | (a) save calculator sessions, (b) read-only | It is an analysis lens; saving adds a data model for no stated benefit. Keeps scope and the `data/` contract unchanged. |
| D7 | Opponent + taint discounts follow the **guide's heuristics** (shave ranges by player count; board-texture triggers) and are **shown as ranges/notes, not false precision** | (a) precise discount %, (b) guide-style ranges + notes | The guide is explicit that hit≠win and that these are estimates; presenting a single precise discounted % would be dishonest precision. |

## Open Questions

| # | Question |
|---|----------|
| 1 | For the opponent discount, should the tab use a single representative shaded number (e.g., "~48%") or a small range ("~46–50%")? The guide uses ranges; a single number is simpler to compare against the true %. (Lean: show a single shaded midpoint for the comparison, mention the range in the sentence.) — resolve in /spec. |
| 2 | Exact taint-detection depth: should v1 auto-flag tainted outs and *suggest* a reduced count (player confirms via override), or only show a textual board-danger warning and leave the count untouched? (Lean: textual warning in v1 + override; auto-subtraction is a refinement.) — resolve in /spec. |
| 3 | Should "Check your work" persist a tiny running accuracy stat across the session ("your estimates averaged within 6%")? Out of scope for v1 (no persistence), but a natural enhancement — note for future. |

## Research Sources

| Source | Type | Key Takeaway |
|--------|------|-------------|
| `docs/mental-equity-guide.md` | Internal doc | The exact 6-step process, out tables, discount heuristics, taint rules, and worked example the tab must mirror. |
| `core/equity/equity.ts`, `core/equity/equityClient.ts`, `workers/equity.worker.ts` | Existing code | `requestEquity({hero, board, numOpponents, iterations})` gives the "true" equity; async with sync fallback — reuse for the comparison. |
| `core/cards.ts` | Existing code | `Card = "${Rank}${Suit}"`, `rankOf/suitOf/rankValue`, deck utils — the basis for out-counting. |
| `core/analysis/analyze.ts` + `types.ts` | Existing code | `DecisionAnalysis` (verdict, potOddsPct, ev, plainExplanation) and `analyze()` — reuse pot-odds + EV + plain-language patterns so the tab matches existing coaching. |
| `store/sessionStore.ts` (`TabKey`, `activeTab`), `components/TabStrip.tsx`, `components/RightPanel.tsx` | Existing code | Adding a tab = extend `TabKey`, add a `TABS` entry, render the new component in `RightPanel`. |
| `store/gameStore.ts` (`flow`, `feedback`, board/pot accessors) | Existing code | Source of the live hand state the tab reads (hero hole, board, pot, toCall, active opponents, street). |
| `components/FeedbackPanel.tsx`, `components/table/Card.tsx`/`Board.tsx`, `app/globals.css` | Existing code | Visual language to match: verdict colors, equity bar with "needed %" marker, card rendering, design tokens. |

## Review Log

| Loop | Findings | Changes Made |
|------|----------|-------------|
| 1 | Structural + product-critique self-review (see below). | Pinned live-hand-only scope (D1), flop/turn-only guard (D5), and dishonest-precision risk (D7) directly from the user's brainstorm answers; added river/preflop/no-draw edge journeys; recorded 3 open questions deferred to /spec. |
