# Spec + Plan — Reviewer iteration-21 fixes

Tier 2. Combined design + task breakdown for one MINOR copy-quality gap and five NITs. Edits live in
`core/analysis/explain.ts`, `core/charts/preflop.ts`, `components/PreflopChartTab.tsx`,
`components/ActionBar.tsx`, `components/FeedbackPanel.tsx`, and `components/table/{PokerTable,Seat}.tsx`.
No EV/equity/pot-odds change, no verdict-bucketing change, no side-pot/engine change, no `HandRecord`
schemaVersion bump.

## Design decisions

### MINOR — Conceptual preflop deviation teaches a plain reason (`explain.ts`)

- **The gap.** The conceptual preflop-chart deviation branch returned a single generic string,
  "This differs from the standard baseline line for this spot." — true but unteachable for the depth aimed
  at non-math newcomers.
- **Mechanism.** A new pure helper `conceptualPreflopDeviation(p)` reads the fields already on
  `ExplainParams`: `p.position`, `p.chartAction` (what the chart recommends), and `p.action` (what the hero
  did). A small `positionPhrase()` maps the seat to "early position" (UTG/MP) / "late position" (CO/BTN) /
  "the blinds" (SB/BB). The direction of the deviation is read from chart-vs-hero:
  - chart `fold`, hero played on (raise/call) → **too-loose open**: "This hand is too weak to raise from
    {early position} — hands like it play poorly after the flop, so folding is the standard line here."
  - chart opens/continues, hero folded → **too tight**: "This hand is strong enough to play from {where} —
    folding it gives up a profitable raise."
  - chart `raise`, hero `call` (or vice versa) → **wrong aggression**: a plain "raise, not just call"
    (or "call rather than raise") reason.
  - fallback (no usable direction) → "This isn't the standard line from {where} for a hand like this." —
    still plain and position-aware, never the old "baseline line" text.
- **Why safe.** Verdict and severity are untouched (still computed in `analyze.ts`). The branch fires only
  at `depth === "conceptual"` for a preflop-chart deviation, so Equity/Strict copy is unchanged. The copy
  contains no digits — it stays inside the Conceptual digit-free contract.

### NIT 1 — quick-size highlight is derived, not sticky (`ActionBar`)

- **Mechanism.** A `quickActive(fraction) = sized === quickTo(fraction)` predicate (exact integer match,
  same clamp as the click handler) drives each button's `selected` (shared Button gold affordance) and
  `aria-pressed`. No new "last clicked" state — dragging the slider or typing re-computes `sized` and the
  highlight follows automatically, so it clears the moment the amount no longer matches and re-lights when
  it does.

### NIT 2 — small-pair early-fold rationale (`core/charts/preflop` + `PreflopChartTab`)

- **Mechanism.** A pure `cellRationale(key, position, action)` returns a one-sentence plain note ONLY for a
  small pocket pair (22–66) that the chart **folds** (`action === "fold"`) from an early position
  (UTG/MP); "" for every other cell. The note explains set-mining needs deep stacks + several callers,
  which early position rarely has. `PreflopChartTab`'s detail card renders it conditionally
  (`data-testid="chart-cell-rationale"`).
- **Why safe.** The chart RANGE (`open`/`vsOpen` JSON) and every `chartAction` classification are
  unchanged — 55-77 still open UTG, so the helper's gate on `action === "fold"` keeps the note off the
  opened pairs. Pure helper, unit-tested independently.

### NIT 3 — table stays readable at small viewports (`PokerTable`)

- **The cause.** The felt is a fixed 760×520 design box scaled uniformly to fit (`fitScale`). At a tiny/
  short viewport (700×500 → height-driven ~0.28) the seats (~120px) and cards shrink past legibility.
- **Mechanism.** `readableScale(w,h) = max(MIN_TABLE_SCALE, fitScale(w,h))` (floor 0.55, ~66px seats) is
  the value rendered; `fitScale` and its existing tests are left intact. Because `transform:scale` doesn't
  shrink an element's layout box, a sizing wrapper is set to `DESIGN × scale` and the felt uses
  `transformOrigin:"top left"`, so the stage's `overflow:auto` reflects the **scaled** footprint — it fits
  with no scrollbar whenever the floored box ≤ the container, and scrolls only on a genuinely tiny/short
  viewport. On the praised 1366/1280/800/600 layouts the fit scale is already above 0.55, so the floor and
  the wrapper change nothing.

### NIT 4 — feedback block fills the panel (`FeedbackPanel`)

- **Mechanism.** The verdict `<aside>` switches from a fixed `maxWidth:420` to `width:100%; maxWidth:640`.
  In single-column the panel is ~568px, so the block fills it; the cap prevents sprawl on very wide
  screens. In two-column the rail is ≤420px, so `width:100%` just fills the rail unchanged.

### NIT 5 — only showdown cards are exposed (`Seat`)

- **Mechanism.** A pure `shouldRevealHoleCards(seat)` returns true for the hero (always sees own cards) and
  for an opponent who did NOT fold and has cards (reached showdown); false for a folded opponent (mucked)
  or one with no cards. The card render is guarded by it, so a folded opponent shows face-down backs even
  if cards are attached.
- **Why safe.** Display-only — never touches winners/net/pot math. `handFlow.tableView` already only
  attaches cards to showdown contenders (`over && endedAtShowdown && contenders.has(seat)`); this predicate
  makes the table layer's intent explicit and is a defensive guard.

## Plan / tasks (TDD)

1. **MINOR copy.** Add `positionPhrase` + `conceptualPreflopDeviation`; route the conceptual preflop-chart
   deviation branch through it. Test (`explain.test.ts`): a too-loose open from UTG → no digits, no
   "differs from the standard baseline line", mentions position + strength; plus too-tight-fold and
   raise-vs-call directions, and the unchanged agree line.
2. **NIT 1.** Add `quickActive`; wire `selected` + `aria-pressed` on ½/¾/Pot. Test (`ActionBar.test.tsx`):
   click Pot → `aria-pressed=true`; drag off → false; set back → true.
3. **NIT 2.** Add `cellRationale`; render in detail card. Test (`preflop.test.ts`): 22/33 UTG/MP → note;
   55 UTG (opened) / 22 BTN / AKs → "".
4. **NIT 3.** Add `MIN_TABLE_SCALE` + `readableScale`; sizing wrapper + `transformOrigin:"top left"`;
   stage `overflow:auto`. Existing `PokerTable.scale.test.ts` (`fitScale`) unchanged and still green.
5. **NIT 4.** `FeedbackPanel` aside width.
6. **NIT 5.** Add `shouldRevealHoleCards`; guard the render. Test (`ActionBar.test.tsx` Seat block):
   predicate truth table + folded opponent renders only card-backs / showdown opponent renders faces.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — all green.
- Self-review: (a) Conceptual preflop too-loose-open gives a plain, digit-free position/strength reason,
  Conceptual stays digit-free; (b) quick-size de-highlights when the amount no longer matches; (c) chart
  shows a plain rationale for a folded small pair from early position (no range/verdict change); (d) table
  no longer cramped at ~700px, 1366/1280/800/600 still reflow cleanly; (e) Live Feedback block fills the
  single-column panel; (f) folded players' cards stay hidden at showdown, contenders revealed, pot math
  unchanged.
- No `HandRecord` schemaVersion bump; demo fixtures unaffected (no fixture carried the old
  preflop-deviation copy).
