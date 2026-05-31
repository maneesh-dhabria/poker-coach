import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CenterStack } from "@/components/table/CenterStack";
import { ReplaySnapshot } from "@/core/handFlow";

beforeEach(() => cleanup());

function snap(overrides: Partial<ReplaySnapshot> = {}): ReplaySnapshot {
  return {
    pot: 37,
    street: "flop",
    boardCount: 3,
    roundContributions: [
      { seat: 2, name: "Bot 2", action: "bet", amount: 9 },
      { seat: 5, name: "Bot 5", action: "call", amount: 9 },
      { seat: 3, name: "Bot 3", action: "call", amount: 9 },
    ],
    ...overrides,
  };
}

describe("CenterStack", () => {
  it("shows the pot total", () => {
    render(<CenterStack snapshot={snap()} />);
    expect(screen.getByTestId("pot")).toHaveTextContent("$37");
  });

  it("renders one breakdown row per contribution with name + action", () => {
    render(<CenterStack snapshot={snap()} />);
    const rows = screen.getAllByTestId("pot-contribution");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Bot 2");
    expect(rows[0]).toHaveTextContent("Bet $9");
  });

  it("renders no breakdown rows when nobody has committed chips this round", () => {
    render(<CenterStack snapshot={snap({ roundContributions: [] })} />);
    expect(screen.queryByTestId("pot-contribution")).toBeNull();
  });

  it("renders at least one chip in the pile when the pot is non-zero", () => {
    render(<CenterStack snapshot={snap()} />);
    expect(screen.getAllByTestId("pile-chip").length).toBeGreaterThan(0);
  });
});

describe("CenterStack — showdown category banner (T8)", () => {
  it("shows the hand-category banner when given a label", () => {
    render(<CenterStack snapshot={snap()} categoryBanner="Two Pair, Aces & Kings" />);
    expect(screen.getByText("Two Pair, Aces & Kings")).toBeTruthy();
  });

  it("renders no banner when none is given (e.g. folded-out hand)", () => {
    render(<CenterStack snapshot={snap()} />);
    expect(screen.queryByTestId("category-banner")).toBeNull();
  });
});
