import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// FR-09: the duplicate Hand review below the table is removed; it lives only in the Live Feedback
// tab now. Guard at the source level — the render path is exercised by the app, not jsdom.
describe("PokerTable — no duplicate Hand review below the table (FR-09)", () => {
  const src = readFileSync(resolve(__dirname, "PokerTable.tsx"), "utf8");

  it("does not import HandRecap", () => {
    expect(src).not.toMatch(/import\s*\{[^}]*\bHandRecap\b[^}]*\}\s*from/);
  });

  it("does not render <HandRecap …>", () => {
    expect(src).not.toMatch(/<HandRecap\b/);
  });

  it("still renders the Next hand button", () => {
    expect(src).toMatch(/Next hand/);
  });
});
