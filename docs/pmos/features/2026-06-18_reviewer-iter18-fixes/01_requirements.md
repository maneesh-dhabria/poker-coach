# Requirements — Reviewer iteration-18 fixes

**Tier:** 1 (one MAJOR coaching-grading correctness item + two MINOR copy items + two NIT polish items)
**Source:** `docs/playtest/reviews/iter-18.md` — an independent, context-free first-time-user playtest
of build v0.22.0. The reviewer found the app "largely excellent": result-independent grading,
EV-tone agreement, depth control (conceptual/equity/strict), chart cross-checks, the $/BB toggle, and
the `/poker-coach` narrative matching live feedback all behaved correctly. The large `## POSITIVES`
list must not regress.

All items are in the analysis/coaching layer (verdict bucket + copy + result line + responsive CSS).
The math itself (equity / EV / pot odds) is correct and **not** touched. No `HandRecord`
schemaVersion bump (additive optional concept tag only; the validator ignores extra keys).

## Problem

- **MAJOR (correctness).** A made-hand "thin value" BET that is clearly −EV is bucketed ⚠️ thin, while
  a barely-negative CALL is bucketed ❌ mistake — inconsistent. Repro (Hand 6 / record hand-10): top
  pair (6♥J♠) on a wet multiway flop 6♣3♣2♦, hero bets half-pot "for value"; graded "⚠️ Thin — …this
  is a value bet," but the EV breakdown shows **check +1.2 BB vs bet −2.4 BB** (3.6 BB worse AND
  clearly negative). Meanwhile a loose preflop CALL only ~3% below the price (Hand 5: 16% vs 19%
  needed, EV ≈ −$1) is graded ❌ mistake. A clearly money-losing bet got the softer "Thin" label.
- **MINOR #1.** Thin-verdict tone tension (Hand 2 flop): for a borderline thin CALL (28% vs 29% need,
  EV ≈ $0) the headline reads "Close, but just about worth it" (positive) while the equity-bar line
  right below reads "you come up short, so this loses money over time" (negative) — opposite signals.
- **MINOR #2.** Unexplained stack jump after a multiway all-in win (Hand 3→4): hero stack jumped
  $216→$990 and Session→▲$792 with no prominent on-table narration of the big win.
- **NIT #3.** Mental Math "marginal" wording clashes with a ✅ Good check (Hand 2 turn): verdict is
  "✅ Good — Checking is fine here" but the Mental Math line says "at ~38% to win it's marginal here,"
  which undercuts the positive verdict.
- **NIT #4.** Top-bar buttons wrap at 600px (600×900): "New hand"/"New table" labels wrap to two lines
  inside their pill (contained, not clipped).

## Findings → requirements

| # | Sev | Finding | Requirement |
|---|-----|---------|-------------|
| MAJOR | MAJOR (correctness) | A −2.4 BB top-pair value bet tallies "thin"; a −$1 call tallies "mistake". | LOGIC (`analyze.ts`): escalate the made-hand thin-value path (tag `made_hand_thin_value`, verdict thin) from **thin → mistake** when the chosen aggressive action's EV is CLEARLY negative (`ev.raise < −1.5 BB in dollars`) AND materially worse than checking (`ev.raise < ev.call − EV_RECONCILE_MARGIN`). Derive 1 BB from the blinds threaded into analyze (explicit `bigBlind`; else `2×smallBlind`; else fallback $2). Keep near-break-even thin value bets (≈ −0.5 BB) as ⚠️ thin. On escalation drop `made_hand_thin_value`, add `value_bet_too_thin` ("Checking was better"); copy must say checking was clearly better and the bet loses money — never "this is a value bet"/"thin value". |
| 1 | MINOR | Borderline thin call: upbeat headline + grim equity-bar line. | COPY (`explain.ts` price-thin + `FeedbackPanel` whyLine): inside the borderline band (`abs(equity − need) ≤ 3`) present ONE coherent "about break-even — calling and folding are roughly equal" message in both places. A clearly-thin call (outside the band) keeps "just about worth it". |
| 2 | MINOR | Big all-in win: stack jump unexplained. | COPY (`HandRecap`): surface the net result as a prominent, bold, coloured headline ("You won $792.") so the stack change is obviously accounted for. The `/poker-coach` pointer stays in the muted line below. |
| 3 | NIT | Good check's Mental-Math line says action "is marginal". | COPY (`MentalMathSection.noDrawSummary`): when the hero CHECKED a free street with a made hand (a ✅ good check), say "…not strong enough to bet for value, so checking is fine" instead of "it's marginal here". Bet/call spots keep the neutral wording. |
| 4 | NIT | Top-bar pill labels wrap at 600px. | CSS (`.btn` in `globals.css`): add `white-space: nowrap` so short pill labels stay one line. Labels are short, so no overflow/clipping at 600/700/800/1280/1366 widths. |

## Honesty / architecture invariants (unchanged)

- `core/analysis/*` remains the single source of verdict/equity/kind/conceptTag. `analyze.ts` owns the
  VERDICT; `explain.ts` owns depth-aware COPY. Components read `DecisionAnalysis` and never recompute.
  `HandRecap.counts()` buckets straight off `analysis.verdict`, so the escalated bet tallies as a mistake.
- No EV/equity/pot-odds computation change. The MAJOR reads the existing `numbers.ev` only to pick the
  verdict bucket; the borderline-call copy reads existing `equityPct`/`potOddsPct` only to phrase honestly.
- No `HandRecord` schemaVersion change — only an additive concept tag (`value_bet_too_thin`). One
  existing iter-06 test premise legitimately changes (a full-pot 18%-equity made-hand bet that loses
  ~7 BB is now a mistake, not thin) — re-pointed to a near-break-even bet to preserve its non-bluff intent.
