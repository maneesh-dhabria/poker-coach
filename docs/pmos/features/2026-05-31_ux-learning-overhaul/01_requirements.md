# Poker Coach — UX & Learning Overhaul — Requirements

**Date:** 2026-05-31
**Last updated:** 2026-05-31
**Status:** In Review
**Tier:** 3 — Feature

> One feature bundling 7 observations, to be implemented as **dependency-ordered waves** (see Solution Direction → Wave plan). Scope was shaped with the user in a scoping grill; the slice below is settled.

---

## Problem

A learner who is **explicitly not a math person** is using Poker Coach to get better at 6-max NLHE. Today the app gets in the way of learning on seven fronts:

1. **You have to scroll to see the game.** Both the setup screen and the in-hand table run taller than the viewport, so the table, the action buttons, and the feedback can't be seen at once. The learner loses the thread between *what just happened* and *what the coach said about it*.
2. **Nothing persists between hands.** Every hand resets everyone to $200. There is no sense of being up or down over a session, no stakes, and no consequence to a bust — which removes the single strongest feedback signal in poker: *did my decisions make or lose money over time?*
3. **You can't tell whose turn it is.** During the step-by-step action reveal, the seat currently to act is not emphasized, so the learner can't follow the order of play.
4. **The hand just… ends.** The engine knows who won, with what, and each player's net — but the table never shows it. The learner doesn't see who won, what they won with, or what each player lost.
5. **There's no way to look up hand rankings.** A beginner constantly needs "does a flush beat a straight?" and has to leave the app to check.
6. **The coaching cites a "baseline" the learner doesn't understand.** Feedback says a play "differs from baseline" and quotes win-probabilities, but the learner doesn't know what *baseline* is, what the percentages mean, or where they come from — so the most teachable moments land as jargon.
7. **The coaching talks like a textbook.** Lines like *"You don't have the price to continue"* are opaque ("who talks like that?"). And when the learner folds, the hand goes dark — they never see how the eventual winner played it or what was right about that line.

### Who experiences this?

A **solo learner** running the app locally to practice against tunable bots. Self-described non-math person; wants plain, visual explanations and to *feel* their progress. Single user, single machine, no multiplayer.

Two implied modes for the same person:
- **Player** — in a hand, making decisions, reacting to instant feedback.
- **Student** — between/after hands, looking things up (rankings, preflop chart) and reading coaching.

### Why now?

The app's core loop (play vs bots → instant verdict → terminal coaching) already works and the table was recently rebuilt around an oval layout with a central pot. The foundation is solid enough that the **learning experience is now the bottleneck** — the math and engine are correct, but the presentation and continuity don't yet turn correct verdicts into durable learning.

---

## Goals & Non-Goals

> Goals are observable user outcomes. Engineering acceptance criteria live in `/spec`.

### Goals

- **G1 — Game always in view.** On a desktop viewport the learner can see the table, the action controls, and the active side-tab without scrolling during normal play — measured by: at **viewport ≥1280×800 (width AND height)**, **both** the setup screen and the in-hand table show **zero vertical page scroll**; the left column (table + action bar) and tab strip stay pinned, and **only the active tab's body scrolls internally** when its content overflows (D17 seam). Below 1280×800, graceful scroll is acceptable (Non-Goal).
- **G2 — Continuity of money.** The learner experiences a running bankroll across hands and can see whether they're up or down for the session — measured by: hero (and bot) stacks carry hand-to-hand; a session P/L figure is visible; a bust triggers a rebuy from a bank; "New table" resets everyone to a chosen starting stack.
- **G3 — Per-hand money is legible.** After each hand the learner can see what they (and each player) won or lost that hand — measured by: every seat shows its net for the just-finished hand at showdown/hand-end.
- **G4 — Follow the action.** The learner can always tell whose turn it is — measured by: the seat currently to act carries a distinct "thinking" emphasis, synced to the action reveal.
- **G5 — See who won and why.** At hand end the winner(s), the winning hand category, and each player's net are marked on the table — measured by: a learner who folded can still read who won, with what hand, for how much.
- **G6 — Rankings on hand.** The learner can look up the Texas Hold'em hand-ranking order inside the app — measured by: a Hand Rankings tab lists High Card → Straight Flush with a plain example of each.
- **G7 — Understand "baseline" and equity.** The learner can answer, in their own words, "what is the baseline chart?" and "what does my win-% mean?" after using the Preflop Chart tab — measured by: the tab shows the position's range grid (play/fold), and clicking any hand explains its equity and *why* it's a play or fold in plain language, with **no math wall** and **no runtime LLM call**.
- **G8 — Coaching a human would say.** Instant feedback and terminal coaching read as plain language, defining any term inline — measured by: no verdict leads with unexplained jargon (e.g. "price to continue"); and when the learner folds, the coaching narrates the eventual winner's line and what was right about it.

### Non-Goals (explicit scope cuts)

- **NOT multi-table.** One persistent table with one bank — because multi-table switching is a large, separable surface and the learning value lands with a single continuous table first. (Roadmapped, not now.)
- **NOT mobile / small-screen no-scroll.** First-fold is guaranteed **desktop-first** only — because chasing every viewport multiplies layout work and the user practices on desktop. Smaller screens may still scroll.
- **NOT a runtime LLM/solver.** The preflop teach and all analysis stay **deterministic and precomputed** — because the product contract is "no API key, no SDK" and a non-math learner needs instant, reproducible answers, not a live model.
- **NOT real-money / accounts / leaderboards / server sync.** The bankroll is a **local** practice device persisted to local `data/` only — because there is one local user and no server. (Persistence to disk *is* in scope — see D10; networked accounts are not.)
- **NOT win-rate analytics (BB/100, graphs).** Showdown-vs-non-showdown winnings charts and BB/100 win-rate are the genre standard but are **out of scope** here — because the first job is continuity + legibility, not long-run analytics. (Roadmapped.)
- **NOT a rewrite of the decision engine.** Verdicts remain sourced from the existing `core/analysis` (the single source of truth); we change *wording* and *what we surface*, not the math — because the math is already correct.
- **NOT new bot strategy/AI.** Bot skill/style tuning is unchanged.

---

## User Experience Analysis

### Motivation

- **Job to be done:** "Help me get visibly better at poker without making me do math — let me play, understand what I did right or wrong in plain words, and look things up when I'm unsure."
- **Importance / urgency:** This is a self-improvement loop; the learner returns only if they *feel* progress. Continuity (bankroll) and legibility (who won, why) are what make practice feel like it counts.
- **Alternatives:** GTO Wizard / Upswing charts (powerful but math-heavy, intimidating), PokerTrainer.com (approachable quizzes but no live table), or just playing online (no coaching). Poker Coach's niche is **plain-language coaching on a live practice table** — the overhaul protects that niche.

### Friction Points

| Friction Point | Cause | Mitigation |
|---|---|---|
| "I can't see the game and the feedback together." | Page scrolls; feedback is a tall side column. | Desktop-first first-fold; secondary content in a tabbed side panel (G1). |
| "What does 'baseline' even mean?" | Jargon with no in-app definition. | Preflop Chart tab + plain inline definitions (G7); leads with the idea, then names the term. |
| "Who talks like 'you don't have the price'?" | Textbook verdict copy. | Rewrite copy to plain language, define terms inline (G8). |
| "Did I actually win or lose over time?" | No persistence. | Persistent bankroll + session P/L + per-hand net (G2, G3). |
| "Wait, who won? With what?" | Hand-end result never surfaced. | Winner glow + hand-category banner + per-seat net (G5). |
| "I folded so the hand is a black box." | No winner's-perspective narration. | Coaching narrates the winner's line on folds (G8). |
| "I'm scared I'll mess up the math by clicking around." | Non-math anxiety. | Everything precomputed and instant; explanations are visual, optional-depth. |

### Satisfaction Signals

- The learner can glance once and see table + controls + the verdict for their last action.
- After a hand they can say "I won $X with two pair" or "Calling Station won — they just called everything and got there."
- They can open the Preflop Chart, click `A♠K♠`, and read a sentence that makes "baseline" and "67%" click.
- Over a session they watch a number go up or down and feel it.

---

## Solution Direction

A single coherent reshape of the play screen plus continuity in the engine, delivered in waves. The shape:

```
┌───────────────────────────────────────────────┬───────────────────────┐
│  HEADER: Poker Coach · Session P/L: +$120 ▲    │  ┌─ tabs ───────────┐  │
│          Bank: $1,760 · [New table] [New hand] │  │ Feedback*│Coaching│  │
├───────────────────────────────────────────────┤  │ Hands │Rankings   │  │
│                                                │  │ Preflop Chart     │  │
│              (oval table, always visible)      │  └───────────────────┘  │
│        seats w/ stacks · acting-seat glow      │                         │
│            central pot · board                 │   active tab body       │
│        at hand end: winner glow,               │   (scrolls *inside*     │
│        "Two Pair" banner, per-seat +/-         │    the panel only)      │
│                                                │                         │
├───────────────────────────────────────────────┤                         │
│  ACTION BAR: Fold · Check · Call $X · Bet ½ …  │                         │
└───────────────────────────────────────────────┴───────────────────────┘
   left column: fixed, never scrolls            right column: tabbed
```

**Core principle:** the **left column (table + action bar) never scrolls**; only the **active tab's body** may scroll, inside the panel. Secondary content moves out of the main flow and into tabs.

### The tabs (right panel)

- **Feedback** (default during a hand) — today's instant verdict panel: badge, plain sentence, equity bar, "show the numbers" (existing `FeedbackPanel`).
- **Coaching** — terminal/narrative coaching for the hand (existing `CoachingViewer`), now including winner's-perspective narration.
- **Hands** — previous hands this session (recap list).
- **Rankings** — static Texas Hold'em hand-ranking reference (new).
- **Preflop Chart** — interactive range grid + plain teach (new).

### Persistent bankroll model (single table)

- **Bank** = the learner's **lifetime roll**, persisted to local `data/` — survives closing/reloading the app (D10). **Stack** = chips in play at the seat.
- Each hand, stacks carry over. Winning/losing changes the stack; the bank is the reservoir, and the lifetime roll moves with results.
- **Bust → rebuy:** when the hero's stack can't post a blind, offer a rebuy from the bank to the starting stack (auto-rebuy option). **Bots auto-rebuy** so the table always stays 6-max (D11).
- **New table** resets every seat's *stack* to the chosen **starting stack** and starts a fresh session P/L; the **lifetime bank carries forward** into the new table (it is not reset by New table) (D10).
- **Display:** session P/L + lifetime bank in the header, each seat's stack below its name, and at hand-end a per-seat net (**green for positive** is the only firm cross-client convention; negatives in red). A **$ ↔ BB toggle** (click your own stack, PokerStars convention) reframes stacks/bets/pot in big blinds (D12).

### Preflop chart teach (deterministic, no LLM)

- Show the **13×13, 169-hand grid** for the relevant position (pairs on the diagonal, suited upper-right, offsuit lower-left) — the universal convention; the grid's *shape* (premiums top-left → trash bottom-right) is itself a teaching aid.
- **Solid single-action colors** (raise / call / fold), **not** mixed-frequency split cells — split-cell "raise 62%" views are the #1 thing that intimidates non-math learners (research). Frequencies, if ever shown, hide behind a toggle.
- **Gray out folds** so the eye only tracks "play"; optionally call out **boundary hands** ("the weakest hand you'd still open") since pros learn the edges, not 169 cells.
- **Click any hand →** a plain card. Reusable framings from research:
  - *Equity* = "your slice of the pot — how often this hand wins. **AK wins about 67 times out of 100** against a random hand."
  - *Baseline* = "a solid default game plan — the hands a sound player opens from here. Follow it and you make money on average even with no reads; you deviate later to exploit mistakes."
  - *Position* = "later seat = fewer players left + you act last after the flop, so you can play more hands."
  - **Honesty caveat (matches the coach skill's 'restate the assumed range' rule):** label that "vs a random hand" *overstates* your edge — real opponents fold trash, so your real-world win-% is lower. State the assumption.
- *RFI ("raise first in," everyone folded to you)* and *vs-open (someone already raised)* are the two chart types; name them in plain words.
- Equity numbers come from the **existing Monte Carlo**, **precomputed/cached** (a generated table) so the view is instant and reproducible. No runtime model call.

### Plain-language coaching

- Rewrite verdict strings in `core/analysis/explain.ts` to **lead with the plain idea, then optionally name the term**: e.g. "It costs you $20 to maybe win $60 — you'd need to win about 1 in 4 times, and this hand only wins ~15%, so folding is right." instead of "You don't have the price to continue."
- **Winner's-perspective on folds:** when the hero folds, coaching narrates who won, with what, and what was sound about their line (sourced from the existing hand record + analysis — no new judgments invented; honors `gtoClaim` so only preflop spots claim a "baseline"). Use the plain hand-category label verbatim ("Two Pair, Aces & Kings").

### Wave plan (dependency-ordered)

| Wave | Delivers | Why this order |
|---|---|---|
| **W1 — Layout shell** | Tabbed side panel + desktop-first no-scroll; move Feedback/Coaching/Hands into tabs (#1) | Everything else renders *inside* this shell; do it first so later tabs have a home. |
| **W2 — Acting-player + showdown marking** | Acting-seat "thinking" glow (#3); winner glow + yellow winning cards + center-table hand-category banner + **per-hand** per-seat net at hand end (#4) | Pure presentational reads off existing `OutcomeRecord`; high value, low risk; **no schema change, no persistence** (per-hand net only — D17). |
| **W3 — Persistent bankroll** | Stacks carry over, lifetime bank (`data/bankroll.json`), rebuy, New table, starting-stack presets, **session P/L + bank header** (#2) | Heaviest: engine + store + a new `/api/bankroll` route + persisted file (its own version) — **HandRecord untouched** (D13). Adds the running totals on top of W2's per-hand display. |
| **W4 — Rankings tab** | Static hand-ranking reference (#5) | Self-contained tab; no deps beyond W1. |
| **W5 — Preflop chart teach** | Interactive grid + plain teach, precomputed equity (#6) | Self-contained tab; precompute step; no deps beyond W1. |
| **W6 — Plain-language coaching** | Reworded verdicts + winner's-perspective narration (#7) | Touches analysis copy + coach skill; independent of layout; can land last. |

Each wave is independently shippable and testable; W1 unblocks W4/W5; W2 precedes W3 for the shared P/L display.

---

## User Journeys

### Primary Journey (Happy Path) — play a hand with continuity

1. Learner opens the app → **Setup** fits the first fold; picks opponents, coaching depth, and a **starting stack**; clicks **Deal**.
2. **Play screen:** table is centered and fully visible; header shows **Session P/L $0** and **Bank**. Feedback tab is active.
3. Action reveals step by step; the **seat to act glows** ("thinking"). When it's the hero's turn, the action bar enables.
4. Hero acts → **Feedback tab** shows the plain verdict for that decision immediately.
5. Hand ends → table marks the **winner (glow)**, **highlights the 5 winning cards (yellow, the de-facto convention)**, shows a **"Two Pair, Aces & Kings"** category banner center-table near the pot, and **+$/−$ on each seat** (green positive). Header P/L + lifetime bank update; stacks updated. Any pot-slide animation is fast/skippable (slow animations are the most-disabled feature in real clients).
6. Learner reads the **Coaching tab** — narrative review (incl. winner's line if they folded).
7. **New hand** → stacks carry over; the running P/L continues.

### Alternate Journeys

- **Look up a ranking mid-session:** learner clicks **Rankings** tab → reads the order → clicks back to **Feedback**; the table never moved.
- **Learn a preflop spot:** learner opens **Preflop Chart**, picks/sees their position, clicks `KJs` → reads the plain "play because…" card → returns to play.
- **Bust and rebuy:** hero's stack hits ~0 → **rebuy prompt** → top up from bank to starting stack → continue. If the bank is empty, see Edge Cases.
- **New table:** learner clicks **New table** → confirm → all seats reset to the chosen starting stack, session P/L resets.

### Error / Edge Cases

| Scenario | Condition | Expected Behavior |
|---|---|---|
| Bank empty on bust | Hero busts and lifetime bank can't fund a rebuy | Offer "New table / top up to a fresh starting bank" or end session with a clear "you're out of chips" message — not a dead table. (A practice tool should never trap the learner.) |
| Corrupt/old persisted bank | The on-disk bankroll file is missing, malformed, or pre-dates the schema | Fall back to a fresh default bank; never crash the app on a bad save file. |
| Old saved hands | A `HandRecord` from before the schema bump is read | Migrate/upgrade gracefully so the Coaching/Hands tabs still render older hands (schema is the app↔coach contract). |
| Precomputed equity missing | Preflop teach can't find a cached equity value | Fall back to computing on demand (or show "—" with a note) rather than blocking the tab. |
| Narrow viewport | Below the desktop target width | First-fold guarantee is waived; graceful scroll is acceptable (Non-Goal). |
| Hand ends by everyone folding | No showdown | Mark the winner and pot awarded; no hand-category banner (no cards shown); per-seat net still shown. |
| Split pot | Tie at showdown | Mark multiple winners; show each share in the per-seat net. |

---

## Design Decisions

| # | Decision | Options Considered | Rationale |
|---|---|---|---|
| D1 | One feature, **dependency-ordered waves** | (a) 7 separate features, (b) one big-bang feature, (c) one feature, sequenced waves | (c) — the items share the play screen and a P/L display; sequencing avoids rework while still shipping incrementally. |
| D2 | **Single-table** persistent bankroll | (a) single table, (b) multi-table with switching | (a) — multi-table is a large separable surface; the learning value lands with one continuous table. Multi-table roadmapped. |
| D3 | **Tabbed right panel** for secondary content | (a) tabs, (b) collapsible accordions, (c) modal overlays | (a) — tabs keep the table fixed and one thing visible at a time; matches the "first-fold, table always visible" goal. |
| D4 | **Desktop-first** no-scroll only | (a) desktop-only, (b) fully responsive | (a) — the user practices on desktop; full responsiveness multiplies layout cost for no current benefit (Non-Goal). |
| D5 | Preflop teach uses **precomputed/cached equity** | (a) precompute table, (b) compute live per click, (c) live LLM | (a) — instant, reproducible, honors the no-runtime-model contract; (b) is the fallback when a value is missing. |
| D6 | **Solid play/fold colors**, not mixed-strategy cells | (a) solid 3-color, (b) heat-map with split cells + frequencies | (a) — split-cell frequency views intimidate non-math learners; lead with one action, hide depth behind a click. |
| D7 | Coaching copy **leads with the plain idea, then the term** | (a) plain-first define-inline, (b) keep jargon + glossary, (c) dual "plain / technical" toggle | (a) — directly addresses "who talks like that"; a toggle is more build for a single non-math user. |
| D8 | Winner's-perspective narration **reuses existing analysis/records** | (a) reuse hand record + analysis, (b) generate new judgments | (a) — analysis stays the single source of truth; no new (possibly wrong) claims; stays deterministic. |
| D9 | **Configurable starting stack** at New table / setup | (a) configurable, (b) fixed $200 | (a) — lets the learner choose stakes feel; cheap to expose; default stays 100bb. |
| D10 | **Lifetime bank persisted to disk**; New table carries the bank forward | (a) in-session only, (b) persist session, fresh on New table, (c) lifetime roll to disk | (c, user pick) — makes the money feel real and protects progress from an accidental reload; written to local `data/` only (no server). New table resets *stacks* + session P/L but not the lifetime bank. |
| D11 | **Bots auto-rebuy** to keep the table 6-max | (a) auto-rebuy, (b) bots can bust out | (a, user pick) — keeps practice density high; bot bust-out changes table dynamics mid-session and adds seat-management work. |
| D12 | **$ with a BB toggle** | (a) $ only, (b) $ with BB toggle | (b, user pick) — defaults to $ for approachability; the toggle teaches the pro stack-depth mental model when ready (PokerStars click-stack convention). |
| D13 | **Persistent bankroll = separate `data/bankroll.json`; HandRecord untouched** | (a) separate file, (b) bump HandRecord to v3 + migrate, (c) both | (a, /grill) — money continuity is a distinct concern from the per-hand log. HandRecord stays **v1** (`HANDRECORD_SCHEMA_VERSION=1`; per-player results already in `OutcomeRecord.winners[]`/`heroNet`). New file gets its own version via the existing atomic-FS `lib/dataStore` + a new `/api/bankroll` route — **no risky migration of the app↔coach contract**. |
| D14 | **Preflop chart defaults to hero's current position, with a selector** | (a) default+selector, (b) free browser only, (c) locked to current | (a, /grill) — in-context teach ("why was MY hand a fold here") plus the freedom to study other spots. |
| D15 | **Starting stack = presets (50/100/200 BB), default 100** | (a) presets, (b) free-form, (c) fixed 100 | (a, /grill) — beginner-friendly and bounds the input; free-form roadmapped. |
| D16 | **Hand-category banner center-table; winner seat glows + yellow winning cards** | (a) center-table, (b) at winner's seat | (a, /grill) — one clear focal point by the CenterStack; avoids competing with the per-seat net chip and handles split pots cleanly. |
| D17 | **W2 shows per-hand net only; session P/L + lifetime bank header land in W3** | (a) split, (b) merge W2+W3, (c) all money in W3 | (a, /grill) — per-hand net is derivable from `OutcomeRecord` with no persistence, so W2 ships the easy visual win alone; running totals arrive with the bankroll in W3. Keeps both waves independently shippable. |
| D18 | **BB toggle = one shared money formatter + a display-unit store flag; render-only** | (a) shared formatter, (b) defer to a W7, (c) feedback stays $ | (a, /grill) — engine/analysis stay in $ (cents) internally; **BB is presentation only**, so the blast radius is one util + one store field threaded through money displays (incl. the feedback sentences). |

---

## Success Metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Vertical scroll needed to play (desktop ≥1280×800) | Setup + table both scroll | Zero scroll in setup and in-hand | Manual/Playwright check at target viewport |
| Hand-end result legibility | Winner/net not shown | Winner, hand category, and every seat's net shown each hand | Visual check across showdown / fold-out / split-pot |
| Continuity of money | Resets to $200 each hand | Stacks + session P/L persist across hands; bust→rebuy works | Play ≥5 hands; verify carry-over and a rebuy |
| "Baseline/equity" comprehension | Jargon only | Learner can restate both in plain words after using the tab | Self-report; tab contains plain definitions + per-hand "why" |
| Jargon in verdicts | e.g. "price to continue" | No verdict leads with unexplained jargon | Review of `explain.ts` strings; instant-feedback spot checks |
| Existing tests | Green | Stay green; new behavior covered | `npm test` + new unit/integration tests |

---

## Research Sources

| Source | Type | Key Takeaway |
|---|---|---|
| `app/page.tsx` | Existing code | 2-col grid (1fr / 420px); setup vs play phases — the shell to reshape (W1). |
| `components/table/PokerTable.tsx`, `Seat.tsx`, `CenterStack.tsx` | Existing code | Oval seating + step action reveal + central pot; acting-seat glow + per-seat net hook in here (W2). |
| `core/engine/gameEngine.ts` (`result()`), `sidepots.ts` | Existing code | Winners, side pots, per-player net already computed — surface, don't recompute (W2/W5). |
| `core/eval/handEval.ts` (`HandCategory`) | Existing code | Category enum (HighCard→StraightFlush) → source for Rankings tab (W4) + winner banner. |
| `store/gameStore.ts`, `core/handFlow.ts` | Existing code | Per-hand state + `buildSeats()` ($200 fresh each hand) — where persistence lands (W3). |
| `core/history/handRecord.ts` (`schemaVersion`) | Existing code | App↔coach contract; bump + migrate for bankroll fields (W3). |
| `core/charts/preflop*.ts/json`, `core/equity/equity.ts` | Existing code | 169-grid data + Monte Carlo → precomputed teach (W5). |
| `core/analysis/explain.ts`, `.claude/skills/poker-coach/SKILL.md` | Existing code | Verdict strings + coach skill — reword + winner's-perspective (W6); honor `gtoClaim`. |
| GTO Wizard, Upswing preflop charts | External | 13×13 grid is universal; solid colors + click-to-explain = approachable; split-cell frequencies intimidate beginners. |
| PokerTrainer.com | External | One-decision-at-a-time framing is what makes preflop learning approachable. |
| Upswing "What is Equity" | External | Plain framing: "equity = your % chance of winning the pot right now." |
| PokerStars / GGPoker clients | External | Stack-below-seat, BB/$ toggle, green "+$X" pop animated pot→winner, session PnL ticker, rebuy modal. |
| PokerStars Hand Replayer / Hand2Note | External | Trainers show *every* player's net (not just winner); highlight the 5 winning cards + hand-category banner. |

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | On **New table**, does the **bank** persist or reset? | **Resolved (D10):** lifetime bank persists to disk and carries forward; New table resets stacks + session P/L only. |
| 2 | **Bots' bankroll / bust-out?** | **Resolved (D11):** bots auto-rebuy; table stays 6-max. |
| 3 | **Stack/PL display unit ($ vs BB)?** | **Resolved (D12):** $ default with a BB toggle. |
| 4 | **Persistence across app restarts?** | **Resolved (D10):** yes — lifetime bank written to local `data/`. |
| 5 | **Preflop chart position source:** hero's current position, any position, or both? | **Resolved (/grill → D14):** defaults to the hero's current position for the live hand, with a selector to browse any position. |
| 6 | **Hand-category banner placement:** center-table vs near the winner's seat. | **Resolved (/grill → D16):** center-table near the pot (consistent with CenterStack); winner seat also glows + winning cards highlight yellow. |
| 7 | **Starting-stack options:** free-form amount, or preset stakes? | **Resolved (/grill → D15):** presets (50 / 100 / 200 BB), default 100bb; free-form entry roadmapped. |

---

## Review Log

| Loop | Findings | Changes Made |
|------|----------|-------------|
| 1 | Scoping-grill resolved the slice (all 7, waved) + OQ#1–4 via structured asks. | Locked scope; resolved OQ1–4 → D10 (lifetime bank to disk), D11 (bots auto-rebuy), D12 ($+BB toggle); added Non-Goals (no server sync, no BB/100 analytics) + corrupt-save edge case; folded research framings (equity "slice/67-of-100", baseline, position, vs-random caveat, RFI/vs-open, yellow winning cards, green-positive, fast animations, boundary hands). User confirmed "Lock it — proceed to grill". |
| 2 (/grill) | 8 questions, all resolved; no open gaps. Code-checked: HandRecord is **v1** (not v2 as I'd assumed) with results in `OutcomeRecord`. | Resolved OQ5/6/7 + persistence + layout contract → **D13** (separate `data/bankroll.json`, HandRecord untouched — no migration), **D14** (chart defaults to hero position + selector), **D15** (starting-stack presets), **D16** (center-table banner + winner glow + yellow cards), **D17** (W2 per-hand net only / session+bank in W3 — wave seam), **D18** (BB toggle = one shared formatter + store flag, render-only); pinned G1 no-scroll to **≥1280×800, both screens, only tab body scrolls**. |

## Wireframes

Generated: 2026-05-31
Folder: `docs/pmos/features/2026-05-31_ux-learning-overhaul/wireframes/`
Index: `wireframes/index.html`
Device: desktop-web only (desktop-first, single-user local app)
Rigor: low (single-user personal tool, mid-pipeline) — inline rubric spot-check + one cross-file reviewer pass; MSF/PSYCH (Phase 6) skipped by user. Verified in-browser: setup + play frames hold zero-overflow at 1280×800.

| # | Component | Devices | States | File |
|---|-----------|---------|--------|------|
| 01 | Setup screen (no-scroll, starting-stack presets, lifetime bank) | desktop-web | Default, Annotated | `01_setup_desktop-web.html` |
| 02 | Play screen (no-scroll shell + 5 tabs) | desktop-web | Feedback (acting glow), Showdown (winner glow + banner + per-seat nets), Rankings, Preflop Chart teach, Coaching (winner's perspective), Rebuy modal, $⇄BB toggle | `02_play-screen_desktop-web.html` |

**Carry-forward to /spec (reviewer findings):**
- **Preflop grid cells must be real, keyboard-reachable `<button>`s** (role/tabindex + aria-label like "AKs, raise"), not click-only `<div>`s. Reuse the existing `components/ui/Button` primitive where practical.
- Selectable setup chips (table presets, starting-stack) should be `<button>`s, matching the app's existing `.btn--selected` affordance.
- Ensure fold-cell label contrast on the preflop grid meets ≥4.5:1.
