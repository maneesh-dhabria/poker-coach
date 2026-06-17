# Spec + Plan — Reviewer iteration-2 fixes

Tier 2. Combined design + task breakdown. One small, pure addition to `core/mental` (made-hand
detection + true-equity reconciliation — still no React/DOM, still sync); everything else is
presentational (`components/*`, `app/globals.css`). No `HandRecord` schema change. The feedback panel
still reads `DecisionAnalysis` + the async Monte-Carlo equity it already requests — it never
recomputes a verdict.

## Design decisions

### FR-1 Mental Math reconciliation (findings #1/#2/#3) — MAJOR
- Root cause: `core/mental` is an outs-only model. `buildMentalEstimate` builds the Step-6 conclusion
  from outs alone, so a made hand the outs count ignores (top pair + gutshot) yields a "fold/price
  too steep" headline that contradicts the engine's equity-based "Easy call."
- `core/mental/estimate.ts`:
  - `detectMadeHand(hole, board)` — pure; uses the existing `core/eval` evaluator. Returns a plain
    label (top/middle/bottom pair, two pair, three of a kind, …) for Pair-or-better.
  - `MentalEstimate.madeHand` (new field on `types.ts`) — surfaced on `ok`/`no-draw` post-flop spots.
  - When a made hand is present, the sync Step-6 `decision` no longer steers a fold; it says
    "don't fold on the outs alone — you already have <made hand>… check the true win % below."
  - `conclusionFrom({ trueWinPct, breakEvenPct, toCall, madeHand })` — pure. The component calls it
    once the Monte-Carlo equity resolves so Step-6 is driven by the SAME equity the engine grades
    against (never an outs-only contradiction). On a free street with a made hand it mentions value.
  - `gapExplanation({ exactHitPct, trueWinPct, madeHand })` — pure. A made-hand gap is attributed to
    the made hand; a pure-draw gap keeps the opponents + board-danger explanation.
  - `trueWinExceedsOuts(estimate, trueWinPct)` — helper tell that the outs count is missing a made hand.
- `components/MentalMathSection.tsx`: surface the made hand in Step 1; render the reconciled
  `conclusionFrom` in Step 6 once `trueWinPct` is known; render `gapExplanation` in "Check your work";
  use `estimate.plainSummary` for the no-draw note (so it carries the made-hand wording).
- Constraint honored: `core/mental` stays pure/sync; the equity is passed in by the component.

### FR-2 Responsive play layout (findings #4/#6) — MAJOR
- Root cause: `PlayShell`'s grid is `1fr 420px`; below ~1000px the fixed rail squeezes the table column
  to (near-)negative width, so seats + the action bar clip off the viewport. The action bar was a
  single non-wrapping flex row.
- `app/globals.css`: `.play-grid` — `1fr 420px`, narrows the rail to `340px` ≤1100px, stacks to a
  single column ≤880px (table over feedback). `.action-bar` wraps + centers and caps the slider width.
  No new scroll regions — the no-scroll contract holds (the right column's `#tab-body` stays the only
  scroller).
- `components/PlayShell.tsx` uses `.play-grid`; `components/ActionBar.tsx` uses `.action-bar` + inline
  `flexWrap: wrap`.
- Center-log overlap (#6): in `PokerTable` the central pot/log is painted before the seats and is
  width/height-capped (`maxWidth 44%`, `maxHeight 60%`, overflow hidden); seats get `zIndex:1` so they
  always paint above the log.

### FR-3 Pending-decision feedback + feedback-off hint (findings #5/#8) — MAJOR
- `components/RightPanel.tsx`: compute whether the hero is deciding a LATER street than the last
  verdict (`flow.heroSpot().street` vs `feedback.street` by street order). When stale, render a
  `feedback-pending` card ("Deciding your <street>…") instead of the stale `FeedbackPanel`; Mental
  Math (inside FeedbackPanel) is omitted in that card but the live spot is still described by the
  pending copy. When feedback is OFF and the hand is live, render a `feedback-off` card explaining
  it's intentional and that the hand review still appears.

### FR-4 Consistent units (finding #7) — MINOR
- `components/FeedbackPanel.tsx` takes a `displayUnit` prop (from `RightPanel` via the session store)
  and formats money + the context pot with `core/money.formatMoney`.
- `components/ActionBar.tsx`, `components/table/CenterStack.tsx`, `components/table/Seat.tsx` action
  badges format amounts with `formatMoney(displayUnit)`; `PokerTable` threads `displayUnit`.
  Defaults stay `usd` so existing `$` tests hold.

### FR-5 Fold result wording (finding #9) — NIT
- `components/HandRecap.tsx`: `resultLine(heroNet)` — won / lost / "no money won or lost" for $0.

### FR-6 Preflop chart default seat (finding #10) — NIT
- `components/PreflopChartTab.tsx`: default the position to the hero's live seat (read from the game
  store, or a `heroPosition` prop for tests), falling back to BTN; a manual pick sticks.

### FR-7 Setup preset hint (finding #11) — NIT
- `components/SetupScreen.tsx`: a one-line `preset-hint` — a preset fills in/replaces every bot's
  style+skill (verified: clicking a preset calls `setSettings({ personas: tablePreset(...) })`,
  which overwrites all per-bot personas).

### FR-8 All-in board run-out (finding #12) — NIT
- Investigation: the engine ALREADY deals the full 5-card board on an all-in (`advanceStreet`
  recurses to the river; `bestAmong` scores the full board). The bug was purely DISPLAY: `PokerTable`
  capped `<Board>` to `snapshot.boardCount` (derived from the last *action's* street), so an all-in
  on the turn showed only 4 cards. Fix: at showdown (`showdownDone`) render the full `view.board`
  (no count cap). No engine/schema change needed.

## Task list (TDD where it fits)
1. core/mental made-hand detection + reconciliation (FR-1) — edit `types.ts`/`estimate.ts`/`index.ts`;
   add tests in `core/mental/estimate.test.ts`. Wire `MentalMathSection`; add component tests.
2. Responsive grid + action-bar wrap + center-log layering (FR-2) — edit `globals.css`, `PlayShell`,
   `ActionBar`, `PokerTable`; add `PlayShell.responsive.test.tsx` + a `PokerTable` source guard.
3. Pending-decision + feedback-off (FR-3) — edit `RightPanel`; extend `RightPanel.test.tsx`.
4. Units (FR-4) — edit `FeedbackPanel`, `ActionBar`, `CenterStack`, `Seat`, `PokerTable`, `RightPanel`;
   extend `FeedbackPanel.test.tsx` + `ActionBar.test.tsx`.
5. Fold wording (FR-5) — edit `HandRecap`; extend `HandRecap.test.tsx`.
6. Preflop chart default (FR-6) — edit `PreflopChartTab`; extend `PreflopChartTab.test.tsx`.
7. Setup hint (FR-7) — edit `SetupScreen`; extend `SetupScreen.test.tsx`.
8. All-in run-out display (FR-8) — edit `PokerTable`; add engine run-out tests + `PokerTable` guard.
9. Gate: `npm run typecheck`, `npm run lint`, `npm test` all green.
