# Spec + Plan — Reviewer iteration-20 fixes

Tier 2. Combined design + task breakdown for one MAJOR self-contradiction, four MINOR items, and one
NIT. Edits live in `core/analysis/explain.ts`, `components/FeedbackPanel.tsx`, `components/HandRecap.tsx`,
`components/ActionBar.tsx`, `components/table/PokerTable.tsx`, `core/handFlow.ts`,
`core/engine/gameEngine.ts`, and `store/gameStore.ts`. No EV/equity/pot-odds computation change, no
verdict-bucketing change, no `HandRecord` schemaVersion bump (the only new output,
`TableView.effectiveOpponentRaiseTo`, is an in-memory render field, never persisted).

## Design decisions

### MAJOR — break-even fold reads as ONE coherent message (`explain.ts` + `FeedbackPanel`)

- **The contradiction.** The headline (`explain.ts price()` good-fold branch) said "Folding is right —
  you don't have the odds, though it's close." The equity-bar whyLine (`FeedbackPanel.whyLine`) picked
  its template off raw `eq >= need`: at 22% vs 22% that ran the call-positive "that gap is why continuing
  makes money over time" line — under a FOLD. Two opposite conclusions on one card; and at break-even
  "you don't have the odds" is simply false.
- **Mechanism — headline (`explain.ts`).** Inside the borderline band (`isBorderlinePrice`,
  `abs(equityPct - potOddsPct) <= 3`) a good FOLD now reads "…Close spot — calling and folding are about
  equal here, so folding is fine." (equity depth) and "This is about break-even — calling and folding are
  about equal here, so folding is fine." (conceptual). NEVER "you don't have the odds" / "wins too rarely"
  inside the band. Outside the band the confident "Folding is right — you don't have the odds" wording is
  unchanged.
- **Mechanism — whyLine (`FeedbackPanel`).** `whyLine` takes the hero's `action` and keys off the band +
  the action, not raw `eq >= need`. Inside the band: a FOLD reads "You win ~X% and need ~Y% — it's about
  break-even, so folding costs you almost nothing."; a CALL keeps the iter-18 "…roughly equal here." line.
  Outside the band the `eq >= need` ("continuing makes money") / `eq < need` ("come up short") lines are
  unchanged.
- **Why safe.** Verdict stays ✅ good — a break-even fold is not a leak and the engine can't confidently
  call folding here −EV (no verdict change, no fixture change). The iter-18 borderline-CALL behavior is
  untouched (its band branch is unchanged). The Hand-6 spot is a LIMPED preflop pot → `kind === "price"`
  (the limped-pot off-model path), so the whyLine renders (not suppressed as a preflop-chart card).

### MINOR #1 — fresh deal honors the active depth (`gameStore`)

- **The exact divergence.** Two stores hold a depth. `useSessionStore.settings.coachingDepth` is what the
  panel dropdown reads/writes. `useGameStore` keeps its OWN `settings` copy, seeded ONCE by
  `configure(sessionId, settings, seed)` at session start; `newHand()` reads `get().settings.coachingDepth`
  — the GAME store's copy — to build the fresh hand's flow. The panel control (`RightPanel.changeDepth`)
  called `useSessionStore.setSettings({coachingDepth})` (updates the session store) and
  `useGameStore.setCoachingDepth(depth)` (re-grades the CURRENT hand via `flow.reanalyzeAt`), but NEVER
  updated `useGameStore.settings.coachingDepth`. So the gameStore copy stayed at the deal-time depth
  ("equity"); the next `newHand()` built its flow at "equity" and graded the first decision with numbers,
  until a manual re-toggle (which only ever re-graded the already-dealt hand, not the deal source).
- **Mechanism.** `setCoachingDepth` now mirrors the depth into `gameStore.settings.coachingDepth` (when
  it differs) before re-deriving the current hand. The active depth becomes ONE source of truth for both
  `newHand()` (the next deal) and the in-play re-derive.
- **Why safe.** The session store's `settings` (read by the dropdown + live Mental Math) is still written
  by `RightPanel.changeDepth`, so the displayed dropdown matches the analysis. The re-derive path
  (`reanalyzeAt`) is unchanged. The unchanged-depth fast path still bumps `tick`.

### MINOR #2 — priced preflop call shows need-marker + EV table (`FeedbackPanel`)

- **Mechanism.** A new narrow carve-out `isPricedPreflopCall = isPreflopChart && action === "call" &&
  facingBet && need !== null`. `showWhyLine` and `showEvTable` now allow a preflop-chart card through when
  `isPricedPreflopCall`. `numbers.potOddsPct` is already populated on every price decision, so the
  "need ~%" equity-bar marker renders once `showWhyLine` is true.
- **Why safe.** The iter-09 #1 suppression existed for a preflop FOLD (a SB folding to the BB, where the
  pot-odds frames would praise calling/raising under a chart-fold verdict). That case is a FOLD, so the
  call-only carve-out leaves it suppressed (the existing SB-fold regression test still passes). A "called
  too wide" CALL facing a real bet IS a genuine price decision, so it correctly gets the fold's
  affordances. Verdict bucket unchanged.

### MINOR #3 — slider/button cap to the effective stack (`ActionBar` + engine/flow + table)

- **Mechanism.** `gameEngine.effectiveOpponentRaiseTo(heroSeat)` returns the largest `committedStreet +
  stack` over all still-in opponents (the most any single opponent could match). `HandFlow.tableView()`
  surfaces it as `effectiveOpponentRaiseTo`; `PokerTable` passes it to `ActionBar` as
  `effectiveMaxRaiseTo`. `ActionBar` computes `offeredMax = max(minRaiseTo, min(legal.maxRaiseTo,
  effectiveMaxRaiseTo))` and uses it as the slider `max`, the quick-size clamp, and the displayed value
  clamp.
- **Why safe.** Engine legality (`legal.maxRaiseTo`, side-pot logic, `apply`) is untouched — this is a
  DISPLAY cap only. When no cap is supplied (older callers / tests) or the hero is the short stack
  (their all-in ≤ the cap), `offeredMax === legal.maxRaiseTo`, so min-raise / all-in-for-less behavior is
  unchanged.

### MINOR #4 — leak ranking by chip magnitude (`HandRecap`)

- **Mechanism.** `mostSevereFlagged` ranks flagged plays by `leakChips(d) = max(heroAction.amount,
  spot.toCall)` PRIMARY, with `analysis.severity` only as the tiebreaker (the order of the two comparators
  in iter-14 is swapped). So the $584 overbet ($584 in) outranks the $2 preflop mistake ($2 in), even
  though the mistake is higher-severity.
- **Why safe.** A lone flagged play is still the only candidate → still named. A big clear mistake (large
  chips) still outranks a small thin play. The metric is the chips the hero actually put in on the action
  — the bigger chip swing is the bigger lesson. The iter-14 tests still pass (their bigger-chip play was
  already the higher-severity one).

### NIT #5 — merged recap row drops the ambiguous pot (`HandRecap`)

- **Mechanism.** The "· pot $X" suffix renders only when `group.length === 1`. A merged multi-action row
  (different actions at different pots) shows no pot suffix.
- **Why safe.** Single-action rows are unchanged. Conceptual rows were already digit-free.

## Tasks

1. `explain.ts`: borderline-fold copy at equity + conceptual depth (break-even, never "don't have the
   odds"/"wins too rarely"). `FeedbackPanel.whyLine`: take `action`, branch on band + action. Tests:
   22-vs-22 fold → break-even headline + whyLine, neither bad phrase; clear fold keeps confident wording;
   iter-18 borderline-call unchanged.
2. `gameStore.setCoachingDepth`: mirror depth into `gameStore.settings`. Test: set conceptual, deal a
   fresh hand, record a decision → `analysis.coachingDepth === "conceptual"`, digit-free, no re-toggle.
3. `FeedbackPanel`: `isPricedPreflopCall` carve-out for `showWhyLine`/`showEvTable`. Test: a "called too
   wide" preflop mistake exposes `potOddsPct` (need marker) + EV table like the fold; SB-fold stays
   suppressed.
4. `gameEngine.effectiveOpponentRaiseTo` + `TableView.effectiveOpponentRaiseTo` + `PokerTable` wiring +
   `ActionBar.effectiveMaxRaiseTo` clamp. Test: offered max == effective stack when hero covers the table;
   unchanged when hero is the short stack.
5. `HandRecap.mostSevereFlagged`: chip-magnitude-primary ranking. Tests: $584 thin overbet outranks $2
   preflop mistake; lone flagged play still named; big clear mistake still named over small thin play.
6. `HandRecap`: pot suffix on single-action rows only. Test: merged multi-action row has no "· pot $X".

## Verification

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — all green. Manual self-review of the
six reviewer repros (a)-(f) confirmed.

## Tests changed (and why)

- `core/analysis/explain.test.ts` — two iter-17 borderline-fold assertions legitimately change with the
  MAJOR: the equity-depth borderline fold no longer says "folding is right" (it now says break-even /
  "folding is fine" and must NOT say "don't have the odds"); the conceptual borderline fold no longer
  keys on the word "close" (it now says break-even and must NOT say "too rarely"). Re-pointed to the new
  coherent break-even wording. No assertion was weakened — they now assert the corrected behavior plus the
  negative guards (no "don't have the odds" / no "too rarely").
- All other test changes are NEW tests for the six behavioral changes; no existing assertion was deleted
  or loosened. The schema/demo-fixture validator still passes (additive only; no schemaVersion bump; no
  fixture verdict changed — the break-even fold stays ✅ good).
