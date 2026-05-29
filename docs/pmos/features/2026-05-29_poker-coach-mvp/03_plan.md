---
tier: 3
type: feature
feature: poker-coach-mvp
spec_ref: 02_spec.md
requirements_ref: 01_requirements.md
date: 2026-05-29
status: Draft
commit_cadence: per-task
contract_version: 1
execution_mode: inline
---

# Poker Coach (v1 MVP) — Implementation Plan

## Overview

Build an all-TypeScript local Next.js app that plays 6-max NLHE cash vs tunable bots, gives instant
plain-language decision feedback, and saves versioned hand histories that a Claude Code `/poker-coach`
skill reads to produce narrative coaching. Built as vertical slices: a tracer bullet proves
engine→analysis→save→render end-to-end first, then we widen core math, bots, UI, and the coach skill.

**Done when:** a user can run `npm run dev`, play a full 6-max hand against bots, see a plain-language
verdict on each of their decisions, the hand is written to `data/hands/<session>/`, and running
`/poker-coach last` writes a plain-language critique to `data/coaching/` that the app renders; all
Vitest suites pass (target ≥ 60 tests, 0 fail), `tsc --noEmit` clean, `eslint` clean.

**Done-when walkthrough:** `npm run test` → green. `npm run dev` → open localhost, set 5 opponents +
Equity depth, deal a hand; on a hero call the FeedbackPanel shows "✅ Good call … ~46% vs ~27% needed";
finish the hand → `data/hands/<session>/hand-1.json` exists with a `heroDecisions[].analysis`. In
Claude Code run `/poker-coach last` → `data/coaching/<session>/<handId>.md` exists with a verdict per
decision + a leak summary; the app's Coaching viewer renders it.

**Execution order:**
```
Phase 1 Scaffold + tracer bullet:  T1 → T2 → T3 → T4
Phase 2 Core math & opponents:     T5 → T6 → T7 → T8 → T9 → T10 → T11
Phase 3 API + state + UI:          T12 → T13 → T14 → T15 → T16 → T17
Phase 4 Coach skill + e2e:         T18 → T19 → T20 (TN)
```

## Decision Log

| # | Decision | Options Considered | Rationale |
|---|---|---|---|
| P1 | Vitest for tests | (a) Jest, (b) Vitest | First-class TS/ESM, fast, Next-friendly |
| P2 | Card type = string `"As"`,`"Th"`,`"2c"` (rank+suit) | (a) object {rank,suit}, (b) string | Compact, matches eval libs, easy JSON |
| P3 | Wrap poker-ts behind `core/engine` adapter, never import it in UI | direct vs adapter | Keeps core swappable + testable; honors §17 assertion |
| P4 | Equity worker uses our own MC over poker-evaluator-ts (not a lib's race fn) | lib race vs own MC | Control over assumed-range sampling + seeding |
| P5 | Baseline preflop charts hand-authored as compact JSON keyed by position | generate-offline vs author | Small, transparent, no ToS issues (spec D11) |
| P6 | Bots call equity only on close postflop spots; else pure heuristic | always-equity vs selective | Perf (NFR-01/02); equity is the expensive path |
| P7 | `/poker-coach` is a project skill at `.claude/skills/poker-coach/SKILL.md` | global vs project | Lives with the repo + its data dir |
| P8 | Implement own hand-evaluator + own engine (drop poker-ts / poker-evaluator-ts) | wrap libs vs own | Keeps `core/` pure + dependency-light, avoids the large HandRanks.dat binary + lib-integration risk; still satisfies §17 (core is the engine boundary, no React/DOM). Execution-time decision, supersedes spec D14/plan P3. |

## Code Study Notes
> Glossary inherited from 02_spec.md.
### Patterns to follow
- None observed (greenfield). Establish: `core/` pure modules, `*.test.ts` colocated, named exports.
### Existing code to reuse
- None (greenfield). External: `poker-ts`, `poker-evaluator-ts`.
### Constraints discovered
- Browser cannot write files → file IO via Next Route Handlers (Node fs). Equity must be off-thread.
- §17 assertions: `core/*` no React/DOM; analysis sole verdict source; no `@anthropic-ai/sdk`.
### Stack signals
- Greenfield JS/TS. Reference system: standard Next.js (App Router) + npm. `package-lock.json` → npm.

## Prerequisites
- Node ≥ 20, npm. No services. `data/` writable.

## File Map (index; tasks are source of truth)
| Action | File | Responsibility | Task |
|--------|------|----------------|------|
| Create | `package.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc` | scaffold | T1 |
| Create | `core/cards.ts` (+test) | Card type, deck, RNG | T2 |
| Create | `core/eval/handEval.ts` (+test) | 7-card eval wrapper | T2 |
| Create | `core/engine/gameEngine.ts` (+test) | wrap poker-ts: deal, legal, apply, sidepots | T5 |
| Create | `core/equity/equity.ts`, `workers/equity.worker.ts` (+test) | Monte Carlo equity | T6 |
| Create | `core/charts/preflop.ts` + `preflopCharts.json` (+test) | baseline ranges + lookup | T7 |
| Create | `core/analysis/conceptTags.ts`, `analyze.ts` (+test) | DecisionAnalysis | T3,T8 |
| Create | `core/bots/botEngine.ts`, `personas.ts` (+test) | style×skill policy | T9,T10 |
| Create | `core/history/handRecord.ts` (+test) | build/serialize HandRecord; processed marker | T4,T11 |
| Create | `app/api/{hands,sessions,coaching}/route.ts` | fs read/write | T12 |
| Create | `store/{gameStore,sessionStore}.ts` | client state | T13 |
| Create | `components/SetupScreen.tsx` | setup | T14 |
| Create | `components/table/*`, `components/ActionBar.tsx` | table + actions | T15 |
| Create | `components/FeedbackPanel.tsx` | verdict/equity/plain-math | T16 |
| Create | `components/CoachingViewer.tsx` | render coaching md | T17 |
| Create | `.claude/skills/poker-coach/SKILL.md` | coach skill | T18 |
| Create | `samples/` fixtures, integration tests | e2e | T19,T20 |

## Risks
| # | Risk | L | I | Sev | Mitigation | in |
|---|------|---|---|-----|------------|----|
| R1 | poker-ts API mismatch with our model | M | M | Med | Adapter layer + engine tests first (tracer) | T5 |
| R2 | Equity too slow in-browser | M | M | Med | Worker + ~2k iters; bots selective equity | T6,T9 |
| R3 | Verdict thresholds feel wrong | M | L | Low | Table-driven analysis tests; tune thresholds | T8 |
| R4 | app↔coach schema drift | L | H | Med | schemaVersion + JSON-schema validation test | T11,T19 |

## Tasks

## Phase 1: Scaffold + tracer bullet (engine→analysis→save→render for one decision)

### T1: Project scaffold
**Goal:** Next.js + TS + Vitest + ESLint boot; test runner green on a smoke test.
**Spec refs:** §6.1, §11.1, NFR-06 · **Depends on:** none · **Idempotent:** yes · **TDD:** yes — new-feature · **Slice shape:** config — scaffolding has no end-to-end behavior.
**Files:** Create `package.json`, `tsconfig.json` (paths `@/` → root), `vitest.config.ts`, `.eslintrc.cjs`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx` (stub), `.gitignore` (add `data/` except `.gitkeep`), `data/.gitkeep`, `core/smoke.test.ts`.
**Steps:** create configs; add deps (`next react react-dom typescript vitest @vitejs/plugin-react eslint poker-ts poker-evaluator-ts zustand`); write `core/smoke.test.ts` asserting `1+1===2`.
**Inline verification:** `npm install` ok; `npm run test` → 1 passed; `npm run typecheck` clean; `npm run dev` boots.

### T2: Cards + hand evaluation
**Goal:** Card model, deck, seeded RNG, and a 7-card evaluator wrapper.
**Spec refs:** FR-05 (seeded RNG), §6.1 eval · **Depends on:** T1 · **TDD:** yes — new-feature.
**Files:** Create `core/cards.ts` (`type Card="As"|...`; `makeDeck()`, `shuffle(deck, rng)`, `mulberry32(seed)`), `core/eval/handEval.ts` (`rank7(cards: Card[]): number` via poker-evaluator-ts; lower=better or document direction), `+ .test.ts`.
**Steps (TDD):** test: a known straight flush beats a pair (assert ordering); test: shuffle is deterministic for a seed. Implement. 
**Inline verification:** `npm run test core/` — eval + cards green.

### T3: Analysis stub + verdict shape (the contract)
**Goal:** Define `DecisionAnalysis` (§9.2) + `conceptTags` vocab; a minimal `analyze()` returning a verdict from pot odds vs a passed-in equity (hardcoded equity ok for tracer).
**Spec refs:** §9.2, §9.4, FR-22, FR-25, FR-26 · **Depends on:** T2 · **TDD:** yes — new-feature.
**Files:** Create `core/analysis/conceptTags.ts` (exported union + array), `core/analysis/analyze.ts` (`analyze(input): DecisionAnalysis`), `+ .test.ts`.
**Steps (TDD):** test: calling getting 3:1 with 46% equity → `verdict:"good"`, tag `call_correct_price`, `plainExplanation` contains "$" and "%"; test: calling 18% equity needing 27% → `verdict:"mistake"`, `call_too_wide`. Implement thresholds (verdict from EV gap vs best option). 
**Inline verification:** table-driven analysis tests green; `plainExplanation` always pairs number+sentence.

### T4: HandRecord serialize + tracer save
**Goal:** Build a HandRecord (§9.1) from a scripted heads-up hand with one hero decision + its analysis, and serialize to JSON validated against schema.
**Spec refs:** §9.1, FR-31, FR-32 · **Depends on:** T3 · **TDD:** yes — new-feature.
**Files:** Create `core/history/handRecord.ts` (`buildHandRecord(...)`, `HANDRECORD_SCHEMA_VERSION=1`), `core/history/handRecord.schema.json`, `+ .test.ts`.
**Steps (TDD):** test: a built record has `schemaVersion`, `heroDecisions[0].analysis.verdict`, `outcome.heroNet`; validate against the JSON schema (use a tiny validator or assert required keys). Implement.
**Inline verification:** record round-trips JSON; schema test green. **Phase 1 demoable:** a node script builds+prints a HandRecord with a real verdict.

## Phase 2: Core math & opponents

### T5: Game engine adapter (deal, legal actions, betting, side pots)
**Goal:** `core/engine` wraps poker-ts to run a full NLHE hand for 2–6 seats with correct side pots.
**Spec refs:** FR-01..FR-04, FR-03 side pots, NFR-03 · **Depends on:** T2 · **TDD:** yes — new-feature.
**Files:** Create `core/engine/gameEngine.ts` (`createHand(config, seats, rng)`, `legalActions()`, `apply(action)`, `isHandOver()`, `result()`), `+ .test.ts` incl. `core/engine/sidepots.test.ts`.
**Steps (TDD):** test: heads-up blinds posted, legal actions correct; **side-pot fixture**: 3 players all-in for 10/50/100 → assert pot split + awards (E1, E2); test: betting rounds advance preflop→river. Implement via poker-ts.
**Inline verification:** engine + sidepot suites green.

### T6: Equity (Monte Carlo) + Web Worker
**Goal:** `equity(hero, board, numOpp, assumedRange, iters, seed)` and an off-thread worker wrapper.
**Spec refs:** FR-20, FR-21, §9.5, NFR-01 · **Depends on:** T2 · **TDD:** yes — new-feature.
**Files:** Create `core/equity/equity.ts` (pure MC using handEval), `workers/equity.worker.ts` (postMessage protocol §9.5), `core/equity/equityClient.ts` (promise wrapper; falls back to sync MC if no Worker — E7), `+ .test.ts`.
**Steps (TDD):** test: AA vs random ~85% (±2%) at seed; test: seeded equity reproducible; test: client returns `{equityPct}`. Implement.
**Inline verification:** equity within ±2% of reference on 2 known matchups.

### T7: Baseline preflop charts
**Goal:** Author compact 6-max baseline ranges + lookup by position/action.
**Spec refs:** FR-23, D11, FR-45 gtoClaim · **Depends on:** T2 · **TDD:** yes — new-feature.
**Files:** Create `core/charts/preflopCharts.json` (open/3bet/defend by position), `core/charts/preflop.ts` (`chartAction(hand, position, facing)`), `+ .test.ts`.
**Steps (TDD):** test: AKs is an open from CO; 72o is a fold UTG; BB defends correct price. Implement lookup (hand→169-grid key).
**Inline verification:** chart lookups green.

### T8: Full analysis engine (equity + EV + chart + heuristics)
**Goal:** Upgrade `analyze()` to compute pot odds, EV(fold/call/raise), preflop chart deviation, postflop heuristic class, conceptTags, depth-aware `plainExplanation`, `gtoClaim`, `assumedRange`.
**Spec refs:** FR-22..FR-27, NFR-05, §9.2 · **Depends on:** T6,T7 · **TDD:** yes — new-feature.
**Files:** Modify `core/analysis/analyze.ts`; add `core/analysis/heuristics.ts`, `core/analysis/explain.ts`; tests.
**Steps (TDD):** tests for: EV ordering picks best option; preflop deviation flagged + `gtoClaim:true`; multiway postflop `gtoClaim:false`; conceptual depth omits raw numbers; value_bet_missed detection. Implement.
**Inline verification:** ≥10 table-driven analysis cases green.

### T9: Bot engine — heuristic core
**Goal:** `decide(spot, persona, rng): Action` using hand strength + position + pot odds + style frequencies; selective equity on close spots.
**Spec refs:** FR-11..FR-13, P6 · **Depends on:** T5,T6,T7 · **TDD:** yes — new-feature.
**Files:** Create `core/bots/botEngine.ts`, `+ .test.ts`.
**Steps (TDD):** test: only-legal actions always; test: a strong hand value-bets; test: facing a bet with no equity → fold (non-station). Implement.
**Inline verification:** bot decision tests green; fuzz 500 hands → 0 illegal actions.

### T10: Personas (style × skill) + presets
**Goal:** Map `{style, skill}` to parameter bundles; whole-table presets.
**Spec refs:** FR-10, FR-14, FR-15 · **Depends on:** T9 · **TDD:** yes — new-feature.
**Files:** Create `core/bots/personas.ts`, `+ .test.ts`.
**Steps (TDD):** test: Nit opens tighter than LAG (range size); test: Beginner injects more loose-calls than Advanced; test: presets fill N seats. Implement.
**Inline verification:** persona differentiation asserted numerically.

### T11: HandRecord from a real played hand + processed marker
**Goal:** Drive engine+bots+analysis to play a full hand and emit a complete HandRecord; processed-marker helpers.
**Spec refs:** FR-30..FR-33, §9.1, §9.3, R4 · **Depends on:** T5,T8,T10,T4 · **TDD:** yes — new-feature.
**Files:** Modify `core/history/handRecord.ts`; add `core/history/processed.ts`; add `core/playHand.ts` (orchestrates one hand, hero action supplied via callback); tests.
**Steps (TDD):** integration test: play a seeded full hand → record validates against schema, has a decision+analysis per hero action, correct `outcome`. Implement.
**Inline verification:** full-hand record schema-valid; processed marker add/has works.

## Phase 3: API + state + UI

### T12: API route handlers (fs IO)
**Goal:** `POST /api/sessions`, `POST /api/hands`, `GET /api/coaching?sessionId=` reading/writing `data/`.
**Spec refs:** §6.1, §10, FR-31, FR-54 · **Depends on:** T11 · **TDD:** yes — new-feature.
**Files:** Create `app/api/sessions/route.ts`, `app/api/hands/route.ts`, `app/api/coaching/route.ts`, `lib/dataPaths.ts`, `+ route tests` (call handler fns directly).
**Steps (TDD):** test: POST hand writes `data/hands/<sid>/hand-<n>.json` (atomic temp-rename); GET coaching lists md files. Implement with Node fs.
**Inline verification:** route tests write/read a temp DATA_DIR.

### T13: Client stores
**Goal:** `sessionStore` (settings, sessionId) + `gameStore` (hand state, legal actions, decision log, save status) via Zustand; engine driven client-side, equity via worker, persistence via fetch.
**Spec refs:** §11.2, FR-30 · **Depends on:** T11,T12,T6 · **TDD:** yes — new-feature.
**Files:** Create `store/sessionStore.ts`, `store/gameStore.ts`, `+ .test.ts`.
**Steps (TDD):** test: starting a session sets sessionId + posts settings; applying hero action records a decision with analysis; hand-over triggers save. Implement (mock fetch + worker).
**Inline verification:** store tests green.

### T14: Setup screen
**Goal:** Setup UI per wireframe 02 (opponent count 1–5, per-seat style+skill, presets, depth, feedback toggle) → starts a session.
**Spec refs:** FR-50, FR-55 · **Wireframe refs:** `wireframes/02_settings_desktop-web.html` · **Depends on:** T13 · **TDD:** yes — new-feature · **Slice shape:** vertical.
**Files:** Create `components/SetupScreen.tsx`, `+ .test.tsx` (React Testing Library).
**Steps (TDD):** test: selecting 3 opponents + preset populates seats; depth radios use `role=radiogroup` + `aria-checked`; "Deal" calls store start. Implement; port DESIGN.md tokens to `app/globals.css`.
**Inline verification:** component test green; a11y roles present.

### T15: Poker table + action bar
**Goal:** Render table per wireframe 01 (seats, board, pot, hero cards, dealer/blind markers) and a legal-actions-only action bar with sizing slider.
**Spec refs:** FR-51, FR-52, FR-04 · **Wireframe refs:** `wireframes/01_table_desktop-web.html` · **Depends on:** T13,T14 · **TDD:** yes — new-feature · **Slice shape:** vertical.
**Files:** Create `components/table/{PokerTable,Seat,Board,Card,PotDisplay}.tsx`, `components/ActionBar.tsx`, tests.
**Steps (TDD):** test: only legal actions render; raise slider clamps to min/max; folded seat dims. Implement.
**Inline verification:** table/action tests green; bots auto-act so a hand can be played to completion in a test harness.

### T16: Feedback panel
**Goal:** Render verdict badge + reason + equity bar (with "needed" marker) + plain-math line + assumed-range note from `DecisionAnalysis`; hidden when feedback off; depth-aware.
**Spec refs:** FR-53, FR-27, D7, NFR-04 · **Wireframe refs:** `wireframes/01_table_desktop-web.html` · **Depends on:** T15 · **TDD:** yes — new-feature · **Slice shape:** vertical.
**Files:** Create `components/FeedbackPanel.tsx` (+`VerdictBadge`,`EquityBar`,`PlainMathLine`), tests.
**Steps (TDD):** test: a "good" analysis shows ✅ + equity fill width = equityPct + plain sentence; feedback-off renders nothing; conceptual depth hides raw %. Implement.
**Inline verification:** panel tests green; contrast tokens from DESIGN.md.

### T17: Coaching viewer
**Goal:** Render markdown from `GET /api/coaching` per wireframe 03 (report + empty states); refresh button.
**Spec refs:** FR-54, E3 · **Wireframe refs:** `wireframes/03_coaching_desktop-web.html` · **Depends on:** T12 · **TDD:** yes — new-feature · **Slice shape:** vertical.
**Files:** Create `components/CoachingViewer.tsx` (+ markdown render, EmptyState), tests.
**Steps (TDD):** test: with coaching md → renders headings/leaks; with none → empty state + how-to. Implement.
**Inline verification:** viewer tests green.

## Phase 4: Coach skill + integration/e2e

### T18: /poker-coach skill
**Goal:** Author `.claude/skills/poker-coach/SKILL.md` implementing the §9.6 contract.
**Spec refs:** FR-40..FR-45, §9.6, §17 (no recompute, honor gtoClaim) · **Depends on:** T11 · **TDD:** no — authoring (prose skill; verified via T19 fixtures) · **Slice shape:** config — skill prose, validated by T19.
**Files:** Create `.claude/skills/poker-coach/SKILL.md`.
**Steps:** write skill: arg parsing (`last`/`last N`/`session [id]`/default unreviewed); read sessions+hands+processed; per-decision plain-language critique at the hand's `coachingDepth`, using embedded analysis as ground truth (no recompute); aggregate `conceptTags` → leak summary; write per-hand md + session-summary; update processed marker; honesty rules.
**Inline verification:** skill reviewed against §9.6 checklist; behavior asserted in T19.

### T19: Coach fixtures + skill verification
**Goal:** Commit `samples/` HandRecord fixtures; a test/checklist that the skill produces expected outputs.
**Spec refs:** FR-40..FR-45, R4 · **Depends on:** T18 · **TDD:** yes — new-feature.
**Files:** Create `samples/session-demo/*.json`, `samples/expected-coaching/*.md` (golden-ish), `core/history/schema.test.ts` validating fixtures against the schema.
**Steps (TDD):** test: fixtures validate against HandRecord schema; documented manual run of `/poker-coach session demo` → produces per-hand md + leak summary; assert it never writes equity numbers absent from analysis (no recompute) and respects `gtoClaim:false`.
**Inline verification:** fixture schema test green; manual coach run documented.

### T20 (TN): Final verification
**Goal:** Whole app works end-to-end.
- [ ] **Lint & format:** `npm run lint` → 0 errors
- [ ] **Type check:** `npm run typecheck` → clean
- [ ] **Unit + integration:** `npm run test` → all pass (≥60), 0 fail
- [ ] **Boot + play:** `npm run dev`; play a full 6-max hand; verify instant feedback shows a verdict + plain sentence + equity bar
- [ ] **Persistence:** confirm `data/hands/<session>/hand-1.json` written with `heroDecisions[].analysis`
- [ ] **Coach loop:** in Claude Code run `/poker-coach last` → `data/coaching/<session>/<handId>.md` written; app Coaching viewer renders it
- [ ] **a11y spot:** keyboard-operate setup radios; focus-visible outline; verdict colors contrast OK
- [ ] **Honesty:** multiway postflop feedback shows no GTO claim
- [ ] **Architectural assertions (§17):** grep `core/` for `react`/`next`/`document` imports → none; grep repo for `@anthropic-ai/sdk` → none
- [ ] **Done-when walkthrough:** trace the Done-when clauses through the running app
**Cleanup:** remove any scratch/debug logging; update CLAUDE.md with run instructions.

---

## Review Log
| Loop | Findings | Changes Made |
|------|----------|--------------|
| 1 | Self-review (structural + design): every spec FR/§ mapped to a task (engine FR-01..04→T5; equity FR-20/21→T6; analysis FR-22..27→T3/T8; bots FR-10..15→T9/T10; history FR-30..33→T4/T11; API→T12; UI FR-50..55→T14..T17; coach FR-40..45→T18/T19; §17 assertions→T20). T1 config-only (declared), T18 config-only (declared). Tracer bullet T1–T4 is end-to-end (build+print a real HandRecord). Vertical slices in Phase 3. Verifications behavioral (equity ±2%, side-pot awards, verdict tables, schema validation). | None needed; ready for user confirmation. |
