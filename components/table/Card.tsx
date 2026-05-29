// A single playing card (or a face-down back). Presentational; spec FR-51, wireframe 01.
import { Card as CardT, rankOf, suitOf } from "@/core/cards";

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };
const RED = new Set(["h", "d"]);

export function Card({ card, hidden }: { card?: CardT; hidden?: boolean }) {
  if (hidden || !card) {
    return (
      <span
        data-testid="card-back"
        style={{
          display: "inline-block",
          width: 34,
          height: 48,
          borderRadius: "var(--r-sm)",
          background: "linear-gradient(135deg,#27413a,#16241f)",
          border: "1px solid #0a2c20",
          margin: 2,
        }}
      />
    );
  }
  const suit = suitOf(card);
  return (
    <span
      data-testid="card"
      aria-label={`${rankOf(card)}${SUIT_SYMBOL[suit]}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 48,
        borderRadius: "var(--r-sm)",
        background: "var(--card-face)",
        color: RED.has(suit) ? "var(--hearts)" : "var(--spades)",
        fontWeight: 700,
        margin: 2,
      }}
    >
      {rankOf(card)}
      {SUIT_SYMBOL[suit]}
    </span>
  );
}
