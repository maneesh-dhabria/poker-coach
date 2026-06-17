"use client";
// Preflop chart teaching surface (spec FR-50..FR-56, E3, NFR-05/07, §11.3; wireframe 02 Preflop tab).
// A 13×13 grid of the 169 canonical starting hands — pairs on the diagonal, suited upper-right,
// offsuit lower-left — each a real keyboard-reachable <button> coloured by the baseline chart's
// recommended action at the chosen position. Clicking a hand opens a plain-language detail card: its
// win-rate vs a random hand (from the precomputed table, no runtime Monte Carlo — NFR-03), plain
// definitions of the jargon, and the honest caveat that "vs a random hand" overstates real equity.
// Presentational: actions come from core/charts (chartAction); equity from the committed JSON, with an
// on-demand fallback only for any key the table somehow lacks (FR-56).
import { useEffect, useState } from "react";
import { Card } from "@/core/cards";
import { Position, Facing, ChartAction, chartAction, chartApplies } from "@/core/charts/preflop";
import { equity } from "@/core/equity/equity";
import equityTable from "@/core/charts/preflopEquity.json";
import { useGameStore } from "@/store/gameStore";

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

// The chart defaults to the player's actual seat when a hand is in progress (finding #10) — falling
// back to BTN otherwise. `heroPosition` lets tests inject the seat; left undefined, we read it live
// from the game store. The select still lets the user browse any position.
export function PreflopChartTab({ heroPosition }: { heroPosition?: Position } = {}) {
  const liveHeroPosition = useGameStore((s) => {
    const view = s.flow?.tableView();
    return (view?.seats.find((seat) => seat.isHero)?.position as Position | undefined) ?? null;
  });
  const heroPos = heroPosition ?? liveHeroPosition;
  const [position, setPosition] = useState<Position>(heroPos ?? "BTN");
  // Track whether the user has manually picked a position; until then, follow the hero's seat as it
  // becomes known / changes hand to hand.
  const [userPicked, setUserPicked] = useState(false);
  useEffect(() => {
    if (!userPicked && heroPos) setPosition(heroPos);
  }, [heroPos, userPicked]);
  // The action the hero is facing (iter-10 #1). The chart models two cases: an unopened first-in
  // (RFI) range and a defend-vs-a-raise range. The BB has NO open-first-in range — with no raise to
  // act against it just checks its option — so chartAction(BB, "unopened") folds every hand. Rather
  // than print a misleading "Fold AA from BB" grid, we let the user pick the facing and show an
  // explanatory panel for the one spot the chart has no range for.
  const [facing, setFacing] = useState<Facing>("unopened");
  const [selected, setSelected] = useState<string | null>(null);

  // The chart only models two kinds of range: an opening (first-in) range for UTG/MP/CO/BTN/SB, and a
  // big-blind defend range vs a raise. For ANY other (position, facing) combo there is NO real range —
  // chartAction would fold every hand, fabricating "Fold AA from BTN" (iter-11 #2). So whenever the
  // chart doesn't apply we show an explanatory panel instead of the grid + detail card, NEVER a
  // fabricated all-fold grid. (Previously only BB-unopened was special-cased — iter-10 #1.)
  const noRange = !chartApplies(position, facing);

  const detail =
    selected && !noRange
      ? {
          key: selected,
          hand: selected.slice(0, 2),
          pct: Math.round(equityFor(selected)),
          action: chartAction(repCombo(selected), position, facing),
        }
      : null;

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Preflop chart</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span>Position</span>
            <select
              aria-label="position"
              className="select"
              value={position}
              onChange={(e) => {
                setUserPicked(true);
                setPosition(e.target.value as Position);
              }}
            >
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span>Facing</span>
            <select
              aria-label="facing"
              className="select"
              value={facing}
              onChange={(e) => setFacing(e.target.value as Facing)}
            >
              <option value="unopened">first in (unopened)</option>
              <option value="raise">vs a raise</option>
            </select>
          </label>
        </div>
      </div>

      {noRange ? (
        position === "BB" && facing === "unopened" ? (
          <div
            className="card"
            data-testid="chart-bb-no-open"
            style={{ marginTop: 12 }}
            aria-live="polite"
          >
            <h3 style={{ marginTop: 0 }}>The big blind has no opening range here</h3>
            <p style={{ margin: "4px 0", lineHeight: 1.5 }}>
              With no raise to act against, the big blind doesn&apos;t open — it simply checks its
              option and sees the flop for free. So there&apos;s no &ldquo;first-in&rdquo; chart for the
              big blind: even pocket Aces aren&apos;t a &ldquo;fold&rdquo; here, they just check and play
              on.
            </p>
            <p style={{ margin: "4px 0", lineHeight: 1.5, color: "var(--ink-soft)", fontSize: 13 }}>
              Switch <strong>Facing</strong> to <strong>vs a raise</strong> to see how the big blind
              should defend against an open.
            </p>
          </div>
        ) : (
          // Any non-BB position facing "vs a raise" — the chart models opening ranges and big-blind
          // defense, but NOT a separate per-position defend-vs-a-raise range. We must never fabricate
          // an all-fold grid here (it once read "AA — Fold from BTN" — iter-11 #2).
          <div
            className="card"
            data-testid="chart-no-range"
            style={{ marginTop: 12 }}
            aria-live="polite"
          >
            <h3 style={{ marginTop: 0 }}>No {position} range vs a raise in this chart</h3>
            <p style={{ margin: "4px 0", lineHeight: 1.5 }}>
              This chart models opening (first-in) ranges for each position and big-blind defense vs a
              raise. It doesn&apos;t carry a separate {position}-vs-a-raise range — and folding a premium
              like AA or KK to a raise would be flatly wrong, so we don&apos;t show a grid here rather
              than fake one.
            </p>
            <p style={{ margin: "4px 0", lineHeight: 1.5, color: "var(--ink-soft)", fontSize: 13 }}>
              Switch <strong>Facing</strong> to <strong>first in (unopened)</strong> to see {position}
              &apos;s opening range.
            </p>
          </div>
        )
      ) : (
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
      )}

      {noRange ? null : detail ? (
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
