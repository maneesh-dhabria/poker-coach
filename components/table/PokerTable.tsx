"use client";
// The play surface: seats, board, pot, and the hero action bar (spec FR-51, FR-52; wireframe 01).
// Reads the render snapshot from the game store's HandFlow; the hero's action drives the store.
// Bot actions are revealed one at a time (observation #3) so the table tells the story of the hand:
// each seat shows what it just did, and committed chips animate toward the pot.
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { latestActionPerSeat } from "@/core/handFlow";
import { winningCards, handCategoryLabel } from "@/core/eval/handEval";
import { Seat } from "@/components/table/Seat";
import { Board } from "@/components/table/Board";
import { CenterStack } from "@/components/table/CenterStack";
import { ActionBar } from "@/components/ActionBar";
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
  const snapshot = flow.replayAt(revealed);
  const BIG_BLIND = 2; // fixed for W2; persistent config arrives in W3

  // ── Showdown layer (FR-13/14/15/16). Only after the reveal finishes and the hand is over. ──
  const showdownDone = !revealing && view.isOver;
  const winnerSeats = new Set(view.winners.map((w) => w.seat));
  // The single showdown winner whose cards are shown drives the yellow winning-5 + the banner.
  // Fold-out (no shown cards) → winner + nets only, no banner, no card highlight (FR-15).
  const shownWinner =
    showdownDone && view.winners.length === 1
      ? view.seats.find((s) => winnerSeats.has(s.seat) && s.cards && s.cards.length >= 2)
      : undefined;
  let categoryBanner: string | null = null;
  let highlightSet: Set<string> | null = null;
  if (shownWinner && shownWinner.cards && view.board.length >= 3) {
    const hole = shownWinner.cards.slice(0, 2);
    const best = winningCards(hole, view.board);
    highlightSet = new Set(best as string[]);
    categoryBanner = handCategoryLabel([...shownWinner.cards, ...view.board]);
  }

  // Lay the seats out around an oval, hero anchored at the bottom, so the pot/chip stack can sit
  // in the dead center with everyone arranged around it (like a real table).
  const n = view.seats.length;
  const heroIndex = Math.max(0, view.seats.findIndex((s) => s.isHero));
  const RX = 40; // horizontal radius (% of felt)
  const RY = 35; // vertical radius (% of felt) — kept inside so top/bottom seats don't clip
  const seatPosition = (i: number) => {
    const k = (i - heroIndex + n) % n; // 0 = hero, then around the ring
    const theta = Math.PI / 2 + (k * 2 * Math.PI) / n; // 90° points to the bottom
    return {
      left: `${50 + RX * Math.cos(theta)}%`,
      top: `${50 + RY * Math.sin(theta)}%`,
    };
  };

  return (
    <section style={{ padding: 16 }}>
      <div
        style={{
          position: "relative",
          background: "radial-gradient(ellipse at center, var(--felt), var(--felt-deep))",
          borderRadius: "var(--r-lg)",
          height: 580,
          maxWidth: 760,
          margin: "0 auto",
        }}
      >
        {view.seats.map((s, i) => (
          <div
            key={s.seat}
            style={{
              position: "absolute",
              ...seatPosition(i),
              transform: "translate(-50%, -50%)",
            }}
          >
            <Seat
              seat={s}
              lastAction={latest[s.seat] ?? null}
              bigBlind={BIG_BLIND}
              isActing={!revealing && !view.isOver && s.seat === view.toAct}
              isWinner={showdownDone && winnerSeats.has(s.seat)}
              net={showdownDone ? s.net : null}
              highlightCards={shownWinner && s.seat === shownWinner.seat ? highlightSet : null}
            />
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Board cards={view.board} count={snapshot.boardCount} />
          <CenterStack snapshot={snapshot} categoryBanner={categoryBanner} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {revealing ? (
          <p data-testid="opponents-acting" style={{ color: "var(--ink-soft)" }}>
            Opponents acting…
          </p>
        ) : view.isOver ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
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
