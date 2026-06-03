---
task_number: 1
task_name: "Merge five tabs into three (tracer bullet)"
plan_path: "docs/pmos/features/2026-06-03_ux-ui-cleanup/03_plan.md"
branch: "feat/ux-ui-cleanup"
worktree_path: "/Users/maneeshdhabria/Desktop/Projects/personal/poker-coach-ux-ui-cleanup"
status: done
started_at: 2026-06-03T19:50:00Z
completed_at: 2026-06-03T19:52:00Z
commit: a70751f
files_touched:
  - store/sessionStore.ts
  - components/TabStrip.tsx
  - components/RightPanel.tsx
  - components/RightPanel.test.tsx
---

## T1 — Merge five tabs into three

**Spec refs:** FR-01..FR-08. Subagent-driven (implementer + controller commit).

### Decisions / deviations
- `TabKey = "live-feedback" | "coaching" | "references"`; default `live-feedback`; coercing `setActiveTab` via `TAB_KEYS.includes(...)` fallback to `live-feedback` (FR-02/D7).
- RightPanel: `live-feedback` branch stacks `<FeedbackPanel>` + `<HandRecap>` (HandRecap null when no flow); `references` branch stacks `<RankingsTab>` + `<PreflopChartTab>`.
- Removed the `Placeholder` helper (only the old `hands` branch referenced it). Prop sources reused verbatim from the existing branches — no invented shapes.
- `gameStore.ts` / `store.test.ts` untouched (their `feedback` is the analysis object, not the tab key).

### Verification evidence
- `npm test -- components/RightPanel.test.tsx`: FAIL (4 failed) before → PASS (4 passed) after.
- `npm run typecheck`: exit 0 (no TabKey stragglers).
- `npm test` full suite: 43 files / 248 tests passing (was 246; +2 net from rewritten RightPanel test).
- `npm run lint`: no issues.

### Controller review
- Diff inspected against plan T1 Steps 3–5 — exact match. Spec FR-01..08 satisfied. Committed a70751f.
