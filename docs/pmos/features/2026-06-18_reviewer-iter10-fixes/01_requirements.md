# Requirements — Reviewer iteration-10 fixes

**Tier:** 2 (coaching-consistency + UX polish bundle — one MAJOR display-honesty bug on the
References preflop chart; the rest MINOR/NIT copy + consistency)
**Source:** `docs/playtest/reviews/iter-10.md` — an independent, context-free first-time-user playtest
of v0.14.0. The reviewer confirmed the big consistency wins now hold (no fold-vs-numbers
contradiction, no made-hand-called-bluff, no "-$0", consistent verdict↔action↔street↔result,
Conceptual no longer shows the Mental Math numeric body). The remaining findings are about a
misleading chart presentation, a Mental-Math heading/copy that doesn't match a bet-or-check spot,
a sizing critique that gets swallowed by the made-hand branch, residual dollar context at
Conceptual depth, and small wording/legibility polish.

## Problem

- The References-tab preflop chart, with Position = BB and the default (unopened/first-in) facing,
  renders the WHOLE big-blind column as "Fold" — so clicking AA shows "AA — Fold from BB" and AKs
  shows "AKs — Fold from BB." That reads as "fold pocket Aces in the big blind," wrong on a
  fundamental. Root: the chart uses raise-first-in semantics and the BB has no open-first-in range
  (with no raise to face, the BB just checks its option), so `chartAction(combo, "BB", "unopened")`
  returns "fold" for every hand.
- On a turn bet-or-check spot (hero first to act, `toCall === 0`), Mental Math's Step 6 is headed
  "THE CALL" and says "It's free to see the next card — take it," contradicting a verdict that
  correctly frames the spot as a bet.
- A deliberate tiny flop bet ($2 into $36, ~5% pot) was graded only on hand strength
  ("⚠️ Thin · made hand thin value"); the gross under-sizing drew no comment because the made-hand
  branch returns before the `bet_too_small` check.
- At Conceptual depth ("plain words, no numbers"), the live feedback context still printed dollar
  amounts ("pot was $6 when you acted", "you bet $3 · pot $6").
- "Strong hand" overstated a marginal middle-pair-no-kicker at Conceptual depth.
- The collapsed Mental Math no-draw preview hedged "you may already have the best hand" even holding
  air, where that's false.
- NITs: concept-tag chips read as crammed slugs; small seat/stack + "$"-badge legibility at tiny
  scale.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MAJOR | References preflop chart with Position = BB shows "AA — Fold from BB" / "AKs — Fold from BB" (whole BB column folds). RFI semantics: the BB has no open-first-in range. | Never present a "Fold AA/AKs from BB" grid. Add a **Facing** selector (unopened / vs a raise). When `position === "BB"` AND `facing === "unopened"`, render an explanatory panel (the BB has no opening range; with no raise to act against it checks its option and sees the flop free; switch Facing to "vs a raise" for BB defense) INSTEAD of the all-Fold grid + detail card. The chart legitimately models BB-defend-vs-a-raise (`vsOpen.BB` exists) — keep BB fully functional for that facing. Do NOT invent a BB opening range (honesty invariant). |
| 2 | MINOR | Turn Mental Math when first to act (Check/Bet, `toCall === 0`) is headed "STEP 6 · THE CALL" and says "It's free to see the next card — take it" while the verdict frames it as a bet. | Step-6 heading must not read "THE CALL" when `toCall === 0` (use "THE DECISION"). The conclusion must not tell the user to "take the free card" when the made hand is worth betting — say it's a value bet. The genuine check-back (no made hand, free card) keeps the free-card line. Stay consistent with the verdict. |
| 3 | MINOR | A grossly under-sized bet ($2 into $36) with a made hand drew no sizing comment — the made-hand branch returns before `bet_too_small`. | A grossly under-sized bet (≤ ~15% pot) is flagged for SIZE even when the hero holds a made hand. Keep the made-hand context AND add the size critique ("you have <made hand>, but this bet is far too small to get value — size up"). Order the checks so gross under-sizing surfaces regardless of made-hand status. |
| 4 | MINOR | Conceptual depth still printed dollar amounts ("pot was $6 when you acted", "you bet $3 · pot $6"). | At Conceptual depth, the feedback card contains ZERO digits/currency. Omit the numeric `$` context in the FeedbackPanel context line and the HandRecap per-decision "· pot $X" suffix at conceptual depth. Equity + Strict keep the numbers. |
| 5 | MINOR | Conceptual graded middle-pair-no-kicker as "✅ Good · Strong hand — betting for value is right." | Make the praise proportional — don't assert "Strong hand" for a marginal/medium made hand. Word it around being ahead ("You're ahead often enough here — betting for value is right"). Reserve "strong hand" for genuinely strong holdings (two pair+). Grade unchanged. |
| 6 | MINOR | Collapsed Mental Math no-draw preview hedges "you may already have the best hand" even with air. | Only say "you may already have the best hand" when a made hand is present. With no draw AND no made hand, say something honest ("No clear draw and no made hand yet — you're likely behind, so you'd be betting as a bluff or giving up"). Keep the made-hand variant. |
| 7 | NIT | Concept-tag chips read as crammed slugs ("made hand thin value", "bluff thin equity"). | Add a display-label map turning known tags into clean human labels (e.g. `made_hand_thin_value` → "Thin value", `bluff_thin_equity` → "Light semi-bluff", `bluff_no_equity` → "Bluff (no equity)", `preflop_oversize` → "Oversized", `bet_too_small` → "Bet too small"); fall back to the prettified slug for anything unmapped. Keep the "Oversized" badge special-case. |
| 8 | NIT | (a) Tiny seat/stack text at 700×500/800×600; (b) "$" glyph faint on action badges ("Call $2" reads "Call 12"). | Low-risk only: nudge legibility (slightly larger base seat/stack font and/or clearer/bolder "$" on badges) without breaking no-scroll/scale-to-fit. Document anything deferred. |

## Investigate-or-document (don't force)

- KQo-from-BB "⚠️ Thin ~45% · marginal" — the equity is honest; adjust only if a threshold is clearly
  wrong, otherwise leave + explain.
- The `layout.css` 404 — Next.js dev hot-reload noise (page is fully styled). Confirm + exclude; no
  code change.

## Honesty / architecture invariants (unchanged)

- `core/*` stays pure; `core/analysis/*` remains the single source of verdict / equity / kind /
  conceptTag / plain-math — components READ `DecisionAnalysis` and never recompute. The new chip
  label map is pure presentation in the component.
- HONESTY INVARIANT preserved: `gtoClaim`/chart claims true ONLY for spots the baseline chart
  actually models. #1 fixes a misleading PRESENTATION; it does NOT invent a BB opening range.
- No `HandRecord` schemaVersion change — changes are additive copy / display only. Demo fixtures
  still validate (additive).
- Plain language always; money via `core/money.ts`; no-scroll + scale-to-fit guarantees preserved;
  all prior passing tests stay green (any that change do so because a copy noun was legitimately
  reworded).
</content>
</invoke>
