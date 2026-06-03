---
task_number: 4
task_name: "Make the acting-seat glow follow whoever acts next"
plan_path: "docs/pmos/features/2026-06-03_ux-ui-cleanup/03_plan.md"
branch: "feat/ux-ui-cleanup"
worktree_path: "/Users/maneeshdhabria/Desktop/Projects/personal/poker-coach-ux-ui-cleanup"
status: done
started_at: 2026-06-03T19:56:00Z
completed_at: 2026-06-03T19:58:00Z
commit: 111e876
files_touched:
  - components/table/PokerTable.tsx
  - components/table/PokerTable.glow.test.tsx
---

## T4 — Acting-seat glow follows whoever acts next

**Spec refs:** FR-12, FR-13, FR-14, E3, E5, E6. Wave 3 (depends on T2 — same file, serialized). bug-fix TDD.

### Changes
- Added exported pure helper `selectActingSeat(revealing, log, revealed, view)` at module scope: while revealing → `log[revealed]?.seat ?? null`; else → `view.isOver ? null : view.toAct`.
- `const actingSeat = selectActingSeat(revealing, log, revealed, view);` just below `const revealing = revealed < total;` (all inputs in scope).
- `<Seat isActing={actingSeat != null && s.seat === actingSeat} … />` replacing the old `!revealing && !view.isOver && s.seat === view.toAct` gate that suppressed the glow during the whole reveal (the bug).
- `Seat.tsx` untouched — `.acting-glow` mapping + reduced-motion gate inherited for free (FR-13/FR-14).

### Verification
- `npm test -- PokerTable.glow.test.tsx`: 4 fail→4 pass (reveal walks bot seats; post-reveal → toAct; over → null; cursor-past-log → null).
- `npm test -- Seat.test.tsx`: 5 passing, unchanged.
- typecheck exit 0; lint clean; full suite 45 files / 256 tests passing.

### Controller review
- Diff inspected: pure helper + reveal-aware isActing only; `view` defined before use; Seat.tsx untouched. Approved. Committed 111e876.
