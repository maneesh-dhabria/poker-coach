// Hit-probability math for the Mental Math walk-through (spec §2.3, FR-08/09). Pure; no RNG.
// Two numbers per spot: the Rule-of-2&4 mental shortcut, and the exact hypergeometric ground truth
// used to grade how close that shortcut landed.
import { Street } from "@/core/analysis/types";

/** The Rule of 2 & 4 mental shortcut: outs ×4 on the flop, ×2 on the turn, capped at 100. */
export function ruleOf2And4(totalOuts: number, street: "flop" | "turn"): number {
  return Math.min(100, totalOuts * (street === "flop" ? 4 : 2));
}

/** Binomial coefficient C(n, k) for small n (k is 1 or 2 here). Returns 0 when n < k. */
function comb(n: number, k: number): number {
  if (k < 0 || n < k) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return result;
}

/**
 * Exact probability (%) that at least one of `totalOuts` outs appears over `cardsToCome` cards,
 * via the complement of missing every card: 1 − C(unseen−outs, cardsToCome)/C(unseen, cardsToCome).
 * Deterministic — the honest yardstick for the Rule-of-2&4 estimate. Rounded to 1 decimal place.
 */
export function exactHitPct(totalOuts: number, unseenCount: number, cardsToCome: 1 | 2): number {
  if (totalOuts <= 0 || unseenCount <= 0) return 0;
  const missAll = comb(unseenCount - totalOuts, cardsToCome) / comb(unseenCount, cardsToCome);
  const pct = (1 - missAll) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
}

/** The guide's "×4 overcounts above ~12 outs on the flop" caveat (FR-09). */
export function bigDrawCaveat(totalOuts: number, street: Street): boolean {
  return street === "flop" && totalOuts > 12;
}
