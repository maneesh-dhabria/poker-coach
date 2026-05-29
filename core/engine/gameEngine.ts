// Own pure-TS No-Limit Hold'em engine (decision P8): deal, legal actions, betting across
// streets, all-in handling, and side-pot-aware showdown awards. No React/DOM (spec §17).
// Bet/raise `amount` is the total street commitment to raise TO (the "raise-to" amount).
import { Card, makeDeck, shuffle, RNG } from "@/core/cards";
import { rank7 } from "@/core/eval/handEval";
import { buildSidePots, Contribution, SidePot } from "@/core/engine/sidepots";

export type Street = "preflop" | "flop" | "turn" | "river" | "complete";
export type ActionType = "fold" | "check" | "call" | "bet" | "raise";

export interface Action {
  type: ActionType;
  amount?: number; // for bet/raise: the total street commitment to raise TO
}

export interface EngineConfig {
  smallBlind: number;
  bigBlind: number;
}

export interface SeatInit {
  seat: number;
  stack: number;
}

export interface LegalActions {
  toAct: number; // seat to act, -1 if the hand needs no action (over / all-in run-out)
  actions: ActionType[];
  toCall: number; // chips required to call
  minRaiseTo: number; // minimum legal raise-to (clamped to all-in)
  maxRaiseTo: number; // all-in raise-to
}

export interface HandResult {
  pots: SidePot[];
  winners: { seat: number; amount: number }[];
  net: Record<number, number>;
  board: Card[];
  endedAtShowdown: boolean;
  contenders: number[]; // seats still in at the end (non-folded)
}

export interface CreateHandInput {
  config: EngineConfig;
  seats: SeatInit[];
  rng: RNG;
  buttonIndex?: number;
  deck?: Card[]; // pre-ordered deck (front = dealt first); else built from rng
  holeOverride?: Record<number, [Card, Card]>;
  boardOverride?: Card[];
}

interface SeatState {
  seat: number;
  stack: number;
  hole: [Card, Card];
  committedStreet: number; // chips in this street
  committedTotal: number; // chips across the whole hand
  folded: boolean;
  allIn: boolean;
  hasActed: boolean; // acted since the last bet/raise this street
}

const STREET_ORDER: Street[] = ["preflop", "flop", "turn", "river"];

export class Hand {
  readonly config: EngineConfig;
  readonly buttonIndex: number;
  street: Street = "preflop";
  board: Card[] = [];

  private seatsState: SeatState[];
  private deck: Card[];
  private deckPtr: number;
  private fullBoard: Card[]; // the 5 community cards reserved up front
  private currentBet = 0;
  private lastRaiseSize: number;
  private toAct = -1;

  constructor(input: CreateHandInput) {
    this.config = input.config;
    const n = input.seats.length;
    this.buttonIndex = (input.buttonIndex ?? 0) % n;
    this.lastRaiseSize = input.config.bigBlind;

    this.deck = input.deck ?? shuffle(makeDeck(), input.rng);
    this.deckPtr = 0;

    // Deal hole cards (or take overrides).
    this.seatsState = input.seats.map((s) => {
      const hole = input.holeOverride?.[s.seat] ?? ([this.next(), this.next()] as [Card, Card]);
      return {
        seat: s.seat,
        stack: s.stack,
        hole,
        committedStreet: 0,
        committedTotal: 0,
        folded: false,
        allIn: false,
        hasActed: false,
      };
    });

    // Reserve the 5 board cards (overridable for deterministic tests).
    this.fullBoard = input.boardOverride ?? [this.next(), this.next(), this.next(), this.next(), this.next()];

    this.postBlinds();
  }

  private next(): Card {
    return this.deck[this.deckPtr++];
  }

  private idx(seat: number): number {
    return this.seatsState.findIndex((s) => s.seat === seat);
  }

  private at(i: number): SeatState {
    const n = this.seatsState.length;
    return this.seatsState[((i % n) + n) % n];
  }

  private postBlinds() {
    const n = this.seatsState.length;
    const sbPos = n === 2 ? this.buttonIndex : (this.buttonIndex + 1) % n;
    const bbPos = n === 2 ? (this.buttonIndex + 1) % n : (this.buttonIndex + 2) % n;
    this.post(sbPos, this.config.smallBlind);
    this.post(bbPos, this.config.bigBlind);
    this.currentBet = this.config.bigBlind;
    this.lastRaiseSize = this.config.bigBlind;
    // First to act preflop is the seat after the big blind.
    this.toAct = this.findNextToAct((bbPos + 1) % n);
  }

  private post(i: number, amount: number) {
    const s = this.at(i);
    const put = Math.min(amount, s.stack);
    s.stack -= put;
    s.committedStreet += put;
    s.committedTotal += put;
    if (s.stack === 0) s.allIn = true;
  }

  private needsAction(s: SeatState): boolean {
    return !s.folded && !s.allIn && (!s.hasActed || s.committedStreet < this.currentBet);
  }

  /** First seat (scanning clockwise from `start`) that still needs to act; -1 if none. */
  private findNextToAct(start: number): number {
    const n = this.seatsState.length;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (this.needsAction(this.at(i))) return i;
    }
    return -1;
  }

  private notFolded(): SeatState[] {
    return this.seatsState.filter((s) => !s.folded);
  }

  private canAct(): SeatState[] {
    return this.seatsState.filter((s) => !s.folded && !s.allIn);
  }

  holeOf(seat: number): [Card, Card] {
    return this.at(this.idx(seat)).hole;
  }

  stackOf(seat: number): number {
    return this.at(this.idx(seat)).stack;
  }

  /** Total chips committed to the pot across all seats this hand. */
  pot(): number {
    return this.seatsState.reduce((sum, s) => sum + s.committedTotal, 0);
  }

  /** Seat ids still in the hand (not folded) right now. */
  contenders(): number[] {
    return this.notFolded().map((s) => s.seat);
  }

  isHandOver(): boolean {
    return this.street === "complete";
  }

  legalActions(): LegalActions {
    const empty: LegalActions = { toAct: -1, actions: [], toCall: 0, minRaiseTo: 0, maxRaiseTo: 0 };
    if (this.street === "complete" || this.toAct < 0) return empty;
    const s = this.at(this.toAct);
    const toCall = Math.min(this.currentBet - s.committedStreet, s.stack);
    const actions: ActionType[] = ["fold"];
    if (this.currentBet - s.committedStreet === 0) actions.push("check");
    else actions.push("call");

    const maxRaiseTo = s.committedStreet + s.stack;
    const canRaise = s.stack > toCall; // chips left beyond just calling
    let minRaiseTo = 0;
    if (canRaise) {
      actions.push(this.currentBet === 0 ? "bet" : "raise");
      const baseMin = this.currentBet === 0 ? this.config.bigBlind : this.currentBet + this.lastRaiseSize;
      minRaiseTo = Math.min(baseMin, maxRaiseTo);
    }
    return { toAct: this.at(this.toAct).seat, actions, toCall, minRaiseTo, maxRaiseTo };
  }

  apply(action: Action): void {
    if (this.street === "complete" || this.toAct < 0) throw new Error("no action expected");
    const actorIndex = this.toAct;
    const s = this.at(actorIndex);

    switch (action.type) {
      case "fold":
        s.folded = true;
        break;
      case "check":
        if (this.currentBet - s.committedStreet !== 0) throw new Error("cannot check facing a bet");
        break;
      case "call": {
        const put = Math.min(this.currentBet - s.committedStreet, s.stack);
        s.stack -= put;
        s.committedStreet += put;
        s.committedTotal += put;
        if (s.stack === 0) s.allIn = true;
        break;
      }
      case "bet":
      case "raise": {
        const target = action.amount ?? 0;
        const maxRaiseTo = s.committedStreet + s.stack;
        if (target > maxRaiseTo) throw new Error("raise exceeds stack");
        const baseMin = this.currentBet === 0 ? this.config.bigBlind : this.currentBet + this.lastRaiseSize;
        const isAllIn = target === maxRaiseTo;
        if (target < baseMin && !isAllIn) throw new Error("raise below minimum");
        const put = target - s.committedStreet;
        s.stack -= put;
        s.committedStreet += put;
        s.committedTotal += put;
        if (s.stack === 0) s.allIn = true;
        const raiseSize = target - this.currentBet;
        if (raiseSize >= this.lastRaiseSize) {
          this.lastRaiseSize = raiseSize;
          // A full raise reopens action for everyone who already acted.
          for (const o of this.seatsState) if (o !== s && !o.folded && !o.allIn) o.hasActed = false;
        }
        this.currentBet = target;
        break;
      }
    }
    s.hasActed = true;

    // Fold-out win.
    if (this.notFolded().length === 1) {
      this.street = "complete";
      this.toAct = -1;
      return;
    }

    const next = this.findNextToAct(actorIndex + 1);
    if (next >= 0) {
      this.toAct = next;
    } else {
      this.advanceStreet();
    }
  }

  private advanceStreet(): void {
    if (this.street === "river") {
      this.street = "complete";
      this.toAct = -1;
      return;
    }
    const nextStreet = STREET_ORDER[STREET_ORDER.indexOf(this.street) + 1];
    this.street = nextStreet;

    // Deal the board increment from the reserved 5.
    if (nextStreet === "flop") this.board = this.fullBoard.slice(0, 3);
    else if (nextStreet === "turn") this.board = this.fullBoard.slice(0, 4);
    else if (nextStreet === "river") this.board = this.fullBoard.slice(0, 5);

    // Reset street betting.
    this.currentBet = 0;
    this.lastRaiseSize = this.config.bigBlind;
    for (const s of this.seatsState) {
      s.committedStreet = 0;
      s.hasActed = false;
    }

    // If fewer than two players can still act, there is no betting — deal out to showdown.
    if (this.canAct().length < 2) {
      this.advanceStreet();
      return;
    }

    const start = (this.buttonIndex + 1) % this.seatsState.length;
    const next = this.findNextToAct(start);
    if (next < 0) this.advanceStreet();
    else this.toAct = next;
  }

  result(): HandResult {
    const contribs: Contribution[] = this.seatsState.map((s) => ({
      seat: s.seat,
      committed: s.committedTotal,
      folded: s.folded,
    }));
    const pots = buildSidePots(contribs);

    const net: Record<number, number> = {};
    for (const s of this.seatsState) net[s.seat] = -s.committedTotal;
    const wonBySeat: Record<number, number> = {};

    for (const pot of pots) {
      const winners = this.bestAmong(pot.eligible);
      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount - share * winners.length;
      for (const seat of winners) {
        const extra = remainder > 0 ? 1 : 0; // odd chips go to earliest seats
        remainder -= extra;
        const amt = share + extra;
        wonBySeat[seat] = (wonBySeat[seat] ?? 0) + amt;
        net[seat] += amt;
      }
    }

    const winners = Object.entries(wonBySeat)
      .map(([seat, amount]) => ({ seat: Number(seat), amount }))
      .sort((a, b) => a.seat - b.seat);

    const endedAtShowdown = this.notFolded().length > 1;
    const contenders = this.notFolded().map((s) => s.seat);
    return { pots, winners, net, board: this.board, endedAtShowdown, contenders };
  }

  /** Seats with the best 7-card hand among the eligible set (ties → multiple). */
  private bestAmong(eligible: number[]): number[] {
    if (eligible.length === 1) return eligible;
    let best = -1;
    let winners: number[] = [];
    for (const seat of eligible) {
      const s = this.at(this.idx(seat));
      const score = rank7([...s.hole, ...this.fullBoard]);
      if (score > best) {
        best = score;
        winners = [seat];
      } else if (score === best) {
        winners.push(seat);
      }
    }
    return winners.sort((a, b) => a - b);
  }
}

export function createHand(input: CreateHandInput): Hand {
  return new Hand(input);
}
