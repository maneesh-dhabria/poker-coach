import { describe, it, expect } from "vitest";
import { countOuts } from "@/core/mental/outs";
import { Card } from "@/core/cards";

const h = (cards: string[]) => cards.map((s) => s as Card);
const hole = (a: string, b: string) => [a as Card, b as Card] as [Card, Card];

describe("countOuts — the guide's worked example", () => {
  it("Q♥J♥ on 10♥9♣2♥ → 15 outs (9 flush + 8 OESD − 2 overlap)", () => {
    const o = countOuts(hole("Qh", "Jh"), h(["Th", "9c", "2h"]));
    expect(o.totalOuts).toBe(15);
    expect(o.overlapCount).toBe(2);
    const kinds = o.groups.map((g) => g.kind).sort();
    expect(kinds).toEqual(["flush", "open-ended-straight"]);
    // K♥ and 8♥ each complete both draws but are counted once.
    expect(o.uniqueOutCards.filter((c) => c === ("Kh" as Card)).length).toBe(1);
    expect(o.uniqueOutCards).toContain("8h" as Card);
    // No overcards added when a flush/straight draw is present.
    expect(o.groups.some((g) => g.kind === "overcards")).toBe(false);
    expect(o.hardOuts).toBe(15);
  });
});

describe("countOuts — single draw shapes", () => {
  it("bare flush draw (exactly 4 to a flush) → 9 outs", () => {
    const o = countOuts(hole("8h", "6h"), h(["Kh", "Qh", "3c"]));
    expect(o.totalOuts).toBe(9);
    expect(o.groups).toHaveLength(1);
    expect(o.groups[0].kind).toBe("flush");
    expect(o.groups[0].label).toContain("hearts");
  });

  it("open-ended straight draw → 8 outs (two completer ranks)", () => {
    // 9♦8♣ on 7♠6♥2♦ → needs T or 5 → open-ended, no flush.
    const o = countOuts(hole("9d", "8c"), h(["7s", "6h", "2d"]));
    expect(o.totalOuts).toBe(8);
    expect(o.groups[0].kind).toBe("open-ended-straight");
  });

  it("gutshot → 4 outs (one completer rank)", () => {
    // J♦9♣ on 8♠7♥2♦ → needs a Ten (T) only → gutshot.
    const o = countOuts(hole("Jd", "9c"), h(["8s", "7h", "2d"]));
    expect(o.totalOuts).toBe(4);
    expect(o.groups[0].kind).toBe("gutshot");
    expect(o.groups[0].label.toLowerCase()).toContain("gutshot");
  });

  it("two overcards on a low rainbow board → 6 soft outs", () => {
    const o = countOuts(hole("As", "Kd"), h(["8h", "5c", "2d"]));
    expect(o.totalOuts).toBe(6);
    expect(o.groups[0].kind).toBe("overcards");
    expect(o.groups[0].soft).toBe(true);
    expect(o.hardOuts).toBe(0);
  });
});

describe("countOuts — combos, overlap, and guards", () => {
  it("flush + gutshot dedupes the shared out (≈12 union)", () => {
    // 9♥8♥ on K♥6♥5♣ → flush(9) + gutshot needing 7 (7♥ overlaps) → 12.
    const o = countOuts(hole("9h", "8h"), h(["Kh", "6h", "5c"]));
    expect(o.totalOuts).toBe(12);
    expect(o.overlapCount).toBe(1);
    expect(o.uniqueOutCards.filter((c) => c === ("7h" as Card)).length).toBe(1);
  });

  it("does not count a 3-to-a-flush backdoor", () => {
    const o = countOuts(hole("6h", "5h"), h(["Kh", "9c", "2d"]));
    expect(o.totalOuts).toBe(0);
    expect(o.groups[0].kind).toBe("none");
  });

  it("reports no-draw when hero already holds a made straight", () => {
    const o = countOuts(hole("7h", "6h"), h(["5s", "4d", "3c"]));
    expect(o.totalOuts).toBe(0);
    expect(o.groups[0].kind).toBe("none");
  });

  it("does not add overcards when hero already has a pair", () => {
    // A♣K♦ pairs the K on board → no overcard outs (already has top pair).
    const o = countOuts(hole("Ac", "Kd"), h(["Ks", "7h", "2d"]));
    expect(o.groups.some((g) => g.kind === "overcards")).toBe(false);
    expect(o.totalOuts).toBe(0);
  });
});
