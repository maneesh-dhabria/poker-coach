// Orchestrate one full hand: drive the engine, let bots act via their personas and the hero act
// via a supplied callback, analyze every hero decision, and emit a complete HandRecord (spec
// FR-30..FR-33, §9.1). The hero action source is injected so the same code serves the UI and tests.
import { Card, RNG } from "@/core/cards";
import { createHand, Action, LegalActions } from "@/core/engine/gameEngine";
import { decide, BotParams } from "@/core/bots/botEngine";
import { equity } from "@/core/equity/equity";
import { analyze } from "@/core/analysis/analyze";
import { Position, Facing } from "@/core/charts/preflop";
import { CoachingDepth } from "@/core/analysis/types";
import {
  buildHandRecord,
  HandRecord,
  SeatRecord,
  ActionRecord,
  HeroDecisionRecord,
  Street,
} from "@/core/history/handRecord";

export interface PlaySeat {
  seat: number;
  name: string;
  isHero: boolean;
  stack: number;
  persona: BotParams | null; // null for the hero
}

export interface HeroContext {
  legal: LegalActions;
  potBefore: number;
  toCall: number;
  street: Street;
  position: Position;
  numActiveOpponents: number;
  facing: Facing;
}

export interface PlayHandInput {
  config: { smallBlind: number; bigBlind: number; startingStackBb: number };
  seats: PlaySeat[];
  buttonIndex: number;
  rng: RNG;
  sessionId: string;
  handNumber: number;
  playedAt?: string;
  coachingDepth?: CoachingDepth;
  heroAct: (ctx: HeroContext) => Action;
  equityIterations?: number;
}

// Position labels in seat order starting from the small blind, ending on the button.
const POSITION_TEMPLATE: Record<number, Position[]> = {
  2: ["SB", "BB"],
  3: ["SB", "BB", "BTN"],
  4: ["SB", "BB", "UTG", "BTN"],
  5: ["SB", "BB", "UTG", "CO", "BTN"],
  6: ["SB", "BB", "UTG", "MP", "CO", "BTN"],
};

function assignPositions(n: number, buttonIndex: number): Position[] {
  const template = POSITION_TEMPLATE[n] ?? POSITION_TEMPLATE[6];
  const start = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const pos: Position[] = new Array(n);
  for (let k = 0; k < n; k++) pos[(start + k) % n] = template[k];
  return pos;
}

export function playHand(input: PlayHandInput): HandRecord {
  const n = input.seats.length;
  const positions = assignPositions(n, input.buttonIndex);
  const heroIndex = input.seats.findIndex((s) => s.isHero);
  const heroSeatId = input.seats[heroIndex].seat;
  const depth = input.coachingDepth ?? "equity";
  const iters = input.equityIterations ?? 1200;

  const h = createHand({
    config: { smallBlind: input.config.smallBlind, bigBlind: input.config.bigBlind },
    seats: input.seats.map((s) => ({ seat: s.seat, stack: s.stack })),
    rng: input.rng,
    buttonIndex: input.buttonIndex,
  });

  const personaById = new Map(input.seats.map((s) => [s.seat, s.persona]));
  const positionById = new Map(input.seats.map((s, i) => [s.seat, positions[i]]));

  const actions: ActionRecord[] = [];
  const heroDecisions: HeroDecisionRecord[] = [];

  let prevStreet: Street | null = null;
  let raisedThisStreet = false;
  let guard = 0;

  while (!h.isHandOver() && guard++ < 400) {
    const legal = h.legalActions();
    if (legal.toAct < 0) break;
    const seatId = legal.toAct;
    const street = h.street as Street;
    if (street !== prevStreet) {
      raisedThisStreet = false;
      prevStreet = street;
    }

    const potBefore = h.pot();
    const stackBefore = h.stackOf(seatId);
    const numActiveOpponents = h.contenders().length - 1;
    const position = positionById.get(seatId)!;
    const facing: Facing = raisedThisStreet ? "raise" : "unopened";
    const hole = h.holeOf(seatId);

    let action: Action;
    if (seatId === heroSeatId) {
      action = input.heroAct({
        legal,
        potBefore,
        toCall: legal.toCall,
        street,
        position,
        numActiveOpponents,
        facing,
      });
    } else {
      const persona = personaById.get(seatId)!;
      action = decide({ legal, hole, board: h.board, potBefore }, persona!, input.rng);
    }

    h.apply(action);
    const increment = stackBefore - h.stackOf(seatId);
    actions.push({ street, seat: seatId, action: action.type, amount: increment });

    if (seatId === heroSeatId) {
      const equityPct = equity({
        hero: hole,
        board: h.board,
        numOpponents: Math.max(1, numActiveOpponents),
        iterations: iters,
        seed: Math.floor(input.rng() * 0x7fffffff),
      }).equityPct;

      const analysis = analyze({
        action: action.type,
        potBefore,
        toCall: legal.toCall,
        equityPct,
        unit: "usd",
        coachingDepth: depth,
        street,
        numActiveOpponents,
        hand: hole,
        position,
        facing,
        assumedRange: "a typical opponent range",
      });

      heroDecisions.push({
        decisionId: `h${input.handNumber}-d${heroDecisions.length + 1}`,
        street,
        spot: {
          potBefore,
          toCall: legal.toCall,
          position,
          stackBb: Math.round(stackBefore / input.config.bigBlind),
          numActiveOpponents,
          facing,
        },
        heroAction: { action: action.type, amount: increment },
        analysis,
      });
    }

    if (action.type === "bet" || action.type === "raise") raisedThisStreet = true;
  }

  const result = h.result();
  const seats: SeatRecord[] = input.seats.map((s, i) => ({
    seat: s.seat,
    name: s.name,
    isHero: s.isHero,
    startingStack: s.stack,
    position: positions[i],
    persona: s.persona ? { style: s.persona.style, skill: s.persona.skill } : null,
  }));

  const shown =
    result.endedAtShowdown
      ? result.contenders
          .filter((seat) => seat !== heroSeatId)
          .map((seat) => ({ seat, cards: h.holeOf(seat) as Card[] }))
      : [];

  return buildHandRecord({
    sessionId: input.sessionId,
    handNumber: input.handNumber,
    playedAt: input.playedAt,
    config: {
      numPlayers: n,
      smallBlind: input.config.smallBlind,
      bigBlind: input.config.bigBlind,
      startingStackBb: input.config.startingStackBb,
    },
    heroSeat: heroSeatId,
    seats,
    heroHole: h.holeOf(heroSeatId) as Card[],
    board: h.board,
    actions,
    heroDecisions,
    outcome: {
      winners: result.winners,
      heroNet: result.net[heroSeatId] ?? 0,
      shown,
      endedAtShowdown: result.endedAtShowdown,
    },
  });
}
