---
tier: 2
type: enhancement
feature: ux-ui-cleanup
spec_ref: 02_spec.md
requirements_ref: 01_requirements.md
date: 2026-06-03
status: Draft
commit_cadence: per-task
contract_version: 1
spec_hash: 2026-06-03-11sections
execution_mode: subagent-driven
---

# UX/UI Cleanup — Implementation Plan

---

## Overview

Five independent, UI-only fixes to the Poker Coach play interface: merge five tabs into three
(`Live Feedback` · `Coaching` · `References`), remove the duplicate Hand review below the table,
style the Coaching markdown via a scoped CSS class, and make the acting-seat glow follow whoever is
to act next (bot or hero) during the reveal. No `core/`, API, or data-schema change. Each task is a
thin vertical slice through the components it touches, with co-located Vitest coverage.

**Done when:** the tab strip shows exactly three tabs with all prior content reachable, `HandRecap`
renders only inside Live Feedback (never below the table), Coaching markdown shows visible heading/
list/bold hierarchy from design tokens, the gold glow lands on the seat to act during the bot
reveal, and `npm run typecheck` + `npm run lint` + `npm test` + `npm run build` all exit 0 (the full
Vitest suite green, including the updated `RightPanel` test and the new glow-selector test).

**Done-when walkthrough:** After `npm run dev`, the right column shows three tabs. Clicking
**Live Feedback** shows the per-decision feedback on top and the Hand review list below in one scroll;
**References** shows Rankings above the Pre-Flop chart; **Coaching** (with a generated doc) shows
styled headings/lists/bold. Dealing a hand where a bot acts first shows the gold glow walking bot
seat → bot seat at ~380 ms each, then resting on the hero. Below the table there is no Hand review
block — only "Opponents acting…" and, on hand-over, the "Next hand" button. `npm test` reports all
suites passing; `npm run typecheck` confirms the new `TabKey` union has no stragglers.

**Execution order:**

```
T1 (tab merge — tracer bullet: store + TabStrip + RightPanel end-to-end)
T2 (remove duplicate HandRecap below table)   [P after T1]
T3 (Coaching markdown styling)                [P after T1]
T4 (acting-seat glow selector)  ── depends on T2 (same file: PokerTable.tsx)
TN (final verification)         ── depends on T1, T2, T3, T4
```

T2 and T3 are independent of each other and of T1's files; T4 edits `PokerTable.tsx` after T2 to
keep that file's edits sequential and conflict-free.

---

## Decision Log

> Inherits architecture decisions from `02_spec.md §4` (D1–D7). Entries below are implementation-specific.

| # | Decision | Options Considered | Rationale |
|---|----------|-------------------|-----------|
| D1 | T1 bundles the `TabKey` union change with its three consumers (store, `TabStrip`, `RightPanel`) into one task | (a) split the union into its own task, (b) bundle into one tracer-bullet task | The union rename makes `TabStrip.TABS` and every `RightPanel` branch fail `tsc` until they are all updated together; splitting would leave an un-shippable red typecheck. One cohesive slice keeps each commit green. |
| D2 | Extract a pure `selectActingSeat(revealing, log, revealed, view)` helper in `PokerTable.tsx` for the glow logic | (a) inline the ternary at the `<Seat>` call site, (b) extract a pure exported function | A pure function is unit-testable without rendering the table or faking timers — directly verifies the reveal-walk contract (FR-12, spec §10.1). |
| D3 | Coaching typography lives in a new `.coaching-doc` block in `globals.css`, applied as a real `className` on the rendered `<article>` | (a) global `h1/h2/h3/p/ul/li` selectors, (b) scope to the existing `[data-testid="coaching-doc"]`, (c) real class | Global element selectors would bleed into the inline-styled panels and the empty-state markup; `data-testid` is a test hook, not a style contract. A real class is the explicit styling seam (spec D5). |

---

## Code Study Notes

> Glossary inherited from `02_spec.md` — the plan introduces no new domain terms.

### Patterns to follow

- `store/sessionStore.ts:10` — `TabKey` union string-literal type; `:35` default `activeTab`; `:55` `setActiveTab` setter. The whole tab key set lives here.
- `components/TabStrip.tsx:7-13` — `TABS: { key: TabKey; label: string }[]`; roving-focus keyboard nav (`:22-42`) is driven off `TABS` length/order, so it adapts to three tabs with no change.
- `components/RightPanel.tsx:35-46` — one `activeTab === "<key>" && <Panel/>` branch per tab inside `#tab-body`; the merge stacks two existing panels in a branch.
- `components/table/PokerTable.tsx:108` — `isActing={!revealing && !view.isOver && s.seat === view.toAct}` is the current (buggy) glow gate; `:45` `revealing`, `:27` `log`, `:29` `revealed`, `:44` `view`.
- `components/table/Seat.tsx:68` — `const glow = isWinner ? "winner-glow" : isActing ? "acting-glow" : undefined;` — unchanged; the fix feeds it a correct `isActing`.
- `components/CoachingViewer.tsx:123` — rendered `<article data-testid="coaching-doc" style={{marginTop:16}}>`; in-house `renderMarkdown` (`:24-62`) emits `h1/h2/h3/p/ul/li/strong`.
- `app/globals.css:130-143` — `.acting-glow` ring + `acting-pulse` keyframes gated behind `@media (prefers-reduced-motion: no-preference)` — the reduced-motion contract is inherited by every seat for free (FR-14).

### Existing code to reuse

- `components/FeedbackPanel.tsx`, `components/HandRecap.tsx` — stacked unchanged inside the `live-feedback` branch (T1).
- `components/RankingsTab.tsx`, `components/PreflopChartTab.tsx` — stacked unchanged inside the `references` branch (T1).
- `HandRecap` renders an `<h2>Hand review</h2>` (`components/HandRecap.tsx:56`) — the title string used by the dual-render guard test (T2) and the Live Feedback render test (T1).

### Constraints discovered

- `RightPanel.test.tsx` currently asserts the default tab is `feedback` (`:10`, `:20`) and clicks a `rankings` tab (`:25-27`) — it **will break** under the new union and must be updated in T1.
- The only references to the old tab-key strings across the app are `sessionStore.ts`, `TabStrip.tsx`, `RightPanel.tsx`, and `RightPanel.test.tsx` (grep-confirmed). `gameStore.ts` and `store.test.ts` reference `feedback` as the *analysis* object, not the tab key — do not touch.
- `PokerTable.tsx` is edited by both T2 (remove `HandRecap`) and T4 (glow selector); T4 depends on T2 to serialize the edits.
- jsdom has no layout/animation engine — glow correctness is asserted on the selector function (T4) and `Seat`'s class mapping (existing `Seat.test.tsx`), not on rendered pixels; the visible walk is a TN manual/Playwright check.

### Stack signals

- `package.json` present with `package-lock.json` → **npm** (single JS stack; no lockfile ambiguity). Scripts: `npm run dev|build|start`, `npm test` (`vitest run`), `npm run typecheck` (`tsc --noEmit`), `npm run lint` (ESLint). Test runner: Vitest + `@testing-library/react`, co-located `*.test.tsx`. Next.js app-router, TypeScript, no Tailwind (inline styles + `globals.css` tokens). Reference system for conventions: the existing `components/*` + co-located tests.

---

## Prerequisites

- `npm install` already run; `node_modules` present.
- On branch `feat/ux-ui-cleanup` in the worktree (already true).
- Baseline green: `npm run typecheck && npm test` pass on HEAD before starting (T0 confirms).

---

## File Map

| Action | File | Responsibility | Task |
|--------|------|---------------|------|
| Modify | `store/sessionStore.ts:10,35,55` | New `TabKey` union + default + coercing `setActiveTab` | T1 |
| Modify | `components/TabStrip.tsx:7-13` | `TABS` → three merged tabs | T1 |
| Modify | `components/RightPanel.tsx:35-46` | Merge branches → `live-feedback` / `coaching` / `references` | T1 |
| Modify | `components/RightPanel.test.tsx` | Update default-tab + click assertions; add merged-panel + three-tab tests | T1 |
| Modify | `components/table/PokerTable.tsx:137-143` | Remove below-table `<HandRecap>` + its import | T2 |
| Test   | `components/table/PokerTable.handrecap.test.tsx` | Source-level guard: `PokerTable.tsx` no longer imports/renders `HandRecap` | T2 |
| Modify | `components/CoachingViewer.tsx:123` | Add `className="coaching-doc"` to the rendered `<article>` | T3 |
| Modify | `app/globals.css` (append) | `.coaching-doc` typography from tokens | T3 |
| Modify | `components/CoachingViewer.test.tsx` | Assert the rendered doc carries `class="coaching-doc"` | T3 |
| Modify | `components/table/PokerTable.tsx:44-46,108` | Extract + use `selectActingSeat`; pass reveal-aware `isActing` | T4 |
| Test   | `components/table/PokerTable.glow.test.tsx` | Unit-test `selectActingSeat` reveal/post-reveal/over cases | T4 |

---

## Tasks

### T1: Merge five tabs into three (tracer bullet)

**Goal:** Replace the five-tab strip with `Live Feedback · Coaching · References`, stacking the merged panels, with a green typecheck end-to-end through store → strip → panel.
**Spec refs:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08 (`02_spec.md#6-1-tabs`, `#6-2-panels`)
**Depends on:** none
**Idempotent:** yes
**TDD:** yes — new-feature
**Slice shape:** vertical — store state → tab strip → rendered panels, the narrowest end-to-end proof that the union change survives across every consumer (the riskiest unproven point: `tsc` fallout from the rename).

**Files:**
- Modify: `store/sessionStore.ts`
- Modify: `components/TabStrip.tsx`
- Modify: `components/RightPanel.tsx`
- Modify: `components/RightPanel.test.tsx`

**Steps:**

- [ ] Step 1: Update the failing tests first in `components/RightPanel.test.tsx`. Replace the `beforeEach` reset and the two existing tests so they target the new union; add the merged-panel + three-tab coverage:
  ```tsx
  beforeEach(() => {
    cleanup();
    useSessionStore.getState().setActiveTab("live-feedback");
  });

  describe("RightPanel", () => {
    it("shows Live Feedback by default and only the tab body scrolls", () => {
      const { container } = render(<RightPanel />);
      const body = container.querySelector('[data-testid="tab-body"]') as HTMLElement;
      expect(body.id).toBe("tab-body");
      expect(body.style.overflowY).toBe("auto");
      expect(screen.getByRole("tab", { name: /live feedback/i })).toHaveAttribute("aria-selected", "true");
    });

    it("renders exactly three tabs and no legacy standalone tabs", () => {
      render(<RightPanel />);
      expect(screen.getAllByRole("tab")).toHaveLength(3);
      expect(screen.getByRole("tab", { name: /live feedback/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /coaching/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /references/i })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: /^hands$/i })).toBeNull();
      expect(screen.queryByRole("tab", { name: /^rankings$/i })).toBeNull();
      expect(screen.queryByRole("tab", { name: /preflop/i })).toBeNull();
    });

    it("switches to References on click", () => {
      render(<RightPanel />);
      fireEvent.click(screen.getByRole("tab", { name: /references/i }));
      expect(screen.getByRole("tab", { name: /references/i })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: /live feedback/i })).toHaveAttribute("aria-selected", "false");
    });

    it("coerces a stale persisted tab key to live-feedback", () => {
      // @ts-expect-error — simulate an old persisted value outside the new union
      useSessionStore.getState().setActiveTab("rankings");
      expect(useSessionStore.getState().activeTab).toBe("live-feedback");
    });
  });
  ```
  [Tests are illustrative (FR-103) — keep the same assertions; adapt imports/helpers to the file's existing `render/screen/fireEvent/cleanup` setup.]

- [ ] Step 2: Run the tests to confirm they fail against the old union.
  Run: `npm test -- components/RightPanel.test.tsx`
  Expected: FAIL — `setActiveTab("live-feedback")` yields no matching tab; "live feedback" tab not found.

- [ ] Step 3: Update `store/sessionStore.ts`:
  - Line 10 → `export type TabKey = "live-feedback" | "coaching" | "references";`
  - Line 35 default → `activeTab: "live-feedback",`
  - Replace the setter (line 55) with a coercing version (FR-02, D7):
  ```ts
  const TAB_KEYS: TabKey[] = ["live-feedback", "coaching", "references"];
  // ...inside the store:
  setActiveTab: (tab) =>
    set({ activeTab: TAB_KEYS.includes(tab as TabKey) ? (tab as TabKey) : "live-feedback" }),
  ```
  Keep `setActiveTab: (tab: TabKey) => void` in the interface; the runtime guard defends against a stale persisted/external value.

- [ ] Step 4: Update `components/TabStrip.tsx` `TABS` (lines 7-13):
  ```tsx
  export const TABS: { key: TabKey; label: string }[] = [
    { key: "live-feedback", label: "Live Feedback" },
    { key: "coaching", label: "Coaching" },
    { key: "references", label: "References" },
  ];
  ```
  No other change — the roving-focus/arrow-key nav reads `TABS` generically (FR-04).

- [ ] Step 5: Update `components/RightPanel.tsx` branches (lines 35-46). Replace the five branches with three:
  ```tsx
  {activeTab === "live-feedback" && (
    <>
      <FeedbackPanel analysis={feedback?.analysis ?? null} enabled={settings.feedbackEnabled} />
      {flow ? (
        <HandRecap decisions={flow.decisions()} heroNet={flow.tableView().heroNet} />
      ) : null}
    </>
  )}
  {activeTab === "coaching" && <CoachingViewer sessionId={sessionId} />}
  {activeTab === "references" && (
    <>
      <RankingsTab />
      <PreflopChartTab />
    </>
  )}
  ```
  Remove the now-unused `Placeholder` helper if nothing else references it (the `live-feedback` branch relies on `FeedbackPanel`'s own empty state and `HandRecap`'s null-when-no-decisions; spec E1). Keep all imports that are still used (`FeedbackPanel`, `CoachingViewer`, `HandRecap`, `RankingsTab`, `PreflopChartTab`).

- [ ] Step 6: Run the tests to confirm they pass.
  Run: `npm test -- components/RightPanel.test.tsx`
  Expected: PASS — all four tests green.

- [ ] Step 7: Typecheck (proves the union has no stragglers anywhere).
  Run: `npm run typecheck`
  Expected: exit 0, no errors.

- [ ] Step 8: Commit.
  ```bash
  git add store/sessionStore.ts components/TabStrip.tsx components/RightPanel.tsx components/RightPanel.test.tsx
  git commit -m "feat(T1): merge tabs into Live Feedback / Coaching / References"
  ```

**Inline verification:**
- `npm run typecheck` — exit 0 (TabKey union resolved across all consumers).
- `npm test -- components/RightPanel.test.tsx` — 4 passed, 0 failed.
- `npm run lint` — no errors in the four touched files.

---

### T2: Remove the duplicate Hand review below the table

**Goal:** Stop rendering `HandRecap` in the table column on hand-over; keep the "Next hand" button. Hand review now lives only in Live Feedback (T1).
**Spec refs:** FR-09 (`02_spec.md#6-3-remove-duplicate-hand-review`)
**Depends on:** T1
**Idempotent:** yes
**TDD:** yes — bug-fix
**Slice shape:** vertical — the table column's hand-over render path end-to-end (component output asserted via the guard test).

**Files:**
- Modify: `components/table/PokerTable.tsx`
- Test: `components/table/PokerTable.handrecap.test.tsx`

**Steps:**

- [ ] Step 1: Write the failing source-level guard test `components/table/PokerTable.handrecap.test.tsx`. Read the component source and assert it no longer imports or renders `HandRecap` (deterministic; no flow stub, no jsdom layout — spec §10.1 grep-level minimum, D-finding Loop 1):
  ```tsx
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
  ```
  [`__dirname` resolves to `components/table/` under Vitest's Node environment. If the suite runs in a `jsdom`-only config without `__dirname`, swap to `resolve(process.cwd(), "components/table/PokerTable.tsx")` — same assertion.]

- [ ] Step 2: Run the test to confirm it fails (HandRecap still imported/rendered).
  Run: `npm test -- components/table/PokerTable.handrecap.test.tsx`
  Expected: FAIL — the import and `<HandRecap` matchers both find a match.

- [ ] Step 3: In `components/table/PokerTable.tsx`, remove the `<HandRecap …>` element inside the `view.isOver` block (line 139). The block becomes just the "Next hand" button:
  ```tsx
  ) : view.isOver ? (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <Button variant="primary" onClick={newHand}>
        Next hand
      </Button>
    </div>
  ) : view.isHeroTurn ? (
  ```
  Remove the now-unused import on line 14: `import { HandRecap } from "@/components/HandRecap";`.

- [ ] Step 4: Run the test to confirm it passes.
  Run: `npm test -- components/table/PokerTable.handrecap.test.tsx`
  Expected: PASS.

- [ ] Step 5: Typecheck — confirms `HandRecap` is no longer referenced in `PokerTable.tsx` (no unused-import or missing-symbol error).
  Run: `npm run typecheck`
  Expected: exit 0.

- [ ] Step 6: Commit.
  ```bash
  git add components/table/PokerTable.tsx components/table/PokerTable.handrecap.test.tsx
  git commit -m "fix(T2): remove duplicate Hand review below the table"
  ```

**Inline verification:**
- `npm test -- components/table/PokerTable.handrecap.test.tsx` — 1 passed.
- `npm run lint` — no `no-unused-vars` error for `HandRecap` in `PokerTable.tsx`.

---

### T3: Style the Coaching markdown

**Goal:** Give Coaching headings/paragraphs/lists/bold visible hierarchy from design tokens, scoped to a `.coaching-doc` class so it never bleeds into other panels.
**Spec refs:** FR-10, FR-11, E2 (`02_spec.md#6-4-coaching-markdown-styling`)
**Depends on:** T1
**Idempotent:** yes
**TDD:** yes — new-feature (class wiring is unit-asserted; the CSS itself is illustrative reference per FR-103)
**Slice shape:** vertical — rendered `<article>` carries the class → `globals.css` styles it; the class wiring is the testable seam.

**Files:**
- Modify: `components/CoachingViewer.tsx`
- Modify: `app/globals.css`
- Modify: `components/CoachingViewer.test.tsx`

**Steps:**

- [ ] Step 1: Add a failing assertion to `components/CoachingViewer.test.tsx` (inside the existing `describe`):
  ```tsx
  it("tags the rendered coaching doc with the coaching-doc class", async () => {
    mockCoaching([{ name: "s_h1.md", content: "# Hand 1\n## Recurring leaks\n- Calling too wide\n" }]);
    const { container } = render(<CoachingViewer sessionId="s" />);
    await screen.findByRole("heading", { name: /recurring leaks/i });
    const article = container.querySelector('[data-testid="coaching-doc"]') as HTMLElement;
    expect(article).toBeTruthy();
    expect(article.classList.contains("coaching-doc")).toBe(true);
  });
  ```

- [ ] Step 2: Run to confirm it fails (no class yet).
  Run: `npm test -- components/CoachingViewer.test.tsx`
  Expected: FAIL — `classList.contains("coaching-doc")` is false.

- [ ] Step 3: In `components/CoachingViewer.tsx` line 123, add the class to the rendered article (keep the `data-testid` and inline `marginTop`):
  ```tsx
  <article key={f.name} data-testid="coaching-doc" className="coaching-doc" style={{ marginTop: 16 }}>
  ```

- [ ] Step 4: Append a `.coaching-doc` typography block to `app/globals.css` (after the existing rules; uses only existing tokens — `--ink`, `--ink-soft`, `--gold`). No global element selectors (FR-11, D5):
  ```css
  /* Coaching markdown typography (plan T3, spec FR-11/D5). Scoped to .coaching-doc so it never
     bleeds into the inline-styled feedback/reference panels. Hierarchy + rhythm from design tokens. */
  .coaching-doc { color: var(--ink); line-height: 1.6; }
  .coaching-doc h1 { font-size: 22px; font-weight: 700; color: var(--gold); margin: 20px 0 8px; }
  .coaching-doc h2 { font-size: 18px; font-weight: 700; color: var(--ink); margin: 18px 0 6px; }
  .coaching-doc h3 { font-size: 15px; font-weight: 600; color: var(--ink-soft); margin: 14px 0 4px;
    text-transform: uppercase; letter-spacing: 0.04em; }
  .coaching-doc p { margin: 8px 0; color: var(--ink); }
  .coaching-doc ul { margin: 8px 0; padding-left: 20px; }
  .coaching-doc li { margin: 3px 0; color: var(--ink); }
  .coaching-doc strong { color: var(--gold); font-weight: 700; }
  ```

- [ ] Step 5: Run to confirm the test passes.
  Run: `npm test -- components/CoachingViewer.test.tsx`
  Expected: PASS — existing heading/empty/refresh tests still green plus the new class assertion.

- [ ] Step 6: Commit.
  ```bash
  git add components/CoachingViewer.tsx app/globals.css components/CoachingViewer.test.tsx
  git commit -m "feat(T3): style Coaching markdown via scoped .coaching-doc class"
  ```

**Inline verification:**
- `npm test -- components/CoachingViewer.test.tsx` — all tests passed (4 incl. new).
- Manual (TN): open Coaching with a generated doc; headings/lists/bold are clearly styled and match the felt theme; the empty state (`coaching-empty`) is visually unchanged.

---

### T4: Make the acting-seat glow follow whoever acts next

**Goal:** During the bot-action reveal, glow the seat whose action is being revealed (walking seat-to-seat); after the reveal, glow `view.toAct`; never during showdown. Fixes the bug where only the hero glows.
**Spec refs:** FR-12, FR-13, FR-14, E3, E5, E6 (`02_spec.md#6-5-acting-seat-glow`)
**Depends on:** T2 (same file — `PokerTable.tsx`)
**Idempotent:** yes
**TDD:** yes — bug-fix
**Slice shape:** vertical — reveal cursor → `selectActingSeat` → `<Seat isActing>`; the pure selector is the testable seam (jsdom can't assert the animated ring).

**Files:**
- Modify: `components/table/PokerTable.tsx`
- Test: `components/table/PokerTable.glow.test.tsx`

**Steps:**

- [ ] Step 1: Write the failing regression test `components/table/PokerTable.glow.test.tsx` against a pure exported helper (to be created in Step 3):
  ```tsx
  import { describe, it, expect } from "vitest";
  import { selectActingSeat } from "@/components/table/PokerTable";

  describe("selectActingSeat (FR-12)", () => {
    const log = [{ seat: 3 }, { seat: 5 }, { seat: 0 }] as any;

    it("glows the seat being revealed while revealing (bot seat, not the hero)", () => {
      // revealing = revealed < total; cursor at index 0 → first bot's seat
      expect(selectActingSeat(true, log, 0, { isOver: false, toAct: 0 } as any)).toBe(3);
      expect(selectActingSeat(true, log, 1, { isOver: false, toAct: 0 } as any)).toBe(5);
    });

    it("falls back to view.toAct after the reveal finishes", () => {
      expect(selectActingSeat(false, log, 3, { isOver: false, toAct: 0 } as any)).toBe(0);
    });

    it("returns null when the hand is over (showdown — no glow)", () => {
      expect(selectActingSeat(false, log, 3, { isOver: true, toAct: null } as any)).toBeNull();
    });

    it("returns null when revealing but the cursor is past the log (defensive)", () => {
      expect(selectActingSeat(true, log, 9, { isOver: false, toAct: 0 } as any)).toBeNull();
    });
  });
  ```

- [ ] Step 2: Run to confirm it fails (`selectActingSeat` not exported yet).
  Run: `npm test -- components/table/PokerTable.glow.test.tsx`
  Expected: FAIL — import resolves to undefined / "not a function".

- [ ] Step 3: In `components/table/PokerTable.tsx`, add the exported pure helper above the component (FR-12, D2):
  ```tsx
  // The seat that should glow gold. While the reveal cursor is walking the bot actions, glow the
  // seat whose action is being revealed; once the reveal finishes, glow whoever is to act (the hero
  // on their turn); during showdown (hand over) nothing glows. (spec FR-12)
  export function selectActingSeat(
    revealing: boolean,
    log: { seat: number }[],
    revealed: number,
    view: { isOver: boolean; toAct: number | null },
  ): number | null {
    if (revealing) return log[revealed]?.seat ?? null;
    return view.isOver ? null : view.toAct;
  }
  ```

- [ ] Step 4: Use it at the seat render site. Replace line 108's `isActing` expression:
  ```tsx
  // just below `const revealing = revealed < total;` (~line 45):
  const actingSeat = selectActingSeat(revealing, log, revealed, view);
  // ...and in the <Seat> props:
  isActing={actingSeat != null && s.seat === actingSeat}
  ```
  `Seat`'s `.acting-glow` mapping (`Seat.tsx:68`) is unchanged, so the reduced-motion gate (`globals.css:141-143`) applies to every acting seat for free (FR-13, FR-14).

- [ ] Step 5: Run the glow test to confirm it passes.
  Run: `npm test -- components/table/PokerTable.glow.test.tsx`
  Expected: PASS — all four cases.

- [ ] Step 6: Confirm no `Seat` regression and a clean typecheck.
  Run: `npm test -- components/table/Seat.test.tsx && npm run typecheck`
  Expected: `Seat` tests still green (isActing→`.acting-glow` symmetric); typecheck exit 0.

- [ ] Step 7: Commit.
  ```bash
  git add components/table/PokerTable.tsx components/table/PokerTable.glow.test.tsx
  git commit -m "fix(T4): acting-seat glow follows the seat to act during reveal"
  ```

**Inline verification:**
- `npm test -- components/table/PokerTable.glow.test.tsx` — 4 passed.
- `npm test -- components/table/Seat.test.tsx` — unchanged, green.
- Manual (TN): deal a hand where a bot acts first; the gold glow visibly walks bot seats (~380 ms each) then rests on the hero.

---

### TN: Final Verification

**Goal:** Verify all five fixes work end-to-end with no regressions.

- [ ] **Lint & format:** `npm run lint` — exit 0, no errors.
- [ ] **Type check:** `npm run typecheck` — exit 0 (the `TabKey` union has no stragglers).
- [ ] **Full test suite:** `npm test` — all suites pass, 0 failures (includes updated `RightPanel.test.tsx`, new `PokerTable.handrecap.test.tsx`, new `PokerTable.glow.test.tsx`, extended `CoachingViewer.test.tsx`, unchanged `Seat.test.tsx`).
- [ ] **Production build:** `npm run build` — `next build` completes clean (no type/lint failure, no page-export error).
- [ ] **Frontend smoke test (Playwright MCP or manual `npm run dev`):**
  1. Load the play screen; confirm the right strip shows exactly **Live Feedback · Coaching · References** (three `role="tab"` buttons), no `Hands`/`Rankings`/`Preflop Chart`/`Feedback` standalone tabs.
  2. **Live Feedback** tab: after a decision, per-decision feedback on top; after hand-over, the "Hand review" list below — both in one scroll.
  3. **References** tab: Rankings above, Pre-Flop chart below in one scroll.
  4. **Coaching** tab (with a generated doc via `/poker-coach last`): headings/lists/bold clearly styled, matching the felt theme; empty state unchanged when no doc.
  5. Deal a hand where a bot acts first: the gold glow walks bot seat → bot seat (~380 ms each), then rests on the hero on their turn.
  6. Below the table: only "Opponents acting…" mid-hand and the "Next hand" button on hand-over — **no** Hand review block.
  7. **Hard-reload** the play screen (fresh tab) and re-check the three tabs render and the default tab is Live Feedback (no blank panel from a stale persisted key — FR-02/E4).
  8. **Error/edge path:** open Live Feedback with no hand dealt — FeedbackPanel shows its empty/disabled state, no HandRecap, no console error.
- [ ] **Reduced-motion check (E3):** with `prefers-reduced-motion: reduce` set, the acting glow is a static gold ring for an acting bot seat (no pulse).
- [ ] **UX polish checklist:** no internal tab-key strings leaked into visible copy; tab labels match panel content; zero uncaught console errors during the journey; no dead/disabled affordances introduced.
- [ ] **Done-when walkthrough:** trace each Done-when clause — three tabs (Step 1), single Hand review (Steps 2, 6), styled Coaching (Step 4), reveal-walking glow (Step 5), and `typecheck`+`lint`+`test`+`build` all green.

**Cleanup:**
- Remove the plan lock if present: `rm -f docs/pmos/features/2026-06-03_ux-ui-cleanup/.plan.lock` (handled by /plan close; listed for completeness).
- No temp files, feature flags, worktree containers, or seed data introduced — nothing else to clean.

---

## Review Log

| Loop | Findings | Changes Made |
|------|----------|-------------|
| 1    | Structural: all 14 FRs mapped, no placeholders, behavioral verification on each task, type-consistency clean. Design: T2's render-based guard needed a brittle full-`flow` stub. | Switched T2 to a deterministic source-level guard (read `PokerTable.tsx`, assert no `HandRecap` import/render + "Next hand" retained) per spec §10.1 and user disposition "Fix as proposed". All other checks passed with no change. |
