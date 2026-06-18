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

  // iter-14 #8: when the verdict's EV rows are threaded in, the dollar-EV note for a BET uses the BET
  // row (ev.raise) — the SAME figure the "Show the numbers" table shows — never the CHECK row.
  it("(iter-14 #8) the 'Betting is worth' figure uses the BET (ev.raise) row, not the check figure", () => {
    setFlow(
      fakeFlow({
        hole: [c("Qs"), c("Qd")],
        board: [c("Qh"), c("4h"), c("8c"), c("2d")],
        street: "turn",
        toCall: 0,
        potBefore: 45,
      }),
    );
    // The verdict EV table: check $24 / bet $27 (the reviewer's exact mismatch). The note must show $27.
    render(
      <MentalMathSection enabled verdictEquityPct={85} actionEv={{ fold: 0, call: 24, raise: 27 }} />,
    );
    const ev = screen.getByTestId("mm-ev").textContent ?? "";
    expect(ev).toMatch(/Betting is worth/);
    expect(ev).toContain("$27");
    expect(ev).not.toContain("$24");
  });
});

describe("MentalMathSection — Conceptual depth renders nothing numeric (iter-09 #2)", () => {
  // iter-08 suppressed only the named jargon, leaving the FULL numeric body (percentages, outs, ×4,
  // pot-odds, Rule-of-4 reconciliation) visible — a depth leak, since Conceptual promises "no
  // numbers". Mental Math is fundamentally a numeric tool, so at Conceptual depth the cleanest fix is
  // to render NOTHING AT ALL (section + toggle + caption gone). The plain-words verdict headline is
  // the Conceptual coaching.
  it("renders nothing (null) at Conceptual depth — a flop drawing spot", () => {
    act(() => useSessionStore.setState((s) => ({ settings: { ...s.settings, coachingDepth: "conceptual" } })));
    setFlow(fakeFlow());
    const { container } = render(<MentalMathSection enabled verdictEquityPct={51} />);
    expect(container.firstChild).toBeNull();
    // No section, no toggle/caption, and crucially zero digits/percentages anywhere.
    expect(screen.queryByTestId("mm-section")).toBeNull();
    expect(screen.queryByTestId("mm-header")).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/[0-9]/);
  });

  it("renders nothing (null) at Conceptual depth — a preflop spot", () => {
    act(() => useSessionStore.setState((s) => ({ settings: { ...s.settings, coachingDepth: "conceptual" } })));
    setFlow(fakeFlow({ street: "preflop", board: [] }));
    const { container } = render(<MentalMathSection enabled />);
    expect(container.firstChild).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/[0-9]/);
  });

  it("DOES render the numeric Mental Math at Equity depth (Rule of 2 & 4 + percentages)", () => {
    act(() => useSessionStore.setState((s) => ({ settings: { ...s.settings, coachingDepth: "equity" } })));
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    const body = screen.getByTestId("mm-body").textContent ?? "";
    expect(body).toMatch(/Rule of 2 ?& ?4/i);
    expect(body).toMatch(/%/);
  });

  it("DOES render the numeric Mental Math at Strict depth", () => {
    act(() => useSessionStore.setState((s) => ({ settings: { ...s.settings, coachingDepth: "strict" } })));
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    expect(screen.getByTestId("mm-section")).toBeInTheDocument();
    expect((screen.getByTestId("mm-body").textContent ?? "")).toMatch(/%/);
  });
});

describe("MentalMathSection — pinned to the frozen decision snapshot (iter-12 #2/#4/#5)", () => {
  // The verdict above is FROZEN on the flop (middle pair, 2 opponents) while the live store has
  // advanced to the turn (two pair, board changed). Mental Math must describe the FROZEN flop
  // decision — same board, street, made-hand label, and opponent count — not the live turn.
  // Hero 7c6c on 9h-8c-7s: middle pair (7) + an open-ended straight draw — a made hand WITH outs, so
  // Step 2/Step 3 (the draw steps) render and we can check the shade labeling too.
  const frozenFlop = {
    hole: [c("7c"), c("6c")] as [Card, Card],
    board: [c("9h"), c("8c"), c("7s")] as Card[],
    street: "flop" as const,
    potBefore: 12,
    toCall: 12,
    numActiveOpponents: 2,
    madeHand: { category: 2, label: "middle pair" },
  };

  it("uses the frozen made-hand label / street / opponent count, ignoring a later live board", () => {
    // Live store is on the TURN with a board that makes TWO PAIR — the drift the fix kills.
    setFlow(
      fakeFlow({
        hole: [c("7c"), c("6c")],
        board: [c("9h"), c("8c"), c("7s"), c("9c")], // turn pairs the 9 → board two pair, live turn
        street: "turn",
        numActiveOpponents: 4,
        potBefore: 80,
      }),
    );
    render(<MentalMathSection enabled verdictEquityPct={47} frozen={frozenFlop} />);
    const body = screen.getByTestId("mm-body").textContent ?? "";
    // The made-hand label matches the FROZEN verdict (middle pair), never the live "two pair".
    expect(screen.getByTestId("mm-made-hand").textContent?.toLowerCase()).toContain("middle pair");
    expect(body.toLowerCase()).not.toContain("two pair");
    // Step 2 reads the frozen FLOP street (×4), not the live turn (×2).
    expect(body).toContain("Flop → ×4");
    // The header context line names the frozen flop board + street.
    expect(screen.getByTestId("mm-header").textContent ?? "").toContain("flop");
  });

  it("labels the shaded Step-3 figure as draw-HIT (not win) when a made hand is present (iter-12 #1)", () => {
    setFlow(fakeFlow()); // live state present but irrelevant; frozen drives the math
    render(<MentalMathSection enabled verdictEquityPct={54} frozen={frozenFlop} />);
    const body = screen.getByTestId("mm-body").textContent ?? "";
    // Only ONE figure may be labeled "to win" (the true-win / verdict). Step 3's shaded number is a
    // draw-hit chance, explicitly NOT "to win".
    const shade = screen.queryByTestId("mm-shade-figure");
    if (shade) {
      expect(shade.textContent?.toLowerCase()).toContain("to hit your draw");
      expect(shade.textContent?.toLowerCase()).not.toContain("to win");
    }
    expect(screen.getByTestId("mm-shade-madehand-note").textContent?.toLowerCase()).toMatch(
      /already have middle pair/,
    );
    expect(body).toContain("True win ≈ 54%");
  });
});

describe("MentalMathSection — free-street bet reconciliation (iter-13 #1)", () => {
  // A pure draw / air on a free street (no bet to call, no made hand): hero 9c8c on Kd-7d-2h-Js. A
  // flush draw to come, no made hand. betBeatsCheck false (a -EV semi-bluff the verdict grades ❌/⚠️).
  const frozenAirBet = (action: "bet" | "check") => ({
    hole: [c("9d"), c("8d")] as [Card, Card], // a flush draw to the diamonds — a draw, no made hand
    board: [c("Kd"), c("7d"), c("2h")] as Card[],
    street: "flop" as const,
    potBefore: 20,
    toCall: 0,
    numActiveOpponents: 1,
    madeHand: null,
    heroAction: action,
  });

  it("hero BET a low-equity no-made-hand hand → Step 6 reconciles with the mistake, NOT 'just take it'", () => {
    setFlow(fakeFlow());
    render(
      <MentalMathSection
        enabled
        verdictEquityPct={20}
        betBeatsCheck={false}
        frozen={frozenAirBet("bet")}
      />,
    );
    const concl = screen.getByTestId("mm-conclusion").textContent?.toLowerCase() ?? "";
    expect(concl).toContain("you bet");
    expect(concl).toContain("cheaper");
    expect(concl).not.toContain("just take it");
    // Step 5 must not imply a free card was taken when the hero chose to bet.
    const body = screen.getByTestId("mm-body").textContent ?? "";
    expect(body).toContain("you chose to bet");
  });

  it("hero CHECKED the same spot → keeps the free-card line", () => {
    setFlow(fakeFlow());
    render(
      <MentalMathSection
        enabled
        verdictEquityPct={20}
        betBeatsCheck={false}
        frozen={frozenAirBet("check")}
      />,
    );
    const concl = screen.getByTestId("mm-conclusion").textContent?.toLowerCase() ?? "";
    expect(concl).toContain("free card");
    expect(concl).toContain("take it");
  });

  it("Step 3's shaded figure is labeled 'to hit' (not 'to win') with no made hand — only true-win is 'to win' (iter-13 #4)", () => {
    setFlow(fakeFlow());
    // Two opponents so the shade band actually renders (lowPct !== highPct).
    render(
      <MentalMathSection
        enabled
        verdictEquityPct={30}
        frozen={{ ...frozenAirBet("check"), numActiveOpponents: 2 }}
      />,
    );
    const shade = screen.queryByTestId("mm-shade-figure");
    if (shade) {
      const txt = shade.textContent?.toLowerCase() ?? "";
      expect(txt).toContain("to hit");
      expect(txt).not.toContain("to win");
    }
    // Exactly one "to win" figure in the whole panel (the true-win line).
    const body = screen.getByTestId("mm-body").textContent ?? "";
    const winMatches = (body.match(/to win/gi) ?? []).length;
    expect(winMatches).toBeLessThanOrEqual(1);
  });
});

describe("MentalMathSection — BB EV label is unit-aware (iter-12 #5)", () => {
  it("reads 'Show the BB EV' in BB mode", () => {
    act(() => useSessionStore.setState({ displayUnit: "bb" }));
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    expect(screen.getByText(/show the bb ev/i)).toBeInTheDocument();
    expect(screen.queryByText(/show the dollar ev/i)).toBeNull();
  });

  it("reads 'Show the dollar EV' in USD mode", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={51} />);
    expect(screen.getByText(/show the dollar ev/i)).toBeInTheDocument();
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

describe("MentalMathSection — good-check made-hand wording fits the ✅ verdict (iter-18 NIT #3)", () => {
  // Top pair (Q), no draw, hero CHECKED a free street → a ✅ Good check. The no-draw made-hand line
  // must NOT call the action "marginal here" (which undercut the positive verdict); it should say the
  // hand isn't strong enough to bet for value, so checking is fine.
  const frozenGoodCheck = {
    hole: [c("Qh"), c("4d")] as [Card, Card],
    board: [c("Qc"), c("Ts"), c("6c")] as Card[],
    street: "flop" as const,
    potBefore: 20,
    toCall: 0,
    numActiveOpponents: 2,
    madeHand: { category: 2, label: "top pair" },
    heroAction: "check" as const,
  };

  it("a ✅ good check of top pair: says checking is fine, not 'it's marginal here'", () => {
    setFlow(fakeFlow());
    render(<MentalMathSection enabled verdictEquityPct={38} frozen={frozenGoodCheck} />);
    const note = screen.getByTestId("mm-note").textContent ?? "";
    expect(note.toLowerCase()).toContain("top pair");
    expect(note.toLowerCase()).toContain("not strong enough to bet for value");
    expect(note.toLowerCase()).toContain("checking is fine");
    expect(note.toLowerCase()).not.toContain("marginal here");
  });

  it("a made-hand bet/call spot (not a good check) keeps the neutral 'marginal here' wording", () => {
    setFlow(fakeFlow());
    render(
      <MentalMathSection
        enabled
        verdictEquityPct={38}
        frozen={{ ...frozenGoodCheck, toCall: 8, heroAction: "call" }}
      />,
    );
    const note = screen.getByTestId("mm-note").textContent ?? "";
    expect(note.toLowerCase()).toContain("marginal here");
  });
});

describe("MentalMathSection — good-check dollar-EV line endorses checking, not betting (iter-19 MINOR #1)", () => {
  // The reviewer's Hand-3 turn: Ace-high CHECKED, verdict praised the check, but the dollar-EV row read
  // only "Betting is worth about $14 on average" — looking like advice to BET. When the hero checked a
  // free street and checking is the graded line, the line must name the CHECK value (ev.call) and
  // contrast it with betting (ev.raise), endorsing the check.
  const frozenGoodCheck = {
    hole: [c("As"), c("Jd")] as [Card, Card],
    board: [c("4s"), c("3s"), c("Qh"), c("9c")] as Card[], // Ace-high, no made hand, turn
    street: "turn" as const,
    potBefore: 36,
    toCall: 0,
    numActiveOpponents: 1,
    madeHand: null,
    heroAction: "check" as const,
  };

  it("names the CHECK value and reads as endorsing the check (check $17 > bet $14)", () => {
    setFlow(fakeFlow());
    render(
      <MentalMathSection
        enabled
        verdictEquityPct={52}
        actionEv={{ fold: 0, call: 17, raise: 14 }}
        frozen={frozenGoodCheck}
      />,
    );
    const ev = screen.getByTestId("mm-ev").textContent ?? "";
    expect(ev).toMatch(/Checking is worth/);
    expect(ev).toContain("$17"); // the CHECK row (ev.call)
    expect(ev).toContain("$14"); // contrasted with the bet row (ev.raise)
    expect(ev).toMatch(/so checking is right/i);
    // It must NOT read as a bare "Betting is worth $14" recommendation under a check verdict.
    expect(ev).not.toMatch(/^Betting is worth/);
  });

  it("a BET on a free street still says 'Betting is worth' (existing wording unchanged)", () => {
    setFlow(fakeFlow());
    render(
      <MentalMathSection
        enabled
        verdictEquityPct={85}
        actionEv={{ fold: 0, call: 17, raise: 27 }}
        frozen={{ ...frozenGoodCheck, madeHand: { category: 4, label: "a set" }, heroAction: "bet" }}
      />,
    );
    const ev = screen.getByTestId("mm-ev").textContent ?? "";
    expect(ev).toMatch(/Betting is worth/);
    expect(ev).toContain("$27");
    expect(ev).not.toMatch(/Checking is worth/);
  });
});
