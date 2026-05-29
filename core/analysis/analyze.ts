// Deterministic decision analysis — the SINGLE source of verdict + conceptTags (spec §17).
// T3 tracer scope: grade a call/fold from pot odds vs a supplied equity. T8 widens this to
// full EV ordering, preflop charts, and postflop heuristics. The DecisionAnalysis shape (§9.2)
// is the stable contract the /poker-coach skill treats as read-only ground truth.
import { ConceptTag } from "@/core/analysis/conceptTags";

export type Verdict = "good" | "thin" | "mistake";
export type CoachingDepth = "conceptual" | "equity" | "strict";
export type Unit = "usd" | "bb";
export type HeroAction = "fold" | "check" | "call" | "bet" | "raise";

export interface AnalyzeInput {
  action: HeroAction;
  potBefore: number; // pot size before the hero's action
  toCall: number; // amount the hero must put in to continue (0 if checking)
  equityPct: number; // hero win% vs the assumed range, 0..100
  unit?: Unit; // money unit for the numbers block + explanation (default usd)
  coachingDepth?: CoachingDepth; // verbosity dial (default equity)
  assumedRange?: string; // human-readable range note
}

export interface DecisionAnalysis {
  schemaVersion: 1;
  verdict: Verdict;
  severity: 0 | 1 | 2 | 3;
  conceptTags: ConceptTag[];
  coachingDepth: CoachingDepth;
  gtoClaim: boolean;
  assumedRange: string | null;
  numbers: {
    equityPct: number | null;
    potOddsPct: number | null;
    ev: { fold: number; call: number; raise: number };
    unit: Unit;
  };
  plainExplanation: string;
  chart?: { applies: boolean; chartAction: string; heroDeviates: boolean };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Breakeven win% needed to call: cost / (pot you'd be contesting). */
function potOdds(potBefore: number, toCall: number): number {
  if (toCall <= 0) return 0;
  return (toCall / (potBefore + toCall)) * 100;
}

/** EV of calling, relative to folding (fold EV = 0): win the pot, or lose the call. */
function evCall(potBefore: number, toCall: number, equityPct: number): number {
  const p = equityPct / 100;
  return p * potBefore - (1 - p) * toCall;
}

function money(amount: number, unit: Unit): string {
  const n = Math.round(amount);
  return unit === "usd" ? `$${n}` : `${n} bb`;
}

export function analyze(input: AnalyzeInput): DecisionAnalysis {
  const unit = input.unit ?? "usd";
  const depth = input.coachingDepth ?? "equity";
  const { potBefore, toCall, equityPct } = input;

  const potOddsPct = potOdds(potBefore, toCall);
  const edge = equityPct - potOddsPct; // >0 means a call is +EV
  const ev = {
    fold: 0,
    call: round1(evCall(potBefore, toCall, equityPct)),
    raise: 0,
  };

  let verdict: Verdict;
  let severity: 0 | 1 | 2 | 3;
  const conceptTags: ConceptTag[] = [];

  if (input.action === "fold") {
    // Folding is only a mistake when calling was clearly +EV.
    if (edge >= 5) {
      verdict = "mistake";
      severity = edge >= 15 ? 3 : 2;
      conceptTags.push("fold_too_tight");
    } else {
      verdict = "good";
      severity = 0;
      conceptTags.push("good_preflop_discipline");
    }
  } else {
    // call / check / bet / raise: grade against the price.
    if (edge >= 3) {
      verdict = "good";
      severity = 0;
      conceptTags.push("call_correct_price");
    } else if (edge >= -1) {
      verdict = "thin";
      severity = 1;
      conceptTags.push("thin_value_good");
    } else {
      verdict = "mistake";
      severity = edge <= -15 ? 3 : 2;
      conceptTags.push("call_too_wide");
    }
  }

  const plainExplanation = explain({
    verdict,
    action: input.action,
    potBefore,
    toCall,
    equityPct,
    potOddsPct,
    unit,
    depth,
  });

  return {
    schemaVersion: 1,
    verdict,
    severity,
    conceptTags,
    coachingDepth: depth,
    gtoClaim: false, // T3: never claim GTO; T8 sets true only for preflop/strict charts.
    assumedRange: input.assumedRange ?? null,
    numbers: {
      equityPct: round1(equityPct),
      potOddsPct: round1(potOddsPct),
      ev,
      unit,
    },
    plainExplanation,
  };
}

function explain(p: {
  verdict: Verdict;
  action: HeroAction;
  potBefore: number;
  toCall: number;
  equityPct: number;
  potOddsPct: number;
  unit: Unit;
  depth: CoachingDepth;
}): string {
  if (p.depth === "conceptual") {
    // No raw numbers — qualitative only.
    if (p.verdict === "good") return "You're getting a good price here — an easy continue.";
    if (p.verdict === "thin") return "It's close, but just about worth continuing.";
    return p.action === "fold"
      ? "This was a spot to keep going, not fold."
      : "You're continuing too loosely here — folding is cleaner.";
  }

  const pot = money(p.potBefore + p.toCall, p.unit);
  const cost = money(p.toCall, p.unit);
  const need = Math.round(p.potOddsPct);
  const win = Math.round(p.equityPct);
  const lead = `It costs you ${cost} to win a ${pot} pot — you only need to win about ${need}% of the time. Your hand wins ~${win}%.`;

  if (p.verdict === "good") return `${lead} Easy call — you're getting a great price.`;
  if (p.verdict === "thin") return `${lead} Close, but just about worth it.`;
  return p.action === "fold"
    ? `${lead} That's a clear call — folding here costs you money.`
    : `${lead} You're calling too wide — fold and save the chips.`;
}
