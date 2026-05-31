// One-off generator (spec FR-55/FR-56, S5, §10.3): precomputes hero hand-vs-random-hand equity for
// all 169 canonical preflop hands and writes core/charts/preflopEquity.json (committed). Run with:
//   npm run gen:equity
// which bundles this file (esbuild, which natively honours tsconfig.json "paths" so the `@/` imports
// in core/* resolve) and pipes it straight to node. We use esbuild rather than vite-node because
// vite-node can't resolve the `@/` alias without the (uninstalled) vite-tsconfig-paths plugin.
// Precomputing the table means the Preflop Chart tab needs no runtime Monte Carlo / network / LLM
// (NFR-03) — it just reads the JSON. Seeded so the output is reproducible. process.cwd() (the repo
// root, where npm runs) anchors the write so it works regardless of how the bundle is invoked.
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Card, Rank, Suit } from "../core/cards";
import { allHands169 } from "../core/charts/preflop";
import { equity } from "../core/equity/equity";

const ITERATIONS = 40000;
const BASE_SEED = 1_000;

// Build a representative two-card combo for a canonical key. Suits are arbitrary (equity vs a random
// hand only depends on ranks + whether the two cards share a suit), so we fix them: suited → both
// hearts; offsuit/pair → hearts + spades.
function repCombo(key: string): [Card, Card] {
  const hi = key[0] as Rank;
  if (key.length === 2) {
    // pair, e.g. "AA" → Ah As
    return [`${hi}h` as Card, `${hi}s` as Card];
  }
  const lo = key[1] as Rank;
  const suited = key.endsWith("s");
  const loSuit: Suit = suited ? "h" : "s";
  return [`${hi}h` as Card, `${lo}${loSuit}` as Card];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const keys = allHands169();
const equityMap: Record<string, number> = {};
keys.forEach((key: string, i: number) => {
  const hero = repCombo(key);
  const { equityPct } = equity({
    hero,
    board: [],
    numOpponents: 1,
    iterations: ITERATIONS,
    seed: BASE_SEED + i, // distinct, fixed per hand → reproducible
  });
  equityMap[key] = round1(equityPct);
});

const out = {
  version: 1 as const,
  vs: "random" as const,
  iters: ITERATIONS,
  equity: equityMap,
};

const dest = path.resolve(process.cwd(), "core/charts/preflopEquity.json");
writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`, "utf8");
// eslint-disable-next-line no-console
console.log(`wrote ${dest} — ${keys.length} hands @ ${ITERATIONS} iters`);
