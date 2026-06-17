import { describe, it, expect } from "vitest";
import { formatMoney } from "@/core/money";

describe("formatMoney", () => {
  it("formats usd as whole dollars", () => {
    expect(formatMoney(20, "usd", 2)).toBe("$20");
    expect(formatMoney(0, "usd", 2)).toBe("$0");
    expect(formatMoney(-15, "usd", 2)).toBe("-$15");
  });
  it("formats bb as multiples of the big blind, ≤1 decimal", () => {
    expect(formatMoney(20, "bb", 2)).toBe("10 BB");
    expect(formatMoney(3, "bb", 2)).toBe("1.5 BB");
    expect(formatMoney(5, "bb", 2)).toBe("2.5 BB"); // E8: ≤1 decimal
  });
  it("guards a zero/invalid big blind in bb mode", () => {
    expect(() => formatMoney(20, "bb", 0)).not.toThrow();
  });
  // iter-06 #5: a tiny negative magnitude that rounds to zero must render "$0", never "-$0".
  it("normalizes a near-zero negative to $0 (no leading minus)", () => {
    expect(formatMoney(-0.3, "usd", 2)).toBe("$0");
    expect(formatMoney(-0, "usd", 2)).toBe("$0");
    expect(formatMoney(-0.05, "bb", 2)).toBe("0 BB"); // -0.025 BB → rounds to 0, no "-0"
  });
});
