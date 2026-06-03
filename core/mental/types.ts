// Types for the Mental Math walk-through (spec §2.1). Pure data — no React/DOM (§17, FR-22).
// The whole module mirrors the guide's six-step routine so the UI can render it without recomputing.
import { Card } from "@/core/cards";
import { Street } from "@/core/analysis/types";

export type DrawKind =
  | "flush"
  | "open-ended-straight"
  | "gutshot"
  | "overcards"
  | "none";

/** One detected draw group, with the exact set of completing cards (for overlap-correct totals). */
export interface DrawGroup {
  kind: DrawKind;
  label: string; // plain language, e.g. "Flush draw — 9 hearts left"
  outCards: Card[]; // the specific cards that complete THIS draw
  soft: boolean; // true for overcards & taint-flagged groups (D8) — "may not win"
  softReason?: string; // e.g. "top pair may not be best on a wet board"
}

export interface OutsBreakdown {
  groups: DrawGroup[];
  uniqueOutCards: Card[]; // union across groups (overlap counted once)
  totalOuts: number; // uniqueOutCards.length
  overlapCount: number; // sum(group sizes) - totalOuts  (the "−2" line in the guide)
  hardOuts: number; // totalOuts excluding cards that come only from soft groups
}

export interface TaintFlags {
  twoTone: boolean; // two of a suit on board, hero not on that flush draw
  paired: boolean; // board is paired → full house possible
  connected: boolean; // 3+ to a straight on board
  heroFlushNotNut: boolean; // hero's flush draw is not to the nuts
  heroLowEndStraight: boolean; // hero drawing the "idiot end"
  notes: string[]; // plain-language warnings derived from the flags above
}

export type EstimateStatus =
  | "ok" // flop or turn with a usable situation
  | "preflop" // Rule of 2&4 not applicable
  | "river" // no cards to come
  | "no-hand" // no live hand / hero not in it
  | "no-draw"; // ok street but no countable drawing outs

export interface MentalEstimate {
  status: EstimateStatus;
  street: Street | null;
  outs: OutsBreakdown | null;
  taint: TaintFlags | null;

  ruleMultiplier: 2 | 4 | null; // turn → 2, flop → 4
  ruleHitPct: number | null; // Rule of 2&4 estimate (capped at 100)
  exactHitPct: number | null; // deterministic exact P(≥1 out hits) — the technique's ground truth
  bigDrawCaveat: boolean; // true when totalOuts > 12 on the flop (×4 overcounts)

  opponentShade: { lowPct: number; highPct: number; sentence: string } | null; // Step 3 (explanatory)

  potOdds: { toCall: number; potAfterCall: number; breakEvenPct: number } | null; // Step 5
  decision: { profitable: boolean | null; sentence: string } | null; // Step 6

  // Step "Check your work" — the component composes the comparison from ruleHitPct/exactHitPct +
  // the async trueWinPct. Core leaves that comparison to the component (the equity call is async).
  plainSummary: string; // one-line headline for the collapsed/■ state
}

export interface MentalInput {
  hole: [Card, Card] | null;
  board: Card[];
  street: Street;
  potBefore: number;
  toCall: number;
  numActiveOpponents: number;
  outsOverride?: number | null; // when the player edits the count (alternate journey)
}
