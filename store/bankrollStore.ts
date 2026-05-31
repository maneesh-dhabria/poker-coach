// Client bankroll state (spec §11.2, FR-22/23/24/31, R2). Loads the lifetime bank from
// /api/bankroll on mount, applies every pure transition from core/bankroll.ts, and AWAITS the PUT
// before resolving so the next hand can't race a partial write (R2: store awaits the PUT;
// last-write-wins on reload). All money math lives in the pure reducer — this store only orchestrates
// IO and stamps the clock.
import { create } from "zustand";
import {
  Bankroll,
  HandResult,
  applyHandResult as applyHandResultReducer,
  rebuy as rebuyReducer,
  newTable as newTableReducer,
} from "@/core/bankroll";

interface BankrollState {
  bankroll: Bankroll | null;
  load: () => Promise<void>;
  save: () => Promise<void>;
  applyHandResult: (result: HandResult) => Promise<void>;
  rebuy: (seatId: number) => Promise<void>;
  newTable: (startingStack: number, bigBlind?: number) => Promise<void>;
  setAutoRebuy: (on: boolean) => Promise<void>;
}

async function persist(bankroll: Bankroll): Promise<void> {
  await fetch("/api/bankroll", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bankroll),
  });
}

export const useBankrollStore = create<BankrollState>((set, get) => ({
  bankroll: null,

  load: async () => {
    const res = await fetch("/api/bankroll");
    const bankroll = (await res.json()) as Bankroll;
    set({ bankroll });
  },

  // Awaited PUT of the current bankroll (R2: the caller awaits before enabling the next hand).
  save: async () => {
    const { bankroll } = get();
    if (!bankroll) return;
    await persist(bankroll);
  },

  applyHandResult: async (result) => {
    const { bankroll } = get();
    if (!bankroll) return;
    const next = { ...applyHandResultReducer(bankroll, result), updatedAt: new Date().toISOString() };
    set({ bankroll: next });
    await persist(next);
  },

  rebuy: async (seatId) => {
    const { bankroll } = get();
    if (!bankroll) return;
    const next = { ...rebuyReducer(bankroll, seatId), updatedAt: new Date().toISOString() };
    set({ bankroll: next });
    await persist(next);
  },

  newTable: async (startingStack, bigBlind) => {
    const { bankroll } = get();
    if (!bankroll) return;
    const next = { ...newTableReducer(bankroll, startingStack, bigBlind), updatedAt: new Date().toISOString() };
    set({ bankroll: next });
    await persist(next);
  },

  setAutoRebuy: async (on) => {
    const { bankroll } = get();
    if (!bankroll) return;
    const next = { ...bankroll, autoRebuy: on, updatedAt: new Date().toISOString() };
    set({ bankroll: next });
    await persist(next);
  },
}));
