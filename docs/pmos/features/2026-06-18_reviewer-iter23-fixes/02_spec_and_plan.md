# Spec & Plan — Reviewer iteration-23 fixes

## MINOR 1 — short-height stacked table no-clip

**File:** `components/table/PokerTable.tsx` (+ `components/table/PokerTable.scale.test.ts`).

**Mechanism — top-anchor-and-scroll instead of center-and-clip:**
- `useFitScale` now reports `{ scale, stageHeight }` (it already measured the stage via a
  `ResizeObserver`; it now also returns `el.clientHeight`).
- New pure, exported helper:
  ```ts
  export function shouldTopAnchorTable(scale, stageHeight) {
    return stageHeight > 0 && DESIGN_H * scale > stageHeight;
  }
  ```
  i.e. "the readable-floored felt (`DESIGN_H × scale`) is taller than the stage."
- The stage `<div>` uses `alignItems: contentTallerThanStage ? "flex-start" : "center"`. The stage keeps
  its `overflow:auto`.

**Why this is the lowest-risk fix:** `readableScale` already takes the **min of the width AND height**
ratios (`fitScale = min(1, w/DESIGN_W, h/DESIGN_H)`) — so on a short viewport it *does* try to shrink to
fit the height, but the `MIN_TABLE_SCALE = 0.55` readability floor (deliberately kept, per the praised
800×600 "seats ~66px, legible" result) stops it shrinking small enough to fit a ~214px stage. Rather than
remove the floor (which would regress legibility) we change only how the overflow is *placed*:
top-anchored, the scaled box's top sits at the stage top (offset 0), so the overhang scrolls **downward**
inside the already-scrollable stage and the **top/UTG seat is never pushed up behind the header**. The
seats are absolutely positioned *inside* the felt box (top seat at 18% of felt height, well inside), so
once the felt top is at the container top, no seat can render at negative y.

**Invariant:** top-anchored ⇒ scaled content top = container top ⇒ no seat above the container top.

**No regression to praised layouts:** when the felt fits the stage height (1366×768, 1280×520, 800×600,
600×900), `shouldTopAnchorTable` is `false` ⇒ it centers exactly as before. `stageHeight === 0`
(SSR/first paint) ⇒ centers (no spurious anchor).

**Behavior at 700×500 (the repro):** width 668 / 760 ≈ 0.88, height-only ratio 214/520 ≈ 0.41 → floored
to 0.55; felt = 286px > 214px stage → **top-anchored**, scrolls down, top seat fully visible at the
container top. Verified by `PokerTable.scale.test.ts`.

**Tests added (`PokerTable.scale.test.ts`):** import `readableScale`, `shouldTopAnchorTable`,
`MIN_TABLE_SCALE`; assert (a) the 700×500 repro floors to `MIN_TABLE_SCALE`, the felt is taller than the
short stage, and `shouldTopAnchorTable` is `true`; (b) the four praised layouts fit/center (or, if a
particular box overflows, still top-anchor — never centered-and-clipped); (c) an unmeasured stage
(height 0) centers.

## MINOR 2 — all-in button label

**File:** `components/ActionBar.tsx` (+ `components/ActionBar.test.tsx`).

**Mechanism:** `const isAllIn = sized === legal.maxRaiseTo;` — `legal.maxRaiseTo` is the engine's all-in
raise-to (`committedStreet + remaining stack`), so a size equal to it commits the hero's last chip. The
primary button label becomes `All-in ${money(sized)}` when `isAllIn`, else the normal
`Raise to ${money}` / `Bet ${money}`. A small inline `all-in-hint` ("commits your whole stack") appears
alongside.

**Why compare to `legal.maxRaiseTo`, not `offeredMax`:** `offeredMax` may be capped *below* the all-in by
`effectiveMaxRaiseTo` (iter-20). The all-in is detected against the engine's true max so it's recognised
even when no single opponent can cover the full size. **Display-only** — bet legality/sizing and the
engine `onAction` payload are untouched.

**Tests added/updated (`ActionBar.test.tsx`):** new test — a partial bet ($80 < $170) reads "Bet $80",
no "All-in", no hint; a full-stack bet ($170 === maxRaiseTo) reads "All-in $170" + hint and still fires
`{type:"bet", amount:170}`. A second test covers a full-stack RAISE. The pre-existing "clamps the raise
slider" test clamped 500 → maxRaiseTo 100, which is now an all-in, so its button matcher was updated to
`/all-in \$100/` with a comment (the clamp behavior under test is unchanged — the clamp simply landed on
the stack).

## NIT — cheap thin call ≥ its price

**File:** `core/analysis/explain.ts` (+ `core/analysis/explain.test.ts`).

**Mechanism:** new pure helper
```ts
function isPricedCall(p) { return p.action !== "fold" && p.equityPct >= p.potOddsPct; }
```
In the **borderline** (`isBorderlinePrice`, ±3 pts) thin-call branch of both `price()` (Equity/Strict) and
`conceptual()` (digit-free):
- edge ≥ 0 (`isPricedCall`): "You're getting the price, so calling is fine — it's close, but a comfortable
  call at this price." (Conceptual: same wording, no digits.)
- edge < 0: unchanged — "this is about break-even, so calling and folding are roughly equal" (Equity) /
  "It's about break-even here — calling and folding are roughly equal" (Conceptual).

**Guardrails honored:** the **verdict** stays "thin" and the analyze.ts thresholds are untouched — only
the wording inside the existing borderline band changes, and only on the +EV side. The iter-18 borderline
test (28% equity vs 28.6% need → edge −0.6) still reads "roughly equal", and the iter-20 borderline FOLD
("~13% / need ~14%" → folding is fine) is in the fold branch, untouched.

**Tests added (`explain.test.ts`):** a thin call with edge ≥ 0 (30% equity / 28% need) reads "getting the
price" + "comfortable call" and NOT "roughly equal" — at both Equity and Conceptual (Conceptual asserted
digit-free); a thin call with edge < 0 (27% / 29%) still reads "break-even" + "roughly equal" at both
depths (Conceptual digit-free).

## Verification

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm test` (582 passed) · `npm run build` (clean).
Demo fixtures: no `samples/` text changed (the refined copy is runtime-generated; `schema.test.ts`
passes; no schemaVersion bump).
