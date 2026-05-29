import { describe, it, expect } from "vitest";
import { handKey, chartAction } from "@/core/charts/preflop";
import { Card } from "@/core/cards";

const hand = (a: string, b: string): [Card, Card] => [a as Card, b as Card];

describe("handKey", () => {
  it("canonicalizes to 169-grid notation (higher rank first)", () => {
    expect(handKey(hand("Ah", "Kh"))).toBe("AKs");
    expect(handKey(hand("Kd", "As"))).toBe("AKo");
    expect(handKey(hand("7c", "7d"))).toBe("77");
    expect(handKey(hand("2d", "7c"))).toBe("72o");
  });
});

describe("chartAction", () => {
  it("AKs is an open from CO", () => {
    expect(chartAction(hand("Ah", "Kh"), "CO", "unopened")).toBe("raise");
  });

  it("72o is a fold UTG", () => {
    expect(chartAction(hand("7c", "2d"), "UTG", "unopened")).toBe("fold");
  });

  it("UTG opens are tighter than BTN opens (T7o folds UTG, opens BTN range stays wide)", () => {
    expect(chartAction(hand("9c", "8c"), "UTG", "unopened")).toBe("raise");
    expect(chartAction(hand("5c", "4c"), "UTG", "unopened")).toBe("fold");
    expect(chartAction(hand("5c", "4c"), "BTN", "unopened")).toBe("raise");
  });

  it("BB defends a reasonable hand vs a raise and folds trash", () => {
    expect(chartAction(hand("Ks", "9s"), "BB", "raise")).toBe("call");
    expect(chartAction(hand("Ah", "Kd"), "BB", "raise")).toBe("raise"); // 3bet premium
    expect(chartAction(hand("7c", "2d"), "BB", "raise")).toBe("fold");
  });
});
