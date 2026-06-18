# Spec + Plan — Reviewer iteration-13 fixes

Tier 2. Combined design + task breakdown. One MAJOR (a free-street Mental-Math contradiction), two
MINORs (gross-overbet grading + in-play depth/feedback controls), plus copy/positivity NITs. No
`HandRecord` schemaVersion change — `overbetPotMultiple` on `ExplanationInput` is an additive optional
field the schema validator ignores; the hero action threaded into Mental Math is presentation-only.

## Design decisions

### FR-1 Free-street Mental Math agrees with the hero's actual action (#1) — MAJOR
- Root cause: `core/mental/estimate.ts` `conclusionFrom(...)` returned "It's a free card — just take it"
  whenever `toCall <= 0`, no made hand, and `betBeatsCheck` false — without knowing the hero ALREADY
  BET. `MentalMathSection` Step 5 hardcoded "It's free to see the next card — no price to pay." So a
  ❌-graded -EV semi-bluff bet sat above a present-tense "take the free card" check instruction.
- Fix (`core/mental/estimate.ts`): add optional `heroBet?: boolean` to `conclusionFrom`. On the free
  street / no-made-hand / `!betBeatsCheck` branch, when `heroBet` is true return a RECONCILING sentence
  (`profitable: false`): "You bet as a semi-bluff with only ~X% and no made hand — with this little
  equity, checking to take the free card would have been the cheaper line." When `heroBet` is false keep
  "It's a free card — just take it." The `betBeatsCheck` +EV and made-hand branches return BEFORE this,
  so they're unchanged.
- Fix (`components/MentalMathSection.tsx`): `FrozenDecisionContext` gains optional `heroAction?:
  HeroAction | null`; `MentalMathSection` derives `heroBet = frozen?.heroAction === "bet" | "raise"` and
  threads it into `Steps` → `conclusionFrom`. Step 5's free-card copy branches on `heroBet`: when the
  hero bet, "No bet faced you, so a check would have been free — but you chose to bet."
- Fix (`components/FeedbackPanel.tsx`): `frozenMentalContext` carries `heroAction: ei.action`.
- Tests (`core/mental/estimate.test.ts`): hero BET low-equity no-made-hand → reconciles (mentions the
  bet, "cheaper", not "just take it", `profitable:false`); hero CHECKED same spot → keeps free-card
  line; `heroBet` does NOT override the made-hand value path nor the `betBeatsCheck` +EV path.
  (`components/MentalMathSection.test.tsx`): rendered Step 6 reconciles on a frozen BET, keeps the
  free-card line on a frozen CHECK; Step 5 shows "you chose to bet" on a bet.

### FR-2 Gross-overbet SIZE flag for non-open raises + postflop bets/raises (#2) — MINOR
- Root cause: the only oversize check (`isOpen` in `route`) covered a first-in preflop OPEN sized in big
  blinds. Non-open raises and postflop overbets weren't size-checked.
- Fix (`core/analysis/conceptTags.ts`): add `oversize_bet` (additive; distinct from `preflop_oversize`).
- Fix (`core/analysis/analyze.ts`): compute `betPotMultiple = raiseToAmount / potBefore` for ANY
  bet/raise. `GROSS_OVERBET_POT_MULTIPLE = 5` (conservative: pot-sized bet ≈ 1×, standard 3-bet/4-bet ≈
  2× the small preflop pot, forced short-stack shove ≈ 1× — so 5× only catches absurd overbets; a 92-into-7
  shove ≈ 13–26×). New `withGrossOverbet(branch, mult)` helper: if `mult >= 5`, append `oversize_bet`,
  downgrade a ✅ to ⚠️ thin (an already-flagged thin/❌ keeps its severity), set `flagGrossOverbet` +
  `overbetPotMultiple`. Applied to NON-open preflop raises (the open keeps its BB-based flag, no
  double-flag) and to postflop bets/raises that aren't already undersized.
- Fix (`core/analysis/types.ts` + `explain.ts`): add optional `overbetPotMultiple` to `ExplanationInput`
  + `ExplainParams`; thread through `formatExplanation`. `overbetClause(mult, noun, conceptual)` builds
  "…but shoving ~Nx the pot risks a huge amount to win a tiny pot — size down" (plain words, no digits,
  at conceptual). The `aggression`, `preflop`, and `conceptual` builders keep the DIRECTION read (based
  on equity, not the downgraded verdict) and append the clause.
- Fix (`components/FeedbackPanel.tsx`): `VerdictBadge` shows "Oversized" for `oversize_bet` too;
  `TAG_LABELS.oversize_bet = "Oversized"`.
- Tests (`analyze.test.ts`): a ≥5×-pot postflop overbet and a ≥5× non-open 4-bet flag `oversize_bet` at
  ⚠️ even with good equity; a standard 3-bet, a forced short-stack all-in (~1.3× pot), and a pot-sized
  bet do NOT flag. (`explain.test.ts`): copy keeps "for value with ~70%"/"can be right" + "size down" +
  the pot-multiple; conceptual is digit-free. (`FeedbackPanel.test.tsx`): the "Oversized" badge renders.

### FR-3 In-play coaching depth + feedback controls (#3) — MINOR
- Fix (`components/RightPanel.tsx`): a compact `InPlayControls` row at the top of the live-feedback tab
  — a depth `<select>` (Conceptual/Equity/Strict) and an "Instant feedback" checkbox, both writing
  `useSessionStore().setSettings(...)`. Components already read `coachingDepth`/`feedbackEnabled`, so the
  change re-renders the live feedback immediately and the toggle behaves like the setup-screen one.
  Update the feedback-off copy: "Flip Instant feedback back on above to show it again."
- Tests (`RightPanel.test.tsx`): changing depth in-play to Conceptual hides the equity bar; toggling
  feedback off shows the off-hint and hides the verdict badge, toggling on restores it; controls present.

### FR-4 Step 3 shaded figure always labeled "to hit" (#4) — NIT
- Fix (`components/MentalMathSection.tsx` Step 3): the shaded figure is labeled "to hit your draw" (made
  hand) or "to hit (an estimate — the true win % is below)" (no made hand) — never "to win". "to win" is
  reserved for the single true-equity figure in "Check your work".
- Tests (`MentalMathSection.test.tsx`): with no made hand the shaded figure reads "to hit", and at most
  one figure in the panel is labeled "to win".

### FR-5 Positive reinforcement on a clean hand (#5) — NIT
- Fix (`components/HandRecap.tsx`): when `!flagged` (no ⚠️/❌) and `heroNet > 0`, render `recap-praise`
  "Nicely played — every decision was solid." A clean LOSS keeps the existing variance bridge (gated on
  `heroNet < 0`), so the two never double up.
- Tests (`HandRecap.test.tsx`): a clean all-good WIN shows the praise; any flagged decision suppresses
  it; a clean LOSS shows the variance note, not the praise.

### FR-6 "no equity" wording threshold (#6) — VERIFY (no change)
- Confirmed correct: `bluff_no_equity` (+ "no equity" wording) fires only at `equityPct < NO_EQUITY_PCT`
  (20); ~20–33% is already `bluff_thin_equity` ("light semi-bluff"); "no made hand" is factually accurate
  for air. No code change.

## Excluded (no code change, documented)
- Sub-700/800px legibility — accepted scale-to-fit tradeoff; nothing clipped/overlapping.

## Test / verification plan
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.
- Self-review for new contradictions: (a) on a free street the Mental Math conclusion AGREES with the
  verdict's grade of the hero's actual action (no "just take the free card" under a ❌ bet); (b) a gross
  overbet is flagged while standard 3-bet/4-bet/forced all-ins are not; (c) in-play depth/feedback
  changes take effect immediately without a new session; (d) only one Mental Math figure is labeled "to win".
- Demo fixtures `samples/session-demo/hand-*.json` re-validated by the schema test (additive only; no
  overbet present in fixtures, so they're unaffected).
</content>
