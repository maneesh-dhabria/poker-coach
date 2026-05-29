# DESIGN.md — Poker Coach

Durable brand/design contract for the Poker Coach app. Greenfield (no host frontend yet);
elicited for this feature.

## Identity
- **Tone:** calm, friendly coach. Encouraging, never preachy. Plain language first.
- **Audience:** a single learner who knows poker but is **not a math person**. Numbers always
  arrive with a plain sentence and a visual cue.

## Tokens
```yaml
x-tokens:
  color:
    felt:        "#0f3d2e"   # table felt (primary surface)
    felt-deep:   "#0a2c20"   # darker felt / vignette
    panel:       "#15211c"   # side panels / cards
    panel-2:     "#1d2c26"   # raised panel
    ink:         "#eef2ee"   # primary text on dark
    ink-soft:    "#a9b7af"   # secondary text
    gold:        "#d8b15a"   # chips / accents / primary action
    good:        "#3fb96b"   # ✅ good decision
    thin:        "#e0b54a"   # 🟡 thin / marginal
    mistake:     "#e5594e"   # ❌ mistake
    card-face:   "#f7f5ef"   # playing-card background
    hearts:      "#d23b3b"
    spades:      "#1b1b1b"
  radius: { sm: 6px, md: 10px, lg: 16px, pill: 999px }
  font:
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    mono: "ui-monospace, 'SF Mono', Menlo, monospace"
```

## Layout
- Two-column play screen: **table (left, dominant)** + **coaching rail (right, ~360px)**.
- Settings is a centered single-column setup card before play.
- Coaching viewer is a readable single column (~720px max) of rendered markdown.

## Components (shape patterns)
- **Verdict badge** — pill with icon + word (✅ Good / 🟡 Thin / ❌ Mistake), colored by token.
- **Equity bar** — horizontal bar: your win% filled in gold vs grey; always paired with a sentence.
- **Plain-math line** — one sentence translating the numbers ("It costs $20 to win $80…").
- **Seat** — avatar chip + name + stack + style/skill tag; dims when folded; highlights when active.
- **Card** — rounded light face, large rank, suit color from tokens.
- **Action bar** — Fold / Check / Call / Bet·Raise with a sizing slider + quick % buttons.

## Do's and Don'ts
- DO pair every number with a plain sentence and a visual.
- DO state the assumed opponent range when showing equity ("vs a typical opener").
- DON'T show raw stat dumps (no bare "EV: -0.3bb" without translation).
- DON'T claim GTO postflop; label heuristic feedback honestly.

## Anti-patterns
- Stat walls, jargon without gloss, tiny dense type, alarming red for merely "thin" decisions.
