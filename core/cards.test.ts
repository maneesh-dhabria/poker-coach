import { describe, it, expect } from "vitest";
import { makeDeck, mulberry32, shuffle, rankValue, draw, Card } from "@/core/cards";

describe("cards", () => {
  it("makes a 52-card deck with no duplicates", () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
  });

  it("rankValue: A high, 2 low", () => {
    expect(rankValue("As" as Card)).toBe(14);
    expect(rankValue("2c" as Card)).toBe(2);
    expect(rankValue("Td" as Card)).toBe(10);
  });

  it("shuffle is deterministic for a given seed", () => {
    const deck = makeDeck();
    const a = shuffle(deck, mulberry32(42));
    const b = shuffle(deck, mulberry32(42));
    const cDiff = shuffle(deck, mulberry32(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(cDiff);
  });

  it("draw excludes given cards and returns the requested count", () => {
    const deck = makeDeck();
    const exclude = new Set<Card>(["As", "Kd"] as Card[]);
    const drawn = draw(deck, 5, mulberry32(7), exclude);
    expect(drawn).toHaveLength(5);
    expect(drawn).not.toContain("As");
    expect(drawn).not.toContain("Kd");
  });
});
