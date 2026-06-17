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

  it("Equity+Heuristics leads with the odds/equity and still names the chart as the source", () => {
    const s = buildExplanation(spot("equity"));
    expect(s).toMatch(/\d+%/); // cites the win-rate
    expect(s.toLowerCase()).toMatch(/odds|equity/);
    expect(s.toLowerCase()).toMatch(/chart/); // honesty: the recommendation is still chart-based
    // equity word, when used, is defined inline (matches the T18 guard).
    if (/\bequity\b/i.test(s)) {
      expect(s).toMatch(/equity\b[^.]*\b(share of the pot|how often you win)/i);
    }
  });

  it("Strict leans on the chart/GTO citation", () => {
    const s = buildExplanation(spot("strict"));
    expect(s.toLowerCase()).toMatch(/baseline chart/);
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
