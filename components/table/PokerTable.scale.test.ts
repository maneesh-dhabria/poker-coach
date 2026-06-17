import { describe, it, expect } from "vitest";
import { fitScale, DESIGN_W, DESIGN_H } from "@/components/table/PokerTable";

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
