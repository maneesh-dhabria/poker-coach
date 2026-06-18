// Deterministic decision analysis — the SINGLE source of verdict + conceptTags (spec §17).
// Routes a decision to one of five branches (preflop chart, value-check, aggression, call, fold),
// each producing a verdict, concept tags, the numbers block, and a depth-aware explanation.
// The DecisionAnalysis shape (§9.2) is the stable contract the /poker-coach skill reads as truth.
import { ConceptTag } from "@/core/analysis/conceptTags";
import { potOdds, evCall, evRaise } from "@/core/analysis/heuristics";
import { buildExplanation } from "@/core/analysis/explain";
import { chartAction as lookupChart, chartApplies, Position, Facing, ChartAction } from "@/core/charts/preflop";
import { Card } from "@/core/cards";
import { detectMadeHand } from "@/core/mental/estimate";
import { MadeHand } from "@/core/mental/types";
import {
  Verdict,
  CoachingDepth,
  Unit,
  HeroAction,
  Street,
  DecisionAnalysis,
} from "@/core/analysis/types";

export type { Verdict, CoachingDepth, Unit, HeroAction, Street, DecisionAnalysis };

export interface AnalyzeInput {
  action: HeroAction;
  potBefore: number; // pot size before the hero's action
  toCall: number; // chips needed to continue (0 if checking)
  equityPct: number; // hero win% vs the assumed range, 0..100
  unit?: Unit; // default usd
  coachingDepth?: CoachingDepth; // default equity
  assumedRange?: string;
  // T8 context (all optional — absence falls back to the price/aggression heuristics):
  street?: Street;
  numActiveOpponents?: number;
  hand?: [Card, Card]; // for preflop chart lookup
  position?: Position;
  facing?: Facing;
  raiseToExtra?: number; // chips risked beyond a call if raising (enables EV(raise))
  foldEquityPct?: number; // assumed villain fold% to a raise
  // iter-06 #1: the hero's hole cards + the current board. When given on a postflop bet/raise, a
  // made hand (pair or better) is detected so a low-equity VALUE bet is never tagged a no-equity
  // bluff. ADDITIVE/optional — absent ⇒ today's equity-only behavior (card-less tests still pass).
  hole?: [Card, Card];
  board?: Card[];
  // iter-06 #3: the open/raise-to size and the big blind, so a preflop OPEN can be flagged when its
  // size is absurd (e.g. a ~50 BB open of a 1.5 BB pot). ADDITIVE/optional — absent ⇒ size unchecked.
  raiseToAmount?: number; // total chips the hero is raising TO (not the increment)
  bigBlind?: number;
  // The small blind, paired with bigBlind so analyze can tell a LIMPED pot (callers ahead, no raiser)
  // from a true folded-to-hero RFI spot (iter-12 #3): in a limped pot `facing === "unopened"` but
  // potBefore exceeds the posted blinds (limpers added chips). The RFI chart models a clean
  // raise-first-in, NOT facing limpers, so a limped pot is graded OFF-MODEL (equity/heuristics) rather
  // than ❌-flagged against the RFI fold range. ADDITIVE/optional — absent ⇒ no limped-pot detection.
  smallBlind?: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

interface Branch {
  verdict: Verdict;
  severity: 0 | 1 | 2 | 3;
  conceptTags: ConceptTag[];
  kind: "price" | "preflop" | "valuecheck" | "aggression" | "freecheckfold" | "isoraise";
  gtoClaim: boolean;
  chart?: { applies: boolean; chartAction: string; heroDeviates: boolean };
  chartActionForExplain?: ChartAction;
  heroDeviates?: boolean;
  // True when the preflop OPEN size is absurd and the explanation should flag it (iter-06 #3).
  flagOversize?: boolean;
  // True when a postflop value bet is grossly UNDER-sized and the explanation should flag it (iter-08 #1).
  flagUndersize?: boolean;
  // True when a bet/raise is a GROSS overbet (many multiples of the pot) and the size should be
  // critiqued even when the direction/equity is fine (iter-13 #2). Carries the pot-multiple for copy.
  flagGrossOverbet?: boolean;
  overbetPotMultiple?: number;
}

// A LIMPED pot is off-model for the RFI chart (iter-12 #3): preflop, no raiser ahead, but the pot
// already exceeds the posted blinds because a limper completed. Shared by route() (chart-vs-iso/loose
// routing) and analyze() (so the loose-open copy can acknowledge limpers rather than claim "first-in"
// — iter-24 MINOR 2). Requires both blinds (additive); absent ⇒ no detection (today's behavior).
export function detectLimpedPot(input: AnalyzeInput): boolean {
  const street = input.street ?? "preflop";
  const blindsPosted =
    input.smallBlind !== undefined && input.bigBlind !== undefined
      ? input.smallBlind + input.bigBlind
      : undefined;
  return (
    street === "preflop" &&
    input.facing === "unopened" &&
    blindsPosted !== undefined &&
    // One extra big-blind of chips beyond the blinds means at least one limper completed — guard with a
    // small epsilon so float/rounding never false-positives a clean blinds-only pot.
    input.potBefore > blindsPosted + input.bigBlind! / 2
  );
}

export function analyze(input: AnalyzeInput): DecisionAnalysis {
  const unit = input.unit ?? "usd";
  const depth = input.coachingDepth ?? "equity";
  const { action, potBefore, toCall, equityPct } = input;

  const potOddsPct = potOdds(potBefore, toCall);
  const raiseExtra = input.raiseToExtra ?? (toCall > 0 ? toCall * 2 : potBefore);
  const ev = {
    fold: 0,
    call: round1(evCall(potBefore, toCall, equityPct)),
    raise: round1(evRaise(potBefore, raiseExtra, equityPct, input.foldEquityPct ?? 0)),
  };

  // A made hand the hero already holds, detected from the cards (iter-06 #1). Only meaningful when
  // aggressive postflop; absent cards ⇒ null ⇒ today's equity-only behavior. detectMadeHand needs a
  // full 5-card combo (it returns null otherwise), so preflop/short boards naturally yield null.
  const madeHand: MadeHand | null =
    input.hole && input.board ? detectMadeHand(input.hole, input.board) : null;

  // The preflop open size in big blinds, for the oversize check (iter-06 #3). Only an OPEN (first-in
  // raise, no bet to call) is sized here; facing-a-bet 3-bets are not flagged by this conservative rule.
  const openSizeBb =
    input.raiseToAmount && input.bigBlind && input.bigBlind > 0
      ? input.raiseToAmount / input.bigBlind
      : undefined;

  // The size of a CLEAN postflop bet (no prior bet to call) as a fraction of the pot, for the
  // undersize check (iter-08 #1). Only a first-in bet is sized here — a raise facing a bet is a more
  // complex sizing question this conservative rule deliberately skips. Absent ⇒ size unchecked.
  const betPotFraction =
    action === "bet" && toCall === 0 && input.raiseToAmount && potBefore > 0
      ? input.raiseToAmount / potBefore
      : undefined;

  // The bet/raise size as a MULTIPLE of the pot, for the gross-overbet check (iter-13 #2). Applies to
  // ANY bet or raise (a non-open preflop 3-bet/4-bet/shove and any postflop bet/raise), unlike
  // betPotFraction which only sizes a clean first-in postflop bet. Uses the total raise-to amount vs
  // the pot before the action — a normal pot-sized bet is ~1×, a standard 3-bet/4-bet ~2× the small
  // preflop pot, so only a clearly absurd multiple (≥ GROSS_OVERBET_POT_MULTIPLE) ever flags. A forced
  // short-stack shove is ~1× the pot (the stack, not a choice, caps it), so the high threshold
  // naturally excludes it.
  const betPotMultiple =
    (action === "bet" || action === "raise") && input.raiseToAmount && potBefore > 0
      ? input.raiseToAmount / potBefore
      : undefined;

  // One big blind in dollars, derived from the blinds threaded through the flow (iter-18 MAJOR): the
  // made-hand thin→mistake escalation below is denominated in BB, so we need a robust 1-BB figure.
  // Prefer the explicit bigBlind; else infer it as 2× the smallBlind; else fall back to the $1/$2
  // table's $2 (the app's only table today). Always ≥ a sane floor so we never divide by ~0.
  const oneBigBlind =
    input.bigBlind && input.bigBlind > 0
      ? input.bigBlind
      : input.smallBlind && input.smallBlind > 0
        ? input.smallBlind * 2
        : FALLBACK_BIG_BLIND;

  const branch = escalateLooseOpenIfLosing(
    escalateThinValueIfLosing(
      route(input, madeHand, openSizeBb, betPotFraction, betPotMultiple),
      ev,
      oneBigBlind,
    ),
    ev,
    oneBigBlind,
  );

  const plainExplanation = buildExplanation({
    kind: branch.kind,
    verdict: branch.verdict,
    depth,
    unit,
    action,
    potBefore,
    toCall,
    equityPct,
    potOddsPct,
    hand: input.hand,
    position: input.position,
    chartAction: branch.chartActionForExplain,
    heroDeviates: branch.heroDeviates,
    numActiveOpponents: input.numActiveOpponents,
    madeHand,
    openSizeBb: branch.flagOversize ? openSizeBb : undefined,
    betTooSmall: branch.flagUndersize ?? false,
    overbetPotMultiple: branch.flagGrossOverbet ? branch.overbetPotMultiple : undefined,
    // A loose preflop OPEN (chart folds, hero raised, off-model) — drives the preflop "loose open"
    // copy: a position + strength reason with the correct "raise" verb, never the postflop
    // semi-bluff/"no made hand"/"push" framing (iter-22 MAJOR-1a).
    looseOpen: branch.conceptTags.includes("loose_open"),
    // True when the loose open is over LIMPERS — the copy then acknowledges the limpers instead of
    // claiming "first-in" (iter-24 MINOR 2). Same limped-pot signal the iso-raise routing uses.
    limpedPot: detectLimpedPot(input),
    // with the displayed figure (iter-16 #1, #2) — never to change a verdict, only to phrase honestly.
    ev,
  });

  return {
    schemaVersion: 1,
    verdict: branch.verdict,
    severity: branch.severity,
    conceptTags: branch.conceptTags,
    coachingDepth: depth,
    gtoClaim: branch.gtoClaim,
    assumedRange: input.assumedRange ?? null,
    numbers: { equityPct: round1(equityPct), potOddsPct: round1(potOddsPct), ev, unit },
    plainExplanation,
    ...(branch.chart ? { chart: branch.chart } : {}),
    // Structured inputs so the live UI can re-format the sentence in the display unit (iter-04 #3).
    explanationInput: {
      kind: branch.kind,
      action,
      potBefore,
      toCall,
      equityPct: round1(equityPct),
      potOddsPct: round1(potOddsPct),
      chartAction: branch.chartActionForExplain,
      heroDeviates: branch.heroDeviates,
      position: input.position,
      hand: input.hand,
      numActiveOpponents: input.numActiveOpponents,
      // The decision's frozen board + street, so the live Mental Math pins to THIS snapshot rather
      // than re-deriving from a later (already-dealt) board (iter-12 #2). Additive/optional.
      ...(input.board ? { board: input.board } : {}),
      ...(input.street ? { street: input.street } : {}),
      ...(madeHand ? { madeHand } : {}),
      ...(branch.flagOversize && openSizeBb !== undefined ? { openSizeBb } : {}),
      ...(branch.flagUndersize ? { betTooSmall: true } : {}),
      ...(branch.flagGrossOverbet && branch.overbetPotMultiple !== undefined
        ? { overbetPotMultiple: branch.overbetPotMultiple }
        : {}),
      ...(branch.conceptTags.includes("loose_open")
        ? { looseOpen: true, ...(detectLimpedPot(input) ? { limpedPot: true } : {}) }
        : {}),
    },
  };
}

// An open/raise this many big blinds or larger is treated as an absurd oversize (iter-06 #3). A
// standard open is ~2–4 BB; even a fat 4–5x is well under 10, so this never flags a normal open.
const OVERSIZE_OPEN_BB = 10;

// A clean bet smaller than this fraction of the pot is a gross UNDERBET (iter-08 #1). A standard
// small bet is ~25–33% pot, so this conservative ~15% cutoff never flags a legitimate small bet — it
// only catches token underbets ($2 into $360 ≈ 0.6% pot) that charge no draws and build no pot.
const UNDERSIZE_BET_FRACTION = 0.15;

// Below this equity a no-made-hand bet/raise is a genuine "no equity" bluff; at/above it (up to the
// 33% aggression cutoff) it's a real light/thin semi-bluff, not "no equity" (iter-09 #6b).
const NO_EQUITY_PCT = 20;

// POSTFLOP: a bet/raise this many times the pot (or larger) is a gross overbet whose SIZE is flagged
// even when the direction/equity is fine (iter-13 #2, threshold lowered iter-14 #3). A normal pot-sized
// bet is 1×, a fat overbet ~1.5–2×; 3× catches a clearly-reckless stack-off (e.g. shoving $185 into a
// $45 pot ≈ 4.1× with a marginal 53% hand vs two players) while a standard 2/3-pot or 1.5×-pot value bet
// stays clean. A forced short-stack shove caps at ~1× the pot (the stack, not a choice), so it's excluded.
const POSTFLOP_OVERBET_POT_MULTIPLE = 3;

// PREFLOP non-open raises (3-bets/4-bets/shoves) keep a much more lenient cutoff: a standard 3-bet is
// ~2× and a 4-bet can reach ~2.5–3× the small preflop pot, so only a clearly-absurd preflop shove (e.g.
// 92 into a 7 pot ≈ 13×) should flag — never a normal 3-bet/4-bet (iter-13 #2, kept conservative #3).
const PREFLOP_OVERBET_POT_MULTIPLE = 8;

// A gross overbet made while clearly BEHIND — below this equity it's a spew/bluff, not a value bet, so
// the SIZE critique escalates from ⚠️ "size down" to a ❌ mistake that tallies as a mistake (iter-16 #3,
// widened iter-17 #1). A gross overbet made AHEAD (equity ≥ this) is a genuine value overbet ("you're
// ahead, size down") and keeps the ⚠️ treatment reviewers liked. The gate is EQUITY ALONE: a WEAK made
// hand (e.g. a 9%-equity underpair) is still a low-equity spew when it ships a 6×-pot overbet, so the
// prior `madeHand == null` carve-out is dropped — it wrongly spared exactly that case (iter-17 #1).
const OVERBET_VALUE_EQUITY_PCT = 50;

// The $1/$2 table's big blind, used only as a last-resort fallback when no blinds are threaded into
// analyze (older/card-less callers). Today the app has exactly one table ($1/$2 ⇒ 1 BB = $2).
const FALLBACK_BIG_BLIND = 2;

// A made-hand VALUE bet (the `made_hand_thin_value` path) is "thin" only while its absolute EV is
// near break-even (iter-18 MAJOR). Once the bet bleeds CLEARLY-negative money it is a ❌ mistake, not a
// soft ⚠️ thin "value bet". The discriminator is the BET's absolute EV magnitude (how much it loses),
// NOT merely the gap vs checking — so a barely-negative thin bet stays thin. Threshold: 1.5 BB. This
// puts the reviewer's two real data points on the right sides: a value bet at ≈ −0.5 BB (iter-17,
// explicitly accepted as thin) stays ⚠️ thin; the iter-18 case at ≈ −2.4 BB becomes ❌ mistake.
const THIN_VALUE_LOSS_BB = 1.5;

// A loose preflop OPEN (the `loose_open` path) is ⚠️ thin while only marginally -EV; once its raise EV
// drops below −LOOSE_OPEN_LOSS_BB it is a ❌ mistake (iter-22 MINOR #4). The reviewer's J9o CO min-raise
// at ≈ −1 BB must stay ⚠️ thin (a marginally-loose open), while a clearly-junk open that loses more
// becomes ❌ mistake. Set just below the J9o anchor (≈ −1 BB) so −1 BB stays thin and a clearly-losing
// open (≈ −1.5 BB+) escalates. Denominated in BB like THIN_VALUE_LOSS_BB.
const LOOSE_OPEN_LOSS_BB = 1.5;

// In addition to the absolute-loss gate, the bet must be MATERIALLY worse than the best alternative
// (checking — `ev.call` is the CHECK row when facing no bet) by more than the EV noise margin (≈ 1 BB
// on the $1/$2 table). So a clearly-negative bet that is only a hair below a (still-negative) check is
// not escalated — only one that is both money-losing AND meaningfully worse than checking.
const EV_RECONCILE_MARGIN = 2;

// Escalate a made-hand thin-VALUE bet from ⚠️ thin to ❌ mistake when the chosen aggressive action's
// EV is CLEARLY negative (beyond −THIN_VALUE_LOSS_BB) AND materially worse than checking (iter-18
// MAJOR). Keeps genuinely break-even / slightly-negative thin value bets as ⚠️ thin. Only ever touches
// the made-hand thin-value path (tag `made_hand_thin_value`, verdict thin); every other branch passes
// through unchanged. When escalated, the value tag/label is dropped for a coherent mistake framing
// (`value_bet_too_thin` → "Checking was better"), so the copy never keeps calling it "value".
function escalateThinValueIfLosing(
  branch: Branch,
  ev: { fold: number; call: number; raise: number },
  bigBlind: number,
): Branch {
  if (branch.verdict !== "thin" || !branch.conceptTags.includes("made_hand_thin_value")) {
    return branch;
  }
  // A grossly UNDER-sized thin bet is a SIZE problem (bet_too_small), not a money-bleeding overbet —
  // its tiny stake can't lose much, and the right lesson is "size up", not "checking was better". Leave
  // that path as ⚠️ thin so the size critique stands.
  if (branch.flagUndersize) return branch;
  const lossThreshold = -THIN_VALUE_LOSS_BB * bigBlind;
  const clearlyLosing = ev.raise < lossThreshold;
  const worseThanCheck = ev.raise < ev.call - EV_RECONCILE_MARGIN;
  if (!clearlyLosing || !worseThanCheck) return branch;
  return {
    ...branch,
    verdict: "mistake",
    severity: 2,
    conceptTags: branch.conceptTags
      .filter((t) => t !== "made_hand_thin_value")
      .concat("value_bet_too_thin"),
  };
}

// Apply the gross-overbet SIZE critique on top of an aggression-branch result (iter-13 #2). The
// direction/equity grade is kept; the size is flagged with a ⚠️ (a ✅ value bet downgrades to ⚠️
// "Oversized" so an oversized shove is never praised without comment, while an already-flagged thin/❌
// bet keeps its severity and just gains the size tag). `threshold` lets postflop and preflop use
// different cutoffs (postflop ~3×, preflop ~8×) — postflop reckless stack-offs flag, normal preflop
// 3-bets/4-bets don't (iter-14 #3).
function withGrossOverbet(
  branch: Branch,
  betPotMultiple: number | undefined,
  threshold: number,
  equityPct: number,
): Branch {
  if (betPotMultiple === undefined || betPotMultiple < threshold) return branch;
  // A gross overbet made while clearly BEHIND is a spew/bluff, not a value bet — it risks a huge amount
  // with a hand that's losing, so it belongs in the ❌ "mistake" bucket, not ⚠️ "thin" (iter-16 #3). The
  // gate is EQUITY ALONE (iter-17 #1): a weak made hand at low equity (a 9% underpair) is still a spew,
  // so the prior `madeHand == null` carve-out is dropped. A genuine value/ahead overbet (equity ≥ the
  // value threshold) keeps the ⚠️ "you're ahead, size down" treatment. Only ESCALATE a ✅/⚠️ good-or-thin
  // grade; a branch already graded a mistake stays a mistake (never softened).
  const lowEquitySpew = equityPct < OVERBET_VALUE_EQUITY_PCT;
  const escalateToMistake = lowEquitySpew && branch.verdict !== "mistake";
  // The low-equity overbet MISTAKE has no VALUE in it — there's nothing thin-VALUE about betting a
  // 9%-to-win hand — so drop any value tag (made_hand_thin_value / thin_value_good) and use an
  // "Oversized — no value" framing instead (iter-17 #2). A value/ahead overbet keeps its value tag plus
  // the "Oversized" tag, as before.
  const stripped = escalateToMistake
    ? branch.conceptTags.filter(
        (t) => t !== "made_hand_thin_value" && t !== "thin_value_good",
      )
    : branch.conceptTags;
  const withSizeTag: ConceptTag[] = stripped.includes("oversize_bet")
    ? stripped
    : [...stripped, "oversize_bet"];
  const tags: ConceptTag[] =
    escalateToMistake && !withSizeTag.includes("oversize_no_value")
      ? [...withSizeTag, "oversize_no_value"]
      : withSizeTag;
  // Never leave a gross overbet as a clean ✅. A low-equity spew escalates to ❌ mistake; a value/ahead
  // overbet surfaces the size concern at ⚠️ thin. A bet already graded thin/mistake keeps its
  // (equal-or-worse) verdict + severity.
  const verdict: Verdict = escalateToMistake
    ? "mistake"
    : branch.verdict === "good"
      ? "thin"
      : branch.verdict;
  const severity: 0 | 1 | 2 | 3 = escalateToMistake
    ? 2
    : branch.verdict === "good"
      ? 1
      : branch.severity;
  return {
    ...branch,
    verdict,
    severity,
    conceptTags: tags,
    flagGrossOverbet: true,
    overbetPotMultiple: betPotMultiple,
  };
}

function route(
  input: AnalyzeInput,
  madeHand: MadeHand | null,
  openSizeBb?: number,
  betPotFraction?: number,
  betPotMultiple?: number,
): Branch {
  const { action, equityPct } = input;
  const street = input.street ?? "preflop";

  // A LIMPED pot is off-model for the RFI chart (iter-12 #3). The chart's "unopened" range models a
  // clean raise-first-in; once a limper has added chips the spot is "facing a limper" (a great-priced
  // iso), NOT a true RFI — so grading an iso-raise against the RFI fold range over-punishes a standard
  // play. Shared with analyze() so the loose-open copy can drop "first-in" over limpers (iter-24 MINOR 2).
  const isLimpedPot = detectLimpedPot(input);

  // A preflop OPEN/iso-raise in a LIMPED pot is graded by PREFLOP yardsticks, never by the postflop
  // aggression heuristic (iter-22 MAJOR-1a). The RFI chart is off-model in a limped pot (it assumes
  // first-in), so:
  //   • a hand the chart WOULD open first-in → a standard ISOLATION raise → ✅ good (iter-14 #5);
  //   • a hand the chart FOLDS → a LOOSE OPEN → graded thin/mistake by its EV magnitude (loose_open),
  //     with PREFLOP framing (position + strength), NOT "semi-bluff / no made hand / push".
  // Routed BEFORE the postflop heuristics so a limped-pot open never falls through to aggressionBranch.
  if (
    isLimpedPot &&
    action === "raise" &&
    input.hand &&
    input.position &&
    chartApplies(input.position, "unopened")
  ) {
    if (lookupChart(input.hand, input.position, "unopened") === "raise") {
      return isoRaiseBranch(input.hand);
    }
    // A LOOSE open. A grossly OVERSIZED loose open (e.g. a 101 BB shove of 85s) is still flagged for
    // its absurd SIZE on top of the loose-open framing (iter-22 keeps the iter-16 #3 oversize-open
    // behavior): layer the gross-overbet size critique (lenient preflop cutoff ~8×) onto the loose
    // open so a reckless shove never loses its size flag. A normal 2–3 BB loose open stays a clean
    // loose open. The EV-magnitude escalation (escalateLooseOpenIfLosing) still applies downstream.
    return withGrossOverbet(
      looseOpenBranch(),
      betPotMultiple,
      PREFLOP_OVERBET_POT_MULTIPLE,
      equityPct,
    );
  }

  // 1. Preflop chart branch — the only place we claim GTO-ish correctness (gtoClaim=true).
  if (
    street === "preflop" &&
    !isLimpedPot &&
    input.hand &&
    input.position &&
    input.facing &&
    chartApplies(input.position, input.facing)
  ) {
    // A preflop CALL of a hand the chart FOLDS is graded by POT ODDS, not solely the chart's fold
    // range (iter-22 MAJOR-1b). The BB-vs-raise chart folds many hands that are nonetheless a clear,
    // correct call at the price (e.g. completing $4 into a ~$32 pot needs ~11% and a hand can have
    // ~18%). When the price is CLEARLY met (the callBranch grades it good/thin), DEFER to the price —
    // grade it exactly like callBranch and reconcile in the copy — instead of emitting a ❌
    // "the math favors folding" verdict whose number (equity ≥ needed) contradicts it. When the price
    // is NOT met (callBranch would grade it a mistake), the chart's fold agrees with the price, so the
    // chart branch's call_too_wide mistake stands. gtoClaim stays false on a price-deferred call (the
    // chart's default is fold; we're overriding by price, so we don't claim GTO authority).
    // GATED on the chart recommending FOLD: a hand the chart RAISES or CALLS is a correct CONTINUE —
    // the chart branch already grades it (✅ for a call match, ⚠️ for a raise-vs-call aggression
    // mismatch), so we must NOT override that into a flat price-good (that would erase a legitimate
    // "raise, don't just call" thin). Only the over-FOLD (chart-fold) case is the one the price rescues.
    if (
      action === "call" &&
      input.toCall > 0 &&
      lookupChart(input.hand, input.position, input.facing) === "fold"
    ) {
      const priceBranch = callBranch(equityPct, potOdds(input.potBefore, input.toCall));
      if (priceBranch.verdict !== "mistake") return priceBranch;
    }
    // Flag the SIZE only on a first-in OPEN (raise, nothing to call) that's absurdly large; a 3-bet
    // facing a raise is intentionally not size-checked by this BB-based rule.
    const isOpen = action === "raise" && input.facing === "unopened";
    const oversize = isOpen && openSizeBb !== undefined && openSizeBb >= OVERSIZE_OPEN_BB;
    const chartBranch = preflopBranch(input.hand, input.position, input.facing, action, oversize);
    // A NON-open preflop raise (3-bet/4-bet/shove) isn't size-checked by the BB-open rule above, so a
    // grossly oversized 4-bet (e.g. shoving 92 into a 7 pot) once drew no size critique even when the
    // direction was ✅ (iter-13 #2). Apply the pot-multiple overbet flag to non-open raises here at the
    // LENIENT preflop cutoff (~8×) so a normal 3-bet/4-bet (~2–3×) never flags (iter-14 #3). An open
    // that's already BB-flagged keeps that flag (don't double-flag the same open).
    return isOpen
      ? chartBranch
      : withGrossOverbet(
          chartBranch,
          betPotMultiple,
          PREFLOP_OVERBET_POT_MULTIPLE,
          equityPct,
        );
  }

  // A PREFLOP OPEN (raise, facing no prior raise) that reaches this fallthrough is an off-chart open (a
  // limped pot whose chart doesn't apply, or a seat with no RFI chart) — it must NOT be graded by the
  // postflop aggression heuristic, which frames an open as a "semi-bluff with no made hand that loses
  // money on a push" (iter-22 MAJOR-1a). A preflop open is never a made-hand spot and never a "push"
  // (the hero min-raised). Grade it as a loose open by PREFLOP yardsticks instead. A chart-open hand
  // here would already have been caught by the iso-raise/chart branches above; only off-chart FOLD
  // hands fall through. A preflop raise FACING A RAISE (a 3-bet/4-bet) is NOT an open — it continues to
  // the heuristic/overbet path below so a gross 4-bet shove still flags (iter-13 #2).
  if (street === "preflop" && action === "raise" && input.facing === "unopened") {
    return looseOpenBranch();
  }

  // A PREFLOP call that reaches this fallthrough (no chart applies to the seat) is graded by the price,
  // exactly like the postflop callBranch — see the pot-odds deference applied to the chart branch for
  // seats the chart DOES cover (iter-22 MAJOR-1b).

  // 2..5 postflop / no-chart heuristics.
  if (action === "check") return checkBranch(equityPct);
  if (action === "bet" || action === "raise") {
    const undersize =
      betPotFraction !== undefined && betPotFraction < UNDERSIZE_BET_FRACTION;
    const aggression = aggressionBranch(equityPct, madeHand, undersize);
    // A grossly oversized bet/raise gets a ⚠️ size critique even with good equity (iter-13 #2). The
    // POSTFLOP threshold (~3×, lowered iter-14 #3) catches a reckless stack-off, but a PREFLOP raise that
    // reaches this heuristic fallthrough (an off-chart 3-bet/4-bet — only BB has a vs-raise chart) must
    // keep the LENIENT preflop cutoff (~8×) so a normal 2–3× 3-bet is never flagged (iter-14 #3). Pick the
    // threshold by street. An undersized bet can't also be a gross overbet, so the flags never collide.
    const overbetThreshold =
      street === "preflop" ? PREFLOP_OVERBET_POT_MULTIPLE : POSTFLOP_OVERBET_POT_MULTIPLE;
    return undersize
      ? aggression
      : withGrossOverbet(aggression, betPotMultiple, overbetThreshold, equityPct);
  }
  if (action === "fold") {
    // No chips to call means checking is free — folding forfeits a free look at the pot and is
    // strictly dominated by checking. That's a different (and always wrong) decision than folding
    // to a bet, so it gets its own branch instead of the pot-odds "price" framing (which would
    // nonsensically read "$0 to win, need 0%").
    return input.toCall === 0
      ? freeCheckFoldBranch(equityPct)
      : foldBranch(equityPct, potOdds(input.potBefore, input.toCall), street);
  }
  return callBranch(equityPct, potOdds(input.potBefore, input.toCall));
}

function toChartAction(action: HeroAction): ChartAction {
  if (action === "fold") return "fold";
  if (action === "bet" || action === "raise") return "raise";
  return "call"; // call / check
}

function preflopBranch(
  hand: [Card, Card],
  position: Position,
  facing: Facing,
  action: HeroAction,
  oversize = false,
): Branch {
  const rec = lookupChart(hand, position, facing);
  const hero = toChartAction(action);
  const deviates = hero !== rec;
  const chart = { applies: true, chartAction: rec, heroDeviates: deviates };
  const base = {
    kind: "preflop" as const,
    gtoClaim: true,
    chart,
    chartActionForExplain: rec,
    heroDeviates: deviates,
  };

  // An absurdly oversized OPEN: the decision to raise can be right, but the SIZE is far off — so it
  // is never praised as "the standard, profitable play". Flag the size (note + tag) at a ⚠️ thin
  // verdict, regardless of whether the action class matches the chart (iter-06 #3).
  if (oversize) {
    const tags: ConceptTag[] = ["preflop_oversize"];
    if (deviates) tags.push("preflop_chart_deviation");
    // An oversized open of a hand the chart wouldn't even play (rec === "fold") is a low-equity spew,
    // not a value overbet — a 100 BB shove of 97o is a ❌ mistake, so it tallies as a mistake, while an
    // oversized open of a hand the chart WOULD open (you're ahead, just too big) keeps the ⚠️ "size
    // down" treatment reviewers liked (iter-16 #3). Keyed on the chart's fold recommendation, the
    // preflop analogue of the postflop low-equity/no-made-hand spew test.
    const spew = rec === "fold";
    return {
      ...base,
      verdict: spew ? "mistake" : "thin",
      severity: spew ? 2 : 1,
      conceptTags: tags,
      flagOversize: true,
    };
  }

  if (!deviates) {
    return { ...base, verdict: "good", severity: 0, conceptTags: ["good_preflop_discipline"] };
  }
  const tags: ConceptTag[] = ["preflop_chart_deviation"];
  if (rec !== "fold" && hero === "fold") {
    tags.push("fold_too_tight");
    return { ...base, verdict: "mistake", severity: 2, conceptTags: tags };
  }
  if (rec === "fold" && hero !== "fold") {
    // Chart says fold, hero kept playing. Pick a tag that matches what the hero actually DID: a call
    // is "call too wide", but a bet/raise is not a call — tag it action-neutrally (iter-03 #4).
    tags.push(action === "call" ? "call_too_wide" : "played_too_wide");
    return { ...base, verdict: "mistake", severity: 2, conceptTags: tags };
  }
  // raise-vs-call mismatch: right to continue, wrong aggression level → thin.
  return { ...base, verdict: "thin", severity: 1, conceptTags: tags };
}

// A LOOSE preflop OPEN of a hand the chart folds, in a spot the RFI chart doesn't model cleanly (a
// limped pot, or an off-chart seat). Graded by PREFLOP yardsticks — NOT the postflop aggression
// heuristic that wrongly framed a normal open as a "semi-bluff with no made hand that loses on a
// push" (iter-22 MAJOR-1a). The base verdict is ⚠️ thin (a marginally-loose open is only slightly
// -EV); `escalateLooseOpenIfLosing` bumps a clearly-losing junk open to ❌ mistake by its EV
// magnitude. Off-model (gtoClaim false): facing limpers/off-chart isn't chart-modeled. The copy
// (explain.ts `preflop` loose-open path) gives a position + strength reason and the correct "raise"
// verb — never "bet"/"push"/"no made hand"/"semi-bluff".
function looseOpenBranch(): Branch {
  return {
    kind: "preflop",
    gtoClaim: false,
    verdict: "thin",
    severity: 1,
    // chartActionForExplain=fold + heroDeviates=true drive the preflop "loose open" copy and the
    // Conceptual `conceptualPreflopDeviation` plain reason (chart folds, hero raised → too weak here).
    chartActionForExplain: "fold",
    heroDeviates: true,
    conceptTags: ["loose_open", "preflop_chart_deviation"],
  };
}

// A loose preflop OPEN is "thin" while only marginally -EV; once it bleeds CLEARLY-negative money it
// is a ❌ mistake (iter-22 MINOR #4). Mirrors `escalateThinValueIfLosing`: the discriminator is the
// raise's absolute EV magnitude in BB. Anchored to the reviewer's two data points — a J9o CO min-raise
// at ≈ −1 BB stays ⚠️ thin; a clearly-losing junk open (e.g. ≈ −2 BB+) becomes ❌ mistake. Only ever
// touches the loose_open path; every other branch passes through unchanged.
function escalateLooseOpenIfLosing(
  branch: Branch,
  ev: { fold: number; call: number; raise: number },
  bigBlind: number,
): Branch {
  if (branch.verdict !== "thin" || !branch.conceptTags.includes("loose_open")) return branch;
  const lossThreshold = -LOOSE_OPEN_LOSS_BB * bigBlind;
  if (ev.raise >= lossThreshold) return branch; // marginally-loose → stays ⚠️ thin
  return {
    ...branch,
    verdict: "mistake",
    severity: 2,
    conceptTags: branch.conceptTags.includes("played_too_wide")
      ? branch.conceptTags
      : [...branch.conceptTags, "played_too_wide"],
  };
}

// A standard isolation raise over limpers (iter-14 #5): the RFI chart would open this hand first-in,
// so raising to isolate the limpers is a fine, standard play — never "⚠️ thin". Off-model (gtoClaim
// false) because limpers aren't chart-modeled; the explanation reconciles by saying the chart assumes
// first-in but here there are limpers, so this is an iso raise.
function isoRaiseBranch(_hand: [Card, Card]): Branch {
  return {
    kind: "isoraise",
    gtoClaim: false,
    verdict: "good",
    severity: 0,
    conceptTags: ["iso_raise_standard"],
  };
}

function checkBranch(equityPct: number): Branch {
  const base = { kind: "valuecheck" as const, gtoClaim: false };
  if (equityPct >= 60)
    return { ...base, verdict: "mistake", severity: 2, conceptTags: ["value_bet_missed"] };
  if (equityPct >= 52)
    return { ...base, verdict: "thin", severity: 1, conceptTags: ["value_bet_missed"] };
  return { ...base, verdict: "good", severity: 0, conceptTags: [] };
}

function aggressionBranch(
  equityPct: number,
  madeHand: MadeHand | null,
  undersize = false,
): Branch {
  const base = { kind: "aggression" as const, gtoClaim: false };
  // A grossly UNDER-sized bet by a hero who is plausibly VALUE-betting is a SIZE problem (iter-10 #3):
  // a $2-into-$36 bet with a made hand once drew no sizing comment because the made-hand branch
  // returned first. Surface the size critique — but ONLY when the hero is actually value-betting (a
  // made hand is present, OR equity is high enough to be ahead). The "you're ahead / size up to get
  // paid while you're in front" framing is value-bet framing; firing it for a low-equity A-high
  // airball (iter-11 #1) told a beginner to bet BIGGER with a hand the EV table says to check, and
  // called ~13% equity "ahead". So a sub-threshold bet that is NOT a value bet (no made hand AND low
  // equity) falls through to the low-equity bluff branch below — a ❌ mistake that AGREES with its EV
  // table and never claims a lead.
  const isValueBet = madeHand != null || equityPct >= 50;
  if (undersize && isValueBet) {
    const tags: ConceptTag[] = ["bet_too_small"];
    if (madeHand) tags.push("made_hand_thin_value");
    return { ...base, verdict: "thin", severity: 1, conceptTags: tags, flagUndersize: true };
  }
  if (equityPct < 33) {
    // A MADE hand (pair or better) bet at low equity is NOT a bluff with no equity — it has real
    // showdown value (iter-06 #1). The low win% is about being multiway on a dangerous board, so it's
    // a thin/vulnerable VALUE bet, not a stone bluff. Only a genuine no-made-hand low-equity bet keeps
    // the bluff_no_equity tag + mistake verdict.
    if (madeHand)
      return { ...base, verdict: "thin", severity: 1, conceptTags: ["made_hand_thin_value"] };
    // Reserve "bluff_no_equity" (and its "no equity" wording) for genuinely tiny equity (< ~20%). A
    // ~20–33% air-shove is a real light/thin semi-bluff, not "no equity" — tag it bluff_thin_equity
    // (iter-09 #6b). The -EV grade is unchanged (still a ❌ mistake); only the tag/wording differs.
    if (equityPct < NO_EQUITY_PCT)
      return { ...base, verdict: "mistake", severity: 2, conceptTags: ["bluff_no_equity"] };
    return { ...base, verdict: "mistake", severity: 2, conceptTags: ["bluff_thin_equity"] };
  }
  if (equityPct < 50)
    return { ...base, verdict: "thin", severity: 1, conceptTags: ["thin_value_good"] };
  return { ...base, verdict: "good", severity: 0, conceptTags: [] };
}

function callBranch(equityPct: number, potOddsPct: number): Branch {
  const edge = equityPct - potOddsPct;
  const base = { kind: "price" as const, gtoClaim: false };
  if (edge >= 3) return { ...base, verdict: "good", severity: 0, conceptTags: ["call_correct_price"] };
  // Essentially-breakeven calls (edge within a small band of 0) are ⚠️ marginal, not ❌ mistakes
  // (iter-06 #6): a call at ~14% equity vs a ~13.5% price is roughly zero-EV, not a clear error. The
  // band is widened slightly below 0 so a near-breakeven call grades thin; clearly -EV calls (edge <
  // -2) stay mistakes.
  if (edge >= -2) return { ...base, verdict: "thin", severity: 1, conceptTags: ["thin_value_good"] };
  return {
    ...base,
    verdict: "mistake",
    severity: edge <= -15 ? 3 : 2,
    conceptTags: ["call_too_wide"],
  };
}

// Folding when checking is free. Always a mistake — checking costs nothing and keeps your hand
// alive — so the verdict does not depend on equity; equity only scales how much was given up.
function freeCheckFoldBranch(equityPct: number): Branch {
  return {
    kind: "freecheckfold",
    gtoClaim: false,
    verdict: "mistake",
    severity: equityPct >= 25 ? 3 : 2,
    conceptTags: ["fold_too_tight"],
  };
}

function foldBranch(equityPct: number, potOddsPct: number, street: Street): Branch {
  const edge = equityPct - potOddsPct;
  const base = { kind: "price" as const, gtoClaim: false };
  if (edge >= 5)
    return {
      ...base,
      verdict: "mistake",
      severity: edge >= 15 ? 3 : 2,
      conceptTags: ["fold_too_tight"],
    };
  // A sound fold. Tag it by street so a river fold is never labeled "preflop" (iter-03 #4): a
  // preflop fold keeps the discipline tag, any later street gets the street-neutral fold tag.
  const tag: ConceptTag = street === "preflop" ? "good_preflop_discipline" : "good_fold_discipline";
  return { ...base, verdict: "good", severity: 0, conceptTags: [tag] };
}
