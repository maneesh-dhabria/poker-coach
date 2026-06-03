# Grill Report — 01_requirements.md (ux-ui-cleanup)

**Depth:** quick · **Questions asked:** 1 · **Date:** 2026-06-03

## Resolved
- **Glow root cause + fix behavior** → Bots resolve synchronously in the engine; the table animates
  their actions via a reveal cursor (`revealed`, ~380ms/action). The acting glow is gated
  `!revealing && s.seat === view.toAct`, so it is suppressed during the reveal phase and `toAct`
  has advanced to the hero by the time reveal ends — hence only the hero glows.
  **Fix:** during the reveal phase, glow the seat whose action is being revealed
  (`log[revealed].seat`), walking seat-to-seat; rest the glow on the hero on their turn.
  380ms/action is perceptible — no extra minimum-duration floor needed. (Closes req Open Question #1.)

## Resolved from code / already-decided (not grilled)
- **Duplicate Hand review removal** → Only the `HandRecap` at `PokerTable.tsx:139` is removed; the
  `view.isOver` block and "Next hand" button remain. No hand-over flow regression.
- **Coaching CSS scoping** → The renderer wraps each doc in `<article data-testid="coaching-doc">`;
  scope the new typography to a real coaching class to avoid bleeding into other inline-styled panels (D5).
- **Default/landing tab** → Becomes "Live Feedback" (formerly default `feedback`); trivial.

## Gaps surfaced
- Requirements Open Question #1 can now be closed in the spec with the agreed glow-during-reveal behavior.

## Recommended next step
- Proceed to `/spec`; encode the glow-during-reveal contract (`log[revealed].seat`) and the
  coaching-class scoping as design details.
