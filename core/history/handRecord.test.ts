import { describe, it, expect } from "vitest";
import {
  buildHandRecord,
  validateHandRecord,
  HANDRECORD_SCHEMA_VERSION,
  BuildHandRecordInput,
} from "@/core/history/handRecord";
import { analyze } from "@/core/analysis/analyze";
import { Card } from "@/core/cards";

const c = (s: string) => s as Card;

function scriptedInput(): BuildHandRecordInput {
  const analysis = analyze({
    action: "call",
    potBefore: 11,
    toCall: 4,
    equityPct: 46,
    unit: "usd",
    assumedRange: "typical BTN open (~45% of hands)",
  });
  return {
    sessionId: "20260529-141233-ab12",
    handNumber: 7,
    playedAt: "2026-05-29T14:14:02.001Z",
    config: { numPlayers: 2, smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
    heroSeat: 0,
    seats: [
      { seat: 0, name: "You", isHero: true, startingStack: 200, position: "BB", persona: null },
      {
        seat: 3,
        name: "Mia",
        isHero: false,
        startingStack: 200,
        position: "BTN",
        persona: { style: "TAG", skill: "Advanced" },
      },
    ],
    heroHole: ["Ac", "Jh"].map(c),
    board: ["As", "7h", "2c", "Kd", "9c"].map(c),
    actions: [
      { street: "preflop", seat: 3, action: "raise", amount: 6 },
      { street: "preflop", seat: 0, action: "call", amount: 4 },
    ],
    heroDecisions: [
      {
        decisionId: "h7-d1",
        street: "preflop",
        spot: {
          potBefore: 9,
          toCall: 4,
          position: "BB",
          stackBb: 48,
          numActiveOpponents: 1,
          facing: "raise",
        },
        heroAction: { action: "call", amount: 4 },
        analysis,
      },
    ],
    outcome: {
      winners: [{ seat: 0, amount: 23 }],
      heroNet: 23,
      shown: [{ seat: 3, cards: ["Ks", "Qs"].map(c) }],
      endedAtShowdown: true,
    },
  };
}

describe("buildHandRecord", () => {
  it("assembles a record with schemaVersion, hero analysis, and outcome", () => {
    const rec = buildHandRecord(scriptedInput());
    expect(rec.schemaVersion).toBe(HANDRECORD_SCHEMA_VERSION);
    expect(rec.handId).toBe("20260529-141233-ab12_h7");
    expect(rec.heroDecisions[0].analysis.verdict).toBe("good");
    expect(rec.outcome.heroNet).toBe(23);
  });

  it("round-trips through JSON unchanged", () => {
    const rec = buildHandRecord(scriptedInput());
    const back = JSON.parse(JSON.stringify(rec));
    expect(back).toEqual(rec);
  });
});

describe("validateHandRecord", () => {
  it("accepts a well-formed record", () => {
    const rec = buildHandRecord(scriptedInput());
    const res = validateHandRecord(rec);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("rejects a record missing a required key", () => {
    const rec = buildHandRecord(scriptedInput()) as unknown as Record<string, unknown>;
    delete rec.outcome;
    const res = validateHandRecord(rec);
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toContain("outcome");
  });

  it("rejects a record with a wrong-typed field", () => {
    const rec = buildHandRecord(scriptedInput()) as unknown as { handNumber: unknown };
    rec.handNumber = "seven";
    const res = validateHandRecord(rec);
    expect(res.valid).toBe(false);
  });
});
