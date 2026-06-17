# Requirements — Reviewer iteration-5 fixes

**Tier:** 2 (bug/enhancement bundle; a decisive responsive-layout rebuild in
`components/table/PokerTable.tsx`, analysis-copy corrections in `core/analysis/*`, and a
display-unit reformat of the explanation sentence threaded into the feedback/recap components)
**Source:** `docs/playtest/reviews/iter-04.md` — an independent, context-free first-time-user
playtest of v0.9.0. The reviewer confirmed the iter-04 regressions are fixed (the board shows the
correct street; no win-vs-verdict contradictions; tags match actions) and praised the teaching
framing, but logged a fresh round of negatives.
**Mode:** non-interactive

## Problem

Three MAJOR issues remain. The most stubborn is a layout break that has survived three prior rounds:
at 800×600 the hero "You" seat tile covers the center "Pot: $X" label. Two analysis-copy issues
actively mislead a newcomer learning the odds: the live preflop verdict labels its MULTIWAY equity
("~31%" for TT) as "against a random hand" — but that singular phrase reads as heads-up (TT is ~85%
vs one random hand), and the app's OWN References chart says TT "wins ~75 out of 100 vs a random
hand", so two on-screen numbers (31% vs 75%) contradict under the same phrase. And after a user
picks BB, every explanation SENTENCE (live + recap) stays in dollars while the rest of the screen is
BB — dollars and BB mixed on the same card. Plus minor copy/console/footer polish.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR (persistent) | At 800×600 the hero seat tile covers the center "Pot" label (only "Pot:" peeks out); buttons cramped. Root cause: percent-positioned seats but FIXED-PIXEL tile + center sizes on a height-squashed felt. | Render the table interior (felt + seat tiles + center pot/board) at a FIXED design size and uniformly `scale()` the whole box to fit a measured container (`s = min(1, w/DESIGN_W, h/DESIGN_H)`). Fixed geometry + uniform scale ⇒ no overlap at any size. Action bar stays OUTSIDE the scaled box, full-size. No-scroll contract preserved. |
| 2 | MAJOR | Live preflop verdict: TT "~31% against a random hand" — but that's the MULTIWAY number; "a random hand" is a heads-up label and contradicts References' "~75 out of 100 vs a random hand". | Label the live equity by what it is — "~N% to win against the N opponents still in" / "the players still in" — NOT "a random hand". The References chart's 1-on-1 "vs a random hand" teaching number is different by design; the copy must distinguish multiway from heads-up. Honesty invariant preserved. |
| 3 | MAJOR | Explanation SENTENCES stay in dollars in BB mode (live + every recap row), e.g. header "River — you called 54 BB" above "It costs you $108 to win a $560 pot". | The live-displayed explanation sentence renders in the session `displayUnit`. Expose the structured amounts behind the sentence so a presentation layer can re-format it in the chosen unit (reformatting is presentation, not recomputing a verdict). The persisted canonical USD sentence stays as-is for the coach skill. |
| 4 | MINOR | Equity/Strict preflop raise verdict reads "raiseing" (naive verb+"ing"). | Build the present-participle explicitly ("raise"→"raising"). Verify "calling"/"folding" too. |
| 5 | MINOR | Console ReferenceErrors ("showNumbers"/"resultLine") + setState-in-render warnings, tagged HotReload. UI never broke. | Audit FeedbackPanel/HandRecap for state writes in render or out-of-scope identifiers; confirm a PRODUCTION build is clean (the ReferenceErrors are stale HMR artifacts — those identifiers aren't referenced out of scope in committed code). |
| 6 | NIT | Variance/"unlucky" footer fired on a correct preflop fold that lost only the blind — no bad beat. | Only show the footer when the hero CONTESTED (reached a street past preflop OR voluntarily put chips in with a call/bet/raise) AND had no ❌ mistake AND lost. A cheap preflop fold → no footer. |
| 7 | NIT | In Equity mode the preflop verdict still shows a "chart-based" BADGE / "exactly what the baseline chart recommends" (Strict-mode language). | The "chart-based" badge shows only in Strict mode; Equity leads with the equity framing (the text may still note the chart agrees — honesty preserved). Conceptual already shows no badge. |
| 8 | NIT | Two different actions (a preflop raise + a flop bet) produced the IDENTICAL Conceptual sentence "A marginal bet — fine as thin value or a semi-bluff." | Vary Conceptual aggression copy by action type (raise vs bet) so the same sentence doesn't describe different actions. |
| 9 | NIT (likely correct poker) | Same top-pair hand graded "thin" on the flop bet, "Good — value" on the turn bet. | Do NOT change the grading. Optionally add a tiny "judged for this street" clarifier if clean; else leave it. |

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; the decision **analysis** remains the single source of verdict / conceptTag /
  plain sentence / gtoClaim — components read it. Unit reformatting of the sentence is a
  PRESENTATION concern (it re-runs the same pure builder with a different unit); it never recomputes
  a verdict. The `PokerTable` scale hook is a `'use client'` component, not core.
- `gtoClaim` stays true only for preflop chart feedback; equity is "vs an assumed range" of the
  ACTUAL opponents, never their real cards. The multiway label names the opponent count, not cards.
- No `HandRecord` schemaVersion bump — `explanationInput` is an additive optional field; the schema
  validator ignores extra keys.
- Plain language always; money via `formatMoney` / the explain builder's unit; no-scroll preserved.
