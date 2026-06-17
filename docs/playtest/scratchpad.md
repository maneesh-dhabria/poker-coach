# Poker Coach — First-Time User Playtest Scratchpad

I am a first-time user. I know how to play Texas Hold'em (basics: hand rankings, betting,
position roughly) but I know **nothing** about how *this app* works. I'm narrating my honest,
in-the-moment experience. Emotional moments are tagged `EMOTION - ...` with a screenshot.

---

## Round 1 — First contact

### Landing / setup screen (screenshot 01-landing.png)
- Title "New Session". Clean, dark, poker-green. Looks calm and uncluttered. Good first impression.
- "Number of opponents: 5" dropdown. Fine.
- "Table presets: balanced / aggro / passive / reg-heavy" — I can roughly guess these but I'm
  not 100% sure what each does to the table. No tooltip/description visible.
- **Opponents** list: Bot 1–5 each has a style ("TAG", "Nit", "LAG", "Calling Station") and a
  skill ("Advanced/Intermediate/Beginner").
  - EMOTION - Mildly confused: "TAG", "LAG", "Nit" are poker jargon. I know poker basics but
    these abbreviations aren't explained anywhere on screen. A true beginner wouldn't know
    TAG = tight-aggressive, LAG = loose-aggressive, Nit = ultra-tight. "Calling Station" is the
    only one that reads in plain English. No tooltips. (screenshot 01-landing.png)
- **Coaching depth**: Conceptual / Equity + Heuristics / Strict (charts). The little subtitle
  "Odds and reasons" under the selected one helps. "Heuristics" is a slightly fancy word but ok.
- **Starting stack**: 50/100/200 BB. Fine if you know poker (BB = big blinds).
- "Show instant feedback after each of my decisions" checkbox — clear and inviting.
- A 404 for /favicon.ico in console (harmless, but a missing favicon).

I'll keep the defaults and click **Deal** to see what happens.

### The table appears (screenshots 02 / 03)
- EMOTION - Irritated (layout): On first load the table rendered tiny in the top-left and the
  **action buttons (Fold / Call / Raise) were cut off** below the fold. I only saw them after I
  manually resized the window bigger. A first-time user on a laptop might not realize they can
  act at all. The table doesn't seem to scale to fit smaller viewports. (screenshot 02-table-dealt.png)
- Once resized I can see: an oval table, 5 bots + "You", a Pot ($5) chip area, and the action
  bar: **Fold / Call $2 / [slider ½ ¾ Pot] $4 / Raise to $4**.
- My seat: "You — CO" with K♦ 4♥, $200 stack. Positions shown as BTN/SB/BB/UTG/MP/CO tags. Good
  that position is labeled (helps a learner).
- A small box reads "THIS ROUND — Bot 5 Call $2". Bot 5 also has a green "Call $2" badge. Slightly
  redundant but informative.
- EMOTION - Underwhelmed: The entire right ~40% of the screen is the **"Live Feedback" panel and
  it's totally empty** before I act — just three tabs (Live Feedback / Coaching / References) over
  a big blank area. As a first-timer I don't know what it's for yet; an empty pane that large reads
  as "something failed to load." A one-line "Make a move and I'll explain it here" placeholder would
  reassure me. (screenshot 03-table-full.png)
- I have K♦4♥ in the cutoff facing a $2 call. I know K-high offsuit junk is weak, but as a casual
  player "it's only $2 and I have a King" — I'll **call** to see what the coach tells me.

### Feedback after my call (screenshot 04-after-call-feedback.png)
- EMOTION - Pleasantly surprised / happy: The Live Feedback panel filled with genuinely useful,
  plain-language coaching. A red "❌ Mistake" badge, tags "preflop chart deviation" / "call too
  wide", and a clear sentence: "The baseline chart says fold K♦4♥ from CO; your line differs."
  Then an equity bar "You win ~18% — need ~29%" and the plain line "you come up short, so this
  loses money over time." This is exactly the kind of plain explanation I'd want. (screenshot 04)
- There's a "Hand review" running tally "0 good · 0 thin · 1 mistake" and a per-street log. Nice.
- It even tells me to run `/poker-coach last` in the terminal for a deeper write-up. Good pointer.
- EMOTION - Confused (equity vs board): The feedback says "You win ~18%" but at the same moment
  the **flop came T♠ 9♣ K♦ — I just paired my King (top pair)** and the pot jumped to $17 with
  Bot 5 betting $7. Seeing "18%" right next to a board that pairs my King is jarring; I don't
  realize the 18% was my *preflop* equity, not my equity *now*. The feedback for the previous
  decision and the new street's state are shown together with no time separation, so the numbers
  feel contradictory. (screenshot 04)
- Minor: "▸ Show the numbers" and "Mental Math — estimate it in your head" are collapsed; I like
  that they're optional (matches "I'm not a math person").
- Now I have top pair (K) on T9K. Bot 5 bet $7. As a basic player I'll **call $7**.

### Flop call feedback + turn (screenshot 05-after-call7.png)
- My flop call got "⚠️ Thin — thin value good": "It costs you $7 to win a $24 pot — you only need
  to win about 29%... Your hand wins ~32%. Close, but just about worth it." EMOTION - Happy &
  encouraged: this is great. The ⚠️ + "thin value good" label tells me it wasn't a mistake, just
  marginal, and the plain math ("$7 to win a $24 pot") is exactly the kind of intuition I want.
- EMOTION - Confused (feedback lags the board): By the time I read the flop-call feedback, the
  **turn (9♥) had already dealt and two bots had bet/called**, so the board now shows 4 cards and
  the pot is $75 — but the feedback still describes the 3-card flop decision ($24 pot, ~32%). The
  feedback panel and the live table are out of sync in time. I can't tell whether "~32%" describes
  what I see now or a past moment. Feedback needs to anchor to *the board state at the time of the
  decision* (e.g. show the flop cards it's talking about, or a "when you called:" caption).
- EMOTION - mild screenshot annoyance (mine, not the app's): viewport screenshot came out
  downscaled/blurry; I'll keep using snapshots for text.
- I now have two pair (Kings & Nines). Bot 2 bet $22, Bot 5 called. I'll **call $22**.

### Showdown (screenshot 06-showdown.png)
- EMOTION - Satisfied / happy: Clean end-of-hand. Opponents' cards revealed (Bot 2 had T4, Bot 5
  had 75), per-seat win/loss deltas (+$198 / -$97), my hand labeled "Two Pair, Kings & Nines",
  the top bar updated to Session ▲ $198 / Bank $3061, and a clear "Next hand" button. Feels good.
- EMOTION - mildly confused (result vs verdict): My **preflop call is still flagged "❌ mistake"**
  in the hand-review tally ("1 mistake") even though I **won $198**. The coach's logic (it was a
  -EV call long-term) is sound, but a first-timer reading "you won $198" next to a red ❌ feels
  contradictory. A one-line reconciliation ("you won this time, but that call loses money on
  average") would close the gap. Mild — it's a real teaching moment, just under-explained.
- Note: the equity numbers per street DO line up nicely in the Hand-review log (each entry shows
  its own pot/price), which is great — so the live-panel "lag" confusion (above) is really about
  the *top* live card vs the running table, not the per-street log.

## Round 2 — checking the other tabs + responsiveness

- **Coaching tab** (screenshot 07): clear empty state "No coaching yet" with exact terminal
  commands to run and a Refresh button. Good — not confusing.
- **References tab** (screenshot 08): excellent. Full hand-ranking list with plain examples, plus
  an **interactive preflop chart** with a position selector. EMOTION - happy: this is genuinely
  helpful for a learner and answers "what should I even play?" (Minor: chart defaults to BTN, not
  my current seat — a learner might not switch the dropdown. Low priority.)
- New hand dealt (pocket 5s, MP). EMOTION - the **empty Live Feedback panel returns on every new
  hand** — reconfirms issue #2; the blank right half is the default resting state, which feels off.

### EMOTION - Irritated / blocked (confirmed responsive bug) (screenshot 10-small-1024x640.png)
- At a **1024×640** window (a perfectly normal small-laptop / split-screen / browser-zoom size),
  the "You" seat sits at the bottom and the **Fold / Call / Raise action bar is entirely below the
  viewport with no scrollbar or hint**. I literally cannot act on my pocket 5s. The table is a
  fixed-height layout that doesn't shrink to fit, so on any viewport shorter than ~720px the
  primary controls disappear. This is the same thing that bit me on first load (screenshot 02).
  This is the single most damaging issue — a new user could conclude the game is broken.

---

## CONSOLIDATED — negative moments to fix (input for /feature-sdlc)

1. **[BLOCKER] Action bar cut off on shorter/zoomed viewports.** Below ~720px height the
   Fold/Call/Raise controls fall below the fold with no scroll; the table doesn't scale to fit.
   Also hit on first load. → Make the table layout responsive / always keep the action bar in
   view (e.g. fit-to-viewport scaling, or a sticky action bar, or allow scroll with the bar pinned).

2. **[CONFUSING] Empty "Live Feedback" panel** before the first action and on every new hand —
   the large blank right pane reads as "failed to load." → Add a friendly empty-state placeholder
   ("Make your move and I'll break it down here" + maybe a hint of what's coming).

3. **[CONFUSING] Live Feedback is out of sync with the live table.** The panel analyses the
   decision you *just* made, but by the time you read it the bots have acted and the street/pot
   advanced, so the equity %, pot size, and board it describes don't match what's on screen now.
   → Anchor each feedback card to the board/pot state *at the moment of the decision* (e.g. show
   the cards/pot it refers to, or a "when you called the flop:" caption), so the numbers are
   unambiguous.

4. **[CONFUSING] Setup jargon (TAG / LAG / Nit) unexplained.** A basics-only player doesn't know
   these abbreviations. → Add tooltips / a short plain-language gloss (e.g. "TAG — tight &
   aggressive") next to the style selectors, or a small legend.

5. **[mild] Result-vs-verdict mismatch.** "You won $198" displayed beside a red "❌ mistake" with
   no reconciliation. → One plain line tying the two together ("Won this time, but that call
   loses money on average"). (Lower priority.)

6. **[nit] Missing favicon** (404 on /favicon.ico). (Lowest priority.)

---

## FIX PHASE (via /feature-sdlc --non-interactive)
- Branch: `feat/first-time-ux-fixes` (off feat/all-in-badge). Feature folder:
  `docs/pmos/features/2026-06-17_first-time-ux-fixes/`. Tier 2. Requirements written.
- Mapping the code now, then spec → plan → implement → verify → complete-dev → fresh re-review.

### Implementation + /verify gate (PASS)
Edits (all presentational; no core/engine/schema change):
- FR-1 `components/table/PokerTable.tsx` — felt is now a flex child (`flex:1 1 auto; minHeight:0;
  maxHeight:580`) inside a full-height column; the action bar is `flex:0 0 auto` and always renders.
- FR-2 `components/RightPanel.tsx` — friendly empty-state card when feedback is on but no decision yet.
- FR-3 `components/FeedbackPanel.tsx` (+RightPanel wiring) — optional `context` caption
  "Your <street> decision · pot was $X when you acted"; `components/HandRecap.tsx` rows show "· pot $X".
- FR-4 `components/SetupScreen.tsx` — always-visible plain-language style legend + preset tooltips.
- FR-5 `components/HandRecap.tsx` — reconcile line when a won hand contains a flagged decision.
- FR-6 `app/icon.svg` + `app/favicon.ico` — Next auto-injects icon links; /favicon.ico now 200.

Gate: `npm run typecheck` clean · `npm run lint` clean · `npm test` 270/270 pass (added tests for
FR-2/3/4/5).

In-browser re-verification at the previously-broken 1024×640 (screenshots 11–14):
- ✅ FR-1: Fold/Call/Raise bar fully visible; table scaled to fit (screenshot 12).
- ✅ FR-2: "Make your move…" placeholder instead of a blank pane (screenshot 12).
- ✅ FR-3: every street's card shows "Your <street> decision · pot was $X when you acted"; the live
  pot ($12) and the feedback's pot ($7) are no longer confusable (screenshot 13).
- ✅ FR-4: legend "TAG — tight & aggressive · LAG — … · Nit — … · Calling Station — …" (screenshot 11).
- ✅ FR-5: won $28 with a flagged preflop call → reconcile line rendered (screenshot 14).
- ✅ FR-6: `curl /favicon.ico` → 200 image/x-icon; no console 404.








