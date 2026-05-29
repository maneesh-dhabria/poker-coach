"use client";
// Top-level experience: Setup → Play. Wires the session + game stores to the screens (spec §6.1).
import { useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { useGameStore } from "@/store/gameStore";
import { SetupScreen } from "@/components/SetupScreen";
import { PokerTable } from "@/components/table/PokerTable";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { CoachingViewer } from "@/components/CoachingViewer";
import { SessionBadge } from "@/components/SessionBadge";
import { Button } from "@/components/ui/Button";

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
  const sessionId = useSessionStore((s) => s.sessionId);

  const configure = useGameStore((s) => s.configure);
  const newHand = useGameStore((s) => s.newHand);
  const feedback = useGameStore((s) => s.feedback);
  useGameStore((s) => s.tick); // re-render on game changes

  const deal = async () => {
    const id = await startSession();
    configure(id, settings, prodSeed());
    newHand();
    setPhase("play");
  };

  if (phase === "setup") return <SetupScreen onDeal={deal} />;

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 16px" }}>
        <h1 style={{ color: "var(--gold)", margin: 0 }}>Poker Coach</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SessionBadge sessionId={sessionId} />
          <Button variant="secondary" size="sm" onClick={() => setPhase("setup")}>
            New session
          </Button>
        </div>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16, alignItems: "start" }}>
        <PokerTable />
        <FeedbackPanel analysis={feedback?.analysis ?? null} enabled={settings.feedbackEnabled} />
      </div>
      <CoachingViewer sessionId={sessionId} />
    </main>
  );
}
