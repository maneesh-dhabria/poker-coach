# Spec + Plan — Reviewer iteration-11 fixes

Tier 2. Combined design + task breakdown. Three MAJORs are regressions/edge-cases the iter-10 fixes
introduced — each fix is surgically scoped so it does NOT reopen what iter-10 closed. The rest are
copy / depth-gating changes. No `HandRecord` schemaVersion change — all changes are additive
copy/display.

## Design decisions

### FR-1 Undersize "value" framing gated to genuine value bets (#1) — MAJOR
- Root cause: `aggressionBranch` ran the `undersize` branch FIRST and UNCONDITIONALLY, returning
  `bet_too_small` + "you're ahead, size up while you're in front" for any sub-threshold bet — including
  a low-equity A-high airball, contradicting its own EV table.
- Fix (`core/analysis/analyze.ts aggressionBranch`): compute `isValueBet = madeHand != null ||
  equityPct >= 50`. Only `if (undersize && isValueBet)` return the `bet_too_small` branch (keeping the
  `made_hand_thin_value` tag when a made hand is present — iter-10 #3 intact). Otherwise fall through to
  the existing low-equity logic: `bluff_no_equity` (< 20%) or `bluff_thin_equity` (20–33%) — a ❌ mistake
  that agrees with the EV table and never claims a lead.
- Copy (`core/analysis/explain.ts aggression()` + `conceptual()`): the made-hand `betTooSmall` copy now
  branches on `equityPct >= 50` — only the high-equity made-hand case says "size up… while you're in
  front"; a low-equity made hand gets "some showdown value… too small to do its job" with no "in front"
  claim. (The no-made-hand `betTooSmall` copy is now only reachable at equity ≥ 50, so "you're ahead
  with ~X%" is honest there.)
- Tests (`analyze.test.ts`): A-high 13% min-bet → verdict mistake, tags `bluff_no_equity`, NOT
  `bet_too_small`/`made_hand_thin_value`, copy has no "ahead"/"in front"/"size up". A 25% airball →
  mistake, `bluff_thin_equity`. A 70%-equity undersized bet → still `bet_too_small` (iter-10 #3 kept).

### FR-2 Chart never shows "Fold AA" in any unmodeled spot (#2) — MAJOR
- Root cause: `PreflopChartTab` only special-cased `noOpenRange = position === "BB" && facing ===
  "unopened"`. Every other unmodeled (position, facing) combo still rendered the grid, which folds every
  hand ("AA — Fold from BTN").
- Fix (`components/PreflopChartTab.tsx`): replace `noOpenRange` with `noRange = !chartApplies(position,
  facing)` (imported from `core/charts/preflop`). When `noRange`, render NEITHER grid NOR detail — show
  an explanatory panel. Keep the BB-unopened copy (`data-testid="chart-bb-no-open"`); add a non-BB
  vs-a-raise panel (`data-testid="chart-no-range"`): "No <POS> range vs a raise in this chart… switch
  Facing to first in (unopened) to see <POS>'s opening range," explicitly noting folding AA/KK to a raise
  would be wrong so we don't fake a grid. Honesty: uses `chartApplies`, invents no range.
- Tests (`PreflopChartTab.test.tsx`): BTN/CO/UTG/MP/SB + vs-a-raise render `chart-no-range`, no grid,
  no "AA — Fold from <POS>". BB + vs-a-raise still renders the real defend grid (AA non-fold). Each
  position's first-in still renders its real opening grid (AA = Raise). Existing BB-unopened tests pass.

### FR-3 Variance footer never praises a flagged play (#3) — MAJOR
- Root cause: `HandRecap` gated the variance footer on `heroNet < 0 && c.mistake === 0 && contested` —
  not `c.thin === 0` — so a ⚠️ thin-only loss still got "played well"; and a ❌ mistake loss hit neither
  branch and silently showed nothing.
- Fix (`components/HandRecap.tsx`): gate the variance footer on `heroNet < 0 && !flagged && contested`
  (`flagged = mistake + thin > 0`). Add a `recap-loss-flagged` note for `heroNet < 0 && flagged`,
  mirroring the won-but-flagged wording: "You lost this hand, and the ❌/⚠️ above flags a play to review
  — that's where the leak is, not variance."
- Tests (`HandRecap.test.tsx`): an oversized-shove thin-only loss shows NO `recap-variance` and DOES
  show `recap-loss-flagged`; a mistake loss shows the review note (not silence); an all-good contested
  loss STILL shows `recap-variance` (no regression).

### FR-4 Mental Math Step 6 agrees with the EV table (#4) — MINOR
- Root cause: `conclusionFrom` for `toCall <= 0` with no made hand always returned "It's a free card —
  just take it," ignoring whether betting is +EV.
- Fix: `core/mental/estimate.ts conclusionFrom` takes an optional `betBeatsCheck`. On a free street with
  no made hand: `betBeatsCheck` → "Betting is the higher-EV play here — a semi-bluff with your ~X%
  equity — rather than just taking the free card"; else the free-card line. `components/FeedbackPanel.tsx`
  passes `betBeatsCheck={ev.raise > ev.call}` (the same `analysis.numbers.ev` the EV table renders) into
  `MentalMathSection`, which threads it through `Steps` into `conclusionFrom`. The signal is the
  authoritative analysis EV (check = `ev.call` with toCall 0, bet = `ev.raise`), so Step 6 can never
  contradict the EV table's winner.
- Tests (`core/mental/estimate.test.ts`): free street, no made hand, `betBeatsCheck: true` → sentence
  recommends betting, no "just take it"; `false` → keeps "free card / take it".

### FR-5 Chart-fold copy is position-accurate about OOP (#5) — NIT
- Fix (`core/analysis/explain.ts preflop()` chart-fold branch): the "plays poorly after the flop"
  praise adds ", especially out of position" only when `isOutOfPosition(p.position)` (blinds/UTG/MP).
  CO/BTN are late position → clause dropped.
- Tests (`explain.test.ts`): a CO/BTN chart-fold copy has no "out of position"; UTG still does.

### FR-6 Conceptual depth panel is fully digit-free (#6) — NIT
- Fix (`components/HandRecap.tsx`): derive `conceptual = decisions.every(d => d.analysis.coachingDepth
  === "conceptual")`. `resultLine` takes `conceptual` and returns "You won/lost this hand." /
  "No money won or lost this hand." with no amount. The tally uses `tallyWords(c)` (number words,
  omitting zero categories) at conceptual depth, else the digit form. Equity/Strict unchanged.
- Tests (`HandRecap.test.tsx`): at conceptual depth the whole recap `textContent` matches no digit, the
  result line carries no amount, the tally has no "<n> good/thin/mistake"; Equity still shows the numeric
  result + tally.

### FR-7 Legibility (#7) — NIT — DEFERRED
- The layout is a fixed DESIGN_W × DESIGN_H box uniformly `scale()`d to fit (`PokerTable.fitScale`). The
  no-overlap / no-clip guarantee is a direct consequence of the UNIFORM scale ≤ fit. A scale floor would
  reintroduce overflow/clipping below 800px (breaking the no-scroll contract the reviewer confirmed
  holds); enlarging seat fonts inside the fixed seat boxes risks overflow/overlap. The reviewer confirmed
  nothing is clipped/overlapping — only small. Per finding #7's "don't risk the layout" guidance and the
  recurring-tradeoff history, no safe win exists, so #7 is DEFERRED and documented: sub-800px legibility
  is an accepted tradeoff of scale-to-fit at extreme sizes.

## Excluded
- The oversized open counting as "thin" not "mistake" is consistent with its ⚠️ thin verdict/severity —
  intentional, left as-is (the variance-footer false-praise was the real bug, fixed in FR-3).

## Test / verification plan
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.
- Self-review for new contradictions: (a) a low-equity small bet is a mistake that AGREES with its EV
  table and never says "ahead"; (b) the chart NEVER shows "Fold AA" in any position/facing; (c) no
  "played well" praise on any hand containing a ⚠️/❌; (d) Step 6 never contradicts the EV table's winner.
- Demo fixtures `samples/session-demo/hand-*.json` re-validated by the schema test (additive only).
</content>
