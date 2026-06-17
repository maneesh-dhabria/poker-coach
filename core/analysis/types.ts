// Shared analysis types — kept in their own module so explain.ts and analyze.ts can both import
// them without a circular dependency. The DecisionAnalysis shape is the §9.2 contract the
// /poker-coach skill treats as read-only ground truth.
import { ConceptTag } from "@/core/analysis/conceptTags";

export type Verdict = "good" | "thin" | "mistake";
export type CoachingDepth = "conceptual" | "equity" | "strict";
export type Unit = "usd" | "bb";
export type HeroAction = "fold" | "check" | "call" | "bet" | "raise";
export type Street = "preflop" | "flop" | "turn" | "river";

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
  // Structured inputs behind `plainExplanation`, so a presentation layer can RE-FORMAT the sentence
  // in the session's display unit (e.g. render the cost/pot in BB) without recomputing the verdict —
  // unit reformatting is presentation, not a new judgment (iter-04 #3). Additive/optional: the
  // persisted `plainExplanation` stays the canonical USD string the coach skill reads; the schema
  // validator ignores extra keys, so no schemaVersion bump.
  explanationInput?: ExplanationInput;
}

// The minimal slice of the explanation builder's inputs needed to re-format the sentence in another
// unit. Mirrors the money-bearing fields of explain.ts's ExplainParams (kept structural to avoid a
// circular import). All numeric amounts are in dollars.
export interface ExplanationInput {
  kind: "price" | "preflop" | "valuecheck" | "aggression" | "freecheckfold";
  action: HeroAction;
  potBefore: number;
  toCall: number;
  equityPct: number;
  potOddsPct: number;
  chartAction?: "raise" | "call" | "fold";
  heroDeviates?: boolean;
  position?: string;
  hand?: [string, string];
  numActiveOpponents?: number;
}
