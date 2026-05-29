// Client game state (spec §11.2, FR-30). Drives the interactive HandFlow, runs equity off-thread
// (worker, sync fallback), records each hero decision's analysis for the FeedbackPanel, and
// persists the completed hand via POST /api/hands. `tick` bumps on every change to trigger renders.
import { create } from "zustand";
import { mulberry32 } from "@/core/cards";
import { Action } from "@/core/engine/gameEngine";
import { HandFlow, startHand, FlowSeatInit } from "@/core/handFlow";
import { HeroDecisionRecord } from "@/core/history/handRecord";
import { requestEquity } from "@/core/equity/equityClient";
import { Settings } from "@/store/sessionStore";

const EQUITY_ITERATIONS = 1500;

function browserWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/equity.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface GameState {
  sessionId: string | null;
  settings: Settings | null;
  flow: HandFlow | null;
  handNumber: number;
  feedback: HeroDecisionRecord | null; // most recent hero decision
  saveStatus: SaveStatus;
  busy: boolean;
  tick: number;
  seed: number;

  configure: (sessionId: string, settings: Settings, seed?: number) => void;
  newHand: () => void;
  heroAct: (action: Action) => Promise<void>;
  saveHand: () => Promise<void>;
}

function buildSeats(settings: Settings): FlowSeatInit[] {
  const seats: FlowSeatInit[] = [
    { seat: 0, name: settings.heroName, isHero: true, stack: 200, persona: null },
  ];
  for (let i = 0; i < settings.numOpponents; i++) {
    seats.push({
      seat: i + 1,
      name: `Bot ${i + 1}`,
      isHero: false,
      stack: 200,
      persona: settings.personas[i] ?? settings.personas[0],
    });
  }
  return seats;
}

export const useGameStore = create<GameState>((set, get) => ({
  sessionId: null,
  settings: null,
  flow: null,
  handNumber: 0,
  feedback: null,
  saveStatus: "idle",
  busy: false,
  tick: 0,
  seed: 1,

  configure: (sessionId, settings, seed = 1) => set({ sessionId, settings, seed, handNumber: 0 }),

  newHand: () => {
    const { settings, handNumber, seed } = get();
    if (!settings) return;
    const nextHand = handNumber + 1;
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: buildSeats(settings),
      buttonIndex: nextHand % (settings.numOpponents + 1),
      rng: mulberry32(seed + nextHand * 1000),
      sessionId: get().sessionId ?? "local",
      handNumber: nextHand,
      coachingDepth: settings.coachingDepth,
    });
    set((s) => ({
      flow,
      handNumber: nextHand,
      feedback: null,
      saveStatus: "idle",
      tick: s.tick + 1,
    }));
    if (flow.isOver()) void get().saveHand();
  },

  heroAct: async (action) => {
    const { flow } = get();
    if (!flow || !flow.isHeroTurn() || get().busy) return;
    set({ busy: true });
    const spot = flow.heroSpot();
    const { equityPct } = await requestEquity(
      {
        hero: spot.hole,
        board: spot.board,
        numOpponents: Math.max(1, spot.numActiveOpponents),
        iterations: EQUITY_ITERATIONS,
        seed: get().seed + get().handNumber * 7 + flow.decisions().length + 1,
      },
      browserWorker,
    );
    const decision = flow.heroAct(action, equityPct);
    set((s) => ({ feedback: decision, busy: false, tick: s.tick + 1 }));
    if (flow.isOver()) await get().saveHand();
  },

  saveHand: async () => {
    const { flow } = get();
    if (!flow) return;
    set({ saveStatus: "saving" });
    try {
      const record = flow.toRecord(new Date().toISOString());
      const res = await fetch("/api/hands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(record),
      });
      set({ saveStatus: res.ok ? "saved" : "error" });
    } catch {
      set({ saveStatus: "error" });
    }
  },
}));
