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
  pot = 0,
}: {
  legal: LegalActions;
  onAction: (a: Action) => void;
  disabled?: boolean;
  pot?: number;
}) {
  const canRaise = legal.actions.includes("raise");
  const canBet = legal.actions.includes("bet");
  const sizingKind: "raise" | "bet" | null = canRaise ? "raise" : canBet ? "bet" : null;
  const [amount, setAmount] = useState(legal.minRaiseTo);

  // Keep the slider value within the current legal band if props changed.
  const sized = clamp(amount, legal.minRaiseTo, legal.maxRaiseTo);

  // Pot-relative quick sizes (spec FR-52). A bet targets a pot-fraction; a raise adds that
  // fraction on top of calling. Always clamped to the legal band, so the result is never illegal.
  const quickTo = (fraction: number) =>
    clamp(Math.round(pot * fraction) + legal.toCall, legal.minRaiseTo, legal.maxRaiseTo);

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
          {pot > 0 && (
            <span style={{ display: "flex", gap: 4 }}>
              <button type="button" disabled={disabled} aria-label="Size to half pot" onClick={() => setAmount(quickTo(0.5))} style={quickStyle}>
                ½
              </button>
              <button type="button" disabled={disabled} aria-label="Size to three-quarter pot" onClick={() => setAmount(quickTo(0.75))} style={quickStyle}>
                ¾
              </button>
              <button type="button" disabled={disabled} aria-label="Size to pot" onClick={() => setAmount(quickTo(1))} style={quickStyle}>
                Pot
              </button>
            </span>
          )}
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

const quickStyle: React.CSSProperties = {
  background: "transparent",
  color: "var(--ink-soft)",
  border: "1px solid var(--ink-soft)",
  borderRadius: "var(--r-pill)",
  padding: "4px 10px",
  fontWeight: 600,
  cursor: "pointer",
};
