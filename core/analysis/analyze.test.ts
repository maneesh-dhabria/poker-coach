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

  // iter-12 #3 / iter-22 MAJOR-1a: a LIMPED pot (callers ahead, no raiser) is off-model for the RFI
  // chart. An open of a hand the chart FOLDS (KTo from MP) is a LOOSE OPEN — off-model (gtoClaim false,
  // no chart authority), graded by PREFLOP yardsticks (position + strength), NOT the postflop
  // aggression heuristic that wrongly framed a normal open as a "semi-bluff with no made hand that
  // loses on a push". REWRITTEN from the iter-12 assertion "not a chart deviation": the reviewer
  // confirms an off-chart limped-pot open IS off the chart and must read as a loose RAISE with a
  // position/strength reason — never a postflop semi-bluff.
  it("grades an off-chart open in a limped pot as a LOOSE OPEN, not a postflop semi-bluff (KTo MP, iter-22)", () => {
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
    expect(a.conceptTags).toContain("loose_open");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("raising"); // correct verb — never "betting"
    expect(lower).not.toContain("semi-bluff");
    expect(lower).not.toContain("no made hand");
    expect(lower).not.toContain("push");
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
    // 4s2s on a 3s4c3d flop = two pair (fours & threes); ~18% multiway vs 5 all-ins. A SMALL bet keeps
    // the EV near break-even so it stays a ⚠️ thin VALUE bet (a clearly-losing one now escalates to a
    // mistake — see the iter-18 MAJOR tests below). The point here is only that it's never a "bluff".
    const a = analyze({
      action: "bet",
      potBefore: 32,
      toCall: 0,
      equityPct: 18,
      street: "flop",
      numActiveOpponents: 5,
      hole: ["4s", "2s"],
      board: ["3s", "4c", "3d"],
      raiseToExtra: 10, // a small bet → EV ≈ −0.3 BB, near break-even, so it stays ⚠️ thin value
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

  // iter-18 MAJOR — calibration anchor #1 (STAYS thin): a made-hand VALUE bet whose absolute EV is only
  // SLIGHTLY negative (≈ −0.5 BB, near break-even) stays ⚠️ thin. The iter-17 reviewer explicitly
  // accepted a thin value bet at ≈ −0.5 BB as correctly "thin"; the threshold must keep it there.
  it("a made-hand value bet at ≈ −0.5 BB (near break-even) STAYS ⚠️ thin (MAJOR anchor)", () => {
    // 5h5c on 9d 5s 2c → bottom set's not it; here a paired 5 = a pair (made hand). eq 25% multiway.
    // check EV = 0.25×20 = +$5; a small bet → bet EV ≈ −$1 (≈ −0.5 BB): clearly worse? no — within the
    // loss band, so it must remain a thin value bet, not escalate.
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 25,
      street: "flop",
      numActiveOpponents: 3,
      hole: ["5h", "5c"],
      board: ["9d", "5s", "2c"],
      raiseToExtra: 12, // bet EV ≈ −$1 ≈ −0.5 BB
    });
    expect(a.numbers.ev.raise).toBeCloseTo(-1, 0); // ≈ −0.5 BB on the $1/$2 table
    expect(a.verdict).toBe("thin"); // stays ⚠️ thin — near break-even
    expect(a.conceptTags).toContain("made_hand_thin_value");
    expect(a.conceptTags).not.toContain("value_bet_too_thin");
    expect(a.plainExplanation.toLowerCase()).toContain("value"); // still framed as a value bet
  });

  // iter-18 MAJOR — calibration anchor #2 (ESCALATES to mistake): the exact iter-18 Hand-6 spot — top
  // pair on a wet multiway board, check +1.2 BB vs bet −2.4 BB (3.6 BB worse AND clearly negative).
  // This must grade ❌ mistake (tally as a mistake) and NOT keep calling it "this is a value bet".
  it("a top-pair value bet at ≈ −2.4 BB (check positive) ESCALATES to ❌ mistake (MAJOR anchor)", () => {
    // 6h Js on 6c 3c 2d → top pair (the 6), J kicker; ~20% multiway. check EV = 0.20×12 = +$2.4 (+1.2
    // BB); a half-pot-plus bet → bet EV ≈ −$4.8 (−2.4 BB) — 3.6 BB worse than checking and clearly -EV.
    const a = analyze({
      action: "bet",
      potBefore: 12,
      toCall: 0,
      equityPct: 20,
      street: "flop",
      numActiveOpponents: 3,
      hole: ["6h", "Js"],
      board: ["6c", "3c", "2d"],
      raiseToExtra: 12, // bet EV ≈ −$4.8 ≈ −2.4 BB
    });
    expect(a.numbers.ev.call).toBeCloseTo(2.4, 1); // CHECK row: +1.2 BB
    expect(a.numbers.ev.raise).toBeCloseTo(-4.8, 1); // BET row: −2.4 BB
    expect(a.verdict).toBe("mistake"); // escalated — clearly money-losing, worse than checking
    expect(a.severity).toBe(2);
    expect(a.conceptTags).toContain("value_bet_too_thin");
    expect(a.conceptTags).not.toContain("made_hand_thin_value");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("this is a value bet");
    expect(lower).not.toContain("thin value");
    expect(lower).toContain("checking is clearly better");
    expect(lower).toContain("loses money");
  });

  // iter-18 MAJOR — the escalated bet must TALLY as a mistake (HandRecap.counts buckets off verdict).
  it("the escalated thin-value bet tallies as a mistake, not thin (MAJOR)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 12,
      toCall: 0,
      equityPct: 20,
      street: "flop",
      numActiveOpponents: 3,
      hole: ["6h", "Js"],
      board: ["6c", "3c", "2d"],
      raiseToExtra: 12,
    });
    // The bucket HandRecap.counts() tallies on is analysis.verdict.
    expect(a.verdict).toBe("mistake");
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

  // iter-14 #3: the postflop overbet threshold is lowered (≥3×) so a clearly-reckless ~4× stack-off
  // with a MARGINAL edge flags ⚠️ even with decent equity — the reviewer's $185-into-$45 turn shove.
  it("(iter-14 #3) flags a ~4× pot postflop shove with a marginal 53% edge for size", () => {
    const a = analyze({
      action: "bet",
      potBefore: 45,
      toCall: 0,
      equityPct: 53, // marginal middle pair, ahead but thin
      street: "turn",
      numActiveOpponents: 2,
      hole: ["Jh", "Td"],
      board: ["Ks", "9c", "Jd", "4h"], // middle pair of jacks
      raiseToAmount: 185, // ~4.1× the pot — a reckless whole-stack overbet
    });
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.verdict).toBe("thin"); // a ✅ value bet downgraded to ⚠️ for size
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("size down");
    expect(lower).toMatch(/whole stack|win a little/);
    expect(lower).toContain("2 players"); // multiway danger named
  });

  it("(iter-14 #3) does NOT flag a 1.5× pot value bet", () => {
    const a = analyze({
      action: "bet",
      potBefore: 40,
      toCall: 0,
      equityPct: 72,
      street: "flop",
      numActiveOpponents: 1,
      hole: ["Ah", "Ad"],
      board: ["As", "7c", "2d"],
      raiseToAmount: 60, // 1.5× the pot — a fat but reasonable value bet
    });
    expect(a.conceptTags).not.toContain("oversize_bet");
    expect(a.verdict).toBe("good");
  });

  it("(iter-14 #3) does NOT flag a standard preflop 3-bet (~2.5×) under the lenient preflop cutoff", () => {
    const a = analyze({
      action: "raise",
      potBefore: 9,
      toCall: 6,
      equityPct: 58,
      street: "preflop",
      hand: hand("Ah", "Ks"),
      position: "BTN",
      facing: "raise",
      raiseToAmount: 27, // 3× the pot — a standard 3-bet, under the ~8× preflop cutoff
      bigBlind: 2,
    });
    expect(a.conceptTags).not.toContain("oversize_bet");
  });

  // iter-14 #5: a reasonable ISOLATION raise over limpers of a hand the RFI chart would open is graded
  // ✅ (a standard iso), NOT ⚠️ thin — and the copy explains the limpers difference from the chart.
  it("(iter-14 #5) grades an iso-raise over limpers of a chart-open hand as a standard iso, not thin", () => {
    const a = analyze({
      action: "raise",
      potBefore: 5, // SB 1 + BB 2 + a 2 limp = 5 → a limped pot, off-model for the RFI chart
      toCall: 0,
      equityPct: 43, // raw heads-up-ish equity the equity branch once called "thin"
      street: "preflop",
      hand: hand("Kh", "Qd"), // KQo — the RFI chart opens this from SB
      position: "SB",
      facing: "unopened",
      raiseToAmount: 8,
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.verdict).toBe("good");
    expect(a.conceptTags).toContain("iso_raise_standard");
    expect(a.gtoClaim).toBe(false); // off-model — limpers aren't chart-modeled
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("isolation raise");
    expect(lower).toContain("limpers");
  });

  it("(iter-14 #5) still grades a TRUE first-in RFI fold-range hand off the chart (no limped-pot escape)", () => {
    // No limpers (pot is just the blinds) → the clean RFI chart applies and a junk open is still a ❌.
    const a = analyze({
      action: "raise",
      potBefore: 3, // SB 1 + BB 2 only — no limper
      toCall: 0,
      equityPct: 30,
      street: "preflop",
      hand: hand("7h", "2d"), // a hand the chart folds
      position: "UTG",
      facing: "unopened",
      raiseToAmount: 6,
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.gtoClaim).toBe(true); // chart applies — clean RFI spot
    expect(a.conceptTags).not.toContain("iso_raise_standard");
    expect(a.verdict).toBe("mistake");
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

  // iter-16 #3: a gross overbet is now EQUITY-AWARE. A LOW-equity / no-made-hand gross overbet is a
  // spew (clearly behind) — it grades a ❌ mistake so it tallies as a mistake, not "thin". A value/ahead
  // gross overbet (good equity or a made hand) keeps the ⚠️ "you're ahead, size down" treatment.
  it("(iter-16 #3) a LOW-equity postflop gross overbet (no made hand) grades a mistake, not thin", () => {
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 25, // clearly behind, no made hand — a spew
      street: "flop",
      numActiveOpponents: 1,
      hole: ["9c", "7d"],
      board: ["Ah", "Kd", "Qs"], // 9-high, no pair → no made hand
      raiseToAmount: 140, // 7× the pot — a gross overbet
    });
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.verdict).toBe("mistake"); // escalated from ⚠️ to ❌ — a low-equity spew
    expect(a.severity).toBeGreaterThanOrEqual(2);
  });

  it("(iter-16 #3) a VALUE/ahead postflop gross overbet still grades ⚠️ thin (unchanged)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 70, // clearly ahead — a value overbet
      street: "flop",
      numActiveOpponents: 1,
      hole: ["Ah", "Ad"],
      board: ["As", "7c", "2d"], // set — a real value bet
      raiseToAmount: 140, // 7× the pot
    });
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.verdict).toBe("thin"); // ahead but too big — keep the "size down" treatment
  });

  // iter-17 #1 WIDENS the iter-16 gate to EQUITY ALONE: a WEAK made hand at low equity that ships a
  // gross overbet is still a low-equity spew, so it now escalates to a ❌ mistake (the prior
  // `madeHand == null` carve-out wrongly spared exactly this case). Replaces the old iter-16 assertion
  // that a low-equity made-hand overbet stayed ⚠️ thin.
  it("(iter-17 #1) a low-equity MADE-hand gross overbet IS escalated to a mistake (equity-alone gate)", () => {
    const a = analyze({
      action: "bet",
      potBefore: 32,
      toCall: 0,
      equityPct: 18,
      street: "flop",
      numActiveOpponents: 5,
      hole: ["4s", "2s"],
      board: ["3s", "4c", "3d"], // two pair — a made hand, but still 18% multiway
      raiseToAmount: 160, // 5× the pot
    });
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.verdict).toBe("mistake"); // a low-equity spew, even with a (weak) made hand
    expect(a.severity).toBeGreaterThanOrEqual(2);
  });

  // iter-17 #1 — the reviewer's exact repro: 5♥5♠ (an underpair, ~9% equity) shoves a ~6×-pot overbet
  // on 9♦T♣7♦. The underpair counts as a made hand, which the old gate spared — now it grades a ❌
  // mistake and tallies as one. Issue #2: the value tag is dropped (no "Thin value" on a 9% hand) and
  // an "oversize_no_value" tag is added instead.
  it("(iter-17 #1,#2) the 5♥5♠ underpair 9%-equity 6×-pot shove grades a MISTAKE with no 'thin value' tag", () => {
    const a = analyze({
      action: "bet",
      potBefore: 25,
      toCall: 0,
      equityPct: 9,
      street: "flop",
      numActiveOpponents: 2,
      hole: ["5h", "5s"],
      board: ["9d", "Tc", "7d"], // an underpair to the board — a (weak) made hand
      raiseToAmount: 153, // ~6× the pot — a reckless overbet shove
    });
    expect(a.verdict).toBe("mistake"); // tallies as a mistake (HandRecap buckets off verdict)
    expect(a.severity).toBeGreaterThanOrEqual(2);
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.conceptTags).toContain("oversize_no_value");
    // No VALUE in a 9%-to-win overbet — the value tags must be gone.
    expect(a.conceptTags).not.toContain("made_hand_thin_value");
    expect(a.conceptTags).not.toContain("thin_value_good");
  });

  // iter-17 #1 — PRESERVE the value-overbet case: genuinely ahead (a set, 70%) keeps ⚠️ thin/oversized
  // and the value tag, so "you're ahead, size down" copy is unchanged.
  it("(iter-17 #1) a high-equity value gross overbet (a set, 70%) stays ⚠️ thin and keeps its value framing", () => {
    const a = analyze({
      action: "bet",
      potBefore: 20,
      toCall: 0,
      equityPct: 70,
      street: "flop",
      numActiveOpponents: 1,
      hole: ["Ah", "Ad"],
      board: ["As", "7c", "2d"], // a set — a genuine value overbet
      raiseToAmount: 140, // 7× the pot
    });
    expect(a.verdict).toBe("thin"); // ahead but too big — keep the "size down" treatment
    expect(a.conceptTags).toContain("oversize_bet");
    expect(a.conceptTags).not.toContain("oversize_no_value");
  });

  it("(iter-16 #3) a 100 BB shove of a fold-range hand (97o) grades a ❌ mistake, tallies as a mistake", () => {
    // The reviewer's repro: 97o shoved 100 BB into a $3 pot. The chart folds 97o from MP, so the
    // oversized open is a low-equity spew — a mistake, not "thin".
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 0,
      equityPct: 30,
      street: "preflop",
      hand: ["9c", "7d"], // chart folds 97o from MP
      position: "MP",
      facing: "unopened",
      raiseToAmount: 200, // 100 BB at $1/$2
      bigBlind: 2,
    });
    expect(a.conceptTags).toContain("preflop_oversize");
    expect(a.verdict).toBe("mistake");
    expect(a.severity).toBeGreaterThanOrEqual(2);
  });

  it("(iter-16 #3) an oversized open of a CHART-OPEN hand (AKs) stays ⚠️ thin, not a mistake", () => {
    const a = analyze({
      action: "raise",
      potBefore: 3,
      toCall: 0,
      equityPct: 67,
      street: "preflop",
      hand: ["Ah", "Kh"], // chart opens AKs from CO
      position: "CO",
      facing: "unopened",
      raiseToAmount: 40, // 20 BB — oversized
      bigBlind: 2,
    });
    expect(a.conceptTags).toContain("preflop_oversize");
    expect(a.verdict).toBe("thin"); // ahead, just too big — keep the ⚠️ "size down" treatment
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

  // ============================================================================================
  // iter-22 — SYSTEMIC preflop grading fix. The reviewer (docs/playtest/reviews/iter-22.md) hit two
  // MAJORs: (1) limped-pot / off-chart preflop OPENS were graded by the POSTFLOP aggression heuristic
  // → framed as "semi-bluff with no made hand that loses on a push" (nonsense preflop); (2) a cheap BB
  // CALL getting a clear price was graded ❌ "the math favors folding" while its own number (equity ≥
  // needed) said the opposite. Preflop decisions must be graded by PREFLOP yardsticks: position + the
  // chart for opens, POT ODDS for calls — never the postflop aggression heuristic.
  // ============================================================================================

  // (a) Hand 1: J9o CO open in a LIMPED pot (chart-fold hand), ≈ −1 BB EV → ⚠️ thin, NOT a mistake;
  // copy mentions position/strength, the correct "raise" verb, and contains NO postflop framing.
  it("(iter-22 MAJOR-1a) a marginally-loose CO open in a limped pot grades ⚠️ thin, not a mistake", () => {
    const a = analyze({
      action: "raise",
      potBefore: 5, // SB 1 + BB 2 + a 2 limp = 5 → a limped pot, off-model for the RFI chart
      toCall: 0,
      equityPct: 22, // the reviewer's J9o CO win% vs the table
      street: "preflop",
      hand: hand("Jh", "9c"), // J9o — the RFI chart folds this from CO (only J9s opens)
      position: "CO",
      facing: "unopened",
      raiseToAmount: 4,
      raiseToExtra: 2, // a min-raise → EV ≈ −0.5..−1 BB (the reviewer saw −$1), inside the thin band
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.verdict).toBe("thin"); // marginally loose, not a blunder (reviewer MINOR #4 severity)
    expect(a.conceptTags).toContain("loose_open");
    expect(a.gtoClaim).toBe(false); // off-model — limpers aren't chart-modeled
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("raising"); // correct verb — never "betting"/"push"
    expect(lower).toMatch(/loose|easily-dominated/); // a strength reason
    expect(lower).toContain("late position"); // a position reason
    expect(lower).not.toContain("semi-bluff");
    expect(lower).not.toContain("no made hand");
    expect(lower).not.toContain("push");
    expect(lower).not.toContain("betting");
  });

  // (a, Conceptual) the SAME spot at Conceptual depth gives a PLAIN, digit-free reason (reviewer
  // MAJOR-2) — never the old vague "raising with little behind it — there's not enough here".
  it("(iter-22 MAJOR-2) the loose-open Conceptual reason is plain and digit-free", () => {
    const a = analyze({
      action: "raise",
      potBefore: 5,
      toCall: 0,
      equityPct: 22,
      coachingDepth: "conceptual",
      street: "preflop",
      hand: hand("Jh", "9c"),
      position: "CO",
      facing: "unopened",
      raiseToAmount: 4,
      raiseToExtra: 2,
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.plainExplanation).not.toContain("%");
    expect(a.plainExplanation).not.toContain("$");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("too weak to raise"); // a real strength reason
    expect(lower).toContain("play poorly after the flop");
    expect(lower).not.toContain("little behind it"); // the old vague non-reason
    expect(lower).not.toContain("there's not enough here");
  });

  // (b) a clearly-junk loose open (low equity, clearly -EV) → ❌ mistake with PREFLOP framing.
  it("(iter-22 MINOR #4) a clearly-junk loose open grades ❌ mistake with preflop framing", () => {
    const a = analyze({
      action: "raise",
      potBefore: 5,
      toCall: 0,
      equityPct: 9, // 72o — genuine junk
      street: "preflop",
      hand: hand("7h", "2d"),
      position: "UTG",
      facing: "unopened",
      raiseToAmount: 6,
      raiseToExtra: 8, // clearly -EV (well beyond the −1.5 BB loose-open threshold)
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.verdict).toBe("mistake");
    expect(a.severity).toBe(2);
    expect(a.conceptTags).toContain("loose_open");
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("raising"); // still a RAISE, never "betting"/"push"
    expect(lower).not.toContain("semi-bluff");
    expect(lower).not.toContain("no made hand");
    expect(lower).not.toContain("push");
  });

  // (c) an open of a chart-open hand in a limped pot → ✅ good (a standard isolation raise).
  it("(iter-22) a chart-open hand opened in a limped pot grades ✅ good (iso raise)", () => {
    const a = analyze({
      action: "raise",
      potBefore: 5,
      toCall: 0,
      equityPct: 55,
      street: "preflop",
      hand: hand("Ah", "Qd"), // AQo — the RFI chart opens this from CO
      position: "CO",
      facing: "unopened",
      raiseToAmount: 8,
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.verdict).toBe("good");
    expect(a.conceptTags).toContain("iso_raise_standard");
    expect(a.plainExplanation.toLowerCase()).toContain("isolation raise");
  });

  // (d) Hand 4: BB CALL of $4 into a ~$32 pot (needs ~11%, equity ~18%) → NOT a mistake; the copy must
  // NEVER say "the math favors folding" when equity ≥ needed (the number would contradict the words).
  it("(iter-22 MAJOR-1b) a BB call getting a clear price is NOT a mistake (defers to pot odds)", () => {
    const a = analyze({
      action: "call",
      potBefore: 32,
      toCall: 4,
      equityPct: 18, // ≥ the ~11% the price requires
      street: "preflop",
      hand: hand("As", "7d"), // A7o — the BB-vs-raise chart FOLDS this, but the price supports calling
      position: "BB",
      facing: "raise",
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.verdict).not.toBe("mistake"); // the price is clearly met
    expect(a.conceptTags).not.toContain("call_too_wide");
    expect(a.gtoClaim).toBe(false); // chart's default is fold; we override by price, so no GTO claim
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).not.toContain("favors folding");
    expect(lower).toContain("win"); // the pot-odds price framing
  });

  // (e) a BB call CLEARLY below the price → still call_too_wide mistake, with an AGREEING number.
  it("(iter-22 MAJOR-1b) a BB call clearly below the price is still a call_too_wide mistake", () => {
    const a = analyze({
      action: "call",
      potBefore: 11,
      toCall: 8, // need 8/19 ≈ 42%
      equityPct: 18, // clearly below the price → folding genuinely is better
      street: "preflop",
      hand: hand("As", "7d"),
      position: "BB",
      facing: "raise",
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.verdict).toBe("mistake");
    expect(a.conceptTags).toContain("call_too_wide");
    // The number now AGREES with the verdict: 18% equity is well below the ~42% the price needs.
    expect(a.numbers.equityPct).toBeLessThan(a.numbers.potOddsPct ?? 100);
  });

  // (f) Hand 2: the borderline BB-equivalent fold (≈15% vs 14% needed) must STILL read "about
  // break-even … folding is fine" — the excellent existing borderline-price treatment is preserved.
  // (MP has no vs-raise chart, so a fold facing a 3-bet routes through the price/foldBranch.)
  it("(iter-22) the Hand-2 borderline fold (≈15% vs 14%) still reads break-even (not regressed)", () => {
    const a = analyze({
      action: "fold",
      potBefore: 68, // pot ~$79 after the $11 call; need 11/79 ≈ 14%
      toCall: 11,
      equityPct: 15, // a hair above the need → about break-even
      street: "preflop",
      hand: hand("4s", "7s"),
      position: "MP", // no vs-raise chart → graded by price, not the chart
      facing: "raise",
      bigBlind: 2,
      smallBlind: 1,
    });
    expect(a.verdict).toBe("good"); // a fine fold, not punished
    const lower = a.plainExplanation.toLowerCase();
    expect(lower).toContain("about equal"); // "calling and folding are about equal here, so folding is fine"
    expect(lower).toContain("folding is fine");
  });
});
