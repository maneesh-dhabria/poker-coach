import { describe, it, expect } from "vitest";
import { rank5, rank7, categoryOf, HandCategory } from "@/core/eval/handEval";
import { Card } from "@/core/cards";

const c = (s: string) => s as Card;

describe("rank5 categories", () => {
  it("straight flush beats quads beats full house", () => {
    const sf = rank5(["9h", "8h", "7h", "6h", "5h"].map(c));
    const quads = rank5(["9h", "9d", "9c", "9s", "5h"].map(c));
    const boat = rank5(["9h", "9d", "9c", "5s", "5h"].map(c));
    expect(categoryOf(sf)).toBe(HandCategory.StraightFlush);
    expect(categoryOf(quads)).toBe(HandCategory.Quads);
    expect(categoryOf(boat)).toBe(HandCategory.FullHouse);
    expect(sf).toBeGreaterThan(quads);
    expect(quads).toBeGreaterThan(boat);
  });

  it("flush beats straight beats trips beats two pair beats pair beats high", () => {
    const flush = rank5(["Ah", "Jh", "8h", "5h", "2h"].map(c));
    const straight = rank5(["9h", "8d", "7c", "6s", "5h"].map(c));
    const trips = rank5(["9h", "9d", "9c", "6s", "5h"].map(c));
    const twoPair = rank5(["9h", "9d", "6c", "6s", "5h"].map(c));
    const pair = rank5(["9h", "9d", "Kc", "6s", "5h"].map(c));
    const high = rank5(["Ah", "Jd", "8c", "5s", "2h"].map(c));
    expect(flush).toBeGreaterThan(straight);
    expect(straight).toBeGreaterThan(trips);
    expect(trips).toBeGreaterThan(twoPair);
    expect(twoPair).toBeGreaterThan(pair);
    expect(pair).toBeGreaterThan(high);
  });

  it("recognizes the wheel (A-2-3-4-5) as a straight", () => {
    const wheel = rank5(["Ah", "2d", "3c", "4s", "5h"].map(c));
    expect(categoryOf(wheel)).toBe(HandCategory.Straight);
    // wheel is the lowest straight: lower than 6-high straight
    const sixHigh = rank5(["6h", "2d", "3c", "4s", "5h"].map(c));
    expect(sixHigh).toBeGreaterThan(wheel);
  });

  it("higher pair beats lower pair; kickers break ties", () => {
    const aces = rank5(["Ah", "Ad", "Kc", "5s", "2h"].map(c));
    const kings = rank5(["Kh", "Kd", "Ac", "5s", "2h"].map(c));
    const acesBetterKicker = rank5(["Ah", "Ad", "Kc", "6s", "2h"].map(c));
    expect(aces).toBeGreaterThan(kings);
    expect(acesBetterKicker).toBeGreaterThan(aces);
  });
});

describe("rank7", () => {
  it("picks the best 5 of 7", () => {
    // 7 cards containing a flush
    const score = rank7(["Ah", "Kh", "Qh", "2h", "5h", "9d", "3c"].map(c));
    expect(categoryOf(score)).toBe(HandCategory.Flush);
  });
  it("a made full house from 7 beats a flush board for another hand", () => {
    const boat = rank7(["9h", "9d", "9c", "5s", "5h", "2c", "3d"].map(c));
    const flush = rank7(["Ah", "Kh", "Qh", "2h", "5h", "9d", "3c"].map(c));
    expect(boat).toBeGreaterThan(flush);
  });
});
