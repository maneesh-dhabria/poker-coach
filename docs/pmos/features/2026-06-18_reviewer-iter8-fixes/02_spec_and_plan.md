# Spec + Plan — Reviewer iteration-8 fixes

Tier 2. Combined design + task breakdown. Six surgical changes: bet-SIZE awareness on the postflop
value path (#1) in `core/analysis/{analyze,explain,conceptTags,types}.ts`; an action-matched dollar-EV
verb (#2) in `components/MentalMathSection.tsx`; price-aware station call-down (#3) in
`core/bots/botEngine.ts`; depth-gated jargon suppression (#4) in `components/MentalMathSection.tsx`;
"standard play" instead of "baseline chart" at Equity depth (#5) in `core/analysis/explain.ts`; and a
"then" prefix for same-street repeats (#6) in `components/HandRecap.tsx`. No `HandRecord` schemaVersion
change — only an additive optional concept tag and an additive optional `ExplanationInput` field.

## Design decisions

### FR-1 Postflop under-bet awareness (#1) — MINOR
- Root cause: `aggressionBranch` graded purely on equity — a value bet at ≥50% always read "good …
  get money in while ahead", with no awareness of the bet SIZE. Oversized preflop OPENS were already
  flagged (iter-06 #3); under-sizes were not.
- `analyze()` computes `betPotFraction` for a CLEAN bet only (`action === "bet" && toCall === 0`),
  `= raiseToAmount / potBefore`. A raise facing a bet is a more complex sizing question this
  conservative rule deliberately skips. Both callers (`handFlow`, `playHand`) already thread
  `raiseToAmount`.
- `route` passes `undersize = betPotFraction < UNDERSIZE_BET_FRACTION` (0.15) into `aggressionBranch`.
  0.15 is conservative — a standard 25–33% small bet is well above it, so legitimate small bets are
  never flagged; $2/$360 ≈ 0.6% is far below it.
- `aggressionBranch`: after the low-equity (made-hand / bluff) block, an `undersize` value bet returns
  `verdict: "thin"`, `conceptTags: ["bet_too_small"]`, `flagUndersize: true`. The made-hand / bluff
  paths are untouched (size isn't their headline).
- `explain.ts` `aggression()` and the conceptual `aggression` case lead with a `betTooSmall` branch:
  plain "you're ahead, but this bet is far too small — it charges draws almost nothing and barely
  builds the pot. Size up …" — it never says the old "get money in while ahead" praise.
- New surface: `bet_too_small` in `conceptTags.ts`; `betTooSmall?: boolean` on `ExplainParams`
  (explain.ts) and `ExplanationInput` (types.ts), threaded through `formatExplanation` so a
  re-formatted BB sentence still reads "too small". Additive/optional — no schema bump.
- Tests (`analyze.test.ts`): a normal 50%-pot value bet still grades good (no `bet_too_small`); a 25%
  small bet is not flagged; a $2-into-$360 bet grades thin, tags `bet_too_small`, the copy contains
  "too small" and NOT "get money in while ahead".

### FR-2 Dollar-EV verb matches the action (#2) — MINOR
- Root cause: `TrueEquityCheck` hardcoded "Calling is worth about $X" — wrong for a value bet, where
  the verdict header says "Betting for value".
- `evVerb = input.toCall > 0 ? "Calling" : "Betting"`. With a bet to call the hero is calling; with no
  bet to face (`toCall === 0`) the money goes in as a bet, so the EV is the value of betting. The math
  `(trueWin/100) × potAfter − toCall` is identical (`toCall` is 0 for a bet) — only the label changes.
  This tracks the same `toCall` the verdict's branch routing uses, so it can't disagree with the
  header's action verb.
- Tests (`MentalMathSection.test.tsx`): a value BET spot (`toCall: 0`) says "Betting is worth", not
  "Calling"; a facing-a-bet spot (`toCall > 0`) still says "Calling is worth".

### FR-3 Price-aware station call-down (#3) — MINOR
- Root cause in `botEngine.decide()`: `stationSlack = callStation * 0.25` was constant regardless of
  price, and the random light call-down `rng() < callStation * 0.4` fired regardless of how huge the
  bet was. So a max calling-station peeled gross overbets with trash.
- Price-aware slack: `priceFactor` is 1 at `potOdds ≤ 0.34` (≈half-pot or smaller), 0 at
  `potOdds ≥ 0.6` (≈pot-and-a-half overbet), linearly tapering between. `stationSlack =
  callStation * 0.25 * priceFactor` — full looseness vs normal bets, none vs overbets.
- Random light call-down is gated by `potOdds ≤ STATION_PRICE_CAP` (0.5, ≈ up to a pot-sized bet).
  Above that the random peel is switched off entirely, so air folds to an overbet.
- Net: facing a gross overbet (`potOdds ≳ 0.8`) even a max-station folds trash; facing a normal
  ~half-pot bet a station still calls loosely (preserved flavor, not a nit). The strength-based value
  paths (`strength ≥ 0.7`, the pot-odds value-call) are untouched, so genuine value calls still fire.
- Tests (`botEngine.test.ts`): a max-station folds air vs a ~8× overbet across 50 seeds; a max-station
  still calls (loosely) vs a half-pot bet across 50 seeds. The existing 500-hand fuzz + `personas`
  tests stay green (their pots are normal-sized, below the cap).

### FR-4 Depth-gated jargon suppression (#4) — MINOR/NIT
- `MentalMathSection` reads `coachingDepth` from `useSessionStore(s => s.settings.coachingDepth)` and
  derives `conceptual = depth === "conceptual"`.
- The preflop note: at Conceptual it reads "Counting outs is for the flop and turn … There's nothing
  to count before the flop." (no "Rule of 2 & 4", no Preflop Chart tab). At Equity/Strict it keeps the
  original "Rule of 2 & 4 … see the Preflop Chart tab."
- Step 2's "Rule of 2 & 4" right-hand label is hidden when `conceptual`. `conceptual` is threaded into
  `Steps` as a prop.
- Tests: at Conceptual the preflop note contains no "Rule of 2 & 4" and no "Preflop Chart"; a flop
  drawing spot at Conceptual shows no "Rule of 2 & 4" label; at Equity the label is kept.

### FR-5 "Standard play" at Equity depth (#5) — NIT
- `explain.ts` `preflop()` Equity branch: the agree sentence drops "— which is what the baseline chart
  recommends too" → ends "is the standard, profitable play here."; the deviate sentence's
  "(the baseline chart agrees)" → "that higher-EV standard play.". The honest meaning is preserved
  (it IS the standard recommendation); only the non-jargon wording changes. Strict's chart citation +
  badge are untouched; Conceptual is unchanged.
- Tests (`explain.test.ts`): the existing "still names the chart" assertion is updated to assert the
  Equity copy says "standard" and does NOT contain "baseline chart" (legitimate change — the
  requirement reserves chart citations for Strict). A new test checks the deviate sentence too: Equity
  has no "baseline chart", Strict does.

### FR-6 "then" for same-street repeats (#6) — NIT
- `HandRecap` computes `sameStreetAsPrev = i > 0 && decisions[i-1].street === d.street` and prefixes
  the action label with "then " when true → "Turn — you then called $54". Low-risk and clean.
- Tests (`HandRecap.test.tsx`): a turn bet-then-call shows "you then called"; the first action on a
  street gets no "then".

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (385 passing), `npm run build` — all green.
- Demo fixtures (`samples/session-demo/hand-*.json`) still validate (`schema.test.ts` green).
- Self-review cross-checks: the under-size flag never fires on a 25–33% bet; the bot change keeps
  stations calling normal bets loosely (only overbets fold); the EV verb matches the verdict's action
  (both keyed off `toCall`).
