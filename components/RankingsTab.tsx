"use client";
// Hand-rankings reference (spec FR-40, FR-41, G6; wireframe 02 Rankings tab). The list is DERIVED
// from the HandCategory enum — one row per enum value, strongest first — so it can never drift out of
// sync with the evaluator (no hand-maintained duplicate list). The category NAME + a plain-language
// example live here since this is a beginner teaching surface, not engine logic (the evaluator's
// handCategoryLabel decodes specific cards, e.g. "Full House, Kings full of Sevens" — too specific for
// a static reference). Presentational only.
import { HandCategory } from "@/core/eval/handEval";

interface RankingRow {
  label: string;
  example: string;
}

// Plain name + plain example keyed by enum value (FR-41). Suits use the glyphs the rest of the app
// shows; the prose explains the shape so a beginner gets it at a glance.
const ROWS: Record<number, RankingRow> = {
  [HandCategory.StraightFlush]: {
    label: "Straight Flush",
    example: "Five in a row, all one suit — e.g. 9♥ 8♥ 7♥ 6♥ 5♥ (Ace-high is a Royal Flush)",
  },
  [HandCategory.Quads]: { label: "Four of a Kind", example: "All four of one rank — e.g. K♠ K♥ K♦ K♣" },
  [HandCategory.FullHouse]: { label: "Full House", example: "Three of a kind plus a pair — e.g. Q Q Q · 7 7" },
  [HandCategory.Flush]: { label: "Flush", example: "Any five of one suit — e.g. A♦ J♦ 8♦ 5♦ 2♦" },
  [HandCategory.Straight]: { label: "Straight", example: "Five in a row, mixed suits — e.g. 8♠ 7♥ 6♦ 5♣ 4♠" },
  [HandCategory.Trips]: { label: "Three of a Kind", example: "Three of one rank — e.g. 9 9 9" },
  [HandCategory.TwoPair]: { label: "Two Pair", example: "Two different pairs — e.g. J J · 4 4" },
  [HandCategory.Pair]: { label: "Pair", example: "Two cards of the same rank — e.g. 10 10" },
  [HandCategory.HighCard]: { label: "High Card", example: "No pair or better — your highest card plays, e.g. A-high" },
};

// Enum values, strongest first (StraightFlush=8 … HighCard=0). Built from the enum so adding a
// category to HandCategory automatically surfaces a missing row here (and the test count check fails).
const RANKED: number[] = Object.values(HandCategory)
  .filter((v): v is number => typeof v === "number")
  .sort((a, b) => b - a);

export function RankingsTab() {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Hand rankings</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 0 }}>
        Strongest at the top. The best five-card hand wins the pot.
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {RANKED.map((cat, i) => (
          <li
            key={cat}
            data-testid="ranking-row"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "baseline",
              padding: "8px 0",
              borderBottom: i < RANKED.length - 1 ? "1px solid var(--line, rgba(255,255,255,0.08))" : "none",
            }}
          >
            <span style={{ width: 20, color: "var(--ink-soft)", fontVariantNumeric: "tabular-nums" }}>
              {i + 1}
            </span>
            <span style={{ width: 130, fontWeight: 600, flex: "0 0 auto" }}>{ROWS[cat].label}</span>
            <span data-testid="ranking-example" style={{ color: "var(--ink-soft)", fontSize: 13 }}>
              {ROWS[cat].example}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
