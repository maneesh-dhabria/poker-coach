// Plain-language explanation builder (spec FR-27, NFR-05) — the user is not a math whiz, so every
// line pairs numbers with words at equity/strict depth, and goes fully qualitative at conceptual
// depth (no raw $ or %). All formatting lives here; analyze.ts owns the verdict logic.
import { Card, rankOf, suitOf } from "@/core/cards";
import { Verdict, CoachingDepth, Unit, HeroAction, DecisionAnalysis } from "@/core/analysis/types";
import { ChartAction } from "@/core/charts/preflop";
import { handCategoryLabel } from "@/core/eval/handEval";
import { MadeHand } from "@/core/mental/types";

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };

export function cardLabel(card: Card): string {
  return `${rankOf(card)}${SUIT_SYMBOL[suitOf(card)]}`;
}

export function handLabel(cards: [Card, Card]): string {
  return cards.map(cardLabel).join("");
}

// Format a dollar amount in the chosen unit. In bb mode the amount is divided by the big blind (the
// amounts passed in are dollars, e.g. a $108 cost-to-call), matching the rest of the app's
// formatMoney semantics, so the explanation sentence reads in BB when the session unit is BB
// (iter-04 #3). Defaults bigBlind to the $1/$2 table's 2 so existing USD callers are unaffected.
function money(amount: number, unit: Unit, bigBlind = BIG_BLIND): string {
  if (unit === "bb" && bigBlind > 0) {
    const bb = Math.round((amount / bigBlind) * 10) / 10;
    const text = Number.isInteger(bb) ? String(bb) : bb.toFixed(1);
    return `${text} BB`;
  }
  return `$${Math.round(amount)}`;
}

const BIG_BLIND = 2; // the W2 table plays $1/$2; persistent config arrives later

export interface ExplainParams {
  kind: "price" | "preflop" | "valuecheck" | "aggression" | "freecheckfold";
  verdict: Verdict;
  depth: CoachingDepth;
  unit: Unit;
  action: HeroAction;
  potBefore: number;
  toCall: number;
  equityPct: number;
  potOddsPct: number;
  hand?: [Card, Card];
  position?: string;
  chartAction?: ChartAction;
  heroDeviates?: boolean;
  // How many opponents are still live when the hero acts. The live equity is computed MULTIWAY (vs
  // the assumed ranges of all of them), so the copy must describe it as "against N opponents", NOT
  // "a random hand" — a singular-random-hand label is a heads-up teaching number (References chart)
  // and disagrees badly with the multiway figure for a premium pair (iter-04 #2).
  numActiveOpponents?: number;
  // Big blind in dollars, so the explanation sentence's money renders in BB when unit==="bb"
  // (iter-04 #3). Optional; defaults to the $1/$2 table's 2.
  bigBlind?: number;
  // A made hand (pair or better) the hero already holds, if any (iter-06 #1). When present, a
  // low-equity bet/raise is honest VALUE with showdown value — never a "bluff with no equity".
  madeHand?: MadeHand | null;
  // The hero's open/raise-to size in big blinds, when this is a preflop OPEN (iter-06 #3). Enables
  // flagging an absurd oversize without false-positiving normal 2–4 BB opens.
  openSizeBb?: number;
}

const CHART_VERB: Record<ChartAction, string> = { raise: "raise", call: "call", fold: "fold" };

// The present-participle of a chart verb, built explicitly so we never get the naive "raise"+"ing"
// → "raiseing" bug (iter-04 #4). "raise" → "raising", "call" → "calling", "fold" → "folding".
const CHART_VERB_ING: Record<ChartAction, string> = {
  raise: "raising",
  call: "calling",
  fold: "folding",
};

// Phrase the opponent count the live multiway equity is measured against (iter-04 #2). Never the
// misleading singular "a random hand" (that's the heads-up References number). Falls back to a
// neutral "the players still in" when the count is unknown.
function opponentPhrase(numActiveOpponents?: number): string {
  if (numActiveOpponents === undefined || numActiveOpponents <= 0) return "the players still in";
  if (numActiveOpponents === 1) return "the 1 opponent still in";
  return `the ${numActiveOpponents} opponents still in`;
}

export function buildExplanation(p: ExplainParams): string {
  if (p.depth === "conceptual") return conceptual(p);
  switch (p.kind) {
    case "price":
      return price(p);
    case "preflop":
      return preflop(p);
    case "valuecheck":
      return valuecheck(p);
    case "aggression":
      return aggression(p);
    case "freecheckfold":
      return freeCheckFold(p);
  }
}

// Re-format the plain explanation for a decision in a different display unit (iter-04 #3). This is
// PRESENTATION only — it re-runs the same pure, deterministic builder with the stored verdict /
// depth / amounts and a different unit; it never recomputes a verdict (that came from analyze.ts and
// is read verbatim). The persisted `plainExplanation` (always USD) stays the coach skill's
// canonical record. If the analysis predates `explanationInput` (older record), the caller falls
// back to the stored sentence. `bigBlind` is the $ value of one big blind so BB amounts divide out.
export function formatExplanation(
  analysis: DecisionAnalysis,
  unit: Unit,
  bigBlind: number,
): string {
  const ei = analysis.explanationInput;
  if (!ei) return analysis.plainExplanation; // back-compat: no structured input to re-render
  return buildExplanation({
    kind: ei.kind,
    verdict: analysis.verdict,
    depth: analysis.coachingDepth,
    unit,
    action: ei.action,
    potBefore: ei.potBefore,
    toCall: ei.toCall,
    equityPct: ei.equityPct,
    potOddsPct: ei.potOddsPct,
    hand: ei.hand as [Card, Card] | undefined,
    position: ei.position,
    chartAction: ei.chartAction,
    heroDeviates: ei.heroDeviates,
    numActiveOpponents: ei.numActiveOpponents,
    madeHand: ei.madeHand ?? null,
    openSizeBb: ei.openSizeBb,
    bigBlind,
  });
}

function freeCheckFold(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  return `There's no bet to call — checking is free. Folding throws away a hand that still wins ~${win}% for nothing. When you can check, never fold: take the free card.`;
}

function price(p: ExplainParams): string {
  const pot = money(p.potBefore + p.toCall, p.unit, p.bigBlind);
  const cost = money(p.toCall, p.unit, p.bigBlind);
  const need = Math.round(p.potOddsPct);
  const win = Math.round(p.equityPct);
  const lead = `It costs you ${cost} to win a ${pot} pot — you only need to win about ${need}% of the time. Your hand wins ~${win}%.`;
  if (p.verdict === "good")
    return p.action === "fold"
      ? `${lead} Folding is right — you don't have the odds.`
      : `${lead} Easy call — you're getting a great price.`;
  if (p.verdict === "thin") return `${lead} Close, but just about worth it.`;
  return p.action === "fold"
    ? `${lead} That's a clear call — folding here costs you money.`
    : `${lead} You're calling too wide — fold and save the chips.`;
}

// Preflop explanation framing follows the chosen coaching depth (finding #7). The chart is ALWAYS
// the source of the recommendation (honesty invariant: gtoClaim stays true for preflop) — only the
// way we EXPLAIN it changes. Strict leans on the chart/GTO citation; Equity+Heuristics leads with
// the win-rate / odds and a plain reason, then names the chart as the source so we never misstate
// what the recommendation is based on. (Conceptual is handled separately, in conceptual().)
function preflop(p: ExplainParams): string {
  const label = p.hand ? handLabel(p.hand) : "this hand";
  const rec = p.chartAction ? CHART_VERB[p.chartAction] : "play";
  const where = p.position ? ` from ${p.position}` : "";

  // An absurdly oversized OPEN (iter-06 #3): raising can be right, but the SIZE is far off, so we
  // never call it "the standard, profitable play". Lead with the size, keep it depth-light.
  if (p.openSizeBb !== undefined) {
    const bb = Math.round(p.openSizeBb);
    return `Raising ${label}${where} can be fine, but ${bb} BB is far bigger than a standard open (about 2–3 BB) — that size bloats the pot out of position and risks a lot to win a little. Size it down to a normal open.`;
  }

  // Strict charts → the chart/GTO citation it has always given.
  if (p.depth === "strict") {
    if (!p.heroDeviates) return `The baseline chart says ${rec} ${label}${where} — that's standard.`;
    return `The baseline chart says ${rec} ${label}${where}; your line differs. Sticking to the chart is the higher-EV default here.`;
  }

  // Equity + Heuristics → lead with the odds/equity and a plain reason; the chart is named as the
  // source of the recommendation, not the headline. Equity is "share of the pot — how often you win"
  // (defined inline to satisfy the no-unexplained-jargon guard). The win% here is MULTIWAY (vs all
  // live opponents' assumed ranges), so it's labeled "against the N opponents still in", NOT "a
  // random hand" — that singular phrase reads as heads-up and contradicts the chart's 1-on-1 teaching
  // number (iter-04 #2). The verb is built from CHART_VERB_ING so "raise" → "raising" (iter-04 #4).
  const win = Math.round(p.equityPct);
  const ing = p.chartAction ? CHART_VERB_ING[p.chartAction] : "playing";
  const opps = opponentPhrase(p.numActiveOpponents);
  const equityNote = `your equity (your share of the pot — how often you win) with ${label} is about ${win}% to win against ${opps}`;
  if (!p.heroDeviates) {
    return `By the odds, ${equityNote}, so ${ing}${where} is the standard, profitable play here — which is what the baseline chart recommends too.`;
  }
  return `By the odds, ${equityNote}; the math favors ${ing}${where} instead, and your line differs from that higher-EV default (the baseline chart agrees).`;
}

function valuecheck(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  if (p.verdict === "good") return `Checking is fine here — you only win about ${win}%, so there's little to bet for.`;
  return `You win ~${win}% here — checking gives up value. A bet earns more from worse hands.`;
}

function aggression(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  const act = p.action === "raise" ? "Raising" : "Betting";
  const noun = p.action === "raise" ? "raise" : "bet";
  // A made hand with low equity is never a "bluff with no equity" (iter-06 #1): it has real showdown
  // value, so the low win% is about being multiway on a dangerous board, not about having nothing.
  // This takes precedence over the generic thin copy so the made hand is always named, not hidden.
  if (p.madeHand && p.equityPct < 33)
    return `You have ${p.madeHand.label} — a real made hand with showdown value, so this is a value ${noun}. But multiway on a dangerous board your ~${win}% to win is low, so it's a thin, vulnerable ${noun}.`;
  if (p.verdict === "good") return `${act} for value with ~${win}% is good — get money in while ahead.`;
  if (p.verdict === "thin") return `A thin ${noun} with ~${win}% — fine as value or a semi-bluff, but it's marginal.`;
  return `You're betting with only ~${win}% and little chance of folding out a better hand — there's not enough behind it.`;
}

// --- T19: winner's-perspective fold narration (spec FR-62, FR-63, FR-64, E7) ----------------
// When the hero folds, coaching should still say who won, with what, and what was sound — sourced
// entirely from the OutcomeRecord. It NEVER invents a hand the winner didn't show, and only mentions
// a "baseline" when gtoClaim is true (preflop chart claims only). Pure; no new judgments.

/** The slice of OutcomeRecord this narrator needs (kept structural so callers stay decoupled). */
export interface WinnerOutcome {
  winners: { seat: number; amount: number }[];
  heroNet: number;
  shown: { seat: number; cards: Card[] }[];
  endedAtShowdown: boolean;
}

export interface NarrateOpts {
  /** True only when an upstream chart claim applies (preflop). Gates any "baseline" language (FR-63). */
  gtoClaim: boolean;
}

export function narrateWinner(
  outcome: WinnerOutcome,
  board: Card[],
  opts: NarrateOpts,
): string {
  const { winners, shown } = outcome;
  // Only ever assert a "baseline" when an upstream chart claim says so (FR-63).
  const baselineNote = opts.gtoClaim ? " Folding here was the baseline play." : "";

  if (winners.length === 0) return `The pot was uncontested.${baselineNote}`;

  if (winners.length > 1) {
    const seats = winners.map((w) => `Seat ${w.seat}`).join(" and ");
    return `${seats} split the pot.${baselineNote}`;
  }

  const w = winners[0];
  const shownCards = shown.find((s) => s.seat === w.seat)?.cards;

  // Winner showed down → name the made hand via the shared evaluator label.
  if (shownCards && shownCards.length >= 2) {
    const label = handCategoryLabel([...shownCards, ...board]);
    return `Seat ${w.seat} won with ${label}.${baselineNote}`;
  }

  // Winner mucked → narrate at the pot level; no invented hand (E7).
  return `Seat ${w.seat} took the pot — their cards weren't shown, so there's no made hand to read here.${baselineNote}`;
}

function conceptual(p: ExplainParams): string {
  switch (p.kind) {
    case "price":
      if (p.verdict === "good")
        return p.action === "fold"
          // The honest reason to fold for a price is that the hand wins too rarely to justify the
          // call — NOT that "the pot isn't big enough" (it can be huge; iter-03 #5). Frame it as
          // win-chance vs the price, in plain words.
          ? "Your hand wins too rarely to call this price — you'd be paying more than it can win back often enough, so folding is right."
          : "You're getting a good price here — your hand wins often enough relative to the call, so it's an easy continue.";
      if (p.verdict === "thin") return "It's close, but just about worth continuing.";
      return p.action === "fold"
        ? "This was a spot to keep going, not fold."
        : "You're continuing too loosely here — folding is cleaner.";
    case "preflop":
      // Oversized open: flag the SIZE in plain words, no numbers (iter-06 #3).
      if (p.openSizeBb !== undefined)
        return "Raising can be fine here, but that's a much bigger open than usual — it bloats the pot and risks a lot to win a little. Make it a normal-sized raise.";
      return p.heroDeviates
        ? "This differs from the standard baseline line for this spot."
        : "This is the standard line for this spot.";
    case "valuecheck":
      return p.verdict === "good"
        ? "Checking is fine — you're not strong enough to bet for value."
        : "You're strong here — checking gives up value; betting earns more.";
    case "aggression": {
      // Vary the copy by the action so a raise and a bet don't read identically (iter-04 #8): a
      // raise puts in MORE on top of a bet, a bet opens the betting. Same judgement, different verb.
      const raising = p.action === "raise";
      // Present-participle built explicitly so "bet" never becomes "beting" (iter-06 #2).
      const acting = raising ? "raising" : "betting";
      // A made hand still has showdown value — never call it a bluff/"nothing here" (iter-06 #1).
      // Checked first (and for the vulnerable low-equity case) so the made hand is always named.
      if (p.madeHand && p.equityPct < 33)
        return `You already have ${p.madeHand.label} — a real made hand with showdown value, so this is a value ${raising ? "raise" : "bet"}. But multiway on a dangerous board it's thin, so it's a marginal bet.`;
      if (p.verdict === "good")
        return raising
          ? "Strong hand — raising for value is right; build the pot while you're ahead."
          : "Strong hand — betting for value is right.";
      if (p.verdict === "thin")
        return raising
          ? "A marginal raise — fine to push a thin edge, but it's borderline."
          : "A marginal bet — fine as thin value or a semi-bluff.";
      return `You're ${acting} with little behind it — there's not enough here.`;
    }
    case "freecheckfold":
      return "There was no bet to fold to — checking is free. Never fold when you can see the next card for nothing.";
  }
}
