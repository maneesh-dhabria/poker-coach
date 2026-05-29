import { describe, it, expect } from "vitest";
import { potOdds, evCall, evRaise, bestOption } from "@/core/analysis/heuristics";

describe("pot odds + EV", () => {
  it("computes breakeven pot odds", () => {
    expect(potOdds(12, 4)).toBeCloseTo(25, 5); // 4 / 16
    expect(potOdds(11, 4)).toBeCloseTo(26.67, 1);
    expect(potOdds(10, 0)).toBe(0); // nothing to call
  });

  it("EV(call) is positive when equity beats the price, negative otherwise", () => {
    expect(evCall(12, 4, 46)).toBeGreaterThan(0);
    expect(evCall(11, 4, 18)).toBeLessThan(0);
  });

  it("EV(raise) rises with fold equity", () => {
    const noFold = evRaise(20, 10, 40, 0);
    const someFold = evRaise(20, 10, 40, 50);
    expect(someFold).toBeGreaterThan(noFold);
  });
});

describe("bestOption picks the highest-EV line", () => {
  it("prefers raising when it dominates", () => {
    const ev = { fold: 0, call: 3, raise: 8 };
    expect(bestOption(ev, ["fold", "call", "raise"])).toBe("raise");
  });
  it("prefers folding when both call and raise are -EV", () => {
    const ev = { fold: 0, call: -2, raise: -5 };
    expect(bestOption(ev, ["fold", "call", "raise"])).toBe("fold");
  });
});
