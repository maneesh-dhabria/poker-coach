import { describe, it, expect } from "vitest";
import { playHand, PlaySeat } from "@/core/playHand";
import { validateHandRecord } from "@/core/history/handRecord";
import { personaFor } from "@/core/bots/personas";
import { mulberry32 } from "@/core/cards";
import {
  emptyProcessed,
  isReviewed,
  markReviewed,
  unreviewed,
} from "@/core/history/processed";

function heroSeats(): PlaySeat[] {
  return [
    { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
    { seat: 1, name: "Mia", isHero: false, stack: 200, persona: personaFor("TAG", "Advanced") },
    { seat: 2, name: "Ravi", isHero: false, stack: 200, persona: personaFor("LAG", "Intermediate") },
  ];
}

describe("playHand", () => {
  it("plays a seeded full hand and emits a schema-valid HandRecord", () => {
    const rec = playHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: heroSeats(),
      buttonIndex: 0,
      rng: mulberry32(123),
      sessionId: "20260529-000000-test",
      handNumber: 1,
      playedAt: "2026-05-29T00:00:00.000Z",
      // Hero plays a calling-station line so the hand reaches further streets.
      heroAct: ({ legal }) => {
        if (legal.actions.includes("check")) return { type: "check" };
        if (legal.actions.includes("call")) return { type: "call" };
        return { type: "fold" };
      },
      equityIterations: 400,
    });

    const res = validateHandRecord(rec);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("records an analysis for every hero decision", () => {
    const rec = playHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: heroSeats(),
      buttonIndex: 0,
      rng: mulberry32(7),
      sessionId: "s",
      handNumber: 3,
      playedAt: "2026-05-29T00:00:00.000Z",
      heroAct: ({ legal }) =>
        legal.actions.includes("check")
          ? { type: "check" }
          : legal.actions.includes("call")
            ? { type: "call" }
            : { type: "fold" },
      equityIterations: 300,
    });

    expect(rec.heroDecisions.length).toBeGreaterThanOrEqual(1);
    for (const d of rec.heroDecisions) {
      expect(["good", "thin", "mistake"]).toContain(d.analysis.verdict);
      expect(typeof d.analysis.plainExplanation).toBe("string");
    }
    expect(rec.handId).toBe("s_h3");
  });

  it("is deterministic for a given seed", () => {
    const args = {
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: heroSeats(),
      buttonIndex: 1,
      sessionId: "s",
      handNumber: 1,
      playedAt: "2026-05-29T00:00:00.000Z",
      heroAct: ({ legal }: { legal: { actions: string[] } }) =>
        legal.actions.includes("check") ? { type: "check" as const } : { type: "fold" as const },
      equityIterations: 200,
    };
    const a = playHand({ ...args, rng: mulberry32(55) });
    const b = playHand({ ...args, rng: mulberry32(55) });
    expect(a.outcome.heroNet).toBe(b.outcome.heroNet);
    expect(a.actions.length).toBe(b.actions.length);
  });
});

describe("processed marker", () => {
  it("marks and detects reviewed hands; lists unreviewed", () => {
    let m = emptyProcessed();
    expect(isReviewed(m, "s_h1")).toBe(false);
    m = markReviewed(m, "s_h1", "2026-05-29T01:00:00Z");
    expect(isReviewed(m, "s_h1")).toBe(true);
    expect(unreviewed(m, ["s_h1", "s_h2", "s_h3"])).toEqual(["s_h2", "s_h3"]);
  });
});
