# Spec + Plan — Reviewer iteration-9 fixes

Tier 2. Combined design + task breakdown. The two MAJORs are consistency fixes in the presentation
layer (FeedbackPanel gating on `analysis.kind`; MentalMathSection hidden at Conceptual). The rest are
surgical copy/CSS/threshold changes. No `HandRecord` schemaVersion change — the only new surface is
the additive optional `bluff_thin_equity` concept tag.

## Design decisions

### FR-1 Preflop fold/chart shows no pro-call contradiction (#1) — MAJOR
- Root cause: `FeedbackPanel` derived `facingBet` purely from `context.toCall > 0`. A SB folding to the
  BB has `toCall > 0`, so the postflop price frame (`whyLine` "you only need ~Y% / makes money over
  time", the equity-bar "need ~%" marker, the EV "Show the numbers" table) all fired on a preflop
  CHART decision (`kind === "preflop"`, `gtoClaim` true).
- Fix: read the branch off the analysis — `kind = analysis.explanationInput?.kind`,
  `isPreflopChart = kind === "preflop"`. Then `showWhyLine = !isPreflopChart && facingBet && need !==
  null`, the equity-bar `neededPct` marker follows `showWhyLine`, and a new `showEvTable =
  !isPreflopChart` gates the EV `<details>`. We EXCLUDE the preflop chart branch rather than restrict
  to `kind === "price"` only, so every postflop EV table the reviewer confirmed correct (Hand-1 river
  CHECK = valuecheck, Hand-4 river CALL = price) is left intact.
- Copy (`explain.ts preflop()`): the Equity `!heroDeviates` branch no longer says "profitable" when the
  chart action is FOLD (the EV of folding is $0 — "profitable" collided with the EV table). For a fold
  it returns a reconciliation sentence: "…that can look tempting, but a hand like this plays poorly
  after the flop, especially out of position, so folding … is the standard play here." Raise/call keep
  "the standard, profitable play".
- Tests (`FeedbackPanel.test.tsx`): a SB chart fold renders no "makes money"/"only need ~%" whyLine,
  no "need ~%" marker (`equity-needed` null), no EV table, and the sentence is not "profitable"; a
  postflop facing-a-bet CALL still shows both whyLine and EV table (regression). The iter-06 #4
  "preflop open-raise EV table" test is rewritten to assert a preflop chart open shows NO EV table
  (iter-09 #1 supersedes iter-06 #4 for preflop).

### FR-2 Conceptual depth hides Mental Math entirely (#2) — MAJOR
- Root cause: iter-8 suppressed only the named "Rule of 2 & 4" jargon; the numeric body (percentages,
  outs/×4, pot-odds, the Rule-of-4 reconciliation) still rendered at Conceptual depth.
- Fix: `MentalMathSection` early-returns `null` when `conceptual` (after the `!enabled` guard) — the
  section, its toggle, and its caption are all gone. The plain-words verdict headline is the Conceptual
  coaching. Full numeric Mental Math is unchanged at Equity/Strict.
- Tests (`MentalMathSection.test.tsx`): at Conceptual depth a flop drawing spot AND a preflop spot
  render null (`container.firstChild` null, no `mm-section`/`mm-header`, and `textContent` matches no
  digit). At Equity/Strict the section renders with `%` and the Rule-of-2&4 label. The two iter-08
  jargon-suppression tests are replaced by these (their behavior — render-but-hide-jargon — is
  superseded by render-nothing).

### FR-3 Keep the prior decision visible, relabeled (#3) — MINOR
- Root cause (`RightPanel`): while the hero decided a later street than the last verdict, the panel
  blanked to an empty `feedback-pending` card so two unrelated win%/EV figures never read AS the
  current spot (iter-02). But bots act instantly, so instant-feedback users never got to read the
  equity bar / Mental Math.
- Fix: always render `FeedbackPanel` when `feedback` exists; pass a new `priorDecision={{ pendingStreet
  }}` prop when the verdict is stale (`isStale`). `FeedbackPanel` renders a `feedback-prior` banner —
  "Your last decision — <verdict street>" + "You're now deciding your <pending street>; this updates
  when you act." — so the persisted verdict/equity/Mental-Math can't be mistaken for the current spot.
  The Mental Math section (inside the panel) still tracks the LIVE spot, which is exactly the
  reviewer's praised behavior. The empty-state card now shows only when there's no graded decision yet.
- Tests (`RightPanel.test.tsx`): while deciding a later street, the prior verdict + equity bar are
  rendered AND the `feedback-prior` banner names the prior street, the new street, and "updates when
  you act"; the old `feedback-pending` placeholder is gone. Same-street feedback shows no banner.

### FR-4 700×500 legibility — trim stage padding (#4) — MINOR
- `PokerTable` stage `padding: 16 → 8`. The fixed design box (`DESIGN_W × DESIGN_H`) is unchanged and
  still uniformly scaled, so the no-overlap / no-clip / no-scroll guarantee (uniform scale) holds; the
  table just scales up slightly before clamping at ≤1, gaining a little legibility at extreme-small
  sizes. This is the only clean, low-risk win — increasing in-box font sizes would risk overlap, so it
  was not attempted. A modest improvement, not a full fix (noted as a scale-to-fit tradeoff).

### FR-5 Position-aware oversize copy (#5) — NIT
- `explain.ts`: new `isOutOfPosition(position)` — IP only for BTN/CO, OOP otherwise (unknown ⇒ OOP).
  `preflop()`'s oversize branch picks "bloats the pot out of position and risks a lot to win a little"
  (OOP) vs "it bloats the pot and risks a lot to win a little" (IP, mirroring the conceptual variant).
- Tests (`explain.test.ts`): a BTN oversize open's copy has no "out of position"; a UTG one still does.

### FR-6 Verdict-tag wording (#6) — NIT
- (a) `FeedbackPanel VerdictBadge` takes `conceptTags`; when `preflop_oversize` is present it shows
  "Oversized" instead of the verdict's "Thin" label, keeping the ⚠️ icon + thin color.
- (b) `analyze.ts aggressionBranch`: split the no-made-hand low-equity bet at `NO_EQUITY_PCT = 20` —
  `< 20` keeps `bluff_no_equity` (mistake); `20–33` returns a new `bluff_thin_equity` tag (still a
  mistake). `explain.ts aggression()` + conceptual `aggression` add a `>= NO_EQUITY_PCT` branch wording
  it as a "light semi-bluff … not enough to push here, so it loses money on average" (avoids the bare
  word "equity" to satisfy the no-unexplained-jargon guard). The iter-06 made-hand path is untouched
  (it precedes this branch). New tag added to `conceptTags.ts`.
- Tests (`analyze.test.ts`): a ~31% air shove tags `bluff_thin_equity` (not `bluff_no_equity`), grades
  mistake, copy says "semi-bluff" not "no equity"; a 12% air bet still tags `bluff_no_equity`.

### FR-7 Strict BB chart voice — investigate, leave (#7) — NIT
- Investigation: `chartApplies(BB, "unopened")` is `false` because `preflopCharts.json.open` has no
  "BB" key — the baseline RFI chart deliberately has no BB open-first-in range (the BB never opens
  unopened in standard play; a BB raise over limpers is not an RFI spot). So a BB open-over-limpers
  falls to the equity `aggressionBranch` (no chart badge), while a BB facing a raise IS chart-gated
  (`vsOpen.BB` exists). This is legitimate and honesty-preserving: fabricating a BB RFI range would
  invent a chart claim that doesn't exist. LEFT AS-IS, documented. No behavior change, no test.

### FR-8 Suit contrast (#8) — NIT
- `globals.css`: `--hearts #c62f2f → #d3140e` (brighter/more saturated red), `--spades #1b1b1b →
  #0a0a0a` (truer ink-black). `Card.tsx`: the suit glyph rendered in a `font-size: 1.15em` span (no
  card box-size change). Contrast/visual only — the internal card data is already correct.

### FR-9 Going-forward EV label (#9) — NIT
- `FeedbackPanel`: the EV `<details>` body leads with "From here on — the average result going
  forward, not the whole-hand outcome:" so a river "check: $9" near a "lost $18" hand result no longer
  reads as contradictory (one is going-forward EV, the other whole-hand P&L).
- Test (`FeedbackPanel.test.tsx`): the EV table text matches "from here on" / "not the whole-hand
  outcome".

## Verification

- `npm run typecheck` (clean), `npm run lint` (no issues), `npm test` (395 passing — was 385, +10
  new; 5 legitimately-rewritten), `npm run build` — all green.
- Demo fixtures (`samples/session-demo/hand-*.json`) still validate (`schema.test.ts` green) — the
  copy changes don't alter the schema; the only new vocabulary is the additive `bluff_thin_equity` tag.
- Self-review (this round is about consistency): a preflop fold card now shows neither the pro-call
  whyLine nor the EV table and never calls folding "profitable"; Conceptual Mental Math renders zero
  digits (the section is null); the retained "last decision" panel is clearly labeled and can't be
  read as the current spot.
