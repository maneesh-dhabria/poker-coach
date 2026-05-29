# Poker Coach — Design (v1)

**Date:** 2026-05-29
**Status:** Approved for spec review
**Author:** Maneesh + Claude Code

## 1. Purpose

A **local** web app to get better at **6-max No-Limit Texas Hold'em cash** by *playing* against
computer opponents and receiving reasoning on what was done right/wrong and where recurring
mistakes ("leaks") are happening.

Two coaching surfaces, by design:

1. **Instant deterministic feedback** inside the web app (pure math + heuristics, no LLM).
2. **Narrative coaching** delivered through the **Claude Code terminal** via a `/poker-coach`
   skill that reads saved hand histories. Coaching is **end-of-hand or batch** (a group of
   hands / a whole session) — not live mid-hand. This is intentional: the terminal becomes the
   place where the deep "why" and leak-spotting happens.

No Anthropic SDK and no API key are integrated into the app. Claude Code **is** the coach; the
app and Claude Code communicate **through the filesystem**.

### Guiding principle: built for a non-mathematician

The user is comfortable with poker but not a "maths whiz." Every number must be rendered as a
**plain-language, visual explanation**, never a raw stat dump. This applies to BOTH the in-app
deterministic feedback and the `/poker-coach` skill output.

Examples of the required style:
- Equity → a labeled bar + sentence: *"You'll win this hand about **38%** of the time."*
- Pot odds → *"It costs you **$20** to win **$80**. You only need to win about **20%** of the
  time to make calling worth it. You'll win **~38%** — that's an easy call."*
- Verdict → a single badge: ✅ **Good** / 🟡 **Thin / Marginal** / ❌ **Mistake**, plus one
  short reason sentence.
- Jargon is always followed by a plain gloss on first use in a session.

## 2. Scope

### In scope (v1)
- Playable 6-max NLHE cash table vs. bots, in the browser.
- **Dynamic opponent count:** you + **1 to 5 bots** (2–6 players total; cap is a single
  constant, trivially raisable).
- **Tunable opponents** on two independent axes:
  - **Style:** TAG (tight-aggressive), LAG (loose-aggressive), Nit (tight-passive),
    Calling Station (loose-passive).
  - **Sophistication:** how well the bot executes (e.g. Beginner / Intermediate / Advanced —
    affects range discipline, bet sizing sanity, bluff frequency, and how exploitable it is).
  - Set per-seat, with quick presets to fill a whole table.
- **Instant deterministic feedback**, itself **toggleable on/off** via a setting.
- **Coaching tier toggle** (affects depth/precision of feedback in both surfaces):
  - **Conceptual** — plain-language range/position/sizing reasoning.
  - **Equity + Heuristics** — adds computed equity / pot odds / EV and deterministic leak flags.
  - **GTO solver-grade** — preflop uses real published charts (precise deviation flagging);
    postflop uses heuristics in v1 (honestly labeled).
- **Hand-history persistence** as structured JSON, one file per hand, saved locally.
- **`/poker-coach` Claude Code skill** that reads hand histories and produces:
  - per-decision narrative critique for a hand or batch of hands, and
  - a basic **leak summary** across the reviewed hands.
- **Preflop GTO charts** integrated in v1 (straightforward + genuinely GTO).

### Out of scope (later phases)
- **Phase 2:** saved hand-replay UI, multi-session progress tracking / trend analytics.
- **Phase 3:** precomputed postflop GTO solution library (offline TexasSolver/`postflop-solver`
  runs; AGPL kept strictly offline, never shipped in the hosted app). Upgrades the GTO tier's
  postflop feedback from heuristics to real solver references.
- Tournaments/ICM, other formats, other variants.
- Any cloud hosting / multi-user / accounts (app is local-only).

## 3. Architecture

All TypeScript, except the coaching skill (a Claude Code skill = markdown + prompt logic).
Local-only: a Next.js app on the user's machine; Claude Code reads/writes the same repo's
`data/` folder.

### Components

1. **Game core** — wraps `poker-ts` (MIT): seats, blinds, betting rounds, legal actions, side
   pots, 6-max flow, showdown. Authoritative game-state machine.
2. **Hand evaluation & equity** — `poker-evaluator-ts` (fast 7-card eval) + a Monte-Carlo
   equity helper (hand vs. estimated range, configurable iterations).
3. **Bot engine** — persona = `{style, sophistication}` → a parameter bundle over preflop range
   selection + postflop heuristics (c-bet %, fold-to-aggression, bluff %, sizing). Preflop
   driven by hand-authored 6-max range JSON; sophistication scales discipline + adds/removes
   mistakes.
4. **Analysis engine (deterministic, pure functions)** — for each *user* decision computes:
   equity vs. estimated opponent range, pot odds, EV(fold/call/raise), preflop-chart action +
   deviation, postflop heuristic assessment → emits `{verdict, severity, concept_tags[],
   plain_explanation, numbers}`. Powers instant feedback AND is the **ground truth** the coach
   explains. The engine always states the **assumed opponent range** it used, so reasoning is
   transparent and honest.
5. **Hand-history store** — writes `data/hands/hand-<id>.json`: full action history, board,
   stacks, positions, every user decision with its deterministic analysis, and the outcome.
   Append-only.
6. **Coaching skill** (`/poker-coach`) — Claude Code skill. Reads `data/hands/*.json` (filtered
   to a hand, a count, or a session) + the active coaching tier; produces plain-language
   per-decision critique + a leak summary; writes markdown to `data/coaching/<id>.md`.
7. **Web UI** (Next.js + React) — visual 6-max table, action controls, an instant-feedback
   panel, settings (deterministic-feedback on/off, coaching tier, opponent count, per-seat
   style/sophistication), and a coaching-report viewer that renders the skill's markdown.

### Data flow & the filesystem contract (the crux)

```
You play a hand in the browser
  → Game core advances state; on each of YOUR decisions:
      Analysis engine computes deterministic analysis
      → if feedback toggle ON: instant plain-language feedback shown inline
  → On hand end: hand + all analysis saved to data/hands/hand-<id>.json

You open the Claude Code terminal and run:  /poker-coach [last | last N | session]
  → skill reads data/hands/*.json (+ current coaching tier)
  → writes plain-language coaching to data/coaching/<id>.md
  → (optionally) the app's report viewer renders that markdown
```

The **hand-history JSON schema is the contract** between the app and the skill. It will be
defined explicitly (versioned) so each side evolves independently. Both the deterministic
analysis and the coach consume the same schema.

## 4. Key design decisions

- **Two-layer coaching.** Deterministic math/heuristics in-app for instant, cheap, always-right
  arithmetic; Claude Code skill for narrative, judgement, and leak synthesis. The proven pattern
  is "compute the math in code, let the LLM explain it" — LLMs reason well about poker concepts
  but are unreliable at arithmetic, so we never ask the model to compute equity.
- **Filesystem as the integration boundary.** No SDK/API key; the app emits artifacts, the
  skill consumes them. Clean separation, fully local.
- **Honesty over false precision.** Multiway postflop has no true solver; equity uses an
  *assumed* opponent range. Feedback always surfaces these assumptions rather than implying
  certainty. GTO claims are made only where they're real (preflop in v1).
- **Plain-language rendering is a hard requirement, not a nicety** (see §1 principle).
- **YAGNI.** No accounts, no cloud, no replay UI, no postflop solver in v1.

## 5. Testing strategy

- **Analysis engine**: TDD with known inputs → expected outputs (equity within tolerance, pot
  odds, EV ordering, preflop-chart lookups, side-pot math, leak tagging). Pure functions = easy.
- **Bot engine**: assert range adherence per style/sophistication; assert legal actions only.
- **Game core**: integration tests over full hands incl. all-ins and side pots.
- **Coaching skill**: validated against fixture hand histories — checks it reads the schema,
  respects the tier, and produces the expected structure (verdicts + leak summary) in plain
  language.

## 6. Risks & open questions

- **Opponent-range estimation** drives equity/EV and is inherently an assumption. Mitigation:
  make it explicit in every explanation; keep it conservative and tied to the bot's own range
  where known.
- **Multiway postflop** = heuristics only in v1. Mitigation: honest labeling; Phase 3 solver.
- **Preflop chart sourcing**: transcribe from published 6-max charts into our own JSON (check
  each source's terms before embedding; prefer charts explicitly free to use).
- **Opponent-count interpretation**: speced as 1–5 bots (true 6-max). Raise the cap constant if
  up to 6 bots (7-handed) is actually wanted.
- **Local-only** confirmed acceptable; Claude Code must run with repo access to read `data/`.

## 7. Recommended tech stack

- **App:** Next.js + React + TypeScript (local dev server).
- **Game state:** `poker-ts` (MIT).
- **Eval/equity:** `poker-evaluator-ts` + custom Monte-Carlo helper.
- **Data:** plain JSON files under `data/hands/` and `data/coaching/`.
- **Coaching:** a Claude Code skill (`/poker-coach`) — no SDK, no API key.
- **Phase 3 (offline only):** TexasSolver / `postflop-solver` to generate a postflop reference
  library; outputs treated as data, AGPL solver code kept off the shipped app.
