import { describe, it, expect } from "vitest";
import { analyze } from "@/core/analysis/analyze";
import { Card } from "@/core/cards";

describe("analyze (T3 tracer: pot odds vs equity)", () => {
  it("calling for 3:1 with 46% equity is a good call at a correct price", () => {
    // 3:1 → pot 12, call 4 → breakeven 25%; 46% equity clears it easily.
    const a = analyze({
      action: "call",
      potBefore: 12,
      toCall: 4,
      equityPct: 46,
      unit: "usd",
    });
    expect(a.verdict).toBe("good");
    expect(a.severity).toBe(0);
    expect(a.conceptTags).toContain("call_correct_price");
    // plain-language line pairs numbers with words: dollars + percent.
    expect(a.plainExplanation).toContain("$");
    expect(a.plainExplanation).toContain("%");
  });

  it("calling 18% equity when 27% is needed is a mistake (too wide)", () => {
    // toCall 4, potBefore 11 → breakeven 4/15 = 26.7%; 18% < that.
    const a = analyze({
      action: "call",
      potBefore: 11,
      toCall: 4,
      equityPct: 18,
      unit: "usd",
    });
    expect(a.verdict).toBe("mistake");
    expect(a.severity).toBeGreaterThanOrEqual(2);
    expect(a.conceptTags).toContain("call_too_wide");
  });

  it("populates the numbers block as ground truth for the coach", () => {
    const a = analyze({ action: "call", potBefore: 11, toCall: 4, equityPct: 46 });
    expect(a.numbers.equityPct).toBeCloseTo(46, 1);
    expect(a.numbers.potOddsPct).toBeCloseTo(26.7, 1);
    expect(a.numbers.unit).toBe("usd");
    expect(a.schemaVersion).toBe(1);
  });

  it("a marginal call near breakeven is graded thin", () => {
    // breakeven 25%, equity 26% → barely +EV.
    const a = analyze({ action: "call", potBefore: 12, toCall: 4, equityPct: 26 });
    expect(a.verdict).toBe("thin");
    expect(a.severity).toBe(1);
  });

  it("folding a clearly +EV spot is graded a mistake (too tight)", () => {
    const a = analyze({ action: "fold", potBefore: 12, toCall: 4, equityPct: 60 });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("fold_too_tight");
  });

  it("folding when checking is free is always a mistake, regardless of equity", () => {
    // toCall 0 → no bet to face. Even with low equity, checking is free and dominates folding.
    const low = analyze({ action: "fold", potBefore: 10, toCall: 0, equityPct: 7, street: "flop" });
    expect(low.verdict).toBe("mistake");
    expect(low.conceptTags).toContain("fold_too_tight");
    // Plain language must NOT use the pot-odds "price" framing ($0 / need 0%).
    expect(low.plainExplanation).toMatch(/checking is free/i);
    expect(low.plainExplanation).not.toMatch(/0%/);

    const high = analyze({ action: "fold", potBefore: 10, toCall: 0, equityPct: 55, street: "flop" });
    expect(high.verdict).toBe("mistake");
    expect(high.severity).toBe(3); // gave up more equity → more severe
  });

  it("a free-check fold hides numbers cleanly at conceptual depth", () => {
    const a = analyze({
      action: "fold",
      potBefore: 10,
      toCall: 0,
      equityPct: 30,
      street: "flop",
      coachingDepth: "conceptual",
    });
    expect(a.plainExplanation).not.toContain("%");
    expect(a.plainExplanation).not.toContain("$");
    expect(a.plainExplanation).toMatch(/free/i);
  });

  it("conceptual depth omits raw $ and % from the explanation", () => {
    const a = analyze({
      action: "call",
      potBefore: 12,
      toCall: 4,
      equityPct: 46,
      coachingDepth: "conceptual",
    });
    expect(a.coachingDepth).toBe("conceptual");
    expect(a.plainExplanation).not.toContain("%");
    expect(a.plainExplanation).not.toContain("$");
  });
});

describe("analyze (T8: preflop charts, heuristics, depth, honesty)", () => {
  const hand = (a: string, b: string): [Card, Card] => [a as Card, b as Card];

  it("flags a preflop chart deviation with gtoClaim true (folding AA to no raise)", () => {
    const a = analyze({
      action: "fold",
      potBefore: 3,
      toCall: 2,
      equityPct: 85,
      street: "preflop",
      hand: hand("Ah", "As"),
      position: "CO",
      facing: "unopened",
    });
    expect(a.gtoClaim).toBe(true);
    expect(a.chart?.heroDeviates).toBe(true);
    expect(a.conceptTags).toContain("preflop_chart_deviation");
    expect(a.conceptTags).toContain("fold_too_tight");
    expect(a.verdict).toBe("mistake");
  });

  it("rewards preflop discipline when the line matches the chart (AKs open from CO)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 2,
      equityPct: 67,
      street: "preflop",
      hand: hand("Ah", "Kh"),
      position: "CO",
      facing: "unopened",
    });
    expect(a.gtoClaim).toBe(true);
    expect(a.chart?.heroDeviates).toBe(false);
    expect(a.verdict).toBe("good");
    expect(a.conceptTags).toContain("good_preflop_discipline");
  });

  // iter-12 #3: a LIMPED pot (callers ahead, no raiser) is off-model for the RFI chart. An iso-raise
  // over a lone limper must NOT be graded as a chart deviation against the RFI fold range — it's graded
  // by equity/heuristics (gtoClaim false), so the off-model note can explain it.
  it("treats an iso-raise over a limper as OFF-MODEL, not a chart deviation (KTo from MP)", () => {
    // $1/$2 table, blinds = $3. A lone limper completes → potBefore $5 (> $3 + $1). facing unopened.
    const a = analyze({
      action: "raise",
      potBefore: 5,
      toCall: 2,
      equityPct: 30,
      street: "preflop",
      hand: hand("Kd", "Ts"),
      position: "MP",
      facing: "unopened",
      smallBlind: 1,
      bigBlind: 2,
    });
    expect(a.gtoClaim).toBe(false); // off-model — no chart authority
    expect(a.chart).toBeUndefined();
    expect(a.conceptTags).not.toContain("preflop_chart_deviation");
  });

  it("still grades a true RFI spot (blinds-only pot) against the chart (KTo from MP folds)", () => {
    // Clean folded-to-hero RFI: potBefore is just the blinds ($3) → chart applies, gtoClaim true.
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 2,
      equityPct: 30,
      street: "preflop",
      hand: hand("Kd", "Ts"),
      position: "MP",
      facing: "unopened",
      smallBlind: 1,
      bigBlind: 2,
    });
    expect(a.gtoClaim).toBe(true);
    expect(a.chart?.applies).toBe(true);
  });

  it("without blind info, a preflop unopened spot is unchanged (no false limped-pot detection)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 5,
      toCall: 2,
      equityPct: 30,
      street: "preflop",
      hand: hand("Kd", "Ts"),
      position: "MP",
      facing: "unopened",
      // no smallBlind/bigBlind → detection disabled → chart still applies
    });
    expect(a.gtoClaim).toBe(true);
  });

  it("never claims GTO for a multiway postflop spot", () => {
    const a = analyze({
      action: "call",
      potBefore: 30,
      toCall: 10,
      equityPct: 40,
      street: "flop",
      numActiveOpponents: 2,
    });
    expect(a.gtoClaim).toBe(false);
    expect(a.chart).toBeUndefined();
  });

  it("detects a missed value bet (checking a strong river)", () => {
    const a = analyze({ action: "check", potBefore: 20, toCall: 0, equityPct: 72, street: "river" });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("value_bet_missed");
  });

  it("flags betting with no equity as a no-equity bluff (no made hand)", () => {
    // 7-high with no pair on this board → genuinely no made hand, low equity ⇒ a real bluff.
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 18,
      street: "turn",
      hole: ["7c", "2d"],
      board: ["Ah", "Kd", "Qs", "9h"],
    });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("bluff_no_equity");
  });

  // iter-06 #1: a MADE hand (two pair) bet at low multiway equity is VALUE, not a no-equity bluff.
  // The tag/verdict must NOT be bluff_no_equity, and the explanation must not say "bluff"/"no equity".
  it("does NOT tag a low-equity MADE-hand bet as a no-equity bluff (#1)", () => {
    // 4s2s on a 3s4c3d flop = two pair (fours & threes); ~18% multiway vs 5 all-ins.
    const a = analyze({
      action: "bet",
      potBefore: 32,
      toCall: 0,
      equityPct: 18,
      street: "flop",
      numActiveOpponents: 5,
      hole: ["4s", "2s"],
      board: ["3s", "4c", "3d"],
    });
    expect(a.conceptTags).not.toContain("bluff_no_equity");
    expect(a.conceptTags).toContain("made_hand_thin_value");
    expect(a.verdict).not.toBe("mistake"); // a value bet, not a "mistake bluff"
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("bluff");
    expect(lower).not.toContain("no equity");
    expect(lower).not.toContain("nothing");
    expect(lower).toContain("two pair"); // names the made hand
  });

  it("the conceptual made-hand bet copy also avoids 'bluff' and names the made hand (#1)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 32,
      toCall: 0,
      equityPct: 18,
      street: "flop",
      coachingDepth: "conceptual",
      numActiveOpponents: 5,
      hole: ["4s", "2s"],
      board: ["3s", "4c", "3d"],
    });
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("bluff");
    expect(lower).toContain("two pair");
  });

  // iter-09 #6b: reserve "bluff_no_equity" for genuinely tiny equity (< ~20%). A ~20–33% air-shove
  // with no made hand is a real light/thin semi-bluff, not "no equity" — tag bluff_thin_equity. The
  // -EV grade is unchanged (still a ❌ mistake).
  it("tags a ~31% air bet/shove as a thin/light bluff, NOT 'bluff_no_equity' (#6b)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 20,
      toCall: 0,
      equityPct: 31,
      street: "turn",
      hole: ["Kc", "Qd"],
      board: ["7h", "5d", "2s", "9c"],
    });
    expect(a.verdict).toBe("mistake"); // still graded -EV
    expect(a.conceptTags).toContain("bluff_thin_equity");
    expect(a.conceptTags).not.toContain("bluff_no_equity");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("semi-bluff");
    expect(lower).not.toContain("no equity");
  });

  it("still tags a genuinely tiny-equity (<20%) air bet as 'bluff_no_equity' (#6b boundary)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 12,
      street: "turn",
      hole: ["7c", "2d"],
      board: ["Ah", "Kd", "Qs", "9h"],
    });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("bluff_no_equity");
    expect(a.conceptTags).not.toContain("bluff_thin_equity");
  });

  it("treats a thin bet as marginal value", () => {
    const a = analyze({ action: "bet", potBefore: 20, toCall: 0, equityPct: 42, street: "flop" });
    expect(a.verdict).toBe("thin");
    expect(a.conceptTags).toContain("thin_value_good");
  });

  it("a clear value bet with strong equity is good", () => {
    const a = analyze({ action: "bet", potBefore: 20, toCall: 0, equityPct: 75, street: "flop" });
    expect(a.verdict).toBe("good");
  });

  // iter-08 #1 — bet-SIZE awareness on the value path, symmetric to the preflop oversize check.
  it("a normal ~half-pot value bet still grades good (not penalized for size)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 360,
      toCall: 0,
      equityPct: 75,
      street: "flop",
      raiseToAmount: 180, // 50% pot — a perfectly standard value-bet size
    });
    expect(a.verdict).toBe("good");
    expect(a.conceptTags).not.toContain("bet_too_small");
  });

  it("a small but legitimate ~25% pot value bet is NOT flagged as too small", () => {
    const a = analyze({
      action: "bet",
      potBefore: 360,
      toCall: 0,
      equityPct: 75,
      street: "flop",
      raiseToAmount: 90, // 25% pot — a legitimate small bet, above the conservative cutoff
    });
    expect(a.conceptTags).not.toContain("bet_too_small");
  });

  it("a grossly under-sized bet ($2 into $360 ≈ 0.6% pot) is flagged, not praised as value", () => {
    const a = analyze({
      action: "bet",
      potBefore: 360,
      toCall: 0,
      equityPct: 50,
      street: "flop",
      raiseToAmount: 2, // ~0.6% pot — a comical underbet (the iter-08 #1 scenario)
    });
    expect(a.verdict).toBe("thin");
    expect(a.conceptTags).toContain("bet_too_small");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("get money in while ahead");
    expect(lower).toContain("too small");
  });

  // iter-10 #3: a tiny bet WITH a made hand must still be flagged for its SIZE — the made-hand branch
  // used to return first and swallow the size critique ($2 into $36 ≈ 5% pot drew no comment).
  it("a tiny bet with a made hand is flagged for SIZE, keeping the made-hand context (#3)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 36,
      toCall: 0,
      equityPct: 40,
      street: "flop",
      numActiveOpponents: 2,
      hole: ["Th", "5c"], // pairs the Ten on the board → middle pair (a made hand)
      board: ["Td", "3s", "Ah"],
      raiseToAmount: 2, // $2 into $36 ≈ 5.6% pot — the reviewer's gross underbet
    });
    expect(a.verdict).toBe("thin");
    expect(a.conceptTags).toContain("bet_too_small"); // size critique surfaces
    expect(a.conceptTags).toContain("made_hand_thin_value"); // made-hand context kept
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("too small");
    expect(lower).toContain("pair"); // names the made hand (top/middle/bottom pair)
  });

  it("the conceptual copy for a tiny made-hand bet also flags the size and names the hand (#3)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 36,
      toCall: 0,
      equityPct: 40,
      street: "flop",
      coachingDepth: "conceptual",
      numActiveOpponents: 2,
      hole: ["Th", "5c"],
      board: ["Td", "3s", "Ah"],
      raiseToAmount: 2,
    });
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("too small");
    expect(lower).toContain("pair");
    expect(a.plainExplanation).not.toContain("$"); // conceptual: no digits
  });

  // iter-11 #1 (MAJOR): an undersized bet at LOW equity with NO made hand (A-high airball, ~13%) must
  // NOT be praised as "you're ahead, size up to get paid while you're in front" — that value framing
  // contradicts its own EV table (betting is -EV). It must fall through to the low-equity bluff branch:
  // a ❌ mistake that agrees with the EV table, never claiming a lead.
  it("an undersized bet at LOW equity with no made hand is a bluff MISTAKE, not bet_too_small (#1)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 42,
      toCall: 0,
      equityPct: 13, // A-high airball — clearly behind
      street: "flop",
      numActiveOpponents: 1,
      raiseToAmount: 2, // min-bet into $42 ≈ 5% pot — undersized
    });
    expect(a.verdict).toBe("mistake"); // agrees with the EV table (betting is -EV), not "thin value"
    expect(a.conceptTags).not.toContain("bet_too_small");
    expect(a.conceptTags).not.toContain("made_hand_thin_value");
    expect(a.conceptTags).toContain("bluff_no_equity"); // < NO_EQUITY_PCT (20)
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("ahead");
    expect(lower).not.toContain("in front");
    expect(lower).not.toContain("size up");
  });

  it("an undersized bet at MID equity (~25%) with no made hand is a thin-bluff MISTAKE, not bet_too_small (#1)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 42,
      toCall: 0,
      equityPct: 25, // some equity, but still behind — a light semi-bluff, not value
      street: "flop",
      numActiveOpponents: 1,
      raiseToAmount: 2,
    });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).not.toContain("bet_too_small");
    expect(a.conceptTags).toContain("bluff_thin_equity");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("in front");
  });

  // The complement (don't reopen iter-10 #3): an undersized bet WHEN value-betting (high equity, no
  // made hand) is still flagged for SIZE — bet_too_small — and may honestly say "ahead".
  it("an undersized bet at HIGH equity (value) is still bet_too_small (#1 keeps iter-10 #3)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 42,
      toCall: 0,
      equityPct: 70, // genuinely ahead — value bet
      street: "flop",
      raiseToAmount: 2,
    });
    expect(a.verdict).toBe("thin");
    expect(a.conceptTags).toContain("bet_too_small");
    expect(a.plainExplanation.toLowerCase()).toContain("too small");
  });

  it("conceptual depth omits raw numbers even for preflop chart feedback", () => {
    const a = analyze({
      action: "fold",
      potBefore: 3,
      toCall: 2,
      equityPct: 85,
      coachingDepth: "conceptual",
      street: "preflop",
      hand: hand("Ah", "As"),
      position: "CO",
      facing: "unopened",
    });
    expect(a.plainExplanation).not.toContain("%");
    expect(a.plainExplanation).not.toContain("$");
  });

  // iter-03 #4: the concept tag must match the action the hero actually took. A preflop RAISE that
  // the chart says to fold must NOT be tagged "call too wide" (the hero did not call).
  it("does not tag a preflop RAISE with 'call_too_wide' (#4)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 2,
      equityPct: 30,
      street: "preflop",
      hand: hand("9d", "3c"), // a clear fold by the chart from CO
      position: "CO",
      facing: "unopened",
    });
    expect(a.verdict).toBe("mistake");
    expect(a.chart?.heroDeviates).toBe(true);
    expect(a.conceptTags).not.toContain("call_too_wide");
    expect(a.conceptTags).toContain("played_too_wide");
  });

  // iter-03 #4: a RIVER fold's tag must not be labeled "preflop". A sound non-preflop fold gets the
  // street-neutral discipline tag.
  it("a sound RIVER fold is not tagged 'good_preflop_discipline' (#4)", () => {
    const a = analyze({
      action: "fold",
      potBefore: 240,
      toCall: 60,
      equityPct: 5, // Q-high facing a big river bet — almost no equity
      street: "river",
    });
    expect(a.verdict).toBe("good");
    expect(a.conceptTags).not.toContain("good_preflop_discipline");
    expect(a.conceptTags).toContain("good_fold_discipline");
  });

  // iter-03 #5: folding far below the price into a HUGE pot must cite the low win-chance vs the
  // price, NOT a "pot isn't big enough" rationale (the pot is enormous here).
  it("explains a low-equity fold into a big pot by win-chance, not 'pot isn't big enough' (#5)", () => {
    const equityDepth = analyze({
      action: "fold",
      potBefore: 240,
      toCall: 60,
      equityPct: 5,
      street: "river",
    });
    expect(equityDepth.verdict).toBe("good");
    expect(equityDepth.plainExplanation.toLowerCase()).not.toContain("pot isn't big enough");

    const conceptualDepth = analyze({
      action: "fold",
      potBefore: 240,
      toCall: 60,
      equityPct: 5,
      street: "river",
      coachingDepth: "conceptual",
    });
    expect(conceptualDepth.plainExplanation.toLowerCase()).not.toContain("pot isn't big enough");
    expect(conceptualDepth.plainExplanation.toLowerCase()).toMatch(/wins too rarely|win back/);
  });

  // iter-06 #3: a NORMAL ~3 BB open is unflagged "good"; an absurd ~50 BB open is flagged for size
  // and never praised as "the standard, profitable play".
  it("does not flag a normal ~3 BB preflop open (#3)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 2,
      equityPct: 60,
      street: "preflop",
      hand: hand("Ah", "Kh"),
      position: "CO",
      facing: "unopened",
      raiseToAmount: 6, // ~3 BB at $1/$2
      bigBlind: 2,
    });
    expect(a.verdict).toBe("good");
    expect(a.conceptTags).not.toContain("preflop_oversize");
    expect(a.conceptTags).toContain("good_preflop_discipline");
  });

  it("flags an absurd ~52 BB preflop open for size and does not call it standard (#3)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 2,
      equityPct: 60,
      street: "preflop",
      hand: hand("Qd", "Td"),
      position: "UTG",
      facing: "unopened",
      raiseToAmount: 104, // ~52 BB at $1/$2
      bigBlind: 2,
    });
    expect(a.conceptTags).toContain("preflop_oversize");
    expect(a.verdict).not.toBe("good");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("standard, profitable play");
    expect(lower).toMatch(/bigger than a standard open|size it down/);
  });

  // iter-13 #2: a GROSS overbet (≥5× pot) is flagged for SIZE even with good equity, while standard
  // 3-bets/4-bets and forced short-stack all-ins (pot-multiple stays low) are NOT flagged.
  it("(iter-13 #2) flags a gross postflop overbet (≥5× pot) for size even with good equity", () => {
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 70, // clearly ahead — direction is fine
      street: "flop",
      numActiveOpponents: 1,
      hole: ["Ah", "Ad"],
      board: ["As", "7c", "2d"], // set — a real value bet
      raiseToAmount: 140, // 7× the pot — a gross overbet
    });
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.verdict).toBe("thin"); // good direction downgraded to ⚠️ for size
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("size down");
    expect(lower).toMatch(/7×|7x| 7 ×/);
  });

  it("(iter-13 #2) flags a gross preflop 4-bet OVERBET (non-open raise) for size even with good equity", () => {
    // AJo facing a 3-bet, shoving 92 into a 7 pot ≈ 13× — the reviewer's scenario.
    const a = analyze({
      action: "raise",
      potBefore: 7,
      toCall: 5,
      equityPct: 63,
      street: "preflop",
      hand: hand("Ah", "Jc"),
      position: "BTN",
      facing: "raise", // a 4-bet facing a 3-bet — NOT a first-in open
      raiseToAmount: 184, // 92 BB at $1/$2 into a 7 pot ≈ 26× — absurd
      bigBlind: 2,
    });
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.verdict).not.toBe("good");
    expect(a.plainExplanation.toLowerCase()).toContain("size down");
  });

  it("(iter-13 #2) does NOT flag a standard 3-bet/4-bet size", () => {
    // A normal ~2.5× 3-bet of a small preflop pot.
    const a = analyze({
      action: "raise",
      potBefore: 8,
      toCall: 6,
      equityPct: 55,
      street: "preflop",
      hand: hand("Kh", "Kd"),
      position: "BTN",
      facing: "raise",
      raiseToAmount: 20, // 2.5× the pot — standard 3-bet sizing
      bigBlind: 2,
    });
    expect(a.conceptTags).not.toContain("oversize_bet");
  });

  it("(iter-13 #2) does NOT flag a forced short-stack all-in (pot-multiple stays low)", () => {
    // Short stack shoves ~1× the pot — the stack, not a choice, caps the size.
    const a = analyze({
      action: "raise",
      potBefore: 30,
      toCall: 6,
      equityPct: 55,
      street: "flop",
      numActiveOpponents: 1,
      hole: ["Ah", "Kh"],
      board: ["Ad", "7c", "2s"],
      raiseToAmount: 40, // ~1.3× the pot — a forced shove, not an overbet
    });
    expect(a.conceptTags).not.toContain("oversize_bet");
    expect(a.verdict).toBe("good"); // a normal-sized value raise stays ✅
  });

  it("(iter-13 #2) does NOT flag a standard pot-sized postflop bet", () => {
    const a = analyze({
      action: "bet",
      potBefore: 100,
      toCall: 0,
      equityPct: 70,
      street: "flop",
      numActiveOpponents: 1,
      hole: ["Ah", "Ad"],
      board: ["As", "7c", "2d"],
      raiseToAmount: 100, // 1× the pot — standard
    });
    expect(a.conceptTags).not.toContain("oversize_bet");
    expect(a.verdict).toBe("good");
  });

  // iter-06 #6: an essentially-breakeven price-branch call (edge within a small band of 0) grades
  // ⚠️ thin, not ❌ mistake; a clearly -EV call stays a mistake.
  it("grades a near-breakeven call as thin, not a mistake (#6)", () => {
    // potBefore 32, toCall 5 → breakeven 5/37 = 13.5%; 14% equity ⇒ edge +0.5 ⇒ thin.
    const breakeven = analyze({ action: "call", potBefore: 32, toCall: 5, equityPct: 14 });
    expect(breakeven.verdict).toBe("thin");
    // A call ~1.5 below the price is still thin (the widened band), not a hard mistake.
    const slightlyUnder = analyze({ action: "call", potBefore: 32, toCall: 5, equityPct: 12 });
    expect(slightlyUnder.verdict).toBe("thin");
    // A clearly -EV call (edge well below -2) stays a mistake.
    const badCall = analyze({ action: "call", potBefore: 11, toCall: 4, equityPct: 18 });
    expect(badCall.verdict).toBe("mistake");
  });

  it("populates the EV block for all three options", () => {
    const a = analyze({
      action: "call",
      potBefore: 20,
      toCall: 10,
      equityPct: 50,
      raiseToExtra: 20,
      foldEquityPct: 40,
    });
    expect(typeof a.numbers.ev.fold).toBe("number");
    expect(typeof a.numbers.ev.call).toBe("number");
    expect(typeof a.numbers.ev.raise).toBe("number");
  });
});
