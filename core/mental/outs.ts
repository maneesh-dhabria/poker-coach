// Deterministic out-counting for the Mental Math walk-through (spec §2.2, FR-04..07). Pure; no RNG,
// no React/DOM (§17). Operates on the 2 hole + 3–4 board cards (flop/turn) and returns the draw
// groups, their exact completing cards, and an overlap-correct union total.
import { Card, Suit, makeDeck, suitOf, rankValue, SUITS } from "@/core/cards";
import { rank7, categoryOf, HandCategory } from "@/core/eval/handEval";
import { DrawGroup, OutsBreakdown } from "@/core/mental/types";

const SUIT_WORD: Record<Suit, string> = { h: "hearts", d: "diamonds", c: "clubs", s: "spades" };

/** Display label for a rank value: A/K/Q/J/10/9… (the guide writes tens as "10"). */
function rankLabel(value: number): string {
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  if (value === 10) return "10";
  return String(value);
}

/** Expand a set of rank-values so an Ace (14) also counts as low (1) for wheel detection. */
function withAceLow(values: Set<number>): Set<number> {
  const out = new Set(values);
  if (values.has(14)) out.add(1);
  return out;
}

/** The distinct ranks (2..14) that, drawn as a community card, complete a 5-straight using ≥1 hole
 * card. Requiring hole involvement excludes board-only straights (which are everyone's, not an out). */
function straightCompleters(holeValues: number[], boardValues: number[]): number[] {
  const present = new Set<number>([...holeValues, ...boardValues]);
  const holeExpanded = withAceLow(new Set(holeValues));
  const completers: number[] = [];
  for (let r = 2; r <= 14; r++) {
    const valueSet = withAceLow(new Set<number>([...present, r]));
    // Any window of 5 consecutive integers fully present?
    for (let start = 1; start <= 10; start++) {
      const run = [start, start + 1, start + 2, start + 3, start + 4];
      if (!run.every((v) => valueSet.has(v))) continue;
      const drawnInRun = run.includes(r) || (r === 14 && run.includes(1));
      const heroInRun = run.some((v) => holeExpanded.has(v));
      if (drawnInRun && heroInRun) {
        completers.push(r);
        break;
      }
    }
  }
  return completers;
}

export function countOuts(hole: [Card, Card], board: Card[]): OutsBreakdown {
  const seen = new Set<Card>([...hole, ...board]);
  const unseen = makeDeck().filter((c) => !seen.has(c));
  const all = [...hole, ...board];

  // Made-hand guard: if hero already holds a strong made hand (straight or better), this isn't a
  // drawing spot — report no-draw rather than inventing improvement outs (spec §2.2).
  if (all.length >= 5 && categoryOf(rank7(all)) >= HandCategory.Straight) {
    return emptyBreakdown();
  }

  const groups: DrawGroup[] = [];

  // 1. Flush draw — exactly 4 of one suit (3 is a backdoor, not counted in v1).
  for (const suit of SUITS) {
    const inSuit = all.filter((c) => suitOf(c) === suit).length;
    if (inSuit === 4) {
      const outCards = unseen.filter((c) => suitOf(c) === suit);
      groups.push({
        kind: "flush",
        label: `Flush draw — ${outCards.length} ${SUIT_WORD[suit]} left`,
        outCards,
        soft: false,
      });
    }
  }

  // 2. Straight draws — classify by how many distinct ranks complete it.
  const holeValues = hole.map(rankValue);
  const boardValues = board.map(rankValue);
  const completers = straightCompleters(holeValues, boardValues);
  if (completers.length > 0) {
    const outCards = unseen.filter((c) => completers.includes(rankValue(c)));
    if (completers.length >= 2) {
      const names = completers.map(rankLabel).join(", ");
      groups.push({
        kind: "open-ended-straight",
        label: `Open-ended straight — ${outCards.length} cards (${names})`,
        outCards,
        soft: false,
      });
    } else {
      groups.push({
        kind: "gutshot",
        label: `Inside straight (gutshot) — needs a ${rankLabel(completers[0])}`,
        outCards,
        soft: false,
      });
    }
  }

  // 3. Overcards — only when hero has no made hand AND no flush/straight draw is in play. With a real
  //    draw, overcards are not separately counted (matches the guide's Q♥J♥ → 15, not 21).
  const heroHasDraw = groups.length > 0;
  const madeCategory = all.length >= 5 ? categoryOf(rank7(all)) : HandCategory.HighCard;
  if (!heroHasDraw && madeCategory === HandCategory.HighCard) {
    const maxBoard = boardValues.length ? Math.max(...boardValues) : 0;
    const overRanks = holeValues.filter((v) => v > maxBoard);
    if (overRanks.length > 0) {
      const outCards = unseen.filter((c) => overRanks.includes(rankValue(c)));
      const word = overRanks.length === 2 ? "Two overcards" : "One overcard";
      groups.push({
        kind: "overcards",
        label: `${word} — ${outCards.length} cards (soft)`,
        outCards,
        soft: true,
        softReason: "top pair may not be the best hand",
      });
    }
  }

  if (groups.length === 0) return emptyBreakdown();

  // 4. Union & overlap (FR-07): dedupe shared out-cards (e.g. K♥ completes flush AND straight).
  const uniqueSet = new Set<Card>();
  for (const g of groups) for (const c of g.outCards) uniqueSet.add(c);
  const uniqueOutCards = unseen.filter((c) => uniqueSet.has(c)); // stable deck order
  const totalOuts = uniqueOutCards.length;
  const sumSizes = groups.reduce((n, g) => n + g.outCards.length, 0);
  const overlapCount = sumSizes - totalOuts;

  const hardSet = new Set<Card>();
  for (const g of groups) if (!g.soft) for (const c of g.outCards) hardSet.add(c);

  return {
    groups,
    uniqueOutCards,
    totalOuts,
    overlapCount,
    hardOuts: hardSet.size,
  };
}

function emptyBreakdown(): OutsBreakdown {
  return {
    groups: [{ kind: "none", label: "No clear drawing outs", outCards: [], soft: false }],
    uniqueOutCards: [],
    totalOuts: 0,
    overlapCount: 0,
    hardOuts: 0,
  };
}
