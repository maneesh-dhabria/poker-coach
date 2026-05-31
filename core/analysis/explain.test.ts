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
