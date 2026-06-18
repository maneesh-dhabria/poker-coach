import { describe, it, expect } from "vitest";
import { handKey, chartAction, chartApplies, allHands169, cellRationale } from "@/core/charts/preflop";
import { Card } from "@/core/cards";
import equityTable from "@/core/charts/preflopEquity.json";

describe("handKey", () => {
  it("orders by rank, marks suited/offsuit, collapses pairs", () => {
    expect(handKey(["As", "Kh"] as [Card, Card])).toBe("AKo");
    expect(handKey(["Kh", "As"] as [Card, Card])).toBe("AKo");
    expect(handKey(["Ah", "Kh"] as [Card, Card])).toBe("AKs");
    expect(handKey(["As", "Ad"] as [Card, Card])).toBe("AA");
  });
});

describe("chartAction", () => {
  it("opens strong hands and folds trash from UTG", () => {
    expect(chartAction(["As", "Ah"] as [Card, Card], "UTG", "unopened")).toBe("raise");
    expect(chartAction(["7d", "2c"] as [Card, Card], "UTG", "unopened")).toBe("fold");
  });
  it("defends BB vs a raise per the chart", () => {
    expect(chartApplies("BB", "raise")).toBe(true);
  });
});

describe("cellRationale (iter-21 NIT 2 — small-pair early-fold surprise)", () => {
  it("explains a small pocket pair the chart FOLDS from early position", () => {
    // 22/33/44 are folds UTG in this tighter chart.
    expect(chartAction(["2h", "2s"] as [Card, Card], "UTG", "unopened")).toBe("fold");
    const r = cellRationale("22", "UTG", "fold");
    expect(r.toLowerCase()).toContain("small pairs");
    expect(r.toLowerCase()).toContain("set");
  });

  it("also explains it from MP (the other early seat)", () => {
    expect(cellRationale("33", "MP", "fold")).not.toBe("");
  });

  it("returns empty for a small pair the chart OPENS (e.g. 55-77 UTG)", () => {
    expect(chartAction(["5h", "5s"] as [Card, Card], "UTG", "unopened")).toBe("raise");
    expect(cellRationale("55", "UTG", "raise")).toBe("");
  });

  it("returns empty for a small pair from a LATE position (no early-fold surprise there)", () => {
    expect(cellRationale("22", "BTN", "fold")).toBe("");
  });

  it("returns empty for a non-small-pair / opened hand", () => {
    expect(cellRationale("AKs", "UTG", "raise")).toBe("");
    expect(cellRationale("72o", "UTG", "fold")).toBe(""); // a fold, but not a small pair
  });
});

describe("allHands169", () => {
  it("enumerates exactly 169 canonical hands (13 pairs, 78 suited, 78 offsuit)", () => {
    const all = allHands169();
    expect(all).toHaveLength(169);
    expect(all.filter((h) => h.length === 2)).toHaveLength(13); // pairs e.g. "AA"
    expect(all.filter((h) => h.endsWith("s"))).toHaveLength(78);
    expect(all.filter((h) => h.endsWith("o"))).toHaveLength(78);
  });

  it("produces a unique key set", () => {
    const all = allHands169();
    expect(new Set(all).size).toBe(169);
  });

  it("uses the same key format as handKey for representative hands", () => {
    const all = new Set(allHands169());
    expect(all.has("AA")).toBe(true);
    expect(all.has("AKs")).toBe(true);
    expect(all.has("AKo")).toBe(true);
    expect(all.has("72o")).toBe(true);
  });
});

describe("preflopEquity.json (precomputed table)", () => {
  it("has a numeric equity in [0,100] for every canonical hand", () => {
    const table = equityTable as { equity: Record<string, number> };
    for (const h of allHands169()) {
      const pct = table.equity[h];
      expect(typeof pct).toBe("number");
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it("ranks AA well above 72o (sanity)", () => {
    const table = equityTable as { equity: Record<string, number> };
    expect(table.equity["AA"]).toBeGreaterThan(table.equity["72o"]);
  });
});
