// Orchestrates the six-step Mental Math walk-through (spec §2.4, FR-03/10–15). Pure & synchronous —
// it never touches the equity engine; the component composes the async "true win %" comparison.
import { Card, Suit, suitOf, rankValue, SUITS } from "@/core/cards";
import { Street } from "@/core/analysis/types";
import { rank5, rank7, categoryOf, HandCategory } from "@/core/eval/handEval";
import { countOuts } from "@/core/mental/outs";
import { ruleOf2And4, exactHitPct, bigDrawCaveat } from "@/core/mental/hit";
import { MadeHand, MentalEstimate, MentalInput, OutsBreakdown, TaintFlags } from "@/core/mental/types";

/** Plain-language name for a made hand the hero already holds (pair or better, below a straight —
 * a straight+ routes to no-draw upstream). Used to surface "you're often ahead already" so the
 * outs-only conclusion can't tell a beginner to fold a hand that's already winning (finding #1). */
export function detectMadeHand(hole: [Card, Card], board: Card[]): MadeHand | null {
  const all = [...hole, ...board];
  if (all.length < 5) return null;
  const category = categoryOf(rank7(all));
  if (category < HandCategory.Pair) return null;

  // Hole-card participation (iter-07 #2a): a made hand only counts when the hero's HOLE cards
  // actually improve on the board alone. Otherwise the hero is "playing the board" — e.g. J-high on
  // a board that pairs the 8s — which is not a made hand of their own and must not be surfaced.
  if (!holeImprovesOnBoard(hole, board, category)) return null;

  const boardMax = board.length ? Math.max(...board.map(rankValue)) : 0;
  const holeVals = hole.map(rankValue);
  const labelFor = (): string => {
    switch (category) {
      case HandCategory.Pair: {
        // Pin the pair to top/middle/bottom relative to the board so the copy reads like a player.
        const paired = holeVals.find((v) => board.some((c) => rankValue(c) === v));
        if (paired === undefined) return "a pair"; // a hole pair (e.g. pocket pair under the board)
        if (paired >= boardMax) return "top pair";
        const boardVals = board.map(rankValue).sort((a, b) => b - a);
        return paired <= (boardVals[boardVals.length - 1] ?? 0) ? "bottom pair" : "middle pair";
      }
      case HandCategory.TwoPair:
        return "two pair";
      case HandCategory.Trips:
        return "three of a kind";
      case HandCategory.Straight:
        return "a straight";
      case HandCategory.Flush:
        return "a flush";
      case HandCategory.FullHouse:
        return "a full house";
      case HandCategory.Quads:
        return "four of a kind";
      default:
        return "a made hand";
    }
  };
  return { category, label: labelFor() };
}

/** The best made-hand category the BOARD makes on its own (no hole cards). On a 3- or 4-card board
 * a 5-card hand isn't yet possible, so we read the category structurally from the board cards: a
 * paired board → board pair, trips on board → board trips, four to a straight/flush → that category,
 * etc. This is the "playing the board" baseline; a hero only has a made hand if their hole cards beat
 * it. (iter-07 #2a) */
function boardAloneCategory(board: Card[]): HandCategory {
  if (board.length >= 5) {
    // Enough board cards to form a full 5-card hand from the board alone.
    let best = HandCategory.HighCard;
    for (let i = 0; i < board.length; i++)
      for (let j = i + 1; j < board.length; j++)
        for (let k = j + 1; k < board.length; k++)
          for (let l = k + 1; l < board.length; l++)
            for (let m = l + 1; m < board.length; m++) {
              const cat = categoryOf(rank5([board[i], board[j], board[k], board[l], board[m]]));
              if (cat > best) best = cat;
            }
    return best;
  }
  // 3–4 card board: read the category from the rank/suit structure of the board cards themselves.
  const counts = new Map<number, number>();
  for (const c of board) counts.set(rankValue(c), (counts.get(rankValue(c)) ?? 0) + 1);
  const countVals = Array.from(counts.values()).sort((a, b) => b - a);
  if ((countVals[0] ?? 0) >= 3) return HandCategory.Trips;
  if ((countVals[0] ?? 0) === 2 && (countVals[1] ?? 0) === 2) return HandCategory.TwoPair;
  if ((countVals[0] ?? 0) === 2) return HandCategory.Pair;
  return HandCategory.HighCard;
}

/** Whether the hero's HOLE cards actually improve on the board alone (iter-07 #2a). The hero has a
 * real made hand only when their best 7-card category is strictly better than what the board makes
 * by itself — i.e. a hole card participates. Plays-the-board hands (J-high on a paired board, board
 * trips/two-pair the hole doesn't touch) return false. */
function holeImprovesOnBoard(hole: [Card, Card], board: Card[], heroCategory: HandCategory): boolean {
  return heroCategory > boardAloneCategory(board);
}

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
    madeHand: null,
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

  if (!hole) {
    return emptyEstimate("no-hand", null, "Deal a hand and reach the flop to use Mental Math.");
  }
  // Preflop is checked before the board-size guard: a real preflop spot has an empty board, and we
  // want the "Rule of 2 & 4 is for flop/turn" note there rather than the generic no-hand note.
  if (street === "preflop") {
    return emptyEstimate(
      "preflop",
      "preflop",
      "The Rule of 2 & 4 is for the flop and turn — for preflop, see the Preflop Chart tab.",
    );
  }
  if (board.length < 3) {
    return emptyEstimate("no-hand", null, "Deal a hand and reach the flop to use Mental Math.");
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
  const madeHand = detectMadeHand(hole, board);

  if (totalOuts === 0) {
    const e = emptyEstimate(
      "no-draw",
      street,
      madeHand
        ? `No extra outs to count — but you already have ${madeHand.label}, so you're often ahead already.`
        // No draw AND no made hand → don't hedge "you may already have the best hand" when the hero
        // is holding air (it's false). Say honestly that they're likely behind (iter-10 #6).
        : "No clear draw and no made hand yet — you're likely behind, so you'd be betting as a bluff or giving up.",
    );
    e.outs = breakdown;
    e.potOdds = potOdds;
    e.madeHand = madeHand;
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
  if (madeHand) {
    // The hero already has a made hand the outs count ignores — never let the draw-only math steer
    // a fold here (finding #1/#2). Defer the precise call/bet verdict to the true-equity check
    // (conclusionFrom), and say plainly that they're already in the lead.
    decision =
      toCall <= 0
        ? {
            profitable: true,
            // No bet to call: the hero is first to act with a made hand, so this is a value-bet
            // decision, not a "take the free card" check-back (iter-10 #2). Defer the precise
            // value/marginal call to conclusionFrom once true equity resolves.
            sentence: `You already have ${madeHand.label} — this is a spot to bet it for value, not just check. Check the true win % below.`,
          }
        : {
            profitable: true,
            sentence: `Don't fold on the outs alone — you already have ${madeHand.label}, so you're often ahead already. Check the true win % below.`,
          };
  } else if (toCall <= 0) {
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
  const plainSummary = madeHand
    ? `You already have ${madeHand.label} — often ahead already; check the true win % below.`
    : `${totalOuts} outs → ~${ruleHitPct}% to hit; ${priceText} — ${verdict}.`;

  return {
    status: "ok",
    street,
    outs: breakdown,
    taint,
    madeHand,
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

/** Whether the true equity is materially higher than the draw-only hit estimate — the tell that the
 * outs count is missing something (a made hand the hero already holds). 12 points of slack absorbs
 * Monte-Carlo noise and the opponent shade. */
export function trueWinExceedsOuts(estimate: MentalEstimate, trueWinPct: number): boolean {
  const hit = estimate.exactHitPct ?? estimate.ruleHitPct ?? 0;
  return trueWinPct - hit > 12;
}

/**
 * The reconciled Step-6 conclusion (finding #1/#2). The sync `buildMentalEstimate` can only see the
 * outs; once the component has the true Monte-Carlo win % it calls this so the plain-language verdict
 * is driven by the SAME equity the engine grades against — never an outs-only fold that contradicts
 * the post-action "Easy call." Pure: no React/equity imports.
 */
export function conclusionFrom(args: {
  trueWinPct: number;
  breakEvenPct: number;
  toCall: number;
  madeHand: MadeHand | null;
}): { profitable: boolean; sentence: string } {
  const { trueWinPct, breakEvenPct, toCall, madeHand } = args;
  const win = Math.round(trueWinPct);
  const lead = madeHand ? ` You already have ${madeHand.label}.` : "";
  // "Ahead" only when the unified win-% is actually high — never claim a lead against the equity
  // (iter-07 #2b). A made hand at low multiway equity is marginal, not ahead.
  const ahead = trueWinPct >= 55;
  if (toCall <= 0) {
    if (madeHand) {
      // No bet to call AND a made hand: this is a bet-or-check decision, and the recommended line
      // is to BET the made hand for value — so the conclusion must not tell the user to "take the
      // free card" (iter-10 #2). Ahead → clear value bet; marginal → a thin value bet, still a bet.
      return {
        profitable: true,
        sentence: ahead
          ? `You're ahead ~${win}% of the time with ${madeHand.label} — betting it for value is right.`
          : `You have ${madeHand.label} and win ~${win}% — a thin value bet here, not a check-back.`,
      };
    }
    return {
      profitable: true,
      sentence: `It's a free card — just take it. You're winning ~${win}% right now.`,
    };
  }
  const need = Math.round(breakEvenPct);
  if (trueWinPct >= breakEvenPct) {
    return {
      profitable: true,
      sentence: `You actually win ~${win}% — more than the ~${need}% you need to call.${lead} That's a profitable call, not a fold.`,
    };
  }
  return {
    profitable: false,
    sentence: `Even counting everything, you win ~${win}% but need ~${need}% to call — the price is too steep.${lead}`,
  };
}

/**
 * The "Check your work" gap explanation (finding #3). The hit% vs true-win% gap has a REAL cause:
 * if the hero already holds a made hand the outs count ignored, say so plainly; otherwise it's the
 * opponents + board danger of Steps 3 & 4. Pure: returns the sentence the component renders.
 */
export function gapExplanation(args: {
  exactHitPct: number;
  trueWinPct: number;
  madeHand: MadeHand | null;
}): string {
  const hit = Math.round(args.exactHitPct);
  const win = Math.round(args.trueWinPct);
  if (args.madeHand && args.trueWinPct - args.exactHitPct > 12) {
    return `You hit ≈${hit}% more cards, but win ≈${win}% — the extra comes from the ${args.madeHand.label} you already hold, which the outs count alone misses.`;
  }
  return `You hit ≈${hit}% but win ≈${win}% — that gap is the opponents + board danger (Steps 3 & 4).`;
}
