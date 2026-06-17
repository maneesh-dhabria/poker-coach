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
  it("an unopened (no bet to call) spot has no 'call' row", () => {
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 58,
      unit: "bb",
      street: "river",
    });
    render(
      <FeedbackPanel
        analysis={a}
        enabled
        displayUnit="bb"
        context={{ street: "river", potBefore: 20, toCall: 0, action: "bet" }}
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
