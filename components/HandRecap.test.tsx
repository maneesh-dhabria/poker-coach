import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HandRecap } from "@/components/HandRecap";
import { analyze } from "@/core/analysis/analyze";
import { HeroDecisionRecord } from "@/core/history/handRecord";

beforeEach(() => cleanup());

function decision(
  street: HeroDecisionRecord["street"],
  action: string,
  amount: number,
  args: Parameters<typeof analyze>[0],
): HeroDecisionRecord {
  return {
    decisionId: `${street}-${action}`,
    street,
    spot: { potBefore: 10, toCall: 0, position: "BB", stackBb: 100, numActiveOpponents: 1, facing: "unopened" },
    heroAction: { action, amount },
    analysis: analyze(args),
  };
}

describe("HandRecap (observation #4 — end-of-hand review)", () => {
  it("lists one row per hero decision with the plain explanation", () => {
    const decisions = [
      decision("preflop", "call", 2, { action: "call", potBefore: 6, toCall: 2, equityPct: 55 }),
      decision("flop", "fold", 0, { action: "fold", potBefore: 12, toCall: 8, equityPct: 18 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={-2} />);
    expect(screen.getAllByTestId("recap-decision")).toHaveLength(2);
    expect(screen.getByText(/you called \$2/i)).toBeInTheDocument();
    expect(screen.getByText(/you folded/i)).toBeInTheDocument();
  });

  it("summarizes the result and points at /poker-coach", () => {
    const decisions = [
      decision("preflop", "raise", 6, { action: "raise", potBefore: 3, toCall: 0, equityPct: 62 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={14} />);
    expect(screen.getByText(/you won \$14/i)).toBeInTheDocument();
    expect(screen.getByText(/poker-coach last/i)).toBeInTheDocument();
  });

  it("renders nothing with no decisions", () => {
    const { container } = render(<HandRecap decisions={[]} heroNet={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("reconciles a winning result with a flagged decision (won but it was a mistake)", () => {
    const decisions = [
      // K4o call from CO is a mistake by the chart, but the hand can still be won.
      decision("preflop", "call", 2, { action: "call", potBefore: 6, toCall: 2, equityPct: 18 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={198} />);
    const note = screen.getByTestId("recap-reconcile");
    expect(note.textContent).toMatch(/won this hand/i);
    expect(note.textContent).toMatch(/grade the decision, not the outcome/i);
  });

  it("does not show the reconcile note when the result and verdicts agree (won, all good)", () => {
    const decisions = [
      decision("preflop", "raise", 6, { action: "raise", potBefore: 3, toCall: 0, equityPct: 62 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={14} />);
    expect(screen.queryByTestId("recap-reconcile")).toBeNull();
  });
});
