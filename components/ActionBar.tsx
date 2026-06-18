"use client";
// Action bar: renders ONLY the currently legal actions, plus a raise/bet sizing slider clamped to
// [minRaiseTo, maxRaiseTo] (spec FR-04, FR-52, wireframe 01).
import { useState } from "react";
import { Action, LegalActions } from "@/core/engine/gameEngine";
import { Button } from "@/components/ui/Button";
import { formatMoney, MoneyUnit } from "@/core/money";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function ActionBar({
  legal,
  onAction,
  disabled,
  pot = 0,
  displayUnit = "usd",
  bigBlind = 2,
  effectiveMaxRaiseTo = 0,
}: {
  legal: LegalActions;
  onAction: (a: Action) => void;
  disabled?: boolean;
  pot?: number;
  // Render amounts in the same unit as the table/banner so the action buttons never show a
  // conflicting dollar figure while the rest of the table is in BB (finding #7).
  displayUnit?: MoneyUnit;
  bigBlind?: number;
  // The largest raise-to level any single still-in opponent could actually match (iter-20 MINOR #3).
  // The slider + button OFFER no more than this so a hero who covers the table never sees an
  // uncallable overbet ("Bet $584" when the most any opponent can match is ~$200). DISPLAY ONLY —
  // engine legality (legal.maxRaiseTo) is untouched, so min-raise / all-in-for-less still work. 0 ⇒
  // no cap supplied (older callers / tests), fall back to the engine max.
  effectiveMaxRaiseTo?: number;
}) {
  const money = (n: number) => formatMoney(n, displayUnit, bigBlind);
  const canRaise = legal.actions.includes("raise");
  const canBet = legal.actions.includes("bet");
  const sizingKind: "raise" | "bet" | null = canRaise ? "raise" : canBet ? "bet" : null;
  // The OFFERED max: the engine's legal all-in, capped to the effective opponent stack so we never
  // offer a size no opponent can call (iter-20 MINOR #3). Never below minRaiseTo (a forced
  // all-in-for-less / min-raise must still be offered). When no cap is supplied, or the hero is the
  // short stack (their all-in is already ≤ the cap), the engine max is used unchanged.
  const offeredMax =
    effectiveMaxRaiseTo > 0
      ? Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, effectiveMaxRaiseTo))
      : legal.maxRaiseTo;
  const [amount, setAmount] = useState(legal.minRaiseTo);

  // Keep the slider value within the current OFFERED band if props changed.
  const sized = clamp(amount, legal.minRaiseTo, offeredMax);

  // Pot-relative quick sizes (spec FR-52). A bet targets a pot-fraction; a raise adds that
  // fraction on top of calling. Always clamped to the OFFERED band, so the result is never illegal
  // and never an uncallable overbet.
  const quickTo = (fraction: number) =>
    clamp(Math.round(pot * fraction) + legal.toCall, legal.minRaiseTo, offeredMax);

  // Folding when you can check for free is strictly dominated — no real client offers it. Hide Fold
  // whenever Check is legal so the only choices are the meaningful ones (check or bet).
  const showFold = legal.actions.includes("fold") && !legal.actions.includes("check");

  return (
    <div className="action-bar" data-testid="action-bar" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center", maxWidth: "100%" }}>
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
          Call {money(legal.toCall)}
        </Button>
      )}
      {sizingKind && (
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="range"
            aria-label="Bet size"
            min={legal.minRaiseTo}
            max={offeredMax}
            value={sized}
            disabled={disabled}
            onChange={(e) =>
              setAmount(clamp(Number(e.target.value), legal.minRaiseTo, offeredMax))
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
          <span data-testid="bet-size">{money(sized)}</span>
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => onAction({ type: sizingKind, amount: sized })}
          >
            {sizingKind === "raise" ? `Raise to ${money(sized)}` : `Bet ${money(sized)}`}
          </Button>
        </span>
      )}
    </div>
  );
}
