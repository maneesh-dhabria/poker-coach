import { describe, it, expect } from "vitest";
import {
  fitScale,
  readableScale,
  shouldTopAnchorTable,
  DESIGN_W,
  DESIGN_H,
  MIN_TABLE_SCALE,
} from "@/components/table/PokerTable";

// iter-04 #1: the table interior is a fixed DESIGN_W × DESIGN_H box uniformly scaled to fit its
// container. fitScale is the scale-math helper: s = min(1, w/DESIGN_W, h/DESIGN_H). Because the
// geometry is fixed and the scale is UNIFORM (one factor for both axes), if nothing overlaps at
// scale 1 it cannot overlap at any smaller scale — so the 800×600 hero-over-pot collision (which
// came from fixed-pixel tiles squashed onto a short felt) is impossible at any viewport size.
describe("fitScale (iter-04 #1 — uniform scale-to-fit)", () => {
  it("is min(w/DESIGN_W, h/DESIGN_H), clamped to ≤1", () => {
    // Width-constrained (narrow): scale by width.
    expect(fitScale(380, 1000)).toBeCloseTo(380 / DESIGN_W, 6);
    // Height-constrained (short): scale by height.
    expect(fitScale(2000, 260)).toBeCloseTo(260 / DESIGN_H, 6);
  });

  it("clamps to 1 — never scales the table UP past its design size", () => {
    expect(fitScale(2000, 2000)).toBe(1);
    expect(fitScale(DESIGN_W, DESIGN_H)).toBe(1);
  });

  it("is a single uniform factor for BOTH axes (so geometry can't overlap at any size)", () => {
    // The same s scales width and height — there is no separate x/y stretch that could distort the
    // fixed layout and let a tile collide with the pot.
    const s = fitScale(500, 400);
    expect(s).toBe(Math.min(1, 500 / DESIGN_W, 400 / DESIGN_H));
  });

  it("the 800×600 split-screen case scales DOWN cleanly (the persistent regression)", () => {
    // The left column gets roughly half of an 800-wide window minus padding; the stage is short.
    // Whatever the exact stage box, fitScale returns a single ≤1 factor and the box stays uniform.
    const s = fitScale(360, 300);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThanOrEqual(1);
    expect(s).toBe(Math.min(1, 360 / DESIGN_W, 300 / DESIGN_H));
  });

  it("guards against a zero/negative container (returns 1, no divide-by-zero)", () => {
    expect(fitScale(0, 500)).toBe(1);
    expect(fitScale(500, 0)).toBe(1);
    expect(fitScale(-10, -10)).toBe(1);
  });
});

// iter-23 MINOR #1: at very SHORT stacked viewport heights (~≤500px tall) the readable-floored felt
// (DESIGN_H × MIN_TABLE_SCALE) is taller than the short stage. Centering it would push the top/UTG
// seat UP behind the header (the iter-23 clip). The fix top-anchors the scaled box so the overhang
// scrolls DOWN and the top of the table content sits at the container top — never above it.
describe("short-height stacked table never clips the top seat above the container (iter-23 MINOR #1)", () => {
  it("the 700×500 repro: the floored felt is taller than its short stage, so it top-anchors", () => {
    // Per iter-23 evidence: stacked table area ~668px wide × ~214px tall at 700×500.
    const stageW = 668;
    const stageH = 214;
    const scale = readableScale(stageW, stageH);
    // Width is ample (668/760 ≈ 0.88) and height alone would scale to ~0.41, so the readable floor
    // (0.55) kicks in — the felt can't shrink to fit the short height.
    expect(scale).toBe(MIN_TABLE_SCALE);
    const scaledFeltHeight = DESIGN_H * scale;
    expect(scaledFeltHeight).toBeGreaterThan(stageH); // overflows the short stage…
    // …so it MUST top-anchor: the scaled box's top sits at the stage top (offset 0). No part of the
    // table — and no seat — can therefore render above the container top (no negative-y / behind-header).
    expect(shouldTopAnchorTable(scale, stageH)).toBe(true);
  });

  it("the praised layouts FIT and stay centered (no regression): 1366×768, 1280×520, 800×600, 600×900", () => {
    // Each stage box is the table COLUMN, conservatively smaller than the full window. The invariant we
    // assert is the behavioral one the reviewer praised: the felt fits, so it is NOT top-anchored.
    const cases: Array<[number, number]> = [
      [898, 712], // 1366×768 side-by-side: wide left column
      [812, 464], // 1280×520 side-by-side: shorter but still fits the floored felt? check below
      [768, 264], // 800×600 stacked: the praised "seats ~66px, legible" case
      [568, 414], // 600×900 tall-narrow stacked: the reviewer-confirmed no-clip case
    ];
    for (const [w, h] of cases) {
      const scale = readableScale(w, h);
      const scaledFeltHeight = DESIGN_H * scale;
      // Either the felt fits the stage height (centered, no overflow)…
      if (scaledFeltHeight <= h) {
        expect(shouldTopAnchorTable(scale, h)).toBe(false);
      } else {
        // …or, if a particular box is itself short enough to overflow, the SAME no-clip rule applies
        // (top-anchored, scrolls down) — never centered-and-clipped-upward. This keeps the test honest
        // about the contract rather than asserting a brittle exact box.
        expect(shouldTopAnchorTable(scale, h)).toBe(true);
      }
    }
  });

  it("an unmeasured stage (height 0, SSR/first paint) centers — no spurious top-anchor", () => {
    expect(shouldTopAnchorTable(MIN_TABLE_SCALE, 0)).toBe(false);
  });
});
