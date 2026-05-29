# Poker Coach

A local, all-TypeScript app to improve at 6-max No-Limit Hold'em cash by **playing against tunable
bots** and getting **plain-language coaching**. Two layers of feedback:

1. **Instant, in-app** — deterministic verdict + equity + plain-math after each of your decisions
   (toggleable, depth-adjustable).
2. **Narrative, in the terminal** — the `/poker-coach` Claude Code skill reads your saved hands and
   writes a plain-language review + a recurring-leak summary. **No API key, no Anthropic SDK** — the
   coach is the Claude Code skill reading/writing local files.

## Run

```sh
npm install
npm run dev        # http://localhost:3000
```

Pick opponents (1–5, true 6-max), per-seat style × skill or a table preset, coaching depth
(Conceptual / Equity+Heuristics / Strict charts), and whether to show instant feedback. Deal, play a
hand; after each of your decisions the feedback panel shows a verdict, equity bar, and a plain
sentence. Finished hands are saved to `data/hands/<sessionId>/`.

## Coach a session (terminal)

In Claude Code, from the repo root:

```
/poker-coach last         # the most recent hand
/poker-coach last 10      # the last 10 hands
/poker-coach session      # the whole latest session
/poker-coach session <id> # a specific session
/poker-coach              # unreviewed hands of the latest session
```

It writes `data/coaching/<sessionId>/<handId>.md` + `session-summary.md`, which the app's Coaching
viewer renders (Refresh to reload).

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm test` — Vitest (unit + integration; `npm run test:watch` to watch)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint

## Architecture (and its rules — see spec §17)

- `core/*` — **pure** TypeScript: card model + evaluator, the NLHE engine + side pots, Monte Carlo
  equity, preflop charts, the decision **analysis** (the single source of every verdict/conceptTag),
  the heuristic bots + personas, the interactive `handFlow` driver, and `HandRecord` (de)serialize.
  **No React/DOM imports here.**
- `workers/equity.worker.ts` — equity runs off the UI thread (sync fallback in `equityClient`).
- `app/api/*` — Node route handlers do all filesystem IO (the browser can't); atomic writes.
- `store/*` — Zustand: `sessionStore` (settings) + `gameStore` (drives `handFlow`, equity, save).
- `components/*` — presentational React; the feedback panel reads `DecisionAnalysis` (never recomputes).
- `.claude/skills/poker-coach/` — the coaching skill; treats embedded `DecisionAnalysis` as ground
  truth, honors `gtoClaim` (true only for preflop charts), and restates the assumed range.

The data files under `data/` (JSON hand records, coaching markdown) are the contract between the app
and the coach; every record carries a `schemaVersion`. Demo fixtures live in `samples/session-demo/`.
