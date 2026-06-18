# Requirements — Reviewer iteration-15 polish

**Tier:** 1 (small cosmetic/clarity polish — two MINOR copy items, two NIT responsive-CSS items)
**Source:** `docs/playtest/reviews/iter-15.md` — an independent, context-free first-time-user playtest
of the latest build. The reviewer found **ZERO** major or flow issues: coaching agreed with itself
and with the reference chart in every spot, depths behaved as named, the $/BB toggle converted the
whole UI, and the app correctly refused to praise a winning-but-bad play. Only four small polish items
remained. Every fix here is copy- or CSS-only; none touches coaching/analysis logic, verdict/equity/EV
computation, or the `HandRecord` schemaVersion. The large `## POSITIVES` list must not regress.

## Problem

- **#1 (MINOR)** The same hand shows two honestly-labeled equity numbers in two places with different
  baselines — the References preflop chart says e.g. "T8 wins ~53 out of 100 vs a random hand" while
  live coaching says "~36% to win against the 2 opponents still in." Not a contradiction (each is
  labeled, and the chart already caveats that heads-up-vs-random overstates real equity), but a
  first-timer skimming could be briefly confused why "53" became "36."
- **#2 (MINOR)** The Coaching tab's empty state shows "No coaching yet" and instructs running
  `/poker-coach` in the terminal. This is CORRECT and BY DESIGN (narrative coaching is the Claude Code
  skill reading/writing local files — there is no in-app coaching API), but a brand-new user who hasn't
  read the docs might briefly expect in-app coaching to auto-appear; the only hint it's a separate
  terminal step is the tab's body text.
- **#3 (NIT)** At a 600px-wide viewport the header stats "SESSION ▲ 106.5 BB" and "BANK 1607.5 BB" each
  wrap to two lines. Readable, no overlap — just awkward.
- **#4 (NIT)** At 1280×520 (very short) the table is vertically tight and the "You" seat sits close to
  the "Next hand" button. Nothing clips or overlaps; purely cramped.

## Findings → requirements

| # | Sev | Finding (from review) | Requirement |
|---|-----|------------------------|-------------|
| 1 | MINOR | Two equity numbers (chart ~53 vs-random; live ~36 vs-range) confuse a skimmer. | ADDITIVE copy: extend the chart's existing "overstates" caveat with a short bridging clause so a beginner understands the live number will be lower — e.g. "…so your live win-chance against the players still in a hand is usually lower than this number." Remove neither number nor any existing caveat; invent no specific percentage. |
| 2 | MINOR | Coaching empty state doesn't make the intentional terminal workflow obvious enough up front. | Copy: add a one-line lead clarifying this is an intentional, separate terminal step and NOT a missing/broken feature, and reassure that the instant in-app Live Feedback panel is the in-app coaching. Keep the existing run instructions. Plain, concise, no alarm. |
| 3 | NIT | Header stats wrap to two lines at 600px. | CSS: keep each stat's label+value together on one line (`white-space: nowrap` per stat item); let the two stats wrap as a pair if truly no room, never causing horizontal overflow/clipping. Verify at 1366×768 / 800×600 / 700×500 / 1280×520 / 600×900. |
| 4 | NIT | "You" seat close to "Next hand" at 1280×520. | ATTEMPT a safe min-gap ONLY if it can't regress the scale-to-fit table or other viewports; otherwise document as an accepted scale-to-fit cosmetic tradeoff at extreme short heights. (See decision below.) |

## Decision on #4

No safe fix exists without regressing the scale-to-fit table. The left column is a flex column whose
STAGE (`flex: 1 1 auto`) shrinks and uniformly scales the fixed-size felt to fit; the controls row is
`flex: 0 0 auto` with a 16px top margin. Any extra min-gap/margin between the stage and the controls
steals height from the stage, forcing the felt to scale DOWN further — which directly worsens the
sub-legible-smallness the project already accepts at extreme short heights (iter-09 #4 deliberately
restored stage padding for exactly this reason). Since nothing clips or overlaps, this is left as an
**accepted scale-to-fit cosmetic tradeoff** at extreme short viewports, consistent with the project's
stance that sub-legible smallness with no clip/overlap is acceptable.

## Honesty / architecture invariants (unchanged)

- `core/*` untouched; `core/analysis/*` remains the single source of verdict/equity/kind/conceptTag.
  No verdict/equity/EV computation changes. Both equity numbers (#1) and their honest labels are kept.
- No `HandRecord` schemaVersion change — these are presentational copy/CSS edits only.
- Plain language; no-scroll + scale-to-fit preserved; all prior passing tests stay green.
</content>
</invoke>
