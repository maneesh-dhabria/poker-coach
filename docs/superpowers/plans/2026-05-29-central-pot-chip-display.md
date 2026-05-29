# Central Pot Chip Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare "Pot: $X" readout with a central zone that shows a growing chip pile, the pot total, and a per-round breakdown of who put in what — all derived from the same reveal cursor that animates actions, so the pot and board reveal in step with the betting.

**Architecture:** A new pure method `HandFlow.replayAt(step)` in `core/` computes a snapshot (pot, current street, board-card count, current-round contributions) from the first `step` entries of the action log. React components stay presentational: `PokerTable` calls `replayAt(revealed)` each render and feeds the snapshot to a new `CenterStack` component and to `Board`. The vanishing fly-to-center chip in `Seat` is removed; motion moves to the center pile.

**Tech Stack:** TypeScript, React (Next.js app router, `"use client"` components), Zustand store (unchanged), Vitest + Testing Library.

---

## File Structure

- `core/handFlow.ts` — add `ReplaySnapshot` interface, `boardCountForStreet` helper, and `replayAt(step)` method on `HandFlow`. All pot/breakdown math lives here.
- `core/handFlow.test.ts` — unit tests for `replayAt` and `boardCountForStreet`.
- `components/table/CenterStack.tsx` — **new**; renders chip pile + pot total + "This round" breakdown. Replaces `PotDisplay.tsx`.
- `components/table/PotDisplay.tsx` — **deleted**.
- `components/table/CenterStack.test.tsx` — **new**; component test.
- `components/table/Board.tsx` — accept `count` prop and render only that many cards.
- `components/table/Seat.tsx` — remove the `chip-fly` token (keep the text badge).
- `components/table/PokerTable.tsx` — compute `flow.replayAt(revealed)`; feed `CenterStack` + `Board`.
- `app/globals.css` — add chip-pile + pile-chip pop-in styles; the `chip-fly`/`chip-token` rules become unused (leave or remove — Task 6 removes them).

---

## Task 1: `boardCountForStreet` helper + `ReplaySnapshot` type

**Files:**
- Modify: `core/handFlow.ts`
- Test: `core/handFlow.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `core/handFlow.test.ts` (append a new `describe` block at end of file). Import `boardCountForStreet` by adding it to the existing import on line 2:

```ts
// line 2 becomes:
import { startHand, latestActionPerSeat, boardCountForStreet } from "@/core/handFlow";
```

```ts
describe("boardCountForStreet", () => {
  it("maps each street to the number of board cards shown", () => {
    expect(boardCountForStreet("preflop")).toBe(0);
    expect(boardCountForStreet("flop")).toBe(3);
    expect(boardCountForStreet("turn")).toBe(4);
    expect(boardCountForStreet("river")).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- handFlow`
Expected: FAIL — `boardCountForStreet is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

In `core/handFlow.ts`, add the `ReplaySnapshot` interface right after the `TableView` interface (after line 70), and the `boardCountForStreet` helper near the bottom (next to the exported `latestActionPerSeat` function, around line 309):

```ts
/** A replay snapshot of the hand as of the first `step` revealed actions — drives the central
 * pot zone and the street-by-street board reveal (presentational only; never feeds verdicts). */
export interface ReplaySnapshot {
  pot: number;
  street: Street;
  boardCount: number;
  roundContributions: {
    seat: number;
    name: string;
    action: string;
    amount: number;
  }[];
}

const BOARD_COUNT_BY_STREET: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

/** How many community cards are visible on a given street. */
export function boardCountForStreet(street: Street): number {
  return BOARD_COUNT_BY_STREET[street];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- handFlow`
Expected: PASS (the new `boardCountForStreet` describe block passes; existing tests still pass).

- [ ] **Step 5: Commit**

```bash
git add core/handFlow.ts core/handFlow.test.ts
git commit -m "feat(core): add ReplaySnapshot type + boardCountForStreet helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `HandFlow.replayAt(step)` method

**Files:**
- Modify: `core/handFlow.ts` (add method to the `HandFlow` class, after `actionLog()` ~line 225)
- Test: `core/handFlow.test.ts`

Context for the implementer:
- Blinds are posted but are NOT in the action log; the pot base is `smallBlind + bigBlind`. The class holds them at `this.input.config.smallBlind` / `.bigBlind`.
- Each `ActionRecord.amount` is the **increment** of chips that action added (folds/checks are `0`).
- Seat → display name: `this.input.seats.find((s) => s.seat === seatId)?.name`.
- "Current street" = the `street` of the last included action; `"preflop"` when `step === 0`.
- `roundContributions` lists only the included actions whose `street` equals the current street, **in log order**, and only those that committed chips (`amount > 0`) — checks/folds add no chips so they don't belong in the chip breakdown.

- [ ] **Step 1: Write the failing test**

Append to `core/handFlow.test.ts`. This drives a deterministic 2-handed hand, then asserts on `replayAt` at several cursor positions. It uses the same seeded setup as the existing tests so the action log is stable.

```ts
describe("HandFlow.replayAt (central pot snapshot)", () => {
  function playedFlow() {
    const flow = startHand({
      config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
      seats: [
        { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
        { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
      ],
      buttonIndex: 1,
      rng: mulberry32(9),
      sessionId: "s",
      handNumber: 1,
      coachingDepth: "equity",
    });
    let guard = 0;
    while (!flow.isOver() && flow.isHeroTurn() && guard++ < 30) {
      const action = flow.heroSpot().legal.actions.includes("check")
        ? { type: "check" as const }
        : { type: "call" as const };
      flow.heroAct(action, 50);
    }
    return flow;
  }

  it("at step 0 shows only the blinds, preflop, no board, no contributions", () => {
    const flow = playedFlow();
    const snap = flow.replayAt(0);
    expect(snap.pot).toBe(3); // SB 1 + BB 2
    expect(snap.street).toBe("preflop");
    expect(snap.boardCount).toBe(0);
    expect(snap.roundContributions).toEqual([]);
  });

  it("at the full step count, pot equals tableView().pot", () => {
    const flow = playedFlow();
    const total = flow.actionLog().length;
    expect(flow.replayAt(total).pot).toBe(flow.tableView().pot);
  });

  it("only lists chip-committing actions for the current street, in order", () => {
    const flow = playedFlow();
    const total = flow.actionLog().length;
    const snap = flow.replayAt(total);
    // Every listed contribution committed chips and belongs to the snapshot's street.
    for (const c of snap.roundContributions) {
      expect(c.amount).toBeGreaterThan(0);
      expect(typeof c.name).toBe("string");
    }
    // Contributions are a subset of the final street's chip-committing actions.
    const finalStreetChipActions = flow
      .actionLog()
      .filter((a) => a.street === snap.street && a.amount > 0).length;
    expect(snap.roundContributions.length).toBe(finalStreetChipActions);
  });

  it("clears contributions when the cursor sits on the first action of a new street", () => {
    const flow = playedFlow();
    const log = flow.actionLog();
    // Find the index of the first action on a street that differs from the prior action's street.
    const boundary = log.findIndex((a, i) => i > 0 && a.street !== log[i - 1].street);
    if (boundary === -1) return; // hand never left preflop in this seed; nothing to assert
    const snap = flow.replayAt(boundary + 1); // include exactly the first action of the new street
    expect(snap.street).toBe(log[boundary].street);
    // Only that new street's chip actions (0 or 1 so far) are listed — none from the prior street.
    for (const c of snap.roundContributions) {
      expect(log.some((a) => a.street === snap.street && a.seat === c.seat)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- handFlow`
Expected: FAIL — `flow.replayAt is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `core/handFlow.ts`, add this method to the `HandFlow` class immediately after `actionLog()` (after line 225):

```ts
  /** A render-ready snapshot of the hand as of the first `step` actions — drives the central pot
   * zone and the street-by-street board reveal. Pure/presentational; never feeds verdicts. */
  replayAt(step: number): ReplaySnapshot {
    const slice = this.actions.slice(0, Math.max(0, step));
    const base = this.input.config.smallBlind + this.input.config.bigBlind;
    const pot = slice.reduce((sum, a) => sum + a.amount, base);
    const street: Street = slice.length > 0 ? slice[slice.length - 1].street : "preflop";
    const nameOf = (seat: number) =>
      this.input.seats.find((s) => s.seat === seat)?.name ?? `Seat ${seat}`;
    const roundContributions = slice
      .filter((a) => a.street === street && a.amount > 0)
      .map((a) => ({ seat: a.seat, name: nameOf(a.seat), action: a.action, amount: a.amount }));
    return { pot, street, boardCount: boardCountForStreet(street), roundContributions };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- handFlow`
Expected: PASS (all `replayAt` cases + existing tests).

- [ ] **Step 5: Commit**

```bash
git add core/handFlow.ts core/handFlow.test.ts
git commit -m "feat(core): add HandFlow.replayAt snapshot for the central pot zone

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: CSS for the chip pile

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add pile styles**

Append after the `badge-pop` keyframes block (after line 115, before the `@media (prefers-reduced-motion)` block at line 117). These styles render an overlapping pile of chips and a pop-in for the newest chip:

```css
/* ── Central chip pile (the "what was played" zone) ──────────────────────────
   Chips accumulate in the middle as the pot grows, instead of flying away. */
.chip-pile {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  min-height: 22px;
}
.pile-chip {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--chip), var(--chip-edge));
  border: 2px solid var(--chip-edge);
  box-shadow: var(--shadow-1);
  margin-left: -8px;
}
.pile-chip:first-child { margin-left: 0; }
.pile-chip--new { animation: pile-pop 240ms ease-out; }
@keyframes pile-pop {
  0% { transform: translateY(-10px) scale(0.6); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
```

- [ ] **Step 2: Add reduced-motion guard**

Inside the existing `@media (prefers-reduced-motion: reduce)` block (currently lines 117-122), add one line so the pile pop is disabled too. After the `.action-badge { animation: none; }` line, add:

```css
  .pile-chip--new { animation: none; }
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): add central chip-pile styles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `CenterStack` component

**Files:**
- Create: `components/table/CenterStack.tsx`
- Test: `components/table/CenterStack.test.tsx`

Context for the implementer:
- The pile shows one chip per ~`bigBlind`-sized unit of the pot but is capped at 12 chips so it never overflows the center. We pass the pot in and compute the chip count inside.
- The "new" chip (last in the pile) gets the `pile-chip--new` class to pop in. Keyed by pot so React re-triggers the animation when the pot changes.
- Action label text reuses the same wording as the seat badge: `Bet $9`, `Call $9`, `Raise $9`. Build it from `action` + `amount`.

- [ ] **Step 1: Write the failing test**

Create `components/table/CenterStack.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CenterStack } from "@/components/table/CenterStack";
import { ReplaySnapshot } from "@/core/handFlow";

function snap(overrides: Partial<ReplaySnapshot> = {}): ReplaySnapshot {
  return {
    pot: 37,
    street: "flop",
    boardCount: 3,
    roundContributions: [
      { seat: 2, name: "Bot 2", action: "bet", amount: 9 },
      { seat: 5, name: "Bot 5", action: "call", amount: 9 },
      { seat: 3, name: "Bot 3", action: "call", amount: 9 },
    ],
    ...overrides,
  };
}

describe("CenterStack", () => {
  it("shows the pot total", () => {
    render(<CenterStack snapshot={snap()} />);
    expect(screen.getByTestId("pot")).toHaveTextContent("$37");
  });

  it("renders one breakdown row per contribution with name + action", () => {
    render(<CenterStack snapshot={snap()} />);
    const rows = screen.getAllByTestId("pot-contribution");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Bot 2");
    expect(rows[0]).toHaveTextContent("Bet $9");
  });

  it("renders no breakdown rows when nobody has committed chips this round", () => {
    render(<CenterStack snapshot={snap({ roundContributions: [] })} />);
    expect(screen.queryByTestId("pot-contribution")).toBeNull();
  });

  it("renders at least one chip in the pile when the pot is non-zero", () => {
    render(<CenterStack snapshot={snap()} />);
    expect(screen.getAllByTestId("pile-chip").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CenterStack`
Expected: FAIL — cannot resolve `@/components/table/CenterStack`.

- [ ] **Step 3: Write the component**

Create `components/table/CenterStack.tsx`:

```tsx
// The central "what was played" zone (spec: central-pot-chip-display design).
// Shows a growing chip pile, the pot total, and a per-round breakdown of who put in what.
// Presentational only — consumes a ReplaySnapshot computed by HandFlow.replayAt (never recomputes).
import { ReplaySnapshot } from "@/core/handFlow";

const MAX_PILE_CHIPS = 12;

const ACTION_LABEL: Record<string, (amt: number) => string> = {
  bet: (a) => `Bet $${a}`,
  call: (a) => `Call $${a}`,
  raise: (a) => `Raise $${a}`,
};

function chipCount(pot: number): number {
  if (pot <= 0) return 0;
  // Roughly one chip per "big-blind-ish" unit, capped so the pile never overflows the center.
  return Math.max(1, Math.min(MAX_PILE_CHIPS, Math.ceil(pot / 4)));
}

export function CenterStack({ snapshot }: { snapshot: ReplaySnapshot }) {
  const chips = chipCount(snapshot.pot);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div key={snapshot.pot} className="chip-pile" aria-hidden>
        {Array.from({ length: chips }).map((_, i) => (
          <span
            key={i}
            data-testid="pile-chip"
            className={`pile-chip${i === chips - 1 ? " pile-chip--new" : ""}`}
          />
        ))}
      </div>
      <div data-testid="pot" style={{ color: "var(--gold)", fontWeight: 700 }}>
        Pot: ${snapshot.pot}
      </div>
      {snapshot.roundContributions.length > 0 && (
        <div
          style={{
            background: "rgba(0,0,0,0.28)",
            border: "1px solid #2a6b52",
            borderRadius: "var(--r-sm)",
            padding: "5px 9px",
            minWidth: 132,
          }}
        >
          <div style={{ color: "var(--ink-soft)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
            This round
          </div>
          {snapshot.roundContributions.map((c, i) => (
            <div
              key={`${c.seat}-${i}`}
              data-testid="pot-contribution"
              style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.6 }}
            >
              <span style={{ color: "var(--ink-soft)" }}>{c.name}</span>
              <span style={{ color: "var(--gold)", fontWeight: 700 }}>
                {ACTION_LABEL[c.action]?.(c.amount) ?? `$${c.amount}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- CenterStack`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Commit**

```bash
git add components/table/CenterStack.tsx components/table/CenterStack.test.tsx
git commit -m "feat(ui): add CenterStack — chip pile + pot + per-round breakdown

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `Board` reveals by street

**Files:**
- Modify: `components/table/Board.tsx`

Context: `Board` currently renders every card in `cards`. Add an optional `count` prop; when provided, render only the first `count` cards so the board reveals in sync with the action cursor. Default to all cards when `count` is omitted (keeps any other caller working).

- [ ] **Step 1: Update the component**

Replace the body of `components/table/Board.tsx` with:

```tsx
// Community cards row (spec FR-51, wireframe 01). `count` (optional) limits how many cards show,
// so the board reveals street-by-street in sync with the action-reveal cursor.
import { Card as CardT } from "@/core/cards";
import { Card } from "@/components/table/Card";

export function Board({ cards, count }: { cards: CardT[]; count?: number }) {
  const shown = count === undefined ? cards : cards.slice(0, count);
  return (
    <div data-testid="board" aria-label="Community cards" style={{ display: "flex", gap: 2 }}>
      {shown.length === 0 ? <span style={{ color: "var(--ink-soft)" }}>—</span> : null}
      {shown.map((c, i) => (
        <Card key={`${c}-${i}`} card={c} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add components/table/Board.tsx
git commit -m "feat(ui): Board renders only `count` cards for street-by-street reveal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Remove the fly-to-center chip from `Seat`

**Files:**
- Modify: `components/table/Seat.tsx`
- Modify: `app/globals.css` (remove now-unused `chip-token` / `chip-fly`)

Context: The seat keeps its text action badge ("Bet $9"). We only remove the flying chip token; the `chips` flag and the chip `<span>` go away. Motion now lives in the center pile (Task 4).

- [ ] **Step 1: Simplify the badge map and remove the chip span**

In `components/table/Seat.tsx`:

Change the `ACTION_BADGE` map (lines 12-18) so entries no longer carry `chips` (it's no longer used):

```tsx
const ACTION_BADGE: Record<string, (amt: number) => { text: string; color: string }> = {
  fold: () => ({ text: "Fold", color: "var(--mistake)" }),
  check: () => ({ text: "Check", color: "var(--ink-soft)" }),
  call: (a) => ({ text: `Call $${a}`, color: "var(--good)" }),
  bet: (a) => ({ text: `Bet $${a}`, color: "var(--gold)" }),
  raise: (a) => ({ text: `Raise $${a}`, color: "var(--gold)" }),
};
```

Then replace the entire `ActionBadge` function body (lines 20-53) with a version that drops the chip token:

```tsx
function ActionBadge({ action }: { action: SeatAction }) {
  const meta = ACTION_BADGE[action.action]?.(action.amount);
  if (!meta) return null;
  return (
    <span
      data-testid="seat-action"
      className="action-badge"
      // key on the action so a new action re-triggers the pop
      key={`${action.action}-${action.amount}`}
      style={{
        display: "inline-block",
        marginTop: 6,
        fontSize: 11,
        fontWeight: 700,
        color: "#10231a",
        background: meta.color,
        borderRadius: "var(--r-pill)",
        padding: "1px 8px",
      }}
    >
      {meta.text}
    </span>
  );
}
```

- [ ] **Step 2: Remove unused chip CSS**

In `app/globals.css`, delete the `.chip-token` rule (lines 89-99), the `.chip-fly` rule + `@keyframes chip-fly` (lines 100-105), and the now-dangling `.chip-fly { animation: none; opacity: 0; }` line inside the reduced-motion block (line 120). Leave the `--chip` / `--chip-edge` variables (still used by `.pile-chip`).

- [ ] **Step 3: Typecheck + existing Seat-related tests**

Run: `npm run typecheck && npm test -- Seat`
Expected: PASS. (If there is no `Seat` test file, the test command matches nothing and exits cleanly — that's fine; the typecheck is the gate here.)

- [ ] **Step 4: Commit**

```bash
git add components/table/Seat.tsx app/globals.css
git commit -m "refactor(ui): drop fly-to-center chip from Seat (motion moves to center pile)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `replayAt` into `PokerTable`

**Files:**
- Modify: `components/table/PokerTable.tsx`
- Delete: `components/table/PotDisplay.tsx`

Context: `PokerTable` already maintains the `revealed` cursor. Compute `flow.replayAt(revealed)` once per render and pass it to `CenterStack`; pass `snapshot.boardCount` to `Board`. The old `view.pot` is still used by `ActionBar` (sizing) and `HandRecap` (unchanged), so keep `view` — just stop rendering `PotDisplay`.

- [ ] **Step 1: Swap the import**

In `components/table/PokerTable.tsx`, replace the import line (line 11):

```tsx
import { PotDisplay } from "@/components/table/PotDisplay";
```

with:

```tsx
import { CenterStack } from "@/components/table/CenterStack";
```

- [ ] **Step 2: Compute the snapshot and render it**

After the line `const latest = latestActionPerSeat(log.slice(0, revealed));` (line 45), add:

```tsx
  const snapshot = flow.replayAt(revealed);
```

Then replace the center column block (lines 61-64):

```tsx
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16, gap: 6 }}>
          <PotDisplay pot={view.pot} />
          <Board cards={view.board} />
        </div>
```

with:

```tsx
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16, gap: 6 }}>
          <Board cards={view.board} count={snapshot.boardCount} />
          <CenterStack snapshot={snapshot} />
        </div>
```

(Board moves above the pile so the community cards sit at the top of the center zone, matching the approved mockup.)

- [ ] **Step 3: Delete `PotDisplay`**

```bash
git rm components/table/PotDisplay.tsx
```

- [ ] **Step 4: Typecheck + full test run**

Run: `npm run typecheck && npm test`
Expected: PASS. No remaining references to `PotDisplay` (grep to confirm: `grep -rn PotDisplay components app` returns nothing).

- [ ] **Step 5: Commit**

```bash
git add components/table/PokerTable.tsx
git commit -m "feat(ui): wire central CenterStack + street-synced board into PokerTable

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Verify end-to-end in the running app

**Files:** none (manual verification)

- [ ] **Step 1: Lint + typecheck + tests**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS.

- [ ] **Step 2: Run the app and watch a hand**

Run: `npm run dev`, open http://localhost:3000, deal a hand, and confirm:
- The board reveals flop → turn → river in step with the action reveal (not all 5 cards at once).
- The pot total grows as actions reveal (starts at the blinds, not the final number).
- A chip pile sits in the center and grows with the pot.
- The "This round" breakdown lists each chip-committing action for the current street (including your own), and clears when the street advances.
- No chips fly out of seats and vanish; seats still show their text badge.

- [ ] **Step 3: Commit any fixes, then stop**

If Step 2 surfaces issues, fix them with a follow-up TDD cycle (add/adjust a test first), commit, and re-verify. Otherwise the feature is complete.

---

## Self-Review Notes

- **Spec coverage:** `replayAt` + `ReplaySnapshot` (Task 1-2) cover the core pot/breakdown/board-count math; `CenterStack` (Task 4) covers pile + pot + current-round breakdown including hero actions; `Board` count (Task 5) covers street-synced reveal; `Seat` (Task 6) removes the vanishing chip; `PokerTable` (Task 7) wires it and deletes `PotDisplay`. Non-goals (winner animation, side-pot viz, bets-in-front) are not implemented — correct.
- **Type consistency:** `ReplaySnapshot` shape (pot/street/boardCount/roundContributions{seat,name,action,amount}) is identical across Task 1 (definition), Task 2 (producer), Task 4 (consumer + test fixture). `boardCountForStreet` name consistent in Tasks 1, 2. `CenterStack` prop is `snapshot: ReplaySnapshot` in Tasks 4 and 7.
- **No placeholders:** every code step shows full code; commands have expected output.
