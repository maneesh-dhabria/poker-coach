// Side-pot construction — pure, hand-eval-independent (spec FR-03, E1/E2).
// Given each seat's total chips committed across the whole hand (and whether they folded),
// split the money into layered pots with the correct eligibility per layer.

export interface Contribution {
  seat: number;
  committed: number; // total chips this seat put in across the whole hand
  folded: boolean; // folded players forfeit eligibility but their chips stay in the pot
}

export interface SidePot {
  amount: number;
  eligible: number[]; // seats that can win this layer (non-folded, committed up to this level)
}

/**
 * Build layered side pots. Each distinct commitment level forms a layer; every seat that put in
 * at least that level contributes the slice between the previous and current level, and non-folded
 * seats at that level are eligible to win it. Sum of pot amounts === sum of all contributions.
 */
export function buildSidePots(contribs: Contribution[]): SidePot[] {
  const levels = Array.from(
    new Set(contribs.filter((c) => c.committed > 0).map((c) => c.committed)),
  ).sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    const eligible: number[] = [];
    for (const c of contribs) {
      const slice = Math.min(c.committed, level) - Math.min(c.committed, prev);
      amount += slice;
      if (c.committed >= level && !c.folded) eligible.push(c.seat);
    }
    if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  return pots;
}
