# Spec + Plan — Reviewer iteration-19 fixes

Tier 1. Combined design + task breakdown for three MINOR copy/presentation items plus one NIT polish
item. Edits live in `components/MentalMathSection.tsx`, `components/HandRecap.tsx`, and
`components/FeedbackPanel.tsx`. No `core/analysis/*` change, no EV/equity/pot-odds computation change,
no `HandRecord` schemaVersion bump (all four are component-render-only).

## Design decisions

### FR-1 Good-check dollar-EV line endorses checking (`MentalMathSection`)

- **Mechanism.** `TrueEquityCheck` gains a `heroChecked` prop, set true by the parent when
  `frozen.heroAction === "check"` and `toCall <= 0` (the same condition the `noDrawSummary` good-check
  flag already uses). It's threaded into every `TrueEquityCheck` call site (the `river`, `no-draw`, and
  `Steps` branches) via a single `heroChecked` value computed once in `MentalMathSection`.
- When `heroChecked && actionEv` is present, the dollar-EV note renders "Checking is worth about
  {ev.call} on average — more than betting ({ev.raise}) — so checking is right (based on the true
  equity)." Both figures are the SAME `numbers.ev` rows the "Show the numbers" check/bet rows show
  (`ev.call` is the CHECK row on a free street). Otherwise the existing single-action wording stays
  (`"Betting"`/`"Calling"` with the matched row, iter-08 #2 / iter-14 #8 preserved).
- **Why safe.** Conceptual still renders nothing (the section returns null before this). A BET on a free
  street (`heroAction === "bet"`) keeps `heroChecked` false → unchanged "Betting is worth …". A CALL
  (toCall > 0) keeps "Calling is worth …".

### FR-2 Conditional "loses money on average" recap claim (`HandRecap`)

- **Mechanism.** Two helpers: `chosenActionEv(d)` reads the chosen action's row from
  `d.analysis.numbers.ev` (bet/raise→`ev.raise`, call/check→`ev.call`, fold→`ev.fold`); `isOversizedPlay(d)`
  checks `conceptTags` against `OVERSIZE_TAGS = [preflop_oversize, oversize_bet, oversize_no_value]`.
- The won-but-flagged reconcile branch (`heroNet >= 0 && flagged`) reads the most-severe flagged
  decision (`leak`, already computed). `sizingFraming = isOversizedPlay(leak) && chosenActionEv(leak) >= 0`.
  - **sizingFraming true:** "…flags a play whose size risked far more than it could win — it worked
    against these players, but it's a reckless size you can't rely on; we grade the decision, not the
    outcome." (No "loses money on average".)
  - **else:** the existing "…flags a play that loses money on average; … we grade the decision, not the
    outcome."
- **Why safe.** `HandRecap.counts()` still buckets off `analysis.verdict`, so the play is STILL tallied
  a mistake and still flagged — only the EV-claim sentence changes. A no-equity bluff (negative `ev.raise`,
  no oversize tag) keeps the accurate "loses money on average".

### FR-3 Strict shows the equity bar + numeric EV like Equity (`FeedbackPanel`)

- **Mechanism.** One-line gate change: `showEquity = depth === "equity"` →
  `depth === "equity" || depth === "strict"`. That single flag gates the equity bar, the win-% line, the
  why-line, the assumed-range note, and the "Show the numbers" EV table — so all of them now render for
  Strict too. Mental Math already renders for Strict (gated only on conceptual). Conceptual is unchanged
  (`showEquity` false there) and stays fully digit-free.
- **Why safe.** Strict's plain sentence already shows inline `~%`/`~×` (only `explain.ts` `conceptual`
  goes digit-free), so showing the bar is consistent, not a new digit leak. The off-model note and
  "chart-based" badge logic are independent and unchanged.

### FR-4 Merge same-street recap rows (`HandRecap`)

- **Mechanism.** `groupBySameStreet(decisions)` folds consecutive same-street decisions into one group.
  Each group renders ONE `recap-decision` `<li>`: a single street label, the merged action verbs as one
  contiguous text node ("checked, then folded to a bet"), and each decision's explanation below (prefixed
  with its own verdict icon when the group has >1 decision so per-action grades stay visible). A fold
  following another same-street action faced a bet → "then folded to a bet".
- **Why safe.** A single-action street stays a one-item group rendering exactly as before. The pot tag /
  chart-based badge use the first action's analysis. Different streets never merge.

## Tasks

1. `MentalMathSection`: add `heroChecked` prop + good-check EV branch; thread it through all three
   `TrueEquityCheck` call sites and `Steps`. Test: good-check EV line names the check value and reads as
   endorsing the check; a BET still says "Betting is worth …".
2. `HandRecap`: add `chosenActionEv` + `isOversizedPlay`; branch the reconcile note on EV sign. Test:
   non-negative oversized flagged win uses sizing framing (no "loses money"); negative-EV flagged win
   keeps "loses money on average".
3. `FeedbackPanel`: widen `showEquity` to include strict. Update the existing Strict test (it asserted
   no `%`); add Strict-shows-equity-bar / Conceptual-stays-digit-free tests.
4. `HandRecap`: `groupBySameStreet` + merged rendering. Re-point the iter-08 "then" test to the merged
   shape; add a check-then-fold merge test + a different-streets no-merge test.

## Verification

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — all green. Manual self-review of the
four reviewer repros confirmed.

## Tests changed (and why)

- `FeedbackPanel.test.tsx` — the iter-03 "Strict: …not a bare equity %" test asserted Strict shows no
  `%`; FR-3 deliberately makes Strict show the equity bar + numbers, so the assertion is re-pointed to
  "Strict shows the chart citation AND the equity bar" (the inline-numbers-in-sentence behavior the
  reviewer accepted is unchanged).
- `HandRecap.test.tsx` — the iter-08 "disambiguates a 2nd same-street hero action with 'then'" test
  asserted two separate rows with a "you then called" header; FR-4 merges them, so it's re-pointed to
  "merges two same-street actions into one row with a ', then' continuation" (one `recap-decision` item).
