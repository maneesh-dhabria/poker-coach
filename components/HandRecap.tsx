// End-of-hand review (observation #4: "more details, especially at the end of the hand"). Lists
// every hero decision in the just-finished hand with its verdict and the plain one-liner, so the
// user can see the whole hand's story in one place. Reads the embedded DecisionAnalysis as ground
// truth (§17) — it never recomputes verdicts. Honesty: "chart-based" only when gtoClaim is true.
import { HeroDecisionRecord } from "@/core/history/handRecord";

const VERDICT_META = {
  good: { icon: "✅", color: "var(--good)" },
  thin: { icon: "⚠️", color: "var(--thin)" },
  mistake: { icon: "❌", color: "var(--mistake)" },
} as const;

const STREET_LABEL: Record<string, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
};

function actionLabel(a: { action: string; amount: number }): string {
  switch (a.action) {
    case "fold":
      return "folded";
    case "check":
      return "checked";
    case "call":
      return `called $${a.amount}`;
    case "bet":
      return `bet $${a.amount}`;
    case "raise":
      return `raised to $${a.amount}`;
    default:
      return a.action;
  }
}

// Plain result wording. A net of $0 (e.g. after a fold) isn't "winning $0" — say it neutrally so
// folding doesn't read as a win (finding #9). Won/lost otherwise, with the dollar amount.
function resultLine(heroNet: number | null): string {
  const net = heroNet ?? 0;
  if (net > 0) return `Result: you won $${net}.`;
  if (net < 0) return `Result: you lost $${Math.abs(net)}.`;
  return "Result: no money won or lost this hand.";
}

function counts(decisions: HeroDecisionRecord[]) {
  const c = { good: 0, thin: 0, mistake: 0 };
  for (const d of decisions) c[d.analysis.verdict] += 1;
  return c;
}

export function HandRecap({
  decisions,
  heroNet,
}: {
  decisions: HeroDecisionRecord[];
  heroNet: number | null;
}) {
  if (decisions.length === 0) return null;
  const c = counts(decisions);

  return (
    <section data-testid="hand-recap" className="card" style={{ marginTop: 16, textAlign: "left", maxWidth: 560 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Hand review</h2>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {c.good} good · {c.thin} thin · {c.mistake} mistake{c.mistake === 1 ? "" : "s"}
        </span>
      </div>

      <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
        {decisions.map((d, i) => {
          const m = VERDICT_META[d.analysis.verdict];
          return (
            <li
              key={d.decisionId ?? i}
              data-testid="recap-decision"
              style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
            >
              <span
                aria-hidden
                style={{
                  flex: "0 0 auto",
                  width: 22,
                  textAlign: "center",
                  fontSize: 15,
                  marginTop: 1,
                }}
                title={d.analysis.verdict}
              >
                {m.icon}
              </span>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 600 }}>
                  <span style={{ color: m.color }}>{STREET_LABEL[d.street] ?? d.street}</span> — you{" "}
                  {actionLabel(d.heroAction)}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-soft)", marginLeft: 6 }}>
                    · pot ${Math.round(d.spot.potBefore)}
                  </span>
                  {d.analysis.gtoClaim ? (
                    <span style={{ fontSize: 11, color: "var(--ink-soft)", marginLeft: 6 }}>
                      chart-based
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  {d.analysis.plainExplanation}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
        {resultLine(heroNet)} For a deeper plain-language write-up of this hand, run{" "}
        <code>/poker-coach last</code> in your terminal, then open the Coaching panel and hit Refresh.
      </p>

      {/* Reconcile result vs verdict: winning a hand with a flagged decision feels contradictory,
          so spell out that the verdicts grade the decision, not this one outcome. */}
      {heroNet !== null && heroNet >= 0 && c.mistake + c.thin > 0 ? (
        <p data-testid="recap-reconcile" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
          You won this hand, but the {c.mistake > 0 ? "❌" : "⚠️"} above flags a play that loses money
          on average — results swing hand to hand, so we grade the decision, not the outcome.
        </p>
      ) : null}
    </section>
  );
}
