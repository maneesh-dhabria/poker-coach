# Mental Math (Outs & Equity Walk-Through) — Technical Spec

**Date:** 2026-06-03
**Last updated:** 2026-06-03
**Status:** Draft
**Tier:** 2 — Enhancement
**Requirements:** `01_requirements.md`

## 1. Overview

A new **pure core module** (`core/mental/`) computes the guide's mental-estimation walk-through
deterministically, and a new **presentational component** (`components/MentalMathSection.tsx`) renders
it as a collapsible section inside the existing `FeedbackPanel`. The component reads the live hand from
`gameStore`, calls the core module synchronously for the mental estimate, and calls the existing
`requestEquity` client asynchronously for the "true" Monte Carlo win equity used in the comparison.

**Architecture rule compliance (CLAUDE.md §17):** all math lives in `core/*` (pure, no React/DOM);
the component is presentational and never recomputes — it reads the `MentalEstimate` object the same
way `FeedbackPanel` reads `DecisionAnalysis`. The equity worker is reused unchanged.

```
gameStore.flow (live hand) ──► MentalMathSection (component, in FeedbackPanel)
                                   │
            ┌──────────────────────┴───────────────────────┐
            ▼ (sync, deterministic)                          ▼ (async, existing)
     core/mental/estimate.ts                          core/equity/equityClient.ts
     buildMentalEstimate(input) → MentalEstimate       requestEquity(...) → trueWinPct
            │
            ├─ core/mental/outs.ts   countOuts(hole, board) → OutsBreakdown
            └─ core/mental/hit.ts    ruleOf2And4(...) , exactHitPct(...)
```

## 2. New module: `core/mental/`

### 2.1 Types (`core/mental/types.ts`)

```ts
import { Card } from "@/core/cards";
import { Street } from "@/core/analysis/types";

export type DrawKind =
  | "flush"
  | "open-ended-straight"
  | "gutshot"
  | "overcards"
  | "none";

/** One detected draw group, with the exact set of completing cards (for overlap-correct totals). */
export interface DrawGroup {
  kind: DrawKind;
  label: string;            // plain language, e.g. "Flush draw — 9 hearts left"
  outCards: Card[];         // the specific cards that complete THIS draw
  soft: boolean;            // true for overcards & taint-flagged groups (D8) — "may not win"
  softReason?: string;      // e.g. "top pair may not be best on a wet board"
}

export interface OutsBreakdown {
  groups: DrawGroup[];
  uniqueOutCards: Card[];   // union across groups (overlap counted once)
  totalOuts: number;        // uniqueOutCards.length
  overlapCount: number;     // sum(group sizes) - totalOuts  (the "−2" line in the guide)
  hardOuts: number;         // totalOuts excluding cards that come only from soft groups
}

export interface TaintFlags {
  twoTone: boolean;         // two of a suit on board, hero not on that flush draw
  paired: boolean;          // board is paired → full house possible
  connected: boolean;       // 3+ to a straight on board
  heroFlushNotNut: boolean; // hero's flush draw is not to the nuts
  heroLowEndStraight: boolean; // hero drawing the "idiot end"
  notes: string[];          // plain-language warnings derived from the flags above
}

export type EstimateStatus =
  | "ok"            // flop or turn with a usable situation
  | "preflop"       // Rule of 2&4 not applicable
  | "river"         // no cards to come
  | "no-hand"       // no live hand / hero not in it
  | "no-draw";      // ok street but no countable drawing outs

export interface MentalEstimate {
  status: EstimateStatus;
  street: Street | null;
  outs: OutsBreakdown | null;
  taint: TaintFlags | null;

  ruleMultiplier: 2 | 4 | null;     // turn → 2, flop → 4
  ruleHitPct: number | null;        // Rule of 2&4 estimate (capped at 100)
  exactHitPct: number | null;       // deterministic exact P(≥1 out hits) — the technique's ground truth
  bigDrawCaveat: boolean;           // true when totalOuts > 12 on the flop (×4 overcounts)

  opponentShade: { lowPct: number; highPct: number; sentence: string } | null; // Step 3 (explanatory)

  potOdds: { toCall: number; potAfterCall: number; breakEvenPct: number } | null; // Step 5
  decision: { profitable: boolean | null; sentence: string } | null;             // Step 6

  // Step "Check your work" — populated by the component once trueWinPct arrives (async).
  // Core leaves comparison null; the component composes it from ruleHitPct/exactHitPct + trueWinPct.
  plainSummary: string;             // one-line headline for the collapsed/■ state
}

export interface MentalInput {
  hole: [Card, Card] | null;
  board: Card[];
  street: Street;
  potBefore: number;
  toCall: number;
  numActiveOpponents: number;
  outsOverride?: number | null;     // when the player edits the count (alternate journey)
}
```

### 2.2 Out counting (`core/mental/outs.ts`)

`countOuts(hole: [Card,Card], board: Card[]): OutsBreakdown`. Deterministic, no RNG. Operates on the
2 hole + 3–4 board cards (flop/turn). Algorithm:

1. **Seen set** = hole ∪ board. **Candidates** = the 52 − seen unseen cards.
2. **Flush draw** (FR-04): for each suit, count hero+board cards of that suit. If a suit total `== 4`,
   the draw is live → `outCards` = all unseen cards of that suit (9). (`== 3` is a backdoor — **not**
   counted in v1, see Non-Goals.) `kind:"flush"`, label `"Flush draw — N <suit> left"`.
3. **Straight draws** (FR-05): build the set of distinct rank-values present (hole+board, Ace counted as
   both 14 and 1 for wheel detection). For each candidate rank `r`, test whether adding one card of rank
   `r` produces ≥5 consecutive rank-values spanning hero involvement. Classify:
   - If **two distinct ranks** complete a straight → **open-ended** (`outCards` = all unseen cards of
     those two ranks, up to 8). label `"Open-ended straight — 8 cards (X, Y)"`.
   - If **one rank** completes → **gutshot** (4). label `"Inside straight (gutshot) — needs a <R>"`.
   - Use the rank→outCards mapping so flush/straight overlaps (e.g. K♥) are deduped at the union step.
4. **Overcards** (FR-06, D8): if there is no made pair for hero and a hole card's rank > every board
   rank, each such overcard contributes its 3 unseen pairing cards. `soft:true`,
   `softReason:"top pair may not be the best hand"`. Two overcards → 6 soft outs. label
   `"Two overcards — 6 cards (soft)"`.
5. **Union & overlap** (FR-07): `uniqueOutCards` = dedup union of every group's `outCards`.
   `overlapCount = Σ|group| − totalOuts`. `hardOuts` = |union of non-soft groups' outCards|.
6. If no group has outCards → `groups:[{kind:"none",...}]`, totalOuts 0 → drives `no-draw` status.

**Made-hand guard:** if hero already has a strong made hand (straight/flush/full+ using current cards),
v1 reports `no-draw` with a note ("you likely already have the best hand") rather than inventing
improvement outs — the guide is about *draws*. (Detected via the existing `rank7`/evaluator: hero's
current best 5-card category.)

### 2.3 Hit math (`core/mental/hit.ts`)

- `ruleOf2And4(totalOuts: number, street: "flop"|"turn"): number` → `min(100, outs * (street==="flop"?4:2))`.
- `exactHitPct(totalOuts: number, unseenCount: number, cardsToCome: 1|2): number` (FR-08):
  deterministic exact probability that ≥1 of `totalOuts` outs appears, via complement of "miss every
  street": `1 − C(unseen−outs, cardsToCome)/C(unseen, cardsToCome)`, ×100, rounded to 1 dp.
  (`unseenCount` = 52 − 2 − board.length; `cardsToCome` = 2 on flop, 1 on turn.) This is the honest
  ground truth for the *hit estimate*, used for the "within X%" closeness badge.
- `bigDrawCaveat` = `street==="flop" && totalOuts > 12` (FR-09) — surfaces the guide's "×4 overcounts
  above ~12 outs" note.

### 2.4 Discounts, pot odds, decision, taint (`core/mental/estimate.ts`)

`buildMentalEstimate(input: MentalInput): MentalEstimate` orchestrates everything (FR-10):

- **Status routing** (FR-03): `no-hand` if `hole==null` or `board.length<3`; `preflop` if
  `street==="preflop"`; `river` if `street==="river"` or `board.length===5`; else compute. `no-draw`
  when `totalOuts===0` on an `ok` street.
- **Outs** from §2.2 (or `outsOverride` substituted into `totalOuts` for the alternate journey, FR-11 —
  override replaces the count; groups still shown for context, flagged "(your count)").
- **Opponent shade** (Step 3, D7/D9 explanatory, FR-12): heads-up (`numActiveOpponents<=1`) → no shave,
  sentence "Heads-up — hitting ≈ winning, trust the number." `==2` (3-way) → shave ~10–20%,
  `{low,high}` = hitPct×0.8…×0.9. `>=3` → shave more, ×0.7…×0.85, sentence "be skeptical of marginal
  draws." Shade is **presented as a sentence with a range**, never a single precise output number.
- **Taint** (Step 4, FR-13): `detectTaint(hole, board)` sets the `TaintFlags` and composes plain `notes`.
  v1 = textual warnings + the soft flag already set on at-risk groups; **no auto-subtraction** (OQ#2).
- **Pot odds** (Step 5, FR-14): `breakEvenPct = toCall<=0 ? 0 : toCall/(potBefore+toCall)*100`. When
  `toCall===0`, sentence "It's free to see the next card — no price to pay." else "Call $X into $Y → you
  need about Z% to break even."
- **Decision** (Step 6, FR-15): compare the **shaded win estimate midpoint** to `breakEvenPct`.
  `profitable = midpoint > breakEvenPct`. Sentences: profitable / "marginal — about the price" (within
  ±3%) / "the price is too steep." `toCall===0` → "Free card — just take it."
- **plainSummary**: e.g. `"15 outs → ~57% to hit; you need 25% — an easy call."`

`buildMentalEstimate` is **synchronous and pure**. It never calls the equity engine. The "true win %"
and the comparison are composed in the component (§3.3) because the equity call is async.

## 3. Component: `components/MentalMathSection.tsx`

### 3.1 Data sourcing (FR-16)

Reads `gameStore` via selectors (no props needed beyond an `enabled` passthrough). Builds `MentalInput`:

- When `flow?.isHeroTurn()` → use `flow.heroSpot()` (`hole, board, potBefore, toCall, street,
  numActiveOpponents`) — the richest snapshot.
- Else when `flow` exists and not over → derive a read-only snapshot: `hole=flow.heroHole()`,
  `board=flow.board`, `street=flow.street`, `potBefore=flow.potNow()`, `toCall=0`,
  `numActiveOpponents` = count of non-folded non-hero seats from `flow.tableView()`.
- Else (`flow==null`, hand over, or hero folded) → `hole=null` → `status:"no-hand"`.

Re-derives on `gameStore.tick` (the existing render trigger) so it tracks the live hand.

### 3.2 Render (matches `FeedbackPanel` styling; FR-17)

- Collapsible header (`▸/▾ Mental Math` + a one-line hand context). Collapsed by default; open/closed
  state stored in `sessionStore` (`mentalMathOpen: boolean`, ephemeral UI state alongside `activeTab`)
  so it persists for the session (FR-18).
- For `status:"ok"`: render Steps 1–6 as labeled step cards per the wireframe (`wireframes.html` frame
  B). Step 1 shows each `DrawGroup.label`, soft tags, the overlap line, the total, and an
  **"I count differently ▸"** control.
- For `preflop`/`river`/`no-hand`/`no-draw`: render the single plain note from the wireframe (frame C),
  no step cards. (`no-draw` and `river` still show pot odds + the true-equity check when available.)
- Reuses the equity-bar markup/tokens from `FeedbackPanel` for Step 5's break-even bar and the
  comparison. Uses existing `Card`/suit rendering for any card pips.

### 3.3 True-equity comparison ("Check your work"; FR-19, D9)

- On mount / when the live hand changes to an `ok`/`no-draw`/`river` status with a valid `hole`+`board`,
  call `requestEquity({ hero: hole, board, numOpponents: max(1,numActiveOpponents), iterations: 1500,
  seed })` via the existing client (worker + sync fallback). Show a "calculating true equity…" state;
  the mental steps never block on it (FR-20).
- Once `trueWinPct` resolves, compose the comparison:
  - **Headline:** "You hit ~`{ruleHitPct}`% · True win ≈ `{trueWinPct}`%".
  - **Technique check (closeness):** `|ruleHitPct − exactHitPct|` → badge "your Rule-of-`{4|2}`
    estimate was within `{Δ}`% of the exact hit chance (`{exactHitPct}`%)". (Closeness is graded on the
    HIT estimate vs the exact HIT probability — the only like-for-like grade of the technique.)
  - **Hit→win gap:** "you hit ≈`{exactHitPct}`% but win ≈`{trueWinPct}`% — that gap is the opponents +
    board danger (Steps 3 & 4)." (This is the D9 hit≠win lesson made visible.)
- **EV (collapsible "Show the dollar EV ▸"; FR-21):** `evCall = trueWinPct/100 * (potBefore + toCall) −
  toCall`, formatted in the session display unit. Uses the **true** equity for an honest dollar figure;
  labeled "(based on the true equity)".

### 3.4 Override interaction (FR-11)

"I count differently" reveals a small stepper (− / N / +) and toggles for soft groups. On change, set
local `outsOverride` and re-run `buildMentalEstimate` with it (sync) — Steps 2–6 + closeness recompute
instantly. `trueWinPct` is unaffected (it's ground truth). A "reset to auto" link clears the override.

## 4. Integration point

`FeedbackPanel.tsx` renders `<MentalMathSection enabled={enabled} />` after its EV details block,
inside the same panel container, separated by the existing `hr` divider. No `TabKey`/`TabStrip`/
`RightPanel` changes (D0). `sessionStore` gains `mentalMathOpen: boolean` + `setMentalMathOpen`.

## 5. Edge cases (mirror requirements)

| Status | Trigger | Render |
|--------|---------|--------|
| `no-hand` | no flow / hero folded / `board.length<3` | "Deal a hand and reach the flop to use Mental Math." |
| `preflop` | `street==="preflop"` | "The Rule of 2 & 4 is for the flop and turn. See the Preflop Chart tab." |
| `river` | `street==="river"` / 5 board cards | "No cards left to come on the river…"; still shows pot odds + true equity. |
| `no-draw` | `ok` street, `totalOuts===0` | "No clear drawing outs detected…"; shows true equity if useful. |
| true-equity in flight | worker pending | "calculating true equity…"; steps already visible. |
| `toCall===0` | hero can check | Step 5/6 → "free to see the next card." |

## 6. Testing strategy

**Pure core (`core/mental/*.test.ts`) — the bulk of coverage:**
- `outs.test.ts`: the guide's worked example **Q♥J♥ on 10♥9♣2♥ → 15 outs** (9 flush + 8 OESD − 2
  overlap); flush draw = 9; bare gutshot = 4; OESD = 8; two overcards = 6 (soft); combo flush+gutshot ≈
  12; double-count guard (8♥/K♥ once); made-hand → `no-draw`; backdoor (3-to-flush) not counted.
- `hit.test.ts`: `ruleOf2And4(15,"flop")===60`→capped/clamped vs `min(100,..)`; `ruleOf2And4(8,"turn")===16`;
  `exactHitPct` matches known values (9 outs, flop, 47 unseen ≈ 35%; 9 outs turn ≈ 19.6%); `bigDrawCaveat`
  true at 15/flop, false at 9.
- `estimate.test.ts`: status routing (preflop/river/no-hand/no-draw); pot-odds break-even (call 20 into
  60 → 25%); decision profitable/marginal/steep; `toCall===0` path; opponent shade ranges by player
  count; override substitution; taint flags on a two-tone/paired/connected board; the guide's full
  flop→turn worked example end-to-end.

**Component (`components/MentalMathSection.test.tsx`):** renders each status; renders Step 1 groups +
soft tag; collapsed-by-default; "calculating true equity" then comparison after a mocked `requestEquity`;
override stepper recomputes; matches `FeedbackPanel` token usage (verdict colors / equity bar present).

**Determinism:** core tests use fixed inputs (no RNG). The equity client is mocked in component tests.

## 7. Verification plan

- `npm run typecheck` clean (new module fully typed; no `any`).
- `npm run lint` clean.
- `npm test` — all new + existing tests green (no regressions to FeedbackPanel/analyze/equity).
- Manual: deal a hand to the flop with a draw, open Feedback → Mental Math, confirm steps + comparison;
  check preflop/river/no-draw notes; toggle override; confirm collapsed default + session persistence.
- Architecture: `core/mental/*` has zero React/DOM imports (grep guard); component never recomputes math.

## 8. Functional requirements (testable)

| # | Requirement |
|---|---|
| FR-01 | A collapsible "Mental Math" section renders inside `FeedbackPanel`, below existing content; no new tab. |
| FR-02 | The section reads the live hand from `gameStore`; requires no manual card entry. |
| FR-03 | Status routing: `no-hand`/`preflop`/`river`/`no-draw`/`ok` produce the specified renders. |
| FR-04 | Flush draw (exactly 4 to a flush) → 9 outs of that suit; backdoor (3) not counted. |
| FR-05 | Straight draws classified OESD (8) vs gutshot (4) with correct completing cards. |
| FR-06 | Two overcards (no made pair, both over board) → 6 outs, flagged `soft`. |
| FR-07 | Combined draws dedupe overlapping out-cards; `totalOuts` = unique union; overlap shown. |
| FR-08 | `exactHitPct` is deterministic and matches hypergeometric ground truth. |
| FR-09 | `bigDrawCaveat` true when >12 outs on the flop. |
| FR-10 | `buildMentalEstimate` is pure/sync; computes all six steps. |
| FR-11 | Outs override replaces the count and live-recomputes Steps 2–6 + closeness; true equity unchanged. |
| FR-12 | Opponent shade scales with active-opponent count and renders as a ranged sentence, not a single precise %. |
| FR-13 | Taint detection sets two-tone/paired/connected/non-nut/low-end flags + plain notes; no auto-subtraction in v1. |
| FR-14 | Pot-odds break-even = toCall/(potBefore+toCall); `toCall===0` → free-card copy. |
| FR-15 | Decision compares shaded midpoint to break-even → profitable/marginal/steep sentence. |
| FR-16 | Section never blocks on the async equity call; mental steps render immediately. |
| FR-17 | Visual language matches `FeedbackPanel` (tokens, verdict colors, equity bar). |
| FR-18 | Collapsed by default; open state persists for the session via `sessionStore`. |
| FR-19 | "Check your work" shows hit estimate vs true win, closeness on hit-vs-exact-hit, and the hit→win gap. |
| FR-20 | A loading state shows while true equity computes; resolves into the comparison. |
| FR-21 | Optional $ EV uses the true equity and the session display unit. |
| FR-22 | `core/mental/*` has no React/DOM imports (architecture rule §17). |

## 9. Out of scope (per requirements non-goals)

Manual situation entry; quiz mode; preflop/river estimation math; persistence/accuracy history;
backdoor draws; auto-subtracting tainted outs; changes to `analyze()`, the equity engine, or saved
`HandRecord`s.
