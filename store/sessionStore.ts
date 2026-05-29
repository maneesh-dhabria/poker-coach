// Session settings + lifecycle (spec §11.2). Holds the table configuration and, once started,
// the sessionId returned by POST /api/sessions. Persisted subset is what the coach reads back.
import { create } from "zustand";
import { BotParams } from "@/core/bots/botEngine";
import { CoachingDepth } from "@/core/analysis/types";
import { tablePreset } from "@/core/bots/personas";

export interface Settings {
  numOpponents: number; // 1..5 (true 6-max)
  personas: BotParams[]; // one per opponent seat
  coachingDepth: CoachingDepth;
  feedbackEnabled: boolean;
  heroName: string;
}

export function defaultSettings(): Settings {
  return {
    numOpponents: 5,
    personas: tablePreset("balanced", 5),
    coachingDepth: "equity",
    feedbackEnabled: true,
    heroName: "You",
  };
}

interface SessionState {
  sessionId: string | null;
  settings: Settings;
  setSettings: (partial: Partial<Settings>) => void;
  startSession: () => Promise<string>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  settings: defaultSettings(),
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
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
