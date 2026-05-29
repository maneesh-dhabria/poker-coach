# Poker Coach (v1 MVP) — Requirements

**Date:** 2026-05-29
**Last updated:** 2026-05-29
**Status:** Approved
**Tier:** 3 — Feature

## Problem

A poker player who knows the rules and is past beginner level wants to **improve at 6-max
No-Limit Texas Hold'em cash** by *playing*, not by reading books or watching tutorials. Existing
options force a trade-off: trainers that play hands rarely explain *why* a decision was wrong in
plain language, and tools that explain well (solvers) demand math fluency and study time the user
doesn't have. There is **no play-and-learn loop that gives reasoned, plain-language feedback** on
each decision and surfaces the player's recurring mistakes over time.

### Who experiences this?

A single self-directed learner ("the player") — comfortable with poker rules, not a beginner,
**not a math specialist**, time-constrained, who learns best by doing. Plays solo against the
computer on their own machine. No other users, no accounts.

### Why now?

The player wants to actively improve and has decided to build a personal tool rather than pay for
a subscription trainer or invest in study material. The enabling shift: Claude Code can act as the
coaching brain locally, so deep reasoning no longer requires an embedded paid AI service or a
math-heavy solver running live.

## Goals & Non-Goals

> Goals are observable player outcomes. Engineering acceptance criteria belong in `/spec`.

### Goals
- The player can **play full 6-max NLHE cash hands against the computer** in the browser, start to
  finish, with a configurable number of opponents — measured by: a hand can be played end-to-end
  with correct rules, blinds, betting, and side pots.
- On each of the player's own decisions, the player **immediately sees whether it was good, thin,
  or a mistake, and why — in plain language** (when feedback is enabled) — measured by: every
  player decision yields a verdict + a one-line reason a non-math person can follow.
- The player can **get deeper, narrative coaching on a hand or a batch of hands** through the
  Claude Code terminal, including *why* and *what to do instead* — measured by: running the coach
  produces per-decision critique grounded in the actual hand data.
- The player can **see their recurring leaks** across the hands reviewed — measured by: the coach
  output includes a plain-language summary of repeated mistake patterns.
- The player can **tune the opponents** (how they play and how well) so practice covers varied,
  instructive situations — measured by: opponent style and skill are configurable per seat and
  visibly change behavior.
- The player can **choose how deep the feedback goes** (plain concepts → with the numbers → strict
  charts) — measured by: a coaching-depth setting that changes both in-app feedback and coach
  output.
- Feedback must be **understandable without math fluency** — measured by: every number is paired
  with a plain-language explanation and a visual cue, never shown raw.

### Non-Goals (explicit scope cuts)
- **NOT** real-time mid-hand LLM coaching — because the coach runs in the Claude Code terminal on
  saved hands (end-of-hand / batch), which avoids any embedded AI service and keeps play fast.
- **NOT** a postflop GTO solver in v1 — because solving live is too slow and a precomputed library
  is a large separate effort; postflop uses honest heuristics now (Phase 3 upgrade later).
- **NOT** tournaments, ICM, other table formats, or poker variants — because the player is focused
  on 6-max cash and breadth would dilute the learning loop.
- **NOT** multi-user, accounts, cloud hosting, or a saved-hand replay UI in v1 — because this is a
  single local learner; replay/progress UI is a Phase 2 want, not an MVP need.
- **NOT** embedding any paid AI SDK or API key in the app — because coaching is delivered by Claude
  Code skills reading local files; this is a hard product constraint.

## User Experience Analysis

### Motivation
- **Job to be done:** "Help me get better at 6-max cash by playing, and tell me clearly where I'm
  going wrong, without making me study."
- **Importance/Urgency:** High intent, low patience for theory. If feedback is slow, math-heavy, or
  preachy, the player disengages and the tool fails its one job.
- **Alternatives:** Commercial trainers (cost, math-heavy, generic), grinding real money (expensive
  way to learn), study material (rejected — no time).

### Friction Points

| Friction Point | Cause | Mitigation |
|---|---|---|
| "I don't understand the numbers" | Raw equity/EV/pot-odds stats | Every number gets a plain sentence + visual bar; "easy call / clear fold" verdicts |
| "Is the coach just guessing?" | Opaque AI judgement | Coach explains the assumed opponent range and reasons from the app's computed math (ground truth), stated openly |
| "The advice feels wrong for this spot" | False GTO precision multiway/postflop | Honest labeling: real GTO claimed only preflop; postflop framed as heuristics |
| "Feedback interrupts my play" | Constant inline critique | Deterministic feedback is toggleable; deep coaching is opt-in via the terminal |
| "Bots play nothing like real opponents" | Single rigid bot | Tunable style + skill per seat for varied, instructive opposition |

### Satisfaction Signals
- The player finishes a session and can name 1–2 concrete leaks to work on.
- Feedback reads like a patient coach, not a stats dump.
- The player trusts a verdict because the reasoning (and its assumptions) is visible.

## Solution Direction

A **local browser app** to play 6-max NLHE cash against tunable computer opponents, paired with a
**Claude Code coaching skill** that reads the hands the player just played. Two feedback layers:

1. **Instant in-app feedback (optional toggle).** The moment the player acts, the app shows a
   plain-language verdict and reason. Internally the app does the exact math (equity, pot odds, what
   each option is worth, preflop-chart comparison, postflop heuristics) — but the player sees
   sentences and simple visuals, e.g. *"It costs $20 to win $80 — you need to win about 20% of the
   time. You'll win ~38%. Easy call."* with a small bar.

2. **Deep coaching in the Claude Code terminal (opt-in).** After a hand, a batch, or a whole
   session, the player runs a `/poker-coach` command. The coach reads the saved hands and the app's
   computed analysis and produces a plain-language per-decision critique plus a **recurring-leak
   summary**. The coach explains and judges; it never does the arithmetic itself (the app already
   did, reliably).

The two pieces talk **only through saved files on disk** — the app writes each hand it played; the
coach reads them. No AI service lives inside the app.

**Coaching depth** is a single setting with three levels, affecting both layers:
- **Conceptual** — plain reasoning about position, ranges, and sizing; minimal numbers.
- **Equity + Heuristics** — adds the computed equity / pot odds / what-each-option-is-worth and
  flags common leaks.
- **Strict (charts)** — preflop compared against real published charts with precise deviation
  flags; postflop still heuristic in v1, labeled as such.

**Opponents** are tunable on two independent dials, set per seat with whole-table presets:
- **Style** — Tight-Aggressive, Loose-Aggressive, Nit (tight-passive), Calling Station
  (loose-passive).
- **Skill** — how well the opponent executes (e.g. Beginner / Intermediate / Advanced): better
  skill means tighter discipline, saner sizing, and fewer obvious mistakes.

**Table size** is dynamic: the player plays against **1 to 5 opponents** (2–6 players, true 6-max),
chosen before a session.

## User Journeys

### Primary Journey (Happy Path) — play a hand and learn from it
1. Player opens the app, sets table size (e.g. 5 opponents), picks opponent styles/skills (or a
   preset), sets coaching depth to "Equity + Heuristics", and ensures instant feedback is ON.
2. A hand is dealt; the player has hole cards and sees the table, positions, stacks, and pot.
3. When it's the player's turn, they choose an action (fold / check / call / bet / raise with a
   size).
4. The app immediately shows a plain-language verdict (✅ good / 🟡 thin / ❌ mistake) and a
   one-line reason with a simple visual, then play continues.
5. The hand reaches showdown or ends; the result and the player's net chips are shown.
6. The hand (every decision + the app's analysis + outcome) is saved automatically.
7. Player opens the Claude Code terminal and runs the coach over the last hand (or last N).
8. The coach returns a plain-language walk-through of each of the player's decisions plus any leaks
   it noticed; the player reads it in the terminal AND in the app's coaching viewer (the app watches
   `data/coaching/` and renders the latest report next to the hand).

### Alternate Journeys
- **Play heads-up:** player sets 1 opponent for fast, high-decision practice.
- **Quiet practice:** player turns instant feedback OFF, plays a batch of hands uninterrupted, then
  runs the coach over the whole session at the end.
- **Conceptual-only learner:** player sets depth to "Conceptual" to avoid numbers entirely and gets
  plain strategic reasoning.
- **Strict study:** player sets depth to "Strict (charts)" to see exact preflop deviations.

### Error / Edge Journeys
- **All-in and side pots:** multiple players all-in for different amounts; the app builds correct
  side pots and resolves each at showdown.
- **No hands to coach:** player runs the coach with no saved hands → coach reports there's nothing
  to review and how to play some hands first.
- **Coach run mid-pipeline / partial hand:** only completed hands are coached; an abandoned hand
  isn't analyzed.
- **Player makes an illegal action:** the app only offers legal actions, so this can't be submitted.

### Empty States & Edge Cases

| Scenario | Condition | Expected Behavior |
|---|---|---|
| First launch | No saved hands yet | App invites the player to start a hand; coach (if run) says nothing to review yet |
| Feedback off | Instant feedback toggled off | No inline verdicts during play; hands still saved for later coaching |
| Conceptual depth | Depth = Conceptual | Verdicts/coaching avoid raw numbers; use plain strategic language |
| Multiway postflop | 3+ players see a flop | Feedback uses heuristics and labels itself as such (no GTO claim) |
| Short stack / all-in preflop | Stack ≤ a few big blinds | Betting, all-in, and pot logic still correct; feedback adapts |

## Design Decisions

| # | Decision | Options Considered | Rationale |
|---|---|---|---|
| D1 | Coaching runs in Claude Code via saved files, not an embedded AI service | (a) Embedded paid AI SDK in app, (b) local model, (c) Claude Code skill reading files | (c) is a hard user constraint — no API key/SDK; keeps play fast, coaching deep, fully local |
| D2 | Two feedback layers: instant deterministic + deep narrative | (a) Only in-app math, (b) only terminal coaching, (c) both | Math must be instant and always correct; judgement/leaks need narrative — split plays to each strength |
| D3 | App computes all math; coach only explains | (a) Let coach compute equity/EV, (b) app computes, coach explains | LLMs are unreliable at arithmetic but strong at explanation; compute in code, narrate with the model |
| D4 | Coaching depth as one 3-level setting | (a) Fixed depth, (b) many toggles, (c) one Conceptual/Equity/Strict dial | One dial is simple and maps to how much math the non-math player wants to see |
| D5 | GTO is real preflop only in v1; postflop heuristic | (a) Live solve, (b) precomputed library now, (c) preflop charts + postflop heuristics | Live solving too slow; precomputed library too big for v1; preflop charts are cheap and genuinely GTO |
| D6 | Opponents tunable on style × skill, per seat | (a) One fixed bot, (b) style only, (c) style + skill per seat | Varied, instructive opposition needs both how they play and how well; per-seat enables mixed tables |
| D7 | Plain-language + visual rendering is mandatory | (a) Show raw stats, (b) plain-language everywhere | The player is not a math person; raw stats fail the core job |
| D8 | Local-only, single user, no accounts | (a) Web-hosted multi-user, (b) local-only | Single learner on their own machine; Claude Code needs local file access; simplest path to value |
| D9 | Table size dynamic, 1–5 opponents (6-max) | (a) Fixed 6-max, (b) 1–5 opponents configurable | Player wanted dynamic count; heads-up to full ring supports different practice intensities |
| D10 | Equity/verdicts judged vs a typical population range, not bots' known cards | (a) Bot's actual range, (b) typical population range, (c) both by depth | Teaches transferable poker; honest estimate; never peek at bot hole cards for feedback (grill G1) |
| D11 | App↔coach coordination via sessions + processed marker | (a) user specifies range, (b) timestamps, (c) sessions + processed marker | Robust "coach my latest" with no re-coaching and no manual counting (grill G2) |
| D12 | Equity in a Web Worker with lean Monte Carlo; bots mostly heuristic | (a) main thread, (b) Worker + lean iterations, (c) precomputed tables | Keeps the table responsive in multiway spots; feedback-grade accuracy is enough (grill G3) |
| D13 | Preflop charts are self-generated solver-informed baselines | (a) embed published charts, (b) free-to-use set, (c) generate our own | Avoids third-party data/ToS issues; honest "our baseline" framing (grill G4) |

## Success Metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Play a full hand end-to-end | none (no tool) | 100% of dealt hands resolve with correct rules incl. side pots | Manual + automated hand tests |
| Decision feedback understandable | n/a | Every player decision yields a plain-language verdict + reason (no raw-only stats) | Review of feedback output |
| Deep coaching grounded in real data | n/a | Coach critique references the actual hand's cards/board/actions and the app's computed analysis | Inspect coach output vs hand file |
| Leak summary present | n/a | Coaching a batch produces ≥1 plain-language recurring-leak observation when patterns exist | Inspect batch coaching output |
| Opponent variety | n/a | Style and skill changes produce visibly different bot behavior | Behavioral spot-checks per persona |

## Research Sources

| Source | Type | Key Takeaway |
|---|---|---|
| `poker-ts` (npm, MIT) | External lib | Mature TS engine: betting rounds, legal actions, side pots — use for game state |
| `poker-evaluator-ts` (npm) | External lib | ~22M hands/sec 7-card evaluator — fast enough for in-browser equity |
| PokerKit (uoftcprg, MIT) / eval7 (Cython) | External lib | Strong Python options if a backend is ever needed; not required for v1 |
| TexasSolver (AGPL) / postflop-solver (AGPL) | External tool | Postflop solving is ~minutes per spot and AGPL — keep offline; Phase 3 only |
| GTO Wizard docs | Industry | "Instant" GTO is precomputed lookups (10M+ trees), never live solving; no usable public API |
| Free preflop charts (Upswing, FreeBetRange, etc.) | Industry/data | Preflop GTO is small and chartable — genuine GTO feedback cheaply; check terms before embedding |
| PokerBench / "How far are LLMs from pros" (arXiv) | Research | LLMs reason well about poker concepts but are bad at the math — compute math in code, let LLM explain |
| RLCard, OpenSpiel, Pluribus ports | Research | RL bots are research-grade and heavy; rule-based + range-based personas are the pragmatic choice |

## Resolved Decisions (from review)

| # | Question | Resolution |
|---|---|---|
| 1 | Opponent skill model | **Fixed 3 levels** — Beginner / Intermediate / Advanced (see D6). |
| 2 | How coaching is triggered | **Terminal only** — the player runs `/poker-coach` themselves in Claude Code; no in-app command-helper button in v1. |
| 3 | Max table size | **1–5 opponents (true 6-max)** — cap a single constant, raisable later (see D9). |
| 4 | Render coach output in app | **Yes, in v1** — the app has a coaching viewer that watches `data/coaching/` and renders the latest report. |

## Open Questions

| # | Question |
|---|---|
| — | None outstanding. All review questions resolved above. |

---

**Review Log**

| Loop | Findings | Changes Made |
|---|---|---|
| 1 | Self-review (structural + product critique): confirmed no implementation leakage in body (libraries confined to Research Sources); journeys cover all-in/side-pots, empty states, feedback-off, conceptual depth; non-goals all carry reasons; decisions carry options + rationale. Open questions captured for the 4 genuinely-undecided points. | No content changes needed; logged open questions instead of guessing. |
| 2 | User resolved all 4 open questions: fixed 3 skill levels; terminal-only coach trigger; 1–5 opponents (true 6-max); coach output rendered in app. | Added Resolved Decisions table; updated primary journey step 8 to include in-app coaching viewer; cleared Open Questions; status → Approved. User explicitly confirmed. |
