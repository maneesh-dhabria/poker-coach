// Self-contained poker hand evaluator. Higher score = better hand.
// Pure; no external deps (see plan execution decision: own evaluator, no poker-evaluator-ts).
import { Card, rankValue, suitOf } from "@/core/cards";

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  Trips = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  Quads = 7,
  StraightFlush = 8,
}

/** Encode [category, ...tiebreakRanks] into one comparable integer (base-15). */
function encode(parts: number[]): number {
  return parts.reduce((acc, v) => acc * 15 + v, 0);
}

/** Find the high card of a straight among unique rank values; supports the wheel (A-2-3-4-5). */
function straightHigh(uniqueDesc: number[]): number | null {
  const set = new Set(uniqueDesc);
  // Ace can play low: add 1 if Ace (14) present.
  const vals = new Set(uniqueDesc);
  if (set.has(14)) vals.add(1);
  const sorted = Array.from(vals).sort((a, b) => b - a);
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] - 1) {
      run++;
      if (run >= 5) return sorted[i] + 4;
    } else {
      run = 1;
    }
  }
  return null;
}

/** Score a 5-card hand. */
export function rank5(cards: Card[]): number {
  if (cards.length !== 5) throw new Error("rank5 expects 5 cards");
  const vals = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const isFlush = suits.every((s) => s === suits[0]);

  // rank -> count
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
  // groups sorted by (count desc, rank desc)
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniqueDesc = Array.from(counts.keys()).sort((a, b) => b - a);

  const sHigh = straightHigh(uniqueDesc);
  const isStraight = sHigh !== null;

  if (isStraight && isFlush) return encode([HandCategory.StraightFlush, sHigh!, 0, 0, 0, 0]);
  if (groups[0][1] === 4) {
    const kicker = groups.find((g) => g[1] === 1)![0];
    return encode([HandCategory.Quads, groups[0][0], kicker, 0, 0, 0]);
  }
  if (groups[0][1] === 3 && groups[1] && groups[1][1] >= 2) {
    return encode([HandCategory.FullHouse, groups[0][0], groups[1][0], 0, 0, 0]);
  }
  if (isFlush) return encode([HandCategory.Flush, ...vals]);
  if (isStraight) return encode([HandCategory.Straight, sHigh!, 0, 0, 0, 0]);
  if (groups[0][1] === 3) {
    const kickers = groups.filter((g) => g[1] === 1).map((g) => g[0]);
    return encode([HandCategory.Trips, groups[0][0], kickers[0], kickers[1], 0, 0]);
  }
  if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) {
    const pairHi = Math.max(groups[0][0], groups[1][0]);
    const pairLo = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups.find((g) => g[1] === 1)![0];
    return encode([HandCategory.TwoPair, pairHi, pairLo, kicker, 0, 0]);
  }
  if (groups[0][1] === 2) {
    const kickers = groups.filter((g) => g[1] === 1).map((g) => g[0]);
    return encode([HandCategory.Pair, groups[0][0], kickers[0], kickers[1], kickers[2], 0]);
  }
  return encode([HandCategory.HighCard, ...vals]);
}

function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const combo: T[] = [];
  function rec(start: number) {
    if (combo.length === k) {
      res.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      rec(i + 1);
      combo.pop();
    }
  }
  rec(0);
  return res;
}

/** Best 5-card score from 5..7 cards. Higher = better. */
export function rank7(cards: Card[]): number {
  if (cards.length < 5) throw new Error("rank7 expects >=5 cards");
  if (cards.length === 5) return rank5(cards);
  let best = 0;
  for (const combo of combinations(cards, 5)) {
    const s = rank5(combo);
    if (s > best) best = s;
  }
  return best;
}

export function categoryOf(score: number): HandCategory {
  // Reverse the base-15 encoding (6 digits): top digit is the category.
  let s = score;
  for (let i = 0; i < 5; i++) s = Math.floor(s / 15);
  return s as HandCategory;
}

/** Plural rank word for labels, e.g. 14 -> "Aces", 13 -> "Kings". */
function rankWord(v: number): string {
  const names: Record<number, string> = {
    14: "Aces",
    13: "Kings",
    12: "Queens",
    11: "Jacks",
    10: "Tens",
    9: "Nines",
    8: "Eights",
    7: "Sevens",
    6: "Sixes",
    5: "Fives",
    4: "Fours",
    3: "Threes",
    2: "Twos",
  };
  return names[v] ?? String(v);
}

/** The exact best 5 cards from the hole + board (enumerates C(n,5), picks max rank5). */
export function winningCards(hole: Card[], board: Card[]): Card[] {
  const all = [...hole, ...board];
  if (all.length < 5) throw new Error("winningCards expects >=5 cards");
  let best: Card[] = all.slice(0, 5);
  let bestScore = -1;
  for (const combo of combinations(all, 5)) {
    const s = rank5(combo);
    if (s > bestScore) {
      bestScore = s;
      best = combo;
    }
  }
  return best;
}

/** Plain-language name of the made hand, decoding the relevant top ranks (spec FR-11/12, D5). */
export function handCategoryLabel(cards: Card[]): string {
  const best =
    cards.length === 5 ? cards : winningCards(cards.slice(0, 2), cards.slice(2));
  const cat = categoryOf(rank5(best));

  // Rank counts on the winning 5, sorted by (count desc, rank desc).
  const counts = new Map<number, number>();
  for (const c of best) counts.set(rankValue(c), (counts.get(rankValue(c)) ?? 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  switch (cat) {
    case HandCategory.StraightFlush:
      return "Straight Flush";
    case HandCategory.Quads:
      return `Four of a Kind, ${rankWord(groups[0][0])}`;
    case HandCategory.FullHouse:
      return `Full House, ${rankWord(groups[0][0])} full of ${rankWord(groups[1][0])}`;
    case HandCategory.Flush:
      return `Flush, ${rankWord(groups[0][0])} high`;
    case HandCategory.Straight:
      return "Straight";
    case HandCategory.Trips:
      return `Three of a Kind, ${rankWord(groups[0][0])}`;
    case HandCategory.TwoPair: {
      const pairs = groups.filter((g) => g[1] === 2).map((g) => g[0]);
      return `Two Pair, ${rankWord(pairs[0])} & ${rankWord(pairs[1])}`;
    }
    case HandCategory.Pair:
      return `Pair of ${rankWord(groups[0][0])}`;
    default:
      return `High Card, ${rankWord(groups[0][0])}`;
  }
}
