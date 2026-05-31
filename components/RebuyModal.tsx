"use client";
// Bust → rebuy overlay (spec §11.3, FR-25/FR-29, E1). When the hero busts below a big blind at
// hand-end, this surfaces a choice so the table is never dead: if the lifetime bank can fund a
// top-up, offer Rebuy (+ an auto-rebuy toggle so future busts top up silently); if the bank is
// empty, the only way forward is a fresh table (which resets stacks + session P/L but keeps the
// $1000 starting bank — see core/bankroll.newTable). Presentational: all money math is in the pure
// reducer; this component only reads props and fires callbacks. Amounts go through formatMoney so
// $/BB stays consistent with the rest of the app (D2).
import { MoneyUnit, formatMoney } from "@/core/money";
import { Button } from "@/components/ui/Button";

interface RebuyModalProps {
  open: boolean;
  heroStack: number;
  startingStack: number;
  bank: number;
  autoRebuy?: boolean;
  displayUnit: MoneyUnit;
  bigBlind: number;
  onRebuy: () => void;
  onToggleAuto?: (on: boolean) => void;
  onNewTable: () => void;
}

export function RebuyModal({
  open,
  heroStack,
  startingStack,
  bank,
  autoRebuy = false,
  displayUnit,
  bigBlind,
  onRebuy,
  onToggleAuto,
  onNewTable,
}: RebuyModalProps) {
  if (!open) return null;

  // The bank can fund a rebuy only if it covers at least one big blind — anything less can't seat
  // the hero, so the empty-bank end state (New table) is the only honest option (E1).
  const topUp = Math.max(0, startingStack - heroStack);
  const canFund = bank >= bigBlind;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rebuy-title"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        zIndex: 50,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 380, width: "90%", padding: 24, textAlign: "center" }}
      >
        {canFund ? (
          <>
            <h2 id="rebuy-title" style={{ marginTop: 0, color: "var(--gold)" }}>
              You&apos;re out of chips
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              Top up to {formatMoney(startingStack, displayUnit, bigBlind)} from your bank of{" "}
              {formatMoney(bank, displayUnit, bigBlind)}? This buy-in costs{" "}
              {formatMoney(topUp, displayUnit, bigBlind)}.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
              <Button variant="primary" onClick={onRebuy}>
                Rebuy
              </Button>
              <Button variant="secondary" onClick={onNewTable}>
                New table
              </Button>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 16,
                color: "var(--ink-soft)",
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                aria-label="auto-rebuy"
                checked={autoRebuy}
                onChange={(e) => onToggleAuto?.(e.target.checked)}
              />
              Auto-rebuy when I bust
            </label>
          </>
        ) : (
          <>
            <h2 id="rebuy-title" style={{ marginTop: 0, color: "var(--gold)" }}>
              Out of chips
            </h2>
            <p style={{ color: "var(--ink-soft)" }}>
              Your bank is empty. Start a new table to play on a fresh{" "}
              {formatMoney(startingStack, displayUnit, bigBlind)} bank.
            </p>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <Button variant="primary" onClick={onNewTable}>
                New table
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
