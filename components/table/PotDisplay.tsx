// Pot size readout (spec FR-51, wireframe 01).
export function PotDisplay({ pot }: { pot: number }) {
  return (
    <div data-testid="pot" style={{ color: "var(--gold)", fontWeight: 700 }}>
      Pot: ${pot}
    </div>
  );
}
