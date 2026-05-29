"use client";
// Action bar: renders ONLY the currently legal actions, plus a raise/bet sizing slider clamped to
// [minRaiseTo, maxRaiseTo] (spec FR-04, FR-52, wireframe 01).
import { useState } from "react";
import { Action, LegalActions } from "@/core/engine/gameEngine";
import { Button } from "@/components/ui/Button";

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

  // Folding when you can check for free is strictly dominated — no real client offers it. Hide Fold
  // whenever Check is legal so the only choices are the meaningful ones (check or bet).
  const showFold = legal.actions.includes("fold") && !legal.actions.includes("check");

  return (
    <div data-testid="action-bar" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {showFold && (
        <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: "fold" })}>
          Fold
        </Button>
      )}
      {legal.actions.includes("check") && (
        <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: "check" })}>
          Check
        </Button>
      )}
      {legal.actions.includes("call") && (
        <Button variant="secondary" disabled={disabled} onClick={() => onAction({ type: "call" })}>
          Call ${legal.toCall}
        </Button>
      )}
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
              <Button variant="ghost" size="sm" disabled={disabled} aria-label="Size to half pot" onClick={() => setAmount(quickTo(0.5))}>
                ½
              </Button>
              <Button variant="ghost" size="sm" disabled={disabled} aria-label="Size to three-quarter pot" onClick={() => setAmount(quickTo(0.75))}>
                ¾
              </Button>
              <Button variant="ghost" size="sm" disabled={disabled} aria-label="Size to pot" onClick={() => setAmount(quickTo(1))}>
                Pot
              </Button>
            </span>
          )}
          <span data-testid="bet-size">${sized}</span>
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => onAction({ type: sizingKind, amount: sized })}
          >
            {sizingKind === "raise" ? `Raise to $${sized}` : `Bet $${sized}`}
          </Button>
        </span>
      )}
    </div>
  );
}
