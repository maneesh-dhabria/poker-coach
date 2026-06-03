import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MentalMathSection } from "@/components/MentalMathSection";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { requestEquity } from "@/core/equity/equityClient";
import { Card } from "@/core/cards";

vi.mock("@/core/equity/equityClient", () => ({ requestEquity: vi.fn() }));
const mockEquity = requestEquity as unknown as Mock;

const c = (s: string) => s as Card;

// A fake HandFlow exposing only what MentalMathSection reads (spec §3.1).
function fakeFlow(over: {
  isHeroTurn?: boolean;
  hole?: [Card, Card];
  board?: Card[];
  street?: string;
  potBefore?: number;
  toCall?: number;
  numActiveOpponents?: number;
} = {}) {
  const hole = over.hole ?? [c("Qh"), c("Jh")];
  const board = over.board ?? [c("Th"), c("9c"), c("2h")];
  const street = over.street ?? "flop";
  const numActiveOpponents = over.numActiveOpponents ?? 1;
  return {
    isOver: () => false,
    isHeroTurn: () => over.isHeroTurn ?? true,
    heroSpot: () => ({
      legal: {},
      hole,
      board,
      potBefore: over.potBefore ?? 60,
      toCall: over.toCall ?? 20,
      street,
      position: "BTN",
      numActiveOpponents,
      facing: "unopened",
      stackBb: 100,
    }),
    heroHole: () => hole,
    board,
    street,
    potNow: () => over.potBefore ?? 60,
    tableView: () => ({
      seats: [
        { isHero: true, folded: false },
        { isHero: false, folded: false },
      ],
    }),
  };
}

function setFlow(flow: unknown) {
  act(() => {
    useGameStore.setState({ flow: flow as never, tick: 1, seed: 1 });
  });
}

beforeEach(() => {
  cleanup();
  mockEquity.mockReset();
  mockEquity.mockReturnValue(new Promise(() => {})); // pending by default — keeps steps visible
  act(() => {
    useSessionStore.setState({ mentalMathOpen: true, displayUnit: "usd" });
    useGameStore.setState({ flow: null, tick: 0, seed: 1 });
  });
});

describe("MentalMathSection — visibility", () => {
  it("renders nothing when feedback is disabled", () => {
    const { container } = render(<MentalMathSection enabled={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("is collapsed by default (header only, no steps)", () => {
    act(() => useSessionStore.setState({ mentalMathOpen: false }));
    setFlow(fakeFlow());
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-header")).toBeInTheDocument();
    expect(screen.queryByTestId("mm-steps")).toBeNull();
  });

  it("expands to the six steps for an ok hand", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled />);
    const steps = screen.getByTestId("mm-steps");
    expect(steps.textContent).toContain("Step 1");
    expect(steps.textContent).toContain("Step 6");
    expect(screen.getByTestId("mm-rule-hit").textContent).toBe("60%");
  });
});

describe("MentalMathSection — Step 1 outs & soft tag", () => {
  it("lists the detected draw groups and the total", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled />);
    const steps = screen.getByTestId("mm-steps");
    expect(steps.textContent).toContain("Flush draw");
    expect(steps.textContent).toContain("Open-ended straight");
    expect(steps.textContent).toContain("15 outs");
  });

  it("shows a soft tag for overcard outs", () => {
    setFlow(fakeFlow({ hole: [c("As"), c("Kd")], board: [c("8h"), c("5c"), c("2d")] }));
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-soft-tag")).toBeInTheDocument();
  });
});

describe("MentalMathSection — edge-state notes", () => {
  it("shows the no-hand note when there is no live hand", () => {
    setFlow(null);
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-note").textContent).toMatch(/Deal a hand/i);
  });

  it("shows the preflop note", () => {
    setFlow(fakeFlow({ street: "preflop", board: [] }));
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-note").textContent).toMatch(/Preflop Chart/i);
  });

  it("shows the river note", () => {
    setFlow(fakeFlow({ street: "river", board: [c("Th"), c("9c"), c("2h"), c("3s"), c("4d")] }));
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-note").textContent).toMatch(/No cards left to come/i);
  });
});

describe("MentalMathSection — true equity comparison (Check your work)", () => {
  it("shows a loading state while equity computes, with steps already visible", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-steps")).toBeInTheDocument();
    expect(screen.getByTestId("mm-equity-loading")).toBeInTheDocument();
  });

  it("resolves into hit-vs-win, closeness, and the dollar EV", async () => {
    mockEquity.mockResolvedValue({ equityPct: 51, iterations: 1500, ms: 0 });
    setFlow(fakeFlow());
    render(<MentalMathSection enabled />);
    const check = await screen.findByTestId("mm-true-equity");
    expect(check.textContent).toContain("You hit ~60%");
    expect(check.textContent).toContain("True win ≈ 51%");
    expect(screen.getByTestId("mm-closeness").textContent).toMatch(/within \d+% of the exact hit chance/);
    expect(screen.getByTestId("mm-ev").textContent).toMatch(/based on the true equity/);
  });
});

describe("MentalMathSection — live-hand tracking (regression)", () => {
  // The store mutates ONE HandFlow instance in place and only bumps `tick` as the hand advances
  // (its identity is stable for the whole hand — see gameStore.heroAct). The section must re-derive
  // its input on `tick`, not on `flow` identity, or it freezes at the first snapshot (spec §3.1, FR-02).
  it("re-derives the estimate as the live hand advances (stable flow identity, tick bumps)", () => {
    const state = { street: "preflop", board: [] as Card[] };
    const stableFlow = {
      isOver: () => false,
      isHeroTurn: () => true,
      heroSpot: () => ({
        legal: {},
        hole: [c("Qh"), c("Jh")] as [Card, Card],
        board: state.board,
        potBefore: 60,
        toCall: 20,
        street: state.street,
        position: "BTN",
        numActiveOpponents: 1,
        facing: "unopened",
        stackBb: 100,
      }),
      heroHole: () => [c("Qh"), c("Jh")] as [Card, Card],
      get board() {
        return state.board;
      },
      get street() {
        return state.street;
      },
      potNow: () => 60,
      tableView: () => ({ seats: [{ isHero: true, folded: false }, { isHero: false, folded: false }] }),
    };
    setFlow(stableFlow);
    render(<MentalMathSection enabled />);
    // Preflop snapshot: the Rule-of-2&4 note, no step cards yet.
    expect(screen.getByTestId("mm-note").textContent).toMatch(/Preflop Chart/i);
    expect(screen.queryByTestId("mm-steps")).toBeNull();

    // The dealer advances to the flop: SAME flow object, mutated in place, only `tick` bumps.
    act(() => {
      state.street = "flop";
      state.board = [c("Th"), c("9c"), c("2h")];
      useGameStore.setState((s) => ({ tick: s.tick + 1 }));
    });

    // The section must now reflect the live flop draw — not the frozen preflop snapshot.
    expect(screen.queryByTestId("mm-note")).toBeNull();
    expect(screen.getByTestId("mm-steps").textContent).toContain("15 outs");
    expect(screen.getByTestId("mm-rule-hit").textContent).toBe("60%");
  });
});

describe("MentalMathSection — override (I count differently)", () => {
  it("recomputes Steps 2–6 from the player's count and resets to auto", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-rule-hit").textContent).toBe("60%"); // 15 × 4

    fireEvent.click(screen.getByTestId("mm-override-toggle")); // opens, seeds override = 15
    fireEvent.click(screen.getByTestId("mm-outs-dec")); // 14 outs
    expect(screen.getByTestId("mm-rule-hit").textContent).toBe("56%"); // 14 × 4

    fireEvent.click(screen.getByTestId("mm-outs-reset"));
    expect(screen.getByTestId("mm-rule-hit").textContent).toBe("60%");
  });
});
