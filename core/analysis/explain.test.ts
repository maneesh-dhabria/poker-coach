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
