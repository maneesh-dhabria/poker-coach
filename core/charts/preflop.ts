// Baseline preflop chart lookup (spec FR-23, D11). Maps a two-card hand to its 169-grid key and
// returns the chart's recommended action by position + the action faced. This is the only place
// allowed to claim GTO-ish correctness (preflop, gtoClaim=true) — see analysis (T8).
import { Card, rankOf, suitOf, rankValue } from "@/core/cards";
import charts from "@/core/charts/preflopCharts.json";

export type Position = "UTG" | "MP" | "CO" | "BTN" | "SB" | "BB";
export type Facing = "unopened" | "raise";
export type ChartAction = "raise" | "call" | "fold";

const open = charts.open as Record<string, string[]>;
const vsOpen = charts.vsOpen as Record<string, { raise: string[]; call: string[] }>;

/** Canonical 169-grid key for a hand: "AA", "AKs", "72o" (higher rank first). */
export function handKey(cards: [Card, Card]): string {
  const [a, b] = cards;
  const [hi, lo] = rankValue(a) >= rankValue(b) ? [a, b] : [b, a];
  const hiR = rankOf(hi);
  const loR = rankOf(lo);
  if (hiR === loR) return `${hiR}${loR}`;
  const suited = suitOf(a) === suitOf(b);
  return `${hiR}${loR}${suited ? "s" : "o"}`;
}

/**
 * Chart recommendation for a hand at a position facing a given action.
 * - facing "unopened": raise (open) or fold per the position's RFI range.
 * - facing "raise": 3bet / call / fold per the position's defend range (BB baseline).
 */
export function chartAction(cards: [Card, Card], position: Position, facing: Facing): ChartAction {
  const key = handKey(cards);
  if (facing === "unopened") {
    return open[position]?.includes(key) ? "raise" : "fold";
  }
  const defend = vsOpen[position];
  if (!defend) return "fold";
  if (defend.raise.includes(key)) return "raise";
  if (defend.call.includes(key)) return "call";
  return "fold";
}

/** Does the chart have an opinion for this position+facing? (postflop / unknown pos → false). */
export function chartApplies(position: Position, facing: Facing): boolean {
  if (facing === "unopened") return !!open[position];
  return !!vsOpen[position];
}

// Seats that act early (whole table behind them), where this tighter chart folds the smallest pairs.
const EARLY_POSITIONS: Position[] = ["UTG", "MP"];
// The small pocket pairs (22..55) whose RAISE/FOLD boundary this tighter chart draws within from early
// position — the surprise the reviewer flagged (iter-21 NIT 2 / iter-22 MINOR #6). The chart RANGE is
// unchanged; cellRationale just explains BOTH sides of the boundary coherently: the folded bottom of
// the range AND the small pairs the chart still opens.
const SMALL_PAIRS = ["22", "33", "44", "55"];

// The suited-ace RAISE/FOLD boundary the reviewer flagged as self-contradictory (iter-24 MAJOR): from
// early position this tighter chart OPENS suited WHEEL aces (A5s/A4s) but FOLDS the middling suited
// aces (A7s/A6s) — even though A7s shows a HIGHER raw "vs a random hand" win% than A5s. The chart DATA
// is intentional (recognized low-suited-ace construction) and UNCHANGED; cellRationale just EXPLAINS
// why, so the lone win% the chart shows stops reading as an argument against its own advice.
//   • a WHEEL ace the chart OPENS (A5s/A4s/A3s/A2s, where opened) → nut-flush + wheel-straight
//     playability and the ace-blocker effect, with an explicit note that this is why it's opened even
//     though a hand like A7s shows a higher raw number;
//   • a MIDDLING suited ace the chart FOLDS (A7s/A6s from early/mid seats) → folded despite a decent
//     raw number because it's frequently DOMINATED (out-kicked by a better ace when the money goes in),
//     so the raw "vs a random hand" equity OVERSTATES its real value; the chart prefers the wheel aces.
// Wheel aces = A with a 2–5 kicker (the cards that make A-2-3-4-5). Middling = A with a 6–9 kicker.
const WHEEL_ACE_KICKERS = ["5", "4", "3", "2"];
const MIDDLING_ACE_KICKERS = ["9", "8", "7", "6"];

/** Is `key` a suited ace (e.g. "A5s")? Returns the kicker rank, or null. */
function suitedAceKicker(key: string): string | null {
  if (key.length !== 3 || key[0] !== "A" || !key.endsWith("s")) return null;
  return key[1];
}

/**
 * A short, plain rationale for a per-cell chart decision, shown under the detail card (iter-21 NIT 2,
 * extended iter-22 MINOR #6). Covers two coherent cases at the small-pair RAISE/FOLD boundary this
 * tighter chart draws from early position:
 *   • a small pair the chart FOLDS (22 from MP, 22/33/44 from UTG) → it's the BOTTOM of the range, a
 *     CLOSE fold at the threshold — NOT a blanket condemnation of all small pairs (the older copy read
 *     as arguing against the very next pair the chart raises);
 *   • a small pair the chart RAISES (33/44/55 from MP, 55 from UTG) → a brief "why raise" line so the
 *     hands you're told to PLAY get strategic guidance too (fixes the "coverage backwards" MINOR).
 * Returns "" for every other cell. Pure — derived from the cell's key/position/action the detail card
 * already computes. Does NOT change any raise/fold classification.
 */
export function cellRationale(key: string, position: Position, action: ChartAction): string {
  // Suited-ace boundary (iter-24 MAJOR) — checked first; only fires for suited aces from early seats.
  const aceKicker = EARLY_POSITIONS.includes(position) ? suitedAceKicker(key) : null;
  if (aceKicker) {
    if (action === "raise" && WHEEL_ACE_KICKERS.includes(aceKicker)) {
      // A suited WHEEL ace the chart OPENS. Explain the real reason it outplays its raw win%: it makes
      // the nut flush AND the wheel straight (A-2-3-4-5), and the ace BLOCKS opponents' AA/AK — so it's
      // opened even though a middling suited ace like A7s shows a HIGHER raw "vs a random hand" number.
      return `This is opened even though a hand like A7s shows a higher raw win-rate — because a suited wheel ace plays far better than that number suggests. It makes the nut flush and can make the wheel straight (A-2-3-4-5), and holding the ace blocks the big aces (AA, AK) your opponents most want, so it wins bigger pots when it connects. That extra playability and the blocker are why the chart prefers it to a middling suited ace with a higher raw equity.`;
    }
    if (action === "fold" && MIDDLING_ACE_KICKERS.includes(aceKicker)) {
      // A MIDDLING suited ace the chart FOLDS despite a decent raw number — it's frequently DOMINATED.
      return `It's folded despite a decent raw win-rate because that number is "vs a random hand" and overstates its real value: a middling suited ace like this is frequently dominated — out-kicked by a better ace when the big money goes in — so it makes second-best hands that cost you. The chart prefers the suited wheel aces (like A5s), which make the nut flush and the wheel straight and block the big aces, even though their raw equity looks no higher.`;
    }
    // A suited ace at an early seat outside the wheel/middling explanation (e.g. ATs+ the chart just
    // opens as a strong ace) — no special boundary to explain, fall through to "" via the small-pair
    // guard below (which won't match a 3-char key), keeping the generic detail.
  }
  if (!EARLY_POSITIONS.includes(position) || !SMALL_PAIRS.includes(key)) return "";
  if (action === "fold") {
    // The folded bottom of the range — framed as a close threshold fold, NOT a condemnation of all
    // small pairs (the next pair up is a raise, so the reason can't be "small pairs don't set-mine").
    return "This is the bottom of the range — a close fold at the threshold this tighter chart draws from early position. Small pairs set-mine, which needs deep stacks and callers to pay off; the very smallest pairs clear that bar least often from up front, so they're folded while the slightly bigger ones are opened.";
  }
  // A small pair the chart RAISES — a brief strategic "why open" line so the play hands are coached too.
  return "A small-pair open at this chart's threshold: it set-mines like the smaller pairs, but with a touch more equity and the chance to flop an overpair or take the pot down, it's worth opening from early position where the smaller pairs are folded.";
}

// Ranks high→low, so the enumerator emits keys with the higher rank first (matching handKey).
const RANKS_DESC = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;

/**
 * Every canonical preflop hand as a 169-grid key (spec FR-50). Pure — no cards, no IO. Returns the
 * 13 pairs ("AA".."22"), 78 suited ("AKs"…) and 78 offsuit ("AKo"…) = 169 keys, in the same format
 * handKey() produces. Ordered pairs-then-suited-then-offsuit, ranks high→low, so the output is stable
 * (the equity generator and the chart grid both rely on a deterministic order). Adding a rank here
 * would surface in preflop.test.ts's count assertions.
 */
export function allHands169(): string[] {
  const pairs: string[] = [];
  const suited: string[] = [];
  const offsuit: string[] = [];
  for (let i = 0; i < RANKS_DESC.length; i++) {
    for (let j = 0; j < RANKS_DESC.length; j++) {
      const hi = RANKS_DESC[i];
      const lo = RANKS_DESC[j];
      if (i === j) pairs.push(`${hi}${lo}`);
      else if (i < j) suited.push(`${hi}${lo}s`); // i<j ⇒ hi is the higher rank
      else offsuit.push(`${RANKS_DESC[j]}${RANKS_DESC[i]}o`); // keep higher rank first
    }
  }
  return [...pairs, ...suited, ...offsuit];
}
