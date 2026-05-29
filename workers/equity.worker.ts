// Off-main-thread equity worker. Receives the §9.5 request, runs the Monte Carlo, posts back.
// Kept tiny: all the math lives in core/equity so it stays unit-testable without a worker.
import { equity, RangeSpec } from "@/core/equity/equity";
import { Card } from "@/core/cards";

interface EquityMessage {
  id: string;
  type: "equity";
  hero: [Card, Card];
  board: Card[];
  numOpponents: number;
  assumedRange?: RangeSpec;
  iterations: number;
  seed?: number;
}

self.onmessage = (e: MessageEvent<EquityMessage>) => {
  const msg = e.data;
  if (msg?.type !== "equity") return;
  const start = typeof performance !== "undefined" ? performance.now() : 0;
  const { equityPct, iterations } = equity({
    hero: msg.hero,
    board: msg.board,
    numOpponents: msg.numOpponents,
    range: msg.assumedRange,
    iterations: msg.iterations,
    seed: msg.seed,
  });
  const ms = (typeof performance !== "undefined" ? performance.now() : 0) - start;
  (self as unknown as Worker).postMessage({ id: msg.id, equityPct, iterations, ms });
};
