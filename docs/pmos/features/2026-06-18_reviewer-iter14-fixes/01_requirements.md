# Requirements — Reviewer iteration-14 fixes

**Tier:** 2 (coaching-consistency + UX-polish bundle — five MAJOR consistency/grading gaps, two MINOR
copy/labeling bugs, three NITs)
**Source:** `docs/playtest/reviews/iter-14.md` — an independent, context-free first-time-user playtest
of v0.18.0. The reviewer confirmed prior wins still hold (Mental Math pinned to the frozen verdict;
the gross-overbet flag exists for huge preflop shoves; clean-hand praise; positivity correctly
withheld after a flag) but found that the brand-new **in-play coaching-depth control** (iter-13 FR-3)
does not actually re-grade the hand it is shown next to — the depth is baked PER-HAND at deal time —
plus several grading/labeling contradictions. Each fix must NOT regress those confirmed wins.

## Problem

- The in-play depth `<select>` writes `sessionStore.coachingDepth`, but the CURRENTLY-DISPLAYED
  decision and every already-recorded decision in the live hand were `analyze()`d at the depth that was
  active when the hand was dealt — and never re-derived. So:
  - **#1** selecting **Conceptual** mid-hand still showed digits everywhere (the displayed analysis was
    still Equity copy);
  - **#2** selecting **Strict** mid-hand silently looked exactly like Equity — no chart badge, no
    off-model note — because the displayed analysis was never re-run at Strict depth.
- **#3** A grossly oversized POSTFLOP bet/shove with decent equity drew no SIZE critique: a ~4×-pot turn
  shove with ~53% into two players graded clean. The gross-overbet threshold (5×, tuned in iter-13 for
  absurd ~13× preflop shoves) was too loose for postflop, where ~3–4× is already a stack-risking overbet.
- **#4** The end-of-hand "leak" pointer named the wrong play: it referenced a generic "play above"
  rather than the MOST SEVERE flagged decision, so a minor early ⚠️ could be highlighted over the
  stack-losing ❌ that actually cost the hand.
- **#5** The live coach contradicted the reference chart: a reasonable SB **iso-raise over limpers** of a
  chart-OPENING hand (KQo) was graded "thin", as if it were an off-chart spew — even though raising to
  isolate limpers with a hand the chart opens first-in is standard. The grade never explained that
  limpers change the spot from the chart's first-in assumption.
- **#6** The pair-rank label was inaccurate: holding T4 on A,6,2,4 (trips of the lowest board rank) was
  called "bottom pair" when, relative to the distinct board ranks, the paired card is in the MIDDLE.
- **#7** The Mental-Math no-draw summary used the wrong action verb on a CALL ("you'd be betting as a
  bluff") when the hero was facing a bet and CALLING.
- **#8** The Mental-Math dollar-EV note for a BET used the CHECK row's EV figure instead of the BET row's.
- **#9** The verdict chip said "Good discipline" for a RAISE — "discipline" reads as restraint, wrong for
  an aggressive action.
- **#10** The "balanced" table preset looked pre-selected on the setup screen before the user touched it.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | Conceptual selected via the in-play control still shows digits everywhere. | The in-play depth change must RE-DERIVE the displayed analysis. Root cause: depth is baked per-hand at deal. Fix: `HandFlow` stores each decision's depth-INDEPENDENT analyze input + a current depth; `reanalyzeAt(depth)` re-runs `analyze()` for the displayed decision AND every recorded decision of the live hand at the new depth (copy-only — verdict/equity/tags are depth-independent). `gameStore.setCoachingDepth` calls it, refreshes `feedback`, bumps `tick`. Conceptual is then rigorously digit-free in-play. |
| 2 | MAJOR | Strict's LIVE feedback silently looks like Equity (no chart badge / off-model note). | Same root cause + fix as #1: re-deriving at Strict depth restores the chart badge (`gtoClaim` true) or the explicit off-model note, matching what Strict shows when the hand is dealt in Strict. |
| 3 | MAJOR | Grossly oversized POSTFLOP bets/shoves not flagged when equity is decent. | Use a SEPARATE, lower POSTFLOP overbet threshold (~3×) so a ~4× turn shove with ~53% into two players is flagged ⚠️ for size, while KEEPING the preflop threshold conservative (~8×) so a normal 3-bet/4-bet (~2×) never flags and only an absurd ~13× preflop shove does. A forced short-stack all-in (capped by stack, ~1×) must not flag. Multiway/marginal-equity copy: "risks your whole stack to win a little, and against N players". |
| 4 | MAJOR | End-of-hand "leak" line points at the wrong play. | The "where the leak is" pointer must reference the MOST SEVERE flagged decision (❌ over ⚠️ via `analysis.severity`; ties broken by the largest chip swing on that decision), and NAME the actual play ("your turn bet of $185"). Conceptual stays digit-free ("your turn bet"). |
| 5 | MAJOR | Live coach contradicts the chart: a reasonable iso-raise over limpers of a chart-opening hand graded "thin". | A raise in a LIMPED pot, by a position+hand the chart OPENS first-in, is an ISOLATION raise — grade it ✅ good (not thin) and explain that the chart assumes first-in but there are limpers, so this is an iso-raise (a standard, fine play). Off-model (`gtoClaim: false` — limpers aren't chart-modeled). New `iso_raise_standard` tag. |
| 6 | MINOR | Pair-rank label inaccurate (T4 on A,6,2,4 → "bottom pair", should be "middle"). | Label the paired rank by its position among the DISTINCT board ranks (descending): index 0 → "top pair"; below the midpoint → "bottom pair"; otherwise "middle pair". So 4 among {A,6,4,2} (index 2 of 4) → "middle pair". |
| 7 | MINOR | Mental-Math hint uses the wrong action on a CALL ("betting as a bluff"). | The no-draw summary must be action-aware: facing a bet (`toCall > 0`) → "calling here just pays off with little equity"; on a free street → "you'd be betting as a bluff or giving up". |
| 8 | MINOR | Dollar-EV note for a BET used the CHECK row figure. | Thread the per-action EV (`{ fold, call, raise }`) into Mental Math; the dollar-EV note uses the BET/RAISE row (`ev.raise`) when betting and the CALL row (`ev.call`) when facing a bet — matching the action. |
| 9 | NIT | Verdict chip "Good discipline" for a RAISE. | "Discipline" wording is reserved for FOLDS. For a chart-on RAISE the chip reads "Standard open" / "On-chart". Make `good_preflop_discipline` label action-aware. |
| 10 | NIT | "balanced" preset looks selected on load. | Highlight NO preset until the user actually applies one (`presetTouched` state). |

## Excluded (no code change, documented)

- EV table showing equal ROUNDED figures across rows — a rounding artifact, not a logic bug; the
  underlying EVs differ and the dollar-EV note now names the correct row (#8).
- A `layout.css` 404 in dev — a Next dev-server source-map probe, not an app asset; no user impact.
- Sub-700px legibility — small but never clips/overlaps; accepted scale-to-fit tradeoff.

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity / kind /
  conceptTag / plain-math — components READ `DecisionAnalysis` and never recompute. `reanalyzeAt` re-runs
  the SAME pure `analyze()` on the stored depth-independent input — only the COPY (depth) changes; the
  verdict, equity, and tags are byte-identical across depths.
- HONESTY INVARIANT preserved: chart/`gtoClaim` true ONLY for chart-modeled spots; the iso-raise branch
  is `gtoClaim: false` (limpers aren't chart-modeled) and the overbet flag is a pure SIZE critique.
- No `HandRecord` schemaVersion change — the new `iso_raise_standard` tag and any threaded EV/action are
  additive optional presentation fields the validator ignores. Demo fixtures still validate (additive).
- Plain language always; money via `core/money.ts`; no-scroll + scale-to-fit preserved; all prior
  passing tests stay green.
</content>
</invoke>
