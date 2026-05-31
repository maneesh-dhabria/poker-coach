"use client";
// Play-screen header (spec §11.1, FR-26/27/28, NFR-05). Shows the running Session P/L and the
// lifetime Bank — both via the shared formatMoney so $/BB stays consistent across the app (D2) — plus
// New table / New hand. Session P/L pairs an ▲/▼ glyph with the sign so meaning never relies on
// colour alone (NFR-05). Real <button>s for a11y.
import { MoneyUnit, formatMoney } from "@/core/money";
import { Button } from "@/components/ui/Button";

interface HeaderBarProps {
  sessionPnl: number;
  bank: number;
  displayUnit: MoneyUnit;
  bigBlind: number;
  onNewTable?: () => void;
  onNewHand?: () => void;
}

export function HeaderBar({
  sessionPnl,
  bank,
  displayUnit,
  bigBlind,
  onNewTable,
  onNewHand,
}: HeaderBarProps) {
  const up = sessionPnl >= 0;
  const arrow = up ? "▲" : "▼";
  const pnlColor = up ? "var(--good, #34d399)" : "var(--bad, #f87171)";
  return (
    <header
      style={{
        flex: "0 0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }} aria-label="session profit and loss">
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink-soft)" }}>
            Session
          </span>
          <span style={{ fontWeight: 600, color: pnlColor }}>
            <span aria-hidden="true">{arrow}</span> {formatMoney(sessionPnl, displayUnit, bigBlind)}
          </span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }} aria-label="lifetime bank">
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ink-soft)" }}>
            Bank
          </span>
          <span style={{ fontWeight: 600 }}>{formatMoney(bank, displayUnit, bigBlind)}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={onNewTable}>
          New table
        </Button>
        <Button variant="primary" size="sm" onClick={onNewHand}>
          New hand
        </Button>
      </div>
    </header>
  );
}
