// Instant per-decision feedback (spec FR-53, FR-27, D7, NFR-04; wireframe 01). Renders the verdict
// badge, the plain-language explanation, and — at equity/strict depth only — an equity bar with the
// "needed to call" marker, a plain why-this-verdict line, and an optional numbers breakdown.
// Renders nothing when feedback is disabled. Honesty (§17): "chart-based" shows only when gtoClaim.
import { DecisionAnalysis } from "@/core/analysis/types";
import { formatExplanation } from "@/core/analysis/explain";
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

function VerdictBadge({
  verdict,
  conceptTags,
}: {
  verdict: DecisionAnalysis["verdict"];
  conceptTags: DecisionAnalysis["conceptTags"];
}) {
  const m = VERDICT_META[verdict];
  // An oversized preflop OPEN grades ⚠️ thin, but "Thin" reads as thin VALUE and confuses (iter-09
  // #6a). When the oversize tag is present, show the clearer "Oversized" label while keeping the same
  // ⚠️ icon / thin severity color.
  const label = conceptTags.includes("preflop_oversize") ? "Oversized" : m.label;
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
      {m.icon} {label}
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
// This pot-odds "you only need ~Y% / makes money over time" framing is a CALL/draw template: it is
// only meaningful when the hero is facing a bet and deciding whether to continue (call). It must
// NEVER be shown for a bet/raise — there "need ~0%" is meaningless and "continuing makes money over
// time" directly contradicts a ❌ bet verdict (iter-03 #2). The caller gates this with `isCallSpot`.
function whyLine(eq: number, need: number | null): string {
  if (need === null) return "";
  const win = Math.round(eq);
  const n = Math.round(need);
  if (eq >= need) {
    return `You win ~${win}% but only need ~${n}% — that gap is why continuing makes money over time.`;
  }
  return `You win ~${win}% but need ~${n}% — you come up short, so this loses money over time.`;
}

// Which EV rows to list — ONLY the actions actually legal in this spot (iter-03 #8, iter-06 #4).
//   • facing a bet (toCall > 0): fold / call / raise.
//   • preflop OPEN-raise (hero raised first-in, no bet to call): fold / raise — preflop there's a
//     blind to fold and no check option, so a "check" row is a phantom action (the reviewer's #4),
//     and the aggressive line is labeled "raise". (A limp to call ⇒ toCall > 0 ⇒ facing-a-bet case.)
//   • unopened POSTFLOP spot (no bet to call — a check or a lead bet): check / bet. There's no fold
//     when checking is free, so the alternative to betting is checking, not folding.
// Returns label + value pairs in the verb the hero would actually use.
function evRows(
  ev: { fold: number; call: number; raise: number },
  facingBet: boolean,
  preflopOpen: boolean,
): { label: string; value: number }[] {
  if (facingBet) {
    return [
      { label: "fold", value: ev.fold },
      { label: "call", value: ev.call },
      { label: "raise", value: ev.raise },
    ];
  }
  // Preflop first-in open-raise: the choices were fold the blind or raise — never "check" (#4).
  if (preflopOpen) {
    return [
      { label: "fold", value: ev.fold },
      { label: "raise", value: ev.raise },
    ];
  }
  // Unopened postflop spot: checking takes a free look (its long-run value is the would-be "call"
  // line — taking the pot to showdown without paying), and betting is the aggressive line.
  return [
    { label: "check", value: ev.call },
    { label: "bet", value: ev.raise },
  ];
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
  priorDecision = null,
}: {
  analysis: DecisionAnalysis | null;
  enabled: boolean;
  context?: { street: string; potBefore: number; toCall: number; action?: string };
  // Whether to render money in dollars or big blinds — mirrors the table/banner toggle so the panel
  // never shows a conflicting unit (finding #7). The verdict/equity come from analysis as before.
  displayUnit?: MoneyUnit;
  // When set, this verdict describes a PRIOR decision while the hero is now deciding a later street
  // (iter-09 #3). Instead of blanking the panel (which hid the equity bar / Mental Math from
  // instant-feedback users), we keep it visible but RE-LABEL it "Your last decision — <street>" with
  // a line noting the current pending street — so it can't be mistaken for the spot in front of them.
  priorDecision?: { pendingStreet: string } | null;
}) {
  if (!enabled || !analysis) return null;
  const depth = analysis.coachingDepth;
  // Depth-aware presentation (iter-03 #7). The verdict + plain sentence come from analysis (the
  // single source). What VARIES by depth is how much numeric scaffolding we surface around it:
  //   • conceptual — plain words only: NO equity %, NO "chart-based" badge, NO concept-tag jargon.
  //   • equity     — lead with the win-rate: show the equity bar + %, the EV table, the why-line.
  //   • strict     — the chart/GTO citation (already in the plain sentence); the "chart-based" badge
  //                  is allowed, but we do NOT surface raw equity %s (they belong to the equity tier).
  const showEquity = depth === "equity";
  const showJargon = depth !== "conceptual"; // badge + concept-tag chips are chart/odds jargon
  const eq = analysis.numbers.equityPct;
  const need = analysis.numbers.potOddsPct;
  const ev = analysis.numbers.ev;
  const unit = displayUnit;

  // Is the hero facing a bet and deciding whether to continue (call/fold), vs taking the initiative
  // (bet/raise) or acting unopened? The pot-odds "you only need ~Y% / makes money" framing and the
  // "call" EV row apply ONLY to a facing-a-bet continue decision (iter-03 #2, #8).
  const action = context?.action;
  const isAggressive = action === "bet" || action === "raise";
  const facingBet = (context?.toCall ?? (need !== null ? 1 : 0)) > 0 && !isAggressive;
  // A preflop first-in open-raise (no bet to call): its EV table is fold/raise, not check/bet (#4).
  const preflopOpen = !facingBet && isAggressive && context?.street === "preflop";
  // The branch the verdict actually came from (iter-09 #1). A PREFLOP CHART decision (kind ===
  // "preflop", gtoClaim true) is graded by the chart for playability/position reasons that one-street
  // pot-odds math doesn't capture — so the pot-odds "you only need ~Y% / makes money over time"
  // whyLine, the equity-bar "need ~%" marker, AND the EV "Show the numbers" table must NOT fire there:
  // a SB folding to the BB is technically "facing a bet", and those frames would praise calling/raising
  // on a card whose verdict is "the standard play is to fold". The price frames belong to the postflop
  // PRICE branch (a real facing-a-bet continue decision); the EV table is also fine on the confirmed
  // postflop value-check / bet spots — so we EXCLUDE the preflop chart branch rather than restrict to
  // price only, leaving every postflop EV table the reviewer confirmed correct (Hand-1 river check,
  // Hand-4 river call) intact.
  const kind = analysis.explanationInput?.kind;
  const isPreflopChart = kind === "preflop";
  // Show the win-vs-need headline only on a genuine facing-a-bet PRICE decision. On a bet/raise, an
  // unopened spot, OR a preflop chart spot the "you only need ~Y% / makes money over time" framing is
  // meaningless or contradicts the verdict (iter-03 #2, iter-09 #1), so it is never rendered there.
  const showWhyLine = !isPreflopChart && facingBet && need !== null;
  // The EV "Show the numbers" mini-table is a price/odds frame: never show it on a preflop chart card
  // so a preflop fold never pairs a "fold $0 · call $1 · raise $1" table with a "folding is standard"
  // verdict (iter-09 #1). It still shows on every postflop facing-a-bet / bet / check spot.
  const showEvTable = !isPreflopChart;

  return (
    <aside
      data-testid="feedback-panel"
      className="card"
      style={{ maxWidth: 420 }}
    >
      {/* Prior-decision banner (iter-09 #3): this verdict/equity/Mental-Math describes the hero's LAST
          decision; they're now deciding a later street. Clearly labeled so it can't be read as the
          current spot — it updates the moment they act. */}
      {priorDecision ? (
        <div
          data-testid="feedback-prior"
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            marginBottom: 10,
            paddingBottom: 8,
            borderBottom: "1px solid #2a3a32",
          }}
        >
          <strong style={{ color: "var(--ink)" }}>
            Your last decision — {STREET_WORD[context?.street ?? ""] ?? context?.street ?? "previous street"}
          </strong>
          <div style={{ marginTop: 2 }}>
            You&apos;re now deciding your {priorDecision.pendingStreet}; this updates when you act.
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <VerdictBadge verdict={analysis.verdict} conceptTags={analysis.conceptTags} />
        {/* "chart-based" is a STRICT-mode badge (iter-04 #7): in Strict the chart IS the lens, so the
            badge belongs; in Equity the win-rate framing leads (the sentence may still note the chart
            agrees — honesty preserved — but the badge mustn't read as Strict-mode language); in
            Conceptual ("plain words, no numbers") it's suppressed entirely. Honest only when gtoClaim. */}
        {analysis.gtoClaim && depth === "strict" ? (
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

      {/* Concept-tag chips ("preflop chart deviation", etc.) are chart/odds jargon — hidden at
          conceptual depth, which promises plain words only (#7). */}
      {showJargon && analysis.conceptTags.length > 0 && (
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

      {/* Render the explanation sentence in the session's display unit (iter-04 #3): in BB mode the
          "$108 to win $560" cost/pot amounts come out in BB, so the prose no longer mixes dollars
          with a BB header/badge. This re-formats via the pure builder (presentation only) — the
          verdict and the canonical stored sentence are untouched. */}
      <p data-testid="plain-math" style={{ marginTop: 10, lineHeight: 1.5 }}>
        {formatExplanation(analysis, unit, BIG_BLIND)}
      </p>

      {showEquity && eq !== null ? (
        <div style={{ marginTop: 8 }}>
          {/* The "needed %" marker is a CALL/draw concept — only meaningful facing a bet. On a
              bet/raise (or unopened) spot we drop it so the bar is a pure win-% bar and no stray
              "needed 0%" tick contradicts the (correctly suppressed) pot-odds headline (#2). */}
          <EquityBar equityPct={eq} neededPct={showWhyLine ? need : null} />
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
            You win ~{Math.round(eq)}%
            {showWhyLine ? ` · need ~${Math.round(need!)}%` : ""}
          </div>
          {showWhyLine && (
            <p style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{whyLine(eq, need)}</p>
          )}
          {/* Make the assumed-range context legible right next to the equity figure, so a surprising
              number (e.g. queen-high ~47% vs a wide calling-station range) reads as "vs a range",
              not the bots' real cards (iter-03 #9; honesty invariant). */}
          {analysis.assumedRange ? (
            <div data-testid="assumed-range" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
              That win-chance is vs {analysis.assumedRange} — an assumed range of hands, not their
              actual cards.
            </div>
          ) : null}

          {showEvTable && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink-soft)" }}>
                Show the numbers
              </summary>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6, display: "grid", gap: 2 }}>
                {/* These are GOING-FORWARD averages from this spot — not the whole-hand result. A river
                    "check: $9" can sit next to a "you lost $18" hand result and both be right (one is
                    the EV from here, the other whole-hand P&L), so we say so to kill that confusion
                    (iter-09 #9). */}
                <span style={{ marginBottom: 2 }}>
                  From here on — the average result going forward, not the whole-hand outcome:
                </span>
                {evRows(ev, facingBet, preflopOpen).map((r) => (
                  <span key={r.label}>Average result if you {r.label}: {money(r.value, unit)}</span>
                ))}
                <span style={{ marginTop: 4 }}>
                  Higher is better — these are long-run averages, not this one hand.
                </span>
              </div>
            </details>
          )}
        </div>
      ) : null}

      {/* Mental Math walk-through — a collapsible coaching section on the live hand (spec §4). The
          verdict's equity (the SAME figure the bar shows) is passed in as the single "true win" so
          Mental Math can never show a different win-% for the same decision (iter-07 #1). */}
      <MentalMathSection enabled={enabled} verdictEquityPct={eq} />
    </aside>
  );
}
