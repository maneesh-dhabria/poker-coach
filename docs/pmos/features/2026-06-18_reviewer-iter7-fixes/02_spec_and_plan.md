# Spec + Plan — Reviewer iteration-7 fixes

Tier 2. Combined design + task breakdown. Changes: unify the panel's equity by passing the verdict's
`equityPct` into `MentalMathSection` and deleting its independent Monte Carlo (#1) in
`components/{FeedbackPanel,MentalMathSection}.tsx`; a hole-card-participation gate in
`detectMadeHand` (#2a) in `core/mental/estimate.ts`; an equity-gated "often ahead" line (#2b) in
`core/mental/estimate.ts` (`conclusionFrom`) and `components/MentalMathSection.tsx`; and a reworded
pending card (#3) in `components/RightPanel.tsx`. No `HandRecord` schemaVersion change — the only new
surface is an additive optional component prop. Components still read `DecisionAnalysis` as ground
truth; the verdict's equity is now the single source the Mental Math block reads too.

## Design decisions

### FR-1 One win-% per decision — Mental Math reads the verdict's equity (#1) — MAJOR
- Root cause: `MentalMathSection` ran its OWN `requestEquity(...)` (hero/board/numOpponents,
  `seed + board.length + 1`, 1500 iters) and set `trueWinPct` from it — a separate Monte Carlo on a
  basis that drifted from `analysis.numbers.equityPct`, so 35% (verdict) and 64% (Mental Math) showed
  side by side.
- `FeedbackPanel` already has `analysis`; it passes `verdictEquityPct={eq}` (where `eq =
  analysis.numbers.equityPct`) into `<MentalMathSection>`.
- `MentalMathSection` gains an optional `verdictEquityPct?: number | null` prop and DELETES the
  `requestEquity` effect, the `browserWorker` helper, `EQUITY_ITERATIONS`, the `seed` selector, and
  the `trueWinPct`/`equityLoading` state. `trueWinPct = showTrueWin ? Math.round(verdictEquityPct) :
  null`, where `showTrueWin` is true only on a live `ok`/`no-draw`/`river` spot with equity supplied.
- The "Check your work" loading branch is removed (the value is now synchronous). `TrueEquityCheck`
  and `Steps` drop their `loading` prop. The Step-6 `conclusionFrom(...)`, the `gapExplanation(...)`,
  and the `evCall = (trueWinPct/100)*potAfter − toCall` all read this single `trueWinPct`.
- Consistency check: verdict % (equity bar) = Mental Math "True win ≈ X%" = the % in the made-hand
  line = the % in the gap line = the basis of the dollar EV. There is no second equity source left.
- Tests: with `verdictEquityPct={51}` the block reads "True win ≈ 51%"; with `{35}` it reads
  "True win ≈ 35%" (the explicit equality-with-verdict test); with no prop the "Check your work"
  block is hidden (no phantom loading state).

### FR-2a Hole-card participation in `detectMadeHand` (#2a) — MAJOR
- Root cause: `detectMadeHand` evaluated the 7-card best and returned any pair-or-better, so a board
  pair (8♦8♣ on a Q-high flop) read as the hero's "pair" even with 6♠J♥ (J-high) — the hero plays
  the board.
- New principled gate: a made hand counts only when the hero's best category is STRICTLY better than
  what the board makes on its own. `boardAloneCategory(board)` reads the board-only best category —
  on a 5-card board by enumerating board-only 5-card combos; on a 3–4-card board structurally from
  the rank counts (paired → `Pair`, two-pair board → `TwoPair`, trips → `Trips`, else `HighCard`).
  `holeImprovesOnBoard(hole, board, heroCategory) = heroCategory > boardAloneCategory(board)`.
- Worked cases: J-high on a paired board → hero `Pair` is NOT > board `Pair` → `null` (plays the
  board). Board trips the hero misses → hero `Trips` not > board `Trips` → `null`. Top pair (hole
  pairs the board) → `Pair` > `HighCard` → made. Pocket pair under the board → `Pair`/`TwoPair` >
  board `HighCard`/`Pair` → made. Real two pair using a hole card → `TwoPair` > board `HighCard` →
  made.
- This flows into `core/analysis/analyze.ts` (which calls `detectMadeHand` for the iter-6 aggression
  branch): a board-paired no-contribution low-equity bet now yields `madeHand = null` and grades as a
  bluff again — consistent, not a regression for REAL made hands (which still detect and keep their
  value framing).
- Tests (added/corrected in `core/mental/estimate.test.ts`): J-high on a paired board → `null`; board
  trips the hero doesn't improve → `null`; top pair via a hole card → made; pocket pair under the
  board → made ("a pair"); real two pair using a hole card → made. The existing A2-on-4A3 top-pair
  and A2-on-4A34 two-pair cases still detect (genuine hole-card hands).

### FR-2b "Often ahead" only when the equity is actually high (#2b) — MAJOR
- Root cause: the made-hand line and the no-draw headline asserted "you're often ahead already"
  whenever a made hand existed, ignoring equity — top pair at 35% multiway read "often ahead",
  contradicting the verdict.
- `MentalMathSection` gates the Step-1 made-hand line via a pure `madeHandLine(label, trueWinPct,
  numActiveOpponents)`: `trueWinPct >= 55` → "you're often ahead already" (green); below → "you have
  <label>, but with N players still in you're only ~X% to win — it's marginal, not a sure lead"
  (muted). When equity is absent it falls back to a neutral "you already have <label> — see the true
  win % below" (no "ahead" claim). The no-draw note uses the same threshold via `noDrawSummary`.
- `core/mental/estimate.ts` `conclusionFrom`: the made-hand `toCall <= 0` (free-card) branch now
  splits on `trueWinPct >= 55` — high → "consider betting for value"; low → "it's marginal, not a
  clear lead at ~X%". The facing-a-bet branches already compared `trueWinPct` to `breakEvenPct`, so
  they never over-claimed. `AHEAD_THRESHOLD_PCT = 55` is the single threshold.
- Tests: top pair at `verdictEquityPct={35}`, 4 opponents → made-hand line contains "marginal" and
  "35%", NOT "often ahead"; a made hand at `{72}` → "often ahead"; `conclusionFrom` free-card at 35%
  → "marginal", not "ahead"; the existing 66%/47% made-hand cases keep their value framing.

### FR-3 Pending copy doesn't promise absent Mental Math numbers (#3) — MINOR
- Root cause: the pending card REPLACES the FeedbackPanel (which holds Mental Math), so its "the
  numbers below (Mental Math) are for this <street> decision" pointed at nothing. The prior
  `mentalMathAvailable` gate didn't help — even with the section "open", no Mental Math renders in the
  pending branch.
- `RightPanel` drops the `mentalMathAvailable`/`mentalMathOpen` machinery and rewords the card:
  "Deciding your <street>… — the verdict, equity, and math for this <street> decision appear once you
  act. The hand review below still shows your earlier decisions." No "numbers below (Mental Math)"
  promise in any state.
- Tests (`components/RightPanel.test.tsx`): the pending card never matches `/numbers below \(Mental
  Math\)/i` whether the section is collapsed or expanded; it does match `/once you act/i`.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (372 passing), `npm run build` — all green.
- Cross-check the two reviewer scenarios: (i) 6♠J♥ on 8♦8♣Q♦ at ~3% — `detectMadeHand` → `null`, no
  "often ahead", Mental Math "True win ≈ 3%", EV uses 3%, gap blames opponents+board; (ii) top pair
  at ~35% multiway — `detectMadeHand` → top pair, made-hand line reads marginal at ~35% (not
  "ahead"), Mental Math "True win ≈ 35%" = the verdict, one consistent win-% everywhere.
