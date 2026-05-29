// Community cards row (spec FR-51, wireframe 01). `count` (optional) limits how many cards show,
// so the board reveals street-by-street in sync with the action-reveal cursor.
import { Card as CardT } from "@/core/cards";
import { Card } from "@/components/table/Card";

export function Board({ cards, count }: { cards: CardT[]; count?: number }) {
  const shown = count === undefined ? cards : cards.slice(0, count);
  return (
    <div data-testid="board" aria-label="Community cards" style={{ display: "flex", gap: 2 }}>
      {shown.length === 0 ? <span style={{ color: "var(--ink-soft)" }}>—</span> : null}
      {shown.map((c, i) => (
        <Card key={`${c}-${i}`} card={c} />
      ))}
    </div>
  );
}
