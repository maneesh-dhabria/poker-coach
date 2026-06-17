# Poker Coach — First-Time User Playtest Scratchpad

Running log. EMOTION lines flag notable moments.

## Setup screen (01-setup-screen.png)
- Clean dark poker-felt theme. Title "New Session". Clear sections: opponents, presets, coaching depth, starting stack, instant-feedback toggle, Deal.
- The opponents legend (TAG/LAG/Nit/Calling Station definitions) is a tiny gray line of run-on text at top of the Opponents box; cramped but has tooltips.
- EMOTION - mild confusion: "Number of opponents" dropdown defaults to 5 but the table-preset buttons (balanced/aggro/...) and per-bot style/skill are also shown. Unclear if picking a preset overrides my per-bot choices or vice versa. As a new user I don't know which wins.
- EMOTION - mild confusion: Coaching depth shows a one-line caption "Odds and reasons" under the selected option — but it's not obvious it changes per selection. Minor.
- Otherwise first impression is positive: looks intentional, not generic.

## Hand 1 (02-table-hand1.png) — I have K♣K♦ in CO
- Table is a nice oval. Banner shows Session ▲ $0 and Bank $3089. Toggle for $/BB on my stack.
- Bot4 (UTG) and Bot5 (MP) limp-called $2. Pot $7. "This round" log on felt shows their calls. Good.
- Bet slider defaults to $4 (min-raise). Half/¾/Pot sizing buttons present. Nice.
- EMOTION - happy: pocket Kings dealt first hand, table reads clearly. I know exactly what to do.
- Plan: raise to pot to punish limpers.
- Raised to $9. ✅ Good "chart-based" verdict appeared instantly. Equity bar: "You win ~42% · need ~22%". Plain sentence. Good.
- Bot1(BTN) called, blinds folded/checked, UTG+MP called. Flop K♠T♠5♣ — I flopped TOP SET. EMOTION - delighted.
- On flop UTG bet $45, MP called. Pot $144. I face $45. Action: Fold / Call $45 / Raise to $90.
- EMOTION - confused (MINOR/MAJOR): The Live Feedback panel STILL shows my PREFLOP verdict (42% equity, "pot was $7 when you acted") even though I'm now facing a flop decision. A new user reading the panel while deciding the flop sees stale preflop numbers. The verdict only updates AFTER I act, so during the decision the panel describes the previous street. Confusing — feels like it should reflect the current spot or clearly say "decision pending".
- Opened "Mental Math" + "Show the numbers" (04-mentalmath-expanded.png, 05-dollarEV.png):
  - "Show the numbers" (preflop block): Average result if you fold $0 / call $1.8 / raise $2.3. "long-run averages, not this one hand."
  - Mental Math (current flop): "No clear drawing outs detected — you may already have the best hand, or be drawing thin." "CHECK YOUR WORK: True win = 79%." "Show the dollar EV" -> "Calling is worth about $104 on average (based on the true equity)."
  - NOTE: after I ACT, the panel updates correctly to the flop verdict (78% equity, "pot was $144 when you acted") and the EV numbers update (call $101.5 / raise $161.2). So the staleness is only DURING the pending decision. Still worth flagging.
  - EMOTION - confused (MAJOR): Conflicting numbers on the same screen. The preflop "Average result if you call: $1.8" sits right above the flop's "Calling is worth about $104." Both are dollar EVs, no clear labeling that one is preflop/historical and the other current-flop. Also two different win%s visible at once (42% vs 79%). A new user cannot tell which number applies to the decision in front of them.
- Raised flop to $189 (nearly all-in, stack to $2). All bots folded except Bot5 (MP) checked. Turn 8♣. I jam last $2. Bot5 calls all-in with 9♦8♥.
- Hand resolves at turn — board shows K♠T♠5♣8♣ only, NO river dealt, settles immediately because both all-in. (06-hand1-turn.png)
- EMOTION - mild surprise/underwhelmed (NIT): When everyone is all-in the app does not "run out" the remaining board card(s). It just declares the winner with the turn showing. Minor — equity is locked anyway — but a poker player expects to SEE the river fall. Slightly anticlimactic.
- Won with "Three of a Kind, Kings." Seat shows ALL-IN $200 badge + green +$281. Banner updates: Session ▲ $281, Bank $3370. Result line "you won $281." Math checks out (pot $481 - $200 in = $281). 3 good · 0 mistakes. EMOTION - happy: clear, correct, satisfying payoff.
- NIT: "Mental Math" after hand over says "Deal a hand and reach the flop to use Mental Math." while a completed turn verdict is shown above it — slightly odd but harmless.

## Tabs explored (07-coaching-tab.png, 08-references-tab.png, 09-chart-AA.png)
- Coaching tab: "No coaching yet" + clear instructions to run /poker-coach last|session in terminal + Refresh button. Good onboarding, sets expectations.
- References tab: Hand rankings (1-9, with examples) — clean and accurate. Below it a Preflop chart: 13x13 grid, green=raise/red=fold, Position dropdown (UTG/MP/CO/BTN/SB/BB), defaults to BTN. Clicking a cell gives a caption ("Pick a hand to see how it plays from BTN").
- EMOTION - mildly surprised (NIT): References > Preflop chart defaults to BTN even though I'm seated in CO. Would expect it to default to my current position, or at least it's a missed convenience.
- Charts look reasonable; a few wide/loose BTN entries (74s raise, 53s raise) but defensible for button. No clear bug.

## Hand 2 (10-hand2-fold.png) — 4♥3♥ in MP, trash hand
- Bot5 limped. I folded. Verdict: "✅ Good chart-based — chart says fold 4♥3♥ from MP, that's standard." Equity "You win ~15% · need ~29% — you come up short, so this loses money." Consistent and correct.
- EMOTION - delighted: After I fold, the app REVEALS all bots' hole cards and runs the board out (J♣5♣3♣T♥4♣). Great for learning what would've happened. Bot5 (A♣2♠) won with nut flush — folding was right. This is a genuinely nice feature.
- NIT: result line reads "Result: you won $0" after a FOLD. Wording slightly off — I folded, didn't "win." Net $0 is accurate but "won $0" jars.

## Hand 3 (11-hand3-A2s-raise.png, 12-mentalmath-full.png) — A♥2♥ in UTG, deliberate loose raise
- Raised to $4 from UTG. App correctly flagged: "❌ Mistake, chart-based — chart says fold A♥2♥ from UTG; your line differs." Tags "preflop chart deviation" / "call too wide". Equity 21% vs need 40%. Hand review shows "0 good · 0 thin · 1 mistake." EMOTION - happy: the mistake detection works and the wording is firm but not preachy.
- Flop 4♥A♣3♦. I now have TOP PAIR (pair of aces, A2) PLUS a gutshot (need 5 for wheel). Bot5 bet $12, pot $32.
- The Mental Math 6-step walkthrough opened. CONTENT PROBLEM:
  - Step 1 "Your outs": "Inside straight (gutshot) — needs a 5 → 4 outs". It treats my hand as ONLY a draw and ignores that I already have top pair of aces.
  - Step 2: ×4 → ~16% to hit. Step 3: shade to ~11-14%. Step 5: need ~27% (call $12 into $44). Step 6 CONCLUSION (bold): "About 13% to win can't pay the 27% price — the price is too steep." => steers user to FOLD.
  - BUT "Check your work": "You hit ~16% · True win ≈ 47%." And it says the 16.5%-vs-47% gap is "the opponents + board danger (Steps 3 & 4)."
  - EMOTION - confused / concerned (MAJOR): The headline plain-language math (13% < 27%, "price too steep") tells a beginner to fold what is actually a 47%-equity hand (top pair + gutshot) — a clear, profitable call. The true equity (47%) flatly contradicts the step-by-step verdict (13%, fold). The "Check your work" note even surfaces the contradiction but MISATTRIBUTES it to "opponents + board danger," when really the steps just forgot I have a made pair. For a tool whose whole pitch is plain-language coaching for a non-math user, the prominent heuristic conclusion is actively misleading here. This is the most serious issue I found.
  - CONFIRMED contradiction: I called $12. The resolved FLOP verdict then read "✅ Good ... Your hand wins ~48%. Easy call — you're getting a great price." So the app's OWN post-action verdict (48%, easy call) directly contradicts the pre-action Mental Math conclusion it had just shown (13%, "price too steep"). Two opposite recommendations from the same panel for the same decision. The Mental Math outs-only model never accounts for a made pair.
- Turn 4♦ (board now 4♥A♣3♦4♦; I have two pair, aces & fours). Mental Math AGAIN: "gutshot needs a 5 → 8% to hit," "True win ≈ 67%," gap blamed on "opponents + board danger." Same outs-only blind spot ignoring my two pair. It's checked to me free so Step 6 correctly says "free card — just take it."
- NOTE: "Check your work" gap-explanation text ("that gap is the opponents + board danger") appears to be a fixed template — it gave the same explanation when the gap was actually caused by my made hand, not opponents. Misleading template.
- Checked the turn. NEW contradiction: turn CHECK flagged "❌ Mistake — value bet missed: You win ~66%, checking gives up value." But the Mental Math I'd just been shown for that exact turn decision said "It's a free card — just take it" (Step 6). So the pre-decision Mental Math said CHECK, the post-decision verdict said checking is a MISTAKE. Directly contradictory guidance again, same decision. (Hand review now: 1 good · 0 thin · 2 mistakes.)
- EMOTION - irritated (MAJOR): The Mental Math coach and the verdict engine give OPPOSITE advice on the same decisions, repeatedly (flop fold-vs-call, turn check-vs-bet). A beginner following the prominent Mental Math walkthrough would rack up "mistakes" by the app's own scorer. The two systems are not reconciled.
- River Q♥. Value bet $42 (¾ pot) — ✅ Good (70%). Bot2 called, Bot5 RAISED to $154. I face Call $112.
- Called $112. Verdict ✅ Good "call correct price — costs $112 to win $406, need ~28%, your hand wins ~71%. Easy call." Clear pot-odds explanation.
- Showdown (13-hand3-showdown.png): Bot2 6♠7♥ lost. Bot5 A♦3♠. Board 4♥A♣3♦4♦Q♥. Both me (A♥2♥) and Bot5 play AA44+Q = CHOP. Both seats show +$89; pot split handled correctly. Session ▲ $370, Bank $3459.
- EMOTION - delighted: closing line is great coaching: "You won this hand, but the ❌ above flags a play that loses money on average — results swing hand to hand, so we grade the decision, not the outcome." Exactly the right message; results-vs-decisions separation.
- Final hand review: 3 good · 0 thin · 2 mistakes (preflop loose raise + turn missed value bet). Scoring is consistent and the per-street log is excellent.

## $/BB toggle (14-bb-toggle.png)
- Clicking the stack value toggles all table+banner numbers to big blinds (285.0 BB, Session 185 BB, pot in BB). Works well.
- NIT: only the table/banner toggle to BB; the Live Feedback panel text stays in dollars ($112 / $406). Mixed units on screen at once. Minor.
- NIT: the action/bet buttons ("Raise to $4", "Pot", "$4") always show dollars even in BB mode.

## Responsive / resize testing
- 1024x640 (15-resize-1024x640.png): GOOD. Table left, coaching right, action bar bottom, all controls visible and usable. No overlap.
- 800x600 (16-resize-800x600.png): BROKEN.
  - EMOTION - irritated / blocked (MAJOR): The bottom action bar is CLIPPED on both edges. The left button (Fold/Check) is sliced to a thin half-circle and the right "Raise to $4" button is sliced to a sliver — both partly off the left/right edges of the viewport. A user at this width cannot reliably click their primary actions.
  - EMOTION - confused (MAJOR): The "THIS ROUND" action-log overlay sits ON TOP of the "You" seat and the UTG/Bot1 seat — text overlaps and my hole cards + "You" label are partially hidden behind the log box. Seats and the central log collide.
  - The table does not reflow to a narrower layout; it keeps a fixed oval that the viewport can't contain, so center elements stack/overlap.
- 1366x500 (short, 17-resize-1366x500-short.png): action bar OK and fully visible, but the "THIS ROUND" log overlaps the You/Bot5 center seats when height is constrained. MINOR (overlap) — controls still usable.
- 600x900 (tall/narrow, 18-resize-600x900-tall.png): BROKEN.
  - EMOTION - blocked (MAJOR): Primary action buttons (Fold/Check, Pot, Raise) are clipped off the right edge — only the slider + ½/¾ show. You literally cannot act.
  - Left seats (Bot1/Bot2) are clipped off the LEFT edge of the viewport ("t_ BB", "ll $2").
  - "THIS ROUND" log overlaps Bot5 seat.
  - Massive wasted empty space: coaching panel + lower 40% of screen are blank while the table is cramped into a clipped fixed-width oval on the left. No responsive reflow at all below ~1000px.

## Other controls / behaviors
- "New table" resets Session P&L to 0 BB, keeps Bank, reseats and deals a fresh hand. "New session" returns to the setup screen. "New hand" deals the next hand. The 3-button distinction is implicit but discoverable. BB/$ toggle state persists across New table/New session — good.
- Console: zero JS errors across the whole session. Only a 404 for /favicon.ico (NIT: missing favicon).
- Instant feedback OFF (19-feedback-off.png, 20-feedback-off-afterfold.png): during play the right panel is blank (no "Make your move" prompt, just empty tabs — could look broken to some). BUT after the hand the "Hand review" summary STILL appears. NIT: a user who turned feedback off may be mildly surprised the post-hand review still shows; also the blank panel during play gives no hint it's intentionally off.
- The bots are entertaining and aggressive (big multiway all-ins, full houses). Watching folded hands run out is a genuine plus.
- MINOR: even at 1366x768 the multi-row "THIS ROUND" log (when 5-6 entries) sits very close to / slightly over the "You" seat at center-bottom. Borderline but readable at this size; gets worse as the window shrinks.

## SUMMARY

### Negative findings (numbered, with severity)
1. (MAJOR) Mental Math walkthrough contradicts the verdict engine. On a 4A3 flop holding A2 (top pair + gutshot), the prominent 6-step Mental Math concluded "~13% to win can't pay the 27% price — the price is too steep" (i.e. FOLD), while true equity was ~47% and the app's own post-action verdict called it an "Easy call." The outs-only Mental Math model ignores made pairs entirely. (Screens: 11, 12.)
2. (MAJOR) Same contradiction repeats on the turn: Mental Math said "It's a free card — just take it" (CHECK), but checking was then graded "❌ Mistake — value bet missed (~66%)." Pre-decision coach and post-decision scorer give opposite advice on the same spot. (Snapshot logged.)
3. (MAJOR) "Check your work" gap-explanation is a misleading fixed template: it attributes the hit%-vs-win% gap to "opponents + board danger" even when the gap is actually because the player already has a made hand. Wrong causal explanation for a plain-language teaching tool.
4. (MAJOR) Layout breaks at narrow widths. At 800x600 and 600x900 the primary action buttons (Fold/Check/Raise) are clipped off the viewport edges — you cannot reliably act. Table does not reflow below ~1000px. (Screens: 16, 18.)
5. (MAJOR) During a pending decision, the Live Feedback panel shows the PREVIOUS street's verdict and equity (e.g. preflop 42% while I'm deciding the flop) plus two different EV/win% numbers at once (preflop "call $1.8" sitting above flop "call ~$104"; 42% above 79%). A new user can't tell which number applies to the decision in front of them. (Screens: 03, 04, 05.)
6. (MINOR) Center "THIS ROUND" action log overlaps the "You"/center seats; mild at 1366x768, worse as height/width shrink (overlaps seats at 1366x500 too). (Screens: 17, 20.)
7. (MINOR) Mixed units: toggling to BB only converts the table/banner; the Live Feedback text and all action/bet buttons stay in dollars. Both unit systems on screen at once. (Screen: 14.)
8. (MINOR) Instant-feedback OFF leaves the right panel blank during play with no indication it's intentional (could read as broken); and the post-hand Hand review still appears despite feedback being off. (Screens: 19, 20.)
9. (NIT) Result line reads "Result: you won $0" after a FOLD — folding isn't "winning $0." (Screen: 10.)
10. (NIT) References > Preflop chart defaults to BTN regardless of my actual seat (was in CO). (Screen: 08.)
11. (NIT) Setup screen: unclear whether a table "preset" overrides per-bot style/skill choices or vice versa. (Screen: 01.)
12. (NIT) All-in hands do not "run out" the remaining board card(s); the hand settles with the turn showing. Anticlimactic for a poker player. (Screen: 06.)
13. (NIT) Missing favicon (404 on /favicon.ico).

### Positive highlights
- Clean, intentional dark poker-felt design; clear setup screen; nice oval table.
- Instant verdicts fire immediately and read well (✅ Good / ❌ Mistake with tags + plain sentence + equity bar + pot-odds explanation).
- Excellent results-vs-decisions message after a winning hand with a flagged mistake ("we grade the decision, not the outcome").
- Revealing opponents' hole cards and running the board out after you fold is a genuinely good learning feature.
- Mistake detection works correctly (loose UTG open, missed value bet).
- Pot split (chop) handled correctly; net P&L and bank math all checked out.
- Coaching tab onboarding is clear; References (hand rankings + preflop chart grid) are accurate and useful.
- Holds up well at 1366x768 and 1024x640; zero JS console errors.

(No part of this review is based on reading source code — only on observed browser behavior.)









