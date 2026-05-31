# Grill Report — 01_requirements (ux-learning-overhaul)

**Depth:** standard (targeted)  •  **Questions asked:** 8  •  **Outcome:** clean — no open gaps

## Resolved

- **Persistence model (D13):** lifetime bankroll lives in a **new `data/bankroll.json`** with its own version via `lib/dataStore` + a new `/api/bankroll` route. **HandRecord stays v1** — per-player results already live in `OutcomeRecord.winners[]`/`heroNet`, so **no app↔coach schema migration**. (Corrected a mistaken "already v2" assumption — verified `HANDRECORD_SCHEMA_VERSION=1`.)
- **No-scroll contract (G1):** zero vertical page scroll at **viewport ≥1280×800 (width AND height)**, for **both** setup and in-hand. Below that → graceful scroll OK (Non-Goal).
- **Tab overflow (D17 seam):** left column (table + action bar) + tab strip stay pinned; **only the active tab's body scrolls internally**.
- **Preflop chart position (D14):** defaults to the **hero's current position**, with a **selector** to browse any position.
- **Wave coupling (D17):** **W2 shows per-hand net only** (derivable from `OutcomeRecord`, no persistence); **session P/L + lifetime bank header land in W3**. Both waves independently shippable.
- **BB toggle blast radius (D18):** one **shared money formatter** + a **display-unit store flag**, **render-only**. Engine/analysis stay in $ (cents) internally; BB is presentation only — incl. the feedback math sentences.
- **Starting stack (D15):** **presets (50 / 100 / 200 BB), default 100**; free-form roadmapped.
- **Hand-category banner (D16):** **center-table** near the pot; winner **seat glows** + **winning cards highlight yellow**.

## Open / Deferred

- None. All seven Open Questions in the requirements doc are now Resolved.

## Gaps surfaced

- **Self-correction:** the original doc implied a HandRecord schema bump + migration for bankroll (a high-risk, least-reversible change). Code inspection showed it's unnecessary — money continuity is a separate file. This removed the single riskiest item from the plan.

## Recommended next step

- Proceed to **/spec** — the requirements are decision-complete (D1–D18, OQ all resolved). Spec should formalize: the `data/bankroll.json` shape + `/api/bankroll` route + corrupt-save fallback; the layout-shell CSS contract (pinned columns, internal tab scroll) with the 1280×800 assertion; the precomputed preflop-equity table; the shared money formatter + display-unit flag; and the W1→W6 wave/test breakdown.
