---
tier: 3
type: feature
feature: poker-coach-mvp
date: 2026-05-29
status: Ready for Plan
requirements: docs/pmos/features/2026-05-29_poker-coach-mvp/01_requirements.md
---

# Poker Coach (v1 MVP) — Spec

## 1. Problem Statement

A past-beginner, non-math poker player wants to improve at 6-max No-Limit Hold'em cash by
*playing* against the computer and getting reasoned, plain-language feedback on each decision plus
their recurring leaks. This spec defines an **all-TypeScript local Next.js app** that runs the game,
computes decision analysis deterministically (fast, always-correct math), and saves structured hand
histories, plus a **Claude Code `/poker-coach` skill** that reads those histories and produces deep
narrative coaching. **No Anthropic SDK / API key is embedded** — the app and the coach communicate
through the filesystem. Primary success metric: the player can play a full hand and immediately
understand, in plain language, whether each decision was good and why.

## 2. Goals

| # | Goal | Success Metric |
|---|---|---|
| G1 | Play full 6-max NLHE cash hands vs 1–5 bots in the browser | A hand resolves end-to-end with correct betting, blinds, and side pots (automated tests pass) |
| G2 | Instant, plain-language per-decision feedback (toggleable) | Every hero decision yields `{verdict, reason}` rendered with a visual; no raw-only numbers |
| G3 | Deterministic analysis is correct and fast | Equity within ±2% of high-iteration reference; analysis returns < 250 ms perceived (Worker) |
| G4 | Deep coaching via `/poker-coach` over a hand/batch/session | Skill reads hand JSON + analysis, emits per-decision critique + leak summary as markdown |
| G5 | Tunable opponents (style × skill, per seat) | Behavior visibly differs across personas in tests/spot-checks |
| G6 | Coaching depth dial changes both surfaces | Conceptual/Equity/Strict alter what feedback shows |
| G7 | App↔coach coordinate without re-coaching | Coach reviews only un-reviewed hands via a processed marker |

## 3. Non-Goals

- **No live mid-hand LLM coaching** — coaching is end-of-hand/batch in the terminal (req non-goal).
- **No postflop GTO solver** — postflop feedback is heuristic in v1; solver library is Phase 3.
- **No tournaments/ICM, other formats/variants** — 6-max cash only.
- **No accounts/cloud/multi-user; no saved-hand replay UI; no progress analytics** — local single-user MVP.
- **No embedded AI SDK / API key** — hard constraint; coaching is a Claude Code skill over files.
- **No persistence DB** — flat JSON files under `data/` are the store.

## 4. Decision Log

| # | Decision | Options Considered | Rationale |
|---|---|---|---|
| D1 | All-TypeScript Next.js (App Router) local app | (a) TS-only, (b) TS + Python backend | One language, no server infra; equity is fine in a Worker (req D1, D8) |
| D2 | Two feedback layers: deterministic in-app + narrative coach | (a) one only, (b) both | Math instant/correct; judgement/leaks narrative (req D2/D3) |
| D3 | App computes all math; coach only explains | — | LLMs unreliable at arithmetic (req D3) |
| D4 | Coaching depth: one 3-level dial | — | Simple for a non-math user (req D4) |
| D5 | GTO real preflop only; postflop heuristic | — | Live solve too slow (req D5) |
| D6 | Opponents: style × skill, per seat; skill = fixed 3 | — | Varied instructive opposition (req D6, resolved Q1) |
| D7 | Plain-language + visual mandatory | — | Non-math user (req D7) |
| D8 | Equity vs typical population range; never peek bot cards for feedback | (a) bot range, (b) population, (c) both | Transferable poker, honest (grill G1) |
| D9 | App↔coach via sessions + processed marker | (a) user range, (b) mtime, (c) sessions+marker | Robust "coach latest" (grill G2) |
| D10 | Equity in a Web Worker, lean Monte Carlo (~2k iters); bots mostly heuristic | (a) main thread, (b) worker, (c) precompute | Responsive table (grill G3) |
| D11 | Self-generated baseline preflop charts (our JSON) | (a) embed published, (b) free set, (c) own | Avoid ToS issues; honest baseline (grill G4) |
| D12 | State: React state + a small Zustand store for game/session; no server state | (a) Redux, (b) Zustand, (c) context only | Lightweight, local, testable |
| D13 | Coach trigger: terminal only; output rendered in app via file-watch | (a) in-app button, (b) terminal only | User chose terminal-only + in-app render (resolved Q2, Q4) |
| D14 | Game engine: wrap `poker-ts`; eval: `poker-evaluator-ts` | build vs adopt | Mature MIT libs; don't reinvent rules/eval |
| D15 | Pure-function core (engine-adapter, equity, analysis, bots, charts) decoupled from React | — | Testable without DOM; reused by app + (potentially) coach fixtures |

**Silent roles considered:** DBA — no database; the file schema (§9) is the data contract. DevOps —
local-only `next dev`; no deploy/flags beyond §13. Senior Analyst — FR coverage validated against
requirements G1–G7 in §7.

## 5. Personas & Journeys

**Persona:** solo learner, knows rules, not a math person, time-constrained, plays on own machine.

Primary journey (play → instant feedback → save → coach in terminal → render in app) and alternates
(heads-up, quiet-batch, conceptual-only, strict-study) are defined in `01_requirements.md §User
Journeys`. Key technical flow:

```
Setup screen → start session → engine deals hand
   loop: engine asks next actor
     - bot actor  → bot engine decides (heuristic + occasional equity) → apply action
     - hero actor → UI enables legal actions → hero acts
                    → analysis engine (Worker) computes decision analysis
                    → if feedbackEnabled: render verdict+reason inline
   hand ends → write data/hands/<sessionId>/hand-<n>.json  (append decisions+analysis+outcome)
Player (terminal): /poker-coach [last|last N|session]
   → reads unreviewed hand JSON (+ data/coaching/processed.json)
   → writes data/coaching/<sessionId>/<handId>.md and a session summary
   → updates processed marker
App coaching viewer watches data/coaching/ → renders latest markdown
```

## 6. System Design

### 6.1 Architecture Overview

```
┌──────────────────────────── Next.js app (browser, local) ───────────────────────────┐
│  UI (React components)                                                                │
│   SetupScreen · PokerTable · ActionBar · FeedbackPanel · CoachingViewer · EmptyState  │
│        │  uses                                                                         │
│   store/ (Zustand): gameStore (table state), sessionStore (settings, sessionId)       │
│        │  calls                                                                        │
│   core/ (pure TS, no React)                                                            │
│     engine/        gameEngine  (wraps poker-ts; deal, legal actions, apply, sidepots) │
│     eval/          handEval    (wraps poker-evaluator-ts)                              │
│     equity/        equityClient → postMessage →  [ equity.worker.ts ] (Monte Carlo)   │
│     bots/          botEngine   (persona = style×skill → action)                       │
│     charts/        preflopCharts (our baseline JSON + lookup)                          │
│     analysis/      analyzeDecision (equity+potOdds+EV+chart+heuristics → DecisionAnalysis) │
│     history/       handRecorder (build + write HandRecord JSON)                        │
│        │  writes/reads                                                                 │
└──────────────────────────────────┬────────────────────────────────────────────────┘
                                    │  filesystem (data/)
        data/hands/<sessionId>/hand-<n>.json     data/coaching/<sessionId>/<handId>.md
        data/coaching/processed.json             data/sessions/<sessionId>.json
                                    │
┌───────────────────────── Claude Code skill: /poker-coach ───────────────────────────┐
│  reads hand JSON (schema §9.1) + processed marker → narrative critique + leak summary │
│  writes markdown coaching + updates processed marker                                   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

App↔filesystem write path: Next.js Route Handlers under `app/api/` (`POST /api/hands`,
`POST /api/sessions`, `GET /api/coaching?sessionId=`) do the Node `fs` writes/reads; the browser
calls them. (The browser can't write files directly; the local Next server can.)

### 6.2 Key sequences

**Hero decision analysis:**
```
ActionBar.onAct(action) → gameStore.applyHeroAction
  → equityClient.request({hole, board, numOpponents, assumedRange})  ──postMessage──▶ equity.worker
                                                                      ◀──result(equity)──
  → analyzeDecision({state, action, equity}) → DecisionAnalysis
  → gameStore.recordDecision(analysis); if feedbackEnabled → FeedbackPanel renders
```
**End of hand:** `gameStore.onHandComplete → POST /api/hands (HandRecord)` → file written.

## 7. Functional Requirements

### 7.1 Game engine
| ID | Requirement |
|----|-------------|
| FR-01 | Support 2–6 seats (hero + 1–5 bots); blinds 1/2; configurable starting stacks (default 100bb). |
| FR-02 | Correct NLHE flow: preflop/flop/turn/river, blinds/dealer rotation per hand, legal-action enumeration. |
| FR-03 | Correct pot + multiple side pots on all-ins of differing sizes; correct showdown awarding. |
| FR-04 | Expose, each time it's the hero's turn, the legal action set with min/max raise bounds. |
| FR-05 | Deterministic given a seeded RNG (for tests); production uses crypto RNG. |

### 7.2 Bots
| ID | Requirement |
|----|-------------|
| FR-10 | Persona = `{style ∈ TAG|LAG|Nit|Station, skill ∈ Beginner|Intermediate|Advanced}`, set per seat. |
| FR-11 | Preflop: act from a style-derived range (subset/superset of baseline charts); skill scales discipline. |
| FR-12 | Postflop: heuristic on hand strength (via eval/equity), board texture, position, pot odds, with style-tuned c-bet/bluff/fold-to-aggression frequencies. |
| FR-13 | Bots must only emit legal actions; sizing within bounds. |
| FR-14 | Skill level injects controlled mistakes at lower levels (e.g., Beginner over-calls, mis-sizes). |
| FR-15 | Whole-table presets fill all seats (All TAG / Mixed / Loose & wild / Tough regs). |

### 7.3 Equity & analysis
| ID | Requirement |
|----|-------------|
| FR-20 | Monte Carlo equity for hero hand vs an **assumed population range** (not bot cards), in a Web Worker. |
| FR-21 | Default ~2,000 iterations (configurable); deterministic with a seed in tests. |
| FR-22 | Compute pot odds, EV(fold)=0, EV(call), EV(raise estimate) from equity + pot/bet. |
| FR-23 | Preflop: look up baseline chart action for hero's spot; compute deviation. |
| FR-24 | Postflop: heuristic assessment (made-hand class, draw equity, range/board advantage) — labeled heuristic. |
| FR-25 | Produce `DecisionAnalysis` (§9.2): `{verdict, severity, conceptTags[], plainExplanation, numbers, assumedRange, gtoClaim}`. |
| FR-26 | `verdict ∈ good|thin|mistake` derived from EV gap vs best legal option and chart deviation. |
| FR-27 | Plain-language: every number paired with a sentence; equity/pot-odds rendered as a bar + words. |

### 7.4 History & sessions
| ID | Requirement |
|----|-------------|
| FR-30 | A session starts on "Deal first hand"; `sessionId` = `YYYYMMDD-HHMMSS-<rand>`; settings snapshot saved to `data/sessions/<sessionId>.json`. |
| FR-31 | Each completed hand written to `data/hands/<sessionId>/hand-<n>.json` conforming to HandRecord (§9.1). |
| FR-32 | Hand record includes every hero decision with its `DecisionAnalysis` and the final outcome (winners, amounts, shown cards if any). |
| FR-33 | A processed marker `data/coaching/processed.json` records reviewed hand ids. |

### 7.5 Coaching (the /poker-coach skill)
| ID | Requirement |
|----|-------------|
| FR-40 | `/poker-coach [last | last N | session [id]]` selects hands; default = unreviewed hands of the latest session. |
| FR-41 | Reads HandRecord JSON; treats the embedded `DecisionAnalysis` as ground truth (does not recompute math). |
| FR-42 | Produces per-decision plain-language critique honoring the session's coaching depth. |
| FR-43 | Produces a recurring-leak summary by aggregating `conceptTags` + severities across the selected hands. |
| FR-44 | Writes `data/coaching/<sessionId>/<handId>.md` and `data/coaching/<sessionId>/session-summary.md`; updates processed marker. |
| FR-45 | Honesty: never claims GTO where `gtoClaim=false`; restates the assumed range when discussing equity. |

### 7.6 UI
| ID | Requirement |
|----|-------------|
| FR-50 | Setup screen: opponent count (1–5), per-seat style+skill, presets, coaching depth, feedback on/off. |
| FR-51 | Table: seats with name/style/skill/stack/state, board, pot, hero cards, dealer/blind markers. |
| FR-52 | Action bar: legal actions only; raise slider with min/max + ½/¾/pot quick buttons. |
| FR-53 | Feedback panel: verdict badge, one-line reason, equity bar with "needed" marker, plain-math line, assumed-range note; hidden when feedback off. |
| FR-54 | Coaching viewer: renders markdown from `data/coaching/`; report + empty states. |
| FR-55 | Selection controls use semantic `radiogroup`/`role=tab` with `aria-selected`/`aria-pressed` (a11y carry-forward). |

## 8. Non-Functional Requirements
| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Hero-decision analysis perceived < 250 ms; equity off the UI thread (Worker). |
| NFR-02 | Performance | A full hand vs 5 bots completes without visible UI freeze. |
| NFR-03 | Correctness | Side-pot and showdown math verified by tests with known fixtures. |
| NFR-04 | Accessibility | Keyboard-operable controls; focus-visible; text contrast ≥ 4.5:1; aria labels on icon-only buttons. |
| NFR-05 | Honesty | No GTO claim postflop/multiway; assumptions surfaced in feedback. |
| NFR-06 | Portability | Runs via `npm run dev`; no external services, no API keys. |
| NFR-07 | Testability | `core/` is pure functions; ≥ unit coverage on engine/equity/analysis/charts/bots. |

## 9. Data Contracts (the app↔coach interface)

> No database. JSON files under `data/` are the contract. All records carry `schemaVersion`.

### 9.1 HandRecord (`data/hands/<sessionId>/hand-<n>.json`)
```jsonc
{
  "schemaVersion": 1,
  "handId": "20260529-141233-ab12_h7",   // sessionId + _h<handNumber>
  "sessionId": "20260529-141233-ab12",
  "handNumber": 7,
  "playedAt": "2026-05-29T14:14:02.001Z",
  "config": { "numPlayers": 6, "smallBlind": 1, "bigBlind": 2, "startingStackBb": 100 },
  "heroSeat": 0,
  "seats": [
    { "seat": 0, "name": "You", "isHero": true, "startingStack": 200,
      "position": "BB", "persona": null },
    { "seat": 3, "name": "Mia", "isHero": false, "startingStack": 200,
      "position": "BTN", "persona": { "style": "TAG", "skill": "Advanced" } }
    // ...
  ],
  "heroHole": ["Ac", "Jh"],
  "board": ["As", "7h", "2c", "Kd", "9c"],     // up to 5; only dealt streets
  "actions": [                                   // full action log, all players
    { "street": "preflop", "seat": 3, "action": "raise", "amount": 6 },
    { "street": "preflop", "seat": 0, "action": "call",  "amount": 4 }
    // ...
  ],
  "heroDecisions": [                             // one per hero action, with analysis
    {
      "decisionId": "h7-d1",
      "street": "preflop",
      "spot": { "potBefore": 9, "toCall": 4, "position": "BB",
                "stackBb": 48, "numActiveOpponents": 1, "facing": "raise" },
      "heroAction": { "action": "call", "amount": 4 },
      "analysis": { /* DecisionAnalysis — §9.2 */ }
    }
  ],
  "outcome": {
    "winners": [ { "seat": 0, "amount": 23 } ],
    "heroNet": 23,
    "shown": [ { "seat": 3, "cards": ["Ks","Qs"] } ],   // only cards revealed at showdown
    "endedAtShowdown": true
  }
}
```

### 9.2 DecisionAnalysis (embedded; ground truth for the coach)
```jsonc
{
  "schemaVersion": 1,
  "verdict": "good",                 // good | thin | mistake
  "severity": 0,                     // 0 good, 1 thin, 2 minor mistake, 3 clear mistake
  "conceptTags": ["call_correct_price"],  // controlled vocabulary — §9.4
  "coachingDepth": "equity",         // conceptual | equity | strict
  "gtoClaim": false,                 // true only for preflop/strict chart-based feedback
  "assumedRange": "typical BTN open (~45% of hands)",
  "numbers": {
    "equityPct": 46.0,               // hero win% vs assumed range (null if not computed)
    "potOddsPct": 27.0,              // breakeven % needed to call
    "ev": { "fold": 0, "call": 2.6, "raise": 1.1 },  // in bb or $, see unit
    "unit": "usd"
  },
  "plainExplanation": "It costs you $4 to win a $15 pot — you only need to win about 27% of the time. A♣J♥ wins ~46% against a typical button raiser. Easy call.",
  "chart": { "applies": true, "chartAction": "call", "heroDeviates": false }  // preflop only
}
```

### 9.3 Processed marker (`data/coaching/processed.json`)
```jsonc
{ "schemaVersion": 1, "reviewed": { "20260529-141233-ab12_h7": "2026-05-29T14:20:00Z" } }
```

### 9.4 conceptTags vocabulary (initial)
`call_correct_price`, `call_too_wide`, `fold_too_tight`, `value_bet_missed`, `thin_value_good`,
`bluff_no_equity`, `overfold_vs_aggression`, `wrong_sizing`, `preflop_chart_deviation`,
`good_preflop_discipline`, `position_misplay`, `slowplay_costly`. (Extensible; coach + analysis
share this list via `core/analysis/conceptTags.ts`.)

### 9.5 Web Worker equity protocol
```ts
// request (main → worker)
{ id: string, type: "equity",
  hero: [Card, Card], board: Card[], numOpponents: number,
  assumedRange: RangeSpec, iterations: number, seed?: number }
// response (worker → main)
{ id: string, equityPct: number, iterations: number, ms: number }
```
`RangeSpec` = a named baseline range or weighted combo list from `core/charts`.

### 9.6 /poker-coach skill contract
- **Location:** `.claude/skills/poker-coach/SKILL.md` in the repo (project skill).
- **Invocation:** `/poker-coach`, `/poker-coach last`, `/poker-coach last 10`, `/poker-coach session [id]`.
- **Reads:** `data/sessions/`, `data/hands/<sessionId>/*.json`, `data/coaching/processed.json`.
- **Writes:** `data/coaching/<sessionId>/<handId>.md`, `.../session-summary.md`, updates `processed.json`.
- **Behavior:** uses embedded `DecisionAnalysis` as ground truth; produces plain-language critique at
  the session's `coachingDepth`; aggregates `conceptTags` for the leak summary; obeys `gtoClaim`.

## 10. Persistence

No DB. Directory layout (gitignored except samples):
```
data/
  sessions/<sessionId>.json          # settings snapshot
  hands/<sessionId>/hand-<n>.json    # HandRecord per hand
  coaching/processed.json            # reviewed marker
  coaching/<sessionId>/<handId>.md   # per-hand coaching
  coaching/<sessionId>/session-summary.md
```
Writes via Next Route Handlers (Node `fs`, atomic temp-then-rename). `data/` is in `.gitignore`; a
`data/.gitkeep` and a `samples/` fixture set are committed for tests.

## 11. Frontend Design

### 11.1 Component hierarchy
```
app/
  page.tsx                     # routes between Setup / Play / Coaching (client state)
  layout.tsx
components/
  SetupScreen.tsx
  table/ PokerTable.tsx · Seat.tsx · Board.tsx · Card.tsx · PotDisplay.tsx
  ActionBar.tsx
  FeedbackPanel.tsx  (VerdictBadge · EquityBar · PlainMathLine)
  CoachingViewer.tsx (MarkdownRender · EmptyState)
store/ gameStore.ts · sessionStore.ts
core/  (engine, eval, equity, bots, charts, analysis, history)  # see §6.1
workers/ equity.worker.ts
app/api/ hands/route.ts · sessions/route.ts · coaching/route.ts
```
### 11.2 State
- `sessionStore`: settings (numOpponents, per-seat personas, coachingDepth, feedbackEnabled), sessionId.
- `gameStore`: current hand state (derived from engine), hero legal actions, decision log, history-write status.
- Coaching viewer fetches `GET /api/coaching?sessionId=` (poll/refresh button; file-watch optional).
- Theme tokens from wireframes `DESIGN.md` ported to `app/globals.css`.

### 11.3 UI specs — match wireframes
`wireframes/01_table` (table + feedback states), `02_settings`, `03_coaching` (report/empty) are the
visual reference. Verdict colors and equity-bar/"needed"-marker per `DESIGN.md` tokens. Selection
controls semantic per FR-55.

## 12. Edge Cases
| # | Scenario | Condition | Expected |
|---|---|---|---|
| E1 | Multiway all-in, unequal stacks | 3+ all-in | Correct side pots; each awarded at showdown (FR-03) |
| E2 | Hero all-in for less | stack < toCall | Call caps at stack; side pot formed |
| E3 | No hands to coach | no unreviewed hands | Coach reports nothing to review; viewer shows empty state |
| E4 | Feedback off | toggle off | No inline verdict; hand still saved with analysis |
| E5 | Conceptual depth | depth=conceptual | Feedback/coaching avoid raw numbers; plain strategy only |
| E6 | Multiway postflop | 3+ to flop | Heuristic feedback, `gtoClaim=false`, labeled |
| E7 | Equity worker slow/fails | timeout | Fall back to a fast heuristic estimate; mark `equityPct` approximate |
| E8 | Abandoned/incomplete hand | app closed mid-hand | Not written; coach only sees completed hands |
| E9 | Hand folds preflop to hero BB | everyone folds | Hand resolves; minimal/no hero decision; recorded |

## 13. Configuration
| Variable | Default | Purpose |
|----------|---------|---------|
| `EQUITY_ITERATIONS` | 2000 | Monte Carlo samples per equity call |
| `DATA_DIR` | `./data` | Root for hand/session/coaching files |
| `DEFAULT_STARTING_STACK_BB` | 100 | Starting stack |
| (settings, per session) | — | numOpponents, personas, coachingDepth, feedbackEnabled |

## 14. Testing & Verification Strategy

### 14.1 Unit (Vitest)
- `engine`: deal/rotation/legal actions; **side-pot fixtures** (E1, E2) with asserted awards (FR-03).
- `eval`: known 7-card rankings; tie-breaking.
- `equity`: seeded Monte Carlo within ±2% of a high-iteration reference on known matchups (FR-20/21).
- `analysis`: pot odds, EV ordering, verdict thresholds, chart deviation, conceptTags (FR-22–26).
- `charts`: baseline lookups by position/action.
- `bots`: range adherence per style; only-legal-actions; skill-level mistake injection (FR-10–14).
- `history`: HandRecord serialization conforms to schema (§9.1) — JSON-schema validation test.

### 14.2 Integration
- Play a scripted hand through engine→analysis→history; assert written file matches schema and
  contains a `DecisionAnalysis` per hero decision (FR-31/32).
- `/api/hands` and `/api/coaching` route handlers read/write correct paths.
- `/poker-coach` skill against committed `samples/` fixtures: produces per-hand md + leak summary,
  updates processed marker, never recomputes math, honors `gtoClaim` (FR-40–45).

### 14.3 End-to-end (manual + Playwright optional)
- Setup → deal → act → see verdict → finish hand → file appears → run `/poker-coach` → viewer renders.

### 14.4 Verification commands
```
npm run test            # vitest unit + integration green
npm run typecheck       # tsc --noEmit clean
npm run lint            # eslint clean
npm run dev             # app boots; play a hand; data/hands/<session>/ file written
# then in Claude Code:  /poker-coach last   → data/coaching/<session>/ md written
```

### 14.5 Verification plan sketch (Phase 4)
| Requirement | Verification |
|---|---|
| FR-03 side pots | Unit fixtures with unequal all-ins; assert award amounts |
| FR-20/21 equity | Seeded MC vs reference; assert within ±2% |
| FR-25/26 analysis | Table-driven verdict tests on crafted spots |
| FR-31/32 history | Schema-validate written HandRecord; assert decision+analysis present |
| FR-40–45 coach | Run skill on fixtures; assert md output + processed marker + no recompute |
| NFR-01 perf | Time analysis path; assert Worker used, < 250ms perceived |

## 15. Rollout Strategy
Single local app; no flags/migrations. Build order is `core/` (engine→eval→equity→charts→analysis→
bots→history) → API routes → UI → `/poker-coach` skill. Each `core/` module ships test-first. GTO
"Strict" tier ships preflop-only; postflop solver is a documented Phase 3 follow-up (no code path
claims it now).

## 16. Modules
<section id="modules">

| Module | Owner (path) | Purpose |
|--------|--------------|---------|
| engine | `core/engine` | Wrap poker-ts; authoritative game state, legal actions, side pots |
| eval | `core/eval` | 7-card hand evaluation via poker-evaluator-ts |
| equity | `core/equity` + `workers/equity.worker.ts` | Monte Carlo equity vs assumed range, off-thread |
| charts | `core/charts` | Self-generated baseline preflop ranges + lookup |
| analysis | `core/analysis` | Deterministic DecisionAnalysis from spot+equity+chart |
| bots | `core/bots` | Persona (style×skill) decision policy |
| history | `core/history` | Build/serialize HandRecord; processed marker helpers |
| api | `app/api/*` | Node fs read/write route handlers |
| ui | `components/*`, `store/*` | Table, action bar, feedback panel, coaching viewer |
| coach-skill | `.claude/skills/poker-coach` | Claude Code narrative coaching over hand JSON |

</section>

## 17. Architectural Assertions
<section id="architectural-assertions">

- `core/*` MUST NOT import React, Next, or any DOM/browser global (pure, testable in node).
- `core/analysis` MUST be the single source of `verdict`/`conceptTags`; UI and coach MUST NOT recompute them.
- The coach skill MUST treat embedded `DecisionAnalysis` as read-only ground truth and MUST NOT recompute equity/EV.
- Equity computation MUST run in `workers/equity.worker.ts` off the main thread (no synchronous MC on the UI thread).
- Feedback generation MUST NOT read opponents' hole cards; it MUST use the assumed population range (D8).
- Any postflop/multiway feedback MUST set `gtoClaim=false`.
- The app MUST NOT import `@anthropic-ai/sdk` or reference an API key (coaching is the Claude Code skill).

</section>

## 18. Research Sources
| Source | Type | Takeaway |
|--------|------|----------|
| `poker-ts` (MIT) | lib | Game state, betting, side pots |
| `poker-evaluator-ts` | lib | Fast 7-card eval |
| eval7 / PokerKit | lib | Python alternatives (not used in v1) |
| TexasSolver / postflop-solver (AGPL) | tool | Phase-3 offline only |
| GTO Wizard docs | industry | "Instant" GTO = precomputed; no public API |
| PokerBench / LLM-poker papers | research | Compute math in code; LLM explains |
| RLCard / OpenSpiel | research | RL bots heavy; rule+range personas pragmatic |

---

**Review Log**

| Loop | Findings | Changes |
|------|----------|---------|
| 1 | Self-review (structural + design critique): all req G1–G7 mapped to FRs; data contracts complete (§9 schema with request/response/error-ish fallback E7); no DB (file contract instead, noted); sequence + architecture diagrams present (ASCII); edge cases concrete; verification commands exact; modules + assertions present. No open questions. | None needed; ready for user confirmation. |
