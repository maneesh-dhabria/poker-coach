// Card model + seeded RNG. Pure; no React/DOM (see spec §17).

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["c", "d", "h", "s"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
/** A card is a 2-char string: rank + suit, e.g. "As", "Td", "2c". */
export type Card = `${Rank}${Suit}`;

/** Seedable pseudo-random source in [0,1) — e.g. the closure from mulberry32. */
export type RNG = () => number;

export function rankOf(card: Card): Rank {
  return card[0] as Rank;
}
export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

/** Numeric rank value: 2..14 (A high). */
export function rankValue(card: Card): number {
  return RANKS.indexOf(rankOf(card)) + 2;
}

export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(`${r}${s}` as Card);
  return deck;
}

/** Deterministic PRNG in [0,1). Seedable for reproducible tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle (returns a new array). Deterministic given rng. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw `n` cards from a deck excluding `exclude`; uses rng. Returns drawn + remaining. */
export function draw(deck: readonly Card[], n: number, rng: () => number, exclude: Set<Card> = new Set()): Card[] {
  const available = deck.filter((c) => !exclude.has(c));
  return shuffle(available, rng).slice(0, n);
}
