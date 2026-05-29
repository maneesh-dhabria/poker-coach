"use client";
// The play surface: seats, board, pot, and the hero action bar (spec FR-51, FR-52; wireframe 01).
// Reads the render snapshot from the game store's HandFlow; the hero's action drives the store.
// Bot actions are revealed one at a time (observation #3) so the table tells the story of the hand:
// each seat shows what it just did, and committed chips animate toward the pot.
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { latestActionPerSeat } from "@/core/handFlow";
import { Seat } from "@/components/table/Seat";
import { Board } from "@/components/table/Board";
import { PotDisplay } from "@/components/table/PotDisplay";
import { ActionBar } from "@/components/ActionBar";
import { HandRecap } from "@/components/HandRecap";
import { Button } from "@/components/ui/Button";

const REVEAL_MS = 380; // pause between each bot's action so the user can follow the table

export function PokerTable() {
  const flow = useGameStore((s) => s.flow);
  const busy = useGameStore((s) => s.busy);
  const heroAct = useGameStore((s) => s.heroAct);
  const newHand = useGameStore((s) => s.newHand);
  const handNumber = useGameStore((s) => s.handNumber);
  useGameStore((s) => s.tick); // subscribe so the table re-renders on each change

  const log = flow ? flow.actionLog() : [];
  const total = log.length;
  const [revealed, setRevealed] = useState(0);

  // Reset the reveal cursor when a new hand is dealt.
  useEffect(() => {
    setRevealed(0);
  }, [handNumber]);

  // Walk the reveal cursor forward one action at a time.
  useEffect(() => {
    if (revealed >= total) return;
    const t = setTimeout(() => setRevealed((c) => Math.min(c + 1, total)), REVEAL_MS);
    return () => clearTimeout(t);
  }, [revealed, total]);

  if (!flow) return <p style={{ padding: 24 }}>No hand in progress. Deal to begin.</p>;
  const view = flow.tableView();
  const revealing = revealed < total;
  const latest = latestActionPerSeat(log.slice(0, revealed));

  return (
    <section style={{ padding: 16 }}>
      <div
        style={{
          background: "radial-gradient(ellipse at center, var(--felt), var(--felt-deep))",
          borderRadius: "var(--r-lg)",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {view.seats.map((s) => (
            <Seat key={s.seat} seat={s} lastAction={latest[s.seat] ?? null} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16, gap: 6 }}>
          <PotDisplay pot={view.pot} />
          <Board cards={view.board} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {revealing ? (
          <p data-testid="opponents-acting" style={{ color: "var(--ink-soft)" }}>
            Opponents acting…
          </p>
        ) : view.isOver ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <HandRecap decisions={flow.decisions()} heroNet={view.heroNet} />
            <Button variant="primary" onClick={newHand}>
              Next hand
            </Button>
          </div>
        ) : view.isHeroTurn ? (
          <ActionBar legal={view.legal} onAction={heroAct} disabled={busy} pot={view.pot} />
        ) : (
          <p style={{ color: "var(--ink-soft)" }}>Opponents acting…</p>
        )}
      </div>
    </section>
  );
}
