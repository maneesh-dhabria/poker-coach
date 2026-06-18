# Requirements — Reviewer iteration-23 fixes

**Tier:** 2 (the strongest round yet — **MAJOR: none**. Two MINORs plus one safe copy NIT remain; the
rest of the NITs are deliberately left as-is.)
**Source:** `docs/playtest/reviews/iter-23.md` — an independent, context-free first-time-user playtest of
build v0.27.0. The large `## POSITIVES` list must **not** regress — especially: preflop grading
fair/proportional (loose K8o open = soft "⚠️ Thin", never a red "bluff"; numbers always agree with
words), opens never called bluffs, depth control (Conceptual digit-free from the first decision),
showdown reveal mucking folded players, Strict iso-raise smarts, the References chart, the responsive
layout at 1366/1280/800/600/tall sizes, the ALL-IN seat badge, and Mental Math.

All changes are **layout + a button label + one small copy refinement**. No verdict bucketing, equity, EV
math, engine/side-pot logic, or `HandRecord` schemaVersion is touched.

## Problems

### MINOR 1 — Table clips at SHORT viewport heights in stacked mode
At **700×500** the page stacks (table on top, panel below) and the stacked table area is only ~214px tall,
but the poker oval renders at the readable-floored height (~286px = `DESIGN_H` 520 × `MIN_TABLE_SCALE`
0.55). The stage centers the felt vertically, so the overflow splits top *and* bottom — and the **top
seat (UTG)** is pushed UP, out of the container, behind the header bar (review evidence: table box
`[141,-22,418,286]` vs container `[16,40,668,214]`). Every other size was fine (800×600, 1280×520,
600×900, 1366×768 — no clip). The bug bites only when the stacked table area is **shorter than the felt's
rendered height** (~≤500px tall viewports in stacked mode).

**Root cause:** iter-21 added the `MIN_TABLE_SCALE = 0.55` readability floor and `overflow:auto` on the
stage, but the stage *centers* the scaled box (`alignItems:center`). When the floored box is taller than a
short stage, centering pushes its top edge — and the seats around the oval's top — above the container.

### MINOR 2 — The all-in bet button never says "All-in"
On the turn the hero pushed their **entire** remaining stack but the button read "Bet $170"; the seat then
showed "ALL-IN $194" and "Result: you lost $194." A newcomer didn't realize "Bet $170" committed their
whole stack. ($170 = additional this street; $194 = total committed in the hand — the difference is
unexplained at the moment of action.) The button word "All-in" is the missing cue.

### NIT (safe copy refinement) — a cheap, clearly-priced "thin" call reads too discouragingly
A cheap BB call getting ~5:1 multiway (98o, closing the action) graded "⚠️ Thin / about break-even —
calling and folding are roughly equal." At that price calling is comfortable, not a coin-flip-to-fold.
This is a **copy-only** nuance: when a thin call's equity is at or **above** the price it needs (edge ≥ 0),
lean the wording to "you're getting the price — a comfortable call at this price" instead of "roughly
equal" (which implies edge ≈ 0). When the edge is slightly negative, keep the existing break-even
wording. The **verdict and grading thresholds in `analyze.ts` are NOT changed** — a thin multiway offsuit
call can genuinely be close.

## Deliberately NOT changed (NITs left as-is, with reasoning)

1. **Trash fold of T4o on the BUTTON vs a limper graded "Good fold (pot odds)" with no iso-raise
   suggestion** — CORRECT as-is. T4o is too weak to iso-raise profitably; suggesting a raise would be
   **wrong advice**. The pure pot-odds "good fold" read is honest and internally consistent.
2. **Clicking the slider TRACK jumps the value to the cursor position** — STANDARD native
   `<input type="range">` behavior, and arguably desirable (click-to-set). Keyboard arrows already step a
   clean $1 (iter-22). Not a defect.
3. **Stale HMR build errors in the console history** — dev-only noise from an earlier failed hot-reload
   compile; the files on disk are clean and the app ran correctly. Not a product defect.

## Non-goals / invariants

- No change to verdict bucketing, equity, EV math, pot-odds, the engine, or side-pot logic.
- No `HandRecord` schemaVersion bump; no fixture text changes (the refined copy is runtime-generated, not
  persisted in samples).
- Praised layouts unchanged: 1366×768, 1280×520, 800×600 (stacked, legible), 600×900 (tall). The ONLY
  behavioral layout change is at very short stacked heights (~≤500px tall).
- The all-in change is **label-only** — bet legality/sizing and the engine resolution are untouched.
