// Findings #4/#6 — the play layout must not clip the action controls or seats off narrow viewports.
// jsdom has no layout engine, so we assert the CSS contract: the play grid reflows below ~1000px
// (narrower rail, then a single stacked column) and the action bar wraps instead of overflowing.
// The real pixel checks at 600–800px are a Playwright/manual step.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ActionBar } from "@/components/ActionBar";

const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

describe("responsive play layout (findings #4/#6)", () => {
  it("the play grid reflows at narrow widths (rail narrows, then columns stack)", () => {
    // The wide default is two columns; a media query narrows the rail and another stacks the grid.
    expect(css).toMatch(/\.play-grid\s*\{[^}]*grid-template-columns:\s*1fr\s+420px/);
    expect(css).toMatch(/@media \(max-width: 1100px\)[\s\S]*\.play-grid\s*\{[^}]*1fr\s+340px/);
    expect(css).toMatch(/@media \(max-width: 880px\)[\s\S]*\.play-grid\s*\{[^}]*grid-template-columns:\s*1fr;/);
  });

  it("the action bar wraps and is centered so its controls never clip off-screen", () => {
    expect(css).toMatch(/\.action-bar\s*\{[^}]*flex-wrap:\s*wrap/);
    const { getByTestId } = render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call", "raise"], toCall: 8, minRaiseTo: 16, maxRaiseTo: 100 }}
        onAction={() => {}}
        pot={40}
      />,
    );
    const bar = getByTestId("action-bar");
    expect(bar.className).toContain("action-bar");
    expect(bar.style.flexWrap).toBe("wrap");
    expect(bar.style.maxWidth).toBe("100%");
  });
});
