"use client";
// The play surface: seats, board, pot, and the hero action bar (spec FR-51, FR-52; wireframe 01).
// Reads the render snapshot from the game store's HandFlow; the hero's action drives the store.
import { useGameStore } from "@/store/gameStore";
import { Seat } from "@/components/table/Seat";
import { Board } from "@/components/table/Board";
import { PotDisplay } from "@/components/table/PotDisplay";
import { ActionBar } from "@/components/ActionBar";

export function PokerTable() {
  const flow = useGameStore((s) => s.flow);
  const busy = useGameStore((s) => s.busy);
  const heroAct = useGameStore((s) => s.heroAct);
  const newHand = useGameStore((s) => s.newHand);
  useGameStore((s) => s.tick); // subscribe so the table re-renders on each change

  if (!flow) return <p style={{ padding: 24 }}>No hand in progress. Deal to begin.</p>;
  const view = flow.tableView();

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
            <Seat key={s.seat} seat={s} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16, gap: 6 }}>
          <PotDisplay pot={view.pot} />
          <Board cards={view.board} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
        {view.isOver ? (
          <div style={{ textAlign: "center" }}>
            <p>
              Hand over. You {view.heroNet! >= 0 ? "won" : "lost"} ${Math.abs(view.heroNet ?? 0)}.
            </p>
            <button type="button" onClick={newHand} style={dealStyle}>
              Next hand
            </button>
          </div>
        ) : view.isHeroTurn ? (
          <ActionBar legal={view.legal} onAction={heroAct} disabled={busy} />
        ) : (
          <p style={{ color: "var(--ink-soft)" }}>Opponents acting…</p>
        )}
      </div>
    </section>
  );
}

const dealStyle: React.CSSProperties = {
  background: "var(--gold)",
  color: "#1b1b1b",
  border: "none",
  borderRadius: "var(--r-pill)",
  padding: "10px 24px",
  fontWeight: 700,
};
