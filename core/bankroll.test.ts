import { describe, it, expect } from "vitest";
import {
  defaultBankroll,
  applyHandResult,
  rebuy,
  newTable,
  BANKROLL_SCHEMA_VERSION,
} from "@/core/bankroll";

describe("bankroll reducer", () => {
  it("builds a fresh default", () => {
    const b = defaultBankroll(200, 6);
    expect(b.schemaVersion).toBe(BANKROLL_SCHEMA_VERSION);
    expect(b.bank).toBeGreaterThan(0);
    expect(b.startingStack).toBe(200);
    expect(b.seats).toHaveLength(6);
    expect(b.sessionPnl).toBe(0);
  });

  it("default bank is $1000 (FR-30)", () => {
    expect(defaultBankroll(200, 6).bank).toBe(1000);
  });

  it("applies a hand result: hero net moves bank + sessionPnl + hero stack", () => {
    const b0 = defaultBankroll(200, 2);
    const b1 = applyHandResult(b0, { heroSeat: 0, net: 50, seatStacks: { 0: 250, 1: 150 } });
    expect(b1.sessionPnl).toBe(50);
    expect(b1.bank).toBe(b0.bank + 50);
    expect(b1.seats.find((s) => s.seatId === 0)!.stack).toBe(250);
    expect(b1.seats.find((s) => s.seatId === 1)!.stack).toBe(150);
  });

  it("rebuy tops the hero up to startingStack from the bank", () => {
    const b0 = {
      ...defaultBankroll(200, 2),
      seats: [
        { seatId: 0, stack: 5 },
        { seatId: 1, stack: 200 },
      ],
    };
    const b1 = rebuy(b0, 0);
    expect(b1.seats.find((s) => s.seatId === 0)!.stack).toBe(200);
    expect(b1.bank).toBe(b0.bank - 195);
  });

  it("rebuy clamps the top-up to the available bank", () => {
    const b0 = {
      ...defaultBankroll(200, 2),
      bank: 50,
      seats: [
        { seatId: 0, stack: 5 },
        { seatId: 1, stack: 200 },
      ],
    };
    const b1 = rebuy(b0, 0);
    // only $50 available → top from 5 to 55, bank to 0
    expect(b1.seats.find((s) => s.seatId === 0)!.stack).toBe(55);
    expect(b1.bank).toBe(0);
  });

  it("newTable resets stacks + sessionPnl but keeps the bank", () => {
    const b0 = applyHandResult(defaultBankroll(200, 2), {
      heroSeat: 0,
      net: 120,
      seatStacks: { 0: 320, 1: 80 },
    });
    const b1 = newTable(b0, 100, 2);
    expect(b1.sessionPnl).toBe(0);
    expect(b1.seats.every((s) => s.stack === 100)).toBe(true);
    expect(b1.bank).toBe(b0.bank); // bank carries
    expect(b1.startingStack).toBe(100);
  });

  it("is pure: does not mutate its input", () => {
    const b0 = defaultBankroll(200, 2);
    const snapshot = JSON.stringify(b0);
    applyHandResult(b0, { heroSeat: 0, net: 10, seatStacks: { 0: 210 } });
    rebuy(b0, 0);
    newTable(b0, 100);
    expect(JSON.stringify(b0)).toBe(snapshot);
  });
});
