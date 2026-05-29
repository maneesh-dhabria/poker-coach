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
});
