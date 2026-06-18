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
import { Street, HeroAction } from "@/core/analysis/types";
import { Card } from "@/core/cards";
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

// The frozen decision snapshot the verdict above describes (iter-12 #2). When present, Mental Math
// builds its outs/equity routine from THIS — the SAME board/street/opponent-count/made-hand the
// verdict was computed on — instead of re-deriving from the now-live game store. That kills the
// live-vs-frozen drift that once showed "two pair" under a "middle pair" verdict (finding #2), a
// stale opponent count (finding #4), and a hand label that changed across streets (finding #5).
export interface FrozenDecisionContext {
  hole: [Card, Card];
  board: Card[];
  street: Street;
  potBefore: number;
  toCall: number;
  numActiveOpponents: number;
  // The verdict's made-hand label (e.g. "middle pair"), so Mental Math's hand description is
  // IDENTICAL to the verdict's — never a different label from a re-detection on a later board.
  madeHand: { category: number; label: string } | null;
  // The action the hero actually took on this decision (iter-13 #1). On a free street with no made
  // hand, a BET that the verdict grades ❌/⚠️ must NOT get a "just take the free card" Step 6 — Step 5
  // and Step 6 reconcile with the bet the hero made instead. Optional so older records fall back.
  heroAction?: HeroAction | null;
}

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

// Force Mental Math's made-hand to the verdict's FROZEN made-hand label (iter-12 #2), so its hand
// description is IDENTICAL to the verdict it sits under — never "two pair" under a "middle pair"
// verdict, and never a label that drifts across streets (finding #5). When the frozen decision had
// no made hand, the estimate keeps its own (board-derived) made-hand only if there's no frozen
// context at all; with a frozen decision present, the verdict's made-hand (or its absence) wins.
function withFrozenMadeHand(estimate: MentalEstimate, frozen?: FrozenDecisionContext | null): MentalEstimate {
  if (!frozen) return estimate;
  return { ...estimate, madeHand: frozen.madeHand };
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
  betBeatsCheck,
  actionEv,
  frozen,
}: {
  enabled: boolean;
  // The verdict's win-% (analysis.numbers.equityPct) — the SAME figure the equity bar shows. Used as
  // the single "true win" everywhere in Mental Math so the two can never drift (iter-07 #1). Null on
  // off-turn / no-equity spots, in which case the "Check your work" block is hidden.
  verdictEquityPct?: number | null;
  // On a free street (no bet to call, no made hand) Step 6 must agree with the bet-vs-check EV the
  // verdict's EV table shows on the same card (iter-11 #4). True when betting is the higher-EV action
  // (analysis ev.raise > ev.call) — then Step 6 recommends betting, not "take the free card".
  betBeatsCheck?: boolean;
  // The verdict's EV rows (analysis.numbers.ev) — the SAME figures the "Show the numbers" table shows.
  // The dollar-EV note picks the row matching the action it names (bet → ev.raise, call → ev.call) so
  // it can never show the CHECK figure under a "Betting is worth…" label (iter-14 #8). Optional so
  // older callers/tests fall back to the trueWin×pot estimate.
  actionEv?: { fold: number; call: number; raise: number };
  // The frozen decision the verdict describes (iter-12 #2). When present, Mental Math builds from
  // THIS snapshot (board/street/opponent-count/made-hand) so it can never drift to a later board than
  // the verdict it sits under. Absent (older records, no decision yet) ⇒ fall back to the live store.
  frozen?: FrozenDecisionContext | null;
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

  // The displayed math is PINNED to the frozen decision the verdict describes when one is present
  // (iter-12 #2) — same board/street/opponent-count as the verdict above. Only when no decision has
  // been graded (older records, or before the first decision) does it fall back to the live store's
  // re-derivation (which the `tick`-based memo below tracks). This is the "read the single source,
  // don't recompute" rule: live play uses the snapshot, not a separate live re-derive.
  // `tick` is the intentional trigger for the live fallback (flow is mutated in place — see above);
  // exhaustive-deps can't see that, so the dependency is correct but the rule flags it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveInput = useMemo(() => inputFromFlow(flow), [flow, tick]);
  const input: MentalInput = useMemo(
    () =>
      frozen
        ? {
            hole: frozen.hole,
            board: frozen.board,
            street: frozen.street,
            potBefore: frozen.potBefore,
            toCall: frozen.toCall,
            numActiveOpponents: frozen.numActiveOpponents,
          }
        : liveInput,
    [frozen, liveInput],
  );
  const estimate: MentalEstimate = useMemo(
    () => withFrozenMadeHand(buildMentalEstimate({ ...input, outsOverride }), frozen),
    [input, outsOverride, frozen],
  );
  const autoEstimate: MentalEstimate = useMemo(
    () => withFrozenMadeHand(buildMentalEstimate(input), frozen),
    [input, frozen],
  );

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
  // Conceptual depth promises "Plain words, no numbers" — but Mental Math is fundamentally a numeric
  // tool (outs counts, ×4, percentages, pot-odds, the Rule-of-4 reconciliation). iter-8 only hid the
  // named jargon, leaving the numeric body visible — a depth leak (iter-09 #2). The clean fix is to
  // not render Mental Math AT ALL in Conceptual depth (the section, its toggle, and its caption): the
  // plain-words verdict headline is the Conceptual coaching. Full numeric Mental Math stays for
  // Equity + Strict depths.
  if (conceptual) return null;

  // True when the hero CHECKED a free street (no bet to call) — the graded line on a check-is-better
  // spot (iter-19 MINOR #1). Threaded into the dollar-EV note so it endorses the check rather than
  // reading as bet advice. Mirrors the goodCheck flag the no-draw summary already uses.
  const heroChecked = frozen?.heroAction === "check" && (frozen?.toCall ?? input.toCall) <= 0;

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
                : "The Rule of 2 & 4 is for the flop and turn. For preflop, see the Preflop Chart in the References tab."}
            </Note>
          )}
          {estimate.status === "river" && (
            <>
              <Note>No cards left to come on the river — you either have your hand or you don&apos;t.</Note>
              <TrueEquityCheck estimate={estimate} trueWinPct={trueWinPct} input={input} displayUnit={displayUnit} actionEv={actionEv} heroChecked={heroChecked} />
            </>
          )}
          {estimate.status === "no-draw" && (
            <>
              <Note>{noDrawSummary(estimate, trueWinPct, heroChecked)}</Note>
              <TrueEquityCheck estimate={estimate} trueWinPct={trueWinPct} input={input} displayUnit={displayUnit} actionEv={actionEv} heroChecked={heroChecked} />
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
              betBeatsCheck={betBeatsCheck}
              actionEv={actionEv}
              heroBet={frozen?.heroAction === "bet" || frozen?.heroAction === "raise"}
              heroChecked={heroChecked}
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
  betBeatsCheck,
  actionEv,
  heroBet,
  heroChecked,
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
  betBeatsCheck?: boolean;
  actionEv?: { fold: number; call: number; raise: number };
  // Whether the hero actually bet/raised this free street (iter-13 #1) — threaded into conclusionFrom
  // so Step 6 reconciles with a ❌/⚠️ bet verdict instead of saying "just take the free card".
  heroBet?: boolean;
  // Whether the hero CHECKED a free street that's the graded line (iter-19 #1) — threaded into the
  // dollar-EV note so a good-check spot endorses checking rather than reading as bet advice.
  heroChecked?: boolean;
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

      {/* Step 3 — shade for opponents. The shaded figure is a DRAW-HIT chance (outs only), an ESTIMATE
          to improve. It is NEVER the win %, so it is always labeled "to hit", with "to win" reserved
          for the single true-equity figure in "Check your work" / the bar (iter-12 #1, iter-13 #4).
          With a made hand we additionally note the real win chance is higher (the made hand the outs
          ignore); with no made hand hitting the draw is roughly winning, but two figures both labeled
          "to win" (the shaded estimate vs the exact true win) read as inconsistent — so the shaded one
          stays an explicit "to hit" estimate. */}
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
                Roughly{" "}
                <strong data-testid="mm-shade-figure">
                  ~{estimate.opponentShade.lowPct}–{estimate.opponentShade.highPct}%{" "}
                  {estimate.madeHand ? "to hit your draw" : "to hit"}
                </strong>
                {estimate.madeHand ? "" : " (an estimate — the true win % is below)"}.
              </>
            )}
          </p>
          {estimate.madeHand && (
            <p data-testid="mm-shade-madehand-note" style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
              That&apos;s only the chance to improve your draw. You already have {estimate.madeHand.label}, so your
              real win chance is higher{trueWinPct != null ? ` (~${trueWinPct}%)` : ""} — Step 6 below reconciles to
              the true win %.
            </p>
          )}
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
          ) : heroBet ? (
            // The hero CHOSE to bet on a free street (iter-13 #1): there was no price to call, so a
            // check would have been free — but they put money in, so we must not imply they got a free
            // card. State the choice plainly so Step 5 agrees with the bet the verdict grades.
            <p style={{ margin: "2px 0", fontSize: 13 }}>
              No bet faced you, so a check would have been free — but you chose to bet.
            </p>
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
                  betBeatsCheck,
                  heroBet,
                })
              : estimate.decision!;
          // When there's no bet to call the hero is deciding whether to bet or check — not facing a
          // "call" — so the heading must not read "The call" on a bet-or-check spot (iter-10 #2).
          const step6Label =
            estimate.potOdds && estimate.potOdds.toCall <= 0 ? "Step 6 · The decision" : "Step 6 · The call";
          return (
            <div style={STEP_CARD}>
              <div style={STEP_HEAD}>
                <span>{step6Label}</span>
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

      <TrueEquityCheck estimate={estimate} trueWinPct={trueWinPct} input={input} displayUnit={displayUnit} actionEv={actionEv} heroChecked={heroChecked} />
    </div>
  );
}

function TrueEquityCheck({
  estimate,
  trueWinPct,
  input,
  displayUnit,
  actionEv,
  heroChecked = false,
}: {
  estimate: MentalEstimate;
  trueWinPct: number | null;
  input: MentalInput;
  displayUnit: "usd" | "bb";
  actionEv?: { fold: number; call: number; raise: number };
  // True when the hero CHECKED a free street (no bet to call) and that check is the graded line
  // (iter-19 MINOR #1). On a check-is-better spot a bare "Betting is worth $X" line — sitting right
  // under a verdict that praises the CHECK — read like advice to bet. When this is set, the dollar-EV
  // line names the CHECK value (ev.call) and contrasts it with betting (ev.raise) so it endorses the
  // check it sits under. Optional/false ⇒ the existing bet/call wording is unchanged.
  heroChecked?: boolean;
}) {
  if (trueWinPct == null) return null;

  const hit = estimate.ruleHitPct;
  const exact = estimate.exactHitPct;
  const potAfter = (estimate.potOdds?.potAfterCall ?? input.potBefore + input.toCall);
  // Match the dollar-EV verb to the ACTUAL action so the line never says "Calling" about a bet
  // (iter-08 #2). When there's a bet to call (toCall > 0) the hero is calling; with no bet to face
  // (toCall === 0) the money goes in as a bet, so the EV is the value of betting — UNLESS the hero
  // CHECKED that free street and checking is the graded line (iter-19 #1), in which case the line is
  // about CHECKING, contrasted with betting, so it endorses the check rather than reading as "bet".
  const evVerb = input.toCall > 0 ? "Calling" : "Betting";
  // Use the verdict's EV row that MATCHES the named action — the SAME figure the "Show the numbers"
  // table shows: a bet uses ev.raise, a call uses ev.call (iter-14 #8). Falling back to the
  // trueWin×pot estimate once put the CHECK figure under a "Betting is worth…" label. Only when no
  // analysis EV was threaded (older callers) do we recompute.
  const evValue =
    actionEv !== undefined
      ? input.toCall > 0
        ? actionEv.call
        : actionEv.raise
      : (trueWinPct / 100) * potAfter - input.toCall;
  // A CHECK that's graded right (iter-19 #1): the EV note must endorse CHECKING, not betting. Use the
  // CHECK row (ev.call — the going-forward value of checking, the SAME figure the "Show the numbers"
  // check row shows) and contrast it with the bet row (ev.raise) so the line reads "checking is worth
  // more than betting — so checking is right", never a bare "Betting is worth $X" under a check verdict.
  const goodCheckEv = heroChecked && actionEv !== undefined;
  const checkEv = actionEv?.call ?? evValue;
  const betEv = actionEv?.raise ?? evValue;

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
        {/* Unit-aware label (iter-12 #5): in BB mode the value below is in BB, so the summary must
            not say "dollar". "Show the EV" reads correctly in both units. */}
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ink-soft)" }}>
          {displayUnit === "bb" ? "Show the BB EV ▸" : "Show the dollar EV ▸"}
        </summary>
        <p data-testid="mm-ev" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>
          {goodCheckEv ? (
            <>
              Checking is worth about {money(checkEv, displayUnit)} on average — more than betting (
              {money(betEv, displayUnit)}) — so checking is right (based on the true equity).
            </>
          ) : (
            <>
              {evVerb} is worth about {money(evValue, displayUnit)} on average (based on the true equity).
            </>
          )}
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
function noDrawSummary(
  estimate: MentalEstimate,
  trueWinPct: number | null,
  // True when the hero CHECKED a free street with this made hand (iter-18 NIT #3). A check there is a
  // ✅ good decision, so the generic "it's marginal here" undercut the verdict — frame it as "not strong
  // enough to bet for value, so checking is fine" to fit the positive grade. Optional/false ⇒ unchanged.
  goodCheck = false,
): string {
  if (estimate.madeHand) {
    if (trueWinPct == null) {
      return `No extra outs to count — you already have ${estimate.madeHand.label}. See the true win % below.`;
    }
    const win = Math.round(trueWinPct);
    if (trueWinPct >= AHEAD_THRESHOLD_PCT) {
      return `No extra outs to count — but you already have ${estimate.madeHand.label} and win ~${win}%, so you're often ahead already.`;
    }
    // A good CHECK of this made hand: don't call the ACTION "marginal" (which read as criticism next to
    // a ✅ Good verdict, iter-18 NIT #3). Say the hand isn't strong enough to bet for value, so checking
    // is fine — matching the verdict. The bet/call spots keep the neutral "it's marginal here" wording.
    if (goodCheck) {
      return `No extra outs to count — you have ${estimate.madeHand.label}, but at ~${win}% it's not strong enough to bet for value, so checking is fine.`;
    }
    return `No extra outs to count — you have ${estimate.madeHand.label}, but at ~${win}% to win it's marginal here.`;
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
