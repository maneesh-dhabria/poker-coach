# Changelog

All notable changes to Poker Coach are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track `package.json`.

## [0.9.0] — 2026-06-18

### Reviewer-iteration-4 fixes — board-street regression, no contradictory coaching

A fourth independent first-time-user playtest (`docs/playtest/reviews/iter-03.md`)
caught two regressions the v0.8.0 round had introduced, plus a layer of coaching
copy that could contradict itself or mislead. All fixed. UI/coaching-only — the
one `HandRecord` touch is an additive optional field (no schema-version change).

### Fixed

- **You can see the street you're deciding again (regression).** v0.8.0's table
  changes left the community board capped to the action-replay cursor even on a
  static decision, so "Deciding your flop" showed no flop, "turn" showed only the
  flop, etc. — you were acting blind to the current street. The board is now
  capped only while the bot-action reveal animation walks; on your decision (and
  at showdown) it shows the full dealt board (`boardShowCount` helper in
  `components/table/PokerTable.tsx`). Locked in by a `HandFlow` test asserting
  flop→3, turn→4, river→5 cards at each hero decision.
- **Bet/raise feedback can't contradict itself.** A river bet could be graded
  "❌ Mistake — not enough behind it" while the same panel's headline said "you
  only need ~0% … that gap is why continuing makes money over time" — call/draw
  pot-odds language mis-applied to a bet. The "you only need ~Y% / makes money"
  headline and the "needed %" equity-bar marker now render ONLY when you're
  facing a bet and deciding whether to call; a flagged bet never claims it makes
  money (`core/analysis/explain.ts`, `components/FeedbackPanel.tsx`).
- **The verdict tag matches the action and street.** A preflop raise no longer
  gets a "called too wide" tag, and a river fold is no longer labeled "good
  preflop discipline" — new `played_too_wide` and `good_fold_discipline` tags
  cover those spots (`core/analysis/conceptTags.ts`, `analyze.ts`).
- **Honest fold rationale.** Folding a near-dead hand to a big all-in is now
  explained by the low win-chance vs the price, not "the pot isn't big enough"
  (which was false when the pot was huge) (`core/analysis/explain.ts`).
- **Raise amounts read consistently.** The button "Raise to N", the round
  summary, and the hand review now all show the same total-raise-to number
  (additive optional `toAmount` carried through `core/handFlow.ts` and the action
  record), instead of the button saying "to 2 BB" while the log said "to 1 BB".
- **Coaching depth no longer leaks.** Conceptual shows plain words with no equity
  % and no "chart-based" badge; Equity + Heuristics surfaces the win-rate; Strict
  charts keeps the chart/GTO citation — each depth now stays in its lane
  (`core/analysis/explain.ts`).
- **The EV table only lists legal actions.** On an unopened spot it no longer
  shows a phantom "if you call …" row (`core/analysis/analyze.ts`).
- **Constrained-size center/seat overlap reduced.** The center pot + "THIS ROUND"
  summary is bounded and anchored clear of the hero seat so it doesn't hide the
  pot or collide with "You" at small/narrow sizes
  (`components/table/PokerTable.tsx`, `app/globals.css`).

### Changed

- **Surprising equity reads less mysterious.** The assumed-range note next to a
  win-chance now reads "… vs an assumed range of hands, not their actual cards,"
  so e.g. a high queen-high equity heads-up against a calling station is
  explained rather than confusing (`components/FeedbackPanel.tsx`). No equity-math
  change.

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or
  prior fixes); evidence at `docs/playtest/reviews/iter-03.md`. Two reported items
  were stale hot-reload artifacts and are NOT bugs in shipped code (`/favicon.ico`
  returns 200; `resultLine` is correctly defined) — a recap-conclusion render test
  for win and loss was added as a guard regardless. Verified: `tsc --noEmit`
  clean, ESLint clean, **329** tests passing (+18), including a board-shows-current-
  street test and bet-vs-call copy tests. The implementer ran an explicit
  self-check for new contradictions in the board + analysis-copy changes. True
  pixel layout verification at 800×600 / 600×900 is exercised by the next
  fresh-reviewer playtest. See `docs/pmos/features/2026-06-18_reviewer-iter4-fixes/`.

## [0.8.0] — 2026-06-18

### Reviewer-iteration-3 fixes — variance framing, unit consistency, depth-aware coaching

A third independent first-time-user playtest (`docs/playtest/reviews/iter-02.md`)
confirmed the v0.6.0/v0.7.0 fixes landed (the reviewer praised the Mental Math
reconciliation, the live unit toggle, and that the action bar is never clipped),
then surfaced a fresh layer of 12 negative moments. All are fixed here.
UI/coaching-only — no `HandRecord` schema change. The one core change is to the
decision **analysis** explanation copy (`core/analysis/explain.ts`); the chart
still owns every preflop recommendation and `gtoClaim` is unchanged, so the
honesty invariant holds.

### Fixed

- **A well-played loss now reads as variance, not a contradiction.** When you
  lose a hand but none of your graded decisions were mistakes, the recap shows a
  plain note by default: "good decision, unlucky result — that's variance; we
  grade the decision, not the outcome… these are long-run averages, not this one
  hand." Previously that reconciling idea was buried in a collapsed expander, so
  a newcomer who went all-in at ~92% and lost felt the app contradicted itself.
  The note is suppressed when the loss was at least partly a flagged mistake
  (`components/HandRecap.tsx`).
- **The Hand review and Result line now respect the BB/$ toggle.** In BB mode the
  recap's per-decision rows, the `· pot X` tag, and the "Result" line were still
  printing dollars while everything else showed BB — mixed units on one screen.
  They now format in the session unit (`components/HandRecap.tsx`,
  `components/RightPanel.tsx`).
- **The end-of-hand "Result" no longer appears mid-hand.** The running
  per-decision review still updates live, but the "Result:" conclusion and the
  `/poker-coach last` pointer (and the variance/reconcile notes) only render once
  the hand is actually over (`components/HandRecap.tsx`,
  `components/RightPanel.tsx`).
- **The feedback caption stops promising absent numbers.** The "the numbers below
  (Mental Math) are for this decision" caption now appears only when a post-flop
  Mental Math block is actually open and available
  (`components/MentalMathSection.tsx`, `components/RightPanel.tsx`).
- **Instant-feedback-OFF copy is accurate.** It now says the running hand review
  still populates live as you play and that only the big top verdict/equity block
  is hidden — instead of the misleading "you'll get a review when the hand ends"
  (`components/RightPanel.tsx`).
- **Coaching depth now changes the preflop explanation.** "Equity + Heuristics"
  leads with the win-rate and a plain reason (naming the chart as the source);
  "Strict charts" keeps the chart/GTO citation; "Conceptual" stays plain-words.
  Previously every preflop verdict read "chart-based" regardless of the chosen
  depth (`core/analysis/explain.ts`).
- **Constrained window sizes no longer collide.** The felt keeps a fixed aspect
  ratio and scales to fit both width and height, seat insets are pulled in, and
  the center pot/round-summary is anchored clear of the hero seat — so at small/
  short/narrow sizes seats aren't clipped off the edge and the center readouts
  aren't hidden behind "You" (`components/table/PokerTable.tsx`, `app/globals.css`).
- **Showdown names the winner.** The center banner now reads "You win with …" /
  "&lt;Bot&gt; wins with …" instead of an unattributed hand label that looked like
  it described the hero's hand (`components/table/PokerTable.tsx`).
- **The Mental Math box isn't jarring at showdown.** At hand-complete it shows a
  short "hand complete — see the hand review" note instead of reverting to the
  "deal a hand and reach the flop" placeholder (`components/MentalMathSection.tsx`).

### Changed

- **The "balanced" table plays a touch gentler for newcomers.** Its composition
  was softened (less relentless aggression, fewer giant call-down pots) so a new
  player isn't routinely stacked in a few hands; combined with the variance note
  above, a sound-but-unlucky loss is now explained rather than discouraging
  (`core/bots/personas.ts`). Demo fixtures regenerated for the new preflop copy.

### Added

- **Setup context for newcomers.** The setup screen now states the blind size and
  what the chosen starting stack is worth (e.g. "Blinds $1/$2 — 100 BB = $200")
  and notes that stacks carry over hand-to-hand like a real cash game, so the
  initial dollar amounts and later uneven bot stacks aren't a mystery
  (`components/SetupScreen.tsx`).

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or
  prior fixes); evidence at `docs/playtest/reviews/iter-02.md`. Verified:
  `tsc --noEmit` clean, ESLint clean, **311** unit/component tests passing (new
  tests for the variance note, recap units, mid-hand gating, depth-aware preflop
  copy, the layout aspect-ratio contract, winner attribution, the blind/carryover
  notes, and the Mental Math showdown state). The responsive fix is verified at
  the CSS-contract level (jsdom has no layout engine); true pixel behavior at
  800×600 / 600×900 is exercised by the next fresh-reviewer playtest. See
  `docs/pmos/features/2026-06-18_reviewer-iter3-fixes/`.

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
