# Spec + Plan — Reviewer iteration-16 fixes

Tier 1. Combined design + task breakdown for three coaching-consistency fixes: two MINOR EV-vs-prose
copy items (#1, #2) and one NIT equity-aware grade/tally item (#3). All surgical edits live in
`core/analysis/{analyze.ts, explain.ts}` (the single source of verdict + copy). No EV/equity/pot-odds
computation change; no `HandRecord` schemaVersion bump.

## Design decisions

### FR-1 Positive-verdict EV reconciliation note (#1) — MINOR
- **Mechanism / threshold (`explain.ts`).** Thread the existing `numbers.ev` into `ExplainParams.ev`
  (optional; `analyze.ts` passes it; `formatExplanation` re-reads `analysis.numbers.ev`, so no new
  persisted field / schema change). A new `evReconcileNote(verdict, chosen, best, aggressive)` returns
  a note ONLY when `verdict === "good"` and `0 < (best − chosen) ≤ EV_RECONCILE_MARGIN` (chosen = the
  taken line's EV, best = the highest alternative's EV). `EV_RECONCILE_MARGIN = 2` USD (≈ 1 BB on the
  $1/$2 table — within Monte-Carlo noise). When chosen is already the best EV (gap ≤ 0) the numbers
  agree with the ✅, so no note; when genuinely worse (gap > margin) it is NOT hand-waved.
- Applied to the **iso-raise** branch (the exact repro; an aggressive line): chosen = `ev.raise`, best
  = `max(ev.fold, ev.call)`, `aggressive = true` → appends "(The dollar figures are rough equity-only
  estimates, so a gap this small is within the noise. It also wins the pot outright often (fold equity)
  — value this number doesn't capture.)". Plain, brief, sits right above the "Show the numbers" table.

### FR-2 EV-aware thin-bet copy (#2) — MINOR
- **Mechanism / threshold (`explain.ts`).** In the `aggression()` thin branch (and its conceptual
  counterpart), compare bet vs check via the SAME EV table: betting = `ev.raise`, checking = `ev.call`
  (the EV table's check row). When `ev.call − ev.raise > EV_RECONCILE_MARGIN` (same 2-USD margin),
  the copy switches from "fine as value or a semi-bluff" to "checking rates higher on average here, so
  this bet is marginal-to-slightly-losing, not a clear gain" (equity depth) / "checking rates higher on
  average here, so it's borderline-to-slightly-losing" (conceptual, digit-free). Roughly-tied keeps the
  existing "fine" tone. The ⚠️ thin VERDICT is unchanged — copy-only.

### FR-3 Equity-aware gross-overbet grade + tally (#3) — NIT
- **Mechanism / threshold (`analyze.ts`).** Two overbet paths become equity-aware:
  - **Postflop / non-open preflop overbet (`withGrossOverbet`).** New params `equityPct`, `madeHand`.
    A `lowEquitySpew = madeHand == null && equityPct < OVERBET_VALUE_EQUITY_PCT` (= 50, aligned with the
    aggression branch's value/bluff split: madeHand OR equity ≥ 50 ⇒ value) escalates a good/thin grade
    to a ❌ `mistake` (severity 2). A value/ahead overbet (good equity OR a made hand) keeps the prior
    ⚠️ `thin` "size down" treatment. A branch already a mistake is never softened.
  - **Preflop OPEN oversize (`preflopBranch`).** An oversized open of a hand the chart FOLDS
    (`rec === "fold"` — a 100 BB 97o shove) is a low-equity spew → ❌ `mistake` (severity 2); an
    oversized open of a hand the chart WOULD open (you're ahead, just too big) keeps ⚠️ `thin`. Keyed on
    the chart's fold recommendation — the preflop analogue of the postflop no-made-hand/low-equity spew.
- **Tally.** `HandRecap.counts()` buckets straight off `analysis.verdict` (`c[d.analysis.verdict] += 1`),
  so the new `mistake` verdict tallies under "mistake" and shows ❌ with no `HandRecap` change. The
  existing "Oversized/Off the chart" prose is kept; only the icon/severity/bucket move.

## Test / verification plan
- `core/analysis/analyze.test.ts`: low-equity postflop gross overbet (no made hand) → mistake; value/
  ahead overbet → thin (unchanged); low-equity MADE-hand overbet → thin (not escalated); 97o 100 BB
  shove → mistake (tally bucket); AKs/KK oversized open stays thin.
- `core/analysis/explain.test.ts`: thin bet with EV(bet) ≪ EV(check) says "checking rates higher" and
  drops "fine"; roughly-EV-neutral thin keeps "fine"; no-EV back-compat keeps "fine"; conceptual stays
  digit-free for both; iso-raise reconcile note appears only when raise EV is tied/slightly-below fold
  (not when clearly best, not when far worse, not when EV absent).
- `components/FeedbackPanel.test.tsx`: the prior "oversized open shows ⚠️ Oversized" test legitimately
  changed — it now uses a CHART-OPEN hand (KK, a value overbet) to keep the ⚠️ case, plus a new test
  asserts a fold-range oversized open (T2o) shows ❌ "Oversized". (Reason noted: a fold-range oversized
  open is now a mistake per #3.)
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green. No `core/*` EV/equity/
  pot-odds change; no schemaVersion change; demo fixtures still validate (additive only).

## Self-review checks
- (a) A ✅ iso-raise whose raw EV shows raise ≤ fold no longer reads as an unreconciled contradiction —
  the reconcile note explains the noise + fold equity.
- (b) A ⚠️ thin bet the EV says is clearly worse than checking no longer calls the bet "fine."
- (c) A low-equity 100 BB overbet grades ❌ and tallies as a mistake, while a value/ahead overbet still
  grades ⚠️ "size down."
</content>
