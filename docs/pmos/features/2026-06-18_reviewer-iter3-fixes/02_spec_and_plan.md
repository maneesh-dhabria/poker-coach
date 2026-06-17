# Spec + Plan — Reviewer iteration-3 fixes

Tier 2. Combined design + task breakdown. One small pure copy change in `core/analysis/explain.ts`
(depth-aware preflop framing — still no React/DOM, the chart still owns the recommendation), one
subtle composition tune in `core/bots/personas.ts` (balanced preset), the rest presentational
(`components/*`) + setup copy. No `HandRecord` schema change. The recap/feedback panel still read
`DecisionAnalysis` + the async equity they already request — they never recompute a verdict. Honesty
invariant preserved: `gtoClaim` stays true only for preflop chart claims, and the depth-aware copy
names the chart as the source rather than misstating it.

## Design decisions

### FR-1 Variance bridge on a well-played loss (finding #1) — MAJOR
- `components/HandRecap.tsx`: mirror the existing `recap-reconcile` (won-but-flagged) note. Add a
  `recap-variance` note shown when `heroNet < 0 && c.mistake === 0` — i.e. the hand was lost but no
  graded decision was an ❌ mistake. Copy is plain and surfaced by DEFAULT (not in an expander):
  "good decision, unlucky result — that's variance; we grade the decision, not the outcome; these
  win % are long-run averages, not this one hand." A lost-AND-flagged hand (≥1 ❌) suppresses it, so
  the comfort is never offered when the loss was partly the player's mistake.
- Constraint: the recap reads the embedded `DecisionAnalysis.verdict` only; no recompute.

### FR-2 Consistent units in the recap (finding #2) — MAJOR
- `components/HandRecap.tsx` takes a `displayUnit` prop (default `usd`) and formats the per-decision
  `actionLabel` amounts, the "· pot X" tag, and the `resultLine` via `formatMoney(amount,
  displayUnit, BIG_BLIND)` (BIG_BLIND = 2). The embedded `plainExplanation` is the engine's frozen
  ground-truth sentence in its own unit and is rendered verbatim (shown identically in live
  feedback) — it is intentionally not re-rendered.
- `components/RightPanel.tsx` threads `displayUnit` (from the session store) into `<HandRecap>`.

### FR-3 Gate the end-of-hand conclusion on hand-complete (finding #3) — MINOR
- `components/HandRecap.tsx` takes a `handComplete` prop (default `true` for back-compat). The
  decision LIST always renders; the CONCLUSION block (Result line + /poker-coach pointer +
  reconcile/variance notes) is wrapped in `handComplete ? (…) : null`.
- `RightPanel` passes `handComplete={handOver}` (from `flow.isOver()`).

### FR-4 Pending caption only promises present content (finding #4) — MINOR
- `components/RightPanel.tsx`: compute `mentalMathAvailable = mentalMathOpen && pendingStreet &&
  pendingStreet !== "preflop"` (Mental Math renders numbers only on a post-flop spot and only when
  expanded). The pending card's caption appends the "numbers below (Mental Math) are for this
  <street> decision" clause only when `mentalMathAvailable`; otherwise it just says the last verdict
  was for an earlier street.

### FR-5 Accurate feedback-OFF copy (finding #5) — MINOR
- `components/RightPanel.tsx`: reword the `feedback-off` card — "Instant per-decision verdicts are
  off. You'll still see the running hand review below populate after each move as you play; the big
  verdict and equity block is hidden. Turn instant feedback back on from New session." No longer
  claims the review only arrives "when the hand ends".

### FR-6 Responsive felt fit (finding #6) — MINOR
- `components/table/PokerTable.tsx`: the felt box gets `aspectRatio: "760 / 520"` (plus the existing
  `maxWidth`/`maxHeight`), so the oval scales to fit BOTH width and height — on a short/narrow
  viewport it shrinks proportionally and seats keep their relative positions instead of being
  squashed against the edges. Seat radii shrink to RX 38 / RY 32 so the top/bottom seats sit further
  inside. The center pot/round-summary block anchors at `top: 42%` (upper-center) so it clears the
  bottom hero ("You") seat (seats also still paint above it via zIndex). jsdom has no layout engine,
  so a source-contract test asserts the aspect ratio + center anchor; true pixel verification is the
  next reviewer's Playwright step.

### FR-7 Depth-aware preflop explanation (finding #7) — MINOR
- `core/analysis/explain.ts` `preflop()`: branch on `p.depth`.
  - `strict` → the existing chart/GTO citation ("The baseline chart says …").
  - `equity` (default) → lead with the win-rate ("By the odds, your equity (your share of the pot —
    how often you win) with AKs is about 67% …, so raising from CO is the standard, profitable play
    — which is exactly what the baseline chart recommends"); names the chart as the SOURCE so the
    recommendation isn't misstated; defines "equity" inline to satisfy the T18 no-jargon guard.
  - `conceptual` → already handled by `conceptual()` (plain words, no numbers).
- The chart still owns the RECOMMENDATION (`gtoClaim` unchanged); only the explanation framing
  changes. The "chart-based" chip (gated on `gtoClaim`) stays honest across depths.

### FR-8 Balanced preset softening (finding #8) — MINOR (judgment call)
- `core/bots/personas.ts`: the `balanced` template (newcomer default) gets two subtle, contained
  softenings vs the original — the lone LAG drops Intermediate → Beginner (looser/noisier but LESS
  relentlessly aggressive, so it balloons pots less often than a steady Intermediate LAG), and the
  Calling Station drops Beginner → Intermediate (a less extreme call-station → fewer giant call-down
  showdown pots). Still a genuine four-style mix, not neutered. No engine knobs touched; the
  `personas`/`botEngine` tests assert relative orderings + well-formedness, which still hold. The
  PRIMARY reframe for a sound loss remains FR-1.

### FR-9 Winner attribution banner (finding #9) — NIT
- `components/table/PokerTable.tsx`: when building `categoryBanner` from the shown single winner,
  prefix it with the winner's name — `"You win with <category>"` if `shownWinner.isHero`, else
  `"<name> wins with <category>"`. The mucked-winner / fold-out path already produces no banner.

### FR-10 Stack carryover note (finding #10) — NIT
- `components/SetupScreen.tsx`: a `carryover-note` line under Starting stack — "Stacks carry over
  hand to hand like a real cash game, so after a few hands opponents may sit on very different
  amounts."

### FR-11 Blind size on setup (finding #11) — NIT
- `components/SetupScreen.tsx`: a `blind-note` line — "Blinds $1/$2 — 1 BB = $2, so your <N> BB stack
  is worth $<N·2>." Uses the real engine blind constants (smallBlind 1 / bigBlind 2, mirrored as
  local consts); the stack value updates with the selected `startingStackBb`.

### FR-12 Graceful Mental Math at hand-complete (finding #12) — NIT
- `components/MentalMathSection.tsx`: derive `handComplete = !!flow && flow.isOver()`. When the
  estimate status is `no-hand`, show a `mm-hand-complete` note ("Hand complete — the live math has
  cleared. See the hand review below…") if `handComplete`, else the original "deal a hand"
  placeholder. The `Note` helper gains an optional `data-testid`.

## Task list (TDD where it fits)
1. HandRecap variance note + units + hand-complete gate (FR-1/2/3) — edit `HandRecap`,
   thread props from `RightPanel`; extend `HandRecap.test.tsx`.
2. Pending caption + OFF copy (FR-4/5) — edit `RightPanel`; extend `RightPanel.test.tsx` (the OFF
   copy test is updated to the new accurate wording — see "Tests changed").
3. Responsive felt (FR-6) — edit `PokerTable`; extend `PokerTable.handrecap.test.tsx` source guard.
4. Depth-aware preflop (FR-7) — edit `core/analysis/explain.ts`; extend `explain.test.ts`.
5. Balanced preset (FR-8) — edit `core/bots/personas.ts` (no test change needed; existing pass).
6. Winner banner (FR-9) — edit `PokerTable`; extend `PokerTable.handrecap.test.tsx`.
7. Setup notes (FR-10/11) — edit `SetupScreen`; extend `SetupScreen.test.tsx`.
8. Mental Math hand-complete (FR-12) — edit `MentalMathSection`; extend `MentalMathSection.test.tsx`.
9. Gate: `npm run typecheck`, `npm run lint`, `npm test` all green.

## Tests changed (not weakened)
- `RightPanel.test.tsx` — the feedback-OFF assertion is updated to match the corrected copy (FR-5):
  it now asserts "per-decision verdicts off / running hand review / after each move" and asserts the
  misleading "when the hand ends" phrasing is GONE. This is an intentional behavior/copy change, not
  a weakening.
