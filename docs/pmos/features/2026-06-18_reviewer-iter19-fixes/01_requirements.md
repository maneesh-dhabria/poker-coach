# Requirements — Reviewer iteration-19 fixes

**Tier:** 1 (three MINOR copy/presentation items + one NIT polish item)
**Source:** `docs/playtest/reviews/iter-19.md` — an independent, context-free first-time-user playtest
of build v0.23.0. The reviewer found **ZERO** MAJOR/flow issues: grading buckets, decision-not-outcome
integrity, EV/verdict agreement, equity labeling, depth control, and responsiveness all behaved
correctly. The large `## POSITIVES` list must not regress.

All items live in the copy/presentation layer (Mental-Math dollar-EV line, end-of-hand recap wording,
the depth gate for the equity bar). The math itself (equity / EV / pot odds) and the verdict bucketing
are correct and **not** touched. No `HandRecord` schemaVersion bump — these are component-render-only
changes (no new persisted fields; the validator ignores extra keys regardless).

## Problem

- **MINOR #1.** The standalone "Betting is worth about $X" dollar-EV line misleads on a check-is-better
  spot. Repro (Hand 3 turn): hero CHECKED Ace-high, verdict praised it, but the Mental-Math "Show the
  dollar EV" row showed only "Betting is worth about $14 on average." Read alone — under a check-praising
  verdict — it looks like advice to BET. Only the separate "Show the numbers" (check $17 > bet $14)
  resolves it.
- **MINOR #2.** The "loses money on average" recap line contradicts a non-negative EV on an oversized
  play. Repro (Hand 2): a ~40×-pot all-in shove (graded ❌ Oversized) that WON showed raise $1 vs
  fold $0 — marginally POSITIVE vs these over-folding bots — yet the won-with-flagged-play recap said it
  "flags a play that loses money on average." The literal −EV claim contradicts the shown +$1.
- **MINOR #3.** Strict depth hides the equity bar but keeps inline numbers — inconsistent. Strict's
  no-chart fallback keeps inline "~30%"/"~40×" in the verdict sentence but removes the equity bar /
  "Show the numbers". Strict is a NUMBERS depth (only Conceptual is digit-free), so hiding the bar is
  the inconsistency.
- **NIT #4.** Recap lists check-then-fold on one street as two separate items ("Turn — you checked" and
  "Turn — you then folded"). Accurate but busy.

## Findings → requirements

| # | Sev | Finding | Requirement |
|---|-----|---------|-------------|
| 1 | MINOR | Bare "Betting is worth $X" reads as bet-advice under a check-praising verdict. | COPY (`MentalMathSection.TrueEquityCheck`): when the hero CHECKED a free street (`heroAction === "check"`, `toCall <= 0`) and checking is the graded line, the dollar-EV line names the CHECK value (`ev.call`) and contrasts it with betting (`ev.raise`): "Checking is worth about $17 on average — more than betting ($14) — so checking is right." Uses the real `ev.call`/`ev.raise` the EV table shows. BET/CALL spots keep the existing action-named wording. Conceptual stays digit-free (returns null as today). |
| 2 | MINOR | "loses money on average" claimed on a marginally +EV oversized win. | COPY (`HandRecap` won-but-flagged reconcile note): make the "loses money on average" claim CONDITIONAL on the flagged play's chosen-action EV (`numbers.ev` of the most-severe flagged decision: bet/raise→`ev.raise`, call/check→`ev.call`, fold→`ev.fold`) actually being negative. When the flagged play is an OVERSIZED play (tag `preflop_oversize`/`oversize_bet`/`oversize_no_value`) AND its chosen-action EV is non-negative, frame it as a SIZING/RISK problem ("a play whose size risked far more than it could win … a reckless size you can't rely on"). Otherwise keep "loses money on average". The play is STILL a graded mistake and still flagged — only the EV-claim wording changes. |
| 3 | MINOR | Strict hides the equity bar but keeps inline numbers. | GATE (`FeedbackPanel`): the equity bar + "Show the numbers" + numeric EV render for BOTH `equity` AND `strict`; only Conceptual stays digit-free. Change `showEquity = depth === "equity"` → `depth === "equity" \|\| depth === "strict"`. Mental Math already renders for Strict (gated only on conceptual). |
| 4 | NIT | Two recap rows for one street's check-then-fold. | COPY (`HandRecap` list-building): merge consecutive hero decisions on the SAME street into ONE row ("Turn — you checked, then folded to a bet"), keeping every decision's icon + explanation. A fold following another same-street action faced a bet → "then folded to a bet". Different streets stay separate rows. |

## Honesty / architecture invariants (unchanged)

- `core/analysis/*` remains the single source of verdict/equity/kind/conceptTag. Components read
  `DecisionAnalysis` and never recompute. No EV/equity/pot-odds computation change: #1 reads the existing
  `numbers.ev` rows; #2 reads `numbers.ev` + `conceptTags` of the flagged decision only to pick wording.
- Decision-not-outcome integrity is intact: #2's oversized play is STILL graded a mistake and still
  flagged in the tally; only the literal −EV claim is corrected to a sizing/risk claim when the displayed
  EV is non-negative.
- No `HandRecord` schemaVersion change — all four items are component-render-only.
