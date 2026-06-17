import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { analyze } from "@/core/analysis/analyze";

beforeEach(() => cleanup());

describe("FeedbackPanel", () => {
  it("shows a good verdict, the plain sentence, and an equity fill at equityPct width", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46, unit: "usd" });
    render(<FeedbackPanel analysis={a} enabled />);
    expect(screen.getByTestId("verdict-badge").textContent).toContain("✅");
    expect(screen.getByTestId("plain-math").textContent).toMatch(/Easy call/i);
    expect(screen.getByTestId("equity-fill")).toHaveStyle({ width: "46%" });
  });

  it("renders nothing when feedback is disabled", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46 });
    const { container } = render(<FeedbackPanel analysis={a} enabled={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when there is no analysis yet", () => {
    const { container } = render(<FeedbackPanel analysis={null} enabled />);
    expect(container.firstChild).toBeNull();
  });

  it("hides raw numbers (equity bar + %) at conceptual depth", () => {
    const a = analyze({
      action: "call",
      potBefore: 12,
      toCall: 4,
      equityPct: 46,
      coachingDepth: "conceptual",
    });
    render(<FeedbackPanel analysis={a} enabled />);
    expect(screen.queryByTestId("equity-bar")).toBeNull();
    expect(screen.getByTestId("feedback-panel").textContent).not.toContain("%");
  });

  it("explains WHY the verdict landed, in win-vs-need words (observation #4)", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46, unit: "usd" });
    render(<FeedbackPanel analysis={a} enabled />);
    // 46% equity vs 25% needed → the gap explanation.
    expect(screen.getByText(/that gap is why continuing makes money/i)).toBeInTheDocument();
  });

  it("offers an optional numbers breakdown (the 'more details' ask)", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46, unit: "usd" });
    render(<FeedbackPanel analysis={a} enabled />);
    expect(screen.getByText(/show the numbers/i)).toBeInTheDocument();
    expect(screen.getByText(/average result if you call/i)).toBeInTheDocument();
  });

  it("anchors the card to the street and pot it refers to when given context", () => {
    const a = analyze({ action: "call", potBefore: 24, toCall: 7, equityPct: 32, unit: "usd" });
    render(
      <FeedbackPanel analysis={a} enabled context={{ street: "flop", potBefore: 24, toCall: 7 }} />,
    );
    const ctx = screen.getByTestId("feedback-context");
    expect(ctx.textContent).toMatch(/flop decision/i);
    expect(ctx.textContent).toMatch(/pot was \$24 when you acted/i);
  });

  it("renders the context pot and numbers in BB when displayUnit is bb (finding #7)", () => {
    const a = analyze({ action: "call", potBefore: 24, toCall: 8, equityPct: 46, unit: "usd" });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        displayUnit="bb"
        context={{ street: "flop", potBefore: 24, toCall: 8 }}
      />,
    );
    // $24 pot → 12 BB; the context line must not show a conflicting dollar figure.
    const ctx = screen.getByTestId("feedback-context");
    expect(ctx.textContent).toMatch(/pot was 12 BB when you acted/i);
    expect(ctx.textContent).not.toContain("$");
  });

  it("omits the context line when no context is given (back-compat)", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46, unit: "usd" });
    render(<FeedbackPanel analysis={a} enabled />);
    expect(screen.queryByTestId("feedback-context")).toBeNull();
  });

  it("includes the Mental Math section without disturbing the verdict/equity (FR-01)", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46, unit: "usd" });
    render(<FeedbackPanel analysis={a} enabled />);
    expect(screen.getByTestId("mm-section")).toBeInTheDocument();
    expect(screen.getByTestId("mm-header")).toBeInTheDocument();
    // Existing feedback content is unchanged.
    expect(screen.getByTestId("verdict-badge")).toBeInTheDocument();
    expect(screen.getByTestId("equity-fill")).toHaveStyle({ width: "46%" });
  });
});

describe("FeedbackPanel — bet/raise feedback is consistent (iter-03 #2)", () => {
  it("a ❌ river bet never shows the call pot-odds 'only need ~%/makes money' headline", () => {
    // River bet with low equity → mistake (aggressionBranch: <33% ⇒ mistake).
    const a = analyze({
      action: "bet",
      potBefore: 300,
      toCall: 0,
      equityPct: 32,
      unit: "bb",
      street: "river",
    });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        displayUnit="bb"
        context={{ street: "river", potBefore: 300, toCall: 0, action: "bet" }}
      />,
    );
    expect(a.verdict).toBe("mistake");
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    // The contradiction the reviewer hit: a ❌ bet claiming it "makes money over time".
    expect(text).not.toMatch(/only need ~/i);
    expect(text).not.toMatch(/makes money over time/i);
  });

  it("keeps the win-vs-need headline on a facing-a-bet CALL spot", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46, unit: "usd" });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        context={{ street: "flop", potBefore: 12, toCall: 4, action: "call" }}
      />,
    );
    expect(screen.getByText(/that gap is why continuing makes money/i)).toBeInTheDocument();
  });
});

describe("FeedbackPanel — EV table lists only legal actions (iter-03 #8)", () => {
  it("an unopened CHECK spot shows check / bet, with no phantom 'call' row", () => {
    // A true check spot (hero checked, no bet to call) → the choices were check or bet.
    const a = analyze({
      action: "check",
      potBefore: 20,
      toCall: 0,
      equityPct: 40,
      unit: "bb",
      street: "river",
    });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        displayUnit="bb"
        context={{ street: "river", potBefore: 20, toCall: 0, action: "check" }}
      />,
    );
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).not.toMatch(/average result if you call/i);
    expect(text).toMatch(/average result if you check/i);
    expect(text).toMatch(/average result if you bet/i);
  });

  it("a facing-a-bet spot still lists fold / call / raise", () => {
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 46, unit: "usd" });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        context={{ street: "flop", potBefore: 12, toCall: 4, action: "call" }}
      />,
    );
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).toMatch(/average result if you fold/i);
    expect(text).toMatch(/average result if you call/i);
    expect(text).toMatch(/average result if you raise/i);
  });

  // iter-09 #1 SUPERSEDES iter-06 #4: a PREFLOP CHART decision (kind === "preflop", gtoClaim true) is
  // graded by the chart for playability/position reasons one-street pot-odds math doesn't capture, so
  // the EV "Show the numbers" mini-table must NOT appear there at all — it would pair an EV ranking
  // with a chart verdict (e.g. praise a fold while the table ranks call/raise higher). So a preflop
  // chart open shows NO EV table.
  it("a preflop chart open shows NO EV 'Show the numbers' table (iter-09 #1)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 0,
      equityPct: 55,
      unit: "usd",
      coachingDepth: "equity",
      street: "preflop",
      hand: ["Ah", "Kh"],
      position: "CO",
      facing: "unopened",
    });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        context={{ street: "preflop", potBefore: 3, toCall: 0, action: "raise" }}
      />,
    );
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).not.toMatch(/show the numbers/i);
    expect(text).not.toMatch(/average result if you/i);
  });
});

describe("FeedbackPanel — preflop chart fold shows no pro-call contradiction (iter-09 #1)", () => {
  // The reviewer's MAJOR: a SB folding 5♥Q♣ (chart says fold) showed a "you only need ~17% … makes
  // money over time" pot-odds line AND a "fold $0 · call $1 · raise $1" EV table — praising folding
  // while the visible numbers say call/raise is better. A SB folding to the BB IS "facing a bet", so
  // the price-frame fired on a preflop CHART decision. Gate: the whyLine, the "need ~%" equity marker,
  // and the EV table never appear on a preflop chart decision.
  const sbFold = analyze({
    action: "fold",
    potBefore: 5,
    toCall: 1,
    equityPct: 31,
    unit: "usd",
    coachingDepth: "equity",
    street: "preflop",
    hand: ["5h", "Qc"],
    position: "SB",
    facing: "unopened",
  });

  it("the SB fold is a preflop chart decision (gtoClaim, good verdict)", () => {
    expect(sbFold.explanationInput?.kind).toBe("preflop");
    expect(sbFold.gtoClaim).toBe(true);
    expect(sbFold.verdict).toBe("good");
  });

  it("shows NO pro-call 'makes money'/'only need ~%' whyLine and NO EV table on a preflop fold", () => {
    render(
      <FeedbackPanel
        analysis={sbFold}
        enabled
        context={{ street: "preflop", potBefore: 5, toCall: 1, action: "fold" }}
      />,
    );
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).not.toMatch(/makes money over time/i);
    expect(text).not.toMatch(/only need ~/i);
    expect(text).not.toMatch(/show the numbers/i);
    expect(text).not.toMatch(/average result if you/i);
    // The "need ~%" marker on the equity bar is also suppressed (no needed tick).
    expect(screen.queryByTestId("equity-needed")).toBeNull();
  });

  it("does not praise folding as 'profitable' (the EV of folding is $0)", () => {
    render(<FeedbackPanel analysis={sbFold} enabled />);
    expect(screen.getByTestId("plain-math").textContent ?? "").not.toMatch(/profitable/i);
  });

  // Regression guard (the Hand-4 river CALL the reviewer confirmed CORRECT): a postflop facing-a-bet
  // call STILL shows both the win-vs-need whyLine and the EV table.
  it("a postflop facing-a-bet CALL still shows the whyLine AND the EV table (regression)", () => {
    const a = analyze({ action: "call", potBefore: 22, toCall: 10, equityPct: 79, unit: "usd", street: "river" });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        context={{ street: "river", potBefore: 22, toCall: 10, action: "call" }}
      />,
    );
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).toMatch(/makes money over time/i);
    expect(text).toMatch(/show the numbers/i);
    expect(text).toMatch(/average result if you call/i);
  });
});

describe("FeedbackPanel — oversize badge + going-forward EV label (iter-09 #6a/#9)", () => {
  it("an oversized preflop open shows the 'Oversized' badge, not 'Thin' (#6a)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 0,
      equityPct: 55,
      unit: "usd",
      coachingDepth: "equity",
      street: "preflop",
      hand: ["Td", "2c"],
      position: "BTN",
      facing: "unopened",
      raiseToAmount: 40, // 20 BB open
      bigBlind: 2,
    });
    expect(a.conceptTags).toContain("preflop_oversize");
    render(<FeedbackPanel analysis={a} enabled />);
    const badge = screen.getByTestId("verdict-badge").textContent ?? "";
    expect(badge).toMatch(/oversized/i);
    expect(badge).not.toMatch(/thin/i);
    expect(badge).toContain("⚠️"); // keep the same severity icon
  });

  it("the EV 'Show the numbers' table is labeled as going-forward, not the whole-hand result (#9)", () => {
    const a = analyze({ action: "check", potBefore: 54, toCall: 0, equityPct: 40, unit: "usd", street: "river" });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        context={{ street: "river", potBefore: 54, toCall: 0, action: "check" }}
      />,
    );
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).toMatch(/from here on/i);
    expect(text).toMatch(/not the whole-hand outcome/i);
  });
});

describe("FeedbackPanel — depth-aware presentation (iter-03 #7)", () => {
  const preflopRaise = (depth: "conceptual" | "equity" | "strict") =>
    analyze({
      action: "raise",
      potBefore: 3,
      toCall: 0,
      equityPct: 57,
      unit: "usd",
      coachingDepth: depth,
      street: "preflop",
      hand: ["Ah", "Kh"],
      position: "CO",
      facing: "unopened",
    });

  it("Conceptual: no equity %, no 'chart-based' badge, no concept-tag jargon chips", () => {
    render(<FeedbackPanel analysis={preflopRaise("conceptual")} enabled />);
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).not.toContain("%");
    expect(text).not.toMatch(/chart-based/i);
    expect(text).not.toMatch(/chart deviation/i);
  });

  it("Equity+Heuristics: shows an equity %", () => {
    render(<FeedbackPanel analysis={preflopRaise("equity")} enabled />);
    expect(screen.getByTestId("feedback-panel").textContent ?? "").toMatch(/%/);
  });

  it("Strict: shows the chart citation, not a bare equity %", () => {
    render(<FeedbackPanel analysis={preflopRaise("strict")} enabled />);
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text.toLowerCase()).toMatch(/chart/);
    expect(text).not.toContain("%"); // equity %s belong to the equity tier, not strict
  });
});

describe("FeedbackPanel — Conceptual context line has zero digits (iter-10 #4)", () => {
  // A postflop check at conceptual depth WITH a context line (the spot the reviewer saw showing
  // "pot was $6 when you acted"). The whole card must contain no digit/currency.
  const conceptualCheck = analyze({
    action: "check",
    potBefore: 6,
    toCall: 0,
    equityPct: 40,
    coachingDepth: "conceptual",
    street: "flop",
  });

  it("renders no digits anywhere on the conceptual card, even with a pot context", () => {
    render(
      <FeedbackPanel
        analysis={conceptualCheck}
        enabled
        context={{ street: "flop", potBefore: 6, toCall: 0, action: "check" }}
      />,
    );
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).not.toMatch(/\d/); // ZERO digits anywhere on the card
    expect(text).not.toContain("$");
    // The street label still shows, just without the pot amount.
    expect(screen.getByTestId("feedback-context").textContent).toMatch(/flop decision/i);
    expect(screen.getByTestId("feedback-context").textContent).not.toMatch(/pot was/i);
  });

  it("Equity depth STILL shows the pot amount in the context line", () => {
    const eq = analyze({ action: "check", potBefore: 6, toCall: 0, equityPct: 40, street: "flop" });
    render(
      <FeedbackPanel
        analysis={eq}
        enabled
        context={{ street: "flop", potBefore: 6, toCall: 0, action: "check" }}
      />,
    );
    expect(screen.getByTestId("feedback-context").textContent).toMatch(/pot was \$6 when you acted/i);
  });
});

describe("FeedbackPanel — concept-tag chips use clean labels (iter-10 #7)", () => {
  it("renders a clean label for a known tag, not the raw slug", () => {
    // A tiny made-hand bet → tags include made_hand_thin_value (chip "Thin value", not the slug).
    const a = analyze({
      action: "bet",
      potBefore: 36,
      toCall: 0,
      equityPct: 40,
      street: "flop",
      numActiveOpponents: 2,
      hole: ["Th", "5c"],
      board: ["Td", "3s", "Ah"],
      raiseToAmount: 2,
    });
    render(<FeedbackPanel analysis={a} enabled />);
    const text = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(text).toMatch(/Thin value/);
    expect(text).not.toMatch(/made hand thin value/); // no crammed slug
    expect(text).toMatch(/Bet too small/); // bet_too_small → clean label too
  });
});

describe("FeedbackPanel — explanation sentence honors the display unit (iter-04 #3)", () => {
  it("renders the cost/pot amounts in BB, not dollars, when displayUnit is bb", () => {
    // $108 to call into a $560 pot ($452 before) at 12% equity → a price-branch fold sentence.
    const a = analyze({
      action: "fold",
      potBefore: 452,
      toCall: 108,
      equityPct: 12,
      unit: "usd", // persisted/canonical record stays USD
      street: "river",
    });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        displayUnit="bb"
        context={{ street: "river", potBefore: 452, toCall: 108, action: "fold" }}
      />,
    );
    const sentence = screen.getByTestId("plain-math").textContent ?? "";
    expect(sentence).toMatch(/54 BB/); // 108 / 2
    expect(sentence).toMatch(/280 BB/); // 560 / 2
    expect(sentence).not.toContain("$108");
    expect(sentence).not.toContain("$560");
  });

  it("still renders dollars in the sentence in usd mode", () => {
    const a = analyze({ action: "fold", potBefore: 452, toCall: 108, equityPct: 12, unit: "usd", street: "river" });
    render(<FeedbackPanel analysis={a} enabled displayUnit="usd" />);
    expect(screen.getByTestId("plain-math").textContent ?? "").toContain("$108");
  });
});

describe("FeedbackPanel — 'chart-based' badge is Strict-only (iter-04 #7)", () => {
  const preflop = (depth: "conceptual" | "equity" | "strict") =>
    analyze({
      action: "raise",
      potBefore: 3,
      toCall: 0,
      equityPct: 57,
      unit: "usd",
      coachingDepth: depth,
      street: "preflop",
      hand: ["Ah", "Kh"],
      position: "CO",
      facing: "unopened",
    });

  it("shows the 'chart-based' badge in Strict mode", () => {
    render(<FeedbackPanel analysis={preflop("strict")} enabled />);
    expect(screen.getByTestId("feedback-panel").textContent ?? "").toMatch(/chart-based/i);
  });

  it("does NOT show the 'chart-based' badge in Equity mode", () => {
    render(<FeedbackPanel analysis={preflop("equity")} enabled />);
    expect(screen.getByTestId("feedback-panel").textContent ?? "").not.toMatch(/chart-based/i);
  });
});

describe("FeedbackPanel — assumed-range context is legible near equity (iter-03 #9)", () => {
  it("restates that the win-chance is vs an assumed range, not real cards", () => {
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 47,
      unit: "bb",
      street: "flop",
      assumedRange: "a wide calling-station range",
    });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        displayUnit="bb"
        context={{ street: "flop", potBefore: 20, toCall: 0, action: "bet" }}
      />,
    );
    const note = screen.getByTestId("assumed-range").textContent ?? "";
    expect(note).toMatch(/assumed range/i);
    expect(note).toMatch(/not their actual cards/i);
  });
});
