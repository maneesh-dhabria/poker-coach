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
  kind: "price" | "preflop" | "valuecheck" | "aggression" | "freecheckfold" | "isoraise";
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
  // The decision's frozen board + street (iter-12 #2). Lets the live UI pin the Mental Math
  // walk-through to the SAME snapshot the verdict describes — so after the hero acts and the engine
  // deals the next card, Mental Math can't drift to a later board/street than the verdict it sits
  // under. ADDITIVE/optional — older records (and card-less tests) simply omit them, and the live UI
  // falls back to the game store. Cards are stored as raw strings to avoid importing core/cards here.
  board?: string[];
  street?: Street;
  // A made hand the hero already holds (iter-06 #1), so a re-formatted sentence still says "value
  // bet, not a bluff" rather than "no equity". Structural to avoid importing core/mental here.
  madeHand?: { category: number; label: string } | null;
  // The hero's open size in big blinds when the open is flagged as oversized (iter-06 #3).
  openSizeBb?: number;
  // True when a postflop value bet was flagged as grossly under-sized (iter-08 #1), so a re-formatted
  // sentence still says the bet is too small to charge draws / build the pot.
  betTooSmall?: boolean;
  // The pot-multiple of a GROSS overbet bet/raise (iter-13 #2), so a re-formatted sentence still flags
  // the absurd size ("shoving ~13× the pot"). Present only when the overbet flag fired.
  overbetPotMultiple?: number;
  // True when this is a LOOSE preflop OPEN (chart folds, hero raised, off-model — iter-22 MAJOR-1a),
  // so a re-formatted sentence keeps the preflop position+strength "raise" framing rather than the
  // postflop semi-bluff/"no made hand" copy. Present only on a loose-open decision.
  looseOpen?: boolean;
  // True when the loose open was over LIMPERS, so a re-formatted sentence acknowledges the limpers
  // rather than claiming "first-in" (iter-24 MINOR 2). Present only on a limped-pot loose open.
  limpedPot?: boolean;
}
