// Baseline preflop chart lookup (spec FR-23, D11). Maps a two-card hand to its 169-grid key and
// returns the chart's recommended action by position + the action faced. This is the only place
// allowed to claim GTO-ish correctness (preflop, gtoClaim=true) — see analysis (T8).
import { Card, rankOf, suitOf, rankValue } from "@/core/cards";
import charts from "@/core/charts/preflopCharts.json";

export type Position = "UTG" | "MP" | "CO" | "BTN" | "SB" | "BB";
export type Facing = "unopened" | "raise";
export type ChartAction = "raise" | "call" | "fold";

const open = charts.open as Record<string, string[]>;
const vsOpen = charts.vsOpen as Record<string, { raise: string[]; call: string[] }>;

/** Canonical 169-grid key for a hand: "AA", "AKs", "72o" (higher rank first). */
export function handKey(cards: [Card, Card]): string {
  const [a, b] = cards;
  const [hi, lo] = rankValue(a) >= rankValue(b) ? [a, b] : [b, a];
  const hiR = rankOf(hi);
  const loR = rankOf(lo);
  if (hiR === loR) return `${hiR}${loR}`;
  const suited = suitOf(a) === suitOf(b);
  return `${hiR}${loR}${suited ? "s" : "o"}`;
}

/**
 * Chart recommendation for a hand at a position facing a given action.
 * - facing "unopened": raise (open) or fold per the position's RFI range.
 * - facing "raise": 3bet / call / fold per the position's defend range (BB baseline).
 */
export function chartAction(cards: [Card, Card], position: Position, facing: Facing): ChartAction {
  const key = handKey(cards);
  if (facing === "unopened") {
    return open[position]?.includes(key) ? "raise" : "fold";
  }
  const defend = vsOpen[position];
  if (!defend) return "fold";
  if (defend.raise.includes(key)) return "raise";
  if (defend.call.includes(key)) return "call";
  return "fold";
}

/** Does the chart have an opinion for this position+facing? (postflop / unknown pos → false). */
export function chartApplies(position: Position, facing: Facing): boolean {
  if (facing === "unopened") return !!open[position];
  return !!vsOpen[position];
}
