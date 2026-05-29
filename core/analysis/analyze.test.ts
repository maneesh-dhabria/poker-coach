import { describe, it, expect } from "vitest";
import { analyze } from "@/core/analysis/analyze";

describe("analyze (T3 tracer: pot odds vs equity)", () => {
  it("calling for 3:1 with 46% equity is a good call at a correct price", () => {
    // 3:1 → pot 12, call 4 → breakeven 25%; 46% equity clears it easily.
    const a = analyze({
      action: "call",
      potBefore: 12,
      toCall: 4,
      equityPct: 46,
      unit: "usd",
    });
    expect(a.verdict).toBe("good");
    expect(a.severity).toBe(0);
    expect(a.conceptTags).toContain("call_correct_price");
    // plain-language line pairs numbers with words: dollars + percent.
    expect(a.plainExplanation).toContain("$");
    expect(a.plainExplanation).toContain("%");
  });

  it("calling 18% equity when 27% is needed is a mistake (too wide)", () => {
    // toCall 4, potBefore 11 → breakeven 4/15 = 26.7%; 18% < that.
    const a = analyze({
      action: "call",
      potBefore: 11,
      toCall: 4,
      equityPct: 18,
      unit: "usd",
    });
    expect(a.verdict).toBe("mistake");
    expect(a.severity).toBeGreaterThanOrEqual(2);
    expect(a.conceptTags).toContain("call_too_wide");
  });

  it("populates the numbers block as ground truth for the coach", () => {
    const a = analyze({ action: "call", potBefore: 11, toCall: 4, equityPct: 46 });
    expect(a.numbers.equityPct).toBeCloseTo(46, 1);
    expect(a.numbers.potOddsPct).toBeCloseTo(26.7, 1);
    expect(a.numbers.unit).toBe("usd");
    expect(a.schemaVersion).toBe(1);
  });

  it("a marginal call near breakeven is graded thin", () => {
    // breakeven 25%, equity 26% → barely +EV.
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 26 });
    expect(a.verdict).toBe("thin");
    expect(a.severity).toBe(1);
  });

  it("folding a clearly +EV spot is graded a mistake (too tight)", () => {
    const a = analyze({ action: "fold", potBefore: 12, toCall: 4, equityPct: 60 });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("fold_too_tight");
  });

  it("conceptual depth omits raw $ and % from the explanation", () => {
    const a = analyze({
      action: "call",
      potBefore: 12,
      toCall: 4,
      equityPct: 46,
      coachingDepth: "conceptual",
    });
    expect(a.coachingDepth).toBe("conceptual");
    expect(a.plainExplanation).not.toContain("%");
    expect(a.plainExplanation).not.toContain("$");
  });
});
