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
}
