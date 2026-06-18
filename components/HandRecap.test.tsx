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

  // iter-08 #6 / iter-19 NIT #4 — two hero actions on the SAME street merge into ONE recap row with a
  // combined "you <a>, then <b>" header (was two separate rows). The ", then called" continuation must
  // still read coherently and stay in a single recap-decision item.
  it("merges two same-street actions into one row with a ', then' continuation", () => {
    const decisions = [
      decision("turn", "bet", 110, { action: "bet", potBefore: 100, toCall: 0, equityPct: 85 }, 110),
      decision("turn", "call", 54, { action: "call", potBefore: 320, toCall: 54, equityPct: 80 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={200} />);
    // Both actions live in ONE merged row, headed by a single "Turn —".
    const rows = screen.getAllByTestId("recap-decision");
    expect(rows).toHaveLength(1);
    const header = rows[0].textContent ?? "";
    expect(header).toMatch(/Turn — you bet/i);
    expect(header).toMatch(/, then called/i);
  });

  // iter-19 NIT #4 — the reviewer's exact case: check then fold to a bet on one street reads as one
  // coherent line, "you checked, then folded to a bet", not two separate "Turn —" items.
  it("merges check-then-fold on one street into a single coherent line (iter-19 NIT #4)", () => {
    const decisions = [
      decision("turn", "check", 0, { action: "check", potBefore: 18, toCall: 0, equityPct: 40 }),
      decision("turn", "fold", 0, { action: "fold", potBefore: 18, toCall: 16, equityPct: 17 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={-10} />);
    const rows = screen.getAllByTestId("recap-decision");
    expect(rows).toHaveLength(1);
    const header = rows[0].textContent ?? "";
    expect(header).toMatch(/you checked, then folded to a bet/i);
  });

  it("keeps separate rows for actions on DIFFERENT streets (no spurious merge)", () => {
    const decisions = [
      decision("preflop", "call", 2, { action: "call", potBefore: 6, toCall: 2, equityPct: 55 }),
      decision("flop", "bet", 20, { action: "bet", potBefore: 12, toCall: 0, equityPct: 70 }, 20),
    ];
    render(<HandRecap decisions={decisions} heroNet={10} />);
    const rows = screen.getAllByTestId("recap-decision");
    expect(rows).toHaveLength(2);
    // No ", then" continuation inside the decision rows (the /poker-coach pointer text is separate).
    for (const r of rows) expect(r.textContent ?? "").not.toMatch(/, then/i);
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

  // iter-13 #5 — a fully clean (all-✅) WINNING hand gets explicit positive reinforcement.
  it("shows a 'nicely played' praise line on a clean all-good WIN (#5)", () => {
    const decisions = [
      decision("flop", "bet", 20, { action: "bet", potBefore: 12, toCall: 0, equityPct: 75 }, 20),
      decision("turn", "bet", 40, { action: "bet", potBefore: 50, toCall: 0, equityPct: 82 }, 40),
    ];
    render(<HandRecap decisions={decisions} heroNet={60} />);
    const praise = screen.getByTestId("recap-praise");
    expect(praise.textContent).toMatch(/nicely played/i);
    expect(praise.textContent).toMatch(/every decision was solid/i);
  });

  it("does NOT show praise when ANY decision was flagged (#5)", () => {
    const decisions = [
      decision("flop", "bet", 20, { action: "bet", potBefore: 12, toCall: 0, equityPct: 75 }, 20),
      // A low-equity bluff bet — a ❌ mistake.
      decision("turn", "bet", 40, { action: "bet", potBefore: 50, toCall: 0, equityPct: 12 }, 40),
    ];
    render(<HandRecap decisions={decisions} heroNet={60} />);
    expect(screen.queryByTestId("recap-praise")).toBeNull();
  });

  it("does NOT show praise on a clean but LOST hand (it gets the variance bridge instead, no double-up) (#5)", () => {
    const decisions = [
      decision("river", "bet", 100, { action: "bet", potBefore: 200, toCall: 0, equityPct: 92 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={-200} />);
    expect(screen.queryByTestId("recap-praise")).toBeNull();
    expect(screen.getByTestId("recap-variance")).toBeInTheDocument();
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

  // iter-04 #6 — the variance/"unlucky" footer must only fire when the hero CONTESTED the hand and
  // lost meaningfully, not on a cheap preflop fold that loses only the blind (no bad beat).
  it("does NOT show the variance note on a correct preflop fold that loses only the blind (#6)", () => {
    const decisions = [
      decision("preflop", "fold", 0, { action: "fold", potBefore: 6, toCall: 2, equityPct: 12 }),
    ];
    // Lost the blind, no mistakes — but the hero never contested, so no "played well, lost anyway".
    render(<HandRecap decisions={decisions} heroNet={-1} />);
    expect(screen.queryByTestId("recap-variance")).toBeNull();
  });

  it("DOES show the variance note on a contested showdown loss with no mistakes (#6)", () => {
    const decisions = [
      // A ✅ value bet on the river (the hero contested) — then lost to a cooler.
      decision("river", "bet", 100, { action: "bet", potBefore: 200, toCall: 0, equityPct: 92 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={-200} />);
    expect(screen.getByTestId("recap-variance")).toBeInTheDocument();
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

  // iter-10 #4 — a conceptual-depth decision row carries NO digits (no "· pot $X", no "$" amount on
  // the action verb), since Conceptual promises plain words / no numbers. Equity rows still show them.
  it("omits the pot amount and action amount on a conceptual decision row (#4)", () => {
    const decisions = [
      decision("flop", "bet", 3, { action: "bet", potBefore: 6, toCall: 0, equityPct: 70, coachingDepth: "conceptual" }, 3),
    ];
    render(<HandRecap decisions={decisions} heroNet={4} />);
    const row = screen.getByTestId("recap-decision");
    expect(row.textContent).toMatch(/you bet/i);
    expect(row.textContent).not.toMatch(/\$/); // no currency on the conceptual row
    expect(row.textContent).not.toMatch(/· pot/i); // no pot amount suffix
  });

  it("STILL shows the pot + amount on an equity-depth decision row (#4 regression)", () => {
    const decisions = [
      decision("flop", "bet", 3, { action: "bet", potBefore: 6, toCall: 0, equityPct: 70 }, 3),
    ];
    render(<HandRecap decisions={decisions} heroNet={4} />);
    const row = screen.getByTestId("recap-decision");
    expect(row.textContent).toMatch(/you bet \$3/i);
    expect(row.textContent).toMatch(/· pot \$10/i); // spot.potBefore is fixed at 10 by the helper
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

  // iter-11 #3 (MAJOR): the "played well, unlucky variance" footer must be suppressed for ANY flagged
  // play — a ⚠️ thin (e.g. an oversized shove) counts, not just a ❌ mistake. And a flagged loss must
  // get a consistent "review the flagged play" note instead of silence.
  describe("variance footer never praises a flagged play (iter-11 #3)", () => {
    // An oversized ~52 BB preflop shove grades ⚠️ thin (preflop_oversize) — a flagged-but-not-mistake play.
    const oversizedShove = (): HeroDecisionRecord =>
      decision(
        "preflop",
        "raise",
        104,
        {
          action: "raise",
          potBefore: 3,
          toCall: 2,
          equityPct: 60,
          street: "preflop",
          hand: ["Qd", "Td"],
          position: "UTG",
          facing: "unopened",
          raiseToAmount: 104,
          bigBlind: 2,
        },
        104,
      );

    it("a THIN-only contested loss (oversized shove) shows NO 'played well' variance footer", () => {
      const d = oversizedShove();
      expect(d.analysis.verdict).toBe("thin"); // guard: it really is a ⚠️ thin play
      render(<HandRecap decisions={[d]} heroNet={-200} handComplete />);
      expect(screen.queryByTestId("recap-variance")).toBeNull();
    });

    it("a flagged loss shows the consistent 'review the flagged play' note", () => {
      render(<HandRecap decisions={[oversizedShove()]} heroNet={-200} handComplete />);
      const note = screen.getByTestId("recap-loss-flagged");
      // iter-14 #4: the leak line now NAMES the specific most-severe flagged play rather than a
      // generic "a play above" — it still points at a play to review and disclaims variance.
      expect(note.textContent).toMatch(/is the play to review/i);
      expect(note.textContent).toMatch(/not variance/i);
    });

    it("a mistake loss also shows the review note (not silence)", () => {
      const decisions = [
        decision("flop", "call", 30, { action: "call", potBefore: 30, toCall: 30, equityPct: 12 }),
      ];
      render(<HandRecap decisions={decisions} heroNet={-30} handComplete />);
      expect(screen.queryByTestId("recap-variance")).toBeNull();
      expect(screen.getByTestId("recap-loss-flagged")).toBeInTheDocument();
    });

    // iter-14 #4: the "leak" line points at the MOST SEVERE flagged decision (❌ over ⚠️; ties broken by
    // the biggest chip swing), naming the actual play — not a generic earlier one.
    it("(iter-14 #4) the leak line names the most-severe flagged play (a ❌ over a ⚠️)", () => {
      const decisions = [
        // A minor ⚠️ preflop min-raise (small chips).
        decision("preflop", "raise", 2, { action: "raise", potBefore: 3, toCall: 0, equityPct: 40, street: "preflop", hand: ["8h", "Jc"], position: "BB", facing: "unopened", bigBlind: 2, smallBlind: 1 }, 4),
        // A ❌ mistake stack-off on the turn (bigger chips) — this is the real leak.
        decision("turn", "call", 185, { action: "call", potBefore: 200, toCall: 185, equityPct: 8, street: "turn", numActiveOpponents: 2 }),
      ];
      render(<HandRecap decisions={decisions} heroNet={-200} handComplete />);
      const note = screen.getByTestId("recap-loss-flagged").textContent ?? "";
      // Points at the ❌ turn play, names it, and uses the ❌ icon (not the ⚠️ preflop min-raise).
      expect(note).toMatch(/❌/);
      expect(note).toMatch(/turn/i);
      expect(note).not.toMatch(/preflop/i);
    });

    it("(iter-14 #4) ties on severity break by the biggest chip swing", () => {
      const decisions = [
        // ⚠️ thin preflop min-raise (small chips).
        decision("preflop", "raise", 2, { action: "raise", potBefore: 3, toCall: 0, equityPct: 40, street: "preflop", hand: ["8h", "Jc"], position: "BB", facing: "unopened", bigBlind: 2, smallBlind: 1 }, 4),
        // ⚠️ thin oversized turn shove (big chips) — same severity, bigger swing → the leak.
        decision("turn", "bet", 185, { action: "bet", potBefore: 45, toCall: 0, equityPct: 53, street: "turn", numActiveOpponents: 2, hole: ["Jh", "Td"], board: ["Ks", "9c", "Jd", "4h"], raiseToAmount: 185 }, 185),
      ];
      render(<HandRecap decisions={decisions} heroNet={-200} handComplete />);
      const note = screen.getByTestId("recap-loss-flagged").textContent ?? "";
      expect(note).toMatch(/turn/i);
      expect(note).not.toMatch(/preflop/i);
    });

    it("an ALL-GOOD contested loss STILL shows the variance footer (no regression)", () => {
      const decisions = [
        decision("river", "bet", 100, { action: "bet", potBefore: 200, toCall: 0, equityPct: 92 }, 100),
      ];
      render(<HandRecap decisions={decisions} heroNet={-200} handComplete />);
      expect(screen.getByTestId("recap-variance")).toBeInTheDocument();
      expect(screen.queryByTestId("recap-loss-flagged")).toBeNull();
    });
  });

  // iter-11 #6 (NIT): at Conceptual depth the WHOLE panel (card + result + review tally) is digit-free.
  describe("conceptual depth shows zero digits in result + tally (iter-11 #6)", () => {
    const conceptualLoss = (): HeroDecisionRecord[] => [
      decision("flop", "bet", 3, { action: "bet", potBefore: 6, toCall: 0, equityPct: 40, coachingDepth: "conceptual", numActiveOpponents: 2, hole: ["Th", "5c"], board: ["Td", "3s", "Ah"], raiseToAmount: 3 }, 3),
    ];

    it("the result line carries no amount at conceptual depth", () => {
      const recap = render(<HandRecap decisions={conceptualLoss()} heroNet={-2} handComplete />).getByTestId("hand-recap");
      expect(recap.textContent).toMatch(/You lost this hand\./);
      expect(recap.textContent).not.toMatch(/Result: you lost/i);
    });

    it("the whole recap renders no digit at conceptual depth", () => {
      const { container } = render(<HandRecap decisions={conceptualLoss()} heroNet={-2} handComplete />);
      // The embedded analysis sentence + result + tally must all be digit-free.
      expect(container.textContent).not.toMatch(/\d/);
    });

    it("the tally uses words, not digits, at conceptual depth", () => {
      render(<HandRecap decisions={conceptualLoss()} heroNet={-2} handComplete />);
      const recap = screen.getByTestId("hand-recap");
      expect(recap.textContent).not.toMatch(/\d good|\d thin|\d mistake/);
    });

    it("Equity depth STILL shows the numeric result + tally (no regression)", () => {
      const decisions = [
        decision("flop", "bet", 3, { action: "bet", potBefore: 6, toCall: 0, equityPct: 70 }, 3),
      ];
      render(<HandRecap decisions={decisions} heroNet={-4} handComplete />);
      expect(screen.getByText(/Result: you lost \$4/i)).toBeInTheDocument();
      expect(screen.getByText(/good · .*thin · .*mistake/i)).toBeInTheDocument();
    });
  });
});

describe("HandRecap — won-with-a-flagged-play EV claim is conditional on the EV sign (iter-19 MINOR #2)", () => {
  // A ~40×-pot oversized SB shove (8♥5♥) that WON. Against these over-folding bots its chosen-action
  // (raise) EV is marginally POSITIVE — so the recap must NOT say "loses money on average"; it frames
  // it as a reckless SIZE instead. The play is STILL a graded mistake and still flagged.
  const oversizedWinningShove = () =>
    decision(
      "preflop",
      "raise",
      202,
      { action: "raise", potBefore: 5, toCall: 2, equityPct: 38, street: "preflop", hand: ["8h", "5h"], position: "SB", facing: "unopened", raiseToAmount: 202, bigBlind: 2, smallBlind: 1 },
      202,
    );

  it("a won hand whose oversized flagged play is non-negative EV does NOT say 'loses money on average'", () => {
    const d = oversizedWinningShove();
    expect(d.analysis.verdict).toBe("mistake"); // guard: still flagged
    expect(d.analysis.conceptTags).toContain("oversize_bet"); // guard: oversized
    expect(d.analysis.numbers.ev.raise).toBeGreaterThanOrEqual(0); // guard: marginally +EV
    render(<HandRecap decisions={[d]} heroNet={4} handComplete />);
    const note = screen.getByTestId("recap-reconcile").textContent ?? "";
    expect(note).toMatch(/won this hand/i);
    expect(note).toMatch(/grade the decision, not the outcome/i);
    // The corrected wording: a sizing/risk problem, not a literal −EV claim.
    expect(note).not.toMatch(/loses money on average/i);
    expect(note).toMatch(/risked far more than it could win/i);
    expect(note).toMatch(/reckless size/i);
  });

  it("a won hand whose flagged play IS negative EV still says 'loses money on average'", () => {
    // A no-equity bluff bet (9% on a wet flop) that happened to win — its chosen (bet) EV is clearly
    // negative, so the "loses money on average" wording is accurate and stays.
    const bluff = decision(
      "flop",
      "bet",
      6,
      { action: "bet", potBefore: 6, toCall: 0, equityPct: 9, street: "flop", numActiveOpponents: 2, hole: ["7c", "5s"], board: ["Kh", "2d", "Qh"], raiseToAmount: 6 },
      6,
    );
    expect(bluff.analysis.numbers.ev.raise).toBeLessThan(0); // guard: genuinely −EV
    render(<HandRecap decisions={[bluff]} heroNet={4} handComplete />);
    const note = screen.getByTestId("recap-reconcile").textContent ?? "";
    expect(note).toMatch(/loses money on average/i);
    expect(note).not.toMatch(/reckless size/i);
  });
});

describe("HandRecap — prominent net result so a big all-in win is explained (iter-18 MINOR #2)", () => {
  it("renders the won amount as a prominent, bold, coloured result headline", () => {
    const decisions = [
      decision("preflop", "raise", 216, { action: "raise", potBefore: 3, toCall: 0, equityPct: 55 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={792} />);
    const result = screen.getByTestId("recap-result");
    expect(result.textContent).toMatch(/you won \$792/i);
    expect(result).toHaveStyle({ fontWeight: "700" });
    expect(result).toHaveStyle({ color: "var(--good)" });
  });

  it("colours a loss with the mistake colour on the result headline", () => {
    const decisions = [
      decision("flop", "call", 8, { action: "call", potBefore: 20, toCall: 8, equityPct: 30 }),
    ];
    render(<HandRecap decisions={decisions} heroNet={-18} />);
    const result = screen.getByTestId("recap-result");
    expect(result.textContent).toMatch(/you lost \$18/i);
    expect(result).toHaveStyle({ color: "var(--mistake)" });
  });
});
