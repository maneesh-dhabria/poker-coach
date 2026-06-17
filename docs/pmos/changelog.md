# Changelog

All notable changes to Poker Coach are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track `package.json`.

## [0.7.0] — 2026-06-17

### Reviewer-iteration-2 fixes — Mental Math integrity + responsive play

A second, fully independent first-time-user playtest
(`docs/playtest/reviews/iter-01.md`) surfaced 12 reproducible negative moments
that the v0.6.0 pass didn't reach — most seriously, the Mental Math coach
contradicting the verdict engine. All are fixed here. UI/coaching-only — no
`HandRecord` schema, API, or decision-engine verdict change (one pure, sync
addition to `core/mental`; the panel still reads `DecisionAnalysis` + the Monte
Carlo equity it already requests, and never recomputes a verdict).

### Fixed

- **Mental Math no longer contradicts the verdict (the headline bug).** The
  `core/mental` walk-through was outs-only, so a made hand the outs count ignores
  (e.g. top pair + gutshot on 4A3 with A2) produced a "~13% can't pay the 27%
  price → fold" headline while the engine graded the same call "Easy call" off
  ~47% true equity. `core/mental/estimate.ts` now detects the made hand
  (`detectMadeHand`, plain label), surfaces it in Step 1, and drives the Step-6
  conclusion (`conclusionFrom`) from the SAME Monte-Carlo equity the engine
  grades against — so it never steers a fold on the outs alone. The "check your
  work" gap line (`gapExplanation`) now attributes the hit%-vs-win% gap to the
  made hand when that's the real cause, instead of always blaming "opponents +
  board danger" (`core/mental/{types,estimate,index}.ts`,
  `components/MentalMathSection.tsx`). `core/mental` stays pure/sync — equity is
  passed in.
- **The play view is usable at narrow widths.** The previous fix only handled
  short viewports; below ~1000px the fixed 420px rail squeezed the table column
  until the Fold/Check/Raise bar and seats clipped off-screen. `.play-grid` now
  narrows the rail at ≤1100px and stacks to a single column at ≤880px, and the
  action bar wraps + centers (`app/globals.css`, `components/PlayShell.tsx`,
  `components/ActionBar.tsx`).
- **The center "THIS ROUND" log no longer overlaps seats.** It's painted under
  the seats and size-capped (`components/table/PokerTable.tsx`).
- **Live Feedback can't show a stale verdict for the wrong street.** While you're
  deciding a later street than the last graded decision, the panel shows a
  "Deciding your <street>…" pending card instead of the previous street's verdict
  + equity, so only one set of numbers ever describes the decision in front of
  you (`components/RightPanel.tsx`).
- **Instant-feedback OFF is no longer a silent blank.** During play the panel
  now says the blank is intentional and notes the hand review still appears
  afterward (`components/RightPanel.tsx`).
- **Units are consistent.** With the stack toggled to BB, the feedback text and
  the action/bet buttons render in BB too, instead of mixing BB and dollars on
  screen (`components/FeedbackPanel.tsx`, `components/ActionBar.tsx`,
  `components/table/{CenterStack,Seat,PokerTable}.tsx`).
- **A fold no longer reads "you won $0."** The recap now says "no money won or
  lost this hand" for a $0 result (`components/HandRecap.tsx`).
- **The preflop chart defaults to your seat.** References → Preflop chart opens
  on the hero's live position (falling back to BTN) instead of always BTN; manual
  picks stick (`components/PreflopChartTab.tsx`).
- **The setup screen says what a preset does.** A one-line hint clarifies that
  picking a table preset fills in / replaces every bot's style + skill
  (`components/SetupScreen.tsx`).
- **All-in hands show the full board.** The engine already dealt all five
  community cards on an all-in; the table was capping the display to the last
  action's street, so an all-in on the turn showed only four cards. The full
  board now renders at showdown (`components/table/PokerTable.tsx`).

### Engineering notes

- Found by an **independent, context-free** reviewer (the fix-loop's source of
  truth — no memory of the design or prior fixes); evidence archived at
  `docs/playtest/reviews/iter-01.md`. Verified: `tsc --noEmit` clean, ESLint
  clean, **295** unit/component tests passing (new tests for made-hand
  reconciliation, the gap explanation, the responsive grid/action-bar contract,
  units, fold wording, chart default seat, and the all-in board run-out). The
  responsive fix is verified by jsdom CSS-contract + flex-wrap assertions (jsdom
  has no layout engine); true pixel behavior at 600–800px is exercised by the
  next fresh-reviewer playtest. See
  `docs/pmos/features/2026-06-17_reviewer-iter2-fixes/`.

## [0.6.0] — 2026-06-17

### First-time-user fixes + ALL-IN badge

A fresh-user playtest (`docs/playtest/scratchpad.md`) surfaced six confusing or
blocking moments; all are fixed here. Plus an ALL-IN seat badge so it's obvious
when a player is committed. UI-only — no `HandRecord` schema, API, or core
decision-engine change.

### Added

- **ALL-IN seat badge.** A seat shows an `ALL-IN` badge once a player has put
  their whole stack in, backed by engine all-in introspection
  (`components/table/Seat.tsx`, `core/engine/gameEngine.ts`, `core/handFlow.ts`).
- **Plain-language style legend on setup.** The opponents panel now carries an
  always-visible gloss — `TAG — tight & aggressive · LAG — loose & aggressive ·
  Nit — ultra-tight, folds a lot · Calling Station — calls a lot, rarely folds` —
  plus per-preset tooltips, so a basics-only player isn't stuck on the jargon
  (`components/SetupScreen.tsx`).
- **Friendly empty state for Live Feedback.** Before your first action (and on
  every new hand) the panel reads "Make your move — …" instead of rendering a
  large blank pane that looks like a failed load (`components/RightPanel.tsx`).
- **Favicon + app icon.** `/favicon.ico` no longer 404s; an SVG app icon ships
  too (`app/favicon.ico`, `app/icon.svg`).

### Changed

- **The action bar can no longer be clipped off-screen.** The felt is now a
  flex child (`flex:1 1 auto; min-height:0; max-height:580`) inside a full-height
  column, with the Fold/Call/Raise bar pinned as `flex:0 0 auto`. On viewports
  shorter than ~720px (small laptops, split-screen, browser zoom) the table
  shrinks to fit instead of pushing the controls below the fold
  (`components/table/PokerTable.tsx`). This was the most damaging issue — a new
  user could otherwise conclude the game was broken.
- **Feedback is anchored to the decision it describes.** Each Live Feedback card
  now carries a caption — `Your <street> decision · pot was $X when you acted` —
  and every Hand-review row shows `· pot $X`, so the equity/pot numbers can't be
  confused with the live board, which has since moved on
  (`components/FeedbackPanel.tsx`, `components/RightPanel.tsx`,
  `components/HandRecap.tsx`).
- **Won-hand-but-flagged reconciliation.** When you win a hand that still
  contains a flagged decision, the recap adds a plain line: "You won this hand,
  but the ❌ above flags a play that loses money on average — … we grade the
  decision, not the outcome" (`components/HandRecap.tsx`).

### Engineering notes

- Shipped through the full `/feature-sdlc` pipeline (Tier 2). Verified via the
  `/verify` gate: ESLint + `tsc` clean, **270** unit/component tests passing, and
  a live Playwright walk at 1024×640 (the previously-broken size) confirming the
  action bar stays in view, the empty state and feedback-context captions render,
  the setup legend is visible, the reconcile line appears on a won-but-flagged
  hand, and `/favicon.ico` returns 200. See
  `docs/pmos/features/2026-06-17_first-time-ux-fixes/` and
  `docs/playtest/scratchpad.md`.

## [0.5.0] — 2026-06-03

### UX/UI Cleanup

Five rough edges in the play interface, smoothed. The right panel now reads as
three clear sections, the table feedback is consistent, and the "whose turn"
glow follows whoever is actually to act. UI-only — no data-model, API, engine,
or bot-logic change.

### Changed

- **Right-panel tabs merged from five to three.** `Hands` + `Feedback` →
  **Live Feedback** (live per-decision feedback stacked above the full Hand
  review); `Rankings` + `Pre-Flop chart` → **References** (rankings above the
  preflop chart, one scroll); `Coaching` unchanged. `TabKey` is now a clean
  `"live-feedback" | "coaching" | "references"` union, defaulting to Live
  Feedback, with a coercing setter that maps any stale persisted key back to the
  default (`store/sessionStore.ts`, `components/TabStrip.tsx`,
  `components/RightPanel.tsx`).
- **Acting-seat glow follows whoever acts next.** During the bot-action reveal
  the gold glow now walks seat-to-seat at `REVEAL_MS` (~380ms) and then rests on
  the hero on their turn, instead of only ever lighting the human seat. Driven by
  an exported pure `selectActingSeat(revealing, log, revealed, view)` helper
  (`components/table/PokerTable.tsx`). Still respects `prefers-reduced-motion`
  (static ring, no pulse) for every acting seat.
- **Coaching markdown is styled.** The rendered coaching doc carries a
  `.coaching-doc` class with a scoped typography block (heading hierarchy,
  paragraph/list rhythm, bold emphasis) built from the existing design tokens —
  scoped so it never bleeds into the inline-styled feedback/reference panels
  (`components/CoachingViewer.tsx`, `app/globals.css`).

### Removed

- **Duplicate Hand review below the table.** `PokerTable` no longer renders its
  own `<HandRecap>` under the felt (it duplicated the Live Feedback tab); only
  the table, the "Opponents acting…" line, and the "Next hand" button remain
  there.

### Engineering notes

- Shipped through the full `/feature-sdlc` pipeline (Tier 2). Verified via the
  `/verify` gate: ESLint + `tsc` clean, **256** unit/component tests passing,
  production build OK, and a live Playwright walk confirming the glow walks bot
  seats during the reveal (`maxGlowCount=1`, ~380ms/action) then rests on the
  hero, the scoped coaching typography applies without bleed, and hard-reload is
  clean. See `docs/pmos/features/2026-06-03_ux-ui-cleanup/`.

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
