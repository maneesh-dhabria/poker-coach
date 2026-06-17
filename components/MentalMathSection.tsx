"use client";
// Mental Math walk-through (spec §3, FR-01/03/16–21). A collapsible section inside the FeedbackPanel
// that teaches the guide's six-step outs→equity routine on the LIVE hand, then lets the player
// "check their work" against the app's Monte Carlo equity. Presentational only: all math comes from
// core/mental (sync) and core/equity (async). It never recomputes — it reads, like FeedbackPanel.
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
import { requestEquity } from "@/core/equity/equityClient";
import { HandFlow } from "@/core/handFlow";
import { Street } from "@/core/analysis/types";
import { formatMoney } from "@/core/money";

const EQUITY_ITERATIONS = 1500;
const BIG_BLIND = 2;

function browserWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/equity.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

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

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="mm-note"
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

export function MentalMathSection({ enabled }: { enabled: boolean }) {
  const flow = useGameStore((s) => s.flow);
  const seed = useGameStore((s) => s.seed);
  // `flow` is a single HandFlow instance that the store MUTATES in place as the hand advances (only
  // `tick` bumps — its identity is stable for the whole hand). So we re-derive the input on `tick`,
  // not on `flow` identity, to actually track the live flop→turn→river progression (spec §3.1, FR-02).
  const tick = useGameStore((s) => s.tick);

  const open = useSessionStore((s) => s.mentalMathOpen);
  const setOpen = useSessionStore((s) => s.setMentalMathOpen);
  const displayUnit = useSessionStore((s) => s.displayUnit);

  const [outsOverride, setOutsOverride] = useState<number | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [trueWinPct, setTrueWinPct] = useState<number | null>(null);
  const [equityLoading, setEquityLoading] = useState(false);

  // `tick` is the intentional trigger (flow is mutated in place — see above); exhaustive-deps can't
  // see that, so the dependency is correct but the rule flags it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo(() => inputFromFlow(flow), [flow, tick]);
  const estimate: MentalEstimate = useMemo(
    () => buildMentalEstimate({ ...input, outsOverride }),
    [input, outsOverride],
  );
  const autoEstimate: MentalEstimate = useMemo(() => buildMentalEstimate(input), [input]);

  // A key that changes only when the underlying hand changes (NOT when the override changes), so the
  // true-equity call is made once per spot and the override never re-triggers Monte Carlo (FR-11).
  const equityKey =
    input.hole && (estimate.status === "ok" || estimate.status === "no-draw" || estimate.status === "river")
      ? `${input.hole.join("")}|${input.board.join("")}|${input.numActiveOpponents}`
      : null;

  // Reset the override whenever the hand changes.
  useEffect(() => {
    setOutsOverride(null);
    setShowOverride(false);
  }, [equityKey]);

  useEffect(() => {
    if (!equityKey || !input.hole) {
      setTrueWinPct(null);
      setEquityLoading(false);
      return;
    }
    let cancelled = false;
    setEquityLoading(true);
    setTrueWinPct(null);
    requestEquity(
      {
        hero: input.hole,
        board: input.board,
        numOpponents: Math.max(1, input.numActiveOpponents),
        iterations: EQUITY_ITERATIONS,
        seed: seed + input.board.length + 1,
      },
      browserWorker,
    )
      .then((res) => {
        if (cancelled) return;
        setTrueWinPct(Math.round(res.equityPct));
        setEquityLoading(false);
      })
      .catch(() => {
        if (!cancelled) setEquityLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `equityKey` already encodes hole|board|numActiveOpponents, so it is the single per-spot trigger:
    // fire Monte Carlo once per spot, not on every `tick` (input is a fresh object each tick now).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equityKey, seed]);

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
          {estimate.status === "no-hand" && (
            <Note>Deal a hand and reach the flop to use Mental Math.</Note>
          )}
          {estimate.status === "preflop" && (
            <Note>The Rule of 2 &amp; 4 is for the flop and turn. For preflop, see the Preflop Chart tab.</Note>
          )}
          {estimate.status === "river" && (
            <>
              <Note>No cards left to come on the river — you either have your hand or you don&apos;t.</Note>
              <TrueEquityCheck
                estimate={estimate}
                trueWinPct={trueWinPct}
                loading={equityLoading}
                input={input}
                displayUnit={displayUnit}
              />
            </>
          )}
          {estimate.status === "no-draw" && (
            <>
              <Note>{estimate.plainSummary}</Note>
              <TrueEquityCheck
                estimate={estimate}
                trueWinPct={trueWinPct}
                loading={equityLoading}
                input={input}
                displayUnit={displayUnit}
              />
            </>
          )}
          {estimate.status === "ok" && (
            <Steps
              estimate={estimate}
              autoEstimate={autoEstimate}
              trueWinPct={trueWinPct}
              loading={equityLoading}
              input={input}
              displayUnit={displayUnit}
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
  loading,
  input,
  displayUnit,
  outsOverride,
  setOutsOverride,
  showOverride,
  setShowOverride,
}: {
  estimate: MentalEstimate;
  autoEstimate: MentalEstimate;
  trueWinPct: number | null;
  loading: boolean;
  input: MentalInput;
  displayUnit: "usd" | "bb";
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
        {estimate.madeHand && (
          <p data-testid="mm-made-hand" style={{ margin: "2px 0 6px", fontSize: 13, color: "var(--good)" }}>
            You already have <strong>{estimate.madeHand.label}</strong> — so you&apos;re often ahead
            already, on top of any outs below.
          </p>
        )}
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
          <span style={{ color: "var(--ink-soft)", textTransform: "none" }}>Rule of 2 &amp; 4</span>
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

      <TrueEquityCheck estimate={estimate} trueWinPct={trueWinPct} loading={loading} input={input} displayUnit={displayUnit} />
    </div>
  );
}

function TrueEquityCheck({
  estimate,
  trueWinPct,
  loading,
  input,
  displayUnit,
}: {
  estimate: MentalEstimate;
  trueWinPct: number | null;
  loading: boolean;
  input: MentalInput;
  displayUnit: "usd" | "bb";
}) {
  if (loading) {
    return (
      <div data-testid="mm-equity-loading" style={{ ...STEP_CARD, background: "rgba(63,185,107,.10)", border: "1px solid var(--good)" }}>
        <div style={STEP_HEAD}>
          <span>Check your work</span>
        </div>
        <p style={{ margin: "2px 0", fontSize: 13, color: "var(--ink-soft)" }}>calculating true equity…</p>
      </div>
    );
  }
  if (trueWinPct == null) return null;

  const hit = estimate.ruleHitPct;
  const exact = estimate.exactHitPct;
  const potAfter = (estimate.potOdds?.potAfterCall ?? input.potBefore + input.toCall);
  const evCall = (trueWinPct / 100) * potAfter - input.toCall;

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
          Calling is worth about {money(evCall, displayUnit)} on average (based on the true equity).
        </p>
      </details>
    </div>
  );
}

function money(dollars: number, unit: "usd" | "bb"): string {
  return formatMoney(dollars, unit, BIG_BLIND);
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
