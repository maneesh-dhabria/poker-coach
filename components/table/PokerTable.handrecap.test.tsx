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

  // Finding #12: when the hand is over (incl. an all-in that ended betting early), the board must
  // show the full run-out, not the street-capped count. The engine already deals all 5 cards into
  // view.board; the table must stop capping the Board by snapshot.boardCount at showdown.
  it("shows the full board (uncapped) once the hand is over", () => {
    expect(src).toMatch(/count=\{showdownDone \? undefined : snapshot\.boardCount\}/);
  });

  // iter-03 #9: the showdown category banner must attribute the winning hand to its owner
  // ("You win with…" / "<Bot> wins with…"), not sit unattributed near the hero's cards.
  it("builds an attributed winner banner (winner name + win/wins with category)", () => {
    expect(src).toMatch(/shownWinner\.isHero \? "You" : shownWinner\.name/);
    expect(src).toMatch(/\$\{winnerName\} \$\{verb\} with \$\{category\}/);
  });

  // iter-03 #6: the felt preserves aspect ratio (scales to fit width AND height so seats never clip
  // off an edge) and the center pot/round-summary sits in the upper-center, clear of the hero seat.
  it("the felt preserves aspect ratio and the center block sits clear of the hero seat", () => {
    expect(src).toMatch(/aspectRatio: "760 \/ 520"/);
    expect(src).toMatch(/top: "42%"/); // center block anchored above dead-center, above the You seat
  });
});
