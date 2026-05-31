---
tier: 3
type: feature
feature: ux-learning-overhaul
date: 2026-05-31
status: Ready for Plan
requirements: docs/pmos/features/2026-05-31_ux-learning-overhaul/01_requirements.md
---

# Poker Coach — UX & Learning Overhaul — Spec

> Implements the 7 observations of `01_requirements.md` as **6 dependency-ordered waves** (W1–W6). Each wave is independently shippable and testable. Decisions D1–D18 from requirements are carried forward and not re-litigated.

---

## 1. Problem Statement {#problem-statement}

A solo, self-described non-math learner uses Poker Coach to improve at 6-max NLHE. The engine and deterministic analysis are correct, but the **presentation and continuity** get in the way of learning: the game scrolls out of view, nothing persists between hands, you can't tell whose turn it is or who won, there's no in-app rankings/preflop reference, and the coaching reads like a textbook. This feature reshapes the play screen and adds money continuity + two teaching surfaces, **without changing the decision engine's math**. Primary success metric: the learner can play, see continuity (session P/L + lifetime bank), and read who-won/why and plain coaching — all on one desktop fold with no scroll.

---

## 2. Goals {#goals}

| # | Goal | Success Metric |
|---|------|---------------|
| G1 | Game always in view | Zero vertical page scroll at ≥1280×800 on BOTH setup and in-hand; only the active tab body scrolls |
| G2 | Continuity of money | Stacks carry hand-to-hand; session P/L + lifetime bank visible; bust→rebuy; New table resets stacks but carries the bank |
| G3 | Per-hand money legible | Every seat shows its net for the just-finished hand |
| G4 | Follow the action | Seat to act has a distinct "thinking" emphasis, synced to the reveal |
| G5 | See who won and why | Winner glow + winning-5 cards + category banner + per-seat net at hand end |
| G6 | Rankings on hand | Rankings tab lists High Card → Straight Flush with plain examples |
| G7 | Understand baseline & equity | Preflop Chart tab: range grid + click-a-hand plain explanation; no math wall, no runtime LLM |
| G8 | Coaching a human would say | No verdict leads with unexplained jargon; folds get winner's-perspective narration |

---

## 3. Non-Goals {#non-goals}

- **Multi-table** — single persistent table only (D2); multi-table is a separable surface.
- **Mobile / small-screen no-scroll** — desktop-first ≥1280×800 only (D4).
- **Runtime LLM / solver** — all analysis + preflop teach is deterministic/precomputed (no API key, no SDK).
- **Real-money / accounts / server sync** — bankroll persists to local `data/` only (D10).
- **Win-rate analytics (BB/100, graphs)** — out of scope; continuity + legibility first.
- **Decision-engine rewrite** — verdict math in `core/analysis` is unchanged; we change wording + what we surface (D8).
- **New bot strategy/AI** — bot tuning unchanged; bots only gain auto-rebuy (D11).

---

## 4. Decision Log {#decision-log}

Carried from requirements (D1–D18). Spec-level decisions added below as **S-**.

| # | Decision | Options Considered | Rationale |
|---|----------|-------------------|-----------|
| S1 | **Reuse existing `TableView.winners` + `TableSeatView.isActing?` + `TableView.reveal`** for W2 instead of adding engine state | (a) reuse existing view fields, (b) add new outcome plumbing | (a) — the view already exposes winners, acting seat, and revealed cards; W2 is purely presentational + two small pure helpers. |
| S2 | **New pure core helpers** `handCategoryLabel()` + `winningCards()` in `core/eval/` | (a) compute label/best-5 in component, (b) pure core fn | (b) — keeps core the single source of truth, unit-testable, no DOM. |
| S3 | **Bankroll lives in `data/bankroll.json`, single file, own `BANKROLL_SCHEMA_VERSION`** | (a) one file, (b) per-session files | (a) — one lifetime roll for one local user; simplest atomic read/modify/write. (D10/D13) |
| S4 | **New `/api/bankroll` route (GET + PUT)** via `lib/dataStore` atomic writes | (a) dedicated route, (b) fold into sessions route | (a) — bankroll has a distinct lifecycle from per-session settings; clean contract. |
| S5 | **Precomputed equity = committed generated JSON** `core/charts/preflopEquity.json` + a `scripts/genPreflopEquity.ts` generator | (a) commit generated JSON, (b) compute at build, (c) compute on demand | (a) primary for instant/deterministic view; (c) is the runtime fallback when a key is missing (never blocks the tab). |
| S6 | **Money formatter `core/money.ts` (pure) + `displayUnit` flag in `sessionStore`** | (a) shared util + store flag, (b) per-component, (c) defer | (a) — engine/analysis stay in integer dollars; BB is render-only (D18). |
| S7 | **`displayUnit` + `tab` are UI state in stores, not persisted to disk** | (a) ephemeral, (b) persist | (a) — view preferences; only the bankroll is durable this feature. |
| S8 | **Bankroll orchestration in a new `bankrollStore` (Zustand), pure reducer in `core/bankroll.ts`** | (a) split pure reducer + store, (b) all in gameStore | (a) — the carry/bust/rebuy/new-table transitions are pure and unit-testable; the store just persists + wires. |

(D1–D18 are authoritative in `01_requirements.md §Design Decisions` and not duplicated here.)

---

## 5. User Personas & Journeys {#user-personas-journeys}

### 5.1 The Learner (primary) {#the-learner}
Solo, non-math, desktop, local. Two modes: **Player** (in a hand) and **Student** (between hands, browsing Rankings/Preflop Chart, reading Coaching). Wants to *feel* progress (the bankroll) and understand *why* in plain words.

### 5.2 Journey: Play a hand with continuity {#journey-play}
1. Setup (no-scroll) → pick opponents, depth, **starting-stack preset**, Deal.
2. Play screen: table centered + fully visible; header shows **Session P/L** + **Bank**; Feedback tab active.
3. Reveal advances; **seat to act glows**; hero's turn → action bar enables.
4. Hero acts → Feedback tab shows the plain verdict.
5. Hand ends → **winner glow + yellow winning cards + center banner + per-seat net**; header P/L + bank update; stacks carry.
6. Learner reads Coaching (incl. winner's line if folded).
7. New hand → continuity continues.

### 5.3 Journey: Learn a preflop spot {#journey-learn-preflop}
Open Preflop Chart → defaults to hero's current position → click `KJs` → read plain "play because…" card (equity + baseline/equity/position defs + vs-random caveat) → back to play.

### 5.4 Journey: Bust & rebuy {#journey-bust-rebuy}
Hero stack < blind → rebuy modal (top-up from bank to starting stack; auto-rebuy toggle). Bank empty → "New table / out of chips" — never a dead table.

---

## 6. System Design {#system-design}

### 6.1 Architecture Overview {#architecture-overview}

```
┌─────────────────────────── app/page.tsx (play shell) ────────────────────────────┐
│  LEFT COLUMN (fixed, never scrolls)            │  RIGHT COLUMN (tabbed)            │
│  ┌──────────────────────────────────────────┐ │  ┌──────────────────────────────┐ │
│  │ HeaderBar  Session P/L · Bank · [New …]   │ │  │ TabStrip (pinned)            │ │
│  ├──────────────────────────────────────────┤ │  ├──────────────────────────────┤ │
│  │ PokerTable (seats, pot, board,            │ │  │ TabBody (overflow-y:auto —   │ │
│  │   acting glow, showdown layer)            │ │  │   THE ONLY scroll region)    │ │
│  ├──────────────────────────────────────────┤ │  │  Feedback|Coaching|Hands|    │ │
│  │ ActionBar (pinned bottom)                 │ │  │  Rankings|PreflopChart       │ │
│  └──────────────────────────────────────────┘ │  └──────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────┘
        │ reads                         │ reads/writes                  │ reads
        ▼                               ▼                               ▼
   gameStore (hand) ──uses──> core/* (PURE: engine, handFlow,    sessionStore (settings + displayUnit, tab)
   bankrollStore ──persist──> /api/bankroll ──> lib/dataStore ──> data/bankroll.json
                              core/bankroll.ts (pure reducer)     core/money.ts (pure formatter)
   PreflopChart tab ──reads──> core/charts/preflopEquity.json (precomputed) + preflop.ts + equityClient (fallback)
```

**Rules honored:** `core/*` stays pure (no React/DOM). All FS IO in `app/api/*` via `lib/dataStore` atomic writes. Components presentational; analysis math unchanged.

### 6.2 Data flow — bankroll write→read {#data-flow-bankroll}

- **Write entry point:** end of hand in `gameStore` → `bankrollStore.applyHandResult(outcome)` → `core/bankroll.ts` reducer → `PUT /api/bankroll` → `lib/dataStore.saveBankroll()` → `data/bankroll.json` (atomic temp+rename).
- **Read entry point:** app load → `bankrollStore.load()` → `GET /api/bankroll` → `lib/dataStore.loadBankroll()` (missing/corrupt → fresh default). Verified links: `saveBankroll`/`loadBankroll` are NEW in `lib/dataStore.ts` (mirror existing `saveHandRecord`/`atomicWrite`); route is NEW `app/api/bankroll/route.ts`.

---

## 7. Functional Requirements {#functional-requirements}

### 7.1 W1 — Layout shell {#fr-w1}
| ID | Requirement |
|----|-------------|
| FR-01 | `app/page.tsx` renders a 2-column CSS grid `grid-template-columns: 1fr <panel>` filling `100vh`; the LEFT column is `display:flex; flex-direction:column` and never scrolls. |
| FR-02 | LEFT column = HeaderBar (fixed height) + PokerTable (`flex:1; min-height:0`) + ActionBar (fixed height, pinned bottom). |
| FR-03 | RIGHT column = TabStrip (fixed height) + TabBody; **only TabBody** has `overflow-y:auto` and `min-height:0`. No other element scrolls during play. |
| FR-04 | Tabs: Feedback (default in-hand), Coaching, Hands, Rankings, Preflop Chart. Active tab state lives in `sessionStore.activeTab`. |
| FR-05 | Setup screen reflows to fit one fold at ≥1280×800 (no vertical page scroll). |
| FR-06 | At viewport ≥1280×800, `document.documentElement.scrollHeight <= window.innerHeight` on both setup and in-hand. Below that, scroll is allowed. |
| FR-07 | Existing Feedback/Coaching/Hands content moves into tabs with no behavior change (FeedbackPanel, CoachingViewer, HandRecap list). |

### 7.2 W2 — Acting-player + showdown marking {#fr-w2}
| ID | Requirement |
|----|-------------|
| FR-10 | The seat whose turn it is to act (`TableSeatView.isActing` / `TableView.toAct`) renders a pulsing "thinking" glow, synced to the existing PokerTable reveal cursor. |
| FR-11 | `handCategoryLabel(cards: Card[]): string` (pure, `core/eval/`) returns a plain label e.g. "Two Pair, Aces & Kings" from the best 5-card hand. |
| FR-12 | `winningCards(hole: Card[], board: Card[]): Card[]` (pure, `core/eval/`) returns the exact 5 cards forming the best hand, for highlight. |
| FR-13 | At hand end (`TableView.handOver`): winning seat(s) glow; the 5 winning cards (board + revealed hole) highlight yellow; a hand-category banner shows center-table near the pot (CenterStack area). |
| FR-14 | Each seat shows a per-hand net chip (+$ green / −$ red) for the just-finished hand, derived from `TableView.winners` + committed (no persistence). |
| FR-15 | Fold-out hands (no showdown): mark winner + pot awarded + per-seat net; NO category banner / card highlight (no cards shown). |
| FR-16 | Split pots: multiple winner glows; each winner's share in its net chip. |

### 7.3 W3 — Persistent bankroll {#fr-w3}
| ID | Requirement |
|----|-------------|
| FR-20 | `data/bankroll.json` persists `{ schemaVersion, bank, startingStack, seats: [{seatId, stack}], sessionPnl, updatedAt }`. |
| FR-21 | `GET /api/bankroll` returns the bankroll (or a fresh default if missing/corrupt). `PUT /api/bankroll` atomically writes it. |
| FR-22 | Hero + bot stacks carry hand-to-hand (seeded from bankroll, not reset to $200 each hand). |
| FR-23 | Lifetime `bank` persists to disk and survives app restart; it moves with results. |
| FR-24 | Bots auto-rebuy to the starting stack when short, keeping the table 6-max (D11). |
| FR-25 | Hero bust (stack < required blind) → rebuy modal: top-up from bank to starting stack, with an "auto-rebuy" toggle persisted in bankroll. |
| FR-26 | "New table" resets every seat's stack to the chosen starting stack and resets `sessionPnl` to 0; the lifetime `bank` carries forward (NOT reset). |
| FR-27 | Starting-stack presets: 50 / 100 / 200 BB, default 100 (chosen at setup / New table). |
| FR-28 | Header shows Session P/L (green ▲ / red ▼) and lifetime Bank, formatted via `core/money.ts`. |
| FR-29 | Bank empty on bust → offer "New table (fresh starting bank)" or an out-of-chips end state; never a dead table. |
| FR-30 | Corrupt/missing/old `bankroll.json` → fall back to a fresh default; never crash the app. |
| FR-31 | `core/bankroll.ts` exposes a PURE reducer for transitions: `applyHandResult`, `rebuy`, `newTable`, `defaultBankroll` — no IO. |

### 7.4 W4 — Rankings tab {#fr-w4}
| ID | Requirement |
|----|-------------|
| FR-40 | Rankings tab lists all 9 `HandCategory` values, strongest first (Straight Flush → High Card), each with a plain one-line example. |
| FR-41 | The ranking data derives from the `HandCategory` enum (single source), not a hand-maintained duplicate list. |

### 7.5 W5 — Preflop chart teach {#fr-w5}
| ID | Requirement |
|----|-------------|
| FR-50 | Preflop Chart tab renders the 13×13 / 169-hand grid (pairs diagonal, suited upper-right, offsuit lower-left) from `allHands169()`. |
| FR-51 | Each cell is colored by `chartAction()` → solid raise / call / fold (folds grayed); NO mixed-frequency split cells (D6). |
| FR-52 | Each grid cell is a real keyboard-reachable `<button>` with an aria-label (e.g. "AKs, raise"); fold-cell text contrast ≥4.5:1 (reviewer carry-forward). |
| FR-53 | A position selector defaults to the hero's current position for the live hand and lets the learner browse any of the 6 positions (D14). |
| FR-54 | Clicking a hand shows a detail card: equity ("AK wins ~67 out of 100 vs a random hand") + plain definitions of *baseline*, *equity*, *position* + the "vs a random hand overstates it" caveat. |
| FR-55 | Equity is read from a precomputed table `core/charts/preflopEquity.json` (key: canonical hand → equity vs 1 random hand); a generator script `scripts/genPreflopEquity.ts` produces it from `core/equity`. |
| FR-56 | If a key is missing from the precomputed table, fall back to an on-demand `equityResultSync` compute (or show "—" with a note) — never block the tab; NO runtime LLM. |

### 7.6 W6 — Plain-language coaching {#fr-w6}
| ID | Requirement |
|----|-------------|
| FR-60 | `core/analysis/explain.ts` verdict strings are reworded to lead with the plain idea, then optionally the term; no verdict leads with unexplained jargon (banned: "you don't have the price to continue" verbatim). |
| FR-61 | Verdict copy defines any term inline (e.g. "equity = your share of the pot"). The verdict math/branch logic in `analyze.ts` is unchanged. |
| FR-62 | When the hero folds, coaching narrates the eventual winner's line: who won, with what (via `handCategoryLabel`), and what was sound about it — sourced from `OutcomeRecord` (winners + `shown` cards) + existing analysis; no new judgments invented. |
| FR-63 | Winner's-perspective narration honors `gtoClaim` — only preflop spots may claim a "baseline". |
| FR-64 | If `OutcomeRecord.shown` lacks the winner's cards (winner not at showdown / mucked), narrate at the pot/line level without inventing a hand — gracefully degrade. |

### 7.7 Cross-cutting — money formatter / BB toggle {#fr-money}
| ID | Requirement |
|----|-------------|
| FR-70 | `core/money.ts` exposes `formatMoney(dollars: number, unit: "usd"\|"bb", bigBlind: number): string` (pure). `usd`→"$20"; `bb`→"10 BB". |
| FR-71 | `sessionStore.displayUnit` (`"usd"` default) holds the unit; clicking the hero's own stack toggles it (PokerStars convention). |
| FR-72 | All money displays (seat stacks, bets, pot, action-bar amounts, header P/L + bank, feedback math sentences) format through `formatMoney`. Engine/analysis stay in integer dollars internally — BB is render-only. |

---

## 8. Non-Functional Requirements {#non-functional-requirements}

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Layout | Zero vertical page scroll at ≥1280×800 (setup + in-hand); graceful scroll below. |
| NFR-02 | Purity | No React/DOM imports in `core/*`; new helpers (`money`, `bankroll`, `handCategoryLabel`, `winningCards`) are pure + unit-tested. |
| NFR-03 | Determinism | No runtime LLM/Anthropic SDK; preflop equity is precomputed/cached; analysis remains the single source of every verdict. |
| NFR-04 | Resilience | Corrupt/missing `bankroll.json` never crashes; falls back to default. |
| NFR-05 | Accessibility | Preflop grid cells + selectable setup chips are keyboard-reachable `<button>`s with aria-labels; focus-visible styling present; money color cues paired with sign/glyph (not color-only). |
| NFR-06 | Compatibility | HandRecord stays schema v1; existing tests stay green; older hand records still render. |
| NFR-07 | Performance | Preflop teach detail opens instantly (precomputed lookup, no MC on the hot path). |

---

## 9. API Contracts {#api-contracts}

### 9.1 GET /api/bankroll {#api-get-bankroll}
```
GET /api/bankroll
```
**Response (200):**
```json
{
  "schemaVersion": "number",
  "bank": "number — lifetime roll in dollars",
  "startingStack": "number — current buy-in depth in dollars",
  "autoRebuy": "boolean",
  "seats": [{ "seatId": "number", "stack": "number" }],
  "sessionPnl": "number — dollars, +/-",
  "updatedAt": "string — ISO8601"
}
```
On missing/corrupt file → returns a freshly-constructed default (200, never 500).

### 9.2 PUT /api/bankroll {#api-put-bankroll}
```
PUT /api/bankroll
```
**Request:** the bankroll object (same shape as the GET response).
**Response (200):** `{ "ok": true }`
**Error responses:** `400` `{ "error": "invalid bankroll payload" }` on schema validation failure (do not write); `500` `{ "error": "write failed" }` only on FS error after validation.

---

## 10. Data Design {#data-design}

This app uses JSON files, not SQL. The new persisted artifact:

### 10.1 `data/bankroll.json` {#bankroll-file}
```jsonc
{
  "schemaVersion": 1,        // BANKROLL_SCHEMA_VERSION, independent of HandRecord
  "bank": 1760,
  "startingStack": 200,
  "autoRebuy": true,
  "seats": [ { "seatId": 0, "stack": 200 }, /* … */ ],
  "sessionPnl": 120,
  "updatedAt": "2026-05-31T09:00:00.000Z"
}
```

### 10.2 Migration / compatibility {#migration}
- **HandRecord is UNTOUCHED** (stays `HANDRECORD_SCHEMA_VERSION = 1`). Per-player results remain in `OutcomeRecord.winners[]` + `heroNet`. No hand-record migration (D13).
- `bankroll.json` is new; absent file = fresh default. A future bump validates `schemaVersion` and upgrades or resets to default on mismatch (never crash, FR-30).

### 10.3 `core/charts/preflopEquity.json` (generated) {#preflop-equity-file}
```jsonc
{ "version": 1, "vs": "random", "iters": 100000, "equity": { "AA": 85.2, "AKs": 67.0, "72o": 35.4, /* … 169 keys */ } }
```
Produced by `scripts/genPreflopEquity.ts` (committed output). Read-only at runtime.

---

## 11. Frontend Design {#frontend-design}

### 11.1 Component Hierarchy {#component-hierarchy}
```
app/page.tsx
├─ HeaderBar (NEW)            session P/L + bank + [New table][New hand]; money via formatMoney
├─ LeftColumn (NEW wrapper)
│  ├─ PokerTable (MODIFIED)   acting glow (FR-10), showdown layer (FR-13..16)
│  │  ├─ Seat (MODIFIED)      acting glow, winner glow, per-seat net chip, $⇄BB on hero stack
│  │  ├─ CenterStack (MODIFIED) hand-category banner
│  │  ├─ Board / Card (MODIFIED) yellow winning-card highlight
│  └─ ActionBar (MODIFIED)    amounts via formatMoney
└─ RightPanel (NEW)
   ├─ TabStrip (NEW)
   └─ TabBody (NEW, only scroll region)
      ├─ FeedbackPanel (REUSED; copy via W6/explain.ts)
      ├─ CoachingViewer (REUSED; winner narration via coach skill)
      ├─ HandsTab (REUSED HandRecap list)
      ├─ RankingsTab (NEW)        FR-40/41
      ├─ PreflopChartTab (NEW)    FR-50..56
      └─ RebuyModal (NEW)         FR-25/29 (overlay)
```

### 11.2 State Management {#state-management}
- `sessionStore`: settings + `displayUnit` (FR-71) + `activeTab` (FR-04) — ephemeral.
- `gameStore`: drives the hand (unchanged shape) + calls `bankrollStore` at hand end.
- `bankrollStore` (NEW): holds bankroll, `load()`/`save()` via `/api/bankroll`, delegates transitions to `core/bankroll.ts`.

### 11.3 UI Specifications {#ui-specifications}
- **No-scroll contract:** see FR-01..06; the CSS lives in `app/page.tsx` / `globals.css`. Left column `height:100vh`, children flex; `PokerTable` gets the flex remainder with `min-height:0`; `TabBody` is the sole `overflow-y:auto`.
- **Acting glow:** gold pulsing ring on the acting seat; respects `prefers-reduced-motion` (no animation).
- **Showdown:** winner-seat green glow; winning 5 cards `outline` yellow; category banner center-table; per-seat net chip green/red with sign.
- **Preflop grid:** 13×13 `<button>` grid; raise=red, call=green, fold=gray (≥4.5:1 text); detail card below; position `<select>`.
- **Money:** all amounts via `formatMoney`; hero stack is a button toggling `displayUnit` with aria-label "Toggle dollars / big blinds".

---

## 12. Edge Cases {#edge-cases}

| # | Scenario | Condition | Expected Behavior |
|---|----------|-----------|-------------------|
| E1 | Bank empty on bust | hero busts, bank can't fund rebuy | offer New table / out-of-chips end state; no dead table (FR-29) |
| E2 | Corrupt bankroll file | malformed/missing/old `bankroll.json` | fresh default; no crash (FR-30) |
| E3 | Missing precomputed equity | key absent in `preflopEquity.json` | on-demand compute fallback or "—" note; tab still works (FR-56) |
| E4 | Fold-out (no showdown) | hand ends pre-showdown | winner + net marked; no banner/card highlight (FR-15) |
| E5 | Split pot | tie at showdown | multiple winner glows; per-seat shares (FR-16) |
| E6 | Narrow viewport | <1280×800 | no-scroll waived; graceful scroll OK (NFR-01) |
| E7 | Winner mucked / not shown | `OutcomeRecord.shown` lacks winner cards | narrate at line level, no invented hand (FR-64) |
| E8 | BB toggle precision | odd cents in BB | format to ≤1 decimal; engine math stays in dollars (FR-70/72) |

---

## 13. Configuration & Feature Flags {#configuration}

| Variable | Default | Purpose |
|----------|---------|---------|
| (none new) | — | No env flags; this is a local single-user app. Starting-stack presets + auto-rebuy live in bankroll state, not env. |

---

## 14. Testing & Verification Strategy {#testing-verification}

### 14.1 Unit Tests {#unit-tests}
- `core/money.test.ts` — `formatMoney` for usd/bb, rounding, big-blind divisor.
- `core/bankroll.test.ts` — reducer: carry-over, bust→rebuy, auto-rebuy, New table (resets stacks+pnl, keeps bank), default.
- `core/eval/handEval.test.ts` (extend) — `handCategoryLabel` for each category incl. "Two Pair, Aces & Kings"; `winningCards` returns exact best 5 (incl. wheel, flush).
- `core/charts/preflop*.test.ts` (extend) — precomputed lookup returns a number for all 169 keys; fallback path; grid color mapping.
- `core/analysis/explain.test.ts` (extend) — no banned jargon substring; terms defined inline; winner-narration builder from a fixture `OutcomeRecord`.

### 14.2 Integration Tests {#integration-tests}
- `app/api/bankroll` route: PUT then GET round-trips; invalid payload → 400, no write; corrupt file → GET returns default.
- `bankrollStore` ↔ route wiring (mocked fetch): load on mount, save at hand end.

### 14.3 End-to-End / Component Tests {#e2e-tests}
- Playwright @1280×800: setup + in-hand assert `scrollHeight <= innerHeight`; assert only TabBody scrolls; tab switching keeps table fixed.
- Component (RTL): acting glow on `isActing`; showdown layer (glow + yellow cards + banner + nets); rebuy modal; preflop grid cells are `<button>` with aria-labels.

### 14.4 Verification Commands {#verification-commands}
```sh
npm run typecheck        # tsc --noEmit — core stays pure
npm test                 # vitest: all new + existing green
npm run lint
npm run dev              # manual: Playwright no-scroll @1280x800, play a hand to showdown, bust→rebuy, browse tabs
```

---

## 15. Rollout Strategy {#rollout-strategy}

- **Wave-by-wave merge** (W1→W6), each independently green. No feature flags (local app); each wave is shippable.
- **Order rationale:** W1 (shell) hosts everything; W2 (presentational, no schema) ships next; W3 (bankroll/persistence) builds on W2's per-hand net; W4/W5 (tabs) need only W1; W6 (copy) is independent.
- **Rollback:** git revert per wave; `bankroll.json` is additive (deleting it = fresh default), no destructive migration.
- **Graceful degradation:** missing bankroll/precomputed-equity → defaults/fallbacks (FR-30/56).

---

## 16. Modules {#modules}

<section id="modules">

| Module | Owner | Purpose |
|--------|-------|---------|
| `core/money.ts` | core | Pure money formatter (usd/bb), render-only unit conversion |
| `core/bankroll.ts` | core | Pure bankroll reducer (carry/bust/rebuy/new-table/default) |
| `core/eval/handEval.ts` | core | (extend) `handCategoryLabel`, `winningCards` |
| `core/charts/preflopEquity.json` | core | Precomputed preflop equity table (generated) |
| `scripts/genPreflopEquity.ts` | scripts | Generator for the precomputed equity table |
| `lib/dataStore.ts` | lib | (extend) `saveBankroll`/`loadBankroll` atomic FS IO |
| `app/api/bankroll/route.ts` | app/api | GET/PUT bankroll route |
| `store/bankrollStore.ts` | store | Bankroll Zustand store (load/save/transitions) |
| `app/page.tsx` | app | (reshape) no-scroll 2-col shell + tabs |
| `components/RightPanel`, `TabStrip`, `RankingsTab`, `PreflopChartTab`, `RebuyModal`, `HeaderBar` | components | New presentational UI |
| `components/table/*` | components | (extend) acting glow, showdown layer, net chips, BB toggle |
| `.claude/skills/poker-coach/` | skill | (extend) winner's-perspective narration + plain copy alignment |

</section>

---

## 17. Architectural Assertions {#architectural-assertions}

<section id="architectural-assertions">

- `core/money.ts`, `core/bankroll.ts`, and `core/eval/handEval.ts` MUST NOT import React, DOM, or any `app/`/`components/`/`store/` module (core purity, §6.1).
- `core/*` MUST NOT perform filesystem IO; all bankroll persistence MUST go through `lib/dataStore` invoked by `app/api/bankroll` (§6.2).
- The preflop teach view MUST NOT call the Anthropic SDK or any network LLM at runtime; equity MUST come from the precomputed table or the local Monte Carlo fallback (NFR-03).
- `components/*` MUST format every money value through `core/money.ts` and MUST NOT re-implement $/BB conversion inline (FR-72).
- The decision verdict math in `core/analysis/analyze.ts` MUST be unchanged by W6; only `explain.ts` copy strings change (FR-61).
- `HandRecord` schema version MUST remain 1; bankroll state MUST live only in `data/bankroll.json` (D13).
- The play shell MUST keep the LEFT column non-scrolling; only the active TabBody may set `overflow-y:auto` (FR-03).

</section>

---

## 18. Research Sources {#research-sources}

| Source | Type | Key Takeaway |
|--------|------|-------------|
| `core/handFlow.ts` (`TableView`, `TableSeatView`) | Existing code | `winners`, `isActing`, `reveal` already exposed → W2 is presentational (S1) |
| `core/eval/handEval.ts` (`HandCategory`, `rank7`) | Existing code | category enum + 7-card scorer → label/best-5 helpers (S2) |
| `lib/dataStore.ts` (`atomicWrite`, `saveHandRecord`) | Existing code | atomic temp+rename pattern to mirror for bankroll (S3/S4) |
| `core/charts/preflop.ts` (`allHands169`, `chartAction`, `canonicalHand`) | Existing code | grid + color source for W5 |
| `core/equity/equity.ts` / `equityClient.ts` | Existing code | Monte Carlo for the precompute generator + fallback (S5) |
| `core/analysis/explain.ts` | Existing code | verdict strings to reword (W6) |
| `01_requirements.md` + grill report | Pipeline | D1–D18, OQ resolutions, in-domain UX framings |
| wireframes/ (01_setup, 02_play-screen) | Pipeline | verified no-scroll layout + teach UX |

---

## Silent roles considered {#silent-roles}
- **DBA** — no SQL DB; the only new persistence (`bankroll.json`) is specified in §10; covered by Architect.
- **DevOps** — local single-user app, no deploy/flags/monitoring; rollout is git-per-wave (§15).
- **Senior Analyst** — FR coverage maps 1:1 to G1–G8 + D1–D18; validated in §7.

## Review Log {#review-log}
| Loop | Findings | Changes Made |
|------|----------|-------------|
| 1 | Initial draft from decision-complete requirements + grill + verified wireframes + code interfaces. | Authored §1–§18; added spec decisions S1–S8 (notably S1: reuse existing TableView fields → W2 needs no engine change; S5: committed precomputed equity JSON). |
