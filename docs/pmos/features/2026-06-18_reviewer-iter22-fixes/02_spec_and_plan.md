# Spec + Plan — Reviewer iteration-22 fixes

Tier 3. Combined design + task breakdown for a SYSTEMIC preflop grading defect (two MAJORs), four MINORs,
and one NIT. Edits live in `core/analysis/analyze.ts`, `core/analysis/explain.ts`,
`core/analysis/conceptTags.ts`, `core/analysis/types.ts`, `core/charts/preflop.ts`,
`components/HandRecap.tsx`, and `components/ActionBar.tsx`. No EV/equity/pot-odds math change, no postflop
verdict-bucketing change, no engine/side-pot change, no `HandRecord` schemaVersion bump (one additive
optional field).

## Root-cause trace (confirmed by reproducing each reviewer spot)

| Reviewer case | BEFORE branch | AFTER branch |
|---|---|---|
| **J9o CO open, limped pot** (chart folds J9o) | `route()` skips iso (chart wouldn't open J9o) and the chart branch (`!isLimpedPot` false) → falls to `aggressionBranch(22, null)` → `bluff_thin_equity` ❌ "Light semi-bluff … not enough to push" | limped-pot block → `looseOpenBranch()` → ⚠️ thin `loose_open` (≈ −1 BB, kept thin by `escalateLooseOpenIfLosing`); copy "Raising J♥9♣ from CO is on the loose side …" |
| **47s MP open, limped pot** | same `aggressionBranch(15, null)` → `bluff_no_equity` ❌; Conceptual "raising with little behind it — there's not enough here" | `looseOpenBranch()`; Conceptual → `conceptualPreflopDeviation` "too weak to raise from early position — hands like it play poorly after the flop …" |
| **A7o BB call $4 into ~$32** (chart folds A7o) | chart branch → rec fold, hero call → `call_too_wide` ❌ "the math favors folding" while equity 18% ≥ ~11% needed | chart branch defers to `callBranch(18, 11)` → ✅ `call_correct_price` "Right price"; gtoClaim=false |
| **Hand-2 borderline fold 47s MP vs 3-bet** (≈15% vs 14%) | MP has no vs-raise chart → `foldBranch` (price) → ✅ borderline | UNCHANGED — `foldBranch` price path; still ✅ "about equal … folding is fine" |

## Design decisions

### MAJOR-1a — no preflop RAISE may be graded by `aggressionBranch` (`analyze.ts`)

- **Limped-pot open.** The existing iso-raise block is extended: in a limped pot, a chart-open hand → the
  existing `isoRaiseBranch` (✅ iso); a chart-fold hand → the new `looseOpenBranch()`. A grossly-oversized
  loose open still gets its size critique via `withGrossOverbet(looseOpenBranch(), …, PREFLOP_OVERBET_…)`
  (keeps the iter-16 #3 oversize-open behavior).
- **Off-chart open fallthrough.** A preflop RAISE that reaches the heuristic section with
  `facing === "unopened"` (off-chart seat / limped pot that didn't match the chart guard) is routed to
  `looseOpenBranch()` instead of `aggressionBranch`. A preflop raise **facing a raise** (a 3-bet/4-bet) is
  NOT an open — it continues to the overbet/aggression path so a gross 4-bet shove still flags (iter-13 #2).
- **`looseOpenBranch`.** Returns kind `preflop`, gtoClaim=false, verdict ⚠️ thin, severity 1, tags
  `["loose_open","preflop_chart_deviation"]`, `chartActionForExplain:"fold"`, `heroDeviates:true` (so the
  Conceptual `conceptualPreflopDeviation` reads "chart folds, hero raised → too weak here").

### MAJOR-1b — a preflop CALL facing a price defers to pot odds (`analyze.ts`)

- Inside the preflop chart branch, before grading a `call` against the chart, compute
  `callBranch(equity, potOdds)`. If it grades good/thin (price clearly met) → return it (gtoClaim=false,
  copy reconciles with the chart's default fold). If it would grade a mistake (price NOT met) → fall
  through to the chart branch, where `call_too_wide` stands with an agreeing number.

### MAJOR-2 — Conceptual loose-open reason is plain (consequence of MAJOR-1a)

- A loose open routes through the existing `conceptualPreflopDeviation` machinery (chart fold + hero
  raised → "too weak to raise from {position} …"). Digit-free, a real strength reason. The conceptual
  preflop case checks `p.looseOpen` first so a junk open is never softened to "raising can be right".

### MINOR #4 — severity by EV magnitude (`analyze.ts`)

- `escalateLooseOpenIfLosing(branch, ev, bigBlind)` (mirrors `escalateThinValueIfLosing`): a `loose_open`
  thin branch escalates to ❌ mistake when `ev.raise < −LOOSE_OPEN_LOSS_BB * bigBlind` (1.5 BB). Anchored
  to BOTH reviewer points: J9o CO ≈ −1 BB stays ⚠️ thin; a clearly-losing junk open (72o UTG, ≈ −3 BB)
  → ❌ mistake. Wired into the pipeline alongside the existing thin-value escalation.

### MINOR #5 — correct "raise" verb / no "Bluff (no equity)" for an open (`explain.ts`)

- The loose open routes through kind `preflop`, not `aggression`, so the Strict / Equity copy reads as a
  RAISE with a position+strength reason — never "you're betting" / "Bluff (no equity)" / "no made hand" /
  "push". A new `looseOpen` branch at the top of `preflop()` (and a `looseOpen` check in the conceptual
  preflop case) owns the copy at all three depths, verdict-aware (thin vs mistake) and oversize-aware.

### MINOR #6 — coherent chart rationale (`core/charts/preflop.ts`)

- `SMALL_PAIRS` narrowed to the 22–55 boundary band. `cellRationale` now covers two coherent cases at the
  early-position small-pair boundary: a FOLD cell (22 MP, 22/33/44 UTG) → "the bottom of the range … the
  slightly bigger ones are opened" (no blanket condemnation); a RAISE cell (33/44/55 MP, 55 UTG) → a brief
  "why open" line (set-mines with a touch more equity). Chart RANGE / classifications unchanged.

### MINOR #7 — review-list sub-row spacing (`HandRecap.tsx`)

- Each stacked sub-row is laid out `display:flex; align-items:baseline; gap:8` so the verdict icon sits in
  its own column with clear space before the text; multi-action sub-rows get `marginTop:6` between them.

### NIT #8 — fine slider step + overbet hint (`ActionBar.tsx`)

- `step = max(1, round(bigBlind/2))` (1 small blind = $1) for precise keyboard sizing; min-raise/all-in
  bounds and the effective-stack cap (`offeredMax`) are untouched. A subtle `overbet-hint` span shows when
  `sized − toCall > pot` (no hard block).

## Plan / task order (TDD)

1. `conceptTags.ts`: add `loose_open`.
2. `analyze.ts`: `looseOpenBranch`, `escalateLooseOpenIfLosing` + `LOOSE_OPEN_LOSS_BB`; route limped-pot
   opens (iso vs loose) and the off-chart open fallthrough; defer preflop calls to pot odds; thread
   `looseOpen` into the analysis output + `explanationInput`.
3. `types.ts`: add optional `looseOpen` to `ExplanationInput`.
4. `explain.ts`: add `looseOpen` to `ExplainParams` + `formatExplanation`; the loose-open `preflop()` copy
   (all depths, verdict/oversize-aware) and the conceptual `looseOpen` branch.
5. `core/charts/preflop.ts`: narrow `SMALL_PAIRS`, extend `cellRationale`.
6. `HandRecap.tsx`: sub-row flex/spacing.
7. `ActionBar.tsx`: slider step + overbet hint.
8. Tests (anchored to the reviewer's exact spots): analyze (a)–(f), preflop chart (g), explain loose-open
   verb/depth, ActionBar step + overbet hint; rewrite the iter-12 limped-pot test that encoded the old
   "not a chart deviation" behavior and the iter-21 cellRationale tests that asserted "" for raise cells.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — all green.
- (a) limped-pot CO/MP open never a "semi-bluff/bluff/no made hand/push"; reads as a loose RAISE with a
  position/strength reason. (b) marginal loose open ⚠️ thin; junk ❌ mistake. (c) chart-open hand ✅ iso.
  (d) priced BB call NOT a mistake, never "favors folding"; below-price call still `call_too_wide` with an
  agreeing number. (e) Conceptual loose open digit-free, plain reason. (f) Hand-2 borderline fold still
  break-even. (g) POSTFLOP grading unchanged. (h) chart rationale coherent + covers raise cells.
  (i) showdown reveal, depth control, responsive layout, Mental Math all intact.
