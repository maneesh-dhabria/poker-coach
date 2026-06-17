# Playtest iter-03 — First-time user

Scratchpad. Format: `EMOTION - <feeling> - <description>`

EMOTION - pleased - Setup screen ("New Session") is clean and welcoming. Number of opponents defaults to 5 (true 6-max). Table presets row (balanced/aggro/passive/reg-heavy) with a helpful explainer paragraph about how presets vs custom work.
EMOTION - pleased - Opponent style glossary at top (TAG/LAG/Nit/Calling Station) with hover tooltips and plain-language descriptions — great for a newcomer who doesn't know jargon.
EMOTION - pleased - Coaching depth radio (Conceptual / Equity+Heuristics / Strict charts) with a one-line subtitle "Odds and reasons" for the selected option. Starting stack 50/100/200 BB with a clear "$1/$2 — 1 BB = $2, so 100 BB = $200" note. Instant feedback checkbox checked by default.
EMOTION - neutral - Screenshot iter03-setup.png captured.
EMOTION - pleased - Coaching depth subtitle updates live as I switch: Equity+Heuristics="Odds and reasons", Conceptual="Plain words, no numbers", Strict="(charts)" variant. Good signposting.
EMOTION - pleased - Clicking "aggro" preset worked silently (refs reshuffled). Will start hand 1 on Conceptual depth + instant feedback ON.

## Hand 1 — CO with 9d3c, facing Bot5 raise to $7
EMOTION - pleased - Table layout clean: my seat highlighted (You, CO, $200), 5 bots around, dealer button on Bot1 BTN, blinds posted ($199 SB, $198 BB), pot $12, "This round" summary lists Bot4 Call $2 / Bot5 Raise $7. Action buttons: Fold / Call $7 / bet slider with ½ ¾ Pot presets / Raise to $12.
EMOTION - pleased - Three coaching tabs. Coaching tab has a clear empty state explaining the /poker-coach terminal command. References tab is excellent: full hand-ranking reference with suit examples, plus an interactive 13x13 preflop chart with a Position dropdown auto-set to CO (matching my seat).
EMOTION - delighted - Clicked my actual hand 93o in the chart: it reads "93o — Fold from CO", red cell = fold. A newcomer can self-check their preflop decision against the chart. Position pre-selected to my seat is a thoughtful touch.
EMOTION - neutral - Minor: the green badge near Bot4 in the screenshot renders small/hard to read; the snapshot confirms it is "Call $2" (round summary agrees). No contradiction, just a small rendering note.
EMOTION - delighted - Folded 93o. Conceptual feedback: "✅ Good / good preflop discipline" + plain sentence with NO numbers ("Calling would cost more than this hand can win back...") — exactly matches the Conceptual depth promise of "plain words, no numbers". Hand-review tracker shows "1 good · 0 thin · 0 mistakes".
EMOTION - pleased - After my fold the bots auto-played the hand to a board (pot grew to $421). Mental Math expander shows a graceful note: "Hand complete — the live math has cleared... Mental Math comes back on the next flop."
EMOTION - pleased - Result line correct: "no money won or lost this hand" (I folded preflop). Points me to /poker-coach last for a deeper write-up.

## Hand 2 — MP with Qs3s; testing BB/$ unit toggle
EMOTION - delighted - Stacks carried over like a real cash game: Bot2 (won the last pot) sits on $421 while others ~$192-198. Positions rotated correctly (button moved). Strong sense of continuity.
EMOTION - confused - I RAISED to 2 BB (Qs3s, MP). Verdict: "❌ Mistake / chart-based / preflop chart deviation / **call too wide**". The tag says "call too wide" but I did not call — I raised. The hand-review line correctly reads "you raised to 2 BB", so the verdict tag contradicts the action it is judging. A newcomer reading "call too wide" after clicking Raise would be confused. (CONTRADICTION)
EMOTION - confused - I am on CONCEPTUAL depth ("plain words, no numbers"), yet the verdict surfaces a "chart-based" badge and a "preflop chart deviation" tag — chart language I'd only expect in Strict (charts) mode. The prose itself ("This differs from the standard baseline line for this spot") is plain, but the chart-flavored labels feel like they leak from a different depth. Will confirm by replaying the same spot in Equity+Heuristics / Strict. (possible depth bleed)
EMOTION - neutral - Mental Math under a preflop mistake shows a sensible note: "The Rule of 2 & 4 is for the flop and turn. For preflop, see the Preflop Chart tab."
EMOTION - delighted - BB/$ toggle is fully consistent. After toggling to BB: Session 0 BB, Bank 1329.5 BB (=2659/2), Pot 1.5 BB (=3/2), my stack 100 BB (=$200), Bot2 210.5 BB (=421/2), Call 1 BB, Raise to 2 BB. EVERY number on screen switched together — no mixed BB/$ anywhere. Screenshot iter03-h2-bb-units.png.
EMOTION - pleased - Flop check (board 2h7h6c) verdict: "✅ Checking is fine — you're not strong enough to bet for value." Plain, correct, action-matches.
EMOTION - pleased - Turn bet 25 BB (semi-bluff, gutshot) verdict: "❌ You're betting with little behind it — there's not enough here." Plain language, action-correct ("you bet 25 BB").
EMOTION - delighted - ALL-IN badge works: on the river Bot3 went all-in and its seat showed "ALL-IN 61.5 BB" with 0 BB stack. Clear.
EMOTION - misled - River fold verdict header correctly says "Your river decision · pot was 298 BB", BUT the tag underneath reads "**good preflop discipline**" — this was a RIVER fold, not preflop. The canned "good preflop discipline" tag is reused on a river decision. (CONTRADICTION — tag vs street)
EMOTION - misled - That same river-fold explanation reads "Calling would cost more than this hand can win back... the pot isn't big enough to make the call worth it." Facing 61.5 BB into a 298 BB pot, the pot is actually huge; the honest reason to fold is my hand (Q-high) has almost no equity. Telling a newcomer "the pot isn't big enough" here is misleading and could teach the wrong concept. (MISLEADING)
## Hand 3 — heads-up vs Calling Station, Equity+Heuristics depth, 50 BB
EMOTION - delighted - Depth difference CONFIRMED. On Equity+Heuristics the preflop raise verdict now includes a number: "Betting for value with ~52% is good — get money in while ahead." vs Conceptual's number-free prose. The depth setting genuinely changes the explanation.
EMOTION - confused - Raise labeling is inconsistent. I clicked the button "Raise to 2 BB" (total-to semantics), but the round summary and hand review both say "You Raise 1 BB" / "you raised to 1 BB" (increment semantics). Same word "raised to" but 2 vs 1. A newcomer who clicked "Raise to 2 BB" then reads "you raised to 1 BB" will think the app misrecorded their action. (CONTRADICTION/labeling)
EMOTION - confused - Community-card board LAGS one street behind the action. When the panel said "Deciding your flop" the board showed just "—" (no flop cards) even though preflop was closed and pot was 4 BB. After I bet, the panel said "Deciding your turn" and the board then showed only the 3 flop cards (A♥2♦K♦) — i.e. the flop appeared only once we were on the turn, and the turn card was not yet shown. The visible board is always one street stale, so I'm acting without seeing the card(s) for the street I'm on. Screenshots iter03-h3-flop.png (board "—" on flop) and iter03-h3-afterbet.png (3 cards on turn). (MAJOR — can't see the cards I'm betting into)
EMOTION - pleased - "Thin" verdict category works: flop bet got "⚠ A thin bet with ~47% — fine as value or a semi-bluff, but it's marginal" and tracker shows "1 good · 1 thin · 0 mistakes". Three-way good/thin/mistake bucketing is a nice touch.
EMOTION - neutral - Soft doubt: Q7o on an A-2-K flop being quoted ~47% equity feels high for queen-high with no pair/draw; may be the wide calling-station range heads-up. Not verifying deeply, just noting.
EMOTION - confused - Board lag confirmed reproducibly across all 3 streets: "flop" -> 0 cards, "turn" -> 3 cards (flop), "river" -> 4 cards (flop+turn). The community board is always exactly one street behind the action panel. I made flop/turn/river decisions without seeing that street's card on the table. (MAJOR)
EMOTION - delighted - Equity+Heuristics river verdict is rich: an equity bar, "You win ~32% · need ~0%", "vs a typical opponent range", and a "Show the numbers" expander revealing an EV table: fold 0 BB / call 2.6 BB / raise -0.3 BB, with "Higher is better — long-run averages, not this one hand." The EV table is genuinely excellent and clearly explains why the bet was bad.
EMOTION - misled - But the SAME panel contradicts itself. Headline: "You win ~32% but only need ~0% — that gap is why continuing makes money over time" (sounds like a profitable bet), while the verdict is "❌ Mistake ... there's not enough behind it" and the EV table shows raise = -0.3 BB (a LOSS). "need ~0% ... makes money over time" is call/draw pot-odds template text mis-applied to a river bluff-bet; it directly contradicts the Mistake verdict and the -0.3 BB EV in the same view. A newcomer gets opposite messages at once. (MAJOR contradiction)
EMOTION - confused - The EV table offers "Average result if you call: 2.6 BB" as the best line, but on the river nobody had bet into me — there was no "call" available, only check/bet. Labeling the best option "call" when calling wasn't possible is confusing (probably means "check/take showdown"). (MINOR)
## Hand 4 — Strict (charts) depth, instant feedback OFF
EMOTION - pleased - Instant-feedback OFF behaves exactly as promised: the big verdict/equity block is replaced with a clear note "Instant per-decision verdicts are off... you'll still see the running hand review below... Turn it back on from New session." The hand-review list still populates. Good honoring of the setting.
EMOTION - pleased - Strict depth subtitle on setup reads "Chart-based, preflop GTO"; stack note updated to "50 BB = $100".
EMOTION - confused - Depth-to-wording mapping looks inconsistent across the three modes for the SAME preflop-raise action: Conceptual (h2) showed chart language ("This differs from the standard baseline line") + a "chart-based" badge — despite Conceptual promising "plain words, no numbers"; Equity+Heuristics (h3) showed "~52%"; Strict (h4) ALSO showed an equity number ("~57%") even though Strict promises chart-based/GTO wording. So Conceptual leaks chart talk and Strict shows equity %s — the per-street review wording does not reliably track the selected depth. (MINOR/MODERATE — undercuts the depth feature's promise)

EMOTION - pleased - Showdown rendered fully: all 5 board cards shown, "Bot 1 wins with Pair of Fours", my seat chip "-5 BB", pot 10 BB. Result line "you lost 5 BB"; header SESSION -5 BB and Bank 1289.5 BB (=1294.5-5). All consistent. Thin verdicts on flop/turn (~47%, ~39%) escalating to Mistake on river (~32%) is a sensible progression.

## Window-size testing (6-max table, feedback ON)
EMOTION - pleased - 1366x768 (desktop): clean. All 6 seats, center pot, bottom action bar, right coaching panel — no clipping or overlap. Screenshot iter03-size-1366x768.png.
EMOTION - annoyed - 800x600 (split-screen): the hero ("You") seat OVERLAPS the center "Pot: 3.5 BB" label — the gold pot text is partially hidden behind the top edge of the hero card box. This is the exact pot-vs-hero overlap to watch for. Buttons still reachable and all seats present, but it looks broken. Screenshot iter03-size-800x600.png. (MAJOR — visual overlap, pot text obscured)
EMOTION - annoyed - 600x900 (narrow/tall): overlap is worse. The "THIS ROUND" summary box (Bot4/Bot5 Call 1 BB) overlaps the top of the hero "You" seat — the "Bot 5 Call 1 BB" line is partly hidden behind the hero card box, and "Pot: 3.5 BB" is cramped against Bot 3's seat above. Center pot + round-summary collide with the hero seat. All seats and action buttons remain visible/usable. Screenshot iter03-size-600x900.png. (MAJOR — round-summary/pot overlap hero seat)
EMOTION - pleased - 1280x520 (short/wide): holds up well. All 6 seats, center pot/round-summary, hero seat below, full action bar at bottom, coaching panel right. Hero seat sits close to the round-summary but readable; no clipping or hard overlap. Screenshot iter03-size-1280x520.png.
## Console / runtime errors
EMOTION - annoyed - The browser console logged a repeated uncaught runtime error: "ReferenceError: resultLine is not defined" at components/HandRecap.tsx:241, plus React error-boundary recovery messages. The stack references HotReload/react-refresh, so it likely fired during a dev hot-reload rather than a clean play action — but it is a genuine latent bug in the end-of-hand recap (an undefined variable on some render path) that could blank/crash the recap. I did NOT see a visible crash; subsequent recaps rendered fine. Also one benign 404 for /favicon.ico. (MINOR-to-MAJOR latent bug — recap render can throw)
EMOTION - pleased - Re-confirmed after the errors: completing a hand (fold) still renders a correct chart-based fold verdict + equity bar + hand review with no visible crash. Depth wording was correctly chart-based here because the session inherited Strict depth.

EMOTION - neutral - Net: the table layout degrades only at narrow/small widths (800x600 and 600x900) where the centered pot + round-summary box overlap the hero seat. Wide layouts (1366x768, 1280x520) are clean. Nothing was ever fully clipped off-screen; all action buttons and seats stayed reachable at every size.

## SUMMARY

Overall this is a polished, genuinely helpful app for a newcomer: clear setup with jargon tooltips, a clean table, an interactive preflop chart + hand-ranking reference, a good/thin/mistake hand tracker, an excellent expandable EV table, perfectly consistent BB/$ unit toggle, and well-behaved instant-feedback and depth toggles (mostly). The negatives below are real and several would confuse or mislead a beginner.

NEGATIVE MOMENTS (by severity):

(MAJOR) Community-card board lags one full street behind the action. When the panel says "Deciding your flop" the board shows 0 cards ("—"); on "turn" it shows only the 3 flop cards; on "river" only 4 cards. Reproduced across an entire hand. The player makes flop/turn/river decisions without seeing that street's card on the table. (Hand 3; iter03-h3-flop.png, iter03-h3-afterbet.png)

(MAJOR) Self-contradicting river feedback. The river bet was marked "❌ Mistake ... there's not enough behind it" and the EV table showed raise = -0.3 BB (a loss), yet the same panel's headline read "You win ~32% but only need ~0% — that gap is why continuing makes money over time," which says the bet is profitable. Opposite messages in one view; "need ~0%" is call/draw pot-odds template text mis-applied to a bet. (Hand 3; iter03-h3-shownumbers.png)

(MAJOR) Table layout overlap at small/narrow window sizes. At 800x600 the hero "You" seat overlaps and hides the center "Pot" label; at 600x900 the "THIS ROUND" summary box overlaps the top of the hero seat (a "Call 1 BB" line is partly hidden) and the pot is cramped against a bot seat. Wide sizes are fine. (iter03-size-800x600.png, iter03-size-600x900.png)

(MINOR/MAJOR) Latent runtime bug in the recap: console logged repeated "ReferenceError: resultLine is not defined" at components/HandRecap.tsx:241 with React error-boundary recovery. Tied to a hot-reload in this session and never produced a visible crash, but it is a real undefined-variable on a recap render path that could blank/crash the end-of-hand recap.

(MINOR) Verdict tag contradicts the action it judges. After I RAISED to 2 BB preflop, the verdict tag read "call too wide" (I did not call). After a RIVER fold, the verdict tag read "good preflop discipline" (it was the river, not preflop). The canned tags don't match the actual street/action. (Hands 2; iter03-h2-mistake.png)

(MINOR) Misleading fold rationale on a big pot. Folding Q-high to an all-in on the river was explained as "the pot isn't big enough to make the call worth it" — but facing ~61 BB into a ~298 BB pot the pot is huge; the honest reason is my hand has almost no equity. Teaches the wrong concept. (Hand 2)

(MINOR) Raise labeling inconsistency. I clicked the button "Raise to 2 BB" (total-amount semantics) but the round summary and hand review both record "Raise 1 BB" / "you raised to 1 BB" (increment semantics). Same "raised to" phrasing, different number (2 vs 1) — looks like the app misrecorded my action. (Hands 2 & 3; iter03-h3-eqfeedback.png)

(MINOR/MODERATE) Coaching-depth wording doesn't reliably track the selected depth. For the same preflop-raise action: Conceptual ("plain words, no numbers") surfaced chart language and a "chart-based" badge; Strict ("chart-based, preflop GTO") instead showed an equity percentage ("~57%"). So Conceptual leaks chart talk and Strict shows equity — undercutting the depth feature's promise. (Hands 2 & 4)

(MINOR) EV table offers a "call" line when calling isn't an available action. On the river with no bet facing me (only check/bet), the "Show the numbers" table listed "Average result if you call: 2.6 BB" as the best option — confusing since I couldn't call. (Hand 3)

(NIT) Equity figure looks high: Q7-offsuit on an A-2-K flop quoted ~47%. Plausibly due to the wide heads-up calling-station range, but it reads surprisingly high for queen-high with no pair/draw. (Hand 3)

(NIT) Benign 404 for /favicon.ico in the console.

EMOTION - pleased - Result accounting correct: "you lost 35 BB" (=2+8+25 invested), header flipped to Session ▼ -35 BB and Bank 1294.5 BB (=1329.5-35). Showdown shown at center (Bot3 won). All math consistent.

