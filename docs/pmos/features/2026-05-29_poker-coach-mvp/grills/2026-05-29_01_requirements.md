# Grill Report — 01_requirements (poker-coach-mvp)

**Depth:** standard  •  **Questions asked:** 4  •  **Date:** 2026-05-29

## Resolved

- **Opponent-range basis for equity/EV & verdicts** → Judge decisions against a **typical
  population range** (what a normal opponent would hold in the spot), NOT the bots' known coded
  ranges. Teaches transferable poker; equity is an honest estimate, labeled as such; bot hole
  cards are never peeked at to generate feedback.
- **App↔coach "which hands" model** → **Sessions + processed marker.** The app groups hands into a
  session (started when play begins); the coach records which hands/sessions it has already
  reviewed (keyed by hand id in `data/coaching/`), so "coach my latest" = unreviewed hands. No
  manual counting; no re-coaching.
- **In-browser equity performance** → **Web Worker + lean Monte Carlo** (≈1–2k samples, enough for
  feedback-grade equity), run off the UI thread. Bots use cheap heuristics for most decisions;
  full equity only where it matters. Prevents table stutter in multiway spots.
- **Preflop chart sourcing (Strict tier)** → **Generate our own solver-informed baseline** 6-max
  charts as our own JSON (open/3-bet/defend by position). Avoids third-party data redistribution;
  framed honestly as "our baseline," good enough to teach correct preflop tendencies.

## Open / Deferred

- None blocking. Lower-leverage branches not walked (standard depth, solo project): exact
  hand-history schema versioning policy, coach output verbosity controls, undo/misclick handling.
  These are fine to settle in `/spec`.

## Gaps surfaced (fold into /spec)

- **Equity honesty labeling**: spec should require feedback to state the assumed range and mark
  equity as an estimate, especially multiway/postflop (no GTO claim).
- **Session lifecycle**: spec must define when a session starts/ends and the processed-marker
  format so the app and the `/poker-coach` skill agree.
- **Equity budget**: spec should pin the Monte Carlo iteration count and the Worker message
  protocol so performance is designed in, not discovered.
- **Chart provenance**: spec should note the baseline charts are self-generated and how they map
  to positions/actions for deviation flagging.

## Recommended next step

- Carry these four resolutions + the four gaps into `/spec` (architecture + data contracts).
  Proceed to wireframes, then spec.
