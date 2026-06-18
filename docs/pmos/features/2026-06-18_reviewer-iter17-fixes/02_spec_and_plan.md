# Spec + Plan — Reviewer iteration-17 fixes

Tier 1. Combined design + task breakdown for four coaching-grading / copy fixes: one MINOR correctness
item (#1), two MINOR copy items (#2, #3), one NIT copy item (#4). Edits live in
`core/analysis/{analyze.ts, explain.ts, conceptTags.ts}`, `components/FeedbackPanel.tsx`,
`core/mental/estimate.ts`, and `components/MentalMathSection.tsx`. No EV/equity/pot-odds computation
change; no `HandRecord` schemaVersion bump (one additive concept tag only).

## Design decisions

### FR-1 Equity-alone gross-overbet escalation (#1) — MINOR (correctness)
- **Mechanism / threshold (`analyze.ts`, `withGrossOverbet`).** The iter-16 escalation gate was
  `lowEquitySpew = madeHand == null && equityPct < OVERBET_VALUE_EQUITY_PCT`. It is widened to gate on
  **equity alone**: `lowEquitySpew = equityPct < OVERBET_VALUE_EQUITY_PCT` (`OVERBET_VALUE_EQUITY_PCT =
  50`, unchanged). A weak made hand (a 9%-equity underpair) shipping a gross overbet is now a spew → the
  good/thin grade escalates to ❌ `mistake` (severity 2). The `madeHand` param to `withGrossOverbet` is
  dropped (no longer read). A genuine value overbet made while AHEAD (`equityPct ≥ 50`, e.g. a set at
  70%) keeps the ⚠️ `thin` "size down" treatment. A branch already a mistake is never softened.
- **Why this is safe.** The aggression branch still tags a low-equity made hand `made_hand_thin_value`
  / a no-made-hand low-equity bet `bluff_*` BEFORE `withGrossOverbet` runs; the escalation only fires
  when the bet is ALSO a gross overbet (≥ 3× pot postflop / ≥ 8× preflop). A normal-sized thin made-hand
  bet is untouched — it never reaches the overbet flag.

### FR-2 Drop "Thin value" on the low-equity overbet (#2) — MINOR
- **Mechanism (`analyze.ts` + `conceptTags.ts` + `FeedbackPanel.tsx`).** When `withGrossOverbet`
  escalates to a mistake, it now STRIPS any value tag (`made_hand_thin_value` / `thin_value_good`) from
  the branch's `conceptTags` and adds a new additive tag `oversize_no_value` alongside the existing
  `oversize_bet`. `FeedbackPanel.TAG_LABELS` maps `oversize_no_value` → "No value", so the chips read
  "Oversized" + "No value" instead of "Oversized" + "Thin value". The verdict badge already shows the
  "Oversized" headline whenever `oversize_bet` is present (unchanged). A value/ahead overbet keeps its
  value tag (no stripping, no `oversize_no_value`), so "Thin value"/"Oversized" stays for the set case.
- **Copy.** The `explain.ts` overbet branch already bases its DIRECTION read on equity, not the
  verdict: at 9% (< `NO_EQUITY_PCT`) it reads "Betting with only ~9%, but betting ~6× the pot risks a
  huge amount to win a tiny pot — size down." No "value" language — already coherent, kept as-is.

### FR-3 Mental Math names the References tab (#3) — MINOR
- **Mechanism (copy-only).** `core/mental/estimate.ts` and `components/MentalMathSection.tsx` change
  "see the Preflop Chart tab" → "see the Preflop Chart in the References tab." Existing tests assert
  `/Preflop Chart/i`, which still matches — no test update needed.

### FR-4 Borderline-price "it's close" hedge (#4) — NIT
- **Mechanism / threshold (`explain.ts`, `price()` + conceptual `price`).** A new
  `isBorderlinePrice(equityPct, potOddsPct)` returns true when `abs(equityPct − potOddsPct) ≤
  BORDERLINE_PRICE_MARGIN` (= 3). For a ✅ `good` price verdict only, inside the band the copy appends a
  brief hedge: equity-depth fold → "…folding is right, though it's close."; equity-depth call → "A call
  — though it's close, you're just on the right side of the price."; conceptual mirrors both digit-free
  ("…so folding is right — though it's close." / "You're just on the right side of the price here, so
  calling is fine — though it's close."). Outside the band the existing confident wording ("Easy call",
  "you don't have the odds") is unchanged. ⚠️ thin / ❌ mistake price copy is untouched.

## Test / verification plan
- `core/analysis/analyze.test.ts`:
  - iter-16's "low-equity MADE-hand overbet → thin" assertion is REPLACED by "low-equity MADE-hand
    overbet → mistake" (its premise was exactly the carve-out #1 removes).
  - NEW: the 5♥5♠ underpair, 9%, 6×-pot shove → ❌ mistake (tallies as mistake), `oversize_no_value`
    present, `made_hand_thin_value` / `thin_value_good` absent.
  - NEW: a set (70%) gross overbet stays ⚠️ thin, keeps its value framing, no `oversize_no_value`.
  - KEPT: 97o 100 BB shove → mistake; AKs/KK oversized open stays thin (unchanged by #1).
- `core/analysis/explain.test.ts`: within-margin fold (13/14) and call (24/22) → "close" hedge present;
  clear fold (5/24) → no hedge, confident wording kept; conceptual within-margin → hedge + no digits;
  conceptual clear → no hedge.
- `components/MentalMathSection.test.tsx`: existing `/Preflop Chart/i` assertions still pass.
- `core/history/schema.test.ts`: demo fixtures still validate (only an additive concept tag; no
  schemaVersion bump; validator ignores extra keys).

## Self-review checklist (a)–(e)
- (a) 5♥5♠ 9% 6×-pot shove → ❌ mistake, tallies as mistake. ✅
- (b) genuinely-ahead value overbet (set, 70%) → ⚠️ "size down". ✅
- (c) low-equity overbet no longer reads "Thin value" (tag stripped, "No value" chip). ✅
- (d) Mental Math names the References tab. ✅
- (e) 13%-vs-14% fold gets a "close" hedge; a clear fold (5/24) does not. ✅

## Documented-only (no code change)
- 700×500: seat cards / bot-bet chips get very small — pure smallness, no clip/overlap. Accepted
  scale-to-fit tradeoff, consistent with the project's responsive stance (spec §17).
</content>
