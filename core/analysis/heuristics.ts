// The math behind a decision verdict: pot odds and expected value of each option.
// Pure helpers, no language or formatting (that lives in explain.ts). Spec FR-22..FR-26.

export interface EvSet {
  fold: number;
  call: number;
  raise: number;
}

export type Option = "fold" | "call" | "raise";

/** Breakeven win% needed to call: cost / (the pot you'd be contesting). */
export function potOdds(potBefore: number, toCall: number): number {
  if (toCall <= 0) return 0;
  return (toCall / (potBefore + toCall)) * 100;
}

/** EV of calling relative to folding (fold = 0): win the pot, or lose the call. */
export function evCall(potBefore: number, toCall: number, equityPct: number): number {
  const p = equityPct / 100;
  return p * potBefore - (1 - p) * toCall;
}

/**
 * EV of raising relative to folding (a coaching approximation, not a solver):
 * villain folds with probability foldEquity (we win the current pot), otherwise calls and
 * we realize equity over the inflated pot, risking `raiseExtra` chips.
 */
export function evRaise(
  potBefore: number,
  raiseExtra: number,
  equityPct: number,
  foldEquityPct: number,
): number {
  const p = equityPct / 100;
  const fE = foldEquityPct / 100;
  const whenCalled = p * (potBefore + raiseExtra) - (1 - p) * raiseExtra;
  return fE * potBefore + (1 - fE) * whenCalled;
}

/** The highest-EV option among those considered. */
export function bestOption(ev: EvSet, options: Option[]): Option {
  return options.reduce((best, o) => (ev[o] > ev[best] ? o : best), options[0]);
}
