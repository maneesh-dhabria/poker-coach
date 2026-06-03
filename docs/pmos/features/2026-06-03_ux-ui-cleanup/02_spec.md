---
tier: 2
type: enhancement
feature: ux-ui-cleanup
date: 2026-06-03
status: Ready for Plan
requirements: docs/pmos/features/2026-06-03_ux-ui-cleanup/01_requirements.md
---

# UX/UI Cleanup — Spec

## 1. Problem Statement

Five UX rough edges in the Poker Coach play interface: a five-tab strip where two pairs are
conceptually one section each, a Hand review summary rendered twice on screen, unstyled-looking
Coaching markdown, and a "whose turn" glow that effectively only shows for the human seat. Primary
success signal: the right-panel reads as three clear sections, the table feedback is consistent, and
the acting glow follows whoever is to act. No data-model or API change.

## 2. Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Tab strip reads as three sections | Strip shows exactly `Live Feedback`, `Coaching`, `References`; all prior content reachable |
| G2 | Hand review appears once | `HandRecap` renders only in the Live Feedback tab, never below the table |
| G3 | Coaching markdown is styled | Coaching headings/paragraphs/lists/bold have visible hierarchy from design tokens, scoped to coaching content |
| G4 | Acting glow follows the actor | The gold glow lands on the seat to act — bot or human — including during the bot-action reveal |

## 3. Non-Goals

- NOT restyling tabs/colors/table layout — because this is a cleanup, not a redesign.
- NOT adding a markdown library or new coaching/reference content — because the fix is CSS over the existing custom renderer.
- NOT changing bot decision logic or `REVEAL_MS` pacing — because 380ms/action is already perceptible (grill-confirmed).
- NOT adding any persisted user setting — because none of these introduce a preference.

## 4. Decision Log

| # | Decision | Options Considered | Rationale |
|---|----------|-------------------|-----------|
| D1 | New `TabKey` union: `"live-feedback" \| "coaching" \| "references"`; default `live-feedback` | (a) keep old keys + alias, (b) new clean union | Clean union; tabs are in-session state, low blast radius. |
| D2 | Live Feedback panel = `<FeedbackPanel>` stacked above `<HandRecap>` in `#tab-body` | (a) stacked, (b) segmented toggle | User-confirmed stacked (req D2). |
| D3 | References panel = `<RankingsTab>` stacked above `<PreflopChartTab>` | (a) toggle, (b) stacked | User-confirmed stacked (req D3). |
| D4 | Tab order: Live Feedback · Coaching · References | n/a | Live Feedback default/most-used; References last. |
| D5 | Coaching typography scoped via a real CSS class `.coaching-doc` on the rendered `<article>` (alongside the existing `data-testid`) | (a) global `h1/p/ul` rules, (b) scope to `[data-testid]`, (c) real class | Real class is the styling contract; global rules would bleed into inline-styled panels; `data-testid` is a test hook, not a style hook. |
| D6 | Glow selector: `actingSeat = revealing ? log[revealed]?.seat : (view.isOver ? null : view.toAct)`; pass `isActing={s.seat === actingSeat}` | (a) only `view.toAct` post-reveal (status quo bug), (b) reveal-aware selector | Reveal-aware selector makes the glow walk the action seat-by-seat, then rest on the hero. (grill-confirmed) |
| D7 | Stale persisted `activeTab` (e.g. old `"rankings"`) coerces to `live-feedback` | (a) ignore, (b) coerce unknown → default | Defensive: if the tab key was ever persisted, an old value must not render a blank panel. |

## 5. User Journeys

**Playing a hand:** Deal → first actor is a bot → that bot's seat glows during its reveal → glow walks seat-to-seat → rests on hero on their turn → hero acts. Below the table: only the table, the "Opponents acting…" line, and (on hand-over) the "Next hand" button — **no** Hand review block. After the hand, open **Live Feedback**: live per-decision feedback on top, full Hand review list below.

**References/Coaching:** Open **References** → Rankings above, Pre-Flop chart below (one scroll). Open **Coaching** → styled, scannable doc.

## 6. Functional Requirements

### 6.1 Tabs

| ID | Requirement |
|----|-------------|
| FR-01 | `store/sessionStore.ts` `TabKey` = `"live-feedback" \| "coaching" \| "references"`; default `activeTab = "live-feedback"`. |
| FR-02 | `setActiveTab` coerces any value not in `TabKey` to `"live-feedback"` (FR guards stale persisted state, D7). |
| FR-03 | `components/TabStrip.tsx` `TABS` = `[{live-feedback,"Live Feedback"},{coaching,"Coaching"},{references,"References"}]`, in that order. |
| FR-04 | Keyboard nav (arrow/Home/End cycling) continues to work over the three-tab set unchanged. |

### 6.2 Panels

| ID | Requirement |
|----|-------------|
| FR-05 | `RightPanel` `live-feedback` branch renders `<FeedbackPanel …>` then `<HandRecap …>` stacked vertically inside `#tab-body`. `HandRecap` keeps its own null-when-no-decisions behavior; `FeedbackPanel` keeps its `enabled`/empty behavior. |
| FR-06 | `RightPanel` `references` branch renders `<RankingsTab/>` then `<PreflopChartTab/>` stacked vertically. |
| FR-07 | The `coaching` branch is unchanged except for the styling class (FR-10). |
| FR-08 | The old `hands`, `rankings`, `preflop`, `feedback` tab branches are removed; their components are reused inside the merged branches (no component deleted). |

### 6.3 Remove duplicate Hand review

| ID | Requirement |
|----|-------------|
| FR-09 | `components/table/PokerTable.tsx` removes the `<HandRecap …>` element inside the `view.isOver` block (line ~139); the surrounding `<div>` and the `<Button>Next hand</Button>` remain. The `HandRecap` import is removed if otherwise unused. |

### 6.4 Coaching markdown styling

| ID | Requirement |
|----|-------------|
| FR-10 | `CoachingViewer` adds `className="coaching-doc"` to the rendered `<article data-testid="coaching-doc">`. |
| FR-11 | `app/globals.css` adds typography rules scoped to `.coaching-doc` for `h1,h2,h3,p,ul,li,strong` using existing tokens (`--ink`, `--ink-soft`) — visible heading hierarchy (sizes/weights), paragraph/list spacing and line-height, list indentation, bold emphasis. No global element selectors. |

### 6.5 Acting-seat glow

| ID | Requirement |
|----|-------------|
| FR-12 | `PokerTable` computes `actingSeat`: while `revealing` (`revealed < total`), `actingSeat = log[revealed]?.seat ?? null`; else `actingSeat = view.isOver ? null : view.toAct`. |
| FR-13 | Each `<Seat>` receives `isActing={actingSeat != null && s.seat === actingSeat}`. `Seat`'s `.acting-glow` application is unchanged. |
| FR-14 | The glow continues to respect `prefers-reduced-motion` (static ring, no pulse) for every seat — inherited from the existing `.acting-glow` CSS, no change needed. |

## 7. API Changes

None. No route handler, no `data/` schema, no `core/` engine change. `flow.actionLog()`, `flow.tableView()`, `flow.decisions()` are existing read APIs.

## 8. Frontend Design

- **Component hierarchy (unchanged files, edited):** `PlayShell → {PokerTable, RightPanel}`. `RightPanel → TabStrip + #tab-body{ FeedbackPanel+HandRecap | CoachingViewer | RankingsTab+PreflopChartTab }`. `PokerTable → Seat[] + Board + CenterStack + (Next hand Button)`.
- **State:** `activeTab` in `sessionStore` (in-session). `revealed` cursor local to `PokerTable`. No new state.
- **Interactions:** tab click/keyboard select; reveal cursor advances every `REVEAL_MS`; glow follows `actingSeat`.
- **Styling:** new `.coaching-doc` block in `app/globals.css`; everything else is component edits.

## 9. Edge Cases

| # | Scenario | Condition | Expected Behavior |
|---|----------|-----------|-------------------|
| E1 | No hand yet | `flow == null` | Live Feedback shows FeedbackPanel empty/disabled state; HandRecap renders null. References/Coaching as today. |
| E2 | Coaching empty | no coaching files | Existing `coaching-empty` state; `.coaching-doc` rules apply only to rendered docs — empty state unaffected. |
| E3 | Reduced motion | `prefers-reduced-motion: reduce` | Acting glow is a static ring for every acting seat (bot or hero), no pulse. |
| E4 | Stale persisted tab | `activeTab` holds an old key (`rankings`/`feedback`/`hands`/`preflop`) | Coerced to `live-feedback`; no blank panel (FR-02). |
| E5 | Fast bot sequence | several bot actions in a row | Glow walks seat-to-seat at `REVEAL_MS` (~380ms each) — perceptible; no min-duration floor. |
| E6 | Hero acts first (e.g. heads-up SB) | `log[0].seat` is hero or reveal length 0 | Glow lands on hero appropriately; if `total==0`/no reveal, post-reveal branch uses `view.toAct`. |

## 10. Testing & Verification Strategy

### 10.1 Unit / component tests (Vitest, co-located)

- **`components/RightPanel.test.tsx` (UPDATE — currently breaks):**
  - Replace default-tab assertion `feedback` → `live-feedback` ("Live Feedback").
  - Replace the `rankings` click test with a `references` click; assert `aria-selected` flips.
  - Add: Live Feedback tab renders both `FeedbackPanel` content and `HandRecap` (stacked) — e.g. with a `flow` present, both the feedback region and the "Hand review" title appear.
  - Add: References tab renders both `RankingsTab` and `PreflopChartTab` markers.
  - Add: exactly three `role="tab"` buttons; no `Hands`/`Rankings`/`Preflop Chart`/`Feedback` standalone tabs.
- **`components/table/Seat.test.tsx` (NO CHANGE expected):** `isActing → .acting-glow` stays green; run to confirm no regression.
- **New `components/table/PokerTable` glow test (or a pure selector unit test):** assert the `actingSeat` selection — during reveal returns `log[revealed].seat` (a bot seat); after reveal returns `view.toAct`; when over returns null. If a pure function is easier to test, extract `selectActingSeat(revealing, log, revealed, view)` and unit-test it.
- **`components/CoachingViewer.test.tsx` (EXTEND):** existing heading/bullet/empty/refresh tests stay green; add an assertion that the rendered doc `<article>` carries `class="coaching-doc"`.
- **HandRecap dual-render guard:** a test (or `app/page.noscroll.test.tsx` extension) asserting that after hand-over the left/table column does not render the "Hand review" title (it now lives only in the tab). At minimum, a grep-level check that `PokerTable.tsx` no longer imports/renders `HandRecap`.

### 10.2 Verification commands

```sh
npm run typecheck   # tsc --noEmit — catches TabKey union fallout across components
npm run lint        # ESLint
npm test            # vitest run — all suites green, incl. updated RightPanel + new glow test
npm run build       # next build — production build clean
```

### 10.3 Manual spot checks

- Deal a hand vs. bots; confirm the gold glow visibly walks bot seats during the reveal, then sits on the hero.
- Open Coaching with a generated doc; confirm headings/lists/bold are clearly styled and match the interface.
- Confirm the three tabs and that no Hand review appears below the table mid- or post-hand (only "Next hand").

## 11. Rollout

No flags, no migration, no deploy-time risk. Ships on merge via the normal build. Fully reversible (UI-only diff).
