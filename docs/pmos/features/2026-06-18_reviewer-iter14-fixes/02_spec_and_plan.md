# Spec + Plan — Reviewer iteration-14 fixes

Tier 2. Combined design + task breakdown. The headline fix (shared root cause of #1 and #2) makes the
in-play coaching-depth control actually re-grade the hand it sits next to. Plus a postflop overbet
threshold split (#3), a most-severe leak pointer (#4), an iso-raise-over-limpers branch (#5), and four
MINOR/NIT copy/labeling fixes (#6–#10). No `HandRecord` schemaVersion change — the new
`iso_raise_standard` tag and the threaded per-action EV are additive optional fields the validator
ignores; `analyze()` re-run at a new depth produces byte-identical verdict/equity/tags (copy-only).

## Design decisions

### FR-1 / FR-2 In-play depth change re-derives the displayed + recorded analyses (#1, #2) — MAJOR (shared root cause)
- Root cause: coaching depth is baked PER-HAND. `HandFlow` ran `analyze()` once per hero decision at the
  depth passed in `startHand({ coachingDepth })` and stored the result. The iter-13 in-play `<select>`
  only updated `sessionStore.coachingDepth` — it never re-ran `analyze()` for the decision on screen, so
  Conceptual still showed Equity digits (#1) and Strict still looked like Equity with no chart badge /
  off-model note (#2).
- Fix (`core/handFlow.ts`): keep, per decision, the depth-INDEPENDENT `Omit<AnalyzeInput,
  "coachingDepth">` in `analyzeInputs[]`, plus a `currentDepth`. `heroAct` builds the input, pushes it,
  then `analyze({ ...input, coachingDepth: currentDepth })`. New `coachingDepth()` getter and
  `reanalyzeAt(depth): boolean` — a no-op returning `false` when unchanged; otherwise it sets
  `currentDepth` and re-`analyze()`s every recorded `heroDecisions[i]` at the new depth, returning `true`.
  Because `analyze()` uses depth ONLY to pick COPY, the verdict / equity / conceptTags are identical
  across depths (asserted in tests).
- Fix (`store/gameStore.ts`): `setCoachingDepth(depth)` calls `flow.reanalyzeAt(depth)` (guarded for
  flows/mocks without the method); on a real change it refreshes `feedback` to the latest re-derived
  decision and bumps `tick` so the panel re-renders.
- Fix (`components/RightPanel.tsx`): the depth `<select>` `onChange` calls BOTH
  `setSettings({ coachingDepth })` (for FUTURE hands + the live MentalMathSection that reads the setting)
  AND `setCoachingDepth(depth)` (to re-derive the CURRENT hand). So Conceptual is digit-free in-play and
  Strict restores the chart badge / off-model note immediately.
- Tests (`core/handFlow.test.ts`): `reanalyzeAt` switches depth on every recorded decision while keeping
  verdict/equity/tags; a no-op returns `false`. (`store/store.test.ts`): `setCoachingDepth` re-derives
  the recorded decisions + feedback, preserving the verdict. (`components/RightPanel.test.tsx`): the
  in-play depth test now drives a REAL `HandFlow` (one recorded decision) and asserts the displayed copy
  switches when depth changes (Conceptual hides digits).

### FR-3 Separate, lower POSTFLOP overbet threshold (#3) — MAJOR
- Root cause: a single 5×-pot gross-overbet threshold (tuned in iter-13 for absurd ~13× preflop shoves)
  was too loose postflop, where ~3–4× the pot is already a stack-risking overbet.
- Fix (`core/analysis/analyze.ts`): split the constant — `POSTFLOP_OVERBET_POT_MULTIPLE = 3` and
  `PREFLOP_OVERBET_POT_MULTIPLE = 8`. `withGrossOverbet(branch, betPotMultiple, threshold)` takes the
  threshold. Preflop non-open raises pass the preflop (8×) threshold; postflop bets/raises pick the
  threshold by street (`street === "preflop" ? PREFLOP… : POSTFLOP…`). A forced short-stack all-in is
  capped by stack (~1× pot) so it never trips either threshold. NB: a preflop non-BB 3-bet is off-model
  (only BB has a vsOpen chart) and routes through the postflop heuristic fallthrough — so that path also
  selects the threshold BY STREET, keeping a normal ~2× preflop 3-bet/4-bet unflagged.
- Fix (`core/analysis/explain.ts`): `overbetClause(multiple, noun, conceptual, marginal=false,
  numOpponents=0)` — when equity is marginal (`50 ≤ eq < 60`) the copy says it "risks your whole stack to
  win a little"; multiway appends "and against N players". The aggression branch computes `marginal` from
  the frozen equity and passes the opponent count.
- Tests (`core/analysis/analyze.test.ts`): a ~4× turn shove with ~53% into two players flags
  `oversize_bet` at ⚠️; a normal preflop 3-bet (~2×) and a forced short-stack all-in do NOT flag.
  (`explain.test.ts`): the marginal/multiway copy renders; conceptual stays digit-free.

### FR-4 The "leak" pointer names the MOST SEVERE flagged play (#4) — MAJOR
- Fix (`components/HandRecap.tsx`): `mostSevereFlagged(decisions)` returns the flagged decision with the
  highest `analysis.severity`, breaking ties by the largest chip swing
  (`Math.max(heroAction.amount, spot.toCall)`). `leakPlayPhrase(d, unit, conceptual)` names it ("your
  turn bet of $185" / digit-free "your turn bet" at conceptual). The `recap-loss-flagged` and
  `recap-reconcile` notes use `{leakIcon} above — {leakPhrase} —` so the actual most-severe play (and its
  ❌/⚠️ icon) is what's highlighted. `leak`/`leakPhrase` are computed AFTER the `conceptual` flag so the
  phrase honors digit-free mode.
- Tests (`components/HandRecap.test.tsx`): a hand with a minor preflop ⚠️ and a severe turn ❌ → the leak
  note names the TURN play with the ❌ icon, not the preflop one; an equal-severity tie breaks to the
  bigger-chip (turn) play.

### FR-5 Iso-raise over limpers of a chart-opening hand is good, not thin (#5) — MAJOR
- Investigation: the chart OPENS KQo from the SB (confirmed via `lookupChart`). In a LIMPED pot the spot
  is "facing unopened with limpers" — the live coach routed it through the postflop heuristic, which
  graded the raise "thin" as if it were an off-chart spew. But raising to isolate limpers with a hand the
  chart opens first-in is a standard, fine play; the chart's verdict assumes FIRST-IN, which limpers break.
- Fix (`core/analysis/analyze.ts`): in `route`, when `isLimpedPot && action === "raise"` and the
  position+hand are a chart OPEN (`chartApplies(position, "unopened")` and `lookupChart(hand, position,
  "unopened") === "raise"`), return `isoRaiseBranch(hand)`: `{ kind: "isoraise", gtoClaim: false, verdict:
  "good", severity: 0, conceptTags: ["iso_raise_standard"] }`. Off-model (`gtoClaim: false`) because
  limpers aren't chart-modeled.
- Fix (`core/analysis/conceptTags.ts`): add `iso_raise_standard`. (`types.ts` + `explain.ts`): add the
  `"isoraise"` kind; `isoRaise(p)` copy: "Raising … here is a fine, standard play. The Preflop Chart
  assumes you're first in, but here there are limpers — so this is an isolation raise…", with a digit-free
  conceptual variant.
- Fix (`components/FeedbackPanel.tsx`): `TAG_LABELS.iso_raise_standard = "Isolation raise"`.
- Tests (`analyze.test.ts`): a SB raise over a limper with KQo grades good with `gtoClaim:false` and the
  `iso_raise_standard` tag; an off-chart hand in the same spot does NOT take the iso branch.
  (`explain.test.ts`): the iso copy explains the limpers difference. (`FeedbackPanel.test.tsx`): the
  "Isolation raise" label renders and no "thin" badge appears.

### FR-6 Pair-rank label by distinct-board-rank position (#6) — MINOR
- Fix (`core/mental/estimate.ts`): `distinctDesc = unique board rank-values, descending`; `idx =
  indexOf(paired)`; `idx <= 0` → "top pair"; `idx / (n-1) > 0.5` → "bottom pair"; else "middle pair". So 4
  among {A,6,4,2} (idx 2 of 4 → 0.67) → "middle pair"; a paired lowest card on a 3-distinct board → "bottom".
- Tests (`estimate.test.ts`): T4 on A,6,2,4 → "middle pair"; a genuinely lowest pair → "bottom pair".

### FR-7 Action-aware no-draw summary (#7) — MINOR
- Fix (`core/mental/estimate.ts`): the no-made-hand/no-draw summary branches on `toCall`: facing a bet
  (`toCall > 0`) → "…calling here just pays off with little equity."; free street → "…you'd be betting as
  a bluff or giving up."
- Tests (`estimate.test.ts`): a CALL spot mentions "calling", not "betting as a bluff"; a free street
  keeps the bluff/give-up wording.

### FR-8 Dollar-EV note uses the row matching the action (#8) — MINOR
- Fix (`components/MentalMathSection.tsx`): thread `actionEv?: { fold, call, raise }` →
  `MentalMathSection` → `Steps` → `TrueEquityCheck`. The dollar-EV figure is `actionEv.call` when facing a
  bet (`toCall > 0`) and `actionEv.raise` when betting (falls back to the computed estimate when not
  provided). (`components/FeedbackPanel.tsx`): pass `actionEv={ev}`.
- Tests (`MentalMathSection.test.tsx`): with a frozen BET the dollar-EV note shows the BET row figure
  (`ev.raise`), not the CHECK figure.

### FR-9 Verdict chip wording for a chart-on RAISE (#9) — NIT
- Fix (`components/FeedbackPanel.tsx`): `tagLabel(tag, action?)` makes `good_preflop_discipline`
  action-aware — a raise reads "Standard open" / "On-chart"; a fold keeps "Good discipline". The badge
  passes `analysis.explanationInput?.action`.
- Tests (`FeedbackPanel.test.tsx`): a chart-on RAISE shows "Standard open" (no "discipline"); a fold keeps
  "Good discipline".

### FR-10 No preset highlighted until applied (#10) — NIT
- Fix (`components/SetupScreen.tsx`): `presetTouched` state; the selected preset is computed only once
  touched, so nothing is highlighted on load. A preset `onClick` sets `presetTouched`.
- Tests: covered by existing SetupScreen render expectations; no preset is pre-highlighted on first paint.

## Excluded (no code change, documented)
- EV table equal ROUNDED figures — rounding artifact; the dollar-EV note now names the correct row (#8).
- `layout.css` 404 in dev — Next dev source-map probe, no user impact.
- Sub-700px legibility — accepted scale-to-fit tradeoff; nothing clipped/overlapping.

## Test / verification plan
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.
- Self-review for new contradictions: (a) an in-play switch to Conceptual is digit-free and to Strict
  shows the chart badge / off-model note (the displayed AND recorded decisions re-derive); (b) a ~4× thin
  stack-off is flagged and the recap leak pointer names it; (c) an iso-raise over limpers of a chart hand
  is NOT graded thin and the copy explains the limpers difference; (d) the Mental-Math dollar-EV note
  figure matches the action (BET row when betting, CALL row when facing a bet).
- Demo fixtures `samples/session-demo/hand-*.json` re-validated by the schema test (additive only; no
  iso-raise / overbet present in fixtures, so they're unaffected — no schemaVersion bump).
</content>
</invoke>
