import { describe, it, expect, beforeEach, vi } from "vitest";
import { useBankrollStore } from "@/store/bankrollStore";
import { defaultBankroll, DEFAULT_BANK } from "@/core/bankroll";

/** Route fetch by "METHOD /path" to a canned JSON body; optional spy fires on every call. */
function mockFetch(
  routes: Record<string, unknown>,
  spy?: (url: string, init?: RequestInit) => void,
) {
  return vi.fn((url: string, init?: RequestInit) => {
    spy?.(url, init);
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${url}`;
    const body = routes[key] ?? routes[`${method} ${new URL(url, "http://x").pathname}`] ?? {};
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
  useBankrollStore.setState({ bankroll: null });
});

describe("bankrollStore", () => {
  it("loads the bankroll on mount via GET", async () => {
    global.fetch = mockFetch({ "GET /api/bankroll": defaultBankroll(200, 6) });
    await useBankrollStore.getState().load();
    expect(useBankrollStore.getState().bankroll?.startingStack).toBe(200);
    expect(useBankrollStore.getState().bankroll?.bank).toBe(DEFAULT_BANK);
  });

  it("applies a hand result and persists via PUT", async () => {
    const put = vi.fn();
    global.fetch = mockFetch(
      { "GET /api/bankroll": defaultBankroll(200, 2), "PUT /api/bankroll": { ok: true } },
      (_url, init) => {
        if ((init?.method ?? "GET").toUpperCase() === "PUT") put();
      },
    );
    await useBankrollStore.getState().load();
    await useBankrollStore.getState().applyHandResult({ heroSeat: 0, net: 40, seatStacks: { 0: 240 } });
    expect(useBankrollStore.getState().bankroll!.sessionPnl).toBe(40);
    expect(useBankrollStore.getState().bankroll!.bank).toBe(DEFAULT_BANK + 40);
    expect(put).toHaveBeenCalled();
  });

  it("rebuy tops the hero up and persists", async () => {
    global.fetch = mockFetch({
      "GET /api/bankroll": {
        ...defaultBankroll(200, 2),
        seats: [
          { seatId: 0, stack: 0 },
          { seatId: 1, stack: 200 },
        ],
      },
      "PUT /api/bankroll": { ok: true },
    });
    await useBankrollStore.getState().load();
    await useBankrollStore.getState().rebuy(0);
    expect(useBankrollStore.getState().bankroll!.seats.find((s) => s.seatId === 0)!.stack).toBe(200);
  });

  it("newTable resets stacks + sessionPnl but keeps the bank", async () => {
    global.fetch = mockFetch({
      "GET /api/bankroll": defaultBankroll(200, 2),
      "PUT /api/bankroll": { ok: true },
    });
    await useBankrollStore.getState().load();
    await useBankrollStore
      .getState()
      .applyHandResult({ heroSeat: 0, net: 100, seatStacks: { 0: 300, 1: 100 } });
    await useBankrollStore.getState().newTable(100);
    const b = useBankrollStore.getState().bankroll!;
    expect(b.sessionPnl).toBe(0);
    expect(b.startingStack).toBe(100);
    expect(b.seats.every((s) => s.stack === 100)).toBe(true);
    expect(b.bank).toBe(DEFAULT_BANK + 100);
  });

  it("stamps updatedAt on a write", async () => {
    global.fetch = mockFetch({
      "GET /api/bankroll": defaultBankroll(200, 2),
      "PUT /api/bankroll": { ok: true },
    });
    await useBankrollStore.getState().load();
    await useBankrollStore.getState().applyHandResult({ heroSeat: 0, net: 0, seatStacks: {} });
    expect(useBankrollStore.getState().bankroll!.updatedAt).not.toBe("");
  });
});
