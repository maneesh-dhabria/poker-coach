# DESIGN.md — Poker Coach

Brand contract extracted from the host frontend (`app/globals.css`, `components/table/*`, `components/FeedbackPanel.tsx`). Wireframes for the UX & Learning overhaul must look like **this app, extended**.

## Tokens (verbatim from app/globals.css)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b132b` | app background (deep navy) |
| `--panel` | `#142036` | panel surfaces |
| `--panel-2` | `#1b2a47` | raised surfaces / seat pills |
| `--felt` / `--felt-edge` | `#1f6f54` / `#14533f` | table felt radial gradient |
| `--table-bg` | `#0f3d2e` | table area backdrop |
| `--text` | `#e8eef5` | primary text |
| `--muted` | `#9fb0c3` | secondary text |
| `--gold` / `--gold-strong` | `#d8b15a` / `#e8c46f` | accent, active seat, primary CTA |
| `--good` | `#3fae6b` | good verdict / win / positive money |
| `--thin` | `#d8b15a` | thin verdict |
| `--mistake` | `#d9534f` | mistake verdict / fold button / negative money |
| `--chip` | `#2a3f63` | secondary buttons, tag chips |
| `--card-bg` | `#f6f1e7` | playing-card face (cream) |
| `--card-red` / `--card-black` | `#c0392b` / `#1a1a1a` | card suit colors |
| `--border` | `#2a3a57` | hairline borders |

Font: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`. Radii: 8px (pills/buttons), 12px (panels/pot), 5px (cards), 50% (table).

## Layout

- App background deep navy; the **poker table is a radial-gradient felt ellipse** with a 12px wood border (`#4a3420`) and inset shadow.
- **Play screen = two columns:** LEFT fixed (header + table + action bar), RIGHT a tabbed panel. Only the active tab body scrolls (G1/D17). No-scroll guarantee at **1280×800**.
- Seats are `132px` wide: two cards above a name/pill. Active seat pill = gold bg / dark text; hero seat = gold-strong 2px border.
- Pot shown center-table in a `rgba(0,0,0,0.25)` rounded box, gold-strong number.

## Components (existing idioms to honor)

- **Seat:** cards (32×46 small) + pill `{name}` / `{POS} · ${stack}`. Folded = 45% opacity. Active = gold pill.
- **Card:** cream face, rank over suit symbol; red for ♥♦, black for ♠♣; face-down = navy gradient.
- **Pot (CenterStack):** "POT" label (uppercase, letter-spaced, muted) + big gold number + optional "This round: …".
- **FeedbackPanel:** emoji + colored verdict label (✅ Good / ⚠️ Thin / ❌ Mistake), plain sentence, concept-tag chips (pill, chip bg), equity bar (good-green fill + white needed-% marker), "Show the numbers" `<details>`.
- **ActionBar:** row of buttons; Fold = mistake-red, Call/Check = chip, Bet/Raise = gold with slider. 10×18px padding, 8px radius.
- **Buttons (CTA):** gold bg, dark text, 700 weight (e.g. Deal).

## New components (this feature — flag for /verify promotion)

- **TabStrip + TabPanel** (right column) — Feedback / Coaching / Hands / Rankings / Preflop Chart; active tab gold underline.
- **HeaderBar** — Session P/L (▲green/▼red) + lifetime Bank + [New table][New hand]; money respects the $↔BB toggle.
- **AcctingGlow** — pulsing gold ring on the seat to act ("thinking").
- **ShowdownLayer** — winner seat glow + yellow winning-card highlight + center-table category banner ("Two Pair, Aces & Kings") + per-seat net chip (+$green/−$red).
- **RankingsList** — 10 hand categories, each a row with a plain example.
- **PreflopGrid** — 13×13 cell grid, solid raise/call/fold colors, folds grayed; position selector; click → detail card.
- **PreflopHandCard** — equity ("AK wins ~67/100 vs a random hand") + plain defs of baseline/equity/position + vs-random caveat.
- **RebuyModal** — bust → "top up from your bank?" + auto-rebuy toggle; bank-empty end state.
- **MoneyText** — shared formatter honoring the $↔BB display flag (D18).

## Do's and Don'ts

- DO keep the felt table the visual hero, always fully visible.
- DO use green for positive money / wins, red for negative, gold for accents — never invent new status colors.
- DO use solid single-action colors on the preflop grid; DON'T show mixed-frequency split cells (intimidates non-math learners — D6).
- DON'T introduce a second font or a light theme.
- DON'T let the left column scroll; only the active tab body scrolls.

## Anti-patterns

- Blocking end-of-hand modal (use center-table banner + auto-continue).
- Slow/un-skippable chip animations.
- Math-wall explanations — lead with the plain idea, then the term.

## x-source
applied: true
host_frontend: app/ + components/ (extracted 2026-05-31)
