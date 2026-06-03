---
task_number: 2
task_name: "Remove the duplicate Hand review below the table"
plan_path: "docs/pmos/features/2026-06-03_ux-ui-cleanup/03_plan.md"
branch: "feat/ux-ui-cleanup"
worktree_path: "/Users/maneeshdhabria/Desktop/Projects/personal/poker-coach-ux-ui-cleanup"
status: done
started_at: 2026-06-03T19:53:00Z
completed_at: 2026-06-03T19:55:00Z
commit: bb65f28
files_touched:
  - components/table/PokerTable.tsx
  - components/table/PokerTable.handrecap.test.tsx
---

## T2 — Remove duplicate Hand review below the table

**Spec ref:** FR-09. Wave 2 (parallel with T3, disjoint files). Source-level guard test.

### Changes
- Removed `import { HandRecap } from "@/components/HandRecap";` and the `<HandRecap … />` element inside the `view.isOver` block. Kept the wrapping `<div>` and the "Next hand" `<Button>`.
- New `PokerTable.handrecap.test.tsx`: source-level grep guard (no HandRecap import/render, Next hand retained). `__dirname` resolved fine, no `process.cwd()` swap needed.

### Verification
- `npm test -- PokerTable.handrecap.test.tsx`: 2 fail→3 pass.
- typecheck exit 0; lint clean (no unused-import error).
- Combined-tree full suite (controller re-ran after both Wave-2 tasks): 252/252, twice — the failure the implementer saw was a parallel-run artifact (T3's test landing mid-run), not a real flake.

### Controller review
- Diff inspected: exactly 2 deletions, nothing else touched. Approved. Committed bb65f28.
