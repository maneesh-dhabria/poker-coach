// Client game state (spec §11.2, FR-30). Drives the interactive HandFlow, runs equity off-thread
// (worker, sync fallback), records each hero decision's analysis for the FeedbackPanel, and
// persists the completed hand via POST /api/hands. `tick` bumps on every change to trigger renders.
import { create } from "zustand";
import { mulberry32 } from "@/core/cards";
import { Action } from "@/core/engine/gameEngine";
import { HandFlow, startHand, FlowSeatInit } from "@/core/handFlow";
import { HeroDecisionRecord } from "@/core/history/handRecord";
import { CoachingDepth } from "@/core/analysis/types";
import { requestEquity } from "@/core/equity/equityClient";
import { Settings } from "@/store/sessionStore";
import { useBankrollStore } from "@/store/bankrollStore";

const EQUITY_ITERATIONS = 1500;
const DEFAULT_STACK = 200;
const DEFAULT_STARTING_STACK_BB = 100;
const BIG_BLIND = 2;

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
  setCoachingDepth: (depth: CoachingDepth) => void;
  saveHand: () => Promise<void>;
}

// Seed each seat's stack from the persisted bankroll so stacks carry hand-to-hand (FR-22). Any
// non-hero seat that has busted below a big blind is auto-rebought to the starting stack so the table
// never goes short-handed (FR-24); the hero is left to the RebuyModal. Falls back to the default depth
// when the bankroll hasn't loaded yet.
function buildSeats(settings: Settings): FlowSeatInit[] {
  const bankroll = useBankrollStore.getState().bankroll;
  const startingStack = bankroll?.startingStack ?? DEFAULT_STACK;
  const stackFor = (seatId: number, isHero: boolean): number => {
    const seat = bankroll?.seats.find((s) => s.seatId === seatId);
    let stack = seat ? seat.stack : startingStack;
    if (!isHero && stack < BIG_BLIND) stack = startingStack; // bots auto-rebuy
    return stack;
  };
  const seats: FlowSeatInit[] = [
    { seat: 0, name: settings.heroName, isHero: true, stack: stackFor(0, true), persona: null },
  ];
  for (let i = 0; i < settings.numOpponents; i++) {
    const seatId = i + 1;
    seats.push({
      seat: seatId,
      name: `Bot ${seatId}`,
      isHero: false,
      stack: stackFor(seatId, false),
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
    const startingStackBb =
      (useBankrollStore.getState().bankroll?.startingStack ?? DEFAULT_STACK) / BIG_BLIND ||
      DEFAULT_STARTING_STACK_BB;
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb },
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

  // Apply an in-play coaching-depth change to the CURRENT hand (iter-14 #1/#2). Re-derives every
  // already-graded decision (the review list) AND the latest decision the FeedbackPanel reads (the
  // `feedback` record) at the new depth, and bakes the depth for all future decisions in this hand —
  // so an in-play switch takes FULL effect, exactly as if the session had started at that depth
  // (no half-switched panel, no stale baked copy). Depth only changes COPY, so this is deterministic.
  setCoachingDepth: (depth) => {
    const { flow, settings } = get();
    // ONE SOURCE OF TRUTH for the active depth (iter-20 MINOR #1). gameStore keeps its OWN `settings`
    // copy (seeded once by configure()); `newHand()` reads THAT copy's coachingDepth to grade the
    // fresh hand's decisions. Previously an in-play depth change updated only the session store +
    // re-graded the current hand, leaving gameStore.settings.coachingDepth stale — so dealing a new
    // hand while Conceptual was active built its flow at the old (deal-time) depth and leaked numbers
    // on the first decision until the user re-toggled. Mirror the depth into gameStore.settings here so
    // the next deal AND the in-play re-derive share the same source of truth.
    if (settings && settings.coachingDepth !== depth) {
      set({ settings: { ...settings, coachingDepth: depth } });
    }
    // Guard for older flow instances / test doubles that predate reanalyzeAt — a depth change then
    // still flows through settings for future hands, just without the current-hand re-derive.
    if (!flow || typeof flow.reanalyzeAt !== "function") return;
    const changed = flow.reanalyzeAt(depth);
    if (!changed) {
      // The current hand was already at this depth, but we may still have just refreshed the stored
      // settings above; bump the tick so any subscriber re-reads. No feedback change needed.
      set((s) => ({ tick: s.tick + 1 }));
      return;
    }
    // Re-read the latest decision from the (now re-derived) flow so the panel's `feedback` is fresh.
    const decisions = flow.decisions();
    const latest = decisions.length > 0 ? decisions[decisions.length - 1] : null;
    set((s) => ({ feedback: latest ?? s.feedback, tick: s.tick + 1 }));
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
    // Carry the result into the lifetime bankroll: hero net moves bank + session P/L and final
    // per-seat stacks carry to the next hand (FR-22/23). Awaited so the next hand can't race the
    // write (R2). Only when a bankroll has been loaded. Final stacks + hero net come straight from
    // the engine's tableView (the same source toRecord uses).
    if (useBankrollStore.getState().bankroll) {
      const view = flow.tableView();
      const seatStacks: Record<number, number> = {};
      let heroSeat = 0;
      for (const s of view.seats) {
        seatStacks[s.seat] = s.stack;
        if (s.isHero) heroSeat = s.seat;
      }
      try {
        await useBankrollStore
          .getState()
          .applyHandResult({ heroSeat, net: view.heroNet ?? 0, seatStacks });
      } catch {
        /* bankroll persistence is best-effort; reload reconstructs from disk (R2 last-write-wins) */
      }
    }
  },
}));
