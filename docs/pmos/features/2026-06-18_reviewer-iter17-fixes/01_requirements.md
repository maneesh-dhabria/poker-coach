# Requirements — Reviewer iteration-17 fixes

**Tier:** 1 (small coaching-grading / copy polish — one MINOR correctness item, two MINOR copy items,
one NIT copy item)
**Source:** `docs/playtest/reviews/iter-17.md` — an independent, context-free first-time-user playtest
of build v0.21.0. The reviewer found **ZERO** major or flow issues: result-independent grading,
EV-tone agreement, depth control (conceptual/equity/strict), chart cross-checks, over-fold detection,
and the $/BB toggle all behaved correctly. The large `## POSITIVES` list must not regress.

All remaining items are in the analysis/coaching layer (verdict bucket + copy). The math itself
(equity / EV / pot odds) is correct and self-consistent and is **not** touched. No `HandRecord`
schemaVersion bump (additive optional fields only; the validator ignores extra keys).

## Problem

- **#1 (MINOR → correctness)** A reckless low-equity gross overbet with a WEAK MADE HAND is still
  bucketed "⚠️ thin," not a mistake. Repro: 5♥5♠ (an underpair, ~9% equity) on 9♦T♣7♦, the hero
  shoved a ~6×-pot overbet ($153); displayed EV was "check: $2 vs bet: -$18" (a ~$20-losing punt); it
  graded "⚠️ Oversized / Thin value" and counted in the THIN tally. The iter-16 escalation gate was too
  narrow — it fired only when `madeHand == null && equityPct < 50`, so a weak underpair (a made hand)
  was spared. "Thin" is defined in the panel as "marginal-to-slightly-losing"; a -$18, 9%, 6×-pot shove
  is neither.
- **#2 (MINOR)** On that same low-equity overbet the verdict shows BOTH "Thin value" AND "Oversized"
  sub-labels — but there is no *value* in betting a 9%-to-win hand; it's an oversized punt/bluff.
- **#3 (MINOR)** Mental Math says "see the Preflop Chart tab," but the tab is labeled "References." A
  naming mismatch a new user must translate.
- **#4 (NIT)** A razor-thin price decision is graded flatly with no "this is close" hedge. Repro: a
  fold with "win ~13% · need ~14%" graded a flat "✅ Good — Good fold," while other spots get nuance.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MINOR (correctness) | A 9%-equity weak-made-hand 6×-pot shove tallied "thin," not "mistake." | LOGIC (`analyze.ts`): widen the gross-overbet "mistake" escalation to gate on EQUITY ALONE (`equityPct < OVERBET_VALUE_EQUITY_PCT`, the existing ~50% value threshold), dropping the `madeHand == null` carve-out. A weak made hand at low equity is still a spew → ❌ mistake (tallies as mistake). PRESERVE the value-overbet case: a gross overbet made while genuinely AHEAD (`equityPct ≥ ~50`, e.g. a set / strong two pair) stays ⚠️ thin/oversized "size down." |
| 2 | MINOR | The low-equity overbet reads "Thin VALUE" — wrong on a 9% hand. | COPY/LABEL: on the low-equity gross-overbet MISTAKE path, drop the value concept tag/label ("Thin value") and use an oversized-no-value framing instead. Keep the headline "Oversized" badge and the "betting ~6× the pot risks a huge amount to win a tiny pot — size down" copy. The high-equity value-overbet case keeps "Thin value"/"Oversized" as-is. |
| 3 | MINOR | Mental Math says "Preflop Chart tab"; the tab is "References." | COPY-only: name the real tab — "see the Preflop Chart in the References tab." Update any test asserting the old string (kept matching on `/Preflop Chart/`). |
| 4 | NIT | A 13%-vs-14% fold graded flatly, no "close" hedge. | COPY (`explain.ts`, `kind:"price"`): when the hero's equity is within a small margin of the break-even need (`abs(equityPct − potOddsPct) ≤ ~3`), append a brief "though it's close" / "it's close" acknowledgement to the ✅ fold/call price copy. Depth-aware (conceptual stays digit-free but can still say "it's close"). A clear gap keeps its confident wording. |

## Honesty / architecture invariants (unchanged)

- `core/analysis/*` remains the single source of verdict/equity/kind/conceptTag. `analyze.ts` owns the
  VERDICT; `explain.ts` owns depth-aware COPY. Components read `DecisionAnalysis` and never recompute.
  `HandRecap.counts()` buckets straight off `analysis.verdict`.
- No EV/equity/pot-odds computation changes. The borderline-price hedge (#4) reads the existing
  `equityPct` / `potOddsPct` only to phrase honestly; it never changes a number or a verdict.
- No `HandRecord` schemaVersion change — only an additive concept tag (`oversize_no_value`). Plain
  language; all prior passing tests stay green (one iter-16 overbet assertion legitimately flips — see
  spec — because its premise was exactly the carve-out #1 removes).

## Documented-only (no code change)

- At 700×500 the seat cards / bot-bet chips get very small — pure smallness, nothing clips or overlaps.
  Accepted scale-to-fit tradeoff, consistent with the project's responsive stance (spec §17).
</content>
</invoke>
