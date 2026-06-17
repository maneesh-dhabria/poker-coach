import { describe, it, expect } from "vitest";
import {
  detectTaint,
  detectMadeHand,
  buildMentalEstimate,
  conclusionFrom,
  gapExplanation,
  trueWinExceedsOuts,
} from "@/core/mental/estimate";
import { MentalInput } from "@/core/mental/types";
import { Card } from "@/core/cards";

const h = (cards: string[]) => cards.map((s) => s as Card);
const hole = (a: string, b: string) => [a as Card, b as Card] as [Card, Card];

const base: Omit<MentalInput, "hole" | "board" | "street"> = {
  potBefore: 60,
  toCall: 20,
  numActiveOpponents: 1,
};

describe("detectTaint", () => {
  it("flags a two-tone board the hero is not drawing on", () => {
    const t = detectTaint(hole("8s", "3d"), h(["Kh", "7h", "2c"]));
    expect(t.twoTone).toBe(true);
    expect(t.notes.length).toBeGreaterThan(0);
  });

  it("flags a paired board", () => {
    const t = detectTaint(hole("8d", "3c"), h(["Kh", "Ks", "2c"]));
    expect(t.paired).toBe(true);
  });

  it("flags a connected (3-to-a-straight) board", () => {
    const t = detectTaint(hole("Ks", "Qd"), h(["9h", "8c", "7d"]));
    expect(t.connected).toBe(true);
  });

  it("flags a non-nut hero flush draw", () => {
    const t = detectTaint(hole("Qh", "Jh"), h(["Kh", "7h", "2c"]));
    expect(t.heroFlushNotNut).toBe(true);
  });

  it("flags a low-end (idiot-end) straight draw", () => {
    const t = detectTaint(hole("5d", "4d"), h(["6s", "7h", "2c"]));
    expect(t.heroLowEndStraight).toBe(true);
  });

  it("is all-clear on a dry rainbow board", () => {
    const t = detectTaint(hole("Ad", "Qc"), h(["Ks", "7h", "2c"]));
    expect(t.twoTone).toBe(false);
    expect(t.paired).toBe(false);
    expect(t.connected).toBe(false);
    expect(t.heroFlushNotNut).toBe(false);
    expect(t.heroLowEndStraight).toBe(false);
    expect(t.notes).toHaveLength(0);
  });
});

describe("buildMentalEstimate — status routing", () => {
  it("no-hand when there is no hero hand", () => {
    const e = buildMentalEstimate({ ...base, hole: null, board: h(["Kh", "7h", "2c"]), street: "flop" });
    expect(e.status).toBe("no-hand");
  });
  it("no-hand when fewer than 3 board cards on a post-flop street", () => {
    const e = buildMentalEstimate({ ...base, hole: hole("Qh", "Jh"), board: h(["Th", "9c"]), street: "flop" });
    expect(e.status).toBe("no-hand");
  });
  it("preflop on the preflop street with a board", () => {
    const e = buildMentalEstimate({ ...base, hole: hole("Qh", "Jh"), board: h(["Kh", "7h", "2c"]), street: "preflop" });
    expect(e.status).toBe("preflop");
  });
  it("river on the river street", () => {
    const e = buildMentalEstimate({ ...base, hole: hole("Qh", "Jh"), board: h(["Th", "9c", "2h", "3s", "4d"]), street: "river" });
    expect(e.status).toBe("river");
    expect(e.potOdds?.breakEvenPct).toBe(25);
  });
  it("no-draw when there are zero outs on a flop", () => {
    const e = buildMentalEstimate({ ...base, hole: hole("6h", "5h"), board: h(["Kh", "9c", "2d"]), street: "flop" });
    expect(e.status).toBe("no-draw");
    expect(e.potOdds?.breakEvenPct).toBe(25);
  });
});

describe("buildMentalEstimate — pot odds & decision", () => {
  const okFlop = (over: Partial<MentalInput> = {}): MentalInput => ({
    ...base,
    hole: hole("Qh", "Jh"),
    board: h(["Th", "9c", "2h"]),
    street: "flop",
    ...over,
  });

  it("computes the break-even price (call 20 into 60 → 25%)", () => {
    const e = buildMentalEstimate(okFlop());
    expect(e.potOdds?.breakEvenPct).toBe(25);
    expect(e.potOdds?.potAfterCall).toBe(80);
  });

  it("a strong draw beating the price is profitable", () => {
    const e = buildMentalEstimate(okFlop());
    expect(e.decision?.profitable).toBe(true);
  });

  it("a tiny draw facing a big price is steep (not profitable)", () => {
    // Bare gutshot (4 outs) facing an 80-into-20 overbet → break-even 80%.
    const e = buildMentalEstimate({
      ...base,
      hole: hole("Jd", "9c"),
      board: h(["8s", "7h", "2d"]),
      street: "flop",
      potBefore: 20,
      toCall: 80,
    });
    expect(e.decision?.profitable).toBe(false);
  });

  it("a free card (toCall 0) yields free-card copy", () => {
    const e = buildMentalEstimate(okFlop({ toCall: 0 }));
    expect(e.potOdds?.breakEvenPct).toBe(0);
    expect(e.decision?.sentence.toLowerCase()).toContain("free");
  });
});

describe("buildMentalEstimate — opponent shade", () => {
  const okFlop = (numActiveOpponents: number): MentalInput => ({
    ...base,
    numActiveOpponents,
    hole: hole("Qh", "Jh"),
    board: h(["Th", "9c", "2h"]),
    street: "flop",
  });

  it("heads-up does not shave (low === high === hit)", () => {
    const e = buildMentalEstimate(okFlop(1));
    expect(e.ruleHitPct).toBe(60);
    expect(e.opponentShade?.lowPct).toBe(60);
    expect(e.opponentShade?.highPct).toBe(60);
  });

  it("3-way shaves to ~0.8–0.9× the hit estimate", () => {
    const e = buildMentalEstimate(okFlop(2));
    expect(e.opponentShade?.lowPct).toBe(48);
    expect(e.opponentShade?.highPct).toBe(54);
  });

  it("4+ way shaves further", () => {
    const e = buildMentalEstimate(okFlop(3));
    expect(e.opponentShade!.lowPct).toBeLessThan(48);
  });
});

describe("detectMadeHand", () => {
  it("detects top pair (A2 on 4A3) — the finding-#1 spot", () => {
    const m = detectMadeHand(hole("Ah", "2h"), h(["4h", "Ac", "3d"]));
    expect(m).not.toBeNull();
    expect(m!.label).toBe("top pair");
  });

  it("detects two pair (A2 on 4A34 turn)", () => {
    const m = detectMadeHand(hole("Ah", "2h"), h(["4h", "Ac", "3d", "4d"]));
    expect(m!.label).toBe("two pair");
  });

  it("returns null when the hero only has a draw / high card", () => {
    expect(detectMadeHand(hole("Qh", "Jh"), h(["Th", "9c", "2h"]))).toBeNull();
  });

  // iter-07 #2a: hole-card participation. A board-only pair/hand is NOT the hero's made hand.
  it("returns null for J-high on a paired board (playing the board, no hole contribution)", () => {
    // 6♠ J♥ on 8♦ 8♣ Q♦ — the board pairs the 8s; the hero only has J-high.
    expect(detectMadeHand(hole("6s", "Jh"), h(["8d", "8c", "Qd"]))).toBeNull();
  });

  it("returns null when the board makes trips the hero doesn't improve", () => {
    // 6♠ J♥ on 8♦ 8♣ 8s — board trips; hero contributes nothing.
    expect(detectMadeHand(hole("6s", "Jh"), h(["8d", "8c", "8s"]))).toBeNull();
  });

  it("detects top pair when a hole card pairs the board", () => {
    const m = detectMadeHand(hole("Qh", "5c"), h(["Qd", "8c", "2s"]));
    expect(m!.label).toBe("top pair");
  });

  it("detects a pocket pair under the board (hole pair, no board pair)", () => {
    // 7♠ 7♥ on K♦ 9♣ 2s — under the board but still a real made pair of the hero's own.
    const m = detectMadeHand(hole("7s", "7h"), h(["Kd", "9c", "2s"]));
    expect(m).not.toBeNull();
    expect(m!.label).toBe("a pair");
  });

  it("detects a real two pair that uses a hole card", () => {
    // K♠ 9♥ on K♦ 9♣ 2s — both pairs use a hole card.
    const m = detectMadeHand(hole("Ks", "9h"), h(["Kd", "9c", "2s"]));
    expect(m!.label).toBe("two pair");
  });
});

describe("made-hand reconciliation (findings #1/#2/#3)", () => {
  // Top pair + gutshot: A2 on 4A3. The outs count sees only the gutshot (4 outs), but the hero
  // already has top pair. The walk-through must NOT conclude "fold / price too steep".
  const topPairGutshot: MentalInput = {
    ...base,
    hole: hole("Ah", "2h"),
    board: h(["4h", "Ac", "3d"]),
    street: "flop",
    potBefore: 32,
    toCall: 12,
  };

  it("(a) a made-hand spot does NOT produce a fold/price-too-steep conclusion", () => {
    const e = buildMentalEstimate(topPairGutshot);
    expect(e.madeHand?.label).toBe("top pair");
    // The sync decision must not steer a fold on the outs alone.
    expect(e.decision?.profitable).toBe(true);
    expect(e.decision?.sentence.toLowerCase()).not.toContain("too steep");
    expect(e.plainSummary.toLowerCase()).toContain("top pair");
  });

  it("(a') the true-equity conclusion calls it profitable, never a fold, at ~47% equity", () => {
    const c = conclusionFrom({
      trueWinPct: 47,
      breakEvenPct: 27,
      toCall: 12,
      madeHand: { category: 1, label: "top pair" },
    });
    expect(c.profitable).toBe(true);
    expect(c.sentence.toLowerCase()).toContain("profitable");
    expect(c.sentence.toLowerCase()).not.toContain("too steep");
  });

  it("(turn) a free check with a made hand does not say 'just take it' as the only message", () => {
    // Two pair on the turn, checked to (toCall 0). Mental math must mention being ahead, not a
    // pure outs-driven free card (which the engine then grades as a missed value bet).
    const e = buildMentalEstimate({
      ...base,
      hole: hole("Ah", "2h"),
      board: h(["4h", "Ac", "3d", "4d"]),
      street: "turn",
      toCall: 0,
    });
    expect(e.madeHand?.label).toBe("two pair");
    const c = conclusionFrom({ trueWinPct: 66, breakEvenPct: 0, toCall: 0, madeHand: e.madeHand });
    expect(c.sentence.toLowerCase()).toContain("value");
  });

  it("(iter-07 #2b) a free check with a made hand at LOW equity is called marginal, not 'ahead'", () => {
    const c = conclusionFrom({ trueWinPct: 35, breakEvenPct: 0, toCall: 0, madeHand: { category: 1, label: "top pair" } });
    expect(c.sentence.toLowerCase()).not.toContain("ahead");
    expect(c.sentence.toLowerCase()).toContain("marginal");
    expect(c.sentence).toContain("35%");
  });

  it("(b) the gap explanation DIFFERS between a pure-draw spot and a made-hand spot", () => {
    const madeGap = gapExplanation({
      exactHitPct: 16,
      trueWinPct: 47,
      madeHand: { category: 1, label: "top pair" },
    });
    const drawGap = gapExplanation({ exactHitPct: 54, trueWinPct: 51, madeHand: null });
    expect(madeGap).not.toBe(drawGap);
    expect(madeGap.toLowerCase()).toContain("top pair");
    expect(madeGap.toLowerCase()).not.toContain("opponents + board danger");
    expect(drawGap.toLowerCase()).toContain("opponents + board danger");
  });

  it("trueWinExceedsOuts flags the made-hand gap but not a pure draw", () => {
    const made = buildMentalEstimate(topPairGutshot);
    expect(trueWinExceedsOuts(made, 47)).toBe(true);
    const draw = buildMentalEstimate({
      ...base,
      hole: hole("Qh", "Jh"),
      board: h(["Th", "9c", "2h"]),
      street: "flop",
    });
    expect(trueWinExceedsOuts(draw, 51)).toBe(false);
  });
});

describe("buildMentalEstimate — override and worked example", () => {
  it("an outs override drives the hit math but leaves groups visible", () => {
    const input: MentalInput = {
      ...base,
      hole: hole("Qh", "Jh"),
      board: h(["Th", "9c", "2h"]),
      street: "flop",
      outsOverride: 6,
    };
    const e = buildMentalEstimate(input);
    expect(e.ruleHitPct).toBe(24); // 6 × 4
    expect(e.outs?.groups.some((g) => g.kind === "flush")).toBe(true); // detected groups still shown
  });

  it("matches the guide's Q♥J♥ worked example on the flop and turn", () => {
    const flop = buildMentalEstimate({ ...base, hole: hole("Qh", "Jh"), board: h(["Th", "9c", "2h"]), street: "flop" });
    expect(flop.outs?.totalOuts).toBe(15);
    expect(flop.ruleHitPct).toBe(60);
    expect(flop.exactHitPct).toBeCloseTo(54.1, 1);
    expect(flop.bigDrawCaveat).toBe(true);

    const turn = buildMentalEstimate({ ...base, hole: hole("Qh", "Jh"), board: h(["Th", "9c", "2h", "3s"]), street: "turn" });
    expect(turn.outs?.totalOuts).toBe(15);
    expect(turn.ruleHitPct).toBe(30); // 15 × 2
    expect(turn.bigDrawCaveat).toBe(false);
  });
});
