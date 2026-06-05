// A player seat: name, position, stack, dealer button, and cards (hero face-up; opponents face-down
// until showdown). Folded seats are visually dimmed (spec FR-51, wireframe 01). When given a
// `lastAction`, shows an action badge + (for committed chips) a chip-to-pot animation (obs. #3).
import { TableSeatView } from "@/core/handFlow";
import { Card } from "@/components/table/Card";
import { formatMoney } from "@/core/money";
import { useSessionStore } from "@/store/sessionStore";

export interface SeatAction {
  action: string;
  amount: number;
}

const ACTION_BADGE: Record<string, (amt: number) => { text: string; color: string }> = {
  fold: () => ({ text: "Fold", color: "var(--mistake)" }),
  check: () => ({ text: "Check", color: "var(--ink-soft)" }),
  call: (a) => ({ text: `Call $${a}`, color: "var(--good)" }),
  bet: (a) => ({ text: `Bet $${a}`, color: "var(--gold)" }),
  raise: (a) => ({ text: `Raise $${a}`, color: "var(--gold)" }),
};

function ActionBadge({ action }: { action: SeatAction }) {
  const meta = ACTION_BADGE[action.action]?.(action.amount);
  if (!meta) return null;
  return (
    <span
      data-testid="seat-action"
      className="action-badge"
      // key on the action so a new action re-triggers the pop
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
  );
}

export function Seat({
  seat,
  lastAction,
  bigBlind = 2,
  isActing = false,
  isWinner = false,
  net,
  highlightCards,
}: {
  seat: TableSeatView;
  lastAction?: SeatAction | null;
  bigBlind?: number;
  isActing?: boolean;
  isWinner?: boolean;
  net?: number | null;
  highlightCards?: Set<string> | null;
}) {
  const displayUnit = useSessionStore((s) => s.displayUnit);
  const toggleDisplayUnit = useSessionStore((s) => s.toggleDisplayUnit);
  // Per-hand net: explicit prop wins; else fall back to the value on the view (null while live).
  const seatNet = net !== undefined ? net : seat.net;
  const glow = isWinner ? "winner-glow" : isActing ? "acting-glow" : undefined;
  return (
    <div
      data-testid="seat"
      className={glow}
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
      {seat.isHero ? (
        <button
          type="button"
          aria-label="Toggle dollars / big blinds"
          onClick={toggleDisplayUnit}
          style={{
            color: "var(--ink-soft)",
            fontSize: 12,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          {formatMoney(seat.stack, displayUnit, bigBlind)}
        </button>
      ) : (
        <div style={{ color: "var(--ink-soft)", fontSize: 12 }}>
          {formatMoney(seat.stack, displayUnit, bigBlind)}
        </div>
      )}
      {seat.allIn ? (
        <div
          data-testid="seat-allin"
          aria-label="all-in"
          style={{
            display: "inline-block",
            marginTop: 4,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.5,
            color: "#10231a",
            background: "var(--mistake)",
            borderRadius: "var(--r-pill)",
            padding: "1px 7px",
          }}
        >
          ALL-IN
          {seat.allInAmount != null ? ` ${formatMoney(seat.allInAmount, displayUnit, bigBlind)}` : ""}
        </div>
      ) : null}
      <div style={{ display: "flex" }}>
        {seat.cards ? (
          seat.cards.map((c, i) => (
            <Card key={i} card={c} highlighted={highlightCards?.has(c)} />
          ))
        ) : (
          <>
            <Card hidden />
            <Card hidden />
          </>
        )}
      </div>
      {lastAction && !seat.isHero ? <ActionBadge action={lastAction} /> : null}
      {seatNet != null ? (
        <div
          data-testid="seat-net"
          className={`netchip ${seatNet >= 0 ? "net-pos" : "net-neg"}`}
        >
          {seatNet >= 0 ? "+" : ""}
          {formatMoney(seatNet, displayUnit, bigBlind)}
        </div>
      ) : null}
    </div>
  );
}
