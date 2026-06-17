import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MentalMathSection } from "@/components/MentalMathSection";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { Card } from "@/core/cards";

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
  act(() => {
    useSessionStore.setState((s) => ({
      mentalMathOpen: true,
      displayUnit: "usd",
      settings: { ...s.settings, coachingDepth: "equity" },
    }));
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

  // iter-03 #12 — at showdown / hand-complete the live decision clears (status → no-hand). Don't
  // revert to the jarring "deal a hand" placeholder right after rich content; show a graceful
  // "hand complete — see the hand review" note instead.
  it("shows a 'hand complete' note (not the 'deal a hand' placeholder) when the hand is over (#12)", () => {
    setFlow({ isOver: () => true, isHeroTurn: () => false });
    render(<MentalMathSection enabled />);
    const note = screen.getByTestId("mm-hand-complete");
    expect(note.textContent).toMatch(/hand complete/i);
    expect(note.textContent).toMatch(/hand review/i);
    expect(screen.queryByText(/deal a hand and reach the flop/i)).toBeNull();
  });

  it("still shows the 'deal a hand' placeholder when there is no hand at all", () => {
    act(() => useGameStore.setState({ flow: null, tick: 1 }));
    render(<MentalMathSection enabled />);
    expect(screen.getByText(/deal a hand and reach the flop/i)).toBeInTheDocument();
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
  // iter-07 #1: the "true win" is now the SAME number the verdict/equity bar show — passed in as a
  // prop, no separate Monte Carlo, no loading state.
  it("hides the Check-your-work block when no verdict equity is supplied", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled />);
    expect(screen.getByTestId("mm-steps")).toBeInTheDocument();
    expect(screen.queryByTestId("mm-true-equity")).toBeNull();
  });

  it("uses the supplied verdict equity for hit-vs-win, closeness, and the dollar EV", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    const check = screen.getByTestId("mm-true-equity");
    expect(check.textContent).toContain("You hit ~60%");
    expect(check.textContent).toContain("True win ≈ 51%");
    expect(screen.getByTestId("mm-closeness").textContent).toMatch(/within \d+% of the exact hit chance/);
    expect(screen.getByTestId("mm-ev").textContent).toMatch(/based on the true equity/);
  });

  it("the Mental Math true win equals the verdict's equityPct for the same spot (#1)", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={35} />);
    expect(screen.getByTestId("mm-true-equity").textContent).toContain("True win ≈ 35%");
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

describe("MentalMathSection — made-hand reconciliation (findings #1/#2/#3)", () => {
  // A2 on 4A3: top pair + gutshot, ~47% true equity. The outs model alone would say "fold".
  const topPairGutshot = () =>
    fakeFlow({ hole: [c("Ah"), c("2h")], board: [c("4h"), c("Ac"), c("3d")], potBefore: 32, toCall: 12 });

  it("surfaces the made hand in Step 1 instead of an outs-only fold", () => {
    setFlow(topPairGutshot());
    render(<MentalMathSection enabled verdictEquityPct={47} />);
    expect(screen.getByTestId("mm-made-hand").textContent).toMatch(/top pair/i);
    const conclusion = screen.getByTestId("mm-conclusion");
    // The reconciled conclusion must be profitable, never "fold / price too steep".
    expect(conclusion.textContent?.toLowerCase()).not.toContain("too steep");
    expect(conclusion.textContent?.toLowerCase()).toContain("profitable");
  });

  it("gap explanation blames the made hand, not opponents + board danger", () => {
    setFlow(topPairGutshot());
    render(<MentalMathSection enabled verdictEquityPct={47} />);
    const gap = screen.getByTestId("mm-gap");
    expect(gap.textContent?.toLowerCase()).toContain("top pair");
    expect(gap.textContent?.toLowerCase()).not.toContain("opponents + board danger");
  });

  it("a pure draw still blames opponents + board danger in the gap line", () => {
    setFlow(fakeFlow()); // QhJh draw, no made hand
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    expect(screen.queryByTestId("mm-made-hand")).toBeNull();
    const gap = screen.getByTestId("mm-gap");
    expect(gap.textContent?.toLowerCase()).toContain("opponents + board danger");
  });

  // iter-07 #2b: a made hand at LOW unified equity (top pair multiway at ~35%) must NOT claim
  // "often ahead" — it must read as marginal and match the verdict's grade.
  it("does NOT claim 'often ahead' for top pair at low multiway equity (#2b)", () => {
    setFlow(
      fakeFlow({
        hole: [c("Ah"), c("2h")],
        board: [c("4h"), c("Ac"), c("3d")],
        potBefore: 32,
        toCall: 12,
        numActiveOpponents: 4,
      }),
    );
    render(<MentalMathSection enabled verdictEquityPct={35} />);
    const made = screen.getByTestId("mm-made-hand").textContent?.toLowerCase() ?? "";
    expect(made).not.toContain("often ahead");
    expect(made).toContain("marginal");
    expect(made).toContain("35%");
  });

  it("DOES claim 'often ahead' for a made hand at high unified equity (#2b)", () => {
    setFlow(topPairGutshot());
    render(<MentalMathSection enabled verdictEquityPct={72} />);
    expect(screen.getByTestId("mm-made-hand").textContent?.toLowerCase()).toContain("often ahead");
  });
});

describe("MentalMathSection — dollar-EV verb matches the action (iter-08 #2)", () => {
  it("a value BET (no bet to call) says 'Betting is worth …', not 'Calling'", () => {
    // toCall 0 → there is no bet to call; the money goes in as a BET. Trip-queens-style value bet.
    setFlow(
      fakeFlow({
        hole: [c("Qs"), c("Qd")],
        board: [c("Qh"), c("4h"), c("8c"), c("2d")],
        street: "turn",
        toCall: 0,
        potBefore: 220,
      }),
    );
    render(<MentalMathSection enabled verdictEquityPct={85} />);
    const ev = screen.getByTestId("mm-ev").textContent ?? "";
    expect(ev).toMatch(/Betting is worth/);
    expect(ev).not.toMatch(/Calling is worth/);
  });

  it("facing a bet (toCall > 0) still says 'Calling is worth …'", () => {
    setFlow(fakeFlow({ toCall: 20, potBefore: 60 })); // drawing spot, facing a bet
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    const ev = screen.getByTestId("mm-ev").textContent ?? "";
    expect(ev).toMatch(/Calling is worth/);
    expect(ev).not.toMatch(/Betting is worth/);
  });
});

describe("MentalMathSection — Conceptual depth hides jargon (iter-08 #4)", () => {
  it("the preflop note contains no 'Rule of 2 & 4' and no Preflop Chart reference at Conceptual depth", () => {
    act(() => useSessionStore.setState((s) => ({ settings: { ...s.settings, coachingDepth: "conceptual" } })));
    setFlow(fakeFlow({ street: "preflop", board: [] }));
    render(<MentalMathSection enabled />);
    const body = screen.getByTestId("mm-body").textContent ?? "";
    expect(body).not.toMatch(/Rule of 2 ?& ?4/i);
    expect(body).not.toMatch(/Preflop Chart/i);
  });

  it("a flop drawing spot at Conceptual depth shows no 'Rule of 2 & 4' label", () => {
    act(() => useSessionStore.setState((s) => ({ settings: { ...s.settings, coachingDepth: "conceptual" } })));
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    const body = screen.getByTestId("mm-body").textContent ?? "";
    expect(body).not.toMatch(/Rule of 2 ?& ?4/i);
  });

  it("keeps the 'Rule of 2 & 4' jargon at Equity depth (numbers expected)", () => {
    act(() => useSessionStore.setState((s) => ({ settings: { ...s.settings, coachingDepth: "equity" } })));
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    const body = screen.getByTestId("mm-body").textContent ?? "";
    expect(body).toMatch(/Rule of 2 ?& ?4/i);
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
