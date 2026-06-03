"use client";
// Top-level experience: Setup → Play. Wires the session + game stores to the screens (spec §6.1).
import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { useGameStore } from "@/store/gameStore";
import { useBankrollStore } from "@/store/bankrollStore";
import { SetupScreen } from "@/components/SetupScreen";
import { PlayShell } from "@/components/PlayShell";

const BIG_BLIND = 2; // table plays a $1/$2 blind, so 1 BB = $2

// Production deal seed (spec FR-05: "production uses crypto RNG"). The seed sources from crypto
// when available; mulberry32 then expands it deterministically within a hand (preserving testability).
function prodSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
  }
  return Math.floor(Math.random() * 0x7fffffff);
}

export default function Home() {
  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const settings = useSessionStore((s) => s.settings);
  const startSession = useSessionStore((s) => s.startSession);

  const configure = useGameStore((s) => s.configure);
  const newHand = useGameStore((s) => s.newHand);

  // Load the persisted lifetime bankroll once on mount so the header + stacks reflect disk (FR-21).
  useEffect(() => {
    void useBankrollStore.getState().load();
  }, []);

  const deal = async () => {
    const id = await startSession();
    configure(id, settings, prodSeed());
    // Seed the bankroll to the chosen buy-in depth (BB → dollars) before dealing so the first hand's
    // stacks come from the bank (FR-22, D15). Best-effort: gameStore falls back to a default depth.
    try {
      if (!useBankrollStore.getState().bankroll) await useBankrollStore.getState().load();
      await useBankrollStore.getState().newTable(settings.startingStackBb * BIG_BLIND, BIG_BLIND);
    } catch {
      /* bankroll seeding is best-effort */
    }
    newHand();
    setPhase("play");
  };

  if (phase === "setup") return <SetupScreen onDeal={deal} />;

  return <PlayShell onNewSession={() => setPhase("setup")} />;
}
