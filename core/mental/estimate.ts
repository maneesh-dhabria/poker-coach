// Orchestrates the six-step Mental Math walk-through (spec §2.4, FR-03/10–15). Pure & synchronous —
// it never touches the equity engine; the component composes the async "true win %" comparison.
import { Card, Suit, suitOf, rankValue, SUITS } from "@/core/cards";
import { Street } from "@/core/analysis/types";
import { countOuts } from "@/core/mental/outs";
import { ruleOf2And4, exactHitPct, bigDrawCaveat } from "@/core/mental/hit";
import { MentalEstimate, MentalInput, OutsBreakdown, TaintFlags } from "@/core/mental/types";

/** Distinct rank values present, with an Ace also counted low (1) for wheel-aware connectedness. */
function valuesWithAceLow(cards: Card[]): Set<number> {
  const out = new Set<number>(cards.map(rankValue));
  if (out.has(14)) out.add(1);
  return out;
}

/** Step 4 board-danger flags + plain warnings (FR-13). Textual only — no auto-subtraction in v1. */
export function detectTaint(hole: [Card, Card], board: Card[]): TaintFlags {
  const all = [...hole, ...board];
  const boardSuitCount = (s: Suit) => board.filter((c) => suitOf(c) === s).length;
  const totalSuitCount = (s: Suit) => all.filter((c) => suitOf(c) === s).length;

  const breakdown = countOuts(hole, board);
  const flushGroup = breakdown.groups.find((g) => g.kind === "flush");
  const hasStraightDraw = breakdown.groups.some(
    (g) => g.kind === "open-ended-straight" || g.kind === "gutshot",
  );

  // Two-tone: a suit doubled on the board that the hero is NOT drawing to (their own draw isn't a taint).
  const twoTone = SUITS.some((s) => boardSuitCount(s) >= 2 && totalSuitCount(s) < 4);

  // Paired board → full house / trips possible against a made hand.
  const boardValues = board.map(rankValue);
  const paired = new Set(boardValues).size < boardValues.length;

  // Connected: 3+ board ranks inside a 5-card window.
  const boardVals = valuesWithAceLow(board);
  let connected = false;
  for (let start = 1; start <= 10 && !connected; start++) {
    const inWindow = [start, start + 1, start + 2, start + 3, start + 4].filter((v) => boardVals.has(v));
    if (inWindow.length >= 3) connected = true;
  }

  // Hero's flush draw not to the nuts (doesn't hold the Ace of the flush suit).
  let heroFlushNotNut = false;
  let flushSuit: Suit | null = null;
  if (flushGroup) {
    flushSuit = SUITS.find((s) => totalSuitCount(s) === 4) ?? null;
    if (flushSuit) {
      const heroTopOfSuit = Math.max(...hole.filter((c) => suitOf(c) === flushSuit).map(rankValue), 0);
      heroFlushNotNut = heroTopOfSuit < 14;
    }
  }

  // Low (idiot) end of a straight draw: hero's cards sit below the board's top connecting card.
  const heroMax = Math.max(...hole.map(rankValue));
  const boardMax = boardValues.length ? Math.max(...boardValues) : 0;
  const heroLowEndStraight = hasStraightDraw && heroMax < boardMax;

  const notes: string[] = [];
  if (twoTone) notes.push("Two of a suit are out — someone could be on a flush draw too.");
  if (paired) notes.push("The board is paired — a full house or trips is possible.");
  if (connected) notes.push("The board is connected — straights are in range.");
  if (heroFlushNotNut)
    notes.push("Your flush wouldn't be the nuts — a higher flush can still beat you.");
  if (heroLowEndStraight)
    notes.push("You're drawing to the low end — a bigger straight could be out there.");

  return { twoTone, paired, connected, heroFlushNotNut, heroLowEndStraight, notes };
}

function emptyEstimate(status: MentalEstimate["status"], street: Street | null, plainSummary: string): MentalEstimate {
  return {
    status,
    street,
    outs: null,
    taint: null,
    ruleMultiplier: null,
    ruleHitPct: null,
    exactHitPct: null,
    bigDrawCaveat: false,
    opponentShade: null,
    potOdds: null,
    decision: null,
    plainSummary,
  };
}

function potOddsOf(potBefore: number, toCall: number) {
  const potAfterCall = potBefore + toCall;
  const breakEvenPct = toCall <= 0 ? 0 : Math.round((toCall / potAfterCall) * 1000) / 10;
  return { toCall, potAfterCall, breakEvenPct };
}

/** Step 3 opponent shade (FR-12): a ranged sentence, never a single precise output number. */
function shadeFor(hitPct: number, numActiveOpponents: number) {
  if (numActiveOpponents <= 1) {
    return {
      lowPct: hitPct,
      highPct: hitPct,
      sentence: "Heads-up — hitting is basically winning, so trust the number.",
    };
  }
  const [loMul, hiMul, sentence] =
    numActiveOpponents === 2
      ? [0.8, 0.9, "Three of you in the pot — shade the estimate down a little."]
      : [0.7, 0.85, "Multiway pot — be skeptical of marginal draws; shade down more."];
  return {
    lowPct: Math.round(hitPct * loMul),
    highPct: Math.round(hitPct * hiMul),
    sentence,
  };
}

export function buildMentalEstimate(input: MentalInput): MentalEstimate {
  const { hole, board, street, potBefore, toCall, numActiveOpponents, outsOverride } = input;

  if (!hole || board.length < 3) {
    return emptyEstimate("no-hand", null, "Deal a hand and reach the flop to use Mental Math.");
  }
  if (street === "preflop") {
    return emptyEstimate(
      "preflop",
      "preflop",
      "The Rule of 2 & 4 is for the flop and turn — for preflop, see the Preflop Chart tab.",
    );
  }
  if (street === "river" || board.length === 5) {
    const e = emptyEstimate(
      "river",
      "river",
      "No cards left to come on the river — you either have your hand or you don't.",
    );
    e.potOdds = potOddsOf(potBefore, toCall);
    return e;
  }

  // Flop or turn with 3–4 board cards.
  const breakdown: OutsBreakdown = countOuts(hole, board);
  const totalOuts = outsOverride != null ? Math.max(0, outsOverride) : breakdown.totalOuts;
  const potOdds = potOddsOf(potBefore, toCall);

  if (totalOuts === 0) {
    const e = emptyEstimate(
      "no-draw",
      street,
      "No clear drawing outs — you may already have the best hand, or be drawing thin.",
    );
    e.outs = breakdown;
    e.potOdds = potOdds;
    return e;
  }

  const flopOrTurn = street as "flop" | "turn";
  const ruleMultiplier: 2 | 4 = flopOrTurn === "flop" ? 4 : 2;
  const ruleHitPct = ruleOf2And4(totalOuts, flopOrTurn);
  const unseenCount = 52 - 2 - board.length;
  const cardsToCome: 1 | 2 = flopOrTurn === "flop" ? 2 : 1;
  const exact = exactHitPct(totalOuts, unseenCount, cardsToCome);
  const caveat = bigDrawCaveat(totalOuts, street);
  const taint = detectTaint(hole, board);
  const opponentShade = shadeFor(ruleHitPct, numActiveOpponents);

  const midpoint = (opponentShade.lowPct + opponentShade.highPct) / 2;
  const breakEven = potOdds.breakEvenPct;
  let decision: MentalEstimate["decision"];
  if (toCall <= 0) {
    decision = { profitable: true, sentence: "It's a free card — just take it." };
  } else if (Math.abs(midpoint - breakEven) <= 3) {
    decision = {
      profitable: midpoint >= breakEven,
      sentence: `About ${Math.round(midpoint)}% to win against a ${Math.round(breakEven)}% price — marginal, roughly the price.`,
    };
  } else if (midpoint > breakEven) {
    decision = {
      profitable: true,
      sentence: `About ${Math.round(midpoint)}% to win beats the ${Math.round(breakEven)}% price — calling is profitable.`,
    };
  } else {
    decision = {
      profitable: false,
      sentence: `About ${Math.round(midpoint)}% to win can't pay the ${Math.round(breakEven)}% price — the price is too steep.`,
    };
  }

  const priceText = toCall <= 0 ? "it's free" : `you need ${Math.round(breakEven)}%`;
  const verdict = decision.profitable ? "a profitable call" : "too steep a price";
  const plainSummary = `${totalOuts} outs → ~${ruleHitPct}% to hit; ${priceText} — ${verdict}.`;

  return {
    status: "ok",
    street,
    outs: breakdown,
    taint,
    ruleMultiplier,
    ruleHitPct,
    exactHitPct: exact,
    bigDrawCaveat: caveat,
    opponentShade,
    potOdds,
    decision,
    plainSummary,
  };
}
