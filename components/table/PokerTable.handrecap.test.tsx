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

  // iter-03 #1 (regression): the board count is capped ONLY during the bot-reveal animation
  // (`revealing`). On a static hero decision (and at showdown) the table shows the ACTUAL dealt
  // board in full (`view.board`), so the player always sees the street they're deciding and the
  // full run-out at the end — never one street stale.
  it("caps the board only while revealing; otherwise shows the full dealt board", () => {
    expect(src).toMatch(/count=\{boardShowCount\(revealing, snapshot\.boardCount\)\}/);
    // The previous (buggy) expression capped by boardCount whenever the hand wasn't over — gone.
    expect(src).not.toMatch(/count=\{showdownDone \? undefined : snapshot\.boardCount\}/);
  });

  // iter-03 #9: the showdown category banner must attribute the winning hand to its owner
  // ("You win with…" / "<Bot> wins with…"), not sit unattributed near the hero's cards.
  it("builds an attributed winner banner (winner name + win/wins with category)", () => {
    expect(src).toMatch(/shownWinner\.isHero \? "You" : shownWinner\.name/);
    expect(src).toMatch(/\$\{winnerName\} \$\{verb\} with \$\{category\}/);
  });

  // iter-04 #1: the WHOLE table interior is a FIXED-size design box (DESIGN_W × DESIGN_H) uniformly
  // scaled to fit the measured stage. Fixed geometry + uniform scale ⇒ no fixed-size element can
  // overlap another at any viewport size (the 800×600 hero-over-pot collision is impossible). The
  // center pot/round-summary still sits in the upper-middle, bounded clear of the bottom hero seat.
  it("renders the table interior as a fixed design box scaled to fit the stage", () => {
    expect(src).toMatch(/width: DESIGN_W/);
    expect(src).toMatch(/height: DESIGN_H/);
    expect(src).toMatch(/transform: `scale\(\$\{scale\}\)`/);
    // useFitScale now also reports the stage height for the iter-23 no-clip top-anchor; the scale is
    // destructured from it. Still the same measured-stage scale-to-fit.
    expect(src).toMatch(/const \{ scale, stageHeight \} = useFitScale\(stageRef\)/);
    // The old aspect-ratio approach (fixed-px tiles on a squashed felt) is gone — that was the root
    // cause of the persistent 800×600 overlap.
    expect(src).not.toMatch(/aspectRatio: "760 \/ 520"/);
  });

  it("keeps the center pot/round-summary bounded clear of the hero seat", () => {
    expect(src).toMatch(/top: "36%"/); // center block anchored in the upper-middle, above the You seat
    expect(src).toMatch(/maxHeight: "68%"/); // bounded so its bottom (~70%) stays above the hero seat
  });
});
