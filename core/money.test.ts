import { describe, it, expect } from "vitest";
import { formatMoney, formatSignedMoney } from "@/core/money";

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

// iter-12 #4: a signed P&L chip must never show "+$0" / "+0 BB" for a player who won/lost nothing —
// the "+" is dropped once the amount displays as zero, mirroring the "-$0" → "$0" normalization.
describe("formatSignedMoney", () => {
  it("prepends + only for a non-zero positive amount", () => {
    expect(formatSignedMoney(20, "usd", 2)).toBe("+$20");
    expect(formatSignedMoney(3, "bb", 2)).toBe("+1.5 BB");
  });
  it("never shows '+$0' for a zero (folded with no blind posted)", () => {
    expect(formatSignedMoney(0, "usd", 2)).toBe("$0");
    expect(formatSignedMoney(0.3, "usd", 2)).toBe("$0"); // rounds to $0 → no "+"
    expect(formatSignedMoney(0.05, "bb", 2)).toBe("0 BB"); // 0.025 BB → rounds to 0, no "+"
  });
  it("keeps the explicit minus for negatives", () => {
    expect(formatSignedMoney(-15, "usd", 2)).toBe("-$15");
    expect(formatSignedMoney(-0.3, "usd", 2)).toBe("$0"); // near-zero negative → "$0", no sign
  });
});
