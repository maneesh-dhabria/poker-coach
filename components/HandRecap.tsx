// End-of-hand review (observation #4: "more details, especially at the end of the hand"). Lists
// every hero decision in the just-finished hand with its verdict and the plain one-liner, so the
// user can see the whole hand's story in one place. Reads the embedded DecisionAnalysis as ground
// truth (§17) — it never recomputes verdicts. Honesty: "chart-based" only when gtoClaim is true.
import { HeroDecisionRecord } from "@/core/history/handRecord";
import { formatExplanation } from "@/core/analysis/explain";
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
function actionLabel(
  a: { action: string; amount: number; toAmount?: number },
  unit: MoneyUnit,
  // At conceptual depth ("plain words, no numbers") the recap row carries no digits/currency, so the
  // action verb omits the amount ("bet" not "bet $3") — keeping the whole conceptual card digit-free
  // (iter-10 #4). Equity/Strict keep the amount.
  conceptual = false,
): string {
  const money = (n: number) => formatMoney(n, unit, BIG_BLIND);
  // A bet/raise is described by its TOTAL raise-to level (the number the action button offered, e.g.
  // "Raise to 2 BB"), not the chips-added increment — so "raised to N" here matches the button and
  // the round summary (iter-03 #6). Fall back to the increment for older records without toAmount.
  const level = a.toAmount ?? a.amount;
  switch (a.action) {
    case "fold":
      return "folded";
    case "check":
      return "checked";
    case "call":
      return conceptual ? "called" : `called ${money(a.amount)}`;
    case "bet":
      return conceptual ? "bet" : `bet ${money(level)}`;
    case "raise":
      return conceptual ? "raised" : `raised to ${money(level)}`;
    default:
      return a.action;
  }
}

// Plain result wording. A net of $0 (e.g. after a fold) isn't "winning $0" — say it neutrally so
// folding doesn't read as a win (finding #9). Won/lost otherwise, in the display unit (finding #2).
// At conceptual depth ("plain words, no numbers") the result line carries NO amount — won/lost/neutral
// only — so the whole panel stays digit-free (iter-11 #6). Equity/Strict keep the numeric amount.
function resultLine(heroNet: number | null, unit: MoneyUnit, conceptual: boolean): string {
  const net = heroNet ?? 0;
  const money = (n: number) => formatMoney(n, unit, BIG_BLIND);
  if (net > 0) return conceptual ? "You won this hand." : `Result: you won ${money(net)}.`;
  if (net < 0)
    return conceptual ? "You lost this hand." : `Result: you lost ${money(Math.abs(net))}.`;
  return conceptual ? "No money won or lost this hand." : "Result: no money won or lost this hand.";
}

// The decision tally in words, for conceptual depth (no digits — iter-11 #6). "one thin, one mistake"
// etc.; omits zero categories; "all clean" when nothing was flagged.
const NUM_WORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
function numWord(n: number): string {
  return n < NUM_WORD.length ? NUM_WORD[n] : String(n);
}
function tallyWords(c: { good: number; thin: number; mistake: number }): string {
  const parts: string[] = [];
  if (c.good > 0) parts.push(`${numWord(c.good)} good`);
  if (c.thin > 0) parts.push(`${numWord(c.thin)} thin`);
  if (c.mistake > 0) parts.push(`${numWord(c.mistake)} mistake${c.mistake === 1 ? "" : "s"}`);
  if (parts.length === 0) return "no decisions yet";
  return parts.join(" · ");
}

function counts(decisions: HeroDecisionRecord[]) {
  const c = { good: 0, thin: 0, mistake: 0 };
  for (const d of decisions) c[d.analysis.verdict] += 1;
  return c;
}

// The single flagged decision the "where the leak is" line should point at (iter-14 #4): the MOST
// SEVERE one (❌ over ⚠️ via analysis.severity), breaking ties by the largest chips the hero committed
// on that decision (the bigger chip swing is the bigger lesson) — so a stack-losing overbet shove is
// what's highlighted, not a minor earlier min-raise. Returns null when nothing is flagged.
function mostSevereFlagged(decisions: HeroDecisionRecord[]): HeroDecisionRecord | null {
  const chips = (d: HeroDecisionRecord) =>
    Math.max(d.heroAction.amount ?? 0, d.spot.toCall ?? 0);
  let best: HeroDecisionRecord | null = null;
  for (const d of decisions) {
    if (d.analysis.verdict === "good") continue;
    if (
      !best ||
      d.analysis.severity > best.analysis.severity ||
      (d.analysis.severity === best.analysis.severity && chips(d) > chips(best))
    ) {
      best = d;
    }
  }
  return best;
}

// A short, readable phrase naming the leak play for the "where the leak is" pointer (iter-14 #4):
// e.g. "your turn bet of $185", "your preflop raise to $4", "your river call of $8". Conceptual stays
// digit-free ("your turn bet"). Reads naturally inside the recap sentence.
function leakPlayPhrase(d: HeroDecisionRecord, unit: MoneyUnit, conceptual: boolean): string {
  const street = (STREET_LABEL[d.street] ?? d.street).toLowerCase();
  const a = d.heroAction;
  const money = (n: number) => formatMoney(n, unit, BIG_BLIND);
  const level = a.toAmount ?? a.amount;
  switch (a.action) {
    case "bet":
      return conceptual ? `your ${street} bet` : `your ${street} bet of ${money(level)}`;
    case "raise":
      return conceptual ? `your ${street} raise` : `your ${street} raise to ${money(level)}`;
    case "call":
      return conceptual ? `your ${street} call` : `your ${street} call of ${money(a.amount)}`;
    case "check":
      return `your ${street} check`;
    case "fold":
      return `your ${street} fold`;
    default:
      return `your ${street} play`;
  }
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
  // The whole panel must show zero digits at Conceptual depth (iter-11 #6): the verdict CARD was
  // already number-free, but the tally ("0 good · 1 mistake") and Result line ("you lost 1 BB") still
  // leaked digits. Depth is per-decision; treat the recap as conceptual when EVERY graded decision is
  // (a single-depth session — the normal case — so any mixed-depth session keeps its digits).
  const conceptual = decisions.every((d) => d.analysis.coachingDepth === "conceptual");

  // The flagged decision the "leak" pointer should reference — the most severe one, biggest chip
  // swing on a tie (iter-14 #4). Used to name the actual play ("your turn bet of $185") rather than a
  // generic "a play above", so the biggest mistake is what gets highlighted.
  const leak = mostSevereFlagged(decisions);
  const leakIcon = leak ? VERDICT_META[leak.analysis.verdict].icon : "⚠️";
  const leakPhrase = leak ? leakPlayPhrase(leak, displayUnit, conceptual) : "";

  // Did the hero actually CONTEST this hand (so a loss can be a "played well, unlucky" beat) rather
  // than fold cheaply for the blind? Contesting = voluntarily putting chips in (a call/bet/raise) OR
  // reaching a street past preflop. A pure preflop fold that loses only the blind is NOT a bad
  // beat, so it must not get the variance/"unlucky" footer (iter-04 #6).
  const contested = decisions.some(
    (d) =>
      d.heroAction.action === "call" ||
      d.heroAction.action === "bet" ||
      d.heroAction.action === "raise" ||
      d.street !== "preflop",
  );

  return (
    <section data-testid="hand-recap" className="card" style={{ marginTop: 16, textAlign: "left", maxWidth: 560 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Hand review</h2>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {conceptual
            ? tallyWords(c)
            : `${c.good} good · ${c.thin} thin · ${c.mistake} mistake${c.mistake === 1 ? "" : "s"}`}
        </span>
      </div>

      <ol style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 10 }}>
        {decisions.map((d, i) => {
          const m = VERDICT_META[d.analysis.verdict];
          // Disambiguate a 2nd+ hero action on the SAME street (e.g. bet then call a raise on the
          // turn) so two "Turn —" rows don't read identically (iter-08 #6). Prefix the later one with
          // "then" → "Turn — you then called …".
          const sameStreetAsPrev = i > 0 && decisions[i - 1].street === d.street;
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
                  {sameStreetAsPrev ? "then " : ""}
                  {actionLabel(d.heroAction, displayUnit, d.analysis.coachingDepth === "conceptual")}
                  {/* At conceptual depth ("plain words, no numbers") the recap row carries no digits
                      either — drop the "· pot $X" amount (iter-10 #4). Per-decision depth, so a
                      mixed-depth session still shows amounts on its equity/strict rows. */}
                  {d.analysis.coachingDepth !== "conceptual" && (
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--ink-soft)", marginLeft: 6 }}>
                      · pot {formatMoney(Math.round(d.spot.potBefore), displayUnit, BIG_BLIND)}
                    </span>
                  )}
                  {/* "chart-based" is a Strict-mode badge (iter-04 #7) — only show it on a strict-depth
                      decision, matching the live feedback panel; honest only when gtoClaim. */}
                  {d.analysis.gtoClaim && d.analysis.coachingDepth === "strict" ? (
                    <span style={{ fontSize: 11, color: "var(--ink-soft)", marginLeft: 6 }}>
                      chart-based
                    </span>
                  ) : null}
                </div>
                {/* Render the explanation sentence in the display unit (iter-04 #3) so a "you called
                    54 BB" header never sits above a "$108 to win $560" dollar sentence. */}
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                  {formatExplanation(d.analysis, displayUnit, BIG_BLIND)}
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
          {/* Prominent net result (iter-18 MINOR #2): a big multiway all-in win can jump the stack
              hundreds of dollars, and a quiet grey "Result: you won $X." line didn't obviously account
              for it. Surface the net amount as a bold, coloured headline so the stack change is always
              clearly explained. The follow-on /poker-coach pointer stays in the muted line below. */}
          <p
            data-testid="recap-result"
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginTop: 12,
              marginBottom: 0,
              color:
                (heroNet ?? 0) > 0
                  ? "var(--good)"
                  : (heroNet ?? 0) < 0
                    ? "var(--mistake)"
                    : "var(--ink)",
            }}
          >
            {resultLine(heroNet, displayUnit, conceptual)}
          </p>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 6 }}>
            For a deeper plain-language write-up of this hand, run{" "}
            <code>/poker-coach last</code> in your terminal, then open the Coaching panel and hit Refresh.
          </p>

          {/* Positive reinforcement on a fully clean hand (iter-13 #5): every graded decision was
              ✅ good (no ⚠️ thin, no ❌ mistake). The app already WITHHOLDS praise after any flag
              (correct), but never congratulated a genuinely clean hand. Show it on a clean WIN (a
              clean LOSS gets the variance bridge below instead, so we don't double up). Gated on
              `!flagged` so a ⚠️/❌ hand never sees it. */}
          {heroNet !== null && heroNet > 0 && !flagged ? (
            <p data-testid="recap-praise" style={{ fontSize: 13, color: "var(--good)", marginTop: 8 }}>
              Nicely played — every decision was solid.
            </p>
          ) : null}

          {/* Reconcile result vs verdict: winning a hand with a flagged decision feels contradictory,
              so spell out that the verdicts grade the decision, not this one outcome. */}
          {heroNet !== null && heroNet >= 0 && flagged ? (
            <p data-testid="recap-reconcile" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
              You won this hand, but the {leakIcon} above — {leakPhrase} — flags a play that loses money
              on average; results swing hand to hand, so we grade the decision, not the outcome.
            </p>
          ) : null}

          {/* The mirror case (finding #1): you LOST the hand but every graded decision was CLEAN — no
              ❌ mistake AND no ⚠️ thin (iter-11 #3). A trusting newcomer who saw "~92%" then lost their
              stack needs the variance bridge surfaced by DEFAULT. Gating on `!flagged` (not just
              mistake===0) stops "played well" praise appearing after a ⚠️ thin play like an oversized
              shove — praising a play the same recap just flagged teaches the wrong lesson. */}
          {heroNet !== null && heroNet < 0 && !flagged && contested ? (
            <p data-testid="recap-variance" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
              Good decision, unlucky result — that&apos;s variance. We grade the decision, not the
              outcome: these win % are long-run averages, not this one hand. Played well, lost anyway —
              that happens, and it evens out over time.
            </p>
          ) : null}

          {/* A LOSS that WAS flagged (a ⚠️ thin or ❌ mistake): this is NOT variance — there's a play to
              review. Previously this case hit neither branch (the won-but-flagged branch is heroNet ≥ 0)
              and silently showed nothing, which read as inconsistent next to clean-loss variance copy
              (iter-11 #3). Mirror the won-flagged wording so a flagged loss always gets an honest
              "review the flagged play" note instead of silence. */}
          {heroNet !== null && heroNet < 0 && flagged ? (
            <p data-testid="recap-loss-flagged" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 8 }}>
              You lost this hand, and the {leakIcon} above — {leakPhrase} — is the play to review:
              that&apos;s where the leak is, not variance.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
