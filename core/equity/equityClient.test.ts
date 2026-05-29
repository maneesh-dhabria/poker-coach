import { describe, it, expect } from "vitest";
import { requestEquity } from "@/core/equity/equityClient";
import { Card } from "@/core/cards";

const c = (s: string) => s as Card;

describe("requestEquity", () => {
  it("falls back to synchronous MC when no Worker is available (E7)", async () => {
    const res = await requestEquity({
      hero: ["Ac", "Ad"].map(c) as [Card, Card],
      board: [],
      numOpponents: 1,
      iterations: 3000,
      seed: 42,
    });
    expect(typeof res.equityPct).toBe("number");
    expect(res.equityPct).toBeGreaterThan(83);
    expect(res.equityPct).toBeLessThan(87);
    expect(res.iterations).toBeGreaterThan(0);
  });

  it("uses an injected worker factory, resolves on the matching id, and disposes the worker", async () => {
    // Fake worker that echoes a canned equity response for whatever id it receives.
    let terminated = false;
    class FakeWorker {
      private listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
      addEventListener(type: string, cb: (e: MessageEvent) => void) {
        (this.listeners[type] ??= []).push(cb);
      }
      removeEventListener(type: string, cb: (e: MessageEvent) => void) {
        this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== cb);
      }
      terminate() {
        terminated = true;
      }
      postMessage(msg: { id: string }) {
        const event = { data: { id: msg.id, equityPct: 55.5, iterations: 100, ms: 1 } } as MessageEvent;
        for (const cb of this.listeners["message"] ?? []) cb(event);
      }
    }
    const res = await requestEquity(
      {
        hero: ["Kh", "Qh"].map(c) as [Card, Card],
        board: [],
        numOpponents: 1,
        iterations: 100,
        seed: 1,
      },
      () => new FakeWorker() as unknown as Worker,
    );
    expect(res.equityPct).toBe(55.5);
    // Regression guard: the worker must be torn down after the request settles so a long
    // session doesn't leak one worker thread per hero decision.
    expect(terminated).toBe(true);
  });
});
