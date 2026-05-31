"use client";
// Preflop chart teaching surface (spec FR-50..FR-56, E3, NFR-05/07, §11.3; wireframe 02 Preflop tab).
// A 13×13 grid of the 169 canonical starting hands — pairs on the diagonal, suited upper-right,
// offsuit lower-left — each a real keyboard-reachable <button> coloured by the baseline chart's
// recommended action at the chosen position. Clicking a hand opens a plain-language detail card: its
// win-rate vs a random hand (from the precomputed table, no runtime Monte Carlo — NFR-03), plain
// definitions of the jargon, and the honest caveat that "vs a random hand" overstates real equity.
// Presentational: actions come from core/charts (chartAction); equity from the committed JSON, with an
// on-demand fallback only for any key the table somehow lacks (FR-56).
import { useState } from "react";
import { Card } from "@/core/cards";
import { Position, Facing, ChartAction, chartAction } from "@/core/charts/preflop";
import { equity } from "@/core/equity/equity";
import equityTable from "@/core/charts/preflopEquity.json";

// Rows/cols high→low. Cell (i,j): i<j suited, i===j pair, i>j offsuit — the standard chart layout.
const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
const POSITIONS: Position[] = ["UTG", "MP", "CO", "BTN", "SB", "BB"];

const TABLE = equityTable as { equity: Record<string, number> };

/** The 169-grid key for cell (row i, col j). */
function keyAt(i: number, j: number): string {
  const hi = RANKS[i];
  const lo = RANKS[j];
  if (i === j) return `${hi}${hi}`;
  if (i < j) return `${hi}${lo}s`; // upper-right: suited, row rank is higher
  return `${RANKS[j]}${RANKS[i]}o`; // lower-left: offsuit, keep higher rank first
}

// Representative two cards for a key — suits are arbitrary for chart/equity purposes, so fix them:
// suited → both hearts; offsuit/pair → hearts + spades. (Same convention as scripts/genPreflopEquity.)
function repCombo(key: string): [Card, Card] {
  const hi = key[0];
  if (key.length === 2) return [`${hi}h` as Card, `${hi}s` as Card];
  const lo = key[1];
  const suited = key.endsWith("s");
  return [`${hi}h` as Card, `${lo}${suited ? "h" : "s"}` as Card];
}

/** Win% vs a random hand: from the precomputed table, or an on-demand estimate if a key is missing. */
function equityFor(key: string): number {
  const pre = TABLE.equity[key];
  if (typeof pre === "number") return pre;
  // Fallback (FR-56) — should never fire for the 169 canonical keys, but never block the UI.
  const { equityPct } = equity({ hero: repCombo(key), board: [], numOpponents: 1, iterations: 1500 });
  return equityPct;
}

const ACTION_LABEL: Record<ChartAction, string> = { raise: "Raise", call: "Call", fold: "Fold" };

export function PreflopChartTab() {
  const [position, setPosition] = useState<Position>("BTN"); // safe default; hero-pos auto-default is optional
  const facing: Facing = "unopened";
  const [selected, setSelected] = useState<string | null>(null);

  const detail = selected
    ? {
        key: selected,
        hand: selected.slice(0, 2),
        pct: Math.round(equityFor(selected)),
        action: chartAction(repCombo(selected), position, facing),
      }
    : null;

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Preflop chart</h2>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <span>Position</span>
          <select
            aria-label="position"
            className="select"
            value={position}
            onChange={(e) => setPosition(e.target.value as Position)}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        role="grid"
        aria-label="starting hands"
        style={{ display: "grid", gridTemplateColumns: "repeat(13, 1fr)", gap: 2, marginTop: 12 }}
      >
        {RANKS.map((_, i) =>
          RANKS.map((__, j) => {
            const key = keyAt(i, j);
            const action = chartAction(repCombo(key), position, facing);
            return (
              <button
                key={key}
                type="button"
                className={`chart-cell cell-${action}`}
                aria-label={`${key}, ${action}`}
                aria-pressed={selected === key}
                onClick={() => setSelected(key)}
              >
                {key}
              </button>
            );
          }),
        )}
      </div>

      {detail ? (
        <div className="card" style={{ marginTop: 12 }} aria-live="polite">
          <h3 style={{ marginTop: 0 }}>
            {detail.key} — {ACTION_LABEL[detail.action]} from {position}
          </h3>
          <p style={{ margin: "4px 0" }}>
            {detail.hand} wins ~{detail.pct} out of 100 vs a random hand.
          </p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-soft)", fontSize: 13 }}>
            <li>
              <strong>Baseline</strong>: a solid default to start from — not the only right play, just a
              reliable one while you learn.
            </li>
            <li>
              <strong>Equity</strong>: your share of the pot if all the chips went in now and the hand
              ran to the river — here, how often this hand wins.
            </li>
            <li>
              <strong>Position</strong>: where you sit relative to the dealer button; later seats act
              with more information, so they can play more hands.
            </li>
            <li>
              Heads-up &ldquo;vs a random hand&rdquo; <strong>overstates</strong> real equity — at a
              full table opponents fold their worst hands, so whoever keeps playing is stronger.
            </li>
          </ul>
        </div>
      ) : (
        <p style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 12 }}>
          Pick a hand to see how it plays from {position}.
        </p>
      )}
    </div>
  );
}
