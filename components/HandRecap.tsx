// End-of-hand review (observation #4: "more details, especially at the end of the hand"). Lists
// every hero decision in the just-finished hand with its verdict and the plain one-liner, so the
// user can see the whole hand's story in one place. Reads the embedded DecisionAnalysis as ground
// truth (§17) — it never recomputes verdicts. Honesty: "chart-based" only when gtoClaim is true.
import { HeroDecisionRecord } from "@/core/history/handRecord";
import { formatMoney, MoneyUnit } from "@/core/money";

const BIG_BLIND = 2; // the table plays $1/$2, so 1 BB = $2

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

// Format a money figure in the session's display unit ($/BB) so the recap never mixes units with
// the rest of the screen (finding #2): the live feedback, buttons, and table all honor the toggle.
function actionLabel(a: { action: string; amount: number }, unit: MoneyUnit): string {
  const money = (n: number) => formatMoney(n, unit, BIG_BLIND);
  switch (a.action) {
    case "fold":
      return "folded";
    case "check":
      return "checked";
    case "call":
      return `called ${money(a.amount)}`;
    case "bet":
      return `bet ${money(a.amount)}`;
    case "raise":
      return `raised to ${money(a.amount)}`;
    default:
      return a.action;
  }
}

// Plain result wording. A net of $0 (e.g. after a fold) isn't "winning $0" — say it neutrally so
// folding doesn't read as a win (finding #9). Won/lost otherwise, in the display unit (finding #2).
function resultLine(heroNet: number | null, unit: MoneyUnit): string {
  const net = heroNet ?? 0;
  const money = (n: number) => formatMoney(n, unit, BIG_BLIND);
  if (net > 0) return `Result: you won ${money(net)}.`;
  if (net < 0) return `Result: you lost ${money(Math.abs(net))}.`;
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
  displayUnit = "usd",
  handComplete = true,
}: {
  decisions: HeroDecisionRecord[];
  heroNet: number | null;
  // Render money in dollars or big blinds — mirrors the table/banner toggle so the recap never shows
  // a conflicting unit (finding #2). Defaults to usd so existing $-expecting callers/tests still pass.
  displayUnit?: MoneyUnit;
  // The end-of-hand CONCLUSION (Result line + /poker-coach pointer + reconcile/variance notes) is
  // only meaningful once the hand is actually over. The running decision list stays live; the
  // conclusion block is gated on this so it never appears mid-hand (finding #3). Defaults to true so
  // existing callers/tests that don't thread hand state still see the conclusion.
  handComplete?: boolean;
}) {
  if (decisions.length === 0) return null;
  const c = counts(decisions);
  const flagged = c.mistake + c.thin > 0;

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
                  {actionLabel(d.heroAction, displayUnit)}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-soft)", marginLeft: 6 }}>
                    · pot {formatMoney(Math.round(d.spot.potBefore), displayUnit, BIG_BLIND)}
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

      {/* End-of-hand CONCLUSION — only shown once the hand is actually over, so a final "Result"
          line + /poker-coach pointer + reconcile/variance notes never appear mid-hand and make the
          user think the hand has ended (finding #3). The decision list above stays live. */}
      {handComplete ? (
        <>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 12 }}>
            {resultLine(heroNet, displayUnit)} For a deeper plain-language write-up of this hand, run{" "}
            <code>/poker-coach last</code> in your terminal, then open the Coaching panel and hit Refresh.
          </p>

          {/* Reconcile result vs verdict: winning a hand with a flagged decision feels contradictory,
              so spell out that the verdicts grade the decision, not this one outcome. */}
          {heroNet !== null && heroNet >= 0 && flagged ? (
            <p data-testid="recap-reconcile" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
              You won this hand, but the {c.mistake > 0 ? "❌" : "⚠️"} above flags a play that loses money
              on average — results swing hand to hand, so we grade the decision, not the outcome.
            </p>
          ) : null}

          {/* The mirror case (finding #1): you LOST the hand but every graded decision was sound (no
              ❌ mistake). A trusting newcomer who saw "~92%" then lost their stack needs the variance
              bridge surfaced by DEFAULT, not buried in a "Show the numbers" expander. */}
          {heroNet !== null && heroNet < 0 && c.mistake === 0 ? (
            <p data-testid="recap-variance" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
              Good decision, unlucky result — that&apos;s variance. We grade the decision, not the
              outcome: these win % are long-run averages, not this one hand. Played well, lost anyway —
              that happens, and it evens out over time.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
