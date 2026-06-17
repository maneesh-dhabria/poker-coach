// Deterministic decision analysis — the SINGLE source of verdict + conceptTags (spec §17).
// Routes a decision to one of five branches (preflop chart, value-check, aggression, call, fold),
// each producing a verdict, concept tags, the numbers block, and a depth-aware explanation.
// The DecisionAnalysis shape (§9.2) is the stable contract the /poker-coach skill reads as truth.
import { ConceptTag } from "@/core/analysis/conceptTags";
import { potOdds, evCall, evRaise } from "@/core/analysis/heuristics";
import { buildExplanation } from "@/core/analysis/explain";
import { chartAction as lookupChart, chartApplies, Position, Facing, ChartAction } from "@/core/charts/preflop";
import { Card } from "@/core/cards";
import { detectMadeHand } from "@/core/mental/estimate";
import { MadeHand } from "@/core/mental/types";
import {
  Verdict,
  CoachingDepth,
  Unit,
  HeroAction,
  Street,
  DecisionAnalysis,
} from "@/core/analysis/types";

export type { Verdict, CoachingDepth, Unit, HeroAction, Street, DecisionAnalysis };

export interface AnalyzeInput {
  action: HeroAction;
  potBefore: number; // pot size before the hero's action
  toCall: number; // chips needed to continue (0 if checking)
  equityPct: number; // hero win% vs the assumed range, 0..100
  unit?: Unit; // default usd
  coachingDepth?: CoachingDepth; // default equity
  assumedRange?: string;
  // T8 context (all optional — absence falls back to the price/aggression heuristics):
  street?: Street;
  numActiveOpponents?: number;
  hand?: [Card, Card]; // for preflop chart lookup
  position?: Position;
  facing?: Facing;
  raiseToExtra?: number; // chips risked beyond a call if raising (enables EV(raise))
  foldEquityPct?: number; // assumed villain fold% to a raise
  // iter-06 #1: the hero's hole cards + the current board. When given on a postflop bet/raise, a
  // made hand (pair or better) is detected so a low-equity VALUE bet is never tagged a no-equity
  // bluff. ADDITIVE/optional — absent ⇒ today's equity-only behavior (card-less tests still pass).
  hole?: [Card, Card];
  board?: Card[];
  // iter-06 #3: the open/raise-to size and the big blind, so a preflop OPEN can be flagged when its
  // size is absurd (e.g. a ~50 BB open of a 1.5 BB pot). ADDITIVE/optional — absent ⇒ size unchecked.
  raiseToAmount?: number; // total chips the hero is raising TO (not the increment)
  bigBlind?: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

interface Branch {
  verdict: Verdict;
  severity: 0 | 1 | 2 | 3;
  conceptTags: ConceptTag[];
  kind: "price" | "preflop" | "valuecheck" | "aggression" | "freecheckfold";
  gtoClaim: boolean;
  chart?: { applies: boolean; chartAction: string; heroDeviates: boolean };
  chartActionForExplain?: ChartAction;
  heroDeviates?: boolean;
  // True when the preflop OPEN size is absurd and the explanation should flag it (iter-06 #3).
  flagOversize?: boolean;
}

export function analyze(input: AnalyzeInput): DecisionAnalysis {
  const unit = input.unit ?? "usd";
  const depth = input.coachingDepth ?? "equity";
  const { action, potBefore, toCall, equityPct } = input;

  const potOddsPct = potOdds(potBefore, toCall);
  const raiseExtra = input.raiseToExtra ?? (toCall > 0 ? toCall * 2 : potBefore);
  const ev = {
    fold: 0,
    call: round1(evCall(potBefore, toCall, equityPct)),
    raise: round1(evRaise(potBefore, raiseExtra, equityPct, input.foldEquityPct ?? 0)),
  };

  // A made hand the hero already holds, detected from the cards (iter-06 #1). Only meaningful when
  // aggressive postflop; absent cards ⇒ null ⇒ today's equity-only behavior. detectMadeHand needs a
  // full 5-card combo (it returns null otherwise), so preflop/short boards naturally yield null.
  const madeHand: MadeHand | null =
    input.hole && input.board ? detectMadeHand(input.hole, input.board) : null;

  // The preflop open size in big blinds, for the oversize check (iter-06 #3). Only an OPEN (first-in
  // raise, no bet to call) is sized here; facing-a-bet 3-bets are not flagged by this conservative rule.
  const openSizeBb =
    input.raiseToAmount && input.bigBlind && input.bigBlind > 0
      ? input.raiseToAmount / input.bigBlind
      : undefined;

  const branch = route(input, madeHand, openSizeBb);

  const plainExplanation = buildExplanation({
    kind: branch.kind,
    verdict: branch.verdict,
    depth,
    unit,
    action,
    potBefore,
    toCall,
    equityPct,
    potOddsPct,
    hand: input.hand,
    position: input.position,
    chartAction: branch.chartActionForExplain,
    heroDeviates: branch.heroDeviates,
    numActiveOpponents: input.numActiveOpponents,
    madeHand,
    openSizeBb: branch.flagOversize ? openSizeBb : undefined,
  });

  return {
    schemaVersion: 1,
    verdict: branch.verdict,
    severity: branch.severity,
    conceptTags: branch.conceptTags,
    coachingDepth: depth,
    gtoClaim: branch.gtoClaim,
    assumedRange: input.assumedRange ?? null,
    numbers: { equityPct: round1(equityPct), potOddsPct: round1(potOddsPct), ev, unit },
    plainExplanation,
    ...(branch.chart ? { chart: branch.chart } : {}),
    // Structured inputs so the live UI can re-format the sentence in the display unit (iter-04 #3).
    explanationInput: {
      kind: branch.kind,
      action,
      potBefore,
      toCall,
      equityPct: round1(equityPct),
      potOddsPct: round1(potOddsPct),
      chartAction: branch.chartActionForExplain,
      heroDeviates: branch.heroDeviates,
      position: input.position,
      hand: input.hand,
      numActiveOpponents: input.numActiveOpponents,
      ...(madeHand ? { madeHand } : {}),
      ...(branch.flagOversize && openSizeBb !== undefined ? { openSizeBb } : {}),
    },
  };
}

// An open/raise this many big blinds or larger is treated as an absurd oversize (iter-06 #3). A
// standard open is ~2–4 BB; even a fat 4–5x is well under 10, so this never flags a normal open.
const OVERSIZE_OPEN_BB = 10;

function route(input: AnalyzeInput, madeHand: MadeHand | null, openSizeBb?: number): Branch {
  const { action, equityPct } = input;
  const street = input.street ?? "preflop";

  // 1. Preflop chart branch — the only place we claim GTO-ish correctness (gtoClaim=true).
  if (
    street === "preflop" &&
    input.hand &&
    input.position &&
    input.facing &&
    chartApplies(input.position, input.facing)
  ) {
    // Flag the SIZE only on a first-in OPEN (raise, nothing to call) that's absurdly large; a 3-bet
    // facing a raise is intentionally not size-checked by this conservative rule.
    const isOpen = action === "raise" && input.facing === "unopened";
    const oversize = isOpen && openSizeBb !== undefined && openSizeBb >= OVERSIZE_OPEN_BB;
    return preflopBranch(input.hand, input.position, input.facing, action, oversize);
  }

  // 2..5 postflop / no-chart heuristics.
  if (action === "check") return checkBranch(equityPct);
  if (action === "bet" || action === "raise") return aggressionBranch(equityPct, madeHand);
  if (action === "fold") {
    // No chips to call means checking is free — folding forfeits a free look at the pot and is
    // strictly dominated by checking. That's a different (and always wrong) decision than folding
    // to a bet, so it gets its own branch instead of the pot-odds "price" framing (which would
    // nonsensically read "$0 to win, need 0%").
    return input.toCall === 0
      ? freeCheckFoldBranch(equityPct)
      : foldBranch(equityPct, potOdds(input.potBefore, input.toCall), street);
  }
  return callBranch(equityPct, potOdds(input.potBefore, input.toCall));
}

function toChartAction(action: HeroAction): ChartAction {
  if (action === "fold") return "fold";
  if (action === "bet" || action === "raise") return "raise";
  return "call"; // call / check
}

function preflopBranch(
  hand: [Card, Card],
  position: Position,
  facing: Facing,
  action: HeroAction,
  oversize = false,
): Branch {
  const rec = lookupChart(hand, position, facing);
  const hero = toChartAction(action);
  const deviates = hero !== rec;
  const chart = { applies: true, chartAction: rec, heroDeviates: deviates };
  const base = {
    kind: "preflop" as const,
    gtoClaim: true,
    chart,
    chartActionForExplain: rec,
    heroDeviates: deviates,
  };

  // An absurdly oversized OPEN: the decision to raise can be right, but the SIZE is far off — so it
  // is never praised as "the standard, profitable play". Flag the size (note + tag) at a ⚠️ thin
  // verdict, regardless of whether the action class matches the chart (iter-06 #3).
  if (oversize) {
    const tags: ConceptTag[] = ["preflop_oversize"];
    if (deviates) tags.push("preflop_chart_deviation");
    return {
      ...base,
      verdict: "thin",
      severity: 1,
      conceptTags: tags,
      flagOversize: true,
    };
  }

  if (!deviates) {
    return { ...base, verdict: "good", severity: 0, conceptTags: ["good_preflop_discipline"] };
  }
  const tags: ConceptTag[] = ["preflop_chart_deviation"];
  if (rec !== "fold" && hero === "fold") {
    tags.push("fold_too_tight");
    return { ...base, verdict: "mistake", severity: 2, conceptTags: tags };
  }
  if (rec === "fold" && hero !== "fold") {
    // Chart says fold, hero kept playing. Pick a tag that matches what the hero actually DID: a call
    // is "call too wide", but a bet/raise is not a call — tag it action-neutrally (iter-03 #4).
    tags.push(action === "call" ? "call_too_wide" : "played_too_wide");
    return { ...base, verdict: "mistake", severity: 2, conceptTags: tags };
  }
  // raise-vs-call mismatch: right to continue, wrong aggression level → thin.
  return { ...base, verdict: "thin", severity: 1, conceptTags: tags };
}

function checkBranch(equityPct: number): Branch {
  const base = { kind: "valuecheck" as const, gtoClaim: false };
  if (equityPct >= 60)
    return { ...base, verdict: "mistake", severity: 2, conceptTags: ["value_bet_missed"] };
  if (equityPct >= 52)
    return { ...base, verdict: "thin", severity: 1, conceptTags: ["value_bet_missed"] };
  return { ...base, verdict: "good", severity: 0, conceptTags: [] };
}

function aggressionBranch(equityPct: number, madeHand: MadeHand | null): Branch {
  const base = { kind: "aggression" as const, gtoClaim: false };
  if (equityPct < 33) {
    // A MADE hand (pair or better) bet at low equity is NOT a bluff with no equity — it has real
    // showdown value (iter-06 #1). The low win% is about being multiway on a dangerous board, so it's
    // a thin/vulnerable VALUE bet, not a stone bluff. Only a genuine no-made-hand low-equity bet keeps
    // the bluff_no_equity tag + mistake verdict.
    if (madeHand)
      return { ...base, verdict: "thin", severity: 1, conceptTags: ["made_hand_thin_value"] };
    return { ...base, verdict: "mistake", severity: 2, conceptTags: ["bluff_no_equity"] };
  }
  if (equityPct < 50)
    return { ...base, verdict: "thin", severity: 1, conceptTags: ["thin_value_good"] };
  return { ...base, verdict: "good", severity: 0, conceptTags: [] };
}

function callBranch(equityPct: number, potOddsPct: number): Branch {
  const edge = equityPct - potOddsPct;
  const base = { kind: "price" as const, gtoClaim: false };
  if (edge >= 3) return { ...base, verdict: "good", severity: 0, conceptTags: ["call_correct_price"] };
  // Essentially-breakeven calls (edge within a small band of 0) are ⚠️ marginal, not ❌ mistakes
  // (iter-06 #6): a call at ~14% equity vs a ~13.5% price is roughly zero-EV, not a clear error. The
  // band is widened slightly below 0 so a near-breakeven call grades thin; clearly -EV calls (edge <
  // -2) stay mistakes.
  if (edge >= -2) return { ...base, verdict: "thin", severity: 1, conceptTags: ["thin_value_good"] };
  return {
    ...base,
    verdict: "mistake",
    severity: edge <= -15 ? 3 : 2,
    conceptTags: ["call_too_wide"],
  };
}

// Folding when checking is free. Always a mistake — checking costs nothing and keeps your hand
// alive — so the verdict does not depend on equity; equity only scales how much was given up.
function freeCheckFoldBranch(equityPct: number): Branch {
  return {
    kind: "freecheckfold",
    gtoClaim: false,
    verdict: "mistake",
    severity: equityPct >= 25 ? 3 : 2,
    conceptTags: ["fold_too_tight"],
  };
}

function foldBranch(equityPct: number, potOddsPct: number, street: Street): Branch {
  const edge = equityPct - potOddsPct;
  const base = { kind: "price" as const, gtoClaim: false };
  if (edge >= 5)
    return {
      ...base,
      verdict: "mistake",
      severity: edge >= 15 ? 3 : 2,
      conceptTags: ["fold_too_tight"],
    };
  // A sound fold. Tag it by street so a river fold is never labeled "preflop" (iter-03 #4): a
  // preflop fold keeps the discipline tag, any later street gets the street-neutral fold tag.
  const tag: ConceptTag = street === "preflop" ? "good_preflop_discipline" : "good_fold_discipline";
  return { ...base, verdict: "good", severity: 0, conceptTags: [tag] };
}
