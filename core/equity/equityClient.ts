// Promise wrapper around the equity Web Worker, with a synchronous fallback (spec E7) for
// environments without Worker support (SSR, tests, older runtimes). The §9.5 message shape is
// the contract between this client and workers/equity.worker.ts.
import { equity, RangeSpec } from "@/core/equity/equity";
import { Card } from "@/core/cards";

export interface EquityRequest {
  hero: [Card, Card];
  board: Card[];
  numOpponents: number;
  assumedRange?: RangeSpec;
  iterations: number;
  seed?: number;
}

export interface EquityResponse {
  equityPct: number;
  iterations: number;
  ms: number;
}

/** Factory for the worker; injectable for testing. Returns null when Workers are unavailable. */
export type WorkerFactory = () => Worker | null;

let idCounter = 0;

function runSync(req: EquityRequest): EquityResponse {
  const { equityPct, iterations } = equity({
    hero: req.hero,
    board: req.board,
    numOpponents: req.numOpponents,
    range: req.assumedRange,
    iterations: req.iterations,
    seed: req.seed,
  });
  return { equityPct, iterations, ms: 0 };
}

export function requestEquity(req: EquityRequest, makeWorker?: WorkerFactory): Promise<EquityResponse> {
  // No factory → run inline. Production wiring (T13) supplies a factory that builds the
  // Next.js worker; bare `new Worker(url)` is app-specific so it isn't constructed here.
  const worker = makeWorker ? makeWorker() : null;
  if (!worker) return Promise.resolve(runSync(req));

  const id = `eq-${idCounter++}`;
  return new Promise<EquityResponse>((resolve, reject) => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      worker.removeEventListener("message", onMessage);
      resolve({ equityPct: e.data.equityPct, iterations: e.data.iterations, ms: e.data.ms });
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", (err) => reject(err), { once: true });
    worker.postMessage({ id, type: "equity", ...req });
  });
}
