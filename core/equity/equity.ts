// Monte Carlo equity — hero win% vs an assumed opponent range (spec FR-20/21, §9.5).
// Pure + seedable so results are reproducible; runs off the main thread via the worker.
import { Card, makeDeck, mulberry32, RNG } from "@/core/cards";
import { rank7 } from "@/core/eval/handEval";

/** A named/random opponent range, or an explicit list of two-card combos. */
export type RangeSpec = { kind: "random" } | { kind: "combos"; combos: [Card, Card][] };

export interface EquityInput {
  hero: [Card, Card];
  board: Card[]; // 0..5 known community cards
  numOpponents: number;
  range?: RangeSpec; // applied to every opponent (default: random)
  iterations: number;
  seed?: number; // omit for a fresh random seed (app/worker only — never in pure tests)
}

export interface EquityResult {
  equityPct: number;
  iterations: number;
}

function pick<T>(arr: T[], rng: RNG): T {
  const i = Math.floor(rng() * arr.length);
  const v = arr[i];
  arr.splice(i, 1);
  return v;
}

function drawOpponent(
  range: RangeSpec,
  combos: [Card, Card][],
  available: Card[],
  used: Set<Card>,
  rng: RNG,
): [Card, Card] | null {
  if (range.kind === "combos") {
    // Rejection-sample a combo that doesn't collide with cards already in play.
    for (let tries = 0; tries < 20; tries++) {
      const combo = combos[Math.floor(rng() * combos.length)];
      if (combo && !used.has(combo[0]) && !used.has(combo[1])) return combo;
    }
    return null;
  }
  const avail = available.filter((c) => !used.has(c));
  if (avail.length < 2) return null;
  return [pick(avail, rng), pick(avail, rng)];
}

export function equity(input: EquityInput): EquityResult {
  const { hero, board, numOpponents, iterations } = input;
  const range = input.range ?? { kind: "random" };
  const seed = input.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const rng = mulberry32(seed);

  const dead = new Set<Card>([...hero, ...board]);
  const baseAvailable = makeDeck().filter((c) => !dead.has(c));
  const combos =
    range.kind === "combos"
      ? range.combos.filter(([a, b]) => !dead.has(a) && !dead.has(b))
      : [];

  let total = 0;
  let counted = 0;
  for (let it = 0; it < iterations; it++) {
    const used = new Set<Card>(dead);
    const oppHands: [Card, Card][] = [];
    let ok = true;
    for (let o = 0; o < numOpponents; o++) {
      const h = drawOpponent(range, combos, baseAvailable, used, rng);
      if (!h) {
        ok = false;
        break;
      }
      oppHands.push(h);
      used.add(h[0]);
      used.add(h[1]);
    }
    if (!ok) continue; // unsatisfiable draw (e.g. exhausted combos) — skip this trial

    const need = 5 - board.length;
    const remaining = baseAvailable.filter((c) => !used.has(c));
    const full = [...board];
    for (let k = 0; k < need; k++) full.push(pick(remaining, rng));

    const heroScore = rank7([...hero, ...full]);
    let better = 0;
    let equal = 0;
    for (const oh of oppHands) {
      const s = rank7([...oh, ...full]);
      if (s > heroScore) {
        better++;
        break;
      }
      if (s === heroScore) equal++;
    }
    counted++;
    if (better === 0) total += 1 / (1 + equal); // chops split the win
  }

  return { equityPct: counted > 0 ? (total / counted) * 100 : 0, iterations: counted };
}
