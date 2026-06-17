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
