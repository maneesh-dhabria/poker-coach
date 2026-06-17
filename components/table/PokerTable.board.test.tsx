import { describe, it, expect } from "vitest";
import { boardShowCount } from "@/components/table/PokerTable";
import { startHand } from "@/core/handFlow";
import { personaFor } from "@/core/bots/personas";
import { mulberry32 } from "@/core/cards";

// iter-03 #1 (REGRESSION): the community board must show the card(s) for the street the hero is
// CURRENTLY deciding — at a flop decision 3 cards, turn 4, river 5 — not lag one street behind.
//
// PokerTable renders <Board cards={view.board} count={boardShowCount(revealing, snapshot.boardCount)} />.
// The Board shows `cards.slice(0, count)` when count is defined, or all of `cards` when undefined.
// So we prove two things:
//   1. boardShowCount returns undefined (uncapped) the moment the bot-reveal animation finishes —
//      i.e. on a static hero decision and at showdown — so the Board shows ALL of view.board.
//   2. On a real flow, view.board at a flop/turn/river hero decision already holds exactly that
//      street's cards, so an uncapped board shows the hero the street they're deciding.

describe("boardShowCount — caps only during the bot-reveal animation (iter-03 #1)", () => {
  it("caps to the snapshot street count WHILE revealing (street-by-street reveal cadence kept)", () => {
    expect(boardShowCount(true, 0)).toBe(0);
    expect(boardShowCount(true, 3)).toBe(3);
    expect(boardShowCount(true, 4)).toBe(4);
  });

  it("is UNCAPPED (undefined) on a static hero decision / showdown — shows the full dealt board", () => {
    // Not revealing → the Board ignores the count and renders every card in view.board.
    expect(boardShowCount(false, 0)).toBeUndefined();
    expect(boardShowCount(false, 3)).toBeUndefined();
    expect(boardShowCount(false, 4)).toBeUndefined();
  });
});

describe("view.board exposes the deciding street's cards at each hero decision (iter-03 #1)", () => {
  // Heads-up vs a calling station that always checks/calls, so the hand reaches every street and
  // stops on the hero's turn each time. We assert the live board the hero is shown matches the
  // street they're deciding: flop→3, turn→4, river→5.
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

  const EXPECTED: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

  it("the board the hero sees equals their street's card count (never one street stale)", () => {
    const flow = freshFlow();
    let guard = 0;
    let sawPostflopDecision = false;
    while (!flow.isOver() && flow.isHeroTurn() && guard++ < 40) {
      const spot = flow.heroSpot();
      const view = flow.tableView();
      // boardShowCount is undefined on a hero decision, so the Board shows all of view.board:
      expect(boardShowCount(false, view.board.length)).toBeUndefined();
      // ...and view.board already holds exactly the deciding street's cards.
      expect(view.board.length).toBe(EXPECTED[spot.street]);
      if (spot.street !== "preflop") sawPostflopDecision = true;

      const action = spot.legal.actions.includes("check")
        ? { type: "check" as const }
        : { type: "call" as const };
      flow.heroAct(action, 50);
    }
    // Guard: the seed must actually reach at least one postflop hero decision for this to be a real
    // proof of the regression fix (flop/turn/river, not just preflop).
    expect(sawPostflopDecision).toBe(true);
  });
});
