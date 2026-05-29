import { describe, it, expect } from "vitest";
import { analyze } from "@/core/analysis/analyze";
import { Card } from "@/core/cards";

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

  it("folding when checking is free is always a mistake, regardless of equity", () => {
    // toCall 0 → no bet to face. Even with low equity, checking is free and dominates folding.
    const low = analyze({ action: "fold", potBefore: 10, toCall: 0, equityPct: 7, street: "flop" });
    expect(low.verdict).toBe("mistake");
    expect(low.conceptTags).toContain("fold_too_tight");
    // Plain language must NOT use the pot-odds "price" framing ($0 / need 0%).
    expect(low.plainExplanation).toMatch(/checking is free/i);
    expect(low.plainExplanation).not.toMatch(/0%/);

    const high = analyze({ action: "fold", potBefore: 10, toCall: 0, equityPct: 55, street: "flop" });
    expect(high.verdict).toBe("mistake");
    expect(high.severity).toBe(3); // gave up more equity → more severe
  });

  it("a free-check fold hides numbers cleanly at conceptual depth", () => {
    const a = analyze({
      action: "fold",
      potBefore: 10,
      toCall: 0,
      equityPct: 30,
      street: "flop",
      coachingDepth: "conceptual",
    });
    expect(a.plainExplanation).not.toContain("%");
    expect(a.plainExplanation).not.toContain("$");
    expect(a.plainExplanation).toMatch(/free/i);
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

describe("analyze (T8: preflop charts, heuristics, depth, honesty)", () => {
  const hand = (a: string, b: string): [Card, Card] => [a as Card, b as Card];

  it("flags a preflop chart deviation with gtoClaim true (folding AA to no raise)", () => {
    const a = analyze({
      action: "fold",
      potBefore: 3,
      toCall: 2,
      equityPct: 85,
      street: "preflop",
      hand: hand("Ah", "As"),
      position: "CO",
      facing: "unopened",
    });
    expect(a.gtoClaim).toBe(true);
    expect(a.chart?.heroDeviates).toBe(true);
    expect(a.conceptTags).toContain("preflop_chart_deviation");
    expect(a.conceptTags).toContain("fold_too_tight");
    expect(a.verdict).toBe("mistake");
  });

  it("rewards preflop discipline when the line matches the chart (AKs open from CO)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 2,
      equityPct: 67,
      street: "preflop",
      hand: hand("Ah", "Kh"),
      position: "CO",
      facing: "unopened",
    });
    expect(a.gtoClaim).toBe(true);
    expect(a.chart?.heroDeviates).toBe(false);
    expect(a.verdict).toBe("good");
    expect(a.conceptTags).toContain("good_preflop_discipline");
  });

  it("never claims GTO for a multiway postflop spot", () => {
    const a = analyze({
      action: "call",
      potBefore: 30,
      toCall: 10,
      equityPct: 40,
      street: "flop",
      numActiveOpponents: 2,
    });
    expect(a.gtoClaim).toBe(false);
    expect(a.chart).toBeUndefined();
  });

  it("detects a missed value bet (checking a strong river)", () => {
    const a = analyze({ action: "check", potBefore: 20, toCall: 0, equityPct: 72, street: "river" });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("value_bet_missed");
  });

  it("flags betting with no equity as a no-equity bluff", () => {
    const a = analyze({ action: "bet", potBefore: 20, toCall: 0, equityPct: 18, street: "turn" });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("bluff_no_equity");
  });

  it("treats a thin bet as marginal value", () => {
    const a = analyze({ action: "bet", potBefore: 20, toCall: 0, equityPct: 42, street: "flop" });
    expect(a.verdict).toBe("thin");
    expect(a.conceptTags).toContain("thin_value_good");
  });

  it("a clear value bet with strong equity is good", () => {
    const a = analyze({ action: "bet", potBefore: 20, toCall: 0, equityPct: 75, street: "flop" });
    expect(a.verdict).toBe("good");
  });

  it("conceptual depth omits raw numbers even for preflop chart feedback", () => {
    const a = analyze({
      action: "fold",
      potBefore: 3,
      toCall: 2,
      equityPct: 85,
      coachingDepth: "conceptual",
      street: "preflop",
      hand: hand("Ah", "As"),
      position: "CO",
      facing: "unopened",
    });
    expect(a.plainExplanation).not.toContain("%");
    expect(a.plainExplanation).not.toContain("$");
  });

  it("populates the EV block for all three options", () => {
    const a = analyze({
      action: "call",
      potBefore: 20,
      toCall: 10,
      equityPct: 50,
      raiseToExtra: 20,
      foldEquityPct: 40,
    });
    expect(typeof a.numbers.ev.fold).toBe("number");
    expect(typeof a.numbers.ev.call).toBe("number");
    expect(typeof a.numbers.ev.raise).toBe("number");
  });
});
