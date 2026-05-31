# Execution Status — UX & Learning Overhaul

> Resume anchor. If context is lost: read this, run `git log --oneline e3a1440..HEAD`, then continue
> at the first ⬜ task. Execution mode: **inline (no subagents)**.

**Branch:** `feat/ux-learning-overhaul`  ·  **Plan:** `../03_plan.md`  ·  **Spec:** `../02_spec.md`
**HEAD:** `d09e590` (T16). **W1–W4 + T16 COMPLETE (T1–T16), committed & green** — at the T16 commit
the full suite was `PASS (186) FAIL (0)`, `tsc --noEmit` clean, `eslint` clean. **Next: ⬜ T17 (W5).**

> 🛑 **RESTART THE CLAUDE SESSION before continuing.** This session's harness suffered SEVERE
> tool-output degradation: Bash/Read *results* arrived in large multi-turn-delayed batches, **stalled
> entirely** (empty returns), and **garbled** (Read once returned `potOdmds` for `potOdds`; `git
> status` once listed already-committed files as modified; a Read of THIS file returned wrong line 2).
> Editing code from a garbled read is how `dataStore.ts` got corrupted earlier. A fresh session
> restores reliable I/O. On resume: `cd` to this worktree, then `/pmos-toolkit:feature-sdlc --resume`
> (or "continue").

> ⚠️ **Workflow rules that worked under degradation (keep using them):**
> 1. **ONE tool call per turn** for anything that mutates or might error. Parallel Bash batches are
>    **cancelled wholesale** when any one sibling exits non-zero — this silently ate many commits.
> 2. **Gate THEN commit in a single chained call:** `npx tsc --noEmit && npx vitest run && npx eslint
>    . --ext .ts,.tsx && git add <files> && git commit -m "…"`. `git commit` does NOT run tsc — a
>    broken T15 landed because it was committed before typecheck (fixed in `31bcce3`). The chained
>    `&&` form is what finally landed T16 cleanly.
> 3. Zero-exit greps (`2>/dev/null || true`); QUOTE globs (unquoted `--include=*.ts` breaks in zsh).
> 4. Trust `git log` + EXIT codes, not narration. Writes/Edits LAND even when their confirmation
>    doesn't render — verify by routing output through a temp file and Reading it
>    (`cmd > /tmp/x.txt 2>&1; cat /tmp/x.txt`).

## Waves / tasks

| Task | Wave | Description | Status | Commit |
|---|---|---|---|---|
| T1–T8 | W1/W2 | shell, tabs, setup reflow, money, categories, toAct/winners, glows, showdown | ✅ | committed |
| T9–T12 | W3 | bankroll reducer, save/load (atomic), GET/PUT /api/bankroll, bankrollStore + bot auto-rebuy | ✅ | `[T9]`..`[T12]` (+`fix(T10)`: missing `paths.bankrollFile`) |
| T13 | W3 | HeaderBar (Session P/L + Bank + presets) | ✅ | `[T13]` + rendered in PlayShell via `[T14]` |
| T14 | W3 | RebuyModal (top-up / out-of-chips / auto-rebuy) | ✅ | `595d5c0` |
| T15 | W4 | RankingsTab (9 categories strongest-first, enum-derived) | ✅ | `7f9250d` + `31bcce3` (fix: Trips/Quads + local label map) |
| T16 | W5 | allHands169() + genPreflopEquity (esbuild) + preflopEquity.json (169 keys) + gen:equity | ✅ | `d09e590` |
| T17 | W5 | PreflopChartTab (13×13 button grid + position selector + plain detail card) | ⬜ | **NEXT — not started; no files exist yet** |
| T18 | W6 | reword explain.ts to plain language | ⬜ | — |
| T19 | W6 | winner narration on fold (no invented hand) | ⬜ | — |
| TN | — | whole-feature sweep (FR-72, a11y, no-scroll Playwright, walkthrough, cleanup of stray oval-*.png) | ⬜ | — |

## Guards (must stay true)
- core/* pure (no react/dom/next/fs); no runtime LLM anywhere. (`scripts/genPreflopEquity.ts` is a
  build-time script under `scripts/`, NOT `core/` — it may use node fs; `core/charts/preflop.ts` stays pure.)
- HandRecord stays schema v1 (untouched); analyze.ts (verdict math) untouched.
- preflop equity from committed precomputed JSON (no runtime network/LLM). ✅ delivered in T16.
- a11y: grid cells / tabs / preset chips are real keyboard `<button>`s; glows behind prefers-reduced-motion.
- money via core/money.formatMoney; negatives use sign glyph not color-only (NFR-05).

## ▶ T17 — PreflopChartTab (plan 03_plan.md lines 1023–1070)
Files: create `components/PreflopChartTab.tsx` + `components/PreflopChartTab.test.tsx`; modify
`components/RightPanel.tsx` (`preflop` tab is `<Placeholder label="Preflop Chart" />` ~line 45 — also
add `import { PreflopChartTab } from "@/components/PreflopChartTab";` next to the RankingsTab import);
append `.chart-cell` + `.cell-raise/.cell-call/.cell-fold` + focus-visible ring to `app/globals.css`.
- **Grid:** 13×13 from `RANKS=["A","K","Q","J","T","9","8","7","6","5","4","3","2"]`. Cell (i,j):
  i===j pair `${hi}${hi}`; i<j suited `${RANKS[i]}${RANKS[j]}s` (upper-right, row rank higher);
  i>j offsuit `${RANKS[j]}${RANKS[i]}o` (higher rank first). Each cell a real `<button>` aria-label
  `"${key}, ${action}"`. `action = chartAction(repCombo(key), position, "unopened")`. **fold text
  contrast ≥4.5:1** via CSS (light-on-dark for fold).
- **repCombo(key)→[Card,Card]:** `hi=key[0]`; pair (len 2)→`[\`${hi}h\`, \`${hi}s\`]`; else `lo=key[1]`,
  `suited=key.endsWith("s")`→`[\`${hi}h\`, \`${lo}${suited?"h":"s"}\`]`. (Card is a `${Rank}${Suit}` string.)
- **Position `<select>`** aria-label "position", options `["UTG","MP","CO","BTN","SB","BB"]`, default
  **"BTN"**. `facing="unopened"`. (Hero-position auto-default is optional and NOT tested — do not block
  on a TableView seat-position field, which was never confirmed to exist.)
- **Detail card on click:** equity via `import equityTable from "@/core/charts/preflopEquity.json"`,
  read `equityTable.equity[key]` → "AK wins ~67 out of 100 vs a random hand" (AKs≈67). Plain defs of
  *baseline*, *equity*, *position*; the vs-random caveat MUST contain the word **"overstates"** (test
  asserts `/overstates/i`). Missing-key fallback (FR-56): `equity({ hero: repCombo(key), board: [],
  numOpponents: 1, iterations: 1500 })` — `import { equity } from "@/core/equity/equity"` (returns
  `{equityPct}`). **The equity fn is in `core/equity/equity.ts`, NOT montecarlo.ts (no such file).**
- **Test (plan lines 1042–1053):** `getAllByRole("button").length >= 169`;
  `getByLabelText(/AKs, (raise|call|fold)/)`; click `/AKs, /` → `/wins ~\d+ out of 100 vs a random
  hand/i` + `/baseline/i` + `/overstates/i`; plus a position-selector test (options include all six).
- **Gate + commit (single chained call):** `npx tsc --noEmit && npx vitest run && npx eslint . --ext
  .ts,.tsx && git add components/PreflopChartTab.tsx components/PreflopChartTab.test.tsx
  components/RightPanel.tsx app/globals.css && git commit -m "feat(T17): preflop chart teach …"`

## Confirmed API facts (verified this session)
- `Card = \`${Rank}${Suit}\``; RANKS `2..9,T,J,Q,K,A` (T=ten), SUITS `c d h s`. (`core/cards.ts`)
- **`equity(input): EquityResult` in `core/equity/equity.ts`** (NOT montecarlo.ts). EquityInput =
  `{hero:[Card,Card]; board:Card[]; numOpponents:number; range?; iterations:number; seed?}`; returns
  `{equityPct:number; iterations:number}`.
- `core/charts/preflop.ts`: `handKey([Card,Card])`, `chartAction([Card,Card],Position,Facing)
  →"raise"|"call"|"fold"`, `chartApplies`, `allHands169(): string[]`. `Position=UTG|MP|CO|BTN|SB|BB`;
  `Facing=unopened|raise`. `preflopEquity.json` = `{version,vs,iters,equity:{[key]:number}}`, 169 keys.
- **Generator runner:** `npm run gen:equity` = esbuild-bundle (script uses RELATIVE imports
  `../core/...`) piped to node. vite-node CANNOT resolve `@/` here (no vite-tsconfig-paths plugin; only
  esbuild is installed). The script imports `../core/equity/equity` (real path).
- HandCategory enum (core/eval/handEval.ts): HighCard0 Pair1 TwoPair2 Trips3 Straight4 Flush5
  FullHouse6 Quads7 StraightFlush8. `handCategoryLabel(cards: Card[])` decodes specific cards.

## After T17 → W6 (T18+T19): edit ONLY core/analysis/explain.ts + explain.test.ts
**Read explain.ts CLEANLY first (this session's read of it was garbled).** analyze.ts (verdict math)
stays untouched; preserve every conceptTag/structure.
- **T18** (bug-fix TDD): delete banned phrase **"You don't have the price to continue"**; replace
  jargon ("pot odds" → "the price you're getting to call"); ratios → "about X out of 100". Test: banned
  phrase absent + plain math present.
- **T19** (bug-fix TDD): on a hero FOLD with no showdown, narration names the winner by seat and must
  NOT invent villain hole cards. Grep for the current fold-narration string first (may be in explain.ts
  or HandRecap/handFlow). Test: `/took the pot|won the pot/i` present AND `/with (A|K|Q|J|T|\d){2}/` absent.

## TN — whole-feature sweep (plan ~line 1177)
FR-72 (formatMoney everywhere), a11y, no-scroll Playwright @1280×800 (Playwright MCP is sandboxed to
the ORIGINAL repo `/Users/maneeshdhabria/Desktop/Projects/personal/poker-coach` — serve + navigate;
screenshots land there; clean up after), end-to-end walkthrough, delete stray `oval-*.png` + decide on
`.pmos/complete-dev.lastrun.yaml`. Then **Phase 7 /verify → PAUSE for merge decision
(ask_before_merge:true)** → /complete-dev → /reflect gate → final summary.

## Commits this session (verified via git log)
T14 `595d5c0`; T15 `7f9250d` + fix `31bcce3`; T16 `d09e590`. Earlier STATUS drafts referenced
`3623843` / `4cc60f8` / `3a09c9e` / `e3f1a8c` for T16/T17 — those were **phantom (never created)**;
ignore them. The only real T16 commit is `d09e590`; T17 is NOT committed.

## Known notes
- `.pmos/feature-sdlc/state.yaml` is intentionally left modified/unstaged (orchestrator state).
- Stray untracked `oval-*.png`, `.pmos/complete-dev.lastrun.yaml` pre-existing; TN cleanup decides.
