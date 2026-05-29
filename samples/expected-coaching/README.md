# Expected coaching — manual verification

The `/poker-coach` skill produces natural-language markdown, so its output is reviewed by hand
rather than diffed against a golden file. The committed fixtures in `../session-demo/` are
deterministic, so a reviewer can reproduce and check them.

## How to run

1. Copy the demo fixtures into the live data dir so the skill can read them:
   ```sh
   mkdir -p data/hands/demo data/sessions
   cp samples/session-demo/hand-*.json data/hands/demo/
   cp samples/session-demo/session.json data/sessions/demo.json
   ```
2. In Claude Code, run: `/poker-coach session demo`
3. Confirm it wrote `data/coaching/demo/hand-*.md` + `data/coaching/demo/session-summary.md`
   and updated `data/coaching/processed.json`.

## What to verify (the honesty + plain-language contract)

- **No recomputation:** every percentage / dollar figure in the coaching text appears in the
  corresponding hand record's `heroDecisions[].analysis.numbers` block. The coach must not invent or
  recalculate equity, pot odds, or EV.
- **`gtoClaim` respected:** for any decision where `analysis.gtoClaim` is `false` (all postflop and
  all multiway spots), the coaching never says "GTO", "optimal", or "the solver play".
- **Assumed range restated:** wherever equity is discussed, the text names the `assumedRange`
  (e.g. "vs a typical opponent range"); it never implies we saw opponents' hole cards (only
  `outcome.shown` cards were actually revealed).
- **Plain language:** verdicts lead; math is light and translated into sentences. At `conceptual`
  depth there are no raw numbers at all.
- **Leak summary:** `session-summary.md` aggregates recurring `conceptTags` into plain-words leaks
  with a concrete fix, plus what the user did well.
