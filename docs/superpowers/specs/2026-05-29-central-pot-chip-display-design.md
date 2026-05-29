# Central pot chip display — design

**Date:** 2026-05-29
**Status:** Approved (brainstorming → ready for implementation plan)

## Problem

The felt center currently renders only a final pot number (`PotDisplay` → `Pot: $X`). Two things
make a hand hard to follow:

1. **The end-state shows immediately.** `tableView()` returns the fully-played-out `pot` and the
   full 5-card `board`, while bot actions reveal one at a time via the `revealed` cursor in
   `PokerTable.tsx`. So the final pot total and full board are on screen *before* the action reveal
   finishes telling the story.
2. **Chips vanish.** Each seat's committed chips fly toward the center (`chip-fly` in `Seat.tsx`)
   and disappear, leaving no record of who put in what.

## Goal

A real central "what was played" zone whose contents are derived from the **same reveal cursor**
that already animates actions, so the pot and the per-action breakdown grow in step with the
betting. Combines the two options the user chose: a growing chip **pile** (visual weight) plus a
readable **breakdown** of contributions for the current betting round.

## Non-goals (YAGNI)

- No chips-to-winner animation at showdown.
- No side-pot visualization in the center (the engine handles side pots; the recap reports results).
- No per-seat "bets in front of player" layout — we chose the central model.

## Architecture

Follows the project rule: computation lives in pure `core/*`; React components are presentational
and never recompute (mirrors how `FeedbackPanel` treats `DecisionAnalysis` as ground truth).

### core/handFlow.ts — new pure method `replayAt(step)`

Returns a snapshot of the hand as of the first `step` revealed actions:

```ts
export interface ReplaySnapshot {
  pot: number;                  // smallBlind + bigBlind + summed action increments up to `step`
  street: Street;               // street of the last included action ('preflop' if step === 0)
  boardCount: number;           // 0 | 3 | 4 | 5 — how many board cards to show for `street`
  roundContributions: {         // current street only, in original action order
    seat: number;
    name: string;
    action: string;             // 'bet' | 'call' | 'raise' | 'check' (chips only when amount > 0)
    amount: number;             // the increment for that action
  }[];
}
```

Notes:
- `amount` in the action log is already the **increment** (see `heroAct`: `amount: increment`),
  so the pot is `smallBlind + bigBlind + Σ increments`. Blinds are posted but not in the action
  log, so they form the base. (True 6-max always posts both blinds; no antes in this app.)
- `roundContributions` includes the **hero's own actions** too — the seat badges only show
  opponents today, so the breakdown is where the player sees their own contribution recorded.
- A small `boardCountForStreet(street)` mapping (`preflop→0, flop→3, turn→4, river→5`) drives the
  board reveal.

### Components

- **New `components/table/CenterStack.tsx`** (replaces `PotDisplay.tsx`): renders the growing chip
  **pile** (chip count scaled to the pot, capped so it never overflows the center), the **pot
  total**, and the **"This round" breakdown** list built from `roundContributions`.
- **`components/table/Board.tsx`**: accepts `boardCount` and renders only that many of the board
  cards, so the board reveals street-by-street in sync with the action cursor.
- **`components/table/Seat.tsx`**: remove the fly-to-center-and-vanish chip (`chip-fly` token).
  The seat keeps its text action badge ("Bet $9"). Motion moves to the center: a new breakdown row
  and a chip pop into the pile (fade/pop-in) when an action is revealed.
- **`components/table/PokerTable.tsx`**: compute `flow.replayAt(revealed)` on each render and feed
  the snapshot to `CenterStack` (pot, pile, breakdown) and `Board` (boardCount).

### Data flow

```
revealed cursor (PokerTable) ──► flow.replayAt(revealed) ──► ReplaySnapshot
                                                              ├─► CenterStack (pot, pile, breakdown)
                                                              └─► Board (boardCount)
```

## Behavior

- Pile, pot total, and breakdown grow as each action reveals.
- When the reveal cursor crosses into a new street, `roundContributions` clears (new street) and
  the pot total carries forward.
- At hand end (`isOver`), the snapshot at the full step count settles on the final pot; the existing
  `HandRecap` + "Next hand" button handle the result. `replayAt(total).pot` must equal
  `tableView().pot`.

## Testing

- **Unit — `core/handFlow.test.ts` (`replayAt`)**:
  - `step === 0` → pot equals blinds only, `street === 'preflop'`, `boardCount === 0`, empty
    `roundContributions`.
  - Mid-flop partial step → pot includes flop increments so far; `roundContributions` lists only
    the flop actions revealed.
  - Street boundary → crossing from flop's last action into the turn clears `roundContributions`.
  - `replayAt(total).pot === tableView().pot` (final pot reconciles).
- **Component**:
  - `CenterStack` renders one breakdown row per contribution and the pot total.
  - `Board` shows `boardCount` cards (0/3/4/5).

## Affected files

- `core/handFlow.ts` — add `ReplaySnapshot`, `replayAt`, `boardCountForStreet`.
- `core/handFlow.test.ts` — `replayAt` cases.
- `components/table/CenterStack.tsx` — new (replaces `PotDisplay.tsx`).
- `components/table/PotDisplay.tsx` — removed.
- `components/table/Board.tsx` — accept `boardCount`.
- `components/table/Seat.tsx` — remove `chip-fly` token.
- `components/table/PokerTable.tsx` — wire `replayAt` snapshot into `CenterStack` + `Board`.
- CSS (chip pile / pop-in) — alongside the existing chip styles.
