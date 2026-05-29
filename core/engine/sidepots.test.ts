import { describe, it, expect } from "vitest";
import { buildSidePots } from "@/core/engine/sidepots";

describe("buildSidePots", () => {
  it("splits a 3-way all-in for 10/50/100 into layered pots (E1/E2)", () => {
    const pots = buildSidePots([
      { seat: 0, committed: 10, folded: false },
      { seat: 1, committed: 50, folded: false },
      { seat: 2, committed: 100, folded: false },
    ]);
    expect(pots).toEqual([
      { amount: 30, eligible: [0, 1, 2] }, // first 10 from everyone
      { amount: 80, eligible: [1, 2] }, // next 40 from seats 1 & 2
      { amount: 50, eligible: [2] }, // last 50 from seat 2 alone
    ]);
    const total = pots.reduce((s, p) => s + p.amount, 0);
    expect(total).toBe(160);
  });

  it("a folded seat's chips stay in the pot but they are not eligible", () => {
    const pots = buildSidePots([
      { seat: 0, committed: 20, folded: true },
      { seat: 1, committed: 20, folded: false },
      { seat: 2, committed: 20, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 60, eligible: [1, 2] }]);
  });

  it("a single uncontested level yields one pot", () => {
    const pots = buildSidePots([
      { seat: 0, committed: 5, folded: false },
      { seat: 1, committed: 5, folded: false },
    ]);
    expect(pots).toEqual([{ amount: 10, eligible: [0, 1] }]);
  });
});
