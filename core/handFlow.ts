// Interactive, step-wise hand driver for the UI (spec FR-30). Unlike playHand (one-shot), this
// advances the engine until it's the hero's turn, waits, then resumes after the hero acts — letting
// the store compute equity (worker) between turns. Pure of React/DOM (§17); the store wraps it.
import { Card, RNG } from "@/core/cards";
import { createHand, Hand, Action, LegalActions } from "@/core/engine/gameEngine";
import { decide, BotParams } from "@/core/bots/botEngine";
import { analyze, AnalyzeInput } from "@/core/analysis/analyze";
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
  // T8 (D1 pattern): this seat's net for the hand once over (from result.net); null while live.
  // Optional so existing TableSeatView literals (e.g. component tests) stay valid — additive.
  net?: number | null;
  // All-in state for the seat badge: true once the seat has committed its whole stack (it can no
  // longer act, and is frozen out of any side pot built afterwards); `allInAmount` is the chips it
  // put in. Lets the UI explain side-pot outcomes (e.g. a short all-in winning less than the table).
  // Optional/additive so existing literals stay valid.
  allIn?: boolean;
  allInAmount?: number;
}

export interface TableView {
  seats: TableSeatView[];
  board: Card[];
  pot: number;
  legal: LegalActions;
  isHeroTurn: boolean;
  isOver: boolean;
  heroNet: number | null;
  // T6 (D1): the seat currently to act, or null when not applicable / hand over.
  toAct: number | null;
  // T6 (D1): winners once the hand is over (mirrors outcome.winners); [] otherwise.
  winners: { seat: number; amount: number }[];
  // The largest raise-to level any single still-in OPPONENT could match — the effective stack the UI
  // should cap the hero's offered bet/raise to (iter-20 MINOR #3). 0 when no live opponent / not the
  // hero's turn. Purely a DISPLAY cap; engine legality (legal.maxRaiseTo) is untouched.
  effectiveOpponentRaiseTo: number;
}

/** A replay snapshot of the hand as of the first `step` revealed actions — drives the central
 * pot zone and the street-by-street board reveal (presentational only; never feeds verdicts). */
export interface ReplaySnapshot {
  pot: number;
  street: Street;
  boardCount: number;
  roundContributions: {
    seat: number;
    name: string;
    action: string;
    amount: number;
    // For a bet/raise: the total raise-to level (so "Raise to N" matches the action button); the
    // round summary shows this instead of the increment for consistency (iter-03 #6).
    toAmount?: number;
  }[];
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
  // The exact AnalyzeInput used to grade each hero decision, EXCLUDING coachingDepth — kept so an
  // in-play depth change can RE-DERIVE every already-graded decision at the new depth without a new
  // session (iter-14 #1/#2). Depth only changes the explanation COPY (the verdict/equity/tags are
  // depth-independent), so re-running analyze() on the same inputs at a new depth is deterministic
  // and safe. Parallel to heroDecisions (same index).
  private analyzeInputs: Omit<AnalyzeInput, "coachingDepth">[] = [];
  // The coaching depth currently baked into the recorded analyses. Starts at the session's deal-time
  // depth; an in-play change updates it (and re-derives the analyses) so the current hand tracks the
  // live setting rather than a stale baked depth (iter-14 #1/#2).
  private currentDepth: CoachingDepth;
  private prevStreet: Street | null = null;
  private raisedThisStreet = false;

  constructor(input: StartFlowInput) {
    this.input = input;
    this.currentDepth = input.coachingDepth ?? "equity";
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
      this.actions.push({
        street,
        seat: seatId,
        action: action.type,
        amount: stackBefore - this.h.stackOf(seatId),
        // The total raise-to level (what "Raise to N" means), kept for consistent display (#6).
        ...(action.type === "bet" || action.type === "raise" ? { toAmount: action.amount } : {}),
      });
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
    const isAggressive = action.type === "bet" || action.type === "raise";
    // The total raise-to level (what "Raise to N" means on the button) for consistent display (#6).
    const toAmount = isAggressive ? action.amount : undefined;
    this.actions.push({
      street: spot.street,
      seat: this.heroSeatId,
      action: action.type,
      amount: increment,
      ...(toAmount !== undefined ? { toAmount } : {}),
    });

    // The depth-INDEPENDENT analyze inputs for this decision (depth is applied separately so an
    // in-play depth change can re-derive the copy — iter-14 #1/#2). Stored parallel to heroDecisions.
    const analyzeInput: Omit<AnalyzeInput, "coachingDepth"> = {
      action: action.type,
      potBefore: spot.potBefore,
      toCall: spot.toCall,
      equityPct,
      unit: "usd",
      street: spot.street,
      numActiveOpponents: spot.numActiveOpponents,
      hand: spot.hole,
      position: spot.position,
      facing: spot.facing,
      assumedRange: "a typical opponent range",
      // iter-06 #1/#3: pass the hero cards + board (made-hand detection) and the raise-to size +
      // big blind (oversize check). All additive/optional in analyze().
      hole: spot.hole,
      board: spot.board,
      ...(toAmount !== undefined ? { raiseToAmount: toAmount } : {}),
      bigBlind: this.input.config.bigBlind,
      // The small blind too, so analyze can detect a limped pot (off-model for the RFI chart, iter-12 #3).
      smallBlind: this.input.config.smallBlind,
    };
    this.analyzeInputs.push(analyzeInput);
    const analysis = analyze({ ...analyzeInput, coachingDepth: this.currentDepth });

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
      heroAction: { action: action.type, amount: increment, ...(toAmount !== undefined ? { toAmount } : {}) },
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

  /** The coaching depth currently baked into the recorded analyses. */
  coachingDepth(): CoachingDepth {
    return this.currentDepth;
  }

  /**
   * Re-derive EVERY already-graded hero decision at a new coaching depth, and use it for all FUTURE
   * decisions in this hand (iter-14 #1/#2). Depth only changes the explanation COPY — the
   * verdict/equity/conceptTags are depth-independent — so re-running analyze() on the same frozen
   * per-decision inputs is deterministic and safe (no recompute of equity or the engine). After this
   * the FeedbackPanel + HandRecap read fully-switched analyses (no half-switched/stale baked copy).
   * No-op when the depth is unchanged. Returns true when anything changed.
   */
  reanalyzeAt(depth: CoachingDepth): boolean {
    if (depth === this.currentDepth) return false;
    this.currentDepth = depth;
    for (let i = 0; i < this.heroDecisions.length; i++) {
      this.heroDecisions[i] = {
        ...this.heroDecisions[i],
        analysis: analyze({ ...this.analyzeInputs[i], coachingDepth: depth }),
      };
    }
    return true;
  }

  /** The full ordered action log (hero + bots), for the UI's per-seat action badges + chip
   * animation (observation #3). Presentational only — never feeds verdicts. */
  actionLog(): ActionRecord[] {
    return this.actions;
  }

  /** A render-ready snapshot of the hand as of the first `step` actions — drives the central pot
   * zone and the street-by-street board reveal. Pure/presentational; never feeds verdicts. */
  replayAt(step: number): ReplaySnapshot {
    const slice = this.actions.slice(0, Math.max(0, step));
    const base = this.input.config.smallBlind + this.input.config.bigBlind;
    const pot = slice.reduce((sum, a) => sum + a.amount, base);
    const street: Street = slice.length > 0 ? slice[slice.length - 1].street : "preflop";
    const nameOf = (seat: number) =>
      this.input.seats.find((s) => s.seat === seat)?.name ?? `Seat ${seat}`;
    const roundContributions = slice
      .filter((a) => a.street === street && a.amount > 0)
      .map((a) => ({
        seat: a.seat,
        name: nameOf(a.seat),
        action: a.action,
        amount: a.amount,
        ...(a.toAmount !== undefined ? { toAmount: a.toAmount } : {}),
      }));
    return { pot, street, boardCount: boardCountForStreet(street), roundContributions };
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
        net: result ? (result.net[s.seat] ?? 0) : null,
        allIn: this.h.isAllIn(s.seat),
        allInAmount: this.h.committedOf(s.seat),
      };
    });
    const legal = this.h.legalActions();
    // Derived, read-only (D1): the acting seat from the same source isHeroTurn uses, null when over
    // or when no seat is to act; winners straight off the engine result (same data toRecord writes).
    const toAct = over || legal.toAct < 0 ? null : legal.toAct;
    return {
      seats,
      board: this.h.board,
      pot: this.h.pot(),
      legal,
      isHeroTurn: this.isHeroTurn(),
      isOver: over,
      heroNet: result ? (result.net[this.heroSeatId] ?? 0) : null,
      toAct,
      winners: result ? result.winners : [],
      // The effective opponent stack for the UI bet/raise cap (iter-20 MINOR #3). Only meaningful on
      // the hero's turn; 0 otherwise (the action bar isn't shown then anyway).
      effectiveOpponentRaiseTo: this.h.effectiveOpponentRaiseTo(this.heroSeatId),
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

const BOARD_COUNT_BY_STREET: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

/** How many community cards are visible on a given street. */
export function boardCountForStreet(street: Street): number {
  return BOARD_COUNT_BY_STREET[street];
}

/** The most recent action each seat took, given a (possibly partial) action log. Used by the UI to
 * label each seat with what it just did, and to drive the chip-to-pot animation (observation #3). */
export function latestActionPerSeat(log: ActionRecord[]): Record<number, ActionRecord> {
  const out: Record<number, ActionRecord> = {};
  for (const a of log) out[a.seat] = a;
  return out;
}
