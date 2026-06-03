---
task_number: 3
task_name: "Style the Coaching markdown"
plan_path: "docs/pmos/features/2026-06-03_ux-ui-cleanup/03_plan.md"
branch: "feat/ux-ui-cleanup"
worktree_path: "/Users/maneeshdhabria/Desktop/Projects/personal/poker-coach-ux-ui-cleanup"
status: done
started_at: 2026-06-03T19:53:00Z
completed_at: 2026-06-03T19:55:00Z
commit: 9b1c866
files_touched:
  - components/CoachingViewer.tsx
  - app/globals.css
  - components/CoachingViewer.test.tsx
---

## T3 — Style the Coaching markdown

**Spec refs:** FR-10, FR-11, E2. Wave 2 (parallel with T2, disjoint files). new-feature TDD.

### Changes
- `CoachingViewer.tsx`: added `className="coaching-doc"` to the rendered `<article>` (kept `data-testid` + inline `marginTop`).
- `app/globals.css`: appended a `.coaching-doc` typography block — every selector prefixed `.coaching-doc` (no global element selectors, FR-11/D5). Uses existing tokens `--ink`, `--ink-soft`, `--gold` (confirmed present in `:root`).
- `CoachingViewer.test.tsx`: new test seeds a doc via the file's own `mockCoaching`/`vi.stubGlobal("fetch", …)` helper, asserts `article.classList.contains("coaching-doc")`.

### Verification
- `npm test -- CoachingViewer.test.tsx`: new test fail→pass; existing heading/empty/refresh tests green (4 total).
- typecheck exit 0; lint clean.
- Combined-tree full suite: 252/252 (controller-verified twice, stable — no isolation flake).

### Controller review
- Diff inspected: class wiring + scoped CSS only. No global selector bleed. Approved. Committed 9b1c866.
