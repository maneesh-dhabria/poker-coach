# Spec & Plan — Reviewer iteration-24 fixes

## MAJOR — preflop chart EXPLAINS the suited-ace raise/fold boundary (chart DATA unchanged)

**Files:** `core/charts/preflop.ts` (+ `core/charts/preflop.test.ts`); surfaced by
`components/PreflopChartTab.tsx` (already renders `cellRationale`).

**Mechanism — extend the pure `cellRationale(key, position, action)` helper** (which already handled
the small-pair boundary) to cover the suited-ace boundary from the early seats (UTG/MP):
- A suited WHEEL ace the chart **opens** (`A5s`/`A4s`/`A3s`/`A2s`, kicker 2–5, action `raise`) → a
  plain rationale naming the nut-flush + wheel-straight (A-2-3-4-5) playability and the ace-blocker
  effect, and **explicitly noting it's opened even though a hand like A7s shows a HIGHER raw win-rate**.
- A MIDDLING suited ace the chart **folds** (`A6s`/`A7s`, kicker 6–9, action `fold`) → a plain
  rationale that it's folded despite a decent raw number because it's frequently **DOMINATED**
  (out-kicked by a better ace), so the raw "vs a random hand" equity **OVERSTATES** it; the chart
  prefers the suited wheel aces.
- Helper `suitedAceKicker(key)` returns the kicker rank for a `"A?s"` key (else null). Only fires for
  `EARLY_POSITIONS` (UTG/MP). Strong aces (ATs+) and every other cell fall through to `""`.

**Pure, derived from key/position/action — NO raise/fold classification or chart DATA changed.** The
chart JSON (`preflopCharts.json`) is byte-for-byte untouched; this is purely the missing explanation.

**Surfacing:** `PreflopChartTab.tsx` already renders `cellRationale` in a `data-testid="chart-cell-rationale"`
paragraph ABOVE the generic Baseline/Equity/Position/caveat bullets, so the specific reason now LEADS
for these cells and the win% no longer reads as contradicting the verdict. No JSX change was required.

**Representative cells verified (reasoned against the chart JSON):** A7s MP → fold → dominated/overstated
rationale; A5s MP & UTG → raise → wheel-ace rationale (references A7s's higher raw number,
nut-flush/straight/blocker); A4s MP → raise → wheel rationale; A6s MP → fold → dominated rationale;
KQs/AQs/A5o/A5s-BTN → `""` (unchanged generic detail).

**Tests (`preflop.test.ts`):** new describe block asserts the dominated/overstated substrings for A7s &
A6s MP folds; the wheel/blocker/straight substrings (incl. an explicit `a7s` reference) for A5s MP &
UTG and A4s MP raises; and `""` for KQs, AQs, a random offsuit, an offsuit ace, and a late-position
A5s. Substrings only — no exact prose asserted.

## MINOR 1 — stacked short-height table is bounded, no downward overlap

**Files:** `app/globals.css` (+ `components/table/PokerTable.scale.test.ts`).

**Mechanism — clip every grid track to its own box so a track can't paint over its neighbour:**
- `.play-grid` gains `overflow: hidden`. Combined with each column already setting `min-height: 0` +
  `overflow: hidden` (left-col, right-col in `PlayShell`), the table track can never paint past its
  share into the coaching panel beneath it.
- The stacked media query (`max-width: 880px`) keeps `grid-template-rows: minmax(0, 1fr) minmax(0, 1fr)`
  (both tracks shrink to 0 if needed) and adds `grid-auto-rows: minmax(0, 1fr)` so no extra row can
  auto-expand.

**Why this is the lowest-risk fix:** it builds directly on the iter-23 mechanism. The stage already
top-anchors + scrolls the readable-floored felt (`shouldTopAnchorTable`); the only gap was the table
TRACK growing past its 1fr share at short heights and bleeding down. Clipping at the grid + column level
bounds the table section to its track, so the felt scrolls WITHIN it. The `MIN_TABLE_SCALE = 0.55`
readability floor (praised at 800×600) is unchanged.

**Invariant satisfied at 700×460 / 700×500:** the readable-floored felt (286px) is taller than the
short stacked track (~190px / ~214px) → it top-anchors and scrolls down, clipped by the track's
`overflow:hidden` — its bottom never extends into the coaching panel below.

**No regression to praised layouts:** the wider/taller layouts (1366×768, 1280×520, 1024×768, 1000×440,
800×600 stacked, 600×900, 900×600) either fit (centered, no overflow) or, when short, obey the SAME
top-anchor-and-scroll rule. The iter-23 top-seat-never-clipped-behind-header behavior is preserved
(top-anchoring is unchanged).

**Tests added (`PokerTable.scale.test.ts`):** the 700×460 and 700×500 stacked tracks floor to
`MIN_TABLE_SCALE`, the felt is taller than the track, and `shouldTopAnchorTable` is `true` (scrolls
within, no downward bleed); the 800×600 stacked layout still fits/centers (or top-anchors if short),
never centered-and-clipped.

## MINOR 2 — loose-open copy drops "first-in" over limpers

**Files:** `core/analysis/explain.ts`, `core/analysis/analyze.ts`, `core/analysis/types.ts`
(+ `core/analysis/explain.test.ts`).

**Mechanism:** a new optional `limpedPot?: boolean` on `ExplainParams` (and on the persisted
`explanationInput`). `analyze.ts` extracts the existing limped-pot detection into an exported pure
helper `detectLimpedPot(input)` — the SAME signal the iso-raise routing uses (preflop, facing
"unopened", potBefore exceeds the posted blinds) — and passes `limpedPot` to `buildExplanation` and
into `explanationInput` on a loose open. `formatExplanation` re-reads it on a unit re-render.

In `explain.ts`'s loose-open branch, when `limpedPot` is true the copy acknowledges the limpers ("even
over the limpers… too weak to raise" / "raising … over the limpers is on the loose side") and NEVER
says "first-in". The "first-in" framing is reserved for a genuine RFI spot (`limpedPot` false/absent),
which keeps its prior wording. The oversized loose-open branch already named the limpers and is
unchanged. **Verdict unchanged.**

**Tests (`explain.test.ts`):** a LIMPED-pot loose open (equity & strict × thin & mistake) contains
neither "first-in" nor "first in", contains "limper", and still says "raising"; a genuine first-in
loose open (`limpedPot: false`) may still use "first-in".

## MINOR 3 — conceptual no-equity flop bluff teaches the concept

**File:** `core/analysis/explain.ts` (+ `core/analysis/explain.test.ts`).

**Mechanism:** the Conceptual aggression no-equity fall-through (`equityPct < NO_EQUITY_PCT`, no made
hand) replaced "You're {acting} with little behind it — there's not enough here" with a concept-naming,
digit-free reason: a pure bluff that has almost no chance to win at showdown AND won't make better
hands fold often enough to win the pot, so there's nothing to back the bet. Verb-correct (raise/bet).
**Verdict unchanged; stays digit-free.**

**Tests (`explain.test.ts`):** a no-equity (8%) conceptual bluff mentions "bluff", "showdown", and
"fold", is digit-free, and no longer contains "little behind it" / "there's not enough here".

## NIT 1 — at most one quick-size button highlights

**File:** `components/ActionBar.tsx` (+ `components/ActionBar.test.tsx`).

**Mechanism:** a quick-size button is "active" only when the current amount equals that fraction's
NATURAL (unclamped) value AND that natural value is itself within the legal band
(`quickNatural(f) ∈ [minRaiseTo, offeredMax]`). A value that only matches because it was clamped to the
min-raise floor or the all-in/effective-max ceiling no longer lights every button. Ties are
de-duplicated: when several in-band fractions share the same natural value, only the SMALLEST (½ before
¾ before Pot) is active — so at most one button ever highlights. Derived state (iter-21 NIT 1 behavior
preserved: dragging off a quick size clears the highlight).

**Tests (`ActionBar.test.tsx`):** at the min-raise floor where ½/¾ collapse, ≤1 (here 0) active; at
all-in none of ½/¾/Pot are active; a genuine ½-pot value still highlights ½ alone.

## NIT 2 — all-in seat badge labeled as a TOTAL, distinct from the button

**File:** `components/table/Seat.tsx` (+ `components/table/Seat.test.tsx`).

**Mechanism (display-only):** the all-in seat badge now reads `ALL-IN · $X in` (total chips committed
this hand) with a `title` tooltip "All-in — $X committed in total this hand", so its number is clearly
a different quantity from the all-in BUTTON's "All-in $Y" (chips put in on that action). No
engine/pot/side-pot amounts change.

**Tests (`Seat.test.tsx`):** the pre-existing badge test was updated (with a comment) to assert the new
"$46 in" total label and the clarifying `title`, instead of a bare "ALL-IN $46".

## Verification

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm test` (600 passed, 48 files) · `npm run
build` (clean). Demo fixtures: no `samples/` text changed (refined copy is runtime-generated;
`schema.test.ts` passes; no schemaVersion bump — `limpedPot` is additive/optional on `explanationInput`).
