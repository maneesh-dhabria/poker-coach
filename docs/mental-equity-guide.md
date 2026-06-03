# Mental Outs & Equity Guide

A plain-language process for counting outs and estimating your equity **in your head**, at any
stage of a hand — no solver, no Monte Carlo. This is a **living document**: it's the source content
for a planned "Mental Math" tab in the Poker Coach interface, and we keep refining it as we learn.

> **The one sentence:** Count the cards that save you → multiply by 4 on the flop or 2 on the turn →
> that's roughly how often you *hit* → shade it down for extra players and dangerous boards → if the
> result beats the price you're paying, call.

---

## The two questions (keep them separate)

The single most important idea: **hitting your draw and winning the pot are different things.**

| Question | Depends on | Tool |
|---|---|---|
| **"Will my card come?"** (hitting) | Only the deck | Rule of 2 and 4 |
| **"Will I actually win?"** (equity) | The deck **+ opponents + board danger** | Rule of 2 and 4, then a haircut |

The Rule of 2 and 4 answers the first. The number of players does **not** change whether your card
comes — but it does change whether hitting is good enough to win. So we estimate hitting first, then
discount.

---

## Step 1 — Count your outs

An **out** is any card left in the deck that turns your hand into the winner. Look at your cards +
the board and ask: *"Which cards would I be thrilled to see?"* Count them.

### Common draws (memorize these)

| Draw | Outs |
|---|---|
| Gutshot (one specific card in the middle) | 4 |
| Two overcards | 6 |
| Open-ended straight | 8 |
| Flush draw | 9 |
| Flush draw + gutshot | ~12 |
| Flush draw + open-ended straight | ~15 |

### How to count a flush draw
13 of a suit exist; subtract the ones you can see (yours + board). Two spades in hand + two on
board = 4 seen → **9 spades left = 9 outs**.

### Watch for double-counting
If a card makes **both** a straight and a flush, count it **once**. Example: Q♥J♥ on 10♥9♣2♥ —
the 8♥ and K♥ make a flush *and* a straight, so 9 (flush) + 8 (straight) − 2 (overlap) = **15**, not 17.

---

## Step 2 — Turn outs into "chance I hit" (Rule of 2 and 4)

| You are on the... | Cards still to come | Multiply outs by |
|---|---|---|
| **Flop** | 2 (turn + river) | **× 4** |
| **Turn** | 1 (river) | **× 2** |

*Why:* each card to come is worth about `outs × 2`. Two cards ≈ `outs × 4`.

### Flop (× 4)
| Draw | Outs | ≈ Hit % |
|---|---|---|
| Gutshot | 4 | ~16% |
| Overcards | 6 | ~24% |
| Open-ended | 8 | ~32% |
| Flush | 9 | ~36% |
| Flush + straight | 15 | ~57%* |

### Turn (× 2)
| Draw | Outs | ≈ Hit % |
|---|---|---|
| Gutshot | 4 | ~8% |
| Open-ended | 8 | ~16% |
| Flush | 9 | ~18% |

> Your equity roughly **halves** from flop to turn — you went from two chances to one.

\* **Caveat for big draws:** above ~12 outs, ×4 over-counts a bit (true ≈ 54% for 15 outs). Under
~12 outs it's very accurate. The ballpark is what matters.

---

## Step 3 — Discount for opponents (hit ≠ win)

The Rule gives **how often you hit**. To get **how often you win**, shade it down as the pot gets
crowded.

- **Heads-up (1 opponent):** hitting ≈ winning. Trust the number.
- **Multiway (3+):** someone is more likely to have you beat even when you hit. Trim it.

| Situation | Adjustment |
|---|---|
| Heads-up, dry board | Use the number as-is |
| 3-way | Shave ~10–20% off your estimate |
| 4–5 way | Shave more; be skeptical of marginal draws |

*Example:* a flush draw is ~36% to hit. Heads-up ≈ 36% to win. Five-way, maybe ~28–30% to win,
because someone could hold a higher flush or a full house.

---

## Step 4 — Discount "tainted" outs (board danger)

A **tainted out** completes your hand **but also** makes a better hand for someone else. Ask of each
out: *"If this exact card comes, does it also make a hand that beats me?"* Yes → drop it. Maybe →
half-count it.

### The 4 classic taints
1. **Your straight card completes a flush.** 9♦8♦ on 7♣6♠ + two clubs: the 10♣/5♣ make your
   straight but hand someone a flush → 8 outs becomes ~6 clean.
2. **You're on the low end of a straight.** 5♠4♠ on 6-7-8: a 9 may already have a bigger straight.
   Be wary of "idiot-end" draws multiway.
3. **Board pairs → full house possible.** Made flush can lose when the board pairs.
4. **Pairing your card helps them more.** Top pair "improvement" cards are soft if someone has a set
   or two pair.

### Board-texture triggers (shortcuts so you don't audit every out)
| If the board is... | Discount because... | Rough haircut |
|---|---|---|
| Two of one suit (you're not on it) | flush completes vs you | drop 1–2 outs |
| Paired | full house possible | trust made hands less |
| Connected (8-9-10) | straights everywhere | drop straight outs |
| You hold the low end | someone has the high end | half-count those outs |
| Heads-up, dry (K-7-2 rainbow) | almost nothing taints | no haircut |

---

## Step 5 — Compare to the price (pot odds)

Equity only matters versus what you're paying.

$$\text{break-even \%} = \frac{\text{cost to call}}{\text{pot after you call}}$$

> **If your (discounted) equity > break-even % → calling is profitable.**

*Example:* pot $80, call $20 → break-even = 20 ÷ 100 = **20%**. A 36% flush draw clears it easily.

---

## Step 6 — Estimate EV (optional, when you want the dollar figure)

For a **call**:

$$\text{EV}_{\text{call}} = (\text{equity} \times \text{final pot}) - \text{cost to call}$$

For a **raise** (adds *fold equity* — how often everyone folds now):

$$\text{EV}_{\text{raise}} = (\text{fold\%} \times \text{pot now}) + (\text{call\%} \times [\text{equity} \times \text{final pot} - \text{your raise}])$$

The hard input for a raise is **fold%** — that's a read, not a calculation. In a crowded limped
pot, fold% is low and a low-equity raise comes out **negative**.

---

## Full worked example (flop → turn)

You hold **Q♥J♥**. Flop: **10♥ 9♣ 2♥**.

1. **Outs:** flush (9) + open-ended straight (8) − overlap (K♥, 8♥ = 2) = **15 raw outs**.
2. **Hit %:** flop, × 4 → ~57% (trim to ~54% for the big-draw caveat).
3. **Opponent discount:** multiway → call it ~48%.
4. **Taint check:** two-tone board, your flush is Q-high (beatable by A♥/K♥ flush) → stay a touch
   conservative. Still a monster.
5. **Price:** pot $60, call $20 → break-even 25%. Your ~48% crushes it → **call/raise**.

Turn is a blank (no heart, no straight card):
- Recount: 15 outs, but now **× 2** → ~30% hit; discount for players → ~mid-20s%.
- If the price is still ~25%, it's now **marginal** — different street, different answer.

---

## Quick reference card (the whole process)

```
1. COUNT outs      → cards that make your hand
2. MULTIPLY        → flop ×4, turn ×2  = chance you HIT
3. DISCOUNT players→ heads-up: keep; multiway: shave
4. DISCOUNT taint  → drop outs that also beat you (wet boards)
5. PRICE           → cost ÷ (pot+cost) = break-even %
6. DECIDE          → equity > break-even? call.
```

---

## Honesty notes (consistent with the coach)

- These are **estimates against an assumed typical range**, not a peek at anyone's cards.
- Mental math gets you to the right **decision**, not an exact decimal — that's what the app's
  Monte Carlo is for. Don't agonize over 11 vs 12 outs; avoid the trap of "15 outs!" when 4 lose.
- The wetter the board and the more players, the bigger the gap between "hit" and "win."

---

## Changelog
- _v0.1 (2026-06-03)_ — initial draft: outs, Rule of 2 & 4, player + taint discounts, pot odds, EV,
  worked example, quick-reference card.
