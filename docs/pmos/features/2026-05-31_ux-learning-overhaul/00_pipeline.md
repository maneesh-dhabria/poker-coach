# Pipeline — ux-learning-overhaul

**Mode:** interactive · **Tier:** 3 · **Branch:** `feat/ux-learning-overhaul` · **Output:** md
**Run Outcome:** in-progress · **Open Questions:** 0

## Scope (confirmed)

A single Tier-3 "UX & Learning overhaul" feature bundling 7 observations, implemented as dependency-ordered waves:

| # | Observation | Notes |
|---|---|---|
| 1 | First-fold, no-scroll layout; tab-based side panel for secondary content | Desktop-first; table always visible; tabs house Feedback / Coaching / Previous Hands / Hand Rankings / Preflop Chart |
| 2 | Persistent bankroll + bank across hands; per-hand winnings/losses on table | Single-table persistent bankroll; configurable starting stack; "new table" resets everyone |
| 3 | Visual emphasis ("think" border/glow) around the player currently to act | Distinct from existing static hero-seat highlight |
| 4 | Mark who won and what each player lost at hand end | Surface engine showdown result in the UI |
| 5 | Tab showing Texas Hold'em winning-hand ranking sequence | Static educational reference |
| 6 | Preflop chart viewer + plain explanation of "baseline" & win probabilities | Interactive, plain/visual, **no LLM calls** (deterministic) |
| 7 | Plain-language coaching incl. winner's-perspective on folds; kill jargon ("you don't have the price to continue") | Rewrite `core/analysis/explain.ts` copy + coach skill |

## Phase status

| Phase | Status | Artifact |
|---|---|---|
| 0a worktree | ✅ completed | — |
| 1 init-state | 🔄 in_progress | state.yaml |
| 1.5 ideate | ⏭️ skipped (formed seed) | — |
| 2 requirements | ⬜ pending | — |
| 2a grill | ⬜ pending | — |
| 3a creativity | ⬜ pending | — |
| 3b wireframes | ⬜ pending | — |
| 3c prototype | ⬜ pending | — |
| 4 spec | ⬜ pending | — |
| 5 plan | ⬜ pending | — |
| 6 execute | ⬜ pending | — |
| 7 verify | ⬜ pending | — |
| 8 complete-dev | ⬜ pending | — |
| 8a retro | ⬜ pending | — |
| 9 final-summary | ⬜ pending | — |
