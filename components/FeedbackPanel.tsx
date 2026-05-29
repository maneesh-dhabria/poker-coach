// Instant per-decision feedback (spec FR-53, FR-27, D7, NFR-04; wireframe 01). Renders the verdict
// badge, the plain-language explanation, and — at equity/strict depth only — an equity bar with the
// "needed to call" marker and the assumed-range note. Renders nothing when feedback is disabled.
import { DecisionAnalysis } from "@/core/analysis/types";

const VERDICT_META = {
  good: { icon: "✅", label: "Good", color: "var(--good)" },
  thin: { icon: "⚠️", label: "Thin", color: "var(--thin)" },
  mistake: { icon: "❌", label: "Mistake", color: "var(--mistake)" },
} as const;

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
          background: "var(--good)",
          borderRadius: "var(--r-pill)",
        }}
      />
      {neededPct !== null && (
        <span
          data-testid="equity-needed"
          aria-label={`needed ${Math.round(neededPct)}%`}
          title={`needed ${Math.round(neededPct)}%`}
          style={{
            position: "absolute",
            top: -2,
            bottom: -2,
            left: `${neededPct}%`,
            width: 2,
            background: "var(--ink)",
          }}
        />
      )}
    </div>
  );
}

export function FeedbackPanel({
  analysis,
  enabled,
}: {
  analysis: DecisionAnalysis | null;
  enabled: boolean;
}) {
  if (!enabled || !analysis) return null;
  const showNumbers = analysis.coachingDepth !== "conceptual";
  const eq = analysis.numbers.equityPct;

  return (
    <aside
      data-testid="feedback-panel"
      style={{ background: "var(--panel)", borderRadius: "var(--r-md)", padding: 16, maxWidth: 420 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <VerdictBadge verdict={analysis.verdict} />
        {analysis.gtoClaim ? (
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>chart-based</span>
        ) : null}
      </div>

      <p data-testid="plain-math" style={{ marginTop: 10 }}>
        {analysis.plainExplanation}
      </p>

      {showNumbers && eq !== null ? (
        <div style={{ marginTop: 8 }}>
          <EquityBar equityPct={eq} neededPct={analysis.numbers.potOddsPct} />
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
            You win ~{Math.round(eq)}%
            {analysis.numbers.potOddsPct !== null ? ` · need ~${Math.round(analysis.numbers.potOddsPct)}%` : ""}
          </div>
          {analysis.assumedRange ? (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
              vs {analysis.assumedRange}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
