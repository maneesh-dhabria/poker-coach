import { describe, it, expect } from "vitest";
import { selectActingSeat } from "@/components/table/PokerTable";

describe("selectActingSeat (FR-12)", () => {
  const log = [{ seat: 3 }, { seat: 5 }, { seat: 0 }] as any;

  it("glows the seat being revealed while revealing (bot seat, not the hero)", () => {
    expect(selectActingSeat(true, log, 0, { isOver: false, toAct: 0 } as any)).toBe(3);
    expect(selectActingSeat(true, log, 1, { isOver: false, toAct: 0 } as any)).toBe(5);
  });

  it("falls back to view.toAct after the reveal finishes", () => {
    expect(selectActingSeat(false, log, 3, { isOver: false, toAct: 0 } as any)).toBe(0);
  });

  it("returns null when the hand is over (showdown — no glow)", () => {
    expect(selectActingSeat(false, log, 3, { isOver: true, toAct: null } as any)).toBeNull();
  });

  it("returns null when revealing but the cursor is past the log (defensive)", () => {
    expect(selectActingSeat(true, log, 9, { isOver: false, toAct: 0 } as any)).toBeNull();
  });
});
