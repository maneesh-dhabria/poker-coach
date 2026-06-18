# Requirements — Reviewer iteration-24 fixes

**Tier:** 2 (one MAJOR — a trust-eroding presentation defect, not a data bug — plus three MINORs and
two actionable NITs; two further NITs are deliberately LEFT as defensible/correct.)
**Source:** `docs/playtest/reviews/iter-24.md` — an independent, context-free first-time-user playtest
of build v0.28.0. The large `## POSITIVES` list must **not** regress — especially: instant-feedback
words and numbers agree with proportional severity; Mental Math walkthrough; depth control (Conceptual
digit-free from the first decision); showdown reveal mucking folded players; the all-in button
"commits your whole stack"; the References tab; the position-aware preflop chart (76s raise MP / fold
UTG); no console errors; clean responsive layout at 1366×768, 1280×520, 1024×768, 1000×440, 800×600
stacked, 600×900, 900×600.

All changes are **explanation copy, layout, and display labels**. No verdict bucketing, equity, EV
math, engine/side-pot logic, chart DATA, or `HandRecord` schemaVersion is touched.

## Problems

### MAJOR — Preflop chart reads as self-contradictory (presentation/explanation, NOT a data bug)
In the References preflop chart, **A7s** shows "A7 wins ~61 out of 100" labeled **Fold**, while **A5s**
shows "A5 wins ~60 out of 100" labeled **Raise**. A newcomer sees the HIGHER-equity hand folded and the
LOWER one raised — the only number the chart shows argues directly against its own advice — and the
per-hand explanation was generic boilerplate (identical Baseline/Equity/Position/caveat bullets) that
never explained the real reason.

**The chart DATA is INTENTIONAL and was NOT changed.** This is the recognized low-suited-ace
construction: from MP the chart opens AKs–ATs, A9s, A8s, A5s, A4s but FOLDS A7s, A6s, A3s, A2s; from
UTG it opens AKs–ATs and A5s only (the lone wheel-ace blocker). Suited WHEEL aces (A5s/A4s) make the
nut flush AND the wheel straight (A-2-3-4-5) and the ace blocks opponents' AA/AK, so they play far
better than their raw heads-up equity suggests; middling suited aces (A6s/A7s) are frequently DOMINATED
(out-kicked by a better ace when the money goes in), so their raw "vs a random hand" win% OVERSTATES
their real value. **The defect was that the app never EXPLAINED this** — so the fix is to the
explanation, not the data (same approach as the iter-22 small-pairs fix).

### MINOR 1 — Stacked layout overlaps the coaching panel at ~700px width + short height
At **700×460** and **700×500** (stacked layout) the table/board+seat area had a ~286px min-height
(`DESIGN_H` 520 × `MIN_TABLE_SCALE` 0.55) that did not shrink, so the board and bottom seats rendered
OVER/behind the coaching tab bar below (~84px bleed). This is the COMPLEMENTARY problem to iter-23
(which fixed clipping ABOVE the header by top-anchoring + scrolling the table stage): the table section
now overflowed DOWNWARD into the panel beneath it because its min-height exceeded the allotted stacked
row height. Wider stacked (≥800px) and side-by-side (≥900px) layouts are fine.

### MINOR 2 — Loose-open copy wrongly says "first-in" on a limped pot
Opening 6♦Q♦ from CO with TWO limpers already in, the loose-open verdict copy read "The chart opens
first-in and tighter than this" — but the hero was NOT first-in (there were limpers). The iso-raise
path (iter-22) already acknowledges limpers; the LOOSE-open path did not.

### MINOR 3 — Conceptual flop-bluff reason is vague
A Conceptual-depth flop bluff (bet with no equity on QQ5) read "❌ Mistake — You're betting with little
behind it — there's not enough here." Compared to the crisp Conceptual PREFLOP reason, this didn't
teach WHY.

### NIT 1 — Multiple quick-size buttons highlight at once
At the minimum default raise ($4) BOTH ½ and ¾ showed [pressed]; at all-in ALL of ½/¾/Pot showed
[pressed]. When several quick-size values collapse to the same clamped value (tiny pot → all clamp to
the min-raise; or all clamp to all-in/effective max), they all matched and all highlighted.

### NIT 2 — All-in seat badge vs button number ambiguity
After going all-in, the button said "All-in $163" (chips put in now) but the seat badge read "ALL-IN
$200" (total committed incl. blinds/prior bets) — the two numbers differed with no explanation.

## NITs deliberately LEFT (with reasoning)

- **Conceptual graded a 23s (suited) early-position raise "Thin" not "Mistake".** 23s is suited and
  can flop straights/flushes, so its loss is small — ⚠️ thin is defensible; the reviewer agreed it's
  "defensible." **Grading unchanged.**
- **Strict graded a BB call of 76o getting ~5:1 multiway a "Mistake".** The shown numbers were 13%
  equity vs 17% needed — equity is BELOW the price, so "mistake" AGREES with its own number (this is
  the correct pot-odds call; the reviewer's "playable" intuition overestimates 76o multiway).
  **Grading unchanged.**

## Out of scope / invariants

- No change to any raise/fold classification or chart DATA (only `cellRationale` explanation text).
- No change to `analyze.ts` verdict bucketing, equity, EV, engine, or side-pot amounts.
- No `HandRecord` schemaVersion bump (the new `limpedPot` explanation-input field is additive/optional).
- Demo fixtures (`samples/`) unchanged — refined copy is runtime-generated; `schema.test.ts` passes.
