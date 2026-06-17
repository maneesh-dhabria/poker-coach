import { describe, it, expect } from "vitest";
import { decide, handStrength, BotParams, BotSpot } from "@/core/bots/botEngine";
import { createHand } from "@/core/engine/gameEngine";
import { mulberry32, Card } from "@/core/cards";

const c = (s: string) => s as Card;

const TAG: BotParams = {
  style: "TAG",
  skill: "Advanced",
  vpip: 0.24,
  aggression: 0.9, // crank up so value bets are deterministic in tests
  bluffFreq: 0,
  callStation: 0,
  raiseSizePct: 0.66,
  noise: 0,
};

describe("handStrength", () => {
  it("ranks a made flush above a bare high card", () => {
    const flush = handStrength(["Ah", "Kh"].map(c) as [Card, Card], ["Qh", "7h", "2h"].map(c));
    const air = handStrength(["Ah", "Kd"].map(c) as [Card, Card], ["Qs", "7c", "2d"].map(c));
    expect(flush).toBeGreaterThan(air);
  });
});

describe("decide — policy", () => {
  it("value-bets a strong hand when checked to", () => {
    const spot: BotSpot = {
      legal: { toAct: 1, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 100 },
      hole: ["Ah", "Kh"].map(c) as [Card, Card],
      board: ["Qh", "7h", "2h"].map(c), // made flush
      potBefore: 10,
    };
    const a = decide(spot, TAG, mulberry32(1));
    expect(a.type).toBe("bet");
    expect(a.amount).toBeGreaterThanOrEqual(2);
    expect(a.amount).toBeLessThanOrEqual(100);
  });

  it("folds air facing a bet (non-station)", () => {
    const spot: BotSpot = {
      legal: { toAct: 1, actions: ["fold", "call", "raise"], toCall: 8, minRaiseTo: 16, maxRaiseTo: 100 },
      hole: ["7c", "2d"].map(c) as [Card, Card],
      board: ["Qs", "9c", "4d"].map(c), // total air
      potBefore: 12,
    };
    const a = decide(spot, TAG, mulberry32(2));
    expect(a.type).toBe("fold");
  });

  it("only ever returns a legal action", () => {
    const spot: BotSpot = {
      legal: { toAct: 1, actions: ["fold", "call"], toCall: 50, minRaiseTo: 0, maxRaiseTo: 0 },
      hole: ["Ah", "Ad"].map(c) as [Card, Card],
      board: ["As", "Kd", "2c"].map(c),
      potBefore: 50,
    };
    const a = decide(spot, TAG, mulberry32(3));
    expect(["fold", "call"]).toContain(a.type);
  });
});

// iter-08 #3 — the loose station call-down is PRICE-AWARE: a station still calls NORMAL-sized bets
// loosely, but folds trash to a gross overbet (no real player peels a 2× overbet with air).
const STATION: BotParams = {
  style: "Calling Station",
  skill: "Beginner",
  vpip: 0.6,
  aggression: 0.1,
  bluffFreq: 0,
  callStation: 1, // maximally loose
  raiseSizePct: 0.5,
  noise: 0,
};

describe("decide — price-aware station (iter-08 #3)", () => {
  it("a max-station FOLDS trash facing a gross overbet (potOdds ≳0.8)", () => {
    // toCall 800 into a potBefore of 100 → potOdds = 800/900 ≈ 0.89 (a ~8× overbet).
    const spot: BotSpot = {
      legal: { toAct: 1, actions: ["fold", "call"], toCall: 800, minRaiseTo: 0, maxRaiseTo: 0 },
      hole: ["7c", "2d"].map(c) as [Card, Card],
      board: ["Qs", "9c", "4d"].map(c), // air
      potBefore: 100,
    };
    // Deterministic across many seeds — the random light call-down must be switched off at this price.
    for (let seed = 1; seed <= 50; seed++) {
      expect(decide(spot, STATION, mulberry32(seed)).type).toBe("fold");
    }
  });

  it("a max-station still CALLS weak hands loosely vs a normal ~half-pot bet (via the random peel)", () => {
    // toCall 5 into potBefore 10 → potOdds = 5/15 ≈ 0.33 (a half-pot bet). A WEAK hand (air) below the
    // value-call threshold: the only way it calls is the station's loose random call-down — so this
    // proves the peel still fires at a normal price (station flavor preserved, not turned into a nit).
    const spot: BotSpot = {
      legal: { toAct: 1, actions: ["fold", "call"], toCall: 5, minRaiseTo: 0, maxRaiseTo: 0 },
      hole: ["7c", "2d"].map(c) as [Card, Card],
      board: ["Qs", "9c", "4d"].map(c), // air — strength below the value-call threshold
      potBefore: 10,
    };
    let calls = 0;
    for (let seed = 1; seed <= 50; seed++) {
      if (decide(spot, STATION, mulberry32(seed)).type === "call") calls++;
    }
    // Loose peel must fire at least sometimes at a normal price (full slack, price below the cap).
    expect(calls).toBeGreaterThan(0);
  });
});

describe("fuzz — bots never produce an illegal action", () => {
  it("plays 500 full hands through the engine with no illegal action", () => {
    const persona: BotParams = {
      style: "LAG",
      skill: "Intermediate",
      vpip: 0.4,
      aggression: 0.5,
      bluffFreq: 0.25,
      callStation: 0.3,
      raiseSizePct: 0.75,
      noise: 0.2,
    };
    for (let seed = 0; seed < 500; seed++) {
      const rng = mulberry32(seed + 1);
      const h = createHand({
        config: { smallBlind: 1, bigBlind: 2 },
        seats: [
          { seat: 0, stack: 100 },
          { seat: 1, stack: 100 },
          { seat: 2, stack: 100 },
        ],
        buttonIndex: seed % 3,
        rng,
      });
      let guard = 0;
      while (!h.isHandOver() && guard++ < 200) {
        const legal = h.legalActions();
        if (legal.toAct < 0) break;
        const action = decide(
          { legal, hole: h.holeOf(legal.toAct), board: h.board, potBefore: h.pot() },
          persona,
          rng,
        );
        // apply throws on any illegal action — that would fail the test.
        h.apply(action);
      }
      expect(h.isHandOver()).toBe(true);
    }
  });
});
