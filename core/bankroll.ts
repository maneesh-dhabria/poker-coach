// Pure bankroll reducer (spec FR-20, FR-30, FR-31, S3, S8, NFR-02). No IO, no React — the store
// (store/bankrollStore.ts) owns persistence and the clock; this module only computes new states from
// old ones so every money transition is unit-testable and deterministic. The bankroll carries its
// OWN schemaVersion, independent of the HandRecord contract.
export const BANKROLL_SCHEMA_VERSION = 1;

/** Lifetime starting bank in dollars (FR-30). */
export const DEFAULT_BANK = 1000;

export interface BankrollSeat {
  seatId: number;
  stack: number;
}

export interface Bankroll {
  schemaVersion: number;
  bank: number;
  startingStack: number;
  autoRebuy: boolean;
  seats: BankrollSeat[];
  sessionPnl: number;
  updatedAt: string;
}

export interface HandResult {
  heroSeat: number;
  net: number;
  /** Final per-seat stacks keyed by seatId; missing seats keep their prior stack. */
  seatStacks: Record<number, number>;
}

function freshSeats(startingStack: number, seatCount: number): BankrollSeat[] {
  return Array.from({ length: seatCount }, (_, seatId) => ({ seatId, stack: startingStack }));
}

/** A brand-new bank: $1000 lifetime, all seats at the starting stack, zero session P/L. */
export function defaultBankroll(startingStack: number, seatCount: number): Bankroll {
  return {
    schemaVersion: BANKROLL_SCHEMA_VERSION,
    bank: DEFAULT_BANK,
    startingStack,
    autoRebuy: false,
    seats: freshSeats(startingStack, seatCount),
    sessionPnl: 0,
    updatedAt: "",
  };
}

/** Apply a finished hand: the hero's net moves the lifetime bank + session P/L; final stacks carry. */
export function applyHandResult(b: Bankroll, result: HandResult): Bankroll {
  const seats = b.seats.map((s) =>
    result.seatStacks[s.seatId] !== undefined ? { ...s, stack: result.seatStacks[s.seatId] } : { ...s },
  );
  return {
    ...b,
    bank: b.bank + result.net,
    sessionPnl: b.sessionPnl + result.net,
    seats,
  };
}

/** Top a seat back up to the starting stack, debiting the bank by the top-up (clamped to the bank). */
export function rebuy(b: Bankroll, seatId: number): Bankroll {
  const seat = b.seats.find((s) => s.seatId === seatId);
  if (!seat) return { ...b, seats: b.seats.map((s) => ({ ...s })) };
  const want = Math.max(0, b.startingStack - seat.stack);
  const topUp = Math.min(want, Math.max(0, b.bank));
  return {
    ...b,
    bank: b.bank - topUp,
    seats: b.seats.map((s) => (s.seatId === seatId ? { ...s, stack: s.stack + topUp } : { ...s })),
  };
}

/** Start a fresh table: reset every stack + session P/L to a new starting depth, keep the bank. */
export function newTable(b: Bankroll, startingStack: number, _bigBlind?: number): Bankroll {
  return {
    ...b,
    startingStack,
    sessionPnl: 0,
    seats: freshSeats(startingStack, b.seats.length),
  };
}
