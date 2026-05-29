// Plain-language explanation builder (spec FR-27, NFR-05) — the user is not a math whiz, so every
// line pairs numbers with words at equity/strict depth, and goes fully qualitative at conceptual
// depth (no raw $ or %). All formatting lives here; analyze.ts owns the verdict logic.
import { Card, rankOf, suitOf } from "@/core/cards";
import { Verdict, CoachingDepth, Unit, HeroAction } from "@/core/analysis/types";
import { ChartAction } from "@/core/charts/preflop";

const SUIT_SYMBOL: Record<string, string> = { c: "♣", d: "♦", h: "♥", s: "♠" };

export function cardLabel(card: Card): string {
  return `${rankOf(card)}${SUIT_SYMBOL[suitOf(card)]}`;
}

export function handLabel(cards: [Card, Card]): string {
  return cards.map(cardLabel).join("");
}

function money(amount: number, unit: Unit): string {
  const n = Math.round(amount);
  return unit === "usd" ? `$${n}` : `${n} bb`;
}

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
}

const CHART_VERB: Record<ChartAction, string> = { raise: "raise", call: "call", fold: "fold" };

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

function freeCheckFold(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  return `There's no bet to call — checking is free. Folding throws away a hand that still wins ~${win}% for nothing. When you can check, never fold: take the free card.`;
}

function price(p: ExplainParams): string {
  const pot = money(p.potBefore + p.toCall, p.unit);
  const cost = money(p.toCall, p.unit);
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

function preflop(p: ExplainParams): string {
  const label = p.hand ? handLabel(p.hand) : "this hand";
  const rec = p.chartAction ? CHART_VERB[p.chartAction] : "play";
  const where = p.position ? ` from ${p.position}` : "";
  if (!p.heroDeviates) return `The baseline chart says ${rec} ${label}${where} — that's standard.`;
  return `The baseline chart says ${rec} ${label}${where}; your line differs. Sticking to the chart is the higher-EV default here.`;
}

function valuecheck(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  if (p.verdict === "good") return `Checking is fine here — you only win about ${win}%, so there's little to bet for.`;
  return `You win ~${win}% here — checking gives up value. A bet earns more from worse hands.`;
}

function aggression(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  if (p.verdict === "good") return `Betting for value with ~${win}% is good — get money in while ahead.`;
  if (p.verdict === "thin") return `A thin bet with ~${win}% — fine as value or a semi-bluff, but it's marginal.`;
  return `You're betting with only ~${win}% and little fold equity — there's not enough behind it.`;
}

function conceptual(p: ExplainParams): string {
  switch (p.kind) {
    case "price":
      if (p.verdict === "good")
        return p.action === "fold"
          ? "You don't have the price to continue — folding is right."
          : "You're getting a good price here — an easy continue.";
      if (p.verdict === "thin") return "It's close, but just about worth continuing.";
      return p.action === "fold"
        ? "This was a spot to keep going, not fold."
        : "You're continuing too loosely here — folding is cleaner.";
    case "preflop":
      return p.heroDeviates
        ? "This differs from the standard baseline line for this spot."
        : "This is the standard line for this spot.";
    case "valuecheck":
      return p.verdict === "good"
        ? "Checking is fine — you're not strong enough to bet for value."
        : "You're strong here — checking gives up value; betting earns more.";
    case "aggression":
      if (p.verdict === "good") return "Strong hand — betting for value is right.";
      if (p.verdict === "thin") return "A marginal bet — fine as thin value or a semi-bluff.";
      return "You're betting with little behind it — there's not enough here.";
    case "freecheckfold":
      return "There was no bet to fold to — checking is free. Never fold when you can see the next card for nothing.";
  }
}
