// Deterministic decision analysis — the SINGLE source of verdict + conceptTags (spec §17).
// Routes a decision to one of five branches (preflop chart, value-check, aggression, call, fold),
// each producing a verdict, concept tags, the numbers block, and a depth-aware explanation.
// The DecisionAnalysis shape (§9.2) is the stable contract the /poker-coach skill reads as truth.
import { ConceptTag } from "@/core/analysis/conceptTags";
import { potOdds, evCall, evRaise } from "@/core/analysis/heuristics";
import { buildExplanation } from "@/core/analysis/explain";
import { chartAction as lookupChart, chartApplies, Position, Facing, ChartAction } from "@/core/charts/preflop";
import { Card } from "@/core/cards";
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

  const branch = route(input);

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
  };
}

function route(input: AnalyzeInput): Branch {
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
    return preflopBranch(input.hand, input.position, input.facing, action);
  }

  // 2..5 postflop / no-chart heuristics.
  if (action === "check") return checkBranch(equityPct);
  if (action === "bet" || action === "raise") return aggressionBranch(equityPct);
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

function preflopBranch(hand: [Card, Card], position: Position, facing: Facing, action: HeroAction): Branch {
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

function aggressionBranch(equityPct: number): Branch {
  const base = { kind: "aggression" as const, gtoClaim: false };
  if (equityPct < 33)
    return { ...base, verdict: "mistake", severity: 2, conceptTags: ["bluff_no_equity"] };
  if (equityPct < 50)
    return { ...base, verdict: "thin", severity: 1, conceptTags: ["thin_value_good"] };
  return { ...base, verdict: "good", severity: 0, conceptTags: [] };
}

function callBranch(equityPct: number, potOddsPct: number): Branch {
  const edge = equityPct - potOddsPct;
  const base = { kind: "price" as const, gtoClaim: false };
  if (edge >= 3) return { ...base, verdict: "good", severity: 0, conceptTags: ["call_correct_price"] };
  if (edge >= -1) return { ...base, verdict: "thin", severity: 1, conceptTags: ["thin_value_good"] };
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
