# Spec + Plan — Reviewer iteration-15 polish

Tier 1. Combined design + task breakdown for a small polish round: two MINOR copy clarifications
(#1, #2) and one NIT responsive-CSS fix (#3), plus a documented-as-accepted tradeoff (#4). No
`core/*` change, no verdict/equity/EV change, no `HandRecord` schemaVersion change. Copy/CSS only.

## Design decisions

### FR-1 Bridging clause on the chart equity caveat (#1) — MINOR
- Fix (`components/PreflopChartTab.tsx`): the detail card's existing "Heads-up 'vs a random hand'
  overstates real equity…" bullet gains one additive sentence: "That's why your live win-chance
  against the players still in a hand is usually lower than this number." Both numbers (the chart's
  ~N/100 vs-random and the live multiway-vs-range %) and every existing caveat stay; no specific
  percentage is invented.
- Test (`components/PreflopChartTab.test.tsx`): the detail-card test additionally asserts the bridging
  clause renders (`/live win-chance.*is usually lower than this/i`). The pre-existing `/overstates/i`
  assertion still passes — the clause was appended to the SAME text node.

### FR-2 Coaching empty-state lead reassures it's an intentional terminal step (#2) — MINOR
- Fix (`components/CoachingViewer.tsx`): the `EmptyState` gains a lead paragraph above the existing
  run-instructions: "Narrative coaching is written by the `/poker-coach` terminal command — by design,
  it doesn't run automatically in the app. (Your instant in-app coaching is the Live Feedback panel
  after each decision.) This tab stays empty until you run the command." The existing
  `/poker-coach last|session` instructions and the Refresh hint are unchanged.
- Test (`components/CoachingViewer.test.tsx`): the empty-state test additionally asserts the lead
  ("doesn't run automatically in the app") and the Live Feedback reassurance render. The existing
  `coaching-empty` testid + `/poker-coach/i` assertions still pass.

### FR-3 Header stats stay single-line per stat (#3) — NIT
- Fix (`components/HeaderBar.tsx`): each stat span (Session P/L, Bank) gets `whiteSpace: "nowrap"` so
  its label+value never breaks mid-stat; the row wrapping them gets `flexWrap: "wrap"` + `minWidth: 0`
  so, if the two stats together can't fit a very narrow header, they drop to separate lines as WHOLE
  units rather than each wrapping internally — and never force horizontal overflow/clipping. The
  New table / New hand button group is unchanged.
- Verification: visually-reasoned across 1366×768 / 800×600 / 700×500 / 1280×520 / 600×900 — the
  `nowrap` per stat plus the existing `space-between` header and `flexWrap` guarantee no internal
  two-line wrap and no horizontal clip at any of them. (No dedicated header-width unit test added —
  `whiteSpace`/`flexWrap` are layout properties jsdom doesn't compute; the existing HeaderBar render
  tests still pass.)

### FR-4 1280×520 "You"-near-controls spacing — documented as accepted (#4) — NIT
- No code change. A min-gap/margin between the stage and the controls row would steal height from the
  scale-to-fit stage and shrink the felt further at extreme short heights (regressing legibility — the
  opposite of iter-09 #4). Nothing clips or overlaps, so this is left as an accepted scale-to-fit
  cosmetic tradeoff, consistent with the project's documented stance.

## Excluded (no code change, documented)
- Item #4 above — accepted scale-to-fit tradeoff at extreme short viewports.

## Test / verification plan
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` all green.
- Self-review: (a) the chart still shows both equity numbers with their labels, now bridged by one
  plain sentence; (b) the Coaching empty state leads with the intentional-terminal-step reassurance and
  keeps the run instructions; (c) the header keeps each stat on one line with no horizontal clip across
  the tested viewports. No `core/*`, verdict/equity/EV, or schemaVersion change; all prior tests green.
</content>
