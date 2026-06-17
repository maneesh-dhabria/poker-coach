# Spec + Plan — Reviewer iteration-6 fixes

Tier 2. Combined design + task breakdown. Changes: made-hand awareness in the aggression branch +
copy (#1) and a preflop oversize flag (#3) in `core/analysis/{analyze,explain,conceptTags,types}.ts`,
threaded from `core/handFlow.ts` + `core/playHand.ts`; a "beting"→"betting" present-participle fix
(#2) in `explain.ts`; an EV-row legal-action fix (#4) and the wiring for it in
`components/FeedbackPanel.tsx`; a negative-zero normalization (#5) in `core/money.ts`; a slightly
widened near-breakeven thin band (#6) in `analyze.ts`. No `HandRecord` schemaVersion change — all
new `analyze()` inputs and `explanationInput` keys are additive/optional and the validator ignores
extra keys. Components still read `DecisionAnalysis` as ground truth.

## Design decisions

### FR-1 Made-hand awareness — a made hand is never a "bluff with no equity" (#1) — MAJOR
- Root cause: `aggressionBranch(equityPct)` mapped `equityPct < 33 → bluff_no_equity / mistake` on
  equity alone, so a real made hand (two pair) bet thin into 5 all-ins (~18% multiway) was graded a
  no-equity bluff.
- `analyze()` gains optional `hole` / `board`. It computes `madeHand = detectMadeHand(hole, board)`
  (the existing PURE detector in `core/mental/estimate.ts`; needs a full 5-card combo, so
  preflop/short boards yield `null`). `madeHand` is threaded into `aggressionBranch` and the explain
  builder.
- `aggressionBranch(equityPct, madeHand)`: a low-equity (`< 33`) bet/raise WITH a made hand →
  `verdict: "thin"`, tag `made_hand_thin_value` (a new controlled-vocabulary tag) — value, not a
  bluff. Without a made hand it still → `verdict: "mistake"`, tag `bluff_no_equity`.
- `explain.ts` `aggression()` (equity/strict) and the `conceptual()` aggression branch: when a made
  hand is present at low equity, name it ("You have two pair — a real made hand with showdown value,
  so this is a value bet. But multiway on a dangerous board your ~18% to win is low, so it's a thin,
  vulnerable bet.") — checked BEFORE the generic thin copy so the hand is always named. The copy
  contains neither "bluff" nor "no equity" nor "nothing".
- The made hand is recorded on `explanationInput.madeHand` so `formatExplanation` (the BB/$ re-render
  used by `FeedbackPanel`/`HandRecap`) reproduces the value framing in any unit.
- Consistency check: verdict (⚠️ thin) + tag (`made_hand_thin_value`) + explanation (value bet,
  names the hand) + EV table (an unopened postflop bet → check/bet rows, the alternative to betting a
  made hand) all agree; no residual "bluff" wording anywhere.
- Tests: a made-hand low-equity bet is NOT `bluff_no_equity`, is not "mistake", and its explanation
  (equity + conceptual) names "two pair" and never says "bluff"/"no equity"/"nothing"; a true
  no-made-hand low-equity bet still IS `bluff_no_equity` (existing test updated to a 7-high holding).

### FR-2 "betting", not "beting" (#2) — MINOR
- `explain.ts` `conceptual()` aggression branch built the verb as `\`${act}ing\`` with `act="bet"` →
  "beting". Replaced with an explicit present-participle ("bet"→"betting", "raise"→"raising").
- Grep confirmed "beting"/"raiseing"/"caling" appear nowhere else in source. Test: the conceptual
  low-equity bet copy contains "betting", not "beting".

### FR-3 Flag a grossly oversized preflop open (#3) — MINOR
- `analyze()` gains optional `raiseToAmount` (the raise-TO total) + `bigBlind`. `route()` computes
  `openSizeBb` and, on a first-in OPEN (`action === "raise" && facing === "unopened"`), flags it when
  `openSizeBb >= OVERSIZE_OPEN_BB` (10 BB — a normal open is 2–4 BB, so this never false-positives).
- An oversized open → `preflopBranch` returns `verdict: "thin"`, tag `preflop_oversize` (+
  `preflop_chart_deviation` if the action class also deviates), `flagOversize: true`. The verdict no
  longer reads "the standard, profitable play".
- `explain.ts` `preflop()` and `conceptual()` lead with the size when `openSizeBb` is set: "Raising
  QdTd from UTG can be fine, but 52 BB is far bigger than a standard open (about 2–3 BB) … Size it
  down." Conceptual stays number-free.
- A 3-bet facing a raise is intentionally NOT size-checked by this conservative rule (only first-in
  opens). Tests: a ~3 BB open is unflagged "good"; a ~52 BB open is `preflop_oversize`, not "good",
  and its copy doesn't say "standard, profitable play".

### FR-4 EV table reflects the legal action set (#4) — MINOR
- `FeedbackPanel.tsx` `evRows(ev, facingBet, preflopOpen)`: facing a bet → fold/call/raise; a preflop
  first-in open-raise (no bet to call) → fold/raise (no phantom "check"); an unopened postflop spot →
  check/bet (no fold when checking is free). `preflopOpen = !facingBet && isAggressive &&
  context.street === "preflop"`.
- Tests: a preflop open-raise EV table has no "check" and no "call" row and labels the aggressive
  option "raise"; the existing iter-03 #8 case (no phantom "call") is re-pointed at a true CHECK spot
  (was an `action:"bet"` spot — conflating a bet action with a check spot, the very bug #4 fixes).

### FR-5 Normalize negative-zero money (#5) — NIT
- `core/money.ts`: a magnitude that rounds to zero renders "$0" / "0 BB" (no leading "-"). The sign
  is dropped once the displayed whole/rounded value is zero. Test: `-0.3 → "$0"`, `-0 → "$0"`,
  `-0.05 bb → "0 BB"`.

### FR-6 Near-breakeven call is thin, not a mistake (#6) — NIT
- VERIFIED: the reviewer's BB "mistake" was the PREFLOP CHART branch (chart says fold BB), not the
  price-branch `callBranch` — `callBranch` already grades a +0.5-edge call "thin". To be safe for
  genuinely breakeven price-branch calls, the thin band widened from `edge >= -1` to `edge >= -2`;
  clearly -EV calls (`edge < -2`) stay mistakes. Existing `callBranch` boundary tests still pass
  (the -8.7 and +1 cases are unaffected). Test: a +0.5 and a -1.5 edge call grade thin; a -8.7 edge
  stays mistake.

## Task list (TDD where it fits)
1. Made-hand aggression awareness + copy (FR-1) — `conceptTags.ts`, `analyze.ts`, `explain.ts`,
   `types.ts`; thread `hole`/`board` from `handFlow.ts` + `playHand.ts`; extend `analyze.test.ts` +
   `explain.test.ts` (update the existing no-equity-bluff test to a no-made-hand holding).
2. "betting" verb fix (FR-2) — `explain.ts`, extend `explain.test.ts`.
3. Preflop oversize flag (FR-3) — `analyze.ts`, `explain.ts`, `conceptTags.ts`, `types.ts`; thread
   `raiseToAmount`/`bigBlind` from the callers; extend `analyze.test.ts` + `explain.test.ts`.
4. EV legal-action rows (FR-4) — `FeedbackPanel.tsx`, update/extend `FeedbackPanel.test.tsx`.
5. Negative-zero money (FR-5) — `core/money.ts`, extend `money.test.ts`.
6. Near-breakeven thin band (FR-6) — `analyze.ts`, extend `analyze.test.ts`.
7. Gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green/clean.

## Tests changed (not weakened)
- `analyze.test.ts` — "flags betting with no equity as a no-equity bluff" now passes a no-made-hand
  holding (7c2d on AhKdQs9h) so it stays a valid TRUE-bluff case under the new made-hand-aware branch.
  Intent unchanged (a genuine no-equity bluff is still a `bluff_no_equity` mistake).
- `FeedbackPanel.test.tsx` — the iter-03 #8 "unopened spot has no 'call' row" case was re-pointed
  from an `action:"bet"` spot to a true `action:"check"` spot. The original conflated a bet action
  with a check spot (the bug #4 corrects); the no-phantom-"call" intent is preserved and now tested
  on the spot it actually describes.
- Demo fixtures `samples/session-demo/hand-{2,3,4}.json` were regenerated by the schema test: an
  additive `explanationInput.madeHand` now records the detected made hand on the relevant decisions.
  Verdicts/explanations are unchanged; all four still validate. Expected (the app↔coach contract).
