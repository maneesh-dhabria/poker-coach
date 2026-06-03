import { describe, it, expect } from "vitest";
import { ruleOf2And4, exactHitPct, bigDrawCaveat } from "@/core/mental/hit";

describe("ruleOf2And4", () => {
  it("turn multiplies outs by 2", () => {
    expect(ruleOf2And4(8, "turn")).toBe(16);
  });
  it("flop multiplies outs by 4", () => {
    expect(ruleOf2And4(9, "flop")).toBe(36);
  });
  it("caps at 100 for big draws (15 outs on the flop)", () => {
    expect(ruleOf2And4(15, "flop")).toBe(60);
    expect(ruleOf2And4(30, "flop")).toBe(100);
  });
});

describe("exactHitPct — hypergeometric ground truth", () => {
  it("9 outs, 47 unseen, 2 cards to come ≈ 35.0%", () => {
    expect(exactHitPct(9, 47, 2)).toBeCloseTo(35.0, 1);
  });
  it("9 outs, 46 unseen, 1 card to come ≈ 19.6%", () => {
    expect(exactHitPct(9, 46, 1)).toBeCloseTo(19.6, 1);
  });
  it("15 outs, 47 unseen, 2 cards to come ≈ 54.1%", () => {
    expect(exactHitPct(15, 47, 2)).toBeCloseTo(54.1, 1);
  });
  it("returns 0 for 0 outs and is capped at 100", () => {
    expect(exactHitPct(0, 47, 2)).toBe(0);
    expect(exactHitPct(47, 47, 2)).toBe(100);
  });
});

describe("bigDrawCaveat", () => {
  it("true only for >12 outs on the flop", () => {
    expect(bigDrawCaveat(15, "flop")).toBe(true);
    expect(bigDrawCaveat(9, "flop")).toBe(false);
    expect(bigDrawCaveat(15, "turn")).toBe(false);
  });
});
