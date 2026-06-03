# Changelog

All notable changes to Poker Coach are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track `package.json`.

## [0.4.0] — 2026-06-03

### Mental Math (Outs & Equity Walk-Through)

A coaching feature that teaches the mental outs→equity routine **on the live
hand**, inside the existing Feedback panel. No new tab, no manual card entry —
it reads the hand in progress and lets you "check your work" against the app's
Monte Carlo equity. The decision engine, equity worker, and `HandRecord` schema
are unchanged.

### Added

- **`core/mental/` pure module.** Deterministic outs counting (flush / open-ended
  / gutshot / overcards, overlap-correct union), the Rule of 2 & 4, an exact
  hypergeometric hit probability, opponent-shade ranges, pot-odds break-even, a
  profitable/marginal/steep decision, and board-taint warnings — all pure, no
  React/DOM (`outs.ts`, `hit.ts`, `estimate.ts`, `types.ts`). The guide's worked
  example (Q♥J♥ on 10♥9♣2♥ → 15 outs → 60% rule / 54.1% exact) is locked in tests.
- **Collapsible "Mental Math" section** in `FeedbackPanel` (`components/MentalMathSection.tsx`).
  Six labeled steps on the live hand; "check your work" compares your hit estimate
  to the true Monte Carlo win equity (the hit→win gap is the visible lesson);
  optional dollar EV in the session display unit; an "I count differently" outs
  override. Collapsed by default; open state persists for the session
  (`sessionStore.mentalMathOpen`).

### Fixed

- **Live-hand tracking.** `MentalMathSection` memoized its derived input on the
  `gameStore.flow` object, but the store mutates one `HandFlow` instance in place
  (only `tick` bumps), so the section froze at its first snapshot. Now it
  re-derives on `tick` and tracks the hand across streets.
- **Build break (pre-existing).** Extracted `PlayShell` out of `app/page.tsx` into
  `components/PlayShell.tsx` — Next.js 14 rejects non-allowlisted named exports
  from a page file, which had broken `npm run build`. No behavior change.

## [0.3.0] — 2026-05-31

### UX & Learning Overhaul

A presentation + continuity + teaching pass over the play screen — the decision
engine's verdict math and the `HandRecord` schema (v1) are unchanged.

### Added

- **No-scroll, two-column play shell.** At ≥1280×800 setup and in-hand fit one
  fold; only the active right-panel tab body scrolls (`app/page.tsx`, `RightPanel`,
  `TabStrip`).
- **Money continuity.** Stacks carry hand-to-hand; a lifetime bank persists to
  `data/bankroll.json` (new `/api/bankroll` GET/PUT, `lib/dataStore` atomic writes,
  pure `core/bankroll.ts` reducer) and survives restart. Bust→rebuy modal with
  auto-rebuy; "New table" resets stacks but keeps the bank; bots auto-rebuy.
  Starting-stack presets 50/100/200 BB.
- **Per-hand + session legibility.** Every seat shows its net for the just-finished
  hand; the header shows Session P/L (▲/▼) and lifetime Bank. Click the hero stack
  to toggle $⇄BB (pure `core/money.ts`; engine stays in integer dollars).
- **Follow the action.** The seat to act gets a "thinking" glow synced to the
  reveal cursor.
- **See who won and why.** Winner glow, yellow winning-5 cards, a center-table
  hand-category banner (pure `handCategoryLabel` / `winningCards` in `core/eval`),
  and per-seat net chips.
- **Rankings tab.** All nine hand categories strongest-first, derived from the
  `HandCategory` enum (single source).
- **Preflop Chart tab.** 13×13 / 169-hand grid of keyboard-reachable `<button>`s
  with aria-labels; a position selector defaulting to the hero's seat; click a hand
  for a plain-language detail card with equity from a committed precomputed table
  (`core/charts/preflopEquity.json`, on-demand fallback) — no runtime LLM.
- **Plain-language coaching.** Verdict copy reworded to lead with the plain idea
  and define terms inline (no unexplained jargon); folds get a winner's-perspective
  narration (who won, with what), gracefully degrading when the winner mucked.

### Engineering notes

- New pure, unit-tested core helpers (`money`, `bankroll`, `handCategoryLabel`,
  `winningCards`, `allHands169`) keep `core/*` DOM-free; the §17 architectural
  assertions stay grep-clean (no React/DOM/fs in core, no runtime LLM).
- Verified via the full `/verify` gate: ESLint + `tsc` clean, **195 tests passing**,
  and a live Playwright check confirming no-scroll at 1280×800.

## [0.2.0] — 2026-05-29

First playable MVP: a local, all-TypeScript app for 6-max No-Limit Hold'em cash —
play against tunable bots and get plain-language coaching. No API key, no Anthropic
SDK; coaching is the `/poker-coach` Claude Code skill reading/writing local files.

### Added

- **Core poker engine (pure TS, no DOM/React).** Own 7-card hand evaluator (wheel
  A-5, flush > straight ordering), NLHE betting engine with side-pot layering,
  min-raise reopening, and all-in capping.
- **Monte Carlo equity** off the UI thread via a Web Worker (seeded, deterministic;
  synchronous fallback in `equityClient`). Equity is computed vs an assumed
  population range only — never the bots' hole cards.
- **Decision analysis** as the single source of every verdict / `conceptTag` /
  `gtoClaim`, with depth-aware feedback (Conceptual / Equity+Heuristics / Strict
  charts) and honest claims: `gtoClaim` is true only for preflop chart feedback.
- **Heuristic bots** with tunable persona (style × skill) and table presets;
  dynamic opponent count 1–5 (true 6-max).
- **Interactive table UI** — setup screen, poker table, legal-only action bar with
  ½/¾/Pot quick-sizing, feedback panel (verdict, equity bar, plain-math sentence),
  and a coaching viewer.
- **Filesystem contract** — versioned JSON hand records and session snapshots under
  `data/` (atomic writes via Node API route handlers); demo fixtures in
  `samples/session-demo/`.
- **`/poker-coach` coaching skill** — reads saved hands, treats embedded
  `DecisionAnalysis` as ground truth (never recomputes), honors `gtoClaim`, restates
  the assumed range, and writes per-hand + session-summary coaching markdown.

### Engineering notes

- Decision **P8**: implemented an own evaluator + engine instead of
  `poker-ts` / `poker-evaluator-ts` to keep `core/*` pure and avoid binary-data
  dependencies, while still satisfying the §17 architectural assertions.
- Verified via the full `/verify` gate: ESLint + `tsc` clean, 99 unit/integration
  tests passing, production build OK, all 7 §17 assertions grep-clean, and a live
  Playwright walk confirming the honesty invariant in both the UI and the persisted
  records.
