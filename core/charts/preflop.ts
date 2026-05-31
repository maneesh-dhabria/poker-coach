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

// Ranks high→low, so the enumerator emits keys with the higher rank first (matching handKey).
const RANKS_DESC = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

/**
 * Every canonical preflop hand as a 169-grid key (spec FR-50). Pure — no cards, no IO. Returns the
 * 13 pairs ("AA".."22"), 78 suited ("AKs"…) and 78 offsuit ("AKo"…) = 169 keys, in the same format
 * handKey() produces. Ordered pairs-then-suited-then-offsuit, ranks high→low, so the output is stable
 * (the equity generator and the chart grid both rely on a deterministic order). Adding a rank here
 * would surface in preflop.test.ts's count assertions.
 */
export function allHands169(): string[] {
  const pairs: string[] = [];
  const suited: string[] = [];
  const offsuit: string[] = [];
  for (let i = 0; i < RANKS_DESC.length; i++) {
    for (let j = 0; j < RANKS_DESC.length; j++) {
      const hi = RANKS_DESC[i];
      const lo = RANKS_DESC[j];
      if (i === j) pairs.push(`${hi}${lo}`);
      else if (i < j) suited.push(`${hi}${lo}s`); // i<j ⇒ hi is the higher rank
      else offsuit.push(`${RANKS_DESC[j]}${RANKS_DESC[i]}o`); // keep higher rank first
    }
  }
  return [...pairs, ...suited, ...offsuit];
}
