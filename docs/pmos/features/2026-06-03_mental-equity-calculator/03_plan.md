# Mental Math (Outs & Equity Walk-Through) — Execution Plan

**Date:** 2026-06-03
**Tier:** 2 — Enhancement
**Spec:** `02_spec.md`
**execution_mode:** inline

TDD throughout: write the test (red) → implement (green) → refactor. Each task lists files + inline
verification. Pure-core waves (1–3) are fully unit-testable and carry most of the risk, so they go
first. UI waves (4–5) follow. Commit per task.

## Wave 1 — Core types + out counting

**T1. Module types.** Create `core/mental/types.ts` with all interfaces from spec §2.1 (`DrawKind`,
`DrawGroup`, `OutsBreakdown`, `TaintFlags`, `EstimateStatus`, `MentalEstimate`, `MentalInput`).
- Verify: `npm run typecheck` clean (file imports `Card`, `Street` only).

**T2. Out counting (TDD).** `core/mental/outs.test.ts` first, then `core/mental/outs.ts` →
`countOuts(hole, board): OutsBreakdown`.
- Tests (FR-04..07, made-hand guard): Q♥J♥/10♥9♣2♥ → 15 (9+8−2); flush-only (4-to-flush) → 9;
  OESD → 8; gutshot → 4; two overcards (A K on low rainbow board) → 6 soft; flush+gutshot ≈ 12 union;
  overlap card (K♥) counted once; 3-to-a-flush backdoor → not counted; made straight → `none`/no-draw.
- Helper: reuse `core/cards.ts` (`rankOf/suitOf/rankValue/makeDeck`) and the existing evaluator
  (`rank7`) for the made-hand guard. Add a small internal `straightCompleters(rankValues)` helper.
- Verify: `npm test core/mental/outs` green.

## Wave 2 — Hit math

**T3. Rule of 2&4 + exact hit (TDD).** `core/mental/hit.test.ts` → `core/mental/hit.ts`:
`ruleOf2And4(outs, street)`, `exactHitPct(outs, unseen, cardsToCome)`, `bigDrawCaveat(outs, street)`.
- Tests (FR-08, FR-09): `ruleOf2And4(8,"turn")===16`; `ruleOf2And4(15,"flop")===min(100,60)`;
  `exactHitPct(9,47,2)` ≈ 35.0 (±0.2); `exactHitPct(9,46,1)` ≈ 19.6; `exactHitPct(15,47,2)` ≈ 54.1;
  `bigDrawCaveat(15,"flop")===true`, `(9,"flop")===false`, `(15,"turn")===false`.
- Implement `comb(n,k)` locally (BigInt-safe or number for small n) for the hypergeometric.
- Verify: `npm test core/mental/hit` green.

## Wave 3 — Estimate orchestration

**T4. Taint detection (TDD).** Extend `estimate.test.ts` (or `taint.test.ts`) → `detectTaint(hole,board)`
in `core/mental/estimate.ts`.
- Tests (FR-13): two-tone board sets `twoTone` + note; paired board sets `paired`; 3-connected sets
  `connected`; hero Q-high flush draw on two-tone → `heroFlushNotNut`; low-end straight draw →
  `heroLowEndStraight`; dry K-7-2 rainbow → all false, empty notes.

**T5. buildMentalEstimate (TDD).** `core/mental/estimate.test.ts` → `buildMentalEstimate(input)`.
- Tests (FR-03,10,11,12,14,15): status routing (no-hand when hole null / board<3; preflop; river at 5
  cards; no-draw when 0 outs on flop); pot-odds (call 20 into 60 → breakEven 25%); `toCall===0` →
  free-card copy + decision; opponent shade ranges (1 opp = no shave; 2 opp = ×0.8..0.9; 3 opp lower);
  decision profitable (48% vs 25%) / marginal (within ±3%) / steep; override substitution
  (outsOverride=6 changes ruleHitPct, leaves groups visible); the guide's Q♥J♥ flop→turn worked example
  end-to-end (flop ~57% est, exact ≈54%; turn blank ×2 ≈30%).
- Verify: `npm test core/mental` all green; `npm run typecheck` clean.

**T6. Core barrel + architecture guard.** `core/mental/index.ts` re-exports the public API. Confirm no
React/DOM imports anywhere in `core/mental/` (FR-22).
- Verify: `grep -rE "react|next/|from \"@/components" core/mental` returns nothing.

## Wave 4 — Session state

**T7. sessionStore flag (TDD).** Add `mentalMathOpen: boolean` (default `false`) + `setMentalMathOpen`
to `store/sessionStore.ts` (ephemeral UI state alongside `activeTab`/`displayUnit`).
- Test: extend `sessionStore` test (or add one) — default false, setter toggles. Verify FR-18 default.
- Verify: `npm test sessionStore` (or store tests) green.

## Wave 5 — Component + integration

**T8. MentalMathSection render (TDD).** `components/MentalMathSection.test.tsx` →
`components/MentalMathSection.tsx`.
- Tests (FR-01,03,16,17): renders collapsed-by-default header; expands to Steps 1–6 for an `ok` hand;
  renders Step 1 groups + soft tag; renders each note state (preflop/river/no-hand/no-draw); uses
  `FeedbackPanel` token classes (equity bar present in Step 5). Mock `gameStore` selectors with a fake
  `flow` exposing `isHeroTurn/heroSpot/heroHole/board/street/potNow/tableView`.
- Build inputs per spec §3.1; render steps per `wireframes.html`. Match existing inline-style/token
  conventions from `FeedbackPanel.tsx`.

**T9. True-equity comparison + loading (TDD).** Same component; add the async `requestEquity` call +
"Check your work".
- Tests (FR-19,20,21): mock `requestEquity` → pending shows "calculating true equity…"; resolved shows
  headline (hit vs true win), closeness badge (hit vs exactHit), hit→win gap line; "Show the dollar EV"
  reveals EV using true equity + display unit. Ensure mental steps render before the promise resolves.
- Use the same `EQUITY_ITERATIONS`/seed pattern as `gameStore.heroAct`; reuse `requestEquity` +
  `browserWorker` factory (export the factory or replicate the guarded `new Worker(...)`).

**T10. Override UI (TDD).** Same component; "I count differently" stepper + soft toggles + reset.
- Tests (FR-11): clicking +/− updates local `outsOverride`; Steps 2–6 + closeness recompute; true win
  unchanged; reset clears override.

**T11. FeedbackPanel integration.** Render `<MentalMathSection enabled={enabled} />` in
`components/FeedbackPanel.tsx` after the EV details, inside the panel, after an `hr`.
- Test: extend `FeedbackPanel.test.tsx` — section present when enabled; existing verdict/equity render
  unchanged (no regression).
- Verify: `npm test components` green.

## Wave 6 — Final verification

**T12. Full gate.**
- `npm run typecheck` clean · `npm run lint` clean · `npm test` all green (new + existing).
- Manual smoke (dev server): deal to flop with a draw → Feedback → Mental Math → steps + comparison;
  check preflop/river/no-draw notes; toggle override; confirm collapsed default + session persistence.
- Confirm no changes to `analyze()`, equity engine, `HandRecord`, or `data/` schema.

## Decisions / risks

- **D-plan-1:** `exactHitPct` uses exact combinatorics (cheap; outs/unseen are small) — no Monte Carlo
  for the hit number, keeping the technique-check deterministic and the only Monte Carlo call the
  existing `requestEquity` for true win equity.
- **Risk-1 (straight detection):** the rank-completer logic is the fiddliest part (wheel/Ace-low,
  OESD-vs-gutshot classification). Mitigated by table-driven tests in T2 covering each draw shape.
- **Risk-2 (live-hand sourcing off-turn):** `heroSpot()` is only valid on hero's turn; the off-turn
  fallback (§3.1) must not throw. T8 tests the non-hero-turn path.
- **Risk-3 (worker in tests):** component tests mock `requestEquity`; the sync fallback covers
  jsdom/SSR. No real worker spun in tests.

## Release prerequisites (for /complete-dev)

- No version-bump/changelog tasks here (per pipeline norms, /complete-dev owns release).
- Update `CLAUDE.md` architecture note? Optional — the new `core/mental/` module fits the existing
  `core/*` description; mention in /complete-dev learnings if warranted.
