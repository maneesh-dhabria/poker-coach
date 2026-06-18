# Changelog

All notable changes to Poker Coach are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track `package.json`.

## [0.19.0] — 2026-06-18

### Reviewer-iteration-14 fixes — depth control takes full effect; no praising a reckless stack-off

A fourteenth independent first-time-user playtest (`docs/playtest/reviews/iter-14.md`)
exercised the new in-play depth control (shipped in 0.18.0) for the first time and surfaced
five MAJOR issues — several of them regressions exposed by that control — plus a handful of
copy/label nits. Coaching-analysis + UI only; no `HandRecord` schema-version change.

### Fixed

- **Changing coaching depth mid-hand now fully re-derives the feedback.** Depth was baked
  into each hand when it was dealt, so switching to Conceptual in-play still left
  percentages and dollar figures on the verdict card, the equity readout, the EV expander,
  and the review list — and switching to Strict silently looked like Equity (no "chart-based"
  badge, no "no baseline chart covers this spot" note). `HandFlow` now keeps each decision's
  depth-independent inputs and re-runs the (copy-only) analysis for the displayed and every
  recorded decision when depth changes, so Conceptual is fully digit-free and Strict shows
  its badge / off-model note immediately (`core/handFlow.ts`, `store/gameStore.ts`,
  `components/RightPanel.tsx`).
- **A grossly oversized postflop bet is no longer praised.** A ~4×-pot turn shove of a whole
  stack with only ~53% (a marginal middle pair) into two opponents used to be graded
  "✅ good — get money in while ahead." The gross-overbet flag now uses a postflop threshold
  of ~3× pot (preflop stays ~8× so normal 3-bets/4-bets and forced short-stack all-ins aren't
  flagged), so that stack-off is flagged ⚠️ with a "size down" note even though you're ahead
  (`core/analysis/analyze.ts`).
- **The end-of-hand "where the leak is" line now names the most serious play.** After busting
  to that overbet, the recap pointed at a minor preflop min-raise instead of the stack-losing
  shove. It now picks the most severe flagged decision (ties broken by the largest chip swing)
  and names it (`components/HandRecap.tsx`).
- **Iso-raising over limpers is no longer graded "thin" against its own chart.** Raising KQo
  from the SB into limpers was graded "⚠️ thin" by the live coach while the reference chart
  marks KQo-SB as a standard open. A raise in a limped pot by a position+hand the chart opens
  first-in is now graded ✅ (off-model, `gtoClaim: false`) with copy explaining that the chart
  assumes you're first in but the limpers make this an isolation raise
  (`core/analysis/analyze.ts`, `core/analysis/explain.ts`).
- **Smaller copy/label fixes:** the pair-rank label is now computed by position among the
  distinct board ranks (a pair of 4s on A-6-2-4 is "bottom"/"middle" correctly, not always
  "middle"); the Mental Math no-draw summary is action-aware on a call ("calling here just
  pays off…" rather than "betting as a bluff"); the dollar-EV note now reads the bet row when
  you bet and the call row when you face a bet (no more "betting is worth $24" sourced from the
  check row); the chart-approved verdict chip says "Standard open" on a raise instead of "Good
  discipline"; and no table preset is highlighted on load until one is actually applied
  (`core/mental/estimate.ts`, `components/MentalMathSection.tsx`, `components/FeedbackPanel.tsx`,
  `components/SetupScreen.tsx`).

## [0.18.0] — 2026-06-18

### Reviewer-iteration-13 fixes — Mental Math agrees with the bet you made

A thirteenth independent first-time-user playtest (`docs/playtest/reviews/iter-13.md`)
confirmed the iter-12 fixes held (Mental Math pinned to the verdict, Strict off-model
note explicit, Conceptual digit-free, chart never folds AA/KK, variance withheld after a
flagged play) and found one remaining contradiction plus two friction points.
Coaching-analysis + UI only; no `HandRecord` schema-version change.

### Fixed

- **Mental Math no longer tells you to "take the free card" after grading your bet a
  mistake.** Betting a draw/air with no made hand correctly gets a ❌ semi-bluff verdict,
  but the Mental Math below it still issued a present-tense "it's a free card — just take
  it" (i.e. check) instruction. The free-street conclusion is now action-aware: when you
  *bet* a low-equity hand it reconciles with the verdict ("you bet as a semi-bluff with
  only ~20% — checking for the free card would have been the cheaper line") instead of
  telling you to check as if the decision were still open. A genuine check still gets the
  free-card line, and made-hand value bets are unchanged (`core/mental/estimate.ts`,
  `components/MentalMathSection.tsx`).
- **Grossly oversized bets are now flagged.** A ~13×-pot all-in overbet used to be graded
  "✅ good · raising for value" with no comment on the size. A bet or raise that's a very
  large multiple of the pot (≥ ~5×) is now flagged ⚠️ with a "size down" note while
  keeping the correct direction — covering 3-bets/4-bets/shoves and postflop overbets, not
  just first-in opens. Standard 3-bet/4-bet sizing, pot-sized bets, and forced short-stack
  all-ins are deliberately left unflagged (`core/analysis/analyze.ts`, `explain.ts`,
  `conceptTags.ts`).

### Added

- **Change coaching depth and toggle instant feedback mid-session.** Both used to be
  locked in at session creation; a compact control in the live-feedback header now lets
  you switch depth (Conceptual / Equity / Strict) and turn instant feedback on/off in
  place, applied immediately (`components/RightPanel.tsx`).
- **A clean hand now gets credit.** When every one of your decisions graded ✅, a won hand
  closes with "Nicely played — every decision was solid" — the encouraging counterpart to
  withholding praise after a flagged play (`components/HandRecap.tsx`).

### Polish

- In the Mental Math walkthrough, the opponent-shaded figure is always labeled an estimate
  "to hit" your draw; "to win" is reserved for the single true-equity number, so no two
  figures read as conflicting win chances (`components/MentalMathSection.tsx`).

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or prior
  fixes); evidence at `docs/playtest/reviews/iter-13.md`. The reviewer verified the
  "no equity" wording is already correct (reserved for < ~20%; ~20–33% reads as a light
  semi-bluff). Verified: `tsc --noEmit` clean, ESLint clean, production build clean,
  **468** tests passing (+22). See `docs/pmos/features/2026-06-18_reviewer-iter13-fixes/`.

## [0.17.0] — 2026-06-18

### Reviewer-iteration-12 fixes — Mental Math always matches its verdict

A twelfth independent first-time-user playtest (`docs/playtest/reviews/iter-12.md`)
confirmed the iter-11 fixes held (chart never folds AA/KK, no "played well" after a
flagged play, Conceptual digit-free, low-equity bets agree with their EV table) and
found that the Mental Math block could contradict the verdict it sits under. Root cause:
Mental Math recomputed its outs/equity routine from the LIVE hand state, but the verdict
above it is frozen to the decision (and the panel persists between decisions since
v0.14.0) — so after a card was dealt, Mental Math drifted a street ahead of its own
verdict. Coaching-analysis + UI only; `HandRecord` schema-version unchanged (the new
fields are additive optional).

### Fixed

- **Mental Math now describes exactly the decision its verdict describes.** It used to
  show "you have two pair" (the just-dealt turn card) under a "middle pair" (flop)
  verdict, with a stale opponent count and a hand label that drifted between streets.
  Mental Math is now pinned to the frozen decision snapshot — same hole cards, board,
  street, opponent count, and made-hand label as the verdict — so the two can never
  disagree. (Added optional `board`/`street` to the analysis's explanation input;
  `core/analysis/{types,analyze}.ts`, `components/{FeedbackPanel,MentalMathSection}.tsx`.)
- **Step 3 ("shade for opponents") no longer calls a draw chance a win chance.** With a
  made pair, the panel showed "~54% to win" up top but "~14–16% to win" in Step 3 — that
  smaller number is the chance to *improve the draw*, not to win. It's now labeled "to
  hit your draw," with a note that the real win chance already includes the made hand, so
  only one figure in the panel is ever labeled "to win" (`components/MentalMathSection.tsx`,
  `core/mental/estimate.ts`).
- **Strict mode no longer pretends an off-chart spot is chart-backed.** When no baseline
  chart covers a spot, Strict depth used to silently fall back to pot-odds language that
  looked identical to Equity mode. It now shows an explicit "No baseline chart covers
  this spot — grading by equity and pot odds instead" note. And iso-raising over a
  limper is no longer graded against the raise-first-in chart (and ❌-flagged): a limped
  pot is now detected and treated as off-chart, so a standard isolation raise isn't
  punished as a chart deviation (`components/FeedbackPanel.tsx`, `core/analysis/analyze.ts`,
  `core/handFlow.ts`).

### Polish

- A player who folded with no money in shows "$0" instead of "+$0" (no sign on a zero)
  (`core/money.ts`, `components/table/Seat.tsx`).
- In big-blind mode the EV expander reads as a unit-neutral label instead of "Show the
  dollar EV" (`components/FeedbackPanel.tsx`).
- A ~44% check is now described as "roughly a coin-flip — keep the pot small" rather than
  "little to bet for," which undersold it (`core/analysis/explain.ts`).

### Notes (intentional, left as-is)

- The same min-bet can read "Bet too small" into a big pot but only "Thin value" into a
  small one — sizing is graded pot-relative, so a $2 bet is ~4% of a $48 pot but ~17% of
  a $12 pot. Same-street calls can flip from ❌ to ✅ as the price changes — that's correct
  pot-odds. The ⚠️ oversized all-in counts in the "thin" tally, matching its severity.
  Sub-800px seat text is small but never clipped/overlapping — an accepted scale-to-fit
  tradeoff.

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or prior
  fixes); evidence at `docs/playtest/reviews/iter-12.md`. Verified: `tsc --noEmit` clean,
  ESLint clean, production build clean, **446** tests passing (+15), including a guard
  that feeds a conflicting live turn board under a frozen flop decision and asserts
  Mental Math still shows the flop hand/street. See
  `docs/pmos/features/2026-06-18_reviewer-iter12-fixes/`.

## [0.16.0] — 2026-06-18

### Reviewer-iteration-11 fixes — closing the edges the last round opened

An eleventh independent first-time-user playtest (`docs/playtest/reviews/iter-11.md`)
found three correctness bugs — each an edge-case the *previous* round's fixes didn't
cover. All three are now closed without reopening what those fixes fixed.
Coaching-analysis + UI only; no `HandRecord` schema-version change.

### Fixed

- **A small bet with a weak hand is no longer praised as a value bet.** A min-bet with
  ~13% equity (A-high) used to be graded "you're AHEAD, size up to get paid while
  you're in front" — directly contradicting its own EV table (betting −$26 vs checking
  +$6). The "bet too small for value" critique now only fires for genuine value bets (a
  made hand, or enough equity to actually be ahead); a low-equity undersized bet is
  graded the mistake it is, agreeing with the EV table and never claiming a lead. The
  made-hand thin-value sizing check from the prior round is preserved
  (`core/analysis/analyze.ts`, `explain.ts`).
- **The reference chart never tells you to fold Aces — in any position.** Last round's
  new Facing selector exposed a "vs a raise" view, but the chart only has big-blind
  defense data, so "vs a raise" at every other position folded every hand ("AA — Fold
  from BTN"). The explanatory-panel guard is now general: any position/facing the chart
  doesn't actually model shows a short explanation instead of a fabricated all-fold grid
  — so a premium hand can never display "Fold" in an unmodeled spot
  (`components/PreflopChartTab.tsx`).
- **"Played well, unlucky variance" no longer appears after a flagged play.** The
  end-of-hand variance reassurance used to show on any non-mistake loss — including a
  hand whose only flaw was a ⚠️ thin play (e.g. an oversized shove). It now appears only
  when every hero decision graded clean (no ⚠️ and no ❌); a flagged loss instead gets a
  consistent "review the flagged play — that's the leak, not variance" note
  (`components/HandRecap.tsx`).

### Also fixed

- **Mental Math Step 6 no longer contradicts the dollar-EV line on the same card.** On a
  free street with no made hand, Step 6 used to say "take the free card" even when the
  EV table showed betting was the higher-EV play; it now recommends whichever action the
  EV actually favors (`core/mental/estimate.ts`, `components/{FeedbackPanel,MentalMathSection}.tsx`).
- **Position-accurate fold praise** — "especially out of position" now only appears for
  genuinely out-of-position seats, not the cutoff/button (`core/analysis/explain.ts`).
- **Conceptual depth is now digit-free across the whole panel** — the end-of-hand result
  line and decision tally drop their numbers at Conceptual depth (kept for Equity +
  Strict), matching the number-free verdict card (`components/HandRecap.tsx`).

### Notes

- Sub-800px seat-text legibility remains an accepted tradeoff of the scale-to-fit table:
  the no-clip / no-overlap guarantee comes from uniformly scaling to fit, so a text-size
  floor would reintroduce overflow at the smallest sizes. Nothing is clipped or
  overlapping — only small.

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or prior
  fixes); evidence at `docs/playtest/reviews/iter-11.md`. All three MAJORs were
  regressions/edges introduced by the iter-10 fixes — caught precisely because each
  review starts fresh. Verified: `tsc --noEmit` clean, ESLint clean, production build
  clean, **431** tests passing (+23), with guards that a low-equity small bet agrees
  with its EV table, the chart never renders "Fold AA", no "played well" praise survives
  a ⚠️/❌, and Step 6 never contradicts the EV table. See
  `docs/pmos/features/2026-06-18_reviewer-iter11-fixes/`.

## [0.15.0] — 2026-06-18

### Reviewer-iteration-10 fixes — honest BB chart, no number leaks, proportional praise

A tenth independent first-time-user playtest (`docs/playtest/reviews/iter-10.md`)
confirmed the iter-9 fixes held (no fold-vs-numbers contradiction, Conceptual's Mental
Math is number-free) and surfaced one chart-display bug plus polish. Coaching-analysis
+ UI only; no `HandRecord` schema-version change.

### Fixed

- **The preflop reference chart no longer tells you to fold Aces in the big blind.**
  With Position = BB the whole column rendered as "Fold" (so AA showed "AA — Fold from
  BB"), because the chart models raise-first-in ranges and the big blind has no opening
  range. The chart now has a **Facing** selector: with "first-in" + BB it shows a short
  explanation ("the big blind has no opening range here — with no raise to act against
  it just checks its option; switch to *vs a raise* to see big-blind defense") instead
  of a misleading all-fold grid; "vs a raise" shows the real BB-defense chart. No
  fabricated BB opening range — the honesty invariant is preserved
  (`components/PreflopChartTab.tsx`).
- **Mental Math no longer says "take the free card" when you're betting.** On a
  bet-or-check turn spot (nothing to call) the Step-6 block was headed "The call" and
  advised taking a free card even while the verdict recommended a bet. It now reads
  "Step 6 · The decision" and frames a made hand worth betting as a (thin) value bet; a
  genuine check-back still gets the free-card line (`core/mental/estimate.ts`,
  `components/MentalMathSection.tsx`).
- **A grossly undersized bet is now flagged even with a made hand.** A $2 bet into a
  $36 pot used to be graded only on hand strength; the made-hand branch swallowed the
  sizing check. A tiny bet now also draws "you have <hand>, but this bet is far too
  small to get value — size up" (`core/analysis/analyze.ts`, `explain.ts`).
- **Conceptual depth ("plain words, no numbers") now has truly no digits.** The live
  feedback and hand-recap context lines used to still print "pot was $6" / "you bet $3"
  in Conceptual; those amounts are now omitted at that depth (kept for Equity + Strict)
  (`components/FeedbackPanel.tsx`, `components/HandRecap.tsx`).
- **Praise is proportional to the hand.** A marginal middle pair is no longer called a
  "strong hand"; the value-bet copy now reads "you're ahead often enough here — betting
  for value is right" (`core/analysis/explain.ts`).
- **The Mental Math no-draw note stopped hedging "you may already have the best hand"
  when you hold air.** With no draw and no made hand it now says "no clear draw and no
  made hand yet — you're likely behind"; the "best hand" wording only appears when you
  actually have a pair or better (`core/mental/estimate.ts`).

### Readability

- Verdict jargon chips now show clean labels ("Thin value", "Light semi-bluff",
  "Bet too small", "Oversized") instead of raw underscored slugs
  (`components/FeedbackPanel.tsx`).
- Slightly larger seat names/stacks and a bolder currency glyph on action badges so a
  "$2" call doesn't read like "12" at small window sizes — no geometry change, the
  scale-to-fit + no-scroll guarantees hold (`components/table/Seat.tsx`).

### Notes

- Two reported items were intentionally left as-is: KQo defended from the BB grades by
  the real chart (its ~45% multiway equity is honest, and the ⚠️ is a thin-not-mistake
  note), and a `layout.css` 404 in the console is Next.js dev hot-reload stale-chunk
  noise, not a runtime error (the page is fully styled).

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or prior
  fixes); evidence at `docs/playtest/reviews/iter-10.md`. Verified: `tsc --noEmit`
  clean, ESLint clean, production build clean, **408** tests passing (+13), including
  guards that the BB chart never renders "Fold AA/AKs from BB", a Conceptual card's
  full text matches no digit, and a tiny made-hand bet carries a sizing critique. See
  `docs/pmos/features/2026-06-18_reviewer-iter10-fixes/`.

## [0.14.0] — 2026-06-18

### Reviewer-iteration-9 fixes — no preflop fold/EV contradiction, Conceptual stays number-free

A ninth independent first-time-user playtest (`docs/playtest/reviews/iter-09.md`)
surfaced two issues on code paths earlier rounds hadn't exercised: a preflop chart
FOLD card that contradicted its own numbers, and the Conceptual depth still leaking
numbers into Mental Math. Both fixed, plus a batch of polish. Coaching-analysis + UI
only; no `HandRecord` schema-version change.

### Fixed

- **A preflop fold is no longer praised next to numbers that say "call."** Folding
  Q5o from the SB used to show "✅ folding is the standard, profitable play" directly
  beside "you win ~31%, need ~17% — continuing makes money" and an EV table ranking
  call/raise above fold. The pot-odds "makes money" line, the equity-bar "need ~%"
  marker, and the EV "Show the numbers" table are inherently a postflop facing-a-bet
  (price-branch) tool — they're now suppressed on preflop chart decisions, which are
  graded for position/playability the one-street math can't capture. The preflop
  fold copy no longer claims immediate "profit" and adds a short out-of-position
  playability reconciliation (`components/FeedbackPanel.tsx`, `core/analysis/explain.ts`).
- **Conceptual depth ("plain words, no numbers") now truly has no numbers.** The
  Mental Math drawer used to still show percentages, outs counting, pot-odds math,
  and the Rule-of-4 reconciliation even in Conceptual. The whole Mental Math section
  (and its toggle/caption) is now hidden at Conceptual depth; it stays full-featured
  at Equity + Heuristics and Strict charts (`components/MentalMathSection.tsx`).
- **Instant feedback is actually readable between decisions.** Because the bots act
  instantly, the rich panel (verdict + equity bar + Mental Math) used to be replaced
  by an empty "Deciding your <street>…" placeholder before you could read it. The
  panel now keeps your most recent decision's full feedback visible, clearly
  relabeled "Your last decision — <street>" with a "now deciding your <street>; this
  updates when you act" note — so it can't be mistaken for the current spot
  (`components/RightPanel.tsx`).
- **Position-aware sizing advice.** The oversized-open warning no longer says "out of
  position" when you're in position (e.g. on the button) (`core/analysis/explain.ts`).
- **Clearer verdict labels.** An oversized open now reads "⚠️ Oversized" (not the
  confusing "⚠️ Thin"), and an air bet/shove with ~20–33% equity is worded as a light
  semi-bluff (`bluff_thin_equity`) rather than "no equity," which is now reserved for
  genuinely tiny equity (`core/analysis/{analyze,conceptTags}.ts`).
- **Readability touches.** Brighter red / truer black suit colors and slightly larger
  suit glyphs on the dark felt; the table uses a touch more of the viewport at very
  small sizes; and the EV table is now headed "From here on — the average result
  going forward, not the whole-hand outcome" so it isn't confused with the hand's P&L
  (`components/table/{Card,PokerTable}.tsx`, `app/globals.css`, `components/FeedbackPanel.tsx`).

### Notes

- One reported inconsistency — Strict depth showing equity language (not a chart
  citation) for a big-blind open-over-limpers — is intentional and was left as-is: the
  baseline RFI chart has no "BB opens first-in" range (that isn't a standard
  open-raise spot), so inventing a chart claim there would violate the honesty
  invariant. Strict's chart voice fires for every spot the chart actually models.

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or prior
  fixes); evidence at `docs/playtest/reviews/iter-09.md`. Verified: `tsc --noEmit`
  clean, ESLint clean, production build clean, **395** tests passing (+10), including a
  guard that a preflop fold card shows no pro-call contradiction while a postflop river
  CALL still shows the pot-odds frame, and that Conceptual depth's Mental Math renders
  no digits. See `docs/pmos/features/2026-06-18_reviewer-iter9-fixes/`.

## [0.13.0] — 2026-06-18

### Reviewer-iteration-8 fixes — bet-sizing sanity, action-correct EV, price-aware bots

An eighth independent first-time-user playtest (`docs/playtest/reviews/iter-08.md`)
found NO major issues — every structural fix held (one consistent win-% per decision,
no false "you already have a hand," legal-only EV tables, clean layout/units/console).
This release clears the remaining minor/polish findings.

### Fixed

- **A grossly under-sized bet is no longer praised as good value.** Betting $2 into a
  $360 pot used to grade "✅ Good · get money in while ahead." A clean bet under ~15%
  of the pot now grades ⚠️ thin (`bet_too_small`) and the copy says the bet is too
  small to charge draws or build the pot — symmetric to the existing oversized-open
  check. Normal 25–33%-pot small bets are unaffected (`core/analysis/*`).
- **The Mental Math dollar-EV line uses the right verb.** On a value bet it used to
  read "Calling is worth about $X" directly below a "Betting for value" header. It now
  says "Betting is worth…" / "Raising is worth…" when you put money in, and "Calling
  is worth…" only when facing a bet (`components/MentalMathSection.tsx`).
- **Bots fold trash to gross overbets instead of stacking off.** The opponents'
  loose call-down is now price-aware: the calling-station tendency tapers to zero as
  the price worsens (full at ~half-pot, gone by a ~1.5× overbet), so five bots no
  longer cold-call a 30 BB open or stack off 100 BB with bottom pair. Calling stations
  still call normal ~half-pot bets loosely — they weren't turned into nits
  (`core/bots/botEngine.ts`).
- **Plain-words mode stays plain.** At Conceptual depth the Mental Math drawer no
  longer surfaces the "Rule of 2 & 4" jargon or the Preflop Chart reference; both are
  kept at Equity/Strict depth (`components/MentalMathSection.tsx`).

### Changed

- **Equity depth says "the standard play," not "the baseline chart."** Explicit chart
  citations are now reserved for Strict charts depth (which keeps its chart badge); the
  Equity + Heuristics copy refers to the standard play without naming a chart
  (`core/analysis/explain.ts`; demo fixtures refreshed to match).
- **Hand review disambiguates two actions on one street** — a second action on the
  same street now reads "Turn — you then called $54" (`components/HandRecap.tsx`).

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or prior
  fixes); evidence at `docs/playtest/reviews/iter-08.md`. This was the first playtest
  to surface zero major issues. Verified: `tsc --noEmit` clean, ESLint clean,
  production build clean, **385** tests passing (+13), including under-size-bet cases,
  a bet-EV-verb test, and bot price-awareness tests that confirm calling stations still
  call normal-sized bets loosely (50-seed assertion) while folding trash to overbets.
  See `docs/pmos/features/2026-06-18_reviewer-iter8-fixes/`.

## [0.12.0] — 2026-06-18

### Reviewer-iteration-7 fixes — one win-% per decision, hole-card-aware made hands

A seventh independent first-time-user playtest (`docs/playtest/reviews/iter-07.md`)
confirmed the structural wins held (layout clean at every window size, board matches
the street, BB/$ reconciles everywhere, verdict tags match the action/street, no
"-$0", no spelling errors, console clean) and surfaced one deeper theme: the Mental
Math block was reasoning from a *different* equity number than the verdict, so a
single panel could show two contradictory win-percentages and call a board-only pair
"your" hand. All fixed at the root. Coaching-analysis + UI only; no `HandRecord`
schema-version change.

### Fixed

- **One win-percentage per decision.** The Mental Math block used to run its own
  equity Monte Carlo with a different opponent basis than the verdict, so the panel
  could read "You win ~35% / thin" directly above "True win ≈ 64% / you're often
  ahead." Mental Math now reads the verdict's own equity (`analysis.numbers.
  equityPct`) for its true-win figure, Step-6 conclusion, gap explanation, and dollar
  EV — the second Monte Carlo is gone, so the two numbers can never drift
  (`components/{FeedbackPanel,MentalMathSection}.tsx`).
- **A board-only pair is no longer called "your" made hand.** Holding 6♠J♥ (just
  J-high) on a 8♦8♣Q♦ board used to say "you already have a pair, so you're often
  ahead" — at ~3% equity — because the evaluator saw the board's pair of eights.
  `detectMadeHand` now credits a made hand only when the hero's hole cards actually
  improve on the board alone, so "playing the board" no longer reads as a made hand.
  (This also flows into the bet verdict: such a hand correctly grades as a bluff
  again, since the hero truly has nothing) (`core/mental/estimate.ts`).
- **"Often ahead" tracks the real equity.** The made-hand "you're often ahead" line
  now only appears when the win-chance is actually high (≳55%). Top pair at ~35%
  multiway now reads "you have top pair, but with N players still in you're only
  ~35% to win — it's marginal, not a sure lead," matching the verdict instead of
  contradicting it (`components/MentalMathSection.tsx`).
- **Honest pending copy.** The "Deciding your <street>…" card no longer promises
  "the numbers below (Mental Math)" when no Mental Math block is shown there; it now
  says the verdict, equity, and math appear once you act
  (`components/RightPanel.tsx`).

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or
  prior fixes); evidence at `docs/playtest/reviews/iter-07.md`. The reviewer
  explicitly confirmed every prior structural fix held. Verified: `tsc --noEmit`
  clean, ESLint clean, production build clean, **372** tests passing, including a
  Mental-Math-equals-verdict-equity test and hole-card-participation cases for
  `detectMadeHand`. Cross-checked both reported scenarios (J-high on a paired board
  at ~3%; top pair at ~35% multiway): the verdict, equity bar, Mental Math true-win,
  made-hand line, gap explanation, and dollar EV now all show one consistent win-%
  and never claim a lead the equity contradicts. See
  `docs/pmos/features/2026-06-18_reviewer-iter7-fixes/`.

## [0.11.0] — 2026-06-18

### Reviewer-iteration-6 fixes — a made hand is never a "bluff", honest sizing & EV labels

A sixth independent first-time-user playtest (`docs/playtest/reviews/iter-06.md`)
confirmed the structural wins held — the table scales cleanly at every window size,
the board always matches the street being decided, BB/$ reconciles everywhere, and
the decision-not-outcome framing prevents win-vs-verdict contradictions. It surfaced
one real correctness bug plus polish. All fixed. Coaching-analysis + UI only; no
`HandRecord` schema-version change (additive optional fields).

### Fixed

- **A made hand is never called a "bluff with no equity."** Betting two pair
  (4♠2♠ on a 3♠4♣3♦ flop) used to be graded "❌ Mistake · bluff no equity" because
  the aggression verdict keyed purely on a low equity number — which is genuinely
  low multiway against five all-in players, but the hand is a made value hand, not
  a bluff. The verdict now factors in the made hand (via the existing pure
  `detectMadeHand`): a low-equity bet/raise WITH a made hand grades ⚠️ thin
  (`made_hand_thin_value`) and the copy names it as a value bet with showdown value
  — no "bluff"/"no equity"/"nothing behind it." A genuine no-made-hand low-equity
  bet still grades ❌ and is still called a bluff (`core/analysis/{analyze,explain,
  conceptTags}.ts`; hero cards threaded additively through `core/handFlow.ts`).
- **Absurd preflop open sizes are no longer praised as "standard."** A ~52 BB
  open (half stack) used to be graded "✅ Good · the standard, profitable play." A
  first-in open of ≥10 BB now grades ⚠️ thin (`preflop_oversize`) and the copy
  flags that the SIZE is far larger than a standard open — the decision to raise can
  be right, the sizing isn't. Normal 2–4 BB opens are unaffected (`core/analysis/*`).
- **EV "Show the numbers" table lists the right actions for the spot.** After a
  preflop open-raise it no longer offered phantom "if you check / if you bet" rows;
  it now shows fold/raise (facing a bet → fold/call/raise; unopened postflop →
  check/bet) (`components/FeedbackPanel.tsx`).
- **"beting" → "betting"** in the Conceptual feedback copy (`core/analysis/explain.ts`).
- **No more "-$0".** Amounts that round to zero render as "$0" / "0 BB" with no
  stray minus sign (`core/money.ts`).
- **Essentially-breakeven calls grade ⚠️ thin, not ❌ mistake.** The price-branch
  "thin" band widened to within ~2 points of breakeven; clearly -EV calls stay
  mistakes (`core/analysis/analyze.ts`).

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or
  prior fixes); evidence at `docs/playtest/reviews/iter-06.md`. The reviewer
  explicitly confirmed: layout clean at all five window sizes (the scale-to-fit
  table held), board cards always match the street, units reconcile everywhere, no
  win-vs-verdict contradictions, console clean. A prior playtest (iter-05) had hit a
  corrupted dev-server build (all JS/CSS bundles 404'd → nothing hydrated); that was
  an environment issue, resolved by a clean `.next` rebuild, and produced no product
  changes. Verified: `tsc --noEmit` clean, ESLint clean, production build clean,
  **363** tests passing, including made-hand-value-vs-bluff cases, oversize-open
  cases, and EV-row-label cases. Confirmed the made-hand bet's verdict, tag,
  explanation, and EV table now all agree (no residual "bluff" wording). See
  `docs/pmos/features/2026-06-18_reviewer-iter6-fixes/`.

## [0.10.0] — 2026-06-18

### Reviewer-iteration-5 fixes — scale-to-fit table, honest multiway equity, BB everywhere

A fifth independent first-time-user playtest (`docs/playtest/reviews/iter-04.md`)
confirmed the v0.9.0 regressions stayed fixed (the board shows the street you're
deciding; no win-vs-verdict contradictions; tags match the action) and surfaced a
fresh layer — the long-standing small-window layout break, a mislabeled equity
number, and units that didn't fully follow the BB/$ toggle. All addressed. UI +
coaching-copy only; no `HandRecord` schema-version change (one additive optional
field).

### Fixed

- **The table never overlaps itself at any window size (the 800×600 demon, fixed
  for real).** Prior rounds positioned seats by percent but the seat tiles were
  fixed-pixel, so on a short, narrow window the hero "You" seat grew to cover the
  center "Pot" readout. The table interior now renders at a fixed 760×520 design
  box and is uniformly `transform: scale()`-d to fit its container
  (`useFitScale` + a `ResizeObserver`). Because the whole table scales as one
  rigid unit, elements that don't overlap at full size can't overlap at any
  smaller size — so every window size is safe, not just the ones we happened to
  test. Action buttons stay outside the scaled box at full, tappable size
  (`components/table/PokerTable.tsx`).
- **Honest preflop equity label.** The live verdict used to say e.g. "~31%
  against a random hand" — but that 31% is the multiway number (vs the other
  players still in), while "a random hand" implies heads-up (where the same hand
  is ~85%), contradicting the References chart's own 1-on-1 figure. It now reads
  "~N% to win against the N opponents still in," so the live number and the
  teaching chart no longer appear to disagree (`core/analysis/explain.ts`).
- **BB mode is now BB everywhere — including the explanation sentences.** Toggling
  to BB used to convert seats, pots, and headers but leave the plain-math
  sentences in dollars (e.g. "you called 54 BB" directly above "it costs you $108
  to win a $560 pot"). The live-feedback and hand-review sentences now render in
  the chosen unit ("54 BB to win a 280 BB pot"). The canonical dollar sentence is
  still stored in the hand record for the coach (additive `explanationInput` on
  the analysis; new pure `formatExplanation`) (`core/analysis/*`,
  `components/{FeedbackPanel,HandRecap}.tsx`).
- **"raiseing" → "raising".** The preflop verdict built the verb naively; a small
  verb map now yields raising / calling / folding (`core/analysis/explain.ts`).
- **"Unlucky — variance" footer only fires when you actually contested the hand.**
  It used to appear on any losing hand with no flagged mistakes — including
  folding a trash hand for just the blind, which is no bad beat. It now requires
  that you played past preflop or voluntarily put money in
  (`components/HandRecap.tsx`).

### Changed

- **Coaching depth stays in its lane.** The "chart-based" badge is now shown only
  in Strict charts mode; Equity + Heuristics leads with the win-rate (the text may
  still note the chart agrees — honesty preserved), and Conceptual stays plain
  (`components/{FeedbackPanel,HandRecap}.tsx`, `core/analysis/explain.ts`).
- **Conceptual copy varies by action** (a raise vs a bet no longer get the
  identical sentence) (`core/analysis/explain.ts`).

### Engineering notes

- Found by an **independent, context-free** reviewer (no memory of the design or
  prior fixes); evidence at `docs/playtest/reviews/iter-04.md`. The reviewer's
  reported console ReferenceErrors were re-verified as stale hot-reload artifacts —
  there is no `setState`-in-render and no out-of-scope identifier in the shipped
  components, and `npm run build` compiles clean. One finding (a top-pair verdict
  reading "thin" on the flop but "value" on the turn) is correct poker and was
  intentionally left as-is; each verdict already names the street it judges.
  Verified: `tsc --noEmit` clean, ESLint clean, production build clean, **350**
  tests passing (+15), including a scale-to-fit math test and BB-sentence tests.
  The implementer ran an explicit no-new-contradiction self-check (equity bar vs
  sentence draw from the same number; multiway count reconciles with References by
  design). True pixel layout verification at 800×600 is the next fresh-reviewer
  playtest. See `docs/pmos/features/2026-06-18_reviewer-iter5-fixes/`.

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
