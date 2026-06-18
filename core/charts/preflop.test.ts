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

describe("cellRationale (iter-21 NIT 2 / iter-22 MINOR #6 — small-pair boundary coherence)", () => {
  it("explains a small pocket pair the chart FOLDS as the BOTTOM of the range (not a blanket small-pair condemnation)", () => {
    // 22/33/44 are folds UTG in this tighter chart.
    expect(chartAction(["2h", "2s"] as [Card, Card], "UTG", "unopened")).toBe("fold");
    const r = cellRationale("22", "UTG", "fold");
    expect(r.toLowerCase()).toContain("set");
    // iter-22 MINOR #6: the fold copy must frame this as the THRESHOLD bottom of the range, NOT argue
    // that small pairs in general don't set-mine (which would contradict the very next pair the chart
    // RAISES). It explicitly acknowledges the slightly bigger pairs ARE opened.
    expect(r.toLowerCase()).toContain("bottom of the range");
    expect(r.toLowerCase()).toContain("opened");
  });

  it("also explains the folded bottom pair from MP (the other early seat)", () => {
    // 22 is the only fold among 22–55 from MP; 33/44/55 are opens.
    expect(chartAction(["2h", "2s"] as [Card, Card], "MP", "unopened")).toBe("fold");
    expect(cellRationale("22", "MP", "fold")).not.toBe("");
  });

  it("iter-22 MINOR #6: a small pair the chart OPENS now gets a 'why raise' line too (coverage fix)", () => {
    // 55 opens from UTG; 33/44/55 open from MP. The hands you're told to PLAY get strategic guidance,
    // not just a win% line (the reviewer's "coverage backwards" MINOR).
    expect(chartAction(["5h", "5s"] as [Card, Card], "UTG", "unopened")).toBe("raise");
    const r = cellRationale("55", "UTG", "raise");
    expect(r).not.toBe("");
    expect(r.toLowerCase()).toContain("set-mine");
    expect(cellRationale("33", "MP", "raise")).not.toBe("");
    expect(cellRationale("44", "MP", "raise")).not.toBe("");
  });

  it("returns empty for a small pair from a LATE position (no early-position boundary there)", () => {
    expect(cellRationale("22", "BTN", "fold")).toBe("");
    expect(cellRationale("55", "BTN", "raise")).toBe("");
  });

  it("returns empty for a non-small-pair hand (rationale only covers the small-pair boundary)", () => {
    expect(cellRationale("AKs", "UTG", "raise")).toBe(""); // not a small pair
    expect(cellRationale("72o", "UTG", "fold")).toBe(""); // a fold, but not a small pair
    expect(cellRationale("66", "MP", "raise")).toBe(""); // 66 is outside the 22–55 boundary band
  });
});

describe("cellRationale (iter-24 MAJOR — suited-ace raise/fold boundary, A5s opens vs A7s folds)", () => {
  // The chart DATA is intentional (the recognized low-suited-ace construction) and UNCHANGED — the
  // defect was that the win% (A7s ~61 > A5s ~60) read as contradicting the advice with no explanation.
  // These assertions check the EXPLANATION, not the data: key substrings, never exact prose.
  it("explains a MIDDLING suited ace the chart FOLDS as DOMINATED / overstated raw equity (A7s MP)", () => {
    expect(chartAction(["Ah", "7h"] as [Card, Card], "MP", "unopened")).toBe("fold");
    const r = cellRationale("A7s", "MP", "fold").toLowerCase();
    expect(r).not.toBe("");
    expect(r).toContain("dominated");
    expect(r).toContain("overstates");
  });

  it("also explains A6s MP as a dominated fold (the other middling suited ace)", () => {
    expect(chartAction(["Ah", "6h"] as [Card, Card], "MP", "unopened")).toBe("fold");
    const r = cellRationale("A6s", "MP", "fold").toLowerCase();
    expect(r).toContain("dominated");
    expect(r).toContain("overstates");
  });

  it("explains a WHEEL suited ace the chart OPENS via playability/blocker/straight, noting A7s's higher raw number (A5s MP)", () => {
    expect(chartAction(["Ah", "5h"] as [Card, Card], "MP", "unopened")).toBe("raise");
    const r = cellRationale("A5s", "MP", "raise").toLowerCase();
    expect(r).not.toBe("");
    expect(r).toContain("a7s"); // explicitly references the higher-raw-number hand
    expect(r).toContain("nut flush");
    expect(r).toContain("straight");
    expect(r).toContain("block"); // the ace-blocker effect
  });

  it("explains A5s the same way from UTG (the lone wheel-ace blocker the chart opens UTG)", () => {
    expect(chartAction(["Ah", "5h"] as [Card, Card], "UTG", "unopened")).toBe("raise");
    const r = cellRationale("A5s", "UTG", "raise").toLowerCase();
    expect(r).toContain("nut flush");
    expect(r).toContain("block");
  });

  it("explains A4s MP as a wheel-ace open too (the other wheel ace the chart opens from MP)", () => {
    expect(chartAction(["Ah", "4h"] as [Card, Card], "MP", "unopened")).toBe("raise");
    const r = cellRationale("A4s", "MP", "raise").toLowerCase();
    expect(r).not.toBe("");
    expect(r).toContain("straight");
  });

  it("returns empty for hands OUTSIDE the suited-ace special cases", () => {
    expect(cellRationale("KQs", "MP", "raise")).toBe(""); // not an ace
    expect(cellRationale("AQs", "MP", "raise")).toBe(""); // a strong ace, not a wheel/middling boundary
    expect(cellRationale("72o", "UTG", "fold")).toBe(""); // a random offsuit fold
    expect(cellRationale("A5s", "BTN", "raise")).toBe(""); // late position — no early-seat boundary
    expect(cellRationale("A5o", "MP", "raise")).toBe(""); // offsuit ace — not the suited-wheel case
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
