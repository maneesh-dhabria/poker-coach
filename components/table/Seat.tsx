// A player seat: name, position, stack, dealer button, and cards (hero face-up; opponents face-down
// until showdown). Folded seats are visually dimmed (spec FR-51, wireframe 01).
import { TableSeatView } from "@/core/handFlow";
import { Card } from "@/components/table/Card";

export function Seat({ seat }: { seat: TableSeatView }) {
  return (
    <div
      data-testid="seat"
      data-folded={seat.folded ? "true" : "false"}
      style={{
        opacity: seat.folded ? 0.4 : 1,
        background: seat.isHero ? "var(--panel-2)" : "var(--panel)",
        border: `1px solid ${seat.isHero ? "var(--gold)" : "#0a2c20"}`,
        borderRadius: "var(--r-md)",
        padding: 8,
        minWidth: 120,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{seat.name}</strong>
        <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>{seat.position}</span>
        {seat.isButton ? (
          <span
            aria-label="dealer button"
            style={{
              background: "var(--gold)",
              color: "#1b1b1b",
              borderRadius: "var(--r-pill)",
              padding: "0 6px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            D
          </span>
        ) : null}
      </div>
      <div style={{ color: "var(--ink-soft)", fontSize: 12 }}>${seat.stack}</div>
      <div style={{ display: "flex" }}>
        {seat.cards ? (
          seat.cards.map((c, i) => <Card key={i} card={c} />)
        ) : (
          <>
            <Card hidden />
            <Card hidden />
          </>
        )}
      </div>
    </div>
  );
}
