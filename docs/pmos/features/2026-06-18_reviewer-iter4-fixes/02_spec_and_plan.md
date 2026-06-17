# Spec + Plan — Reviewer iteration-4 fixes

Tier 2. Combined design + task breakdown. Changes span: a board-cap correction in
`components/table/PokerTable.tsx` (#1, a regression), depth-aware + spot-aware presentation in
`components/FeedbackPanel.tsx` (#2/#7/#8/#9), responsive layout bounds in `PokerTable` (#3), two
analysis copy/tag corrections in `core/analysis/{analyze,explain,conceptTags}.ts` (#4/#5), and a
"raise to N = total" display semantics threaded `core/handFlow.ts` → `CenterStack` + `HandRecap`
(#6). No `HandRecord` schemaVersion change — the new `toAmount` is additive/optional and the
schema validator ignores extra keys. Components still read `DecisionAnalysis` as ground truth; the
depth-aware panel only chooses *which* numbers to surface, never recomputes a verdict.

## Design decisions

### FR-1 Board shows the deciding street (#1, REGRESSION) — MAJOR
- Root cause: `<Board count={showdownDone ? undefined : snapshot.boardCount}>` capped the board by
  the replay cursor's street whenever the hand wasn't over — including on a static hero decision —
  so `view.board` (the live, fully-dealt board) was hidden behind the lagging `snapshot.boardCount`.
- Fix: a pure exported helper `boardShowCount(revealing, snapshotBoardCount)` returns
  `snapshotBoardCount` ONLY while the bot-reveal animation is walking (`revealing`), else `undefined`
  (uncapped). The Board then shows all of `view.board` on a hero decision and at showdown, but still
  turns cards over street-by-street during the reveal cadence. `view.board` already holds exactly the
  cards dealt so far for the live street, so an uncapped board never reveals a card ahead of action.
- Tests: a pure unit test of `boardShowCount` (capped while revealing, uncapped otherwise) + a real
  `HandFlow` test asserting the board the hero is shown equals their street's card count
  (flop 3 / turn 4 / river 5) at every hero decision; a source guard for the new expression.

### FR-2 Bet/raise feedback never uses the call pot-odds headline (#2) — MAJOR
- The "you win ~X% but only need ~Y% — that gap is why continuing makes money over time" line in
  `FeedbackPanel.whyLine` is a CALL/draw template. The panel now gates it with `showWhyLine =
  facingBet && need !== null`, where `facingBet` is true only when `toCall > 0` AND the action is not
  bet/raise. On a bet/raise (or unopened) spot the headline (and the "· need ~Y%" suffix) is not
  rendered, so a ❌ bet can never read as "makes money." The action flows in via the `context.action`
  prop threaded from `RightPanel` (`feedback.heroAction.action`).
- Tests: a ❌ river bet's panel contains neither "only need ~" nor "makes money over time"; a
  facing-a-bet call still shows the headline.

### FR-3 Responsive center-vs-hero separation (#3) — MAJOR
- `PokerTable`: the center pot/round-summary block moves to `top: 36%` (upper-middle) and is bounded
  with `maxHeight: 68%` (so it spans ~2%–70% of the felt) and `maxWidth: 44%`. The bottom hero seat's
  center sits at ~82% of the felt height (RY 32), so its top edge is ~74% — the center block's bottom
  (~70%) stays clear of it at any size. Seats still paint above the block (zIndex) as a guard, and
  the felt keeps its `aspectRatio: 760/520` so the oval scales to fit width AND height without
  squashing seats off an edge. No-scroll contract preserved (felt absorbs shrinkage; action bar
  flex:0 0 auto).
- Tests: source guard for the aspect ratio + `top: 36%` + `maxHeight: 68%`. True pixel verification
  at 800×600 / 600×900 is the next reviewer's Playwright step (noted).

### FR-4 Tags match action + street (#4) — MINOR
- `core/analysis/conceptTags.ts`: add two action/street-neutral tags — `played_too_wide` (took the
  lead with a hand the chart folds) and `good_fold_discipline` (a sound fold on any street).
- `analyze.ts` `preflopBranch`: when the chart says fold but the hero kept playing, tag
  `call_too_wide` only if the hero CALLED; otherwise `played_too_wide` (a raise isn't a call).
- `analyze.ts` `foldBranch` takes `street`: a sound preflop fold keeps `good_preflop_discipline`;
  any later street gets `good_fold_discipline`.
- Tests: a preflop raise is not tagged `call_too_wide`; a river fold is not tagged
  `good_preflop_discipline`.

### FR-5 Honest fold rationale on a big pot (#5) — MINOR
- `core/analysis/explain.ts`: the conceptual price-good-fold copy no longer says "the pot isn't big
  enough" — it reads "Your hand wins too rarely to call this price — you'd be paying more than it can
  win back often enough, so folding is right." The equity-depth `price()` good-fold already leads
  with the win-% vs the needed %, so it was already honest.
- Tests: a low-equity fold into a 240/60 pot (huge) never contains "pot isn't big enough" at either
  depth, and the conceptual copy cites win-chance / "win back."

### FR-6 "Raise to N" = total, consistently (#6) — MINOR
- The engine's `Action.amount` for a bet/raise is the TOTAL street commitment ("raise to N"); the
  action button already shows that. But `handFlow` recorded only the increment (`stackBefore -
  stackAfter`) on the action log and the hero decision, which the round summary and recap displayed —
  so a raise from the BB showed "1 BB" while the button said "2 BB."
- Fix: `handFlow` additionally records `toAmount` (= `action.amount`) on bet/raise actions in the
  action log, the `HeroDecisionRecord.heroAction`, and `ReplaySnapshot.roundContributions`. `amount`
  (increment) still drives all pot math. `CenterStack` and `HandRecap` display bet/raise by
  `toAmount` ("Raise to N" / "raised to N"), falling back to `amount` for older records.
- `core/history/handRecord.ts`: `ActionRecord.toAmount?` and `heroAction.toAmount?` are additive
  optional fields; the JSON-schema validator ignores extra keys, so no schemaVersion bump.
- Tests: a recap raise row and a CenterStack raise row both read "raised to / Raise to 2 BB" (not
  "1 BB") for a raise-to-4 from a 2-chip blind.

### FR-7 Depth-aware presentation (#7) — MINOR/MOD
- `FeedbackPanel` derives from `analysis.coachingDepth`:
  - `conceptual` — `showEquity=false`, `showJargon=false`: no equity bar/%, no "chart-based" badge,
    no concept-tag chips. Only the verdict badge + plain sentence.
  - `equity` — `showEquity=true`: equity bar + win-% + (call-only) why-line + EV table + assumed-range.
  - `strict` — `showEquity=false`, `showJargon=true`: the chart citation lives in the plain sentence;
    the "chart-based" badge is allowed, but raw equity %s (the equity tier's job) are suppressed.
- The verdict + sentence still come from the single-source analysis; only the numeric scaffolding
  around them is depth-gated.
- Tests (one fixed preflop raise spot): Conceptual contains no "%" and no "chart-based"; Equity
  contains a "%"; Strict contains "chart" and no "%".

### FR-8 EV table lists only legal actions (#8) — MINOR
- `FeedbackPanel.evRows(ev, facingBet)`: facing a bet → fold / call / raise; unopened → check / bet
  (no phantom "call" row; the would-be call line becomes the "check" value — taking the pot to
  showdown without paying).
- Tests: an unopened spot's EV table has no "call" row but has check + bet; a facing-bet spot keeps
  fold/call/raise.

### FR-9 Assumed-range legibility near equity (#9) — NIT
- `FeedbackPanel`: the assumed-range note next to the equity figure now reads "That win-chance is vs
  <range> — an assumed range of hands, not their actual cards," so a surprising % reads as
  range-relative (honesty invariant) rather than the bots' real cards. Light touch; no math change.
- Test: the note restates "assumed range" and "not their actual cards."

### SAFETY (resultLine note)
- `HandRecap.test.tsx`: render the conclusion on the hand-complete path for a win and a loss,
  asserting no throw and the correct Result line — closing the stale-artifact report.

## Task list (TDD where it fits)
1. Board cap fix + helper + tests (FR-1) — `PokerTable.tsx`, new `PokerTable.board.test.tsx`, update
   `PokerTable.handrecap.test.tsx` source guard.
2. FeedbackPanel depth/spot-aware presentation + tests (FR-2/7/8/9) — `FeedbackPanel.tsx`,
   `RightPanel.tsx` (thread `action`), extend `FeedbackPanel.test.tsx`.
3. Layout bounds + source guard (FR-3) — `PokerTable.tsx`, `PokerTable.handrecap.test.tsx`.
4. Analysis tags + copy (FR-4/5) — `conceptTags.ts`, `analyze.ts`, `explain.ts`, extend
   `analyze.test.ts`.
5. Raise-to semantics (FR-6) — `handRecord.ts`, `handFlow.ts`, `CenterStack.tsx`, `HandRecap.tsx`,
   extend `CenterStack.test.tsx` + `HandRecap.test.tsx`.
6. Recap safety tests (resultLine) — `HandRecap.test.tsx`.
7. Gate: `npm run typecheck`, `npm run lint`, `npm test` all green.

## Tests changed (not weakened)
- `PokerTable.handrecap.test.tsx` — the board-cap source guard now asserts the new
  `boardShowCount(revealing, snapshot.boardCount)` expression and that the old
  `showdownDone ? undefined : snapshot.boardCount` expression is GONE; the layout guard now asserts
  `top: "36%"` + `maxHeight: "68%"` instead of `top: "42%"`. Both are intentional behavior/source
  changes, not weakenings.
