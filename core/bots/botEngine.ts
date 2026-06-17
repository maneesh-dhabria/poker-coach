// Heuristic bot decision core (spec FR-11..FR-13, P6). Picks a legal action from hand strength,
// the price offered, and the persona's style frequencies. Selective equity refinement (P6) is an
// optional injected hook used only on close spots — the base policy is pure + deterministic.
import { Card, rankValue, RNG } from "@/core/cards";
import { rank7, categoryOf, HandCategory } from "@/core/eval/handEval";
import { Action, LegalActions } from "@/core/engine/gameEngine";

/** Tunable behavior bundle for a bot (produced from {style, skill} by personas.ts in T10). */
export interface BotParams {
  style: string;
  skill: string;
  vpip: number; // looseness 0..1 (how often to enter pots)
  aggression: number; // bet/raise frequency when ahead 0..1
  bluffFreq: number; // bluff frequency 0..1
  callStation: number; // tendency to call down light 0..1
  raiseSizePct: number; // bet/raise size as a fraction of the pot
  noise: number; // randomness injected by weaker skills 0..1
}

export interface BotSpot {
  legal: LegalActions;
  hole: [Card, Card];
  board: Card[];
  potBefore: number;
  /** Optional: refine strength with real equity on close spots (P6). */
  equityFn?: (hole: [Card, Card], board: Card[]) => number; // returns 0..100
}

const CATEGORY_STRENGTH: Record<HandCategory, number> = {
  [HandCategory.HighCard]: 0.15,
  [HandCategory.Pair]: 0.42,
  [HandCategory.TwoPair]: 0.62,
  [HandCategory.Trips]: 0.75,
  [HandCategory.Straight]: 0.85,
  [HandCategory.Flush]: 0.9,
  [HandCategory.FullHouse]: 0.95,
  [HandCategory.Quads]: 0.98,
  [HandCategory.StraightFlush]: 0.99,
};

/** Rough preflop hand strength in [0,1]: pairs high, then highness + suited/connected bonuses. */
export function preflopStrength(hole: [Card, Card]): number {
  const a = rankValue(hole[0]);
  const b = rankValue(hole[1]);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (a === b) return Math.min(0.95, 0.5 + ((hi - 2) / 12) * 0.45);
  let s = 0.2 + ((hi - 2) / 12) * 0.25 + ((lo - 2) / 12) * 0.15;
  if (hole[0][1] === hole[1][1]) s += 0.07; // suited
  if (hi - lo === 1) s += 0.06; // connected
  else if (hi - lo === 2) s += 0.03;
  if (hi >= 12 && lo >= 10) s += 0.05; // both broadway
  return Math.max(0.1, Math.min(0.85, s));
}

/** Hand strength in [0,1] for the current street. */
export function handStrength(hole: [Card, Card], board: Card[]): number {
  if (board.length === 0) return preflopStrength(hole);
  const cat = categoryOf(rank7([...hole, ...board]));
  return CATEGORY_STRENGTH[cat];
}

export function decide(spot: BotSpot, params: BotParams, rng: RNG): Action {
  const { legal, potBefore } = spot;
  const can = (t: Action["type"]) => legal.actions.includes(t);

  let strength = handStrength(spot.hole, spot.board);
  // Selective equity on close, contested spots (P6).
  if (spot.equityFn && legal.toCall > 0 && strength >= 0.35 && strength <= 0.62) {
    strength = spot.equityFn(spot.hole, spot.board) / 100;
  }

  const sizeTo = (kind: "bet" | "raise"): Action => {
    const target = Math.min(
      legal.maxRaiseTo,
      Math.max(legal.minRaiseTo, legal.minRaiseTo + Math.round(potBefore * params.raiseSizePct)),
    );
    return { type: kind, amount: target };
  };

  // No bet to face: check or bet.
  if (legal.toCall === 0) {
    const wantValue = strength >= 0.6 && rng() < params.aggression;
    const wantBluff = strength < 0.35 && rng() < params.bluffFreq;
    if ((wantValue || wantBluff) && can("bet")) return sizeTo("bet");
    if (can("check")) return { type: "check" };
    return can("call") ? { type: "call" } : { type: "fold" };
  }

  // Facing a bet.
  const potOdds = legal.toCall / (potBefore + legal.toCall);

  // Price-aware station slack (iter-08 #3). A calling station's loose call-down is realistic vs
  // NORMAL-sized bets, but no real player — not even a station — peels a gross overbet with trash.
  // So the slack shrinks toward 0 as the price worsens (potOdds rises): full slack at a small bet,
  // ~0 by the time the price hits a big overbet. potOdds of a half-pot bet ≈ 0.33; a pot-sized bet ≈
  // 0.5; a 2× overbet ≈ 0.67. We keep meaningful slack through ~half-pot, then taper it out.
  const SLACK_FULL_BELOW = 0.34; // ~half-pot or smaller → full slack
  const SLACK_ZERO_ABOVE = 0.6; // ~pot-and-a-half+ overbet → no slack
  const priceFactor =
    potOdds <= SLACK_FULL_BELOW
      ? 1
      : potOdds >= SLACK_ZERO_ABOVE
        ? 0
        : (SLACK_ZERO_ABOVE - potOdds) / (SLACK_ZERO_ABOVE - SLACK_FULL_BELOW);
  const stationSlack = params.callStation * 0.25 * priceFactor;

  if (strength >= 0.7) {
    if (can("raise") && rng() < params.aggression) return sizeTo("raise");
    if (can("call")) return { type: "call" };
  }
  if (strength + stationSlack >= potOdds + 0.05) {
    if (strength >= 0.6 && can("raise") && rng() < params.aggression * 0.5) return sizeTo("raise");
    if (can("call")) return { type: "call" };
  }
  if (strength < 0.3 && can("raise") && rng() < params.bluffFreq * 0.5) return sizeTo("raise");
  // The random light call-down is only taken when the price is NOT bad — facing a gross overbet, even
  // a Calling Station folds trash (iter-08 #3). Below the cap a station still calls loosely vs a
  // normal bet, preserving the station flavor; above it the random peel is switched off entirely.
  const STATION_PRICE_CAP = 0.5; // up to ~a pot-sized bet a station may still peel light
  if (potOdds <= STATION_PRICE_CAP && rng() < params.callStation * 0.4 && can("call"))
    return { type: "call" };

  return can("fold") ? { type: "fold" } : can("check") ? { type: "check" } : { type: "call" };
}
