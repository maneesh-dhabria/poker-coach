// Community cards row (spec FR-51, wireframe 01).
import { Card as CardT } from "@/core/cards";
import { Card } from "@/components/table/Card";

export function Board({ cards }: { cards: CardT[] }) {
  return (
    <div data-testid="board" aria-label="Community cards" style={{ display: "flex", gap: 2 }}>
      {cards.length === 0 ? <span style={{ color: "var(--ink-soft)" }}>—</span> : null}
      {cards.map((c, i) => (
        <Card key={`${c}-${i}`} card={c} />
      ))}
    </div>
  );
}
