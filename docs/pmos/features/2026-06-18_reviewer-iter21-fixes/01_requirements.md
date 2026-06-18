# Requirements — Reviewer iteration-21 fixes

**Tier:** 2 (one MINOR copy-quality gap + five NITs; no MAJORs — a clean round).
**Source:** `docs/playtest/reviews/iter-21.md` — an independent, context-free first-time-user playtest of
build v0.25.0. The large `## POSITIVES` list (words-and-numbers always agree, depth control takes from
the first decision in all 3 modes, Conceptual fully digit-free, EV/verdict agreement, honest range
caveats, correct side-pot math, slider capped at the effective stack, the recap naming the right leak,
References tab, rebuy realism, clean responsive reflow at 1366/1280/800/600) must **not** regress.

Every item lives in the copy / UI-polish / display layer. The math (equity / EV / pot odds), the verdict
bucketing, the side-pot/engine logic, and the `HandRecord` schemaVersion are **not** touched. The two
additive helpers (`core/charts/preflop.cellRationale`, `components/table/Seat.shouldRevealHoleCards`) are
pure presentation predicates; the one additive analysis-copy branch reuses fields already on
`ExplainParams`.

## Problem

- **MINOR — Conceptual preflop "mistake" copy is vague and doesn't teach.** Repro (Hand 3): at Conceptual
  depth, raising Q8o UTG was graded "❌ Mistake / Your preflop decision: **This differs from the standard
  baseline line for this spot.**" — a beginner learns nothing. The SAME session's flop fold gave a clear,
  digit-free reason ("Your hand wins too rarely to call this price…"), so Conceptual quality is
  INCONSISTENT: the preflop path is the weak link.
- **NIT 1 — Stale quick-size highlight.** Click a quick-size button (½/¾/Pot), then drag the slider off
  that value — the button stays highlighted though the size no longer matches.
- **NIT 2 — UTG chart small-pairs surprise.** The UTG opening chart folds 22/33/44 but opens 55-77 (A5s as
  a bluff). Defensible (a tighter house chart), but a knowledgeable user is surprised; no rationale shown.
- **NIT 3 — Cramped table at ~700px.** At ~700px the oval shrinks to ~213×146 and seat boxes to ~34×34 —
  functional, no overlap, but cards/seat text are tight.
- **NIT 4 — Feedback block doesn't fill the panel in single-column.** The Live Feedback verdict block (a
  fixed ~420px element) doesn't stretch to fill the wider panel (~568px), leaving right-side whitespace.
- **NIT 5 — Showdown reveals folded players' hole cards.** The reviewer saw all bots' cards exposed at
  hand end, including players who folded; real poker only shows cards that reach showdown.

## Findings → requirements

| # | Sev | Finding | Requirement |
|---|-----|---------|-------------|
| MINOR | MINOR | Conceptual preflop deviation copy is the generic "differs from the standard baseline line". | COPY (`explain.ts` conceptual preflop-chart deviation branch): replace the generic line with a plain, **digit-free** reason derived from fields already on the input — the position label + the direction of the deviation. Too-loose open (chart fold, hero played on) → "too weak to raise from early position…". A hand the chart opens but the hero folded → "strong enough to play from here — folding gives up a profitable raise". A raise-vs-call aggression mismatch → a plain "raise, not just call" reason. Verdict/severity unchanged; Equity/Strict copy unchanged; stays strictly digit-free. |
| 1 | NIT | Stale quick-size highlight. | UI STATE (`ActionBar`): derive each quick-size button's "active" highlight from `amount === quickTo(fraction)` (exact match — sizes are integers), not a remembered last-click. Dragging the slider / typing to a non-matching value clears the highlight automatically. Expose via the shared Button `selected` affordance + `aria-pressed`. |
| 2 | NIT | UTG small-pair fold surprises a user. | COPY + HELPER (`core/charts/preflop.cellRationale` + `PreflopChartTab`): add a pure helper returning a short plain rationale for a small pocket pair the chart **folds** from an early position (UTG/MP), "" otherwise. Render it in the detail card. Chart RANGE and every raise/fold classification are unchanged. |
| 3 | NIT | Table cramped at ~700px. | LAYOUT (`PokerTable`): floor the scale-to-fit at a readable minimum (`MIN_TABLE_SCALE`) so seats/cards stay legible; size the felt wrapper to the scaled dimensions and let the stage scroll (`overflow:auto`) only when the floored box exceeds a genuinely tiny/short viewport. Wider praised layouts stay above the floor → no scrollbars, no change. `fitScale` (and its tests) unchanged; the floor lives in a new `readableScale`. |
| 4 | NIT | Feedback block leaves whitespace in single-column. | CSS (`FeedbackPanel`): `width:100%` with a `max-width` cap (640) so the verdict block fills the wider single-column panel; the two-column rail is ≤420px so it just fills the rail unchanged. |
| 5 | NIT | Showdown reveals folded players' cards. | DISPLAY (`components/table/Seat.shouldRevealHoleCards` predicate + render guard): reveal hole cards only for the hero or an opponent who did **not** fold (reached showdown with cards present). A folded opponent stays face-down/mucked even if cards are attached upstream. Pure, display-only; no change to who wins or pot math. (The upstream `handFlow.tableView` already only attaches cards to showdown contenders; the predicate makes the intent explicit and is a belt-and-braces guard at the render layer.) |

## Honesty / architecture invariants (unchanged)

- `core/analysis/*` remains the single source of verdict/equity/kind/conceptTag; the MINOR is copy-only
  (it re-words an existing deviation branch using inputs already present, never changes the verdict or
  severity). Conceptual stays fully digit-free.
- `core/charts/*` keeps the chart RANGE and every classification; NIT 2 only adds an explanatory note.
- Decision-not-outcome integrity is intact; NITs 3/4/5 are pure layout/display.
- No `HandRecord` schemaVersion change — every change is component-render-only, copy, or an additive pure
  helper. Demo fixtures (`samples/session-demo/`) are unaffected (none carried the old preflop-deviation
  string); the schema test still validates.
