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
  toAmount?: number,
): HeroDecisionRecord {
  return {
    decisionId: `${street}-${action}`,
    street,
    spot: { potBefore: 10, toCall: 0, position: "BB", stackBb: 100, numActiveOpponents: 1, facing: "unopened" },
    heroAction: { action, amount, ...(toAmount !== undefined ? { toAmount } : {}) },
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

  it("does not say 'you won $0' after a fold — uses neutral wording (finding #9)", () => {
    const decisions = [
      decision("preflop", "fold", 0, { action: "fold", potBefore: 6, toCall: 2, equityPct: 15 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={0} />);
    expect(screen.queryByText(/you won \$0/i)).toBeNull();
    expect(screen.getByText(/no money won or lost/i)).toBeInTheDocument();
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

  // iter-03 #1 — the variance bridge on a WELL-PLAYED LOSS, shown by default.
  it("shows the variance note when the hand was LOST but every graded decision was sound (#1)", () => {
    const decisions = [
      // A strong value bet that was ✅ good — then the hand was lost to a cooler.
      decision("river", "bet", 100, { action: "bet", potBefore: 200, toCall: 0, equityPct: 92 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={-200} />);
    const note = screen.getByTestId("recap-variance");
    expect(note.textContent).toMatch(/unlucky result/i);
    expect(note.textContent).toMatch(/that's variance/i);
    expect(note.textContent).toMatch(/long-run averages, not this one hand/i);
    // The "you won this hand" reconcile note is for wins only, not this loss.
    expect(screen.queryByTestId("recap-reconcile")).toBeNull();
  });

  it("does NOT use the 'unlucky' framing when a lost hand was at least partly the player's mistake (#1)", () => {
    const decisions = [
      // A clear ❌ mistake (calling far too wide) on the way to losing the hand.
      decision("flop", "call", 30, { action: "call", potBefore: 30, toCall: 30, equityPct: 12 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={-30} />);
    // The loss was at least partly the player's mistake, so no "unlucky / variance" comfort.
    expect(screen.queryByTestId("recap-variance")).toBeNull();
  });

  // iter-03 #2 — the recap's OWN money figures (decision amounts, the "· pot X" tag, the Result
  // line) follow the $/BB toggle, so the recap no longer mixes units with the BB table/buttons.
  // (The embedded analysis sentence is the engine's frozen ground-truth string in its own unit and
  // is shown verbatim in both live feedback and the recap — it is not re-rendered here.)
  it("renders BB in the decision rows and the result line when displayUnit is bb (#2)", () => {
    const decisions = [
      decision("preflop", "call", 2, { action: "call", potBefore: 6, toCall: 2, equityPct: 55 }),
    ];
    // The `decision` helper fixes spot.potBefore at 10 → 5 BB; the $2 call → 1 BB; -$200 → 100 BB.
    render(<HandRecap decisions={decisions} heroNet={-200} displayUnit="bb" />);
    const recap = screen.getByTestId("hand-recap");
    expect(screen.getByText(/you called 1 BB/i)).toBeInTheDocument();
    expect(recap.textContent).toMatch(/pot 5 BB/i);
    expect(recap.textContent).toMatch(/you lost 100 BB/i);
    // The recap's own figures must not be in dollars (the analysis sentence may carry its own unit).
    expect(recap.textContent).not.toMatch(/called \$|pot \$|lost \$|won \$/i);
  });

  // iter-03 #3 — the end-of-hand CONCLUSION only appears once the hand is complete.
  it("hides the Result line + variance/coach notes mid-hand, shows them when complete (#3)", () => {
    const decisions = [
      decision("river", "bet", 100, { action: "bet", potBefore: 200, toCall: 0, equityPct: 92 }),
    ];
    const { rerender } = render(
      <HandRecap decisions={decisions} heroNet={-200} handComplete={false} />,
    );
    // Mid-hand: the running list shows, but no end-of-hand conclusion.
    expect(screen.getAllByTestId("recap-decision").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Result:/i)).toBeNull();
    expect(screen.queryByText(/poker-coach last/i)).toBeNull();
    expect(screen.queryByTestId("recap-variance")).toBeNull();

    // Hand complete: the conclusion (Result line + pointer + variance note) appears.
    rerender(<HandRecap decisions={decisions} heroNet={-200} handComplete />);
    expect(screen.getByText(/Result:/i)).toBeInTheDocument();
    expect(screen.getByText(/poker-coach last/i)).toBeInTheDocument();
    expect(screen.getByTestId("recap-variance")).toBeInTheDocument();
  });

  // SAFETY (iter-03 resultLine note): the conclusion/result line renders without throwing on the
  // hand-COMPLETE path for both a win and a loss (the reported ReferenceError was a stale hot-reload
  // artifact — resultLine is defined and used; this guards the path stays clean).
  it("renders the result conclusion on the complete path for a WIN without error", () => {
    const decisions = [
      decision("river", "bet", 50, { action: "bet", potBefore: 100, toCall: 0, equityPct: 80 }, 50),
    ];
    expect(() =>
      render(<HandRecap decisions={decisions} heroNet={120} handComplete />),
    ).not.toThrow();
    expect(screen.getByText(/you won \$120/i)).toBeInTheDocument();
  });

  it("renders the result conclusion on the complete path for a LOSS without error", () => {
    const decisions = [
      decision("river", "call", 40, { action: "call", potBefore: 80, toCall: 40, equityPct: 30 }),
    ];
    expect(() =>
      render(<HandRecap decisions={decisions} heroNet={-40} handComplete />),
    ).not.toThrow();
    expect(screen.getByText(/you lost \$40/i)).toBeInTheDocument();
  });

  // iter-03 #6: a raise/bet row is labeled by its TOTAL raise-to level (toAmount), matching the
  // "Raise to N" the action button offered — not the chips-added increment.
  it("labels a raise by its total raise-to level (toAmount), matching the button (#6)", () => {
    const decisions = [
      // Hero raised TO 4 ($4 = 2 BB) but only added 2 chips beyond their posted blind.
      decision("preflop", "raise", 2, { action: "raise", potBefore: 3, toCall: 0, equityPct: 60 }, 4),
    ];
    render(<HandRecap decisions={decisions} heroNet={10} displayUnit="bb" />);
    // "raised to 2 BB" ($4 / 2) — the same number the button "Raise to 2 BB" showed.
    expect(screen.getByText(/raised to 2 BB/i)).toBeInTheDocument();
    expect(screen.queryByText(/raised to 1 BB/i)).toBeNull();
  });
});
