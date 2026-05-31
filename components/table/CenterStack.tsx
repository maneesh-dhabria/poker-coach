// The central "what was played" zone (spec: central-pot-chip-display design).
// Shows a growing chip pile, the pot total, and a per-round breakdown of who put in what.
// Presentational only — consumes a ReplaySnapshot computed by HandFlow.replayAt (never recomputes).
import { ReplaySnapshot } from "@/core/handFlow";

const MAX_PILE_CHIPS = 12;

const ACTION_LABEL: Record<string, (amt: number) => string> = {
  bet: (a) => `Bet $${a}`,
  call: (a) => `Call $${a}`,
  raise: (a) => `Raise $${a}`,
};

function chipCount(pot: number): number {
  if (pot <= 0) return 0;
  // Roughly one chip per "big-blind-ish" unit, capped so the pile never overflows the center.
  return Math.max(1, Math.min(MAX_PILE_CHIPS, Math.ceil(pot / 4)));
}

export function CenterStack({
  snapshot,
  categoryBanner,
}: {
  snapshot: ReplaySnapshot;
  categoryBanner?: string | null;
}) {
  const chips = chipCount(snapshot.pot);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {categoryBanner ? (
        <div
          data-testid="category-banner"
          style={{
            background: "var(--gold)",
            color: "#1b1b1b",
            fontWeight: 700,
            fontSize: 13,
            borderRadius: "var(--r-pill)",
            padding: "3px 12px",
            marginBottom: 2,
          }}
        >
          {categoryBanner}
        </div>
      ) : null}
      <div key={snapshot.pot} className="chip-pile" aria-hidden>
        {Array.from({ length: chips }).map((_, i) => (
          <span
            key={i}
            data-testid="pile-chip"
            className={`pile-chip${i === chips - 1 ? " pile-chip--new" : ""}`}
          />
        ))}
      </div>
      <div data-testid="pot" style={{ color: "var(--gold)", fontWeight: 700 }}>
        Pot: ${snapshot.pot}
      </div>
      {snapshot.roundContributions.length > 0 && (
        <div
          style={{
            background: "rgba(0,0,0,0.28)",
            border: "1px solid #2a6b52",
            borderRadius: "var(--r-sm)",
            padding: "5px 9px",
            minWidth: 132,
          }}
        >
          <div
            style={{
              color: "var(--ink-soft)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 2,
            }}
          >
            This round
          </div>
          {snapshot.roundContributions.map((c, i) => (
            <div
              key={`${c.seat}-${i}`}
              data-testid="pot-contribution"
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              <span style={{ color: "var(--ink-soft)" }}>{c.name}</span>
              <span style={{ color: "var(--gold)", fontWeight: 700 }}>
                {ACTION_LABEL[c.action]?.(c.amount) ?? `$${c.amount}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
