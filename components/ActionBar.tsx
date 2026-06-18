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

  // The UNCLAMPED natural value of a quick size — what the fraction computes BEFORE clamping to the
  // legal band. Used to decide highlighting (iter-24 NIT 1): a button lights up only when the current
  // amount equals its OWN natural value, so a size that merely got clamped to the min-raise floor or
  // the all-in/effective-max ceiling — where several fractions collapse to the same clamped number —
  // does NOT light up every button.
  const quickNatural = (fraction: number) => Math.round(pot * fraction) + legal.toCall;

  // A quick-size button is "active" only while the CURRENT amount equals that fraction's NATURAL
  // (unclamped) computed value AND that natural value is itself in the legal band (so a clamped-only
  // match never lights it up). Derived state, not a remembered last-click (iter-21 NIT 1) — dragging
  // the slider or typing a non-matching value clears the highlight automatically. To guarantee AT MOST
  // ONE button is ever highlighted (iter-24 NIT 1), when several fractions share the same natural value
  // only the SMALLEST fraction (½ before ¾ before Pot) is treated as active; ties otherwise highlight
  // none. Sizes are integers, so the equality is exact.
  const QUICK_FRACTIONS = [0.5, 0.75, 1] as const;
  const isNaturalInBand = (fraction: number) => {
    const nat = quickNatural(fraction);
    return nat >= legal.minRaiseTo && nat <= offeredMax;
  };
  const quickActive = (fraction: number) => {
    if (!isNaturalInBand(fraction) || sized !== quickNatural(fraction)) return false;
    // De-duplicate ties: if a SMALLER fraction also has this exact natural value and is in band, defer
    // to it — only one button (the smallest matching) ever lights up.
    return !QUICK_FRACTIONS.some(
      (f) => f < fraction && isNaturalInBand(f) && quickNatural(f) === quickNatural(fraction),
    );
  };

  // A FINE slider step so a precise size can be dialed by keyboard (iter-22 NIT #8). The default
  // range step is (max−min)/100 — on a deep stack one ArrowRight jumped ~$48, far too coarse. One
  // small blind ($1 at $1/$2) gives single-dollar keyboard control while the min-raise / all-in
  // bounds and the effective-stack cap (offeredMax) stay intact.
  const sliderStep = Math.max(1, Math.round(bigBlind / 2));

  // A subtle OVERBET hint (iter-22 NIT #8): when the chosen size puts MORE than the pot in (the extra
  // beyond calling exceeds the current pot), note it so a newcomer realizes they're betting over the
  // pot — no hard block, the size is still legal. `pot` is the pot before this action.
  const isOverbet = pot > 0 && sized - legal.toCall > pot;

  // Whether this size commits the hero's ENTIRE remaining stack — their all-in (iter-23 MINOR #2). The
  // engine's `legal.maxRaiseTo` is committedStreet + remaining stack, so a raise-to/bet-to of exactly
  // that puts the hero's last chip in. (We compare against the engine max, not the effective-stack-capped
  // `offeredMax`, so an all-in is recognised even when no opponent can cover the full size.) The button
  // word "All-in" warns a newcomer that "Bet $170" busts them — DISPLAY ONLY; bet legality/sizing are
  // untouched, the engine still resolves the size as it always has.
  const isAllIn = sized === legal.maxRaiseTo;

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
            step={sliderStep}
            value={sized}
            disabled={disabled}
            onChange={(e) =>
              setAmount(clamp(Number(e.target.value), legal.minRaiseTo, offeredMax))
            }
          />
          {pot > 0 && (
            <span style={{ display: "flex", gap: 4 }}>
              <Button variant="ghost" size="sm" disabled={disabled} selected={quickActive(0.5)} aria-pressed={quickActive(0.5)} aria-label="Size to half pot" onClick={() => setAmount(quickTo(0.5))}>
                ½
              </Button>
              <Button variant="ghost" size="sm" disabled={disabled} selected={quickActive(0.75)} aria-pressed={quickActive(0.75)} aria-label="Size to three-quarter pot" onClick={() => setAmount(quickTo(0.75))}>
                ¾
              </Button>
              <Button variant="ghost" size="sm" disabled={disabled} selected={quickActive(1)} aria-pressed={quickActive(1)} aria-label="Size to pot" onClick={() => setAmount(quickTo(1))}>
                Pot
              </Button>
            </span>
          )}
          <span data-testid="bet-size">{money(sized)}</span>
          {isOverbet && (
            <span
              data-testid="overbet-hint"
              title="This is more than the pot — an overbet. It's allowed, but it risks a lot to win the current pot."
              style={{ fontSize: "0.75rem", color: "var(--thin, #b8860b)", whiteSpace: "nowrap" }}
            >
              overbet
            </span>
          )}
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => onAction({ type: sizingKind, amount: sized })}
          >
            {/* When the size commits the hero's last chip, the button leads with "All-in" so a newcomer
                knows this bet/raise busts their stack (iter-23 MINOR #2). Otherwise the normal
                "Bet $X" / "Raise to $X" label. The amount shown is unchanged. */}
            {isAllIn
              ? `All-in ${money(sized)}`
              : sizingKind === "raise"
                ? `Raise to ${money(sized)}`
                : `Bet ${money(sized)}`}
          </Button>
          {isAllIn && (
            <span
              data-testid="all-in-hint"
              style={{ fontSize: "0.75rem", color: "var(--thin, #b8860b)", whiteSpace: "nowrap" }}
            >
              commits your whole stack
            </span>
          )}
        </span>
      )}
    </div>
  );
}
