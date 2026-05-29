import { describe, it, expect } from "vitest";
import { equity } from "@/core/equity/equity";
import { Card } from "@/core/cards";

const c = (s: string) => s as Card;

describe("equity (Monte Carlo)", () => {
  it("AA vs one random hand preflop is ~85% (±2%)", () => {
    const r = equity({
      hero: ["Ac", "Ad"].map(c) as [Card, Card],
      board: [],
      numOpponents: 1,
      iterations: 8000,
      seed: 42,
    });
    expect(r.equityPct).toBeGreaterThan(83);
    expect(r.equityPct).toBeLessThan(87);
  });

  it("is reproducible for a given seed", () => {
    const args = {
      hero: ["Kh", "Qh"].map(c) as [Card, Card],
      board: ["2c", "7d", "9s"].map(c),
      numOpponents: 2,
      iterations: 2000,
      seed: 7,
    };
    expect(equity(args).equityPct).toBe(equity(args).equityPct);
  });

  it("equity drops as more opponents are added", () => {
    const base = { hero: ["Ac", "Ad"].map(c) as [Card, Card], board: [], iterations: 4000, seed: 99 };
    const oneOpp = equity({ ...base, numOpponents: 1 }).equityPct;
    const fiveOpp = equity({ ...base, numOpponents: 5 }).equityPct;
    expect(fiveOpp).toBeLessThan(oneOpp);
  });

  it("respects an explicit combos range", () => {
    // Hero AA vs a range that is only KK — hero should be a heavy favorite (~80%+).
    const r = equity({
      hero: ["Ac", "Ad"].map(c) as [Card, Card],
      board: [],
      numOpponents: 1,
      range: { kind: "combos", combos: [["Kh", "Ks"].map(c) as [Card, Card], ["Kd", "Kc"].map(c) as [Card, Card]] },
      iterations: 4000,
      seed: 11,
    });
    expect(r.equityPct).toBeGreaterThan(78);
  });
});
