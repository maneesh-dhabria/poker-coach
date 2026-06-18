import { describe, it, expect } from "vitest";
import { buildExplanation, narrateWinner, ExplainParams } from "@/core/analysis/explain";
import { CoachingDepth, Verdict } from "@/core/analysis/types";

// A spread of params covering every kind × verdict × depth, so the banned-phrase guard
// (T18) sees the whole copy surface, not one branch.
const KINDS: ExplainParams["kind"][] = [
  "price",
  "preflop",
  "valuecheck",
  "aggression",
  "freecheckfold",
];
const VERDICTS: Verdict[] = ["good", "thin", "mistake"];
const DEPTHS: CoachingDepth[] = ["conceptual", "equity", "strict"];

function fixture(
  kind: ExplainParams["kind"],
  verdict: Verdict,
  depth: CoachingDepth,
): ExplainParams {
  return {
    kind,
    verdict,
    depth,
    unit: "usd",
    action: kind === "price" && verdict !== "mistake" ? "fold" : "call",
    potBefore: 12,
    toCall: 4,
    equityPct: 42,
    potOddsPct: 25,
    hand: ["Ah", "Kh"],
    position: "BTN",
    chartAction: "raise",
    heroDeviates: verdict === "mistake",
  };
}

const allFixtures: ExplainParams[] = KINDS.flatMap((k) =>
  VERDICTS.flatMap((v) => DEPTHS.map((d) => fixture(k, v, d))),
);

describe("buildExplanation copy (T18: no unexplained jargon)", () => {
  it("never leads with the banned jargon phrase", () => {
    for (const p of allFixtures) {
      expect(buildExplanation(p).toLowerCase()).not.toContain(
        "you don't have the price to continue",
      );
    }
  });

  it("defines 'equity' inline whenever the bare word is used", () => {
    for (const p of allFixtures) {
      const s = buildExplanation(p);
      if (/\bequity\b/i.test(s)) {
        expect(s).toMatch(/equity\b[^.]*\b(share of the pot|how often you win)/i);
      }
    }
  });

  it("still produces a non-empty plain string for every branch", () => {
    for (const p of allFixtures) {
      expect(buildExplanation(p).trim().length).toBeGreaterThan(0);
    }
  });
});

describe("preflop explanation reflects coaching depth (iter-03 #7)", () => {
  const spot = (depth: CoachingDepth): ExplainParams => ({
    kind: "preflop",
    verdict: "good",
    depth,
    unit: "usd",
    action: "raise",
    potBefore: 3,
    toCall: 0,
    equityPct: 67,
    potOddsPct: 0,
    hand: ["Ah", "Kh"],
    position: "CO",
    chartAction: "raise",
    heroDeviates: false,
  });

  it("produces materially different text at conceptual / equity / strict for the same spot", () => {
    const conceptual = buildExplanation(spot("conceptual"));
    const equity = buildExplanation(spot("equity"));
    const strict = buildExplanation(spot("strict"));
    expect(conceptual).not.toEqual(equity);
    expect(equity).not.toEqual(strict);
    expect(conceptual).not.toEqual(strict);
  });

  it("Conceptual uses plain words and no raw numbers", () => {
    const s = buildExplanation(spot("conceptual"));
    expect(s).not.toMatch(/\d/); // no digits at all
    expect(s.toLowerCase()).toMatch(/standard|baseline/);
  });

  it("Equity+Heuristics leads with the odds/equity and calls it 'the standard play' (no chart jargon)", () => {
    const s = buildExplanation(spot("equity"));
    expect(s).toMatch(/\d+%/); // cites the win-rate
    expect(s.toLowerCase()).toMatch(/odds|equity/);
    // iter-08 #5: chart citations are reserved for Strict depth — Equity refers to "the standard
    // play", never names the baseline chart.
    expect(s.toLowerCase()).not.toContain("baseline chart");
    expect(s.toLowerCase()).toMatch(/standard/);
    // equity word, when used, is defined inline (matches the T18 guard).
    if (/\bequity\b/i.test(s)) {
      expect(s).toMatch(/equity\b[^.]*\b(share of the pot|how often you win)/i);
    }
  });

  it("Strict leans on the chart/GTO citation", () => {
    const s = buildExplanation(spot("strict"));
    expect(s.toLowerCase()).toMatch(/baseline chart/);
  });

  // iter-08 #5: the chart citation must appear ONLY at Strict depth, for both the agree and deviate
  // sentences. Equity uses "the standard play"; Strict says "the baseline chart".
  it("Equity-depth deviate copy doesn't name the chart, Strict-depth still does", () => {
    const deviate = (depth: "equity" | "strict"): ExplainParams => ({
      ...spot(depth),
      verdict: "thin",
      heroDeviates: true,
    });
    const eq = buildExplanation(deviate("equity"));
    const strict = buildExplanation(deviate("strict"));
    expect(eq.toLowerCase()).not.toContain("baseline chart");
    expect(eq.toLowerCase()).toMatch(/standard/);
    expect(strict.toLowerCase()).toContain("baseline chart");
  });
});

describe("Conceptual preflop MISTAKE gives a plain, digit-free reason (iter-21 MINOR)", () => {
  const base: ExplainParams = {
    kind: "preflop",
    verdict: "mistake",
    depth: "conceptual",
    unit: "usd",
    action: "raise",
    potBefore: 3,
    toCall: 0,
    equityPct: 30,
    potOddsPct: 0,
    hand: ["Qc", "8d"],
    position: "UTG",
    chartAction: "fold", // chart folds Q8o UTG; hero raised → too-loose open
    heroDeviates: true,
  };

  it("a too-loose open (chart fold, hero raised) reads as too weak for early position — no digits, no 'baseline line'", () => {
    const s = buildExplanation(base);
    expect(s).not.toMatch(/\d/); // strictly digit-free (Conceptual)
    expect(s.toLowerCase()).not.toContain("differs from the standard baseline line");
    // Names position + strength (a plain, learnable reason).
    expect(s.toLowerCase()).toMatch(/early position/);
    expect(s.toLowerCase()).toMatch(/too weak|plays poorly/);
  });

  it("a too-tight fold (chart opens, hero folded) says the hand is strong enough to play and folding gives up a profitable raise", () => {
    const s = buildExplanation({
      ...base,
      action: "fold",
      chartAction: "raise", // chart opens; hero folded → too tight
    });
    expect(s).not.toMatch(/\d/);
    expect(s.toLowerCase()).not.toContain("differs from the standard baseline line");
    expect(s.toLowerCase()).toMatch(/early position/);
    expect(s.toLowerCase()).toMatch(/strong enough|gives up a profitable raise/);
  });

  it("a raise-vs-call aggression mismatch keeps a plain reason (no digits, no 'baseline line')", () => {
    const s = buildExplanation({
      ...base,
      action: "call",
      chartAction: "raise", // chart raises; hero only called → wrong aggression
    });
    expect(s).not.toMatch(/\d/);
    expect(s.toLowerCase()).not.toContain("differs from the standard baseline line");
    expect(s.toLowerCase()).toMatch(/raise/);
  });

  it("the agree (non-deviation) line is unchanged plain copy", () => {
    const s = buildExplanation({ ...base, verdict: "good", heroDeviates: false });
    expect(s).not.toMatch(/\d/);
    expect(s.toLowerCase()).toContain("standard line");
  });
});

// iter-22 MAJOR-1a/#3/#5: a LOOSE preflop OPEN (chart folds, hero raised, off-model) must read as a
// RAISE with a position + strength reason at EVERY depth — never the postflop semi-bluff / "no made
// hand" / "push" framing, and never the wrong "betting" verb.
describe("loose-open copy reads as a raise with a position/strength reason (iter-22 MAJOR-1a)", () => {
  const looseBase = (depth: ExplainParams["depth"], verdict: ExplainParams["verdict"]): ExplainParams => ({
    kind: "preflop",
    verdict,
    depth,
    unit: "usd",
    action: "raise",
    potBefore: 5,
    toCall: 0,
    equityPct: 22,
    potOddsPct: 0,
    hand: ["Jh", "9c"],
    position: "CO",
    chartAction: "fold",
    heroDeviates: true,
    looseOpen: true,
  });

  for (const depth of ["equity", "strict"] as const) {
    it(`${depth} depth: a thin loose open says "raising", a position/strength reason, and no postflop framing`, () => {
      const s = buildExplanation(looseBase(depth, "thin")).toLowerCase();
      expect(s).toContain("raising"); // correct verb
      expect(s).not.toContain("betting"); // never the postflop "you're betting" (reviewer #3)
      expect(s).not.toContain("semi-bluff");
      expect(s).not.toContain("no made hand");
      expect(s).not.toContain("push");
      expect(s).not.toContain("bluff (no equity)");
      expect(s).toMatch(/loose|easily-dominated/); // a strength reason
      expect(s).toMatch(/late position|chart opens first-in/); // a position / chart reason
    });
  }

  it("conceptual depth: a loose open gives a plain, digit-free position/strength reason (no 'little behind it')", () => {
    const s = buildExplanation(looseBase("conceptual", "mistake"));
    expect(s).not.toMatch(/\d/);
    const lower = s.toLowerCase();
    expect(lower).toContain("too weak to raise");
    expect(lower).not.toContain("little behind it");
    expect(lower).not.toContain("there's not enough here");
  });

  // iter-24 MINOR 2: a loose open over LIMPERS must NOT claim "first-in" (the hero wasn't first in).
  // A genuine first-in (unopened, no limpers) loose open may still use the "first-in" framing.
  for (const depth of ["equity", "strict"] as const) {
    for (const verdict of ["thin", "mistake"] as const) {
      it(`${depth} depth, ${verdict}: a LIMPED-pot loose open does NOT say "first-in" and acknowledges the limpers`, () => {
        const s = buildExplanation({ ...looseBase(depth, verdict), limpedPot: true }).toLowerCase();
        expect(s).not.toContain("first-in");
        expect(s).not.toContain("first in");
        expect(s).toContain("limper"); // acknowledges the limpers (like the iso-raise path)
        expect(s).toContain("raising"); // still the correct preflop verb
      });
    }
  }

  it("a genuine FIRST-IN loose open (no limpers) may still use the 'first-in' framing", () => {
    const s = buildExplanation({ ...looseBase("strict", "thin"), limpedPot: false }).toLowerCase();
    expect(s).toContain("first-in");
  });
});

describe("preflop equity copy labels MULTIWAY opponents, not 'a random hand' (iter-04 #2)", () => {
  const ttRaise = (numActiveOpponents: number): ExplainParams => ({
    kind: "preflop",
    verdict: "good",
    depth: "equity",
    unit: "usd",
    action: "raise",
    potBefore: 7,
    toCall: 0,
    equityPct: 31, // multiway TT
    potOddsPct: 0,
    hand: ["Th", "Td"],
    position: "MP",
    chartAction: "raise",
    heroDeviates: false,
    numActiveOpponents,
  });

  it("does NOT say 'a random hand' (that singular heads-up label is misleading multiway)", () => {
    const s = buildExplanation(ttRaise(5));
    expect(s.toLowerCase()).not.toContain("a random hand");
    expect(s.toLowerCase()).not.toContain("random hand");
  });

  it("references the opponent count it is measured against", () => {
    expect(buildExplanation(ttRaise(5))).toMatch(/5 opponents still in/);
    expect(buildExplanation(ttRaise(1))).toMatch(/1 opponent still in/);
  });

  it("falls back to 'the players still in' when the count is unknown", () => {
    const p = ttRaise(5);
    delete p.numActiveOpponents;
    expect(buildExplanation(p)).toMatch(/players still in/);
  });
});

describe("preflop raise copy reads 'raising', not 'raiseing' (iter-04 #4)", () => {
  const raise = (depth: CoachingDepth): ExplainParams => ({
    kind: "preflop",
    verdict: "good",
    depth,
    unit: "usd",
    action: "raise",
    potBefore: 7,
    toCall: 0,
    equityPct: 55,
    potOddsPct: 0,
    hand: ["Ah", "Kh"],
    position: "MP",
    chartAction: "raise",
    heroDeviates: false,
    numActiveOpponents: 3,
  });

  it("the equity-depth raise copy contains 'raising' and never 'raiseing'", () => {
    const s = buildExplanation(raise("equity"));
    expect(s).toMatch(/raising/);
    expect(s).not.toMatch(/raiseing/);
  });

  it("no verb in any preflop branch produces a naive verb+ing artifact", () => {
    for (const action of ["raise", "call", "fold"] as const) {
      for (const deviates of [false, true]) {
        const s = buildExplanation({ ...raise("equity"), chartAction: action, heroDeviates: deviates });
        expect(s).not.toMatch(/raiseing|callsing|foldsing/);
      }
    }
  });
});

describe("Conceptual aggression copy varies by action (iter-04 #8)", () => {
  const agg = (action: "bet" | "raise", verdict: Verdict): ExplainParams => ({
    kind: "aggression",
    verdict,
    depth: "conceptual",
    unit: "usd",
    action,
    potBefore: 12,
    toCall: 0,
    equityPct: verdict === "thin" ? 45 : verdict === "good" ? 70 : 20,
    potOddsPct: 0,
  });

  it("a thin raise and a thin bet do not yield identical conceptual text", () => {
    expect(buildExplanation(agg("raise", "thin"))).not.toEqual(buildExplanation(agg("bet", "thin")));
  });

  it("a good raise and a good bet differ too", () => {
    expect(buildExplanation(agg("raise", "good"))).not.toEqual(buildExplanation(agg("bet", "good")));
  });

  // iter-06 #2: the low-equity conceptual bet copy must read "betting", never "beting".
  it("the conceptual low-equity bet copy says 'betting', not 'beting'", () => {
    const s = buildExplanation(agg("bet", "mistake"));
    expect(s).toContain("betting");
    expect(s).not.toContain("beting");
  });

  // iter-24 MINOR 3: a Conceptual flop bluff with NO equity and no made hand (e.g. 2h3h on QQ5) used
  // to read "betting with little behind it — there's not enough here", which didn't teach WHY. The new
  // copy names the concept: a pure bluff that almost never wins at showdown AND rarely folds out a
  // better hand, so nothing backs the bet. Still digit-free at Conceptual.
  it("the conceptual no-equity bluff copy teaches the concept (no equity / nothing to back it / won't fold better hands), digit-free", () => {
    const sBet = buildExplanation(agg("bet", "mistake"));
    // Force a genuine NO-equity airball (below NO_EQUITY_PCT, no made hand).
    const sAir = buildExplanation({ ...agg("bet", "mistake"), equityPct: 8 }).toLowerCase();
    expect(sAir).not.toMatch(/\d/); // digit-free
    expect(sAir).toContain("bluff"); // names the concept
    // Teaches the two missing ingredients: showdown value AND fold equity.
    expect(sAir).toMatch(/showdown/);
    expect(sAir).toMatch(/fold/);
    // The old vague phrasing is gone.
    expect(sAir).not.toContain("little behind it");
    expect(sAir).not.toContain("there's not enough here");
    // The raise variant says "raise", the bet variant says "bet" (verb-correct).
    const sRaiseAir = buildExplanation({ ...agg("raise", "mistake"), equityPct: 8 }).toLowerCase();
    expect(sRaiseAir).toContain("raise");
    void sBet;
  });

  // iter-10 #5: a ✅ value bet can be a marginal made hand (e.g. middle pair), so the conceptual
  // "good" copy must NOT assert "strong hand" — it frames it around being ahead instead.
  it("the conceptual value-bet 'good' copy does not call a marginal hand 'strong'", () => {
    const sBet = buildExplanation(agg("bet", "good"));
    expect(sBet.toLowerCase()).not.toContain("strong hand");
    expect(sBet.toLowerCase()).toContain("ahead");
    expect(sBet.toLowerCase()).toContain("value");
    const sRaise = buildExplanation(agg("raise", "good"));
    expect(sRaise.toLowerCase()).not.toContain("strong hand");
    expect(sRaise.toLowerCase()).toContain("ahead");
  });
});

describe("made-hand aggression copy is value, not a bluff (iter-06 #1)", () => {
  const base = (
    depth: CoachingDepth,
    madeHand: { category: number; label: string } | null,
  ): ExplainParams => ({
    kind: "aggression",
    verdict: madeHand ? "thin" : "mistake",
    depth,
    unit: "usd",
    action: "bet",
    potBefore: 32,
    toCall: 0,
    equityPct: 18,
    potOddsPct: 0,
    numActiveOpponents: 5,
    madeHand,
  });

  it("equity depth: a low-equity made-hand bet names the hand and never says 'bluff'/'no equity'", () => {
    const s = buildExplanation(base("equity", { category: 3, label: "two pair" })).toLowerCase();
    expect(s).toContain("two pair");
    expect(s).not.toContain("bluff");
    expect(s).not.toContain("no equity");
    expect(s).not.toContain("nothing");
  });

  it("conceptual depth: a low-equity made-hand bet names the hand and never says 'bluff'", () => {
    const s = buildExplanation(base("conceptual", { category: 3, label: "two pair" })).toLowerCase();
    expect(s).toContain("two pair");
    expect(s).not.toContain("bluff");
  });

  it("a true no-made-hand low-equity bet still reads as 'nothing behind it' (bluff)", () => {
    const s = buildExplanation(base("equity", null)).toLowerCase();
    expect(s).toContain("not enough behind it");
  });
});

describe("gross-overbet copy keeps the direction but flags the SIZE (iter-13 #2)", () => {
  const overbet = (depth: CoachingDepth, kind: "aggression" | "preflop", equityPct = 70): ExplainParams => ({
    kind,
    verdict: "thin", // downgraded from good by the overbet flag
    depth,
    unit: "usd",
    action: kind === "preflop" ? "raise" : "bet",
    potBefore: 20,
    toCall: kind === "preflop" ? 5 : 0,
    equityPct,
    potOddsPct: 0,
    hand: ["Ah", "Jc"],
    position: "BTN",
    chartAction: "raise",
    heroDeviates: false,
    overbetPotMultiple: 7,
  });

  it("postflop equity depth: keeps the value direction and says 'size down' with the pot-multiple", () => {
    const s = buildExplanation(overbet("equity", "aggression")).toLowerCase();
    expect(s).toMatch(/for value with ~70%/);
    expect(s).toMatch(/size down/);
    expect(s).toMatch(/7×|7x/);
  });

  it("preflop equity depth (a 4-bet/3-bet overbet): keeps direction, flags size", () => {
    const s = buildExplanation(overbet("equity", "preflop", 63)).toLowerCase();
    expect(s).toMatch(/can be right/);
    expect(s).toMatch(/size down/);
  });

  it("conceptual depth: flags the size in plain words with NO digits", () => {
    const s = buildExplanation(overbet("conceptual", "aggression"));
    expect(s).not.toMatch(/\d/);
    expect(s.toLowerCase()).toMatch(/bigger|size it down/);
  });

  // iter-14 #3: a MARGINAL-edge overbet into a MULTIWAY pot gets the sharper "risks your whole stack
  // to win a little" framing, naming the player count.
  it("(iter-14 #3) a marginal multiway overbet warns about the whole stack and names the player count", () => {
    const s = buildExplanation({
      ...overbet("equity", "aggression", 53),
      numActiveOpponents: 2,
    }).toLowerCase();
    expect(s).toMatch(/whole stack|win a little/);
    expect(s).toMatch(/2 players/);
    expect(s).toMatch(/size down/);
  });
});

// iter-14 #5: a standard isolation raise over limpers reconciles with the chart and never reads "thin".
describe("isolation-raise copy reconciles with the chart over limpers (iter-14 #5)", () => {
  const iso = (depth: CoachingDepth): ExplainParams => ({
    kind: "isoraise",
    verdict: "good",
    depth,
    unit: "usd",
    action: "raise",
    potBefore: 5,
    toCall: 0,
    equityPct: 43,
    potOddsPct: 0,
    hand: ["Kh", "Qd"],
    position: "SB",
  });

  it("equity depth: names it an isolation raise and explains the chart assumes first-in", () => {
    const s = buildExplanation(iso("equity")).toLowerCase();
    expect(s).toContain("isolation raise");
    expect(s).toContain("limpers");
    expect(s).not.toContain("thin");
  });

  it("conceptual depth: explains the iso in plain words with NO digits", () => {
    const s = buildExplanation(iso("conceptual"));
    expect(s).not.toMatch(/\d/);
    expect(s.toLowerCase()).toContain("isolation raise");
  });
});

describe("oversized preflop open copy flags the SIZE (iter-06 #3)", () => {
  const open = (depth: CoachingDepth): ExplainParams => ({
    kind: "preflop",
    verdict: "thin",
    depth,
    unit: "usd",
    action: "raise",
    potBefore: 3,
    toCall: 2,
    equityPct: 60,
    potOddsPct: 0,
    hand: ["Qd", "Td"],
    position: "UTG",
    chartAction: "raise",
    heroDeviates: false,
    openSizeBb: 52,
  });

  it("equity depth: flags the oversize and does not praise it as 'the standard, profitable play'", () => {
    const s = buildExplanation(open("equity")).toLowerCase();
    expect(s).toMatch(/bigger than a standard open|size it down/);
    expect(s).not.toContain("standard, profitable play");
  });

  it("conceptual depth: flags the size in plain words with no numbers", () => {
    const s = buildExplanation(open("conceptual"));
    expect(s).not.toMatch(/\d/);
    expect(s.toLowerCase()).toMatch(/bigger|normal-sized/);
  });

  // iter-09 #5: the OOP clause is position-aware. On the BTN (in position) the copy must NOT say
  // "out of position"; it uses the position-neutral "risks a lot to win a little" phrasing instead.
  it("equity depth: an in-position (BTN) oversize open's copy does NOT say 'out of position'", () => {
    const s = buildExplanation({ ...open("equity"), position: "BTN" }).toLowerCase();
    expect(s).not.toContain("out of position");
    expect(s).toMatch(/bloats the pot and risks a lot to win a little/);
  });

  it("equity depth: an out-of-position (UTG) oversize open's copy still says 'out of position'", () => {
    const s = buildExplanation({ ...open("equity"), position: "UTG" }).toLowerCase();
    expect(s).toContain("out of position");
  });
});

// iter-11 #5 (NIT): a chart fold's "plays poorly after the flop" praise must only add the "especially
// out of position" clause for genuinely OOP seats — CO and BTN are LATE position, so the clause is
// wrong there.
describe("preflop chart-fold copy is position-accurate about OOP (iter-11 #5)", () => {
  const fold = (position: string): ExplainParams => ({
    kind: "preflop",
    verdict: "good",
    depth: "equity",
    unit: "usd",
    action: "fold",
    potBefore: 6,
    toCall: 0,
    equityPct: 35,
    potOddsPct: 0,
    hand: ["6c", "2d"],
    position,
    chartAction: "fold",
    heroDeviates: false,
    numActiveOpponents: 5,
  });

  it("a CO fold's copy does NOT say 'out of position'", () => {
    const s = buildExplanation(fold("CO")).toLowerCase();
    expect(s).not.toContain("out of position");
    expect(s).toContain("plays poorly after the flop");
  });

  it("a BTN fold's copy does NOT say 'out of position'", () => {
    expect(buildExplanation(fold("BTN")).toLowerCase()).not.toContain("out of position");
  });

  it("a UTG (early/OOP) fold's copy still says 'out of position'", () => {
    expect(buildExplanation(fold("UTG")).toLowerCase()).toContain("out of position");
  });
});

describe("explanation sentence renders in the display unit (iter-04 #3)", () => {
  // The price() branch is the money-bearing one ("It costs you $X to win a $Y pot").
  const priceFold: ExplainParams = {
    kind: "price",
    verdict: "good",
    depth: "equity",
    unit: "bb",
    action: "fold",
    potBefore: 452, // $452 + $108 call = $560 pot
    toCall: 108,
    equityPct: 12,
    potOddsPct: 19,
    bigBlind: 2,
  };

  it("renders the cost/pot in BB (÷ bigBlind) when unit is bb, not dollars", () => {
    const s = buildExplanation(priceFold);
    expect(s).toMatch(/54 BB/); // $108 / 2
    expect(s).toMatch(/280 BB/); // $560 / 2
    expect(s).not.toContain("$108");
    expect(s).not.toContain("$560");
  });

  it("still renders dollars in usd mode (default for the persisted record)", () => {
    const s = buildExplanation({ ...priceFold, unit: "usd" });
    expect(s).toContain("$108");
    expect(s).toContain("$560");
  });
});

// iter-17 #4: a razor-thin price (equity within ~3 pts of the need) is still graded ✅ good but earns a
// brief "it's close" hedge so a borderline call/fold isn't presented as clear-cut; a clear gap keeps
// its confident wording.
describe("borderline price gets an 'it's close' hedge (iter-17 #4)", () => {
  const priceGood = (over: Partial<ExplainParams>): ExplainParams => ({
    kind: "price",
    verdict: "good",
    depth: "equity",
    unit: "usd",
    action: "fold",
    potBefore: 100,
    toCall: 16,
    equityPct: 13,
    potOddsPct: 14,
    ...over,
  });

  // iter-20 MAJOR: a borderline fold (equity ≈ need) is at/near break-even, so "folding is right —
  // you don't have the odds" is FALSE and contradicts the equity-bar whyLine. Inside the band the copy
  // now says the coherent break-even thing: calling and folding are about equal, so folding is fine —
  // and NEVER "you don't have the odds".
  it("within-margin fold (win ~13% / need ~14%) says break-even, never 'you don't have the odds'", () => {
    const s = buildExplanation(priceGood({})).toLowerCase();
    expect(s).toMatch(/about equal|break-even/);
    expect(s).toMatch(/folding is fine/);
    expect(s).not.toMatch(/don't have the odds/);
  });

  it("within-margin call (win ~24% / need ~22%) hedges 'it's close'", () => {
    const s = buildExplanation(
      priceGood({ action: "call", equityPct: 24, potOddsPct: 22 }),
    ).toLowerCase();
    expect(s).toMatch(/close/);
  });

  it("a CLEAR fold (win ~5% / need ~24%) keeps confident wording, NO hedge", () => {
    const s = buildExplanation(
      priceGood({ equityPct: 5, potOddsPct: 24 }),
    ).toLowerCase();
    expect(s).not.toMatch(/close/);
    expect(s).toMatch(/don't have the odds/);
  });

  it("conceptual depth: borderline fold says break-even (no 'wins too rarely'), NO digits", () => {
    const s = buildExplanation(priceGood({ depth: "conceptual" }));
    expect(s).not.toMatch(/\d/);
    expect(s.toLowerCase()).toMatch(/about equal|break-even/);
    expect(s.toLowerCase()).not.toMatch(/too rarely/);
  });

  it("conceptual depth: a CLEAR fold keeps confident wording, NO hedge", () => {
    const s = buildExplanation(
      priceGood({ depth: "conceptual", equityPct: 5, potOddsPct: 24 }),
    );
    expect(s.toLowerCase()).not.toMatch(/close/);
  });
});

describe("narrateWinner (T19: winner's-perspective fold narration)", () => {
  it("narrates the winner with their made hand when the cards were shown", () => {
    const s = narrateWinner(
      {
        winners: [{ seat: 2, amount: 300 }],
        heroNet: -40,
        shown: [{ seat: 2, cards: ["Ah", "Ad"] }],
        endedAtShowdown: true,
      },
      ["Ac", "7d", "2s", "9h", "Kc"],
      { gtoClaim: false },
    );
    expect(s).toMatch(/seat 2 won/i);
    expect(s).toMatch(/three of a kind|trips|set/i); // via handCategoryLabel
    expect(s.toLowerCase()).not.toContain("baseline");
  });

  it("degrades gracefully when the winner mucked (no invented hand)", () => {
    const s = narrateWinner(
      {
        winners: [{ seat: 2, amount: 120 }],
        heroNet: -20,
        shown: [],
        endedAtShowdown: false,
      },
      [],
      { gtoClaim: false },
    );
    expect(s).toMatch(/took the pot|won the pot/i);
    expect(s).not.toMatch(/with (a |an )?(pair|flush|straight|two pair)/i);
  });

  it("only mentions a baseline when gtoClaim is true", () => {
    const noGto = narrateWinner(
      { winners: [{ seat: 3, amount: 60 }], heroNet: -10, shown: [], endedAtShowdown: false },
      [],
      { gtoClaim: false },
    );
    expect(noGto.toLowerCase()).not.toContain("baseline");

    const withGto = narrateWinner(
      { winners: [{ seat: 3, amount: 60 }], heroNet: -10, shown: [], endedAtShowdown: false },
      [],
      { gtoClaim: true },
    );
    expect(withGto.toLowerCase()).toContain("baseline");
  });
});

describe("valuecheck good copy doesn't undersell a near-coin-flip (iter-12 #6)", () => {
  const base = (equityPct: number): ExplainParams => ({
    kind: "valuecheck",
    verdict: "good",
    depth: "equity",
    unit: "usd",
    action: "check",
    potBefore: 24,
    toCall: 0,
    equityPct,
    potOddsPct: 0,
  });

  it("a ~44% check reads as roughly a coin-flip, not 'little to bet for'", () => {
    const s = buildExplanation(base(44));
    expect(s.toLowerCase()).toContain("coin-flip");
    expect(s.toLowerCase()).not.toContain("little to bet for");
  });

  it("a genuinely weak (~12%) check still reads 'little to bet for'", () => {
    const s = buildExplanation(base(12));
    expect(s.toLowerCase()).toContain("little to bet for");
  });
});

describe("EV-aware thin-bet copy (iter-16 #2)", () => {
  // A ⚠️ thin bet the EV table says is clearly worse than checking must NOT read "fine as value or a
  // semi-bluff" — say checking rates higher / it's marginal-to-slightly-losing.
  const thinBet = (ev?: { fold: number; call: number; raise: number }): ExplainParams => ({
    kind: "aggression",
    verdict: "thin",
    depth: "equity",
    unit: "usd",
    action: "bet",
    potBefore: 200,
    toCall: 0,
    equityPct: 42,
    potOddsPct: 0,
    ev,
  });

  it("equity depth: bet EV clearly below check says checking rates higher, NOT 'fine'", () => {
    // check $72 vs bet $43 — the reviewer's flop top-pair bet.
    const s = buildExplanation(thinBet({ fold: 0, call: 72, raise: 43 }));
    const lower = s.toLowerCase();
    expect(lower).toContain("checking rates higher");
    expect(lower).not.toContain("fine as value or a semi-bluff");
  });

  it("equity depth: a roughly EV-neutral thin bet keeps the 'fine' tone", () => {
    // check $44 vs bet $43 — within the noise margin.
    const s = buildExplanation(thinBet({ fold: 0, call: 44, raise: 43 }));
    const lower = s.toLowerCase();
    expect(lower).toContain("fine as value or a semi-bluff");
    expect(lower).not.toContain("checking rates higher");
  });

  it("equity depth: with no EV provided, the copy is unchanged (back-compat)", () => {
    const s = buildExplanation(thinBet(undefined));
    expect(s.toLowerCase()).toContain("fine as value or a semi-bluff");
  });

  it("conceptual depth: a clearly-worse thin bet does NOT call the line 'fine' (digit-free)", () => {
    const s = buildExplanation({ ...thinBet({ fold: 0, call: 72, raise: 43 }), depth: "conceptual" });
    const lower = s.toLowerCase();
    expect(lower).toContain("checking rates higher");
    expect(lower).not.toContain("fine as thin value");
    expect(s).not.toMatch(/\d/); // conceptual stays digit-free
  });

  it("conceptual depth: a roughly EV-neutral thin bet keeps the 'fine' tone (digit-free)", () => {
    const s = buildExplanation({ ...thinBet({ fold: 0, call: 44, raise: 43 }), depth: "conceptual" });
    expect(s.toLowerCase()).toContain("fine as thin value");
    expect(s).not.toMatch(/\d/);
  });
});

describe("positive-verdict EV reconciliation note (iter-16 #1)", () => {
  // A ✅ iso-raise whose displayed EV reads tied/slightly-below folding gets a reconciling note
  // (rough estimate + fold equity) so it doesn't read as an unreconciled contradiction.
  const isoRaise = (ev?: { fold: number; call: number; raise: number }): ExplainParams => ({
    kind: "isoraise",
    verdict: "good",
    depth: "equity",
    unit: "usd",
    action: "raise",
    potBefore: 7,
    toCall: 0,
    equityPct: 22,
    potOddsPct: 0,
    hand: ["Kd", "Js"],
    position: "CO",
    ev,
  });

  it("appends the noise + fold-equity note when the raise EV is slightly below folding", () => {
    // fold $0 / raise -$1 — the reviewer's repro.
    const s = buildExplanation(isoRaise({ fold: 0, call: 0, raise: -1 }));
    const lower = s.toLowerCase();
    expect(lower).toContain("rough equity-only estimate");
    expect(lower).toContain("fold equity");
    expect(lower).toContain("within the noise");
  });

  it("does NOT append the note when the raise EV is clearly the best (numbers already agree)", () => {
    const s = buildExplanation(isoRaise({ fold: 0, call: 0, raise: 12 }));
    expect(s.toLowerCase()).not.toContain("rough equity-only estimate");
  });

  it("does NOT append the note when the raise EV is far worse than folding (not hand-waved)", () => {
    const s = buildExplanation(isoRaise({ fold: 0, call: 0, raise: -20 }));
    expect(s.toLowerCase()).not.toContain("rough equity-only estimate");
  });

  it("does NOT append the note when no EV is provided (back-compat)", () => {
    const s = buildExplanation(isoRaise(undefined));
    expect(s.toLowerCase()).not.toContain("rough equity-only estimate");
  });
});

describe("iter-18 MINOR #1: borderline thin price-call reads ONE coherent break-even message", () => {
  // A genuinely borderline thin call (28% vs 29% need, EV ≈ 0): the headline must NOT be the upbeat
  // "just about worth it" that then clashes with the equity-bar's grim "you come up short" — it must
  // read as about break-even.
  const borderline = (depth: CoachingDepth): ExplainParams => ({
    kind: "price",
    verdict: "thin",
    depth,
    unit: "usd",
    action: "call",
    potBefore: 60,
    toCall: 24, // 24/84 ≈ 29% need
    equityPct: 28,
    potOddsPct: 28.6,
  });

  it("equity depth: says about break-even, not 'just about worth it'", () => {
    const s = buildExplanation(borderline("equity")).toLowerCase();
    expect(s).toContain("break-even");
    expect(s).toContain("roughly equal");
    expect(s).not.toContain("just about worth it");
  });

  it("conceptual depth: says about break-even, no upbeat-vs-grim split", () => {
    const s = buildExplanation(borderline("conceptual")).toLowerCase();
    expect(s).toContain("break-even");
    expect(s).not.toContain("just about worth continuing");
  });

  // iter-23 NIT: within the borderline band, distinguish which side of the price the CALL is on. A
  // thin call with equity at or ABOVE the price (edge ≥ 0) is a slightly +EV, comfortable continue at
  // a good price — it must NOT read "calling and folding are roughly equal" (which implies edge ≈ 0).
  // A thin call just BELOW the price (edge < 0) keeps the honest "about break-even / folding is fine"
  // wording. Both digit-free at Conceptual. Models the reviewer's cheap multiway 98o call (~5:1).
  describe("iter-23 NIT: cheap thin call ≥ its price reads 'comfortable at the price', below stays break-even", () => {
    // 30% equity, 28% need → edge +2 (within the ±3 band, but on the right side of the price).
    const pricedThinCall = (depth: CoachingDepth): ExplainParams => ({
      kind: "price",
      verdict: "thin",
      depth,
      unit: "usd",
      action: "call",
      potBefore: 50, // cheap close call: $10 to win a $60 pot → ~17% need… use explicit need below
      toCall: 10,
      equityPct: 30,
      potOddsPct: 28,
    });

    it("equity depth: edge ≥ 0 → 'getting the price / comfortable', NOT 'roughly equal'", () => {
      const s = buildExplanation(pricedThinCall("equity")).toLowerCase();
      expect(s).toContain("getting the price");
      expect(s).toContain("comfortable call");
      expect(s).not.toContain("roughly equal");
    });

    it("conceptual depth: edge ≥ 0 → digit-free 'comfortable at the price', no digits, NOT 'roughly equal'", () => {
      const s = buildExplanation(pricedThinCall("conceptual")).toLowerCase();
      expect(s).toContain("getting the price");
      expect(s).toContain("comfortable call");
      expect(s).not.toContain("roughly equal");
      expect(s).not.toMatch(/\d/); // no digits at Conceptual
    });

    it("a thin call just BELOW the price (edge < 0) still reads 'break-even / roughly equal'", () => {
      // 27% equity vs 29% need → edge −2 (borderline, wrong side). Unchanged from iter-18.
      const below = (depth: CoachingDepth): ExplainParams => ({
        kind: "price",
        verdict: "thin",
        depth,
        unit: "usd",
        action: "call",
        potBefore: 60,
        toCall: 24,
        equityPct: 27,
        potOddsPct: 29,
      });
      const eq = buildExplanation(below("equity")).toLowerCase();
      expect(eq).toContain("break-even");
      expect(eq).toContain("roughly equal");
      const con = buildExplanation(below("conceptual")).toLowerCase();
      expect(con).toContain("break-even");
      expect(con).toContain("roughly equal");
      expect(con).not.toMatch(/\d/);
    });
  });

  it("a CLEARLY thin call (not borderline) keeps the 'just about worth it' wording", () => {
    // 40% equity vs 25% need is well clear of the band — keep the confident thin wording.
    const s = buildExplanation({
      kind: "price",
      verdict: "thin",
      depth: "equity",
      unit: "usd",
      action: "call",
      potBefore: 12,
      toCall: 4,
      equityPct: 40,
      potOddsPct: 25,
    }).toLowerCase();
    expect(s).toContain("just about worth it");
  });
});

describe("iter-18 MAJOR: escalated made-hand value bet copy drops 'value bet' framing", () => {
  const madeHand = { category: 1, label: "top pair" };
  const escalated = (depth: CoachingDepth): ExplainParams => ({
    kind: "aggression",
    verdict: "mistake",
    depth,
    unit: "usd",
    action: "bet",
    potBefore: 12,
    toCall: 0,
    equityPct: 20,
    potOddsPct: 0,
    madeHand,
    ev: { fold: 0, call: 2.4, raise: -4.8 },
  });

  it("equity depth: names the made hand, says checking is clearly better and the bet loses money", () => {
    const s = buildExplanation(escalated("equity")).toLowerCase();
    expect(s).toContain("top pair");
    expect(s).toContain("checking is clearly better");
    expect(s).toContain("loses money");
    expect(s).not.toContain("this is a value bet");
    expect(s).not.toContain("thin, vulnerable");
  });

  it("conceptual depth: plain words, says checking was better and it loses money, no 'value bet'", () => {
    const s = buildExplanation(escalated("conceptual")).toLowerCase();
    expect(s).toContain("top pair");
    expect(s).toContain("checking was clearly better");
    expect(s).toContain("loses money");
    expect(s).not.toContain("this is a value");
  });
});
