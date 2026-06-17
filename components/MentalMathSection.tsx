"use client";
// Mental Math walk-through (spec §3, FR-01/03/16–21). A collapsible section inside the FeedbackPanel
// that teaches the guide's six-step outs→equity routine on the LIVE hand, then lets the player
// "check their work" against the SAME win-% the verdict and equity bar already show. The "true win"
// is passed IN from FeedbackPanel (`analysis.numbers.equityPct`) — the single source — so the panel
// can never show two different win-%s for one decision (iter-07 #1). Presentational only: the outs
// math comes from core/mental (sync); it never recomputes equity — it reads, like FeedbackPanel.
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import {
  buildMentalEstimate,
  conclusionFrom,
  gapExplanation,
  MentalInput,
  MentalEstimate,
} from "@/core/mental";
import { HandFlow } from "@/core/handFlow";
import { Street } from "@/core/analysis/types";
import { formatMoney } from "@/core/money";

const BIG_BLIND = 2;

const EMPTY_INPUT: MentalInput = {
  hole: null,
  board: [],
  street: "flop",
  potBefore: 0,
  toCall: 0,
  numActiveOpponents: 0,
};

/** Build the MentalInput from the live hand (spec §3.1): richest snapshot on hero's turn, a
 * read-only snapshot off-turn, and an empty (no-hand) input when there's nothing to estimate. */
function inputFromFlow(flow: HandFlow | null): MentalInput {
  if (!flow || flow.isOver()) return EMPTY_INPUT;
  if (flow.isHeroTurn()) {
    const s = flow.heroSpot();
    return {
      hole: s.hole,
      board: s.board,
      street: s.street as Street,
      potBefore: s.potBefore,
      toCall: s.toCall,
      numActiveOpponents: s.numActiveOpponents,
    };
  }
  const view = flow.tableView();
  const heroSeat = view.seats.find((seat) => seat.isHero);
  if (!heroSeat || heroSeat.folded) return EMPTY_INPUT;
  const numActiveOpponents = view.seats.filter((seat) => !seat.isHero && !seat.folded).length;
  return {
    hole: flow.heroHole(),
    board: flow.board,
    street: flow.street as Street,
    potBefore: flow.potNow(),
    toCall: 0,
    numActiveOpponents,
  };
}

const STEP_CARD: React.CSSProperties = {
  background: "var(--panel-2, #1d2c26)",
  border: "1px solid #2a3a32",
  borderRadius: "var(--r-md)",
  padding: "10px 12px",
  marginTop: 10,
};
const STEP_HEAD: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: ".03em",
  textTransform: "uppercase",
  color: "var(--gold-deep, #b8923f)",
  fontWeight: 600,
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 6,
};

function Note({ children, "data-testid": testid = "mm-note" }: { children: React.ReactNode; "data-testid"?: string }) {
  return (
    <div
      data-testid={testid}
      style={{
        background: "var(--panel-2, #1d2c26)",
        border: "1px dashed #3a4a42",
        borderRadius: "var(--r-md)",
        padding: 14,
        color: "var(--ink-soft)",
        fontSize: 13,
        marginTop: 10,
      }}
    >
      {children}
    </div>
  );
}

function BreakEvenBar({ pct }: { pct: number }) {
  return (
    <div
      data-testid="mm-breakeven-bar"
      style={{ position: "relative", background: "var(--panel)", borderRadius: "var(--r-pill)", height: 14, marginTop: 6 }}
    >
      <div
        style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: "var(--gold, #d8b15a)", borderRadius: "var(--r-pill)" }}
      />
    </div>
  );
}

export function MentalMathSection({
  enabled,
  verdictEquityPct,
}: {
  enabled: boolean;
  // The verdict's win-% (analysis.numbers.equityPct) — the SAME figure the equity bar shows. Used as
  // the single "true win" everywhere in Mental Math so the two can never drift (iter-07 #1). Null on
  // off-turn / no-equity spots, in which case the "Check your work" block is hidden.
  verdictEquityPct?: number | null;
}) {
  const flow = useGameStore((s) => s.flow);
  // Whether the current hand has finished. At showdown the live decision clears, so the estimate
  // status falls back to "no-hand"; distinguish a finished hand from "no hand dealt yet" so we can
  // show a graceful "hand complete" note instead of the jarring "deal a hand" placeholder (finding
  // #12). Re-derived on `tick` because `flow` is mutated in place (see the input memo below).
  const handComplete = !!flow && flow.isOver();
  // `flow` is a single HandFlow instance that the store MUTATES in place as the hand advances (only
  // `tick` bumps — its identity is stable for the whole hand). So we re-derive the input on `tick`,
  // not on `flow` identity, to actually track the live flop→turn→river progression (spec §3.1, FR-02).
  const tick = useGameStore((s) => s.tick);

  const open = useSessionStore((s) => s.mentalMathOpen);
  const setOpen = useSessionStore((s) => s.setMentalMathOpen);
  const displayUnit = useSessionStore((s) => s.displayUnit);
  // The coaching depth gates jargon: in Conceptual ("plain words, no numbers") we suppress the named
  // "Rule of 2 & 4" jargon and the Preflop Chart tab reference (iter-08 #4).
  const coachingDepth = useSessionStore((s) => s.settings.coachingDepth);
  const conceptual = coachingDepth === "conceptual";

  const [outsOverride, setOutsOverride] = useState<number | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  // `tick` is the intentional trigger (flow is mutated in place — see above); exhaustive-deps can't
  // see that, so the dependency is correct but the rule flags it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo(() => inputFromFlow(flow), [flow, tick]);
  const estimate: MentalEstimate = useMemo(
    () => buildMentalEstimate({ ...input, outsOverride }),
    [input, outsOverride],
  );
  const autoEstimate: MentalEstimate = useMemo(() => buildMentalEstimate(input), [input]);

  // The "true win" is the verdict's equity (analysis.numbers.equityPct), passed in — NOT a separate
  // Monte Carlo. This guarantees Mental Math and the verdict/equity bar always show ONE number for a
  // decision (iter-07 #1). It's only meaningful when there's a live drawing/made spot to check.
  const showTrueWin =
    verdictEquityPct != null &&
    (estimate.status === "ok" || estimate.status === "no-draw" || estimate.status === "river");
  const trueWinPct = showTrueWin ? Math.round(verdictEquityPct!) : null;

  // A key that changes only when the underlying hand changes (NOT when the override changes).
  const equityKey =
    input.hole && (estimate.status === "ok" || estimate.status === "no-draw" || estimate.status === "river")
      ? `${input.hole.join("")}|${input.board.join("")}|${input.numActiveOpponents}`
      : null;

  // Reset the override whenever the hand changes.
  useEffect(() => {
    setOutsOverride(null);
    setShowOverride(false);
  }, [equityKey]);

  if (!enabled) return null;

  const handContext =
    estimate.status === "ok" && input.hole
      ? `${input.hole.join(" ")} · ${input.board.join(" ")} · ${estimate.street}`
      : "estimate it in your head";

  return (
    <section data-testid="mm-section" style={{ marginTop: 8 }}>
      <hr style={{ border: "none", borderTop: "1px solid #2a3a32", margin: "16px 0" }} />
      <button
        data-testid="mm-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          background: "var(--panel-2, #1d2c26)",
          border: "1px solid var(--gold-deep, #b8923f)",
          borderRadius: "var(--r-md)",
          padding: "10px 12px",
          fontWeight: 600,
          color: "var(--ink)",
          textAlign: "left",
        }}
      >
        <span style={{ color: "var(--gold, #d8b15a)" }}>{open ? "▾" : "▸"}</span>
        Mental Math
        <span style={{ marginLeft: "auto", color: "var(--ink-soft)", fontWeight: 400, fontSize: 11 }}>
          {handContext}
        </span>
      </button>

      {open && (
        <div data-testid="mm-body">
          {estimate.status === "no-hand" &&
            (handComplete ? (
              <Note data-testid="mm-hand-complete">
                Hand complete — the live math has cleared. See the hand review below for the whole
                hand, and Mental Math comes back on the next flop.
              </Note>
            ) : (
              <Note>Deal a hand and reach the flop to use Mental Math.</Note>
            ))}
          {estimate.status === "preflop" && (
            <Note>
              {conceptual
                ? "Counting outs is for the flop and turn, once cards are still to come. There's nothing to count before the flop."
                : "The Rule of 2 & 4 is for the flop and turn. For preflop, see the Preflop Chart tab."}
            </Note>
          )}
          {estimate.status === "river" && (
            <>
              <Note>No cards left to come on the river — you either have your hand or you don&apos;t.</Note>
              <TrueEquityCheck estimate={estimate} trueWinPct={trueWinPct} input={input} displayUnit={displayUnit} />
            </>
          )}
          {estimate.status === "no-draw" && (
            <>
              <Note>{noDrawSummary(estimate, trueWinPct)}</Note>
              <TrueEquityCheck estimate={estimate} trueWinPct={trueWinPct} input={input} displayUnit={displayUnit} />
            </>
          )}
          {estimate.status === "ok" && (
            <Steps
              estimate={estimate}
              autoEstimate={autoEstimate}
              trueWinPct={trueWinPct}
              input={input}
              displayUnit={displayUnit}
              conceptual={conceptual}
              outsOverride={outsOverride}
              setOutsOverride={setOutsOverride}
              showOverride={showOverride}
              setShowOverride={setShowOverride}
            />
          )}
        </div>
      )}
    </section>
  );
}

function Steps({
  estimate,
  autoEstimate,
  trueWinPct,
  input,
  displayUnit,
  conceptual,
  outsOverride,
  setOutsOverride,
  showOverride,
  setShowOverride,
}: {
  estimate: MentalEstimate;
  autoEstimate: MentalEstimate;
  trueWinPct: number | null;
  input: MentalInput;
  displayUnit: "usd" | "bb";
  conceptual: boolean;
  outsOverride: number | null;
  setOutsOverride: (n: number | null) => void;
  showOverride: boolean;
  setShowOverride: (b: boolean) => void;
}) {
  const outs = estimate.outs!;
  const autoTotal = autoEstimate.outs?.totalOuts ?? 0;
  const usingOverride = outsOverride != null;
  const shownOuts = usingOverride ? outsOverride! : outs.totalOuts;

  return (
    <div data-testid="mm-steps">
      {/* Step 1 — outs */}
      <div style={STEP_CARD}>
        <div style={STEP_HEAD}>
          <span>Step 1 · Your outs</span>
          <button
            data-testid="mm-override-toggle"
            onClick={() => {
              setShowOverride(!showOverride);
              if (!showOverride && outsOverride == null) setOutsOverride(autoTotal);
            }}
            style={miniBtn}
          >
            I count differently ▸
          </button>
        </div>
        {estimate.madeHand &&
          (() => {
            const line = madeHandLine(estimate.madeHand.label, trueWinPct, input.numActiveOpponents);
            return (
              <p
                data-testid="mm-made-hand"
                style={{ margin: "2px 0 6px", fontSize: 13, color: line.ahead ? "var(--good)" : "var(--ink-soft)" }}
              >
                {line.text}
              </p>
            );
          })()}
        {outs.groups.map((g, i) => (
          <p key={i} style={{ margin: "2px 0", fontSize: 13 }}>
            {g.label}
            {g.soft && (
              <span data-testid="mm-soft-tag" style={softTag}>
                soft · may not win
              </span>
            )}
          </p>
        ))}
        {outs.overlapCount > 0 && (
          <p style={{ margin: "2px 0", fontSize: 12, color: "var(--ink-soft)" }}>
            Some cards complete more than one draw — counted once (−{outs.overlapCount}).
          </p>
        )}
        <p style={{ fontSize: 15, fontWeight: 700 }}>
          ➜ {shownOuts} outs{usingOverride ? " (your count)" : ""}
        </p>
        {showOverride && (
          <div data-testid="mm-override" style={overrideBox}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>Outs:</span>
              <button data-testid="mm-outs-dec" onClick={() => setOutsOverride(Math.max(0, shownOuts - 1))} style={stepBtn}>
                −
              </button>
              <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700 }}>{shownOuts}</span>
              <button data-testid="mm-outs-inc" onClick={() => setOutsOverride(shownOuts + 1)} style={stepBtn}>
                +
              </button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
              Steps 2–6 recompute live from your number. The true win % doesn&apos;t change — it&apos;s the answer.
            </p>
            <button data-testid="mm-outs-reset" onClick={() => setOutsOverride(null)} style={{ ...miniBtn, marginTop: 6 }}>
              reset to auto
            </button>
          </div>
        )}
      </div>

      {/* Step 2 — chance you hit */}
      <div style={STEP_CARD}>
        <div style={STEP_HEAD}>
          <span>Step 2 · Chance you hit</span>
          {!conceptual && (
            <span style={{ color: "var(--ink-soft)", textTransform: "none" }}>Rule of 2 &amp; 4</span>
          )}
        </div>
        <p style={{ margin: "2px 0", fontSize: 13 }}>
          {estimate.street === "flop" ? "Flop → ×4" : "Turn → ×2"} → about{" "}
          <strong data-testid="mm-rule-hit">{estimate.ruleHitPct}%</strong> to hit by the river
        </p>
        {estimate.bigDrawCaveat && (
          <p style={{ margin: "2px 0", fontSize: 12, color: "var(--ink-soft)" }}>
            Big draw — ×4 overcounts a little; the true hit chance is closer to {estimate.exactHitPct}%.
          </p>
        )}
      </div>

      {/* Step 3 — shade for opponents */}
      {estimate.opponentShade && (
        <div style={STEP_CARD}>
          <div style={STEP_HEAD}>
            <span>Step 3 · Shade for opponents</span>
          </div>
          <p style={{ margin: "2px 0", fontSize: 13 }}>
            {estimate.opponentShade.sentence}
            {estimate.opponentShade.lowPct !== estimate.opponentShade.highPct && (
              <>
                {" "}
                Roughly <strong>~{estimate.opponentShade.lowPct}–{estimate.opponentShade.highPct}% to win</strong>.
              </>
            )}
          </p>
        </div>
      )}

      {/* Step 4 — board danger */}
      {estimate.taint && (
        <div style={STEP_CARD}>
          <div style={STEP_HEAD}>
            <span>Step 4 · Board danger</span>
          </div>
          {estimate.taint.notes.length > 0 ? (
            estimate.taint.notes.map((n, i) => (
              <p key={i} style={{ margin: "2px 0", fontSize: 13 }}>
                {n}
              </p>
            ))
          ) : (
            <p style={{ margin: "2px 0", fontSize: 13, color: "var(--ink-soft)" }}>
              The board is clean — no obvious dangers.
            </p>
          )}
        </div>
      )}

      {/* Step 5 — the price */}
      {estimate.potOdds && (
        <div style={STEP_CARD}>
          <div style={STEP_HEAD}>
            <span>Step 5 · The price</span>
            <span style={{ color: "var(--ink-soft)", textTransform: "none" }}>pot odds</span>
          </div>
          {estimate.potOdds.toCall > 0 ? (
            <>
              <p style={{ margin: "2px 0", fontSize: 13 }}>
                Call {money(estimate.potOdds.toCall, displayUnit)} into {money(estimate.potOdds.potAfterCall, displayUnit)} → you need about{" "}
                <strong>{Math.round(estimate.potOdds.breakEvenPct)}%</strong> to break even
              </p>
              <BreakEvenBar pct={estimate.potOdds.breakEvenPct} />
            </>
          ) : (
            <p style={{ margin: "2px 0", fontSize: 13 }}>It&apos;s free to see the next card — no price to pay.</p>
          )}
        </div>
      )}

      {/* Step 6 — the call. Once the true win % has resolved, the conclusion is driven by that
          equity (the same number the engine grades against) so it can never contradict the
          post-action verdict — especially when a made hand makes an outs-only "fold" wrong. */}
      {estimate.decision &&
        (() => {
          const conclusion =
            trueWinPct != null && estimate.potOdds
              ? conclusionFrom({
                  trueWinPct,
                  breakEvenPct: estimate.potOdds.breakEvenPct,
                  toCall: estimate.potOdds.toCall,
                  madeHand: estimate.madeHand,
                })
              : estimate.decision!;
          return (
            <div style={STEP_CARD}>
              <div style={STEP_HEAD}>
                <span>Step 6 · The call</span>
              </div>
              <p style={{ margin: "2px 0", fontSize: 13 }}>
                <strong
                  data-testid="mm-conclusion"
                  style={{ color: conclusion.profitable ? "var(--good)" : "var(--mistake)" }}
                >
                  {conclusion.sentence}
                </strong>
              </p>
            </div>
          );
        })()}

      <TrueEquityCheck estimate={estimate} trueWinPct={trueWinPct} input={input} displayUnit={displayUnit} />
    </div>
  );
}

function TrueEquityCheck({
  estimate,
  trueWinPct,
  input,
  displayUnit,
}: {
  estimate: MentalEstimate;
  trueWinPct: number | null;
  input: MentalInput;
  displayUnit: "usd" | "bb";
}) {
  if (trueWinPct == null) return null;

  const hit = estimate.ruleHitPct;
  const exact = estimate.exactHitPct;
  const potAfter = (estimate.potOdds?.potAfterCall ?? input.potBefore + input.toCall);
  const evCall = (trueWinPct / 100) * potAfter - input.toCall;
  // Match the dollar-EV verb to the ACTUAL action so the line never says "Calling" about a bet
  // (iter-08 #2). When there's a bet to call (toCall > 0) the hero is calling; with no bet to face
  // (toCall === 0) the money goes in as a bet, so the EV is the value of betting. The math
  // (trueWin × pot − toCall) is identical — toCall is 0 for a bet — only the label changes.
  const evVerb = input.toCall > 0 ? "Calling" : "Betting";

  return (
    <div
      data-testid="mm-true-equity"
      style={{ ...STEP_CARD, background: "rgba(63,185,107,.10)", border: "1px solid var(--good)" }}
    >
      <div style={STEP_HEAD}>
        <span>Check your work</span>
      </div>
      {hit != null ? (
        <>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "2px 0" }}>
            You hit ~{hit}% · True win ≈ {trueWinPct}%
          </p>
          {exact != null && (
            <p data-testid="mm-closeness" style={{ margin: "2px 0", fontSize: 12, color: "var(--ink-soft)" }}>
              Your Rule-of-{estimate.ruleMultiplier} estimate was within {Math.round(Math.abs(hit - exact))}% of the exact hit chance ({exact}%).
            </p>
          )}
          {exact != null && (
            <p data-testid="mm-gap" style={{ margin: "2px 0", fontSize: 13 }}>
              {gapExplanation({ exactHitPct: exact, trueWinPct, madeHand: estimate.madeHand })}
            </p>
          )}
        </>
      ) : (
        <p style={{ fontSize: 15, fontWeight: 700, margin: "2px 0" }}>True win ≈ {trueWinPct}%</p>
      )}
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink-soft)" }}>Show the dollar EV ▸</summary>
        <p data-testid="mm-ev" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
          {evVerb} is worth about {money(evCall, displayUnit)} on average (based on the true equity).
        </p>
      </details>
    </div>
  );
}

function money(dollars: number, unit: "usd" | "bb"): string {
  return formatMoney(dollars, unit, BIG_BLIND);
}

// "Often ahead" only when the unified win-% is actually high (iter-07 #2b). Below the threshold a
// made hand can still be a marginal/behind spot multiway, so the line must MATCH the verdict's grade
// — never claim "ahead" against the equity. When the equity isn't available yet, fall back to the
// neutral "you already have X" statement without the misleading "often ahead" claim.
const AHEAD_THRESHOLD_PCT = 55;
function madeHandLine(
  label: string,
  trueWinPct: number | null,
  numActiveOpponents: number,
): { text: string; ahead: boolean } {
  if (trueWinPct == null) {
    return { text: `You already have ${label} — see the true win % below.`, ahead: false };
  }
  const win = Math.round(trueWinPct);
  if (trueWinPct >= AHEAD_THRESHOLD_PCT) {
    return {
      text: `You already have ${label} — you win ~${win}%, so you're often ahead already, on top of any outs below.`,
      ahead: true,
    };
  }
  const players =
    numActiveOpponents > 1 ? ` with ${numActiveOpponents} players still in` : "";
  return {
    text: `You have ${label}, but${players} you're only ~${win}% to win — it's marginal, not a sure lead.`,
    ahead: false,
  };
}

// The no-draw headline (iter-07 #2b). A made hand with no extra outs is "often ahead" only when the
// unified win-% is high; otherwise it's marginal and the copy must track the equity, not over-claim.
function noDrawSummary(estimate: MentalEstimate, trueWinPct: number | null): string {
  if (estimate.madeHand) {
    if (trueWinPct == null) {
      return `No extra outs to count — you already have ${estimate.madeHand.label}. See the true win % below.`;
    }
    const win = Math.round(trueWinPct);
    return trueWinPct >= AHEAD_THRESHOLD_PCT
      ? `No extra outs to count — but you already have ${estimate.madeHand.label} and win ~${win}%, so you're often ahead already.`
      : `No extra outs to count — you have ${estimate.madeHand.label}, but at ~${win}% to win it's marginal here.`;
  }
  return estimate.plainSummary;
}

const miniBtn: React.CSSProperties = {
  fontSize: 11,
  color: "var(--gold, #d8b15a)",
  background: "transparent",
  border: "1px solid var(--gold-deep, #b8923f)",
  borderRadius: "var(--r-pill)",
  padding: "2px 9px",
  cursor: "pointer",
};
const stepBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: "1px solid var(--gold-deep, #b8923f)",
  background: "var(--panel)",
  color: "var(--gold, #d8b15a)",
  cursor: "pointer",
};
const softTag: React.CSSProperties = {
  display: "inline-block",
  fontSize: 10,
  padding: "1px 7px",
  borderRadius: "var(--r-pill)",
  background: "rgba(224,181,74,.18)",
  color: "var(--thin, #e0b54a)",
  border: "1px solid var(--thin, #e0b54a)",
  marginLeft: 6,
};
const overrideBox: React.CSSProperties = {
  background: "#11201a",
  border: "1px solid var(--gold-deep, #b8923f)",
  borderRadius: "var(--r-md)",
  padding: "10px 12px",
  marginTop: 8,
};
