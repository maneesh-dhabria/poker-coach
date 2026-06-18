# Spec + Plan — Reviewer iteration-18 fixes

Tier 1. Combined design + task breakdown for one MAJOR coaching-grading correctness item plus two
MINOR copy items and two NIT polish items. Edits live in
`core/analysis/{analyze.ts, explain.ts, conceptTags.ts}`, `components/FeedbackPanel.tsx`,
`components/HandRecap.tsx`, `components/MentalMathSection.tsx`, and `app/globals.css`. No
EV/equity/pot-odds computation change; no `HandRecord` schemaVersion bump (one additive concept tag).

## Design decisions

### FR-MAJOR Escalate a clearly-losing made-hand value bet (thin → mistake)

- **Mechanism (`analyze.ts`, new `escalateThinValueIfLosing`).** After `route()` produces a branch,
  a post-step runs on EXACTLY the made-hand thin-value path (`verdict === "thin"` &&
  `conceptTags` includes `made_hand_thin_value`, and NOT a `flagUndersize` bet — a tiny underbet is a
  size problem, not a money-bleed). It escalates to ❌ `mistake` (severity 2) when BOTH hold:
  - `ev.raise < −THIN_VALUE_LOSS_BB × oneBigBlind` — the BET's **absolute** EV is clearly negative
    (`THIN_VALUE_LOSS_BB = 1.5`); and
  - `ev.raise < ev.call − EV_RECONCILE_MARGIN` — and materially worse than checking (`ev.call` is the
    CHECK row when facing no bet; `EV_RECONCILE_MARGIN = 2` USD ≈ 1 BB of Monte-Carlo noise).
  On escalation it drops `made_hand_thin_value` and adds `value_bet_too_thin`.
- **The BB threshold and how 1 BB is derived.** The discriminator is the bet's absolute EV magnitude
  in **big blinds**, so we derive 1 BB robustly: `input.bigBlind` if present; else `2 × input.smallBlind`
  (the iter-12 limped-pot work already threads both blinds through `AnalyzeInput`); else a fallback
  `FALLBACK_BIG_BLIND = 2` (the app's only table is $1/$2). The cut is **1.5 BB** of absolute loss:
  - **Stays ⚠️ thin:** a value bet at ≈ −0.5 BB (−$1) — the iter-17 reviewer explicitly accepted this as
    correctly "thin" (check $16 vs bet −$1). `−1 > −3`, so `clearlyLosing` is false → not escalated.
  - **Escalates to ❌ mistake:** the iter-18 case at ≈ −2.4 BB (−$4.8), with check +1.2 BB (+$2.4) —
    `−4.8 < −3` AND `−4.8 < 2.4 − 2`, so both gates pass.
- **Why this is safe.** Only the made-hand thin-VALUE branch is ever touched; every other branch
  (preflop chart, price call, bluff, overbet, undersize) passes through unchanged. A genuinely
  break-even/slightly-negative thin value bet keeps ⚠️ thin. `HandRecap.counts()` buckets off
  `analysis.verdict`, so the escalated bet now tallies as a mistake — matching the EV breakdown.
- **Copy (`explain.ts`).** A new branch BEFORE the made-hand thin-value copy: `madeHand && verdict ===
  "mistake"` → "You have {label}, but … your ~X% to win is too low to bet for value — checking is
  clearly better here, and this {bet} loses money on average." A symmetric conceptual branch ("checking
  was clearly better … loses money on average"). Neither says "this is a value bet" / "thin value".
- **Label (`conceptTags.ts` + `FeedbackPanel.TAG_LABELS`).** New tag `value_bet_too_thin` → chip
  "Checking was better". The verdict badge already shows ❌ Mistake off `analysis.verdict`.

### FR-1 Borderline thin call: one coherent message (MINOR)

- **Mechanism (`explain.ts` price-thin + `FeedbackPanel.whyLine`).** Reuse `isBorderlinePrice`
  (`abs(equity − need) ≤ BORDERLINE_PRICE_MARGIN = 3`). In the thin-price copy, borderline →
  "Close — this is about break-even, so calling and folding are roughly equal here." (conceptual:
  "It's about break-even here — calling and folding are roughly equal."). In `whyLine`, a borderline
  `thin` verdict → "You win ~X% and need ~Y% — that's about break-even, so calling and folding are
  roughly equal here." A clearly-thin call (outside the band) keeps "just about worth it"; a real
  shortfall keeps "you come up short, so this loses money over time."

### FR-2 Prominent net-result headline (MINOR)

- **Mechanism (`HandRecap.tsx`).** Split the result line out of the muted `/poker-coach` paragraph into
  its own `data-testid="recap-result"` headline: `fontSize 16`, `fontWeight 700`, coloured `--good`
  (win) / `--mistake` (loss) / `--ink` (neutral). Wording unchanged (`resultLine` reused), so a big
  all-in win renders a bold "Result: you won $792." that obviously explains the stack jump.

### FR-3 Good-check made-hand Mental-Math wording (NIT)

- **Mechanism (`MentalMathSection.noDrawSummary`).** Thread a `goodCheck` flag (hero `heroAction ===
  "check"` AND no bet to call). When set, the made-hand no-draw line reads "…but at ~X% it's not strong
  enough to bet for value, so checking is fine." Bet/call spots keep "…at ~X% to win it's marginal here."

### FR-4 Top-bar buttons one line at 600px (NIT)

- **Mechanism (`app/globals.css`, `.btn`).** Add `white-space: nowrap`. Short pill labels stay one
  line; no overflow/clip at 600/700/800/1280/1366.

## Test plan

- `analyze.test.ts` — MANDATORY calibration anchors: a made-hand value bet at ≈ −0.5 BB STAYS thin
  (keeps `made_hand_thin_value`, copy still says "value"); the iter-18 top-pair bet at ≈ −2.4 BB
  (check +1.2 BB) ESCALATES to mistake (severity 2, `value_bet_too_thin`, copy drops "value bet",
  says "checking is clearly better"/"loses money") and TALLIES as a mistake. Existing iter-06 #1
  made-hand non-bluff test re-pointed to a small near-break-even bet (preserves its non-bluff intent).
- `explain.test.ts` — borderline thin call says "about break-even"/"roughly equal", not "just about
  worth it" (equity + conceptual); a clearly-thin call keeps "just about worth it"; escalated
  made-hand copy (equity + conceptual) names the hand, says checking better + loses money, drops value.
- `FeedbackPanel.test.tsx` — borderline thin call's whyLine reads "about break-even"/"roughly equal",
  not the grim "loses money over time"; a clearly-short call keeps the grim line.
- `HandRecap.test.tsx` — `recap-result` is bold + coloured; win = `--good`, loss = `--mistake`.
- `MentalMathSection.test.tsx` — good check of top pair says "not strong enough to bet for value, so
  checking is fine", not "marginal here"; a call spot keeps "marginal here".

## Verification

`npm run typecheck` (clean) · `npm run lint` (clean) · `npm test` (all green) · `npm run build` (clean).
Demo fixtures still validate (additive tag only; schema test green). No schemaVersion bump.
