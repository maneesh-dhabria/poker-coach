// Instant per-decision feedback (spec FR-53, FR-27, D7, NFR-04; wireframe 01). Renders the verdict
// badge, the plain-language explanation, and — at equity/strict depth only — an equity bar with the
// "needed to call" marker, a plain why-this-verdict line, and an optional numbers breakdown.
// Renders nothing when feedback is disabled. Honesty (§17): "chart-based" shows only when gtoClaim.
import { DecisionAnalysis } from "@/core/analysis/types";
import { MentalMathSection } from "@/components/MentalMathSection";
import { formatMoney, MoneyUnit } from "@/core/money";

const BIG_BLIND = 2; // the table plays $1/$2, so 1 BB = $2

const VERDICT_META = {
  good: { icon: "✅", label: "Good", color: "var(--good)" },
  thin: { icon: "⚠️", label: "Thin", color: "var(--thin)" },
  mistake: { icon: "❌", label: "Mistake", color: "var(--mistake)" },
} as const;

// Humanize a concept tag enum ("call_too_wide" → "call too wide") for a small context chip.
function tagLabel(tag: string): string {
  return tag.replace(/_/g, " ");
}

function VerdictBadge({ verdict }: { verdict: DecisionAnalysis["verdict"] }) {
  const m = VERDICT_META[verdict];
  return (
    <span
      data-testid="verdict-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: m.color,
        color: "#10231a",
        borderRadius: "var(--r-pill)",
        padding: "2px 12px",
        fontWeight: 700,
      }}
    >
      {m.icon} {m.label}
    </span>
  );
}

function EquityBar({ equityPct, neededPct }: { equityPct: number; neededPct: number | null }) {
  const winning = neededPct === null || equityPct >= neededPct;
  return (
    <div
      data-testid="equity-bar"
      style={{ position: "relative", background: "var(--panel)", borderRadius: "var(--r-pill)", height: 16 }}
    >
      <div
        data-testid="equity-fill"
        style={{
          width: `${equityPct}%`,
          height: "100%",
          background: winning ? "var(--good)" : "var(--thin)",
          borderRadius: "var(--r-pill)",
          transition: "width 300ms ease",
        }}
      />
      {neededPct !== null && (
        <span
          data-testid="equity-needed"
          aria-label={`needed ${Math.round(neededPct)}%`}
          title={`needed ${Math.round(neededPct)}%`}
          style={{
            position: "absolute",
            top: -3,
            bottom: -3,
            left: `${neededPct}%`,
            width: 2,
            background: "var(--ink)",
          }}
        />
      )}
    </div>
  );
}

// One plain sentence that explains WHY the verdict landed where it did, in win-vs-need terms.
function whyLine(eq: number, need: number | null): string {
  if (need === null) return "";
  const win = Math.round(eq);
  const n = Math.round(need);
  if (eq >= need) {
    return `You win ~${win}% but only need ~${n}% — that gap is why continuing makes money over time.`;
  }
  return `You win ~${win}% but need ~${n}% — you come up short, so this loses money over time.`;
}

function money(n: number, unit: MoneyUnit): string {
  return formatMoney(n, unit, BIG_BLIND);
}

const STREET_WORD: Record<string, string> = {
  preflop: "preflop",
  flop: "flop",
  turn: "turn",
  river: "river",
};

// Anchors the card to the decision it describes: by the time the user reads this, the bots have
// acted and the board/pot on the table have moved on, so we say which street + pot the numbers are
// about ("when you acted") to kill the "these % don't match the screen" confusion.
function contextLine(ctx: { street: string; potBefore: number }, unit: MoneyUnit): string {
  const word = STREET_WORD[ctx.street] ?? ctx.street;
  return `Your ${word} decision · pot was ${money(ctx.potBefore, unit)} when you acted`;
}

export function FeedbackPanel({
  analysis,
  enabled,
  context,
  displayUnit = "usd",
}: {
  analysis: DecisionAnalysis | null;
  enabled: boolean;
  context?: { street: string; potBefore: number; toCall: number };
  // Whether to render money in dollars or big blinds — mirrors the table/banner toggle so the panel
  // never shows a conflicting unit (finding #7). The verdict/equity come from analysis as before.
  displayUnit?: MoneyUnit;
}) {
  if (!enabled || !analysis) return null;
  const showNumbers = analysis.coachingDepth !== "conceptual";
  const eq = analysis.numbers.equityPct;
  const need = analysis.numbers.potOddsPct;
  const ev = analysis.numbers.ev;
  const unit = displayUnit;

  return (
    <aside
      data-testid="feedback-panel"
      className="card"
      style={{ maxWidth: 420 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <VerdictBadge verdict={analysis.verdict} />
        {analysis.gtoClaim ? (
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>chart-based</span>
        ) : null}
      </div>

      {context ? (
        <div
          data-testid="feedback-context"
          style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}
        >
          {contextLine(context, unit)}
        </div>
      ) : null}

      {analysis.conceptTags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {analysis.conceptTags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                color: "var(--ink-soft)",
                border: "1px solid var(--ink-soft)",
                borderRadius: "var(--r-pill)",
                padding: "1px 8px",
              }}
            >
              {tagLabel(t)}
            </span>
          ))}
        </div>
      )}

      <p data-testid="plain-math" style={{ marginTop: 10, lineHeight: 1.5 }}>
        {analysis.plainExplanation}
      </p>

      {showNumbers && eq !== null ? (
        <div style={{ marginTop: 8 }}>
          <EquityBar equityPct={eq} neededPct={need} />
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
            You win ~{Math.round(eq)}%
            {need !== null ? ` · need ~${Math.round(need)}%` : ""}
          </div>
          {need !== null && (
            <p style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{whyLine(eq, need)}</p>
          )}
          {analysis.assumedRange ? (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
              vs {analysis.assumedRange}
            </div>
          ) : null}

          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink-soft)" }}>
              Show the numbers
            </summary>
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6, display: "grid", gap: 2 }}>
              <span>Average result if you fold: {money(ev.fold, unit)}</span>
              <span>Average result if you call: {money(ev.call, unit)}</span>
              <span>Average result if you raise: {money(ev.raise, unit)}</span>
              <span style={{ marginTop: 4 }}>
                Higher is better — these are long-run averages, not this one hand.
              </span>
            </div>
          </details>
        </div>
      ) : null}

      {/* Mental Math walk-through — a collapsible coaching section on the live hand (spec §4). */}
      <MentalMathSection enabled={enabled} />
    </aside>
  );
}
