// A player seat: name, position, stack, dealer button, and cards (hero face-up; opponents face-down
// until showdown). Folded seats are visually dimmed (spec FR-51, wireframe 01). When given a
// `lastAction`, shows an action badge + (for committed chips) a chip-to-pot animation (obs. #3).
import { TableSeatView } from "@/core/handFlow";
import { Card } from "@/components/table/Card";

export interface SeatAction {
  action: string;
  amount: number;
}

const ACTION_BADGE: Record<string, (amt: number) => { text: string; color: string; chips: boolean }> = {
  fold: () => ({ text: "Fold", color: "var(--mistake)", chips: false }),
  check: () => ({ text: "Check", color: "var(--ink-soft)", chips: false }),
  call: (a) => ({ text: `Call $${a}`, color: "var(--good)", chips: a > 0 }),
  bet: (a) => ({ text: `Bet $${a}`, color: "var(--gold)", chips: a > 0 }),
  raise: (a) => ({ text: `Raise $${a}`, color: "var(--gold)", chips: a > 0 }),
};

function ActionBadge({ action }: { action: SeatAction }) {
  const meta = ACTION_BADGE[action.action]?.(action.amount);
  if (!meta) return null;
  return (
    <div style={{ position: "relative" }}>
      <span
        data-testid="seat-action"
        className="action-badge"
        // key on the action so a new action re-triggers the pop + chip animation
        key={`${action.action}-${action.amount}`}
        style={{
          display: "inline-block",
          marginTop: 6,
          fontSize: 11,
          fontWeight: 700,
          color: "#10231a",
          background: meta.color,
          borderRadius: "var(--r-pill)",
          padding: "1px 8px",
        }}
      >
        {meta.text}
      </span>
      {meta.chips && (
        <span
          key={`chip-${action.action}-${action.amount}`}
          className="chip-token chip-fly"
          aria-hidden
          style={{ left: "50%", top: 0, ["--chip-dest" as string]: "translate(-50%, 56px)" }}
        />
      )}
    </div>
  );
}

export function Seat({ seat, lastAction }: { seat: TableSeatView; lastAction?: SeatAction | null }) {
  return (
    <div
      data-testid="seat"
      data-folded={seat.folded ? "true" : "false"}
      style={{
        position: "relative",
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
      {lastAction && !seat.isHero ? <ActionBadge action={lastAction} /> : null}
    </div>
  );
}
