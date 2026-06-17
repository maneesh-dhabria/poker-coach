import { describe, it, expect } from "vitest";
import { createHand } from "@/core/engine/gameEngine";
import { mulberry32, Card } from "@/core/cards";

const c = (s: string) => s as Card;

describe("createHand — heads-up setup", () => {
  it("posts blinds and gives the button/SB first action preflop", () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(1),
    });
    // HU: button (seat 0) is SB and acts first preflop.
    const la = h.legalActions();
    expect(la.toAct).toBe(0);
    expect(la.toCall).toBe(1); // SB has 1 in, needs 1 more to match the BB
    expect(la.actions).toContain("call");
    expect(la.actions).toContain("raise");
    expect(la.actions).toContain("fold");
    expect(h.street).toBe("preflop");
  });

  it("deals two hole cards to each seat", () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(2),
    });
    expect(h.holeOf(0)).toHaveLength(2);
    expect(h.holeOf(1)).toHaveLength(2);
  });
});

describe("betting rounds advance preflop → river", () => {
  it("checks/calls down to a showdown across all four streets", () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(3),
    });
    // Preflop: SB completes, BB checks option.
    expect(h.street).toBe("preflop");
    h.apply({ type: "call" }); // SB calls to 2
    h.apply({ type: "check" }); // BB checks option
    expect(h.street).toBe("flop");
    expect(h.board).toHaveLength(3);

    h.apply({ type: "check" });
    h.apply({ type: "check" });
    expect(h.street).toBe("turn");
    expect(h.board).toHaveLength(4);

    h.apply({ type: "check" });
    h.apply({ type: "check" });
    expect(h.street).toBe("river");
    expect(h.board).toHaveLength(5);

    h.apply({ type: "check" });
    h.apply({ type: "check" });
    expect(h.isHandOver()).toBe(true);
    expect(h.result().endedAtShowdown).toBe(true);
  });

  it("a fold ends the hand and awards the pot to the last player", () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(4),
    });
    h.apply({ type: "fold" }); // SB folds preflop
    expect(h.isHandOver()).toBe(true);
    const r = h.result();
    expect(r.endedAtShowdown).toBe(false);
    expect(r.winners).toEqual([{ seat: 1, amount: 3 }]); // BB wins SB's 1 + own 2
    expect(r.net[0]).toBe(-1);
    expect(r.net[1]).toBe(1);
  });
});

describe("legal-action sizing bounds", () => {
  it("a raise must be at least a full raise and at most all-in", () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(5),
    });
    const la = h.legalActions();
    expect(la.minRaiseTo).toBe(4); // currentBet 2 + last raise size 2
    expect(la.maxRaiseTo).toBe(100); // SB's 1 already in + 99 left = all-in to 100
  });
});

describe("result awards with side pots at showdown", () => {
  it("awards the main pot to the best hand among eligible seats", () => {
    // Force hole cards + board so seat 0 makes a flush and wins.
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(6),
      holeOverride: { 0: ["Ah", "Kh"].map(c) as [Card, Card], 1: ["2c", "7d"].map(c) as [Card, Card] },
      boardOverride: ["Qh", "Jh", "3h", "4s", "9c"].map(c),
    });
    h.apply({ type: "call" }); // SB completes
    h.apply({ type: "check" }); // BB checks
    // check down
    h.apply({ type: "check" });
    h.apply({ type: "check" });
    h.apply({ type: "check" });
    h.apply({ type: "check" });
    h.apply({ type: "check" });
    h.apply({ type: "check" });
    const r = h.result();
    expect(r.endedAtShowdown).toBe(true);
    expect(r.winners).toEqual([{ seat: 0, amount: 4 }]); // 2 each in the pot
    expect(r.net[0]).toBe(2);
    expect(r.net[1]).toBe(-2);
  });
});

describe("result credits the won pot back to the winner's stack", () => {
  // Regression: an all-in winner committed their whole stack, so stackOf was 0 after the
  // hand — the won pot was reported in `net`/`winners` but never returned to the seat. The
  // UI then read stackOf == 0 and fired the "out of chips" rebuy modal on a winning hand.
  const shoveAndRunOut = () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(6),
      holeOverride: { 0: ["Ah", "Kh"].map(c) as [Card, Card], 1: ["2c", "7d"].map(c) as [Card, Card] },
      boardOverride: ["Qh", "Jh", "3h", "4s", "9c"].map(c),
    });
    h.apply({ type: "raise", amount: 100 }); // seat 0 (SB/button) shoves all-in
    h.apply({ type: "call" }); // seat 1 calls all-in
    return h;
  };

  it("an all-in winner ends with the pot, not zero", () => {
    const h = shoveAndRunOut();
    expect(h.isHandOver()).toBe(true);
    const r = h.result();
    expect(r.winners).toEqual([{ seat: 0, amount: 200 }]);
    expect(h.stackOf(0)).toBe(200); // started 100, won the 200 pot
    expect(h.stackOf(1)).toBe(0); // busted
  });

  it("crediting is idempotent across repeated result()/stackOf calls", () => {
    const h = shoveAndRunOut();
    h.result();
    h.result();
    expect(h.stackOf(0)).toBe(200); // not 400 — the award is applied once, not per call
  });
});

describe("all-in run-out deals the full board (finding #12)", () => {
  // An all-in that ends betting before the river must still deal every remaining community card,
  // so the player sees a full 5-card board at showdown (no more "settles on the turn").
  const c = (s: string) => s as Card;

  it("an all-in on the turn still runs the river out to a 5-card board", () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(6),
      holeOverride: { 0: ["Ah", "Kh"].map(c) as [Card, Card], 1: ["2c", "7d"].map(c) as [Card, Card] },
      boardOverride: ["Qd", "Js", "3h", "4s", "9c"].map(c),
    });
    // Walk both players to the turn checking down the flop, then jam the turn.
    h.apply({ type: "call" }); // seat 0 (SB) limps
    h.apply({ type: "check" }); // seat 1 (BB) checks → flop
    h.apply({ type: "check" });
    h.apply({ type: "check" }); // → turn (board has 4)
    expect(h.board).toHaveLength(4);
    h.apply({ type: "bet", amount: 98 }); // seat 0 shoves the turn
    h.apply({ type: "call" }); // seat 1 calls all-in → no river betting possible
    expect(h.isHandOver()).toBe(true);
    expect(h.board).toHaveLength(5); // the river was dealt for the run-out
  });

  it("an all-in on the flop runs both turn and river out", () => {
    const h = createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(6),
      holeOverride: { 0: ["Ah", "Kh"].map(c) as [Card, Card], 1: ["2c", "7d"].map(c) as [Card, Card] },
      boardOverride: ["Qd", "Js", "3h", "4s", "9c"].map(c),
    });
    h.apply({ type: "call" });
    h.apply({ type: "check" }); // → flop (board 3)
    expect(h.board).toHaveLength(3);
    h.apply({ type: "bet", amount: 98 }); // jam the flop
    h.apply({ type: "call" });
    expect(h.isHandOver()).toBe(true);
    expect(h.board).toHaveLength(5);
  });
});

describe("all-in introspection (isAllIn / committedOf — drives the seat badge)", () => {
  const headsUp = () =>
    createHand({
      config: { smallBlind: 1, bigBlind: 2 },
      seats: [
        { seat: 0, stack: 100 },
        { seat: 1, stack: 100 },
      ],
      buttonIndex: 0,
      rng: mulberry32(6),
      holeOverride: { 0: ["Ah", "Kh"].map(c) as [Card, Card], 1: ["2c", "7d"].map(c) as [Card, Card] },
      boardOverride: ["Qh", "Jh", "3h", "4s", "9c"].map(c),
    });

  it("reports a shoved seat as all-in with its total commitment", () => {
    const h = headsUp();
    h.apply({ type: "raise", amount: 100 }); // seat 0 shoves
    h.apply({ type: "call" }); // seat 1 calls all-in
    expect(h.isAllIn(0)).toBe(true);
    expect(h.isAllIn(1)).toBe(true);
    expect(h.committedOf(0)).toBe(100);
    expect(h.committedOf(1)).toBe(100);
  });

  it("a seat with chips still behind is not all-in; committedOf reflects only what's in", () => {
    const h = headsUp(); // blinds posted, no further action
    expect(h.isAllIn(0)).toBe(false);
    expect(h.isAllIn(1)).toBe(false);
    expect(h.committedOf(0)).toBe(1); // SB
    expect(h.committedOf(1)).toBe(2); // BB
  });
});
