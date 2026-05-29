"use client";
// Action bar: renders ONLY the currently legal actions, plus a raise/bet sizing slider clamped to
// [minRaiseTo, maxRaiseTo] (spec FR-04, FR-52, wireframe 01).
import { useState } from "react";
import { Action, LegalActions } from "@/core/engine/gameEngine";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function ActionBar({
  legal,
  onAction,
  disabled,
}: {
  legal: LegalActions;
  onAction: (a: Action) => void;
  disabled?: boolean;
}) {
  const canRaise = legal.actions.includes("raise");
  const canBet = legal.actions.includes("bet");
  const sizingKind: "raise" | "bet" | null = canRaise ? "raise" : canBet ? "bet" : null;
  const [amount, setAmount] = useState(legal.minRaiseTo);

  // Keep the slider value within the current legal band if props changed.
  const sized = clamp(amount, legal.minRaiseTo, legal.maxRaiseTo);

  const btn = (label: string, a: Action) => (
    <button type="button" disabled={disabled} onClick={() => onAction(a)} style={btnStyle}>
      {label}
    </button>
  );

  return (
    <div data-testid="action-bar" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {legal.actions.includes("fold") && btn("Fold", { type: "fold" })}
      {legal.actions.includes("check") && btn("Check", { type: "check" })}
      {legal.actions.includes("call") && btn(`Call $${legal.toCall}`, { type: "call" })}
      {sizingKind && (
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="range"
            aria-label="Bet size"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            value={sized}
            disabled={disabled}
            onChange={(e) =>
              setAmount(clamp(Number(e.target.value), legal.minRaiseTo, legal.maxRaiseTo))
            }
          />
          <span data-testid="bet-size">${sized}</span>
          {btn(sizingKind === "raise" ? `Raise to $${sized}` : `Bet $${sized}`, {
            type: sizingKind,
            amount: sized,
          })}
        </span>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "var(--panel-2)",
  color: "var(--ink)",
  border: "1px solid var(--gold)",
  borderRadius: "var(--r-pill)",
  padding: "8px 16px",
  fontWeight: 600,
};
