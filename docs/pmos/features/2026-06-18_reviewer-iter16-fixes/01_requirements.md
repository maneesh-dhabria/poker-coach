# Requirements — Reviewer iteration-16 fixes

**Tier:** 1 (small coaching-consistency polish — two MINOR copy items, one NIT tally-bucket item)
**Source:** `docs/playtest/reviews/iter-16.md` — an independent, context-free first-time-user playtest
of the latest build. The reviewer found **ZERO** major or flow issues: no misleading/contradictory
coaching, no broken flow, all three coaching depths behaved as named, live depth-switching was
seamless, pot-odds math was consistent across spots, and the app correctly graded the decision (not
the result), pinning "leak" vs "variance" honestly. The large `## POSITIVES` list must not regress.

All three remaining items are about the verdict **PROSE / tally bucket** disagreeing with the
displayed dollar EV — the math itself (equity / EV / pot odds) is correct and self-consistent; only
the WORDS / BUCKET must agree with it. The honesty invariant holds: never fake a number; where the
displayed EV looks worse than the verdict, **reconcile it in words**, don't doctor the figure. No
EV/equity/pot-odds computation changes; no `HandRecord` schemaVersion bump (additive optional fields
only; the validator ignores extra keys).

## Problem

- **#1 (MINOR)** A ✅-good action whose displayed dollar EV is essentially tied-or-slightly-negative
  reads as a contradiction. Repro: a preflop ISOLATION RAISE over limpers (off-model, `gtoClaim:false`)
  was correctly graded "✅ Good / Going for it is right," but "Show the numbers" showed only
  "fold $0 / raise -$1" — the raise's EV displayed $1 WORSE than folding, with no reconciliation. Two
  real causes: (a) the figures are noisy Monte-Carlo averages and a ~$1 gap on a 100 BB stack is within
  the estimate's margin; (b) the dollar EV is a pure showdown-equity realization that does NOT capture
  the FOLD EQUITY that is the whole point of an isolation raise.
- **#2 (MINOR)** A ⚠️-thin bet whose EV is clearly worse than checking is called "fine." Repro: a flop
  top-pair bet graded "⚠️ Thin / Thin value: …fine as value or a semi-bluff, but it's marginal," while
  "Show the numbers" showed check $72 vs bet $43 — checking is materially higher EV (~+$29). Calling a
  clearly-lower-EV line "fine" under-flags it; the words and the EV disagree on magnitude.
- **#3 (NIT)** A low-equity gross overbet is tallied as "thin," not "mistake." Repro: a deliberate
  100 BB all-in shove with 97o into a $3 pot was correctly flagged "⚠️ Oversized / Off the chart" with
  clear prose, but the Hand-review tally counted it under "thin" ("0 good · 1 thin · 0 mistakes"). A
  100 BB overbet with a weak low-equity hand is a spew — it belongs in the "mistake" bucket.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MINOR | A ✅ iso-raise's only displayed number said raise ≤ fold, unreconciled. | COPY (no EV-math change): when a verdict is POSITIVE yet the chosen action's displayed EV is tied-or-modestly-below the best alternative (within a small margin), append a reconciling note where the numbers are shown / in the plain explanation: the figures are rough equity-only Monte-Carlo averages so a tiny gap is within noise, AND — for the iso/aggressive line — the raise also wins the pot outright often (fold equity) which this showdown-EV doesn't capture. Don't hide the numbers; explain them. Brief, plain. |
| 2 | MINOR | A ⚠️ thin bet the EV says is clearly worse than checking is called "fine." | COPY (EV-aware, keep the ⚠️ thin verdict): make the thin-value explanation acknowledge the EV direction. When EV(bet) < EV(check) by more than a small margin, say checking rates higher on average / the bet is marginal-to-slightly-losing — NOT "fine." When roughly EV-neutral, keep the existing "fine as value or a semi-bluff" tone. Depth-aware: conceptual stays digit-free but must still not call a clearly-worse line "fine." |
| 3 | NIT | A low-equity 100 BB overbet tallied "thin," not "mistake." | LOGIC (equity-aware grade in `analyze.ts`): a gross overbet with LOW equity (a bluff/spew — clearly behind, no made hand) grades a "mistake" (❌, tallies as mistake), while a gross overbet made while AHEAD (value overbet — good equity / a made hand) keeps the ⚠️ "thin/oversized — size down" treatment reviewers liked. Use a clear equity/made-hand threshold consistent with the existing bluff/value branches. Existing "Oversized/Off the chart" prose still reads sensibly for the mistake case; ensure the ❌/severity and tally bucket match. |

## Honesty / architecture invariants (unchanged)

- `core/analysis/*` remains the single source of verdict/equity/kind/conceptTag. `analyze.ts` owns the
  VERDICT; `explain.ts` owns depth-aware COPY. Components read `DecisionAnalysis` and never recompute.
- No EV/equity/pot-odds computation changes. The reconciliation (#1, #2) reads the existing
  `numbers.ev` only to phrase honestly; it never changes a number or a verdict.
- No `HandRecord` schemaVersion change; the EV reconciliation reuses the already-persisted `numbers.ev`
  (no new persisted field). Plain language; all prior passing tests stay green.
</content>
