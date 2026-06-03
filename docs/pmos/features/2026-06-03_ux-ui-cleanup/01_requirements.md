# UX/UI Cleanup — Requirements

**Date:** 2026-06-03
**Last updated:** 2026-06-03
**Status:** Draft
**Tier:** 2 — Enhancement

## Problem

The Poker Coach play interface has accumulated **five UX rough edges** that make the right-hand panel feel cluttered and the table feedback inconsistent. The tab strip carries five tabs where two pairs are conceptually one thing each, the Hand review summary is shown twice on screen, the Coaching tab renders raw-looking unstyled markdown, and the "whose turn is it" glow only appears for the human seat — so the player loses the visual cue while bots act.

### Who experiences this?

The **single player** using the app to practice 6-max NLHE against bots and read coaching. They interact with the play screen (left: table; right: tabbed panel) every hand and read coaching between sessions.

### Why now?

These are friction points surfaced during everyday use after the v0.4.0 Mental Math release. They are small, independent, and reversible — a good batch to clean up before the next feature lands, so the interface reads clearly.

## Goals & Non-Goals

### Goals

- **Tab strip reads as three clear sections** — "Live Feedback", "Coaching", "References" — measured by: the tab strip shows exactly those three labels and every prior panel's content is still reachable.
- **Hand review appears exactly once** — measured by: the "Hand review" summary renders only inside the Live Feedback tab, never below the table.
- **Coaching markdown reads as styled prose** — measured by: headings, paragraphs, and lists in the Coaching tab have visible hierarchy (sizes, spacing, weights) consistent with the rest of the interface, not browser-default bare text.
- **The acting-seat glow follows whoever is to act next** — measured by: the glowing gold border appears on the seat that must act, whether that seat is the human or a bot, for the duration that seat is to act.

### Non-Goals

- NOT redesigning the tab visual style, colors, or the table layout — because this is a cleanup batch, not a restyle.
- NOT adding new coaching content, new reference content, or a markdown library — because the fix is presentation/styling of existing content (a heavier markdown engine is out of scope for a CSS fix).
- NOT changing bot decision speed or the reveal/animation timing model beyond what's needed to make the glow visible — because pacing is a separate concern.
- NOT persisting any new user setting — because none of these fixes introduce a preference.

## Solution Direction

Five independent changes to the existing play interface:

1. **Merge Hands + Feedback → "Live Feedback".** One tab whose panel stacks the per-decision **Feedback** content on top and the full-hand **Hand review** summary below it, in a single scrolling panel.

2. **Merge Rankings + Pre-Flop chart → "References".** One tab whose panel stacks **Rankings** above and the **Pre-Flop chart** below, in a single scrolling panel.

3. **Remove the duplicate Hand review below the table.** The Hand review summary currently rendered in the left/table column (on hand-over) is removed; the "Next hand" control that sits with it is preserved. Hand review remains available in the Live Feedback tab.

4. **Style the Coaching markdown.** The Coaching tab's rendered headings, paragraphs, lists, and bold text get typographic styling drawn from the existing design tokens (text colors, spacing, sizes, radii) so it matches the rest of the interface. Styling is **scoped to the coaching content** so it does not bleed into other panels.

5. **Fix the acting-seat glow for all seats.** The gold "thinking" glow follows the seat that is to act next — human or bot — instead of effectively only the human. The root cause (likely the reveal/auto-play timing or the `revealing` gate suppressing the glow during bot turns) is confirmed at spec time; the user-visible contract is: the seat to act is glowing while it is its turn.

Resulting tab strip (left→right): **Live Feedback · Coaching · References**.

## User Journeys

### Primary Journey — playing a hand

1. Player deals a hand. It is a bot's turn to act first; **that bot's seat glows gold** while it thinks, then acts; the glow moves seat to seat as the action proceeds, landing on the player's seat when it is their turn.
2. After each of the player's decisions, the **Live Feedback** tab shows the verdict/equity/plain-sentence feedback at the top.
3. The player keeps acting; below the table there is **no** Hand review block — only the table and (on hand-over) the "Next hand" button.
4. When the hand ends, the player opens **Live Feedback** and scrolls: live feedback at top, the full **Hand review** decision list below.

### Reference / coaching journey

5. The player opens **References** and scrolls: **Rankings** above, **Pre-Flop chart** below — both reachable without leaving the tab.
6. The player opens **Coaching** and reads a coaching doc; headings, bullet lists, and emphasis are clearly styled and easy to scan.

### Error / Edge Cases

- **No hand yet:** the Live Feedback tab shows its existing empty/placeholder state; References and Coaching behave as today.
- **Coaching empty / not yet generated:** existing empty state is preserved; styling changes only affect rendered docs.
- **Reduced-motion preference:** the acting glow continues to respect `prefers-reduced-motion` (static ring, no pulse) — the fix must keep that behavior for every seat, not just the human.

## Design Decisions

| # | Decision | Options Considered | Rationale |
|---|----------|-------------------|-----------|
| D1 | Tier 2 (enhancement) | (a) Tier 1, (b) Tier 2, (c) Tier 3 | User-confirmed. Touches several existing surfaces but no new persona/data model and is reversible. |
| D2 | Live Feedback tab = Feedback stacked above Hand review | (a) Stacked, (b) segmented toggle | User-confirmed stacked. Simpler, no new controls; natural top-to-bottom reading order. |
| D3 | References tab = Rankings stacked above Pre-Flop chart | (a) Segmented toggle, (b) stacked vertically | User-confirmed stacked vertically — both visible in one scroll. |
| D4 | Tab order: Live Feedback · Coaching · References | Keep relative order of surviving tabs | Live Feedback is the default/most-used; Coaching middle; References last. |
| D5 | Coaching markdown styling scoped to coaching content, not global element selectors | (a) global `h1/p/ul` rules, (b) scoped to coaching container | Scoped avoids restyling other inline-styled panels; lower regression risk. |
| D6 | Preserve "Next hand" button when removing the below-table Hand review | (a) remove the whole block, (b) remove only HandRecap | Removing only HandRecap keeps the hand-over flow intact. |

## Open Questions

| # | Question |
|---|----------|
| 1 | Exact root cause of the bot-seat glow not showing — confirm at spec time whether it's the `revealing` gate, bot auto-play timing, or both, and whether a minimum-visible-duration is needed so a fast bot turn is still perceptible. |

---

**For UX friction analysis, run `/msf-req` after this doc is committed.**
