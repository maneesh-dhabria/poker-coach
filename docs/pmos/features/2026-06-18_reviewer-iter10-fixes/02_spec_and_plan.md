# Spec + Plan — Reviewer iteration-10 fixes

Tier 2. Combined design + task breakdown. The MAJOR is a presentation-honesty fix on the References
preflop chart (add a Facing selector; replace the misleading BB-unopened all-Fold grid with an
explanatory panel). The rest are surgical copy / ordering / depth-gating / CSS changes. No
`HandRecord` schemaVersion change — all changes are additive copy/display.

## Design decisions

### FR-1 Preflop chart never shows "Fold AA/AKs from BB" (#1) — MAJOR
- Root cause: `PreflopChartTab` hardcoded `facing = "unopened"`. The baseline RFI chart has no BB
  open-first-in range, so `chartAction(combo, "BB", "unopened")` returns "fold" for every hand and the
  grid + detail card print "Fold from BB". The chart DOES model BB-defend-vs-a-raise (`vsOpen.BB`).
- Fix (`components/PreflopChartTab.tsx`):
  - Add a **Facing** `<select>` (state `facing: "unopened" | "raise"`, labels "first in (unopened)" /
    "vs a raise"). It drives `chartAction(repCombo(key), position, facing)` for both the grid and the
    detail card, and the "Pick a hand to see how it plays from {position}" caption.
  - Derive `noOpenRange = position === "BB" && facing === "unopened"` (the one spot the chart has no
    range for — `chartApplies("BB","unopened")` is false). When true, render NEITHER the grid NOR the
    detail card; instead render an explanatory panel (testid `chart-bb-no-open`): "The big blind has no
    opening range here — with no raise to act against, the big blind simply checks its option and sees
    the flop for free. Switch **Facing** to **vs a raise** to see big-blind defense." Selecting Facing =
    vs a raise for BB restores the real `vsOpen.BB` grid (raise/call/fold cells) and detail cards.
  - Honesty: we present the truth (no BB RFI range) rather than fabricate one. Equity-vs-random is
    unchanged; the detail card's win-% line stays for every facing that has a grid.
- Tests (`PreflopChartTab.test.tsx`): with position=BB + unopened facing, the explanatory text renders
  and NO "Fold from BB" detail shows for AA/AKs (the grid is absent); switching Facing to "vs a raise"
  for BB shows real chart actions (AA = raise, a fold-range hand = fold) and a detail card again. The
  existing default-facing tests still pass (default facing is unopened; default position is BTN/known
  seat, both of which DO have an open range).

### FR-2 Mental Math Step 6 matches a bet-or-check spot (#2) — MINOR
- Root cause: the Step-6 heading is the literal "Step 6 · The call" and, on `toCall === 0`,
  `conclusionFrom` returns "It's free to see the next card — take it…" even when the made hand is
  worth betting for value.
- Fix:
  - `components/MentalMathSection.tsx`: the Step-6 heading reads "Step 6 · The decision" when
    `estimate.potOdds.toCall === 0`, else "Step 6 · The call".
  - `core/mental/estimate.ts conclusionFrom` (`toCall <= 0`, made hand, NOT ahead): drop the
    "take the free card" framing — the hero just bet / is being coached to bet a made hand. New copy:
    "You have {label} and win ~{win}% — a thin value bet here, not a check-back." The `ahead` branch
    already says "consider betting for value" (kept, reworded to "betting it for value is right").
  - The genuine no-made-hand check-back (`toCall <= 0`, no made hand) keeps the free-card line.
  - `buildMentalEstimate`'s pre-true-win `decision` (used before equity resolves) gets the same
    treatment for the made-hand `toCall <= 0` case so the fallback never says "take the free card" for
    a made hand worth betting.
- Tests (`core/mental/estimate.test.ts`): `conclusionFrom` with `toCall === 0` + made hand + low win
  contains no "the call"/"take the free card"/"free to see" wording and frames it as a value bet; the
  no-made-hand free-card case still says "free card".

### FR-3 Gross under-sizing flagged even with a made hand (#3) — MINOR
- Root cause: in `aggressionBranch`, the `madeHand && equityPct < 33` branch returns
  `made_hand_thin_value` BEFORE the `undersize` check, so a tiny made-hand bet never reaches it.
- Fix (`core/analysis/analyze.ts aggressionBranch`): when `undersize` is true, return a branch that
  carries BOTH the size critique and the made-hand context — tags `["bet_too_small"]` plus
  `made_hand_thin_value` when a made hand is present, `flagUndersize: true`, verdict ⚠️ thin. Reorder so
  the undersize check runs before the made-hand-only return.
- Copy (`core/analysis/explain.ts aggression()` + `conceptual()`): the `betTooSmall` branch, when a made
  hand is present, names the hand: "You have {label}, but this {noun} is far too small to get value —
  size up." (no made hand keeps the existing under-size copy). `betTooSmall` already takes precedence
  over the made-hand branch, so only the made-hand-aware wording is added.
- Tests (`core/analysis/analyze.test.ts` + `explain.test.ts`): a made hand + tiny bet ($2 into $36)
  yields verdict thin, tags include `bet_too_small`, and the explanation flags the size and names the
  made hand.

### FR-4 Conceptual feedback contains zero digits (#4) — MINOR
- Root cause: `FeedbackPanel.contextLine` prints "pot was $X when you acted"; `HandRecap` prints
  "· pot $X" per decision — both at every depth.
- Fix:
  - `components/FeedbackPanel.tsx`: at conceptual depth render a digit-free context line ("Your {street}
    decision" only, no pot amount).
  - `components/HandRecap.tsx`: omit the "· pot $X" suffix for a decision whose
    `d.analysis.coachingDepth === "conceptual"`. (Per-decision depth, so a mixed-depth session still
    shows amounts on its equity/strict decisions.)
- Tests (`FeedbackPanel.test.tsx`): at conceptual depth the whole card `textContent` matches no digit;
  equity/strict still show the pot amount. `HandRecap.test.tsx`: a conceptual decision row shows no
  "· pot" amount; an equity decision still does.

### FR-5 "Strong hand" not asserted for a marginal made hand (#5) — MINOR
- Fix (`core/analysis/explain.ts conceptual()` aggression `good` branch): replace "Strong hand —
  betting/raising for value is right" with ahead-framed copy: "You're ahead often enough here —
  betting for value is right" (bet) / "You're ahead often enough — raising for value is right; build
  the pot while you're ahead" (raise). Verdict grade unchanged.
- Tests (`explain.test.ts`): a conceptual value-bet "good" no longer contains "strong hand"; still
  praises betting for value.

### FR-6 No-draw preview doesn't over-claim "best hand" with air (#6) — MINOR
- Fix (`core/mental/estimate.ts`, no-draw `plainSummary` ~line 238): when no draw AND no made hand,
  "No clear draw and no made hand yet — you're likely behind, so you'd be betting as a bluff or giving
  up." The made-hand variant ("you already have {label}, so you're often ahead already") is kept.
- Tests (`core/mental/estimate.test.ts`): air → no "best hand" claim, mentions "behind"/"bluff";
  made hand → keeps the "often ahead" phrasing.

### FR-7 Concept-tag chips show clean labels (#7) — NIT
- Fix (`components/FeedbackPanel.tsx tagLabel`): a `TAG_LABELS` map → clean labels for known tags
  (`made_hand_thin_value`→"Thin value", `bluff_thin_equity`→"Light semi-bluff",
  `bluff_no_equity`→"Bluff (no equity)", `preflop_oversize`→"Oversized", `bet_too_small`→"Bet too
  small", `thin_value_good`→"Thin value", `call_too_wide`→"Called too wide",
  `played_too_wide`→"Played too wide", `fold_too_tight`→"Folded too tight",
  `good_preflop_discipline`→"Good discipline", `good_fold_discipline`→"Good fold",
  `preflop_chart_deviation`→"Off the chart", `value_bet_missed`→"Missed value",
  `call_correct_price`→"Right price"); fall back to the prettified slug otherwise. The "Oversized"
  badge special-case in `VerdictBadge` is unchanged.
- Tests (`FeedbackPanel.test.tsx`): a `made_hand_thin_value` decision renders the chip "Thin value"
  (not "made hand thin value"); an unmapped slug still prettifies.

### FR-8 Legibility nudge (#8) — NIT
- (a) Seat/stack text + (b) "$" on action badges: low-risk CSS only. Slightly larger base seat-name /
  stack font in the fixed design box and a clearer/bolder currency glyph on action badges, with no
  geometry change so the scale-to-fit / no-scroll guarantees hold. If any sub-item risks overlap it is
  deferred and documented in the final report.

## Investigate-or-document
- KQo-from-BB "⚠️ Thin ~45%": the `vsOpen.BB.raise` chart range includes KQo, so it grades by the
  chart, not the 45% equity. The 45% multiway figure is honest and the ⚠️ is a thin/marginal note, not
  a mistake. No threshold is clearly wrong → leave as-is, noted here.
- `layout.css` 404: Next.js dev hot-reload stale versioned-chunk request; page is fully styled. No
  runtime/render error → excluded, no code change.

## Test / verification plan
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.
- Self-review for new contradictions: BB chart never shows "Fold AA"; Conceptual feedback zero digits;
  Step-6 never says "THE CALL"/"take the free card" on a `toCall===0` bet spot; tiny made-hand bet
  flagged for size.
- Demo fixtures `samples/session-demo/hand-*.json` re-validated by the schema test (additive only).
</content>
