# Requirements — Reviewer iteration-3 fixes

**Tier:** 2 (bug/enhancement bundle; one small pure-core copy change in `core/analysis`, one subtle
preset tune in `core/bots`, the rest presentational + setup copy)
**Source:** `docs/playtest/reviews/iter-02.md` — an independent first-time-user playtest that logged a
fresh round of negative moments after the v0.6.0/v0.7.0 passes. The reviewer confirmed the prior
fixes (Mental Math reconciliation, live-feedback unit toggle, OFF-mode hint, action buttons never
clipped) landed well; this iteration covers the NEW findings only.
**Mode:** non-interactive

## Problem

A trusting newcomer went all-in on the river with a ✅ "~92%" verdict, lost their whole stack to a
flush, and nothing on the result screen reconciled the two — the variance bridge existed only inside
a collapsed expander. Units were still mixed (BB everywhere except the hand recap, which stayed in
dollars). The end-of-hand "Result" conclusion appeared mid-hand. Several captions over-promised
content that wasn't on screen. Coaching depth had no visible effect on preflop verdict wording. The
felt didn't fit small/short viewports (seats clipped, center readouts overlapped the hero seat). And
a handful of nits (winner attribution, stack carryover, blind size, a reappearing Mental Math
placeholder) added friction.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | A ✅ "~92%" river all-in then a full-stack loss; nothing reconciled "92%" with "you lost $200". The reconciling idea was buried in a collapsed expander. | When the hero LOST the hand (heroNet < 0) but every graded decision was sound (no ❌ mistakes), surface a plain "good decision, unlucky result — that's variance; we grade the decision, not the outcome; these are long-run averages, not this one hand" note in the recap, by DEFAULT (not hidden). |
| 2 | MAJOR | BB everywhere else, but the recap's per-decision rows ("called $2 · pot $3") + the "Result: you lost $200" line stayed in dollars — mixed units on one screen. | Thread `displayUnit` into `HandRecap` and format every recap-owned money figure (decision amounts, the "· pot X" tag, the Result line) with `formatMoney`. Default `usd` for back-compat. |
| 3 | MINOR | The end-of-hand "Result"/"poker-coach last" conclusion showed MID-HAND while still deciding the flop/turn — made the user think the hand had ended. | The running decision list may stay live, but the end-of-hand CONCLUSION (Result line + /poker-coach pointer + reconcile/variance notes) appears ONLY when the hand is actually complete. |
| 4 | MINOR | A caption read "the numbers below (Mental Math) are for this flop decision" when no such numbers were visible (preflop / collapsed). | Only claim the "numbers below (Mental Math)" block when a live post-flop decision with Mental Math content is actually present; otherwise omit/reword. |
| 5 | MINOR | In feedback-OFF mode the panel said the review comes "when the hand ENDS", but the per-decision review populates LIVE; only the big verdict block is hidden. | Reword the OFF copy to describe what actually happens: per-decision verdicts off, running review still populates live after each move, big verdict/equity block hidden. |
| 6 | MINOR | At 800×600 the top seat clipped off the top edge and the center "Pot" overlapped the hero seat; at 600×900 the "THIS ROUND" summary was hidden behind the hero seat. The fixed desktop oval didn't fit small/short/narrow viewports. | At constrained sizes the felt fits its container so no seat clips off any edge, and the center pot/round-summary is not hidden behind the hero seat. |
| 7 | MINOR | Every preflop verdict was tagged "chart-based" and cited "the baseline chart" even when the user picked "Equity + Heuristics", contradicting the depth descriptors. | The PREFLOP verdict EXPLANATION reflects the selected `coachingDepth`: Conceptual = plain words / no numbers; Equity+Heuristics = lead with equity/odds + reason; Strict = chart/GTO citation. The chart remains the source of the RECOMMENDATION; honesty invariant preserved (`gtoClaim` stays correct). |
| 8 | MINOR | The "balanced" table felt high-variance — busted in both showdowns (3 all-ins in 2 hands), discouraging for a newcomer. | PRIMARY fix is #1 (reframe a sound loss as expected). ADDITIONALLY, modestly + cleanly soften the balanced preset's most explosive seats IF it breaks no tests and stays subtle; otherwise rely on #1. |
| 9 | NIT | The winning-hand label ("Flush, Queens high") rendered near the board/hero cards and looked like it labeled the HERO's hand. | Attribute the showdown banner to its owner ("You win with…" / "<Bot> wins with…"). Handle a mucked winner gracefully. |
| 10 | NIT | After a uniform "100 BB" start, bots had wildly different stacks (cash carryover), unexplained. | Add a brief, unobtrusive plain note that stacks carry over hand-to-hand like a cash game. |
| 11 | NIT | The setup never stated the blind size, so initial dollar amounts were unexplained. | Add a one-line note on the setup screen stating the blinds and what the chosen stack is worth, using the real blind constants ($1/$2). |
| 12 | NIT | At showdown the Mental Math expander reverted to "Deal a hand and reach the flop…" right after rich content — jarring. | At showdown / hand-complete show a short "hand complete — see the hand review" note instead of the "deal a hand" placeholder. |

## Acceptance criteria

- AC1 (#1): A lost-but-well-played hand (heroNet < 0, no ❌) shows the variance note by default; a
  lost-AND-flagged hand does not show the "unlucky" framing.
- AC2 (#2): BB mode renders BB in the recap rows + the result line; the recap's own figures carry no
  conflicting `$`.
- AC3 (#3): Mid-hand the Result line is absent; hand-complete it appears.
- AC4 (#4): The pending caption only promises the Mental Math block when it's actually present.
- AC5 (#5): The OFF copy describes the live running review and no longer claims it waits for hand end.
- AC6 (#6): Source-contract: the felt preserves aspect ratio and the center block sits clear of the
  hero seat (true pixel checks at 800×600/600×900 are the next reviewer's Playwright step).
- AC7 (#7): The three depths produce materially different preflop explanation text for the same spot;
  Conceptual has no digits, Equity leads with odds + names the chart, Strict cites the baseline chart.
- AC8 (#8): The balanced preset is subtly softened with no broken bot/engine tests (or deferred,
  documented).
- AC9 (#9): The banner names the winner; mucked-winner case stays graceful.
- AC10 (#10/#11): The setup states blinds + stack value and notes stack carryover, in plain words.
- AC11 (#12): At hand-complete Mental Math shows a "hand complete" note, not the "deal a hand" placeholder.
- All: `npm run typecheck`, `npm run lint`, `npm test` pass. `core/*` stays React-free; the feedback
  panel/recap read `DecisionAnalysis`/equity and never recompute verdicts. No `HandRecord` schema
  change. Honesty invariant: `gtoClaim` true only for preflop chart claims.

## Out of scope

- Equity math internals, the coaching skill, the hand-record schema.
- True pixel verification at 800×600 / 600×900 (Playwright/manual — noted for the next reviewer).
- Deep bot/engine reworks; #8 is a subtle preset tune only, gated on not breaking tests.
