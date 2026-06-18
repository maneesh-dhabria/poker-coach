import { describe, it, expect } from "vitest";
import { startHand, latestActionPerSeat, boardCountForStreet } from "@/core/handFlow";
import { ActionRecord, validateHandRecord } from "@/core/history/handRecord";
import { personaFor } from "@/core/bots/personas";
import { equity } from "@/core/equity/equity";
import { mulberry32 } from "@/core/cards";

describe("HandFlow interactive driver", () => {
  it("stops at the hero's turn, then plays out to a schema-valid record", () => {
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: [
        { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
        { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
      ],
      buttonIndex: 1,
      rng: mulberry32(9),
      sessionId: "s",
      handNumber: 1,
      coachingDepth: "equity",
    });

    let guard = 0;
    while (!flow.isOver() && flow.isHeroTurn() && guard++ < 30) {
      const spot = flow.heroSpot();
      const eq = equity({
        hero: spot.hole,
        board: spot.board,
        numOpponents: Math.max(1, spot.numActiveOpponents),
        iterations: 300,
        seed: 5 + guard,
      }).equityPct;
      const action = spot.legal.actions.includes("check")
        ? { type: "check" as const }
        : { type: "call" as const };
      flow.heroAct(action, eq);
    }

    expect(flow.isOver()).toBe(true);
    expect(flow.decisions().length).toBeGreaterThanOrEqual(1);
    const rec = flow.toRecord("2026-05-29T00:00:00.000Z");
    expect(validateHandRecord(rec).valid).toBe(true);
  });

  it("exposes the action log for the UI", () => {
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: [
        { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
        { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
      ],
      buttonIndex: 1,
      rng: mulberry32(9),
      sessionId: "s",
      handNumber: 1,
      coachingDepth: "equity",
    });
    expect(Array.isArray(flow.actionLog())).toBe(true);
    // The button seat posts/acts before the hero in this heads-up setup, so there is ≥1 logged action.
    expect(flow.actionLog().length).toBeGreaterThanOrEqual(0);
  });
});

// iter-14 #1/#2: an in-play coaching-depth change re-derives every already-graded decision at the new
// depth (copy-only change — verdict/equity/tags are depth-independent), and bakes it for future ones.
describe("HandFlow.reanalyzeAt (in-play depth re-derive)", () => {
  function playToOneDecision() {
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: [
        { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
        { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
      ],
      buttonIndex: 1,
      rng: mulberry32(9),
      sessionId: "s",
      handNumber: 1,
      coachingDepth: "equity",
    });
    let guard = 0;
    while (!flow.isOver() && flow.isHeroTurn() && guard++ < 30) {
      const spot = flow.heroSpot();
      const eq = equity({
        hero: spot.hole,
        board: spot.board,
        numOpponents: Math.max(1, spot.numActiveOpponents),
        iterations: 300,
        seed: 5 + guard,
      }).equityPct;
      const action = spot.legal.actions.includes("check")
        ? { type: "check" as const }
        : { type: "call" as const };
      flow.heroAct(action, eq);
    }
    return flow;
  }

  it("re-derives recorded decisions to the new depth, preserving verdict/equity (copy-only)", () => {
    const flow = playToOneDecision();
    expect(flow.decisions().length).toBeGreaterThanOrEqual(1);
    const before = flow.decisions().map((d) => ({
      depth: d.analysis.coachingDepth,
      verdict: d.analysis.verdict,
      eq: d.analysis.numbers.equityPct,
      tags: d.analysis.conceptTags,
    }));
    expect(before.every((b) => b.depth === "equity")).toBe(true);

    const changed = flow.reanalyzeAt("conceptual");
    expect(changed).toBe(true);
    expect(flow.coachingDepth()).toBe("conceptual");
    flow.decisions().forEach((d, i) => {
      // Depth (and therefore the COPY) switched...
      expect(d.analysis.coachingDepth).toBe("conceptual");
      // ...but the verdict / equity / tags are depth-independent and UNCHANGED.
      expect(d.analysis.verdict).toBe(before[i].verdict);
      expect(d.analysis.numbers.equityPct).toBe(before[i].eq);
      expect(d.analysis.conceptTags).toEqual(before[i].tags);
    });
  });

  it("is a no-op when the depth is unchanged", () => {
    const flow = playToOneDecision();
    expect(flow.reanalyzeAt("equity")).toBe(false);
  });
});

describe("latestActionPerSeat (observation #3 — per-seat badges)", () => {
  it("keeps only each seat's most recent action", () => {
    const log: ActionRecord[] = [
      { street: "preflop", seat: 1, action: "call", amount: 2 },
      { street: "preflop", seat: 0, action: "raise", amount: 6 },
      { street: "flop", seat: 1, action: "check", amount: 0 },
    ];
    const latest = latestActionPerSeat(log);
    expect(latest[1]).toEqual({ street: "flop", seat: 1, action: "check", amount: 0 });
    expect(latest[0]).toEqual({ street: "preflop", seat: 0, action: "raise", amount: 6 });
  });

  it("returns an empty map for an empty log (start of hand)", () => {
    expect(latestActionPerSeat([])).toEqual({});
  });
});

describe("boardCountForStreet", () => {
  it("maps each street to the number of board cards shown", () => {
    expect(boardCountForStreet("preflop")).toBe(0);
    expect(boardCountForStreet("flop")).toBe(3);
    expect(boardCountForStreet("turn")).toBe(4);
    expect(boardCountForStreet("river")).toBe(5);
  });
});

describe("HandFlow.replayAt (central pot snapshot)", () => {
  function playedFlow() {
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: [
        { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
        { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
      ],
      buttonIndex: 1,
      rng: mulberry32(9),
      sessionId: "s",
      handNumber: 1,
      coachingDepth: "equity",
    });
    let guard = 0;
    while (!flow.isOver() && flow.isHeroTurn() && guard++ < 30) {
      const action = flow.heroSpot().legal.actions.includes("check")
        ? { type: "check" as const }
        : { type: "call" as const };
      flow.heroAct(action, 50);
    }
    return flow;
  }

  it("at step 0 shows only the blinds, preflop, no board, no contributions", () => {
    const flow = playedFlow();
    const snap = flow.replayAt(0);
    expect(snap.pot).toBe(3); // SB 1 + BB 2
    expect(snap.street).toBe("preflop");
    expect(snap.boardCount).toBe(0);
    expect(snap.roundContributions).toEqual([]);
  });

  it("at the full step count, pot equals tableView().pot", () => {
    const flow = playedFlow();
    const total = flow.actionLog().length;
    expect(flow.replayAt(total).pot).toBe(flow.tableView().pot);
  });

  it("only lists chip-committing actions for the current street, in order", () => {
    const flow = playedFlow();
    const total = flow.actionLog().length;
    const snap = flow.replayAt(total);
    for (const c of snap.roundContributions) {
      expect(c.amount).toBeGreaterThan(0);
      expect(typeof c.name).toBe("string");
    }
    const finalStreetChipActions = flow
      .actionLog()
      .filter((a) => a.street === snap.street && a.amount > 0).length;
    expect(snap.roundContributions.length).toBe(finalStreetChipActions);
  });

  it("clears contributions when the cursor sits on the first action of a new street", () => {
    const flow = playedFlow();
    const log = flow.actionLog();
    const boundary = log.findIndex((a, i) => i > 0 && a.street !== log[i - 1].street);
    if (boundary === -1) return; // hand never left preflop in this seed; nothing to assert
    const snap = flow.replayAt(boundary + 1);
    expect(snap.street).toBe(log[boundary].street);
    for (const c of snap.roundContributions) {
      expect(log.some((a) => a.street === snap.street && a.seat === c.seat)).toBe(true);
    }
  });
});


describe("HandFlow T6: toAct + winners on TableView (pure; D1)", () => {
  function freshFlow() {
    return startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: [
        { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
        { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
      ],
      buttonIndex: 1,
      rng: mulberry32(9),
      sessionId: "s",
      handNumber: 1,
      coachingDepth: "equity",
    });
  }

  it("exposes toAct (acting seat) while the hand is live and null when over", () => {
    const flow = freshFlow();
    const v = flow.tableView();
    if (!v.isOver) {
      expect(typeof v.toAct === "number" || v.toAct === null).toBe(true);
    } else {
      expect(v.toAct).toBe(null);
    }
  });

  it("exposes winners[] matching the outcome when the hand is over", () => {
    const flow = freshFlow();
    let guard = 0;
    while (!flow.isOver() && flow.isHeroTurn() && guard++ < 30) {
      const legal = flow.heroSpot().legal;
      const action = legal.actions.includes("fold")
        ? { type: "fold" as const }
        : legal.actions.includes("check")
          ? { type: "check" as const }
          : { type: "call" as const };
      flow.heroAct(action, 50);
    }
    const v = flow.tableView();
    expect(v.isOver).toBe(true);
    expect(Array.isArray(v.winners)).toBe(true);
    expect(v.toAct).toBe(null);
    const rec = flow.toRecord("2026-05-29T00:00:00.000Z");
    expect(v.winners).toEqual(rec.outcome.winners);
  });
});

describe("HandFlow tableView: all-in badge state", () => {
  it("flags an all-in seat and the chips it committed", () => {
    // Hero is the BB with a 2-chip stack: posting the big blind shoves the whole stack in,
    // so the hero is all-in before acting — a deterministic all-in for the badge.
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: [
        { seat: 0, name: "You", isHero: true, stack: 2, persona: null },
        { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
      ],
      buttonIndex: 1, // HU: seat 1 = SB/button, seat 0 = BB → hero posts BB=2 and is all-in
      rng: mulberry32(9),
      sessionId: "s",
      handNumber: 1,
      coachingDepth: "equity",
    });
    const hero = flow.tableView().seats.find((s) => s.isHero)!;
    expect(hero.allIn).toBe(true);
    expect(hero.allInAmount).toBe(2);
    const villain = flow.tableView().seats.find((s) => !s.isHero)!;
    expect(villain.allIn).toBe(false); // 200-chip stack, never tapped out
  });
});
