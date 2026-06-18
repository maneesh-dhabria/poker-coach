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

// Below this equity a no-made-hand bet/raise is a genuine "no equity" air bluff; at/above it (up to
// the 33% aggression cutoff) it's a real light/thin semi-bluff, not "no equity" (iter-09 #6b). Kept
// in sync with analyze.ts's NO_EQUITY_PCT.
const NO_EQUITY_PCT = 20;

export interface ExplainParams {
  kind: "price" | "preflop" | "valuecheck" | "aggression" | "freecheckfold" | "isoraise";
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
  // True when a postflop value bet is grossly UNDER-sized relative to the pot (iter-08 #1): the copy
  // must NOT praise it as standard "get money in while ahead" value — it charges no draws / builds no
  // pot. Symmetric to the oversize flag.
  betTooSmall?: boolean;
  // The pot-multiple of a GROSS overbet bet/raise (iter-13 #2): the direction can be right (good
  // equity), but the size risks a huge amount to win a tiny pot, so the copy keeps the direction and
  // adds a "size down" critique. Present only when the overbet flag fired.
  overbetPotMultiple?: number;
  // The going-forward dollar-EV of each option — the SAME `numbers.ev` the "Show the numbers" table
  // displays (iter-16 #1, #2). These are rough Monte-Carlo equity-realization averages. The copy uses
  // them ONLY to reconcile its WORDS with the displayed figure (never to change a verdict): a thin bet
  // the EV says is clearly worse than checking shouldn't read "fine" (#2), and a ✅ action whose EV is
  // tied/slightly-below the best alternative gets a one-line "rough estimate / fold-equity" note so it
  // doesn't read as an unreconciled contradiction (#1). Optional — absent ⇒ today's EV-blind copy.
  ev?: { fold: number; call: number; raise: number };
  // True when this is a LOOSE preflop OPEN (chart folds, hero raised, off-model — iter-22 MAJOR-1a):
  // the copy gives a PREFLOP position + strength reason with the correct "raise" verb, and NEVER the
  // postflop semi-bluff / "no made hand" / "push" framing. Off-model, so it reconciles with the chart
  // ("the chart opens first-in; here there are limpers and this hand is too weak to raise from here").
  looseOpen?: boolean;
}

// Dollar-EV reconciliation margin (iter-16 #1, #2). The displayed `numbers.ev` are rough Monte-Carlo
// equity-realization averages, so a gap this small or less is within the estimate's noise (≈ 1 BB on
// the $1/$2 table). Used two ways: (1) a POSITIVE-verdict action whose EV is ≤ the best alternative
// by within this margin (or modestly below) gets a "rough estimate / fold-equity" note so it doesn't
// read as an unreconciled contradiction; (2) a ⚠️ thin bet whose EV is BELOW checking by MORE than
// this margin is "marginal-to-slightly-losing", not "fine". Plain dollars, not BB — the comparison is
// margin-vs-margin so the unit cancels.
const EV_RECONCILE_MARGIN = 2;

// A positive-verdict action's EV reconciliation note (iter-16 #1). Fires when the verdict is "good"
// but the chosen action's displayed EV is tied-or-modestly-below the best alternative's — a beginner
// then reads ✅ next to "fold $0 / raise -$1" and sees a contradiction. The note makes it explicit
// that these are rough equity-only averages (a tiny gap is noise) and — for an aggressive/iso line —
// that the raise also wins the pot outright often (fold equity), which this showdown-EV doesn't
// capture. Returns "" when not applicable (clearly-best EV, or no EV available). `aggressive` tunes
// whether the fold-equity clause is included.
function evReconcileNote(
  verdict: Verdict,
  chosen: number | undefined,
  best: number | undefined,
  aggressive: boolean,
): string {
  if (verdict !== "good" || chosen === undefined || best === undefined) return "";
  const gap = best - chosen;
  // chosen ≥ best ⇒ the chosen line already shows the highest EV — the numbers agree with the ✅, no
  // reconciliation needed. gap > the noise margin ⇒ genuinely worse, don't paper it over here. Only a
  // tied-or-slightly-below chosen action (0 < gap ≤ margin) gets the noise/fold-equity note.
  if (gap <= 0 || gap > EV_RECONCILE_MARGIN) return "";
  const foldEquity = aggressive
    ? " It also wins the pot outright often (fold equity) — value this number doesn't capture."
    : "";
  return ` (The dollar figures are rough equity-only estimates, so a gap this small is within the noise.${foldEquity})`;
}

// A price (pot-odds) decision is "borderline" when the hero's equity is within this many points of the
// break-even need — a 13%-vs-14% fold or a barely-priced call (iter-17 #4). Inside this band the copy
// adds a brief "it's close" hedge so a razor-thin spot isn't presented as clear-cut; a clear gap keeps
// its confident wording. Small by design so the hedge never fires on an obvious fold/call.
const BORDERLINE_PRICE_MARGIN = 3;

function isBorderlinePrice(equityPct: number, potOddsPct: number): boolean {
  return Math.abs(equityPct - potOddsPct) <= BORDERLINE_PRICE_MARGIN;
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
// Is the hero out of position for the oversize-open warning (iter-09 #5)? Only the BTN and CO act
// late enough to be "in position"; everyone else (UTG/MP/SB/BB) is OOP, so the "bloats the pot out
// of position" clause is honest only for them. Unknown position ⇒ treat as OOP (the common case).
function isOutOfPosition(position?: string): boolean {
  if (!position) return true;
  const ip = position === "BTN" || position === "CO";
  return !ip;
}

function opponentPhrase(numActiveOpponents?: number): string {
  if (numActiveOpponents === undefined || numActiveOpponents <= 0) return "the players still in";
  if (numActiveOpponents === 1) return "the 1 opponent still in";
  return `the ${numActiveOpponents} opponents still in`;
}

// Plain-English label for how early/late a seat acts, used by the digit-free Conceptual preflop
// reason so a beginner learns WHY a spot is loose/tight (iter-21 MINOR). UTG/MP act first with the
// whole table behind them (early); CO/BTN act last (late); the blinds are out of position. Falls
// back to a neutral "this position" when the seat is unknown.
function positionPhrase(position?: string): string {
  switch (position) {
    case "UTG":
    case "MP":
      return "early position";
    case "CO":
    case "BTN":
      return "late position";
    case "SB":
    case "BB":
      return "the blinds";
    default:
      return "this position";
  }
}

// The Conceptual (digit-free) reason for a preflop chart DEVIATION — replaces the old vague "This
// differs from the standard baseline line for this spot" with a plain reason a newcomer can learn
// from (iter-21 MINOR). Direction is read from what the chart recommends vs what the hero did, both
// already on the analysis input: a hand the chart folds that the hero opened is "too weak to raise
// from here"; a hand the chart opens that the hero folded "gives up a profitable raise"; a
// raise-vs-call aggression mismatch keeps a plain "right to continue, wrong aggression" reason.
function conceptualPreflopDeviation(p: ExplainParams): string {
  const where = positionPhrase(p.position);
  const rec = p.chartAction;
  const heroPlayedOn = p.action !== "fold";
  // Chart folds this hand, hero kept playing it (raised/called) → too loose to open from here.
  if (rec === "fold" && heroPlayedOn)
    return `This hand is too weak to raise from ${where} — hands like it play poorly after the flop, so folding is the standard line here.`;
  // Chart opens/continues this hand, hero folded it → gave up a profitable raise/continue.
  if (rec !== "fold" && !heroPlayedOn)
    return `This hand is strong enough to play from ${where} — folding it gives up a profitable raise.`;
  // Right to continue, wrong aggression level (raise-vs-call mismatch).
  if (rec === "raise" && p.action === "call")
    return `This hand is strong enough to raise from ${where}, not just call — raising is the standard, more profitable line.`;
  if (rec === "call" && p.action === "raise")
    return `This hand is fine to play from ${where}, but it's better to just call than to raise it here.`;
  // Fallback (no usable direction) — still plain, position-aware, never the old "baseline line" text.
  return `This isn't the standard line from ${where} for a hand like this.`;
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
    case "isoraise":
      return isoRaise(p);
  }
}

// A standard isolation raise over limpers (iter-14 #5). The RFI chart would open this hand first-in;
// here there are limpers, so it's an isolation raise — a fine, standard play. The copy EXPLAINS the
// difference from the chart (chart assumes first-in) so a newcomer cross-checking the References chart
// is never left with "the chart says raise but the live coach says thin" unreconciled.
function isoRaise(p: ExplainParams): string {
  const label = p.hand ? handLabel(p.hand) : "this hand";
  const where = p.position ? ` from ${p.position}` : "";
  const win = Math.round(p.equityPct);
  // The chosen line is the RAISE; the only alternative the EV table shows for a preflop open is FOLD
  // ($0). When the raise's rough EV reads tied/slightly-below folding (iter-16 #1) — a beginner sees ✅
  // next to "fold $0 / raise -$1" — append the noise + fold-equity note so the words and the figure
  // don't disagree. An iso raise is exactly the aggressive line whose value is the fold equity this
  // showdown-EV number misses, so the fold-equity clause is included.
  const reconcile = p.ev ? evReconcileNote("good", p.ev.raise, Math.max(p.ev.fold, p.ev.call), true) : "";
  return `Raising ${label}${where} here is a fine, standard play. The Preflop Chart assumes you're first in, but here there are limpers — so this is an isolation raise: you raise to play the pot heads-up against a weak limping range, where your ~${win}% plays well. Going for it is right.${reconcile}`;
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
    betTooSmall: ei.betTooSmall,
    overbetPotMultiple: ei.overbetPotMultiple,
    // The EV reconciliation reads the canonical numbers block (iter-16 #1, #2) — no new persisted
    // field is needed since `numbers.ev` already rides on every record. EV is unit-invariant for the
    // comparison (a margin in dollars vs the same dollars), so passing the stored USD figures is fine.
    ev: analysis.numbers.ev,
    looseOpen: ei.looseOpen,
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
  // A razor-thin price — the hero's equity is within a hair of the break-even need — is still graded
  // ✅ good (it's on the right side of the line), but presenting it as clear-cut oversells it (iter-17
  // #4). Append a brief "though it's close" acknowledgement so a borderline call/fold doesn't read as
  // a comfortable one. Tightly gated: only inside the small margin; a clear gap keeps its confident
  // wording. The hedge text is depth-aware (conceptual stays digit-free, handled in conceptual()).
  const close = isBorderlinePrice(p.equityPct, p.potOddsPct);
  if (p.verdict === "good")
    return p.action === "fold"
      ? // Inside the borderline band a fold is at/near break-even, so "you don't have the odds" is
        // FALSE (the equity meets the need) and contradicts the equity-bar whyLine (iter-20 MAJOR).
        // Present ONE coherent break-even message instead: calling and folding are about equal, so
        // folding is fine — and never claim the hero lacks the odds. Outside the band a clear fold
        // keeps the confident "you don't have the odds" wording.
        close
        ? `${lead} Close spot — calling and folding are about equal here, so folding is fine.`
        : `${lead} Folding is right — you don't have the odds.`
      : `${lead} ${close ? "A call — though it's close, you're just on the right side of the price." : "Easy call — you're getting a great price."}`;
  // A ⚠️ thin price-call. When it's genuinely BORDERLINE (equity within a few points of the need, so
  // EV ≈ 0) present ONE coherent "about break-even" message rather than an upbeat "just about worth it"
  // headline that then clashes with the equity-bar "you come up short, this loses money" line (iter-18
  // MINOR #1). Outside the borderline band (a thin call that's clearly the worse side) keep the honest
  // "close, but just about worth it" wording. The equity-bar whyLine is reconciled to match (FeedbackPanel).
  if (p.verdict === "thin")
    return isBorderlinePrice(p.equityPct, p.potOddsPct)
      ? `${lead} Close — this is about break-even, so calling and folding are roughly equal here.`
      : `${lead} Close, but just about worth it.`;
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

  // A LOOSE preflop OPEN of a hand the chart folds, in an off-model spot (a limped pot / off-chart
  // seat) — iter-22 MAJOR-1a. NEVER the postflop semi-bluff/"no made hand"/"push" framing: an open is
  // a RAISE (correct verb), not a bet, and preflop you never have a made hand. Lead with the
  // position + strength reason; reconcile with the chart (it opens first-in; here it's off-model and
  // this hand is too weak to raise from this seat). Verdict tunes "too weak" (mistake) vs "loose"
  // (thin). At Strict, lean on the chart-doesn't-cover-this-cleanly honesty; at Equity, the win%/
  // strength reason. Conceptual is handled in conceptual().
  if (p.looseOpen) {
    const place = positionPhrase(p.position);
    const win = Math.round(p.equityPct);
    // A grossly OVERSIZED loose open: the headline is the absurd SIZE, not a literal -EV claim (the
    // size escalated it to a mistake; against over-folding limpers its showdown EV may even be
    // non-negative). Lead with the size + the weak hand, so the copy never claims "loses money on
    // average" for a play whose EV figure isn't negative (iter-22 keeps the iter-19 honesty fix).
    if (p.overbetPotMultiple !== undefined) {
      return p.depth === "strict"
        ? `The chart opens first-in, but here there are limpers — and ${label} is a weak, easily-dominated hand to open${where}. Worse, this raise is far bigger than the pot: it risks a huge amount to win a tiny pot. Size it down to a normal open of a stronger hand.`
        : `Raising ${label}${where} with only ~${win}% is far too big — it risks a huge amount to win a tiny pot, and this is a weak, easily-dominated hand to open from ${place} in the first place. Size it down to a normal open, and from this seat a tighter hand.`;
    }
    // A non-oversized loose open: lead with the position + strength reason and the correct "raise" verb.
    if (p.depth === "strict") {
      return p.verdict === "mistake"
        ? `The chart opens first-in, but here there are limpers and ${label} is too weak to raise${where} — low, easily-dominated cards that play poorly after the flop. Raising it is a loose open that loses money on average; folding is the standard line.`
        : `The chart opens first-in, but here there are limpers, so this is off the chart. Raising ${label}${where} is on the loose side — it's a marginal, easily-dominated open; a tighter open from ${place} is the standard line.`;
    }
    return p.verdict === "mistake"
      ? `Raising ${label}${where} is too loose — its ~${win}% comes from low, easily-dominated cards that play poorly after the flop, so opening from ${place} loses money on average. Folding is the standard line here.`
      : `Raising ${label}${where} is on the loose side — at ~${win}% it's a marginal, easily-dominated open. The chart opens first-in and tighter than this from ${place}, so it's a thin raise, not a clear-cut one.`;
  }

  // An absurdly oversized OPEN (iter-06 #3): raising can be right, but the SIZE is far off, so we
  // never call it "the standard, profitable play". Lead with the size, keep it depth-light.
  if (p.openSizeBb !== undefined) {
    const bb = Math.round(p.openSizeBb);
    // Only say "out of position" when the hero actually IS out of position (iter-09 #5). On the BTN
    // (and CO) the hero is in position, so the OOP clause is wrong there — use the position-neutral
    // "risks a lot to win a little" phrasing instead.
    const oop = isOutOfPosition(p.position);
    const sizeHarm = oop
      ? "that size bloats the pot out of position and risks a lot to win a little"
      : "it bloats the pot and risks a lot to win a little";
    return `Raising ${label}${where} can be fine, but ${bb} BB is far bigger than a standard open (about 2–3 BB) — ${sizeHarm}. Size it down to a normal open.`;
  }

  // A grossly oversized NON-open raise (a 3-bet/4-bet/shove, iter-13 #2): the chart may agree the
  // direction is right, but the SIZE risks a huge amount to win a tiny pot. Keep the direction, flag
  // the size — never praise it as "standard".
  if (p.overbetPotMultiple !== undefined) {
    const win = Math.round(p.equityPct);
    return `Raising ${label}${where} with ~${win}% can be right${overbetClause(p.overbetPotMultiple, "raise", false)}.`;
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
  // At Equity+Heuristics depth we lead with the odds and call it "the standard play" — we do NOT name
  // the preflop chart here (explicit chart citations are reserved for Strict depth, which keeps its
  // chart badge + "the baseline chart says…"). The meaning is unchanged: this IS the standard
  // recommendation; only the non-jargon wording differs (iter-08 #5).
  // "Standard play" — NOT "profitable" (iter-09 #1). When the chart action is FOLD, "profitable" reads
  // as a contradiction (the EV of folding is $0 / negative the blind), so we never claim immediate
  // profit for a fold. We keep "profitable" only when the chart action actually puts money in
  // (raise/call), where the standard line does make money over time.
  if (!p.heroDeviates) {
    if (p.chartAction === "fold") {
      // Raw equity can look tempting preflop, but a weak offsuit hand plays poorly over four streets —
      // so the chart folds it even when its one-shot win% looks playable. Naming that reconciles the
      // headline win% with the fold verdict (iter-09 #1). Only add the "out of position" clause for a
      // genuinely OOP seat (blinds/UTG/MP) — CO and BTN are LATE position, so the clause is wrong
      // there (iter-11 #5).
      const oopClause = isOutOfPosition(p.position) ? ", especially out of position" : "";
      return `By the odds, ${equityNote} — that can look tempting, but a hand like this plays poorly after the flop${oopClause}, so ${ing}${where} is the standard play here.`;
    }
    return `By the odds, ${equityNote}, so ${ing}${where} is the standard, profitable play here.`;
  }
  return `By the odds, ${equityNote}; the math favors ${ing}${where} instead, and your line differs from that higher-EV standard play.`;
}

function valuecheck(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  if (p.verdict === "good") {
    // Near a coin-flip (~44–55%), "there's little to bet for" undersells the hand (iter-12 #6): you're
    // close to half the pot, you just don't have enough of an edge to bet for value. Frame it as
    // keeping the pot small rather than implying the hand is weak. (The valuecheck-good branch only
    // fires below the 52% value-bet cutoff, so this covers the ~44–51% near-coin-flip band.)
    if (p.equityPct >= 44)
      return `Checking is fine here — at ~${win}% you're roughly a coin-flip, not far enough ahead to bet for value, so keeping the pot small is fine.`;
    return `Checking is fine here — you only win about ${win}%, so there's little to bet for.`;
  }
  return `You win ~${win}% here — checking gives up value. A bet earns more from worse hands.`;
}

// A gross overbet's SIZE critique (iter-13 #2). The DIRECTION can be right (good equity), so we keep
// the "right" read and append a "risks a huge amount to win a tiny pot — size down" clause. Used by
// both the postflop aggression branch and the preflop (3-bet/4-bet) branch. Plain words at conceptual.
// When the edge is only MARGINAL (a thin value bet) and the pot is MULTIWAY, the size critique is
// sharper — a marginal edge against several players risks the whole stack to win a little — so the
// clause names that (iter-14 #3). `marginal`/`opponents` default off so existing callers are unchanged.
function overbetClause(
  multiple: number,
  noun: string,
  conceptual: boolean,
  marginal = false,
  numOpponents = 0,
): string {
  const vsPlayers =
    marginal && numOpponents >= 2 ? ` and against ${numOpponents} players` : "";
  if (conceptual)
    return marginal
      ? `, but that's a much bigger ${noun} than the pot${vsPlayers} — with only a marginal edge it risks your whole stack to win a little, so size it down`
      : `, but that's a much bigger ${noun} than the pot — it risks a huge amount to win a tiny pot, so size it down`;
  const x = Math.round(multiple);
  const verb = noun === "raise" ? "shoving" : "betting";
  if (marginal)
    return `, but ${verb} ~${x}× the pot with only a marginal edge${vsPlayers} risks your whole stack to win a little — size down`;
  return `, but ${verb} ~${x}× the pot risks a huge amount to win a tiny pot — size down`;
}

function aggression(p: ExplainParams): string {
  const win = Math.round(p.equityPct);
  const act = p.action === "raise" ? "Raising" : "Betting";
  const noun = p.action === "raise" ? "raise" : "bet";
  // A GROSS overbet (iter-13 #2): keep the value/semi-bluff direction read, then flag the absurd size.
  // Takes precedence over the plain good/thin copy so the headline is the sizing, while the equity
  // direction is still acknowledged.
  // Base the DIRECTION read on the equity, not the verdict — the verdict was downgraded to ⚠️ by the
  // overbet flag itself, so it no longer signals whether the underlying line was value vs a semi-bluff.
  if (p.overbetPotMultiple !== undefined) {
    const dir =
      p.equityPct >= 50
        ? `${act} for value with ~${win}% is right`
        : p.equityPct >= NO_EQUITY_PCT
          ? `${act} with ~${win}% can be a fine semi-bluff`
          : `${act} with only ~${win}%`;
    // A value bet that's only a MARGINAL edge (~50–60%) into a MULTIWAY pot earns the sharper "risks
    // your whole stack to win a little" framing (iter-14 #3) — a thin edge vs several players is exactly
    // the reckless stack-off the threshold now catches.
    const marginal = p.equityPct >= 50 && p.equityPct < 60;
    return `${dir}${overbetClause(p.overbetPotMultiple, noun, false, marginal, p.numActiveOpponents ?? 0)}.`;
  }
  // A grossly UNDER-sized value bet (iter-08 #1): you're ahead, but this bet is far too small to do
  // its job — it charges draws almost nothing and barely builds the pot. Praise the read, flag the
  // size. Takes precedence so the headline is the sizing, not "good value".
  if (p.betTooSmall)
    // Name the made hand when there is one (iter-10 #3): the size critique stands on top of the
    // made-hand context, so the user hears both "you have a hand" and "but it's far too small".
    // The undersize branch only fires for a genuine value bet (made hand present, or equity ≥ 50%),
    // so this copy is never reached by a low-equity airball (iter-11 #1). Still, a made hand can be
    // value-bet at LOW multiway equity — so only claim "in front" when the win% actually backs it;
    // otherwise frame it as showdown value that's too cheap, without asserting a lead.
    return p.madeHand
      ? p.equityPct >= 50
        ? `You have ${p.madeHand.label}, but this ${noun} is far too small to get value — it charges draws almost nothing and barely builds the pot. Size up to get paid while you're in front.`
        : `You have ${p.madeHand.label} — some showdown value — but this ${noun} is far too small to get value or charge draws. Size up so the bet actually does its job.`
      : `You're ahead with ~${win}%, but this ${noun} is far too small — it charges draws almost nothing and barely builds the pot. Size up to get paid while you're in front.`;
  // A made-hand value bet that the verdict ESCALATED to a ❌ mistake because its EV is clearly negative
  // and materially worse than checking (iter-18 MAJOR). It must NOT keep reading "this is a value bet"
  // / "thin value" — checking was clearly the better line and this bet loses money. Builds on the
  // iter-16 EV-aware "checking rates higher" copy, strengthened for the mistake case. Gated on the
  // mistake verdict so a genuinely break-even made-hand thin bet keeps the ⚠️ copy just below.
  if (p.madeHand && p.verdict === "mistake")
    return `You have ${p.madeHand.label}, but multiway on a dangerous board your ~${win}% to win is too low to bet for value — checking is clearly better here, and this ${noun} loses money on average.`;
  // A made hand with low equity is never a "bluff with no equity" (iter-06 #1): it has real showdown
  // value, so the low win% is about being multiway on a dangerous board, not about having nothing.
  // This takes precedence over the generic thin copy so the made hand is always named, not hidden.
  if (p.madeHand && p.equityPct < 33)
    return `You have ${p.madeHand.label} — a real made hand with showdown value, so this is a value ${noun}. But multiway on a dangerous board your ~${win}% to win is low, so it's a thin, vulnerable ${noun}.`;
  if (p.verdict === "good") return `${act} for value with ~${win}% is good — get money in while ahead.`;
  if (p.verdict === "thin") {
    // EV-aware thin copy (iter-16 #2). The displayed `numbers.ev` compares the bet (ev.raise) with
    // CHECKING (ev.call — the going-forward value of taking a free look, per the EV table's check row).
    // When checking rates MATERIALLY higher (more than the noise margin), "fine as value or a
    // semi-bluff" disagrees with the figure — say checking rates higher / the bet is
    // marginal-to-slightly-losing. When the two are roughly tied, the existing "fine" tone holds.
    const betWorseThanCheck =
      p.ev !== undefined && p.ev.call - p.ev.raise > EV_RECONCILE_MARGIN;
    if (betWorseThanCheck)
      return `A thin ${noun} with ~${win}% — checking rates higher on average here, so this ${noun} is marginal-to-slightly-losing, not a clear gain.`;
    return `A thin ${noun} with ~${win}% — fine as value or a semi-bluff, but it's marginal.`;
  }
  // A light/thin bluff: real-but-low equity (~20–33%, no made hand) is a semi-bluff, not "no equity"
  // (iter-09 #6b). Below ~20% it's a genuine air bluff with almost nothing behind it. Both grade -EV.
  if (p.equityPct >= NO_EQUITY_PCT)
    return `${act} ~${win}% with no made hand is a light semi-bluff — you win some of the time, but not enough to push here, so it loses money on average.`;
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
      if (p.verdict === "good") {
        // Conceptual stays digit-free, but a razor-thin price still earns a plain "it's close" hedge so
        // a borderline fold/call isn't presented as clear-cut (iter-17 #4).
        const close = isBorderlinePrice(p.equityPct, p.potOddsPct);
        return p.action === "fold"
          // The honest reason to fold for a price is that the hand wins too rarely to justify the
          // call — NOT that "the pot isn't big enough" (it can be huge; iter-03 #5). Frame it as
          // win-chance vs the price, in plain words. Inside the borderline band the spot is about
          // break-even, so we say calling and folding are about equal (never "wins too rarely") to
          // stay coherent with the equity-bar message (iter-20 MAJOR).
          ? close
            ? "This is about break-even — calling and folding are about equal here, so folding is fine."
            : "Your hand wins too rarely to call this price — you'd be paying more than it can win back often enough, so folding is right."
          : close
            ? "You're just on the right side of the price here, so calling is fine — though it's close."
            : "You're getting a good price here — your hand wins often enough relative to the call, so it's an easy continue.";
      }
      if (p.verdict === "thin")
        return isBorderlinePrice(p.equityPct, p.potOddsPct)
          ? "It's about break-even here — calling and folding are roughly equal."
          : "It's close, but just about worth continuing.";
      return p.action === "fold"
        ? "This was a spot to keep going, not fold."
        : "You're continuing too loosely here — folding is cleaner.";
    case "preflop":
      // A LOOSE preflop OPEN (chart folds, hero raised, off-model — iter-22 MAJOR-1a/MAJOR-2). The
      // plain reason is the position + strength one from conceptualPreflopDeviation ("too weak to raise
      // from early position — hands like it play poorly after the flop, so folding is the standard
      // line"), NEVER the old "raising with little behind it — there's not enough here". For an
      // ALSO-oversized loose open, lead with the size in plain words. Checked BEFORE the generic
      // oversize/overbet guards so a junk open is never softened to "raising can be right".
      if (p.looseOpen) {
        if (p.overbetPotMultiple !== undefined)
          return "This is a weak hand to open from this early seat, and the raise is far bigger than the pot — it risks a lot to win a little. Fold it, or at most make a normal-sized open of a stronger hand.";
        return conceptualPreflopDeviation(p);
      }
      // Oversized open: flag the SIZE in plain words, no numbers (iter-06 #3).
      if (p.openSizeBb !== undefined)
        return "Raising can be fine here, but that's a much bigger open than usual — it bloats the pot and risks a lot to win a little. Make it a normal-sized raise.";
      // Grossly oversized 3-bet/4-bet, plain words (iter-13 #2): direction can be right, size isn't.
      if (p.overbetPotMultiple !== undefined)
        return `Raising can be right here${overbetClause(p.overbetPotMultiple, "raise", true)}.`;
      return p.heroDeviates
        ? conceptualPreflopDeviation(p)
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
      // A grossly OVER-sized bet/raise, plain words (iter-13 #2): direction can be right, size isn't.
      if (p.overbetPotMultiple !== undefined)
        return `${raising ? "Raising" : "Betting"} can be right here${overbetClause(p.overbetPotMultiple, raising ? "raise" : "bet", true)}.`;
      // A grossly under-sized value bet, in plain words (iter-08 #1): you're ahead, but the bet is far
      // too small to charge draws or build the pot. Flag the size, not the read.
      if (p.betTooSmall)
        return p.madeHand
          ? p.equityPct >= 50
            ? `You have ${p.madeHand.label}, but that ${raising ? "raise" : "bet"} is far too small to get value — it barely charges draws or builds the pot. Make it bigger so you actually get paid while you're in front.`
            : `You have ${p.madeHand.label} — some showdown value — but that ${raising ? "raise" : "bet"} is far too small to do its job. Make it bigger so it charges draws and builds the pot.`
          : `You're ahead, but that ${raising ? "raise" : "bet"} is far too small — it barely charges draws or builds the pot. Make it bigger so you actually get paid while you're in front.`;
      // A made-hand value bet escalated to a ❌ mistake (clearly -EV, worse than checking) — plain
      // words, no numbers (iter-18 MAJOR). Don't call it "value": say checking was better and this
      // loses money. Gated on the mistake verdict so a break-even made-hand thin bet keeps the line below.
      if (p.madeHand && p.verdict === "mistake")
        return `You have ${p.madeHand.label}, but multiway on a dangerous board it's too weak to bet for value here — checking was clearly better, and this ${raising ? "raise" : "bet"} loses money on average.`;
      // A made hand still has showdown value — never call it a bluff/"nothing here" (iter-06 #1).
      // Checked first (and for the vulnerable low-equity case) so the made hand is always named.
      if (p.madeHand && p.equityPct < 33)
        return `You already have ${p.madeHand.label} — a real made hand with showdown value, so this is a value ${raising ? "raise" : "bet"}. But multiway on a dangerous board it's thin, so it's a marginal bet.`;
      // Don't call a marginal made hand a "strong hand" (iter-10 #5) — a ✅ value bet can be middle
      // pair, which is "ahead often enough", not "strong". Frame the praise around being ahead; the
      // grade is unchanged.
      if (p.verdict === "good")
        return raising
          ? "You're ahead often enough here — raising for value is right; build the pot while you're ahead."
          : "You're ahead often enough here — betting for value is right.";
      if (p.verdict === "thin") {
        // Conceptual stays digit-free, but it still must not call a clearly-worse line "fine" (iter-16
        // #2): when the EV table says checking rates higher than betting by more than the noise margin,
        // say so in plain words. Roughly-tied keeps the existing "fine"/"borderline" tone.
        const betWorseThanCheck =
          p.ev !== undefined && p.ev.call - p.ev.raise > EV_RECONCILE_MARGIN;
        if (betWorseThanCheck)
          return raising
            ? "A marginal raise — checking rates higher on average here, so it's borderline-to-slightly-losing."
            : "A marginal bet — checking rates higher on average here, so it's borderline-to-slightly-losing.";
        return raising
          ? "A marginal raise — fine to push a thin edge, but it's borderline."
          : "A marginal bet — fine as thin value or a semi-bluff.";
      }
      // A light/thin semi-bluff (some equity, no made hand) vs genuine air, in plain words (iter-09
      // #6b). Both lose money on average here.
      if (p.equityPct >= NO_EQUITY_PCT)
        return `You're ${acting} as a light semi-bluff — you've got some chances, but not enough here, so it loses money on average.`;
      return `You're ${acting} with little behind it — there's not enough here.`;
    }
    case "freecheckfold":
      return "There was no bet to fold to — checking is free. Never fold when you can see the next card for nothing.";
    case "isoraise":
      // A standard iso raise over limpers, plain words, no numbers (iter-14 #5). Explains the chart
      // difference so the conceptual learner still understands why this isn't graded against the chart.
      return "Raising here is a fine, standard play. The chart assumes you're first in, but there are limpers — so this is an isolation raise, raising to play heads-up against a weak limping range. Going for it is right.";
  }
}
