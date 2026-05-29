// Interactive, step-wise hand driver for the UI (spec FR-30). Unlike playHand (one-shot), this
// advances the engine until it's the hero's turn, waits, then resumes after the hero acts — letting
// the store compute equity (worker) between turns. Pure of React/DOM (§17); the store wraps it.
import { Card, RNG } from "@/core/cards";
import { createHand, Hand, Action, LegalActions } from "@/core/engine/gameEngine";
import { decide, BotParams } from "@/core/bots/botEngine";
import { analyze } from "@/core/analysis/analyze";
import { Position, Facing } from "@/core/charts/preflop";
import { assignPositions } from "@/core/positions";
import { CoachingDepth } from "@/core/analysis/types";
import {
  buildHandRecord,
  HandRecord,
  SeatRecord,
  ActionRecord,
  HeroDecisionRecord,
  Street,
} from "@/core/history/handRecord";

export interface FlowSeatInit {
  seat: number;
  name: string;
  isHero: boolean;
  stack: number;
  persona: BotParams | null;
}

export interface StartFlowInput {
  config: { smallBlind: number; bigBlind: number; startingStackBb: number };
  seats: FlowSeatInit[];
  buttonIndex: number;
  rng: RNG;
  sessionId: string;
  handNumber: number;
  coachingDepth?: CoachingDepth;
}

export interface HeroSpot {
  legal: LegalActions;
  hole: [Card, Card];
  board: Card[];
  potBefore: number;
  toCall: number;
  street: Street;
  position: Position;
  numActiveOpponents: number;
  facing: Facing;
  stackBb: number;
}

export interface TableSeatView {
  seat: number;
  name: string;
  isHero: boolean;
  position: Position;
  stack: number;
  folded: boolean;
  isButton: boolean;
  cards: Card[] | null; // hero always; opponents only at showdown
}

export interface TableView {
  seats: TableSeatView[];
  board: Card[];
  pot: number;
  legal: LegalActions;
  isHeroTurn: boolean;
  isOver: boolean;
  heroNet: number | null;
}

export class HandFlow {
  private h: Hand;
  private input: StartFlowInput;
  private positions: Position[];
  private heroSeatId: number;
  private personaById: Map<number, BotParams | null>;
  private positionById: Map<number, Position>;
  private actions: ActionRecord[] = [];
  private heroDecisions: HeroDecisionRecord[] = [];
  private prevStreet: Street | null = null;
  private raisedThisStreet = false;

  constructor(input: StartFlowInput) {
    this.input = input;
    const n = input.seats.length;
    this.positions = assignPositions(n, input.buttonIndex);
    this.heroSeatId = input.seats.find((s) => s.isHero)!.seat;
    this.personaById = new Map(input.seats.map((s) => [s.seat, s.persona]));
    this.positionById = new Map(input.seats.map((s, i) => [s.seat, this.positions[i]]));
    this.h = createHand({
      config: { smallBlind: input.config.smallBlind, bigBlind: input.config.bigBlind },
      seats: input.seats.map((s) => ({ seat: s.seat, stack: s.stack })),
      rng: input.rng,
      buttonIndex: input.buttonIndex,
    });
  }

  get engine(): Hand {
    return this.h;
  }
  get board(): Card[] {
    return this.h.board;
  }
  get street(): Street {
    return this.h.street as Street;
  }
  isOver(): boolean {
    return this.h.isHandOver();
  }
  isHeroTurn(): boolean {
    const la = this.h.legalActions();
    return !this.isOver() && la.toAct === this.heroSeatId;
  }
  heroHole(): [Card, Card] {
    return this.h.holeOf(this.heroSeatId);
  }
  potNow(): number {
    return this.h.pot();
  }

  private syncStreet(street: Street) {
    if (street !== this.prevStreet) {
      this.raisedThisStreet = false;
      this.prevStreet = street;
    }
  }

  /** The hero's current decision context (call only when isHeroTurn()). */
  heroSpot(): HeroSpot {
    const legal = this.h.legalActions();
    const street = this.h.street as Street;
    this.syncStreet(street);
    return {
      legal,
      hole: this.h.holeOf(this.heroSeatId),
      board: this.h.board,
      potBefore: this.h.pot(),
      toCall: legal.toCall,
      street,
      position: this.positionById.get(this.heroSeatId)!,
      numActiveOpponents: this.h.contenders().length - 1,
      facing: this.raisedThisStreet ? "raise" : "unopened",
      stackBb: Math.round(this.h.stackOf(this.heroSeatId) / this.input.config.bigBlind),
    };
  }

  /** Advance bot actions until it's the hero's turn or the hand ends. */
  autoPlayBots(): void {
    let guard = 0;
    while (!this.isOver() && guard++ < 400) {
      const legal = this.h.legalActions();
      if (legal.toAct < 0) break;
      if (legal.toAct === this.heroSeatId) break;
      const seatId = legal.toAct;
      const street = this.h.street as Street;
      this.syncStreet(street);
      const stackBefore = this.h.stackOf(seatId);
      const action = decide(
        { legal, hole: this.h.holeOf(seatId), board: this.h.board, potBefore: this.h.pot() },
        this.personaById.get(seatId)!,
        this.input.rng,
      );
      this.h.apply(action);
      this.actions.push({ street, seat: seatId, action: action.type, amount: stackBefore - this.h.stackOf(seatId) });
      if (action.type === "bet" || action.type === "raise") this.raisedThisStreet = true;
    }
  }

  /**
   * Apply the hero's action, recording an analyzed decision. `equityPct` is supplied by the caller
   * (worker MC) so analysis stays the single source of the verdict. Then bots auto-play onward.
   */
  heroAct(action: Action, equityPct: number): HeroDecisionRecord {
    const spot = this.heroSpot();
    const stackBefore = this.h.stackOf(this.heroSeatId);
    this.h.apply(action);
    const increment = stackBefore - this.h.stackOf(this.heroSeatId);
    this.actions.push({ street: spot.street, seat: this.heroSeatId, action: action.type, amount: increment });

    const analysis = analyze({
      action: action.type,
      potBefore: spot.potBefore,
      toCall: spot.toCall,
      equityPct,
      unit: "usd",
      coachingDepth: this.input.coachingDepth ?? "equity",
      street: spot.street,
      numActiveOpponents: spot.numActiveOpponents,
      hand: spot.hole,
      position: spot.position,
      facing: spot.facing,
      assumedRange: "a typical opponent range",
    });

    const decision: HeroDecisionRecord = {
      decisionId: `h${this.input.handNumber}-d${this.heroDecisions.length + 1}`,
      street: spot.street,
      spot: {
        potBefore: spot.potBefore,
        toCall: spot.toCall,
        position: spot.position,
        stackBb: spot.stackBb,
        numActiveOpponents: spot.numActiveOpponents,
        facing: spot.facing,
      },
      heroAction: { action: action.type, amount: increment },
      analysis,
    };
    this.heroDecisions.push(decision);
    if (action.type === "bet" || action.type === "raise") this.raisedThisStreet = true;

    this.autoPlayBots();
    return decision;
  }

  decisions(): HeroDecisionRecord[] {
    return this.heroDecisions;
  }

  /** A render-ready snapshot of the table for the UI (presentational components consume this). */
  tableView(): TableView {
    const over = this.isOver();
    const result = over ? this.h.result() : null;
    const contenders = new Set(this.h.contenders());
    const buttonSeat = this.input.seats[this.input.buttonIndex].seat;
    const seats: TableSeatView[] = this.input.seats.map((s, i) => {
      const folded = !contenders.has(s.seat);
      const revealed =
        s.isHero || (over && !!result?.endedAtShowdown && contenders.has(s.seat));
      return {
        seat: s.seat,
        name: s.name,
        isHero: s.isHero,
        position: this.positions[i],
        stack: this.h.stackOf(s.seat),
        folded,
        isButton: s.seat === buttonSeat,
        cards: revealed ? (this.h.holeOf(s.seat) as Card[]) : null,
      };
    });
    return {
      seats,
      board: this.h.board,
      pot: this.h.pot(),
      legal: this.h.legalActions(),
      isHeroTurn: this.isHeroTurn(),
      isOver: over,
      heroNet: result ? (result.net[this.heroSeatId] ?? 0) : null,
    };
  }

  /** Build the persisted HandRecord (call once the hand is over). */
  toRecord(playedAt?: string): HandRecord {
    const result = this.h.result();
    const seats: SeatRecord[] = this.input.seats.map((s, i) => ({
      seat: s.seat,
      name: s.name,
      isHero: s.isHero,
      startingStack: s.stack,
      position: this.positions[i],
      persona: s.persona ? { style: s.persona.style, skill: s.persona.skill } : null,
    }));
    const shown = result.endedAtShowdown
      ? result.contenders
          .filter((seat) => seat !== this.heroSeatId)
          .map((seat) => ({ seat, cards: this.h.holeOf(seat) as Card[] }))
      : [];
    return buildHandRecord({
      sessionId: this.input.sessionId,
      handNumber: this.input.handNumber,
      playedAt,
      config: {
        numPlayers: this.input.seats.length,
        smallBlind: this.input.config.smallBlind,
        bigBlind: this.input.config.bigBlind,
        startingStackBb: this.input.config.startingStackBb,
      },
      heroSeat: this.heroSeatId,
      seats,
      heroHole: this.h.holeOf(this.heroSeatId) as Card[],
      board: this.h.board,
      actions: this.actions,
      heroDecisions: this.heroDecisions,
      outcome: {
        winners: result.winners,
        heroNet: result.net[this.heroSeatId] ?? 0,
        shown,
        endedAtShowdown: result.endedAtShowdown,
      },
    });
  }
}

export function startHand(input: StartFlowInput): HandFlow {
  const flow = new HandFlow(input);
  flow.autoPlayBots(); // advance to the hero's first decision (or straight to showdown)
  return flow;
}
