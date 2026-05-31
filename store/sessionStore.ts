// Session settings + lifecycle (spec §11.2). Holds the table configuration and, once started,
// the sessionId returned by POST /api/sessions. Persisted subset is what the coach reads back.
import { create } from "zustand";
import { BotParams } from "@/core/bots/botEngine";
import { CoachingDepth } from "@/core/analysis/types";
import { tablePreset } from "@/core/bots/personas";
import { MoneyUnit } from "@/core/money";

// Which right-column tab is showing (ephemeral UI state, not persisted — spec S7).
export type TabKey = "feedback" | "coaching" | "hands" | "rankings" | "preflop";

export interface Settings {
  numOpponents: number; // 1..5 (true 6-max)
  personas: BotParams[]; // one per opponent seat
  coachingDepth: CoachingDepth;
  feedbackEnabled: boolean;
  heroName: string;
  startingStackBb: number; // buy-in depth in big blinds (50/100/200, default 100 — D15)
}

export function defaultSettings(): Settings {
  return {
    numOpponents: 5,
    personas: tablePreset("balanced", 5),
    coachingDepth: "equity",
    feedbackEnabled: true,
    heroName: "You",
    startingStackBb: 100,
  };
}

interface SessionState {
  sessionId: string | null;
  settings: Settings;
  activeTab: TabKey;
  // Whether money is shown in dollars or big blinds (ephemeral UI state, not persisted — spec S7).
  displayUnit: MoneyUnit;
  setSettings: (partial: Partial<Settings>) => void;
  setActiveTab: (tab: TabKey) => void;
  toggleDisplayUnit: () => void;
  startSession: () => Promise<string>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  settings: defaultSettings(),
  activeTab: "feedback",
  displayUnit: "usd",
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleDisplayUnit: () => set((s) => ({ displayUnit: s.displayUnit === "usd" ? "bb" : "usd" })),
  startSession: async () => {
    const { settings } = get();
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        numOpponents: settings.numOpponents,
        coachingDepth: settings.coachingDepth,
        feedbackEnabled: settings.feedbackEnabled,
        personas: settings.personas.map((p) => ({ style: p.style, skill: p.skill })),
      }),
    });
    const data = await res.json();
    set({ sessionId: data.id });
    return data.id as string;
  },
}));
