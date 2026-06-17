# Feedback for the `/playbook` skill author (pmos-learnkit)

**From:** a real run of `/playbook` on a personal repo (`poker-coach`), 2026-06-17, plugin v0.27.0.
**Context:** ran the skill as documented (scout → propose → deep-read → synthesize → gate → emit), produced two per-problem case studies, then the user reviewed them and asked for a fundamentally different artifact. This doc captures both the small fixes and the larger direction change, so you can decide what to fold into the skill.

Severity tags: **[blocker]** = makes output not-useful as-is · **[friction]** = works but fights the author · **[nit]** = polish.

---

## 1. The headline: the per-problem case-study framing under-serves PMs — add a "project/skill evolution" mode  **[blocker for the PM audience]**

**What happened.** The skill is built around FR-50/51: one *self-sufficient, replicable* case study per problem thread, mined from session transcripts. It executed correctly and the articles were accurate. But the user's verdict was that this shape "will not be useful for PMs" — because a single problem thread's takeaway is entangled with the domain (here, poker), so another PM can't transfer much. The reusable asset isn't "how I solved this one problem," it's **how the product (or skill) evolved and how the AI-SDLC pipeline shaped the decisions along the way.**

**Proposed change — a second mode (keep the existing one; add this):**

- **`/playbook evolution` (project mode):** when invoked inside a repo, trace the product's evolution — what the initial instructions were, how the idea was shaped, which decisions were hard and how they were resolved, and *how the pmos-skills (`/grill`, `/spec`, `/verify`, `/msf-req`, …) influenced each decision.* Structure it around **key inflection points**, explicitly NOT as a release/history log.
- **`/playbook skill <name>` (skill mode):** the same, targeted at one skill inside a plugin — trace the journey of developing that skill, how it works now, and the key decisions.

**Critically, the mining strategy is different from today's — but it's two co-equal sources, not docs-only.** Today the skill leads with raw session transcripts (Anti-Pattern #1 even warns about their cost). For evolution mode, lean on the **committed, already-distilled pipeline artifacts** for *decisions and outcomes* — but keep mining **session logs** for what the docs structurally cannot hold. The pipeline docs are synthesized from the author's inputs into a template shape, so they **lose the original raw inputs**: the verbatim starting prompt that kicked a feature off, the `@`-referenced files / pasted context that set the initial framing, the exact phrasing of the ask before it was formalized. Those raw inputs are often the single most useful thing for a PM reader ("oh, *that's* how little he started with"). So:

1. `docs/pmos/changelog.md` (or the repo's changelog) → the milestone spine + per-version decision notes. In this repo it gave clean v0.2→v0.5 milestones with named decisions (e.g. "Decision P8: own evaluator instead of poker-ts").
2. `docs/pmos/features/<feature>/` → `01_requirements.md` (problem framing, non-goals), `grills/*.md` (the decisions that changed direction — these were the single richest source of "complicated decisions and how they were shaped"), `02_spec.md` (D/S/P decision IDs), `verify/*.md` (what verification caught).
3. `git log` → ordering + the unreleased/in-flight work ("where it's headed").
4. **Session logs → the raw, un-synthesized author inputs the docs drop.** This is NOT just "human texture, last" — for each milestone, recover the **verbatim opening prompt** that started the feature, the **context the author fed in** (`@`-files, pasted specs, links), and the original phrasing of the request, plus the inflection moments that never make it into a template doc (the friction quote "who talks like that?", a pushback like "why did this happen in the first place?"). A "Starting prompts (verbatim)" thread of these per milestone is high-value for PMs — it shows the actual minimal input behind a polished outcome, which the synthesized requirements doc actively hides.

Net: docs are the authority for *what was decided*; sessions are the authority for *what the author originally said and fed in*. An evolution article needs both, so the deep-read should still open the picked threads' sessions (scoped to the milestone window) — the cost saving is in not clustering the whole repo's sessions, not in skipping them. Suggest a `reference/evolution-sources.md` describing this split, and a scout variant that inventories `changelog + features/*` to find the milestone spine, then maps each milestone to its originating session(s) for the verbatim-input pass.

**A new section schema for evolution mode** (the current `article-schema.md` sections don't fit). What worked in this run:
`What this is (cold-reader context)` → one section per milestone *anchored on its 1–2 inflection decisions* (not every change) → `How the pipeline shaped the whole arc` (cross-cutting) → a short, understated takeaway. Each milestone carried a small "Where the pipeline mattered" callout naming the specific skill and what it changed — this is how you make the `/grill`-helped-decide requirement land without it reading as a process advert. **Per the source note above, each milestone should also carry the author's verbatim opening prompt / context input** (in this run, the v0.3 "who talks like that?" note and the v0.4 `@docs/mental-equity-guide.md Build me a feature…` ask both came from sessions, not docs, and were the most quoted lines in the article). Surface them as short quoted blocks inside the milestone, not as a separate gallery — they read best in narrative context.

---

## 2. Voice / quality-gate defaults produce over-claiming and clickbait  **[friction]**

The user's three style complaints on the generated articles, all worth encoding into `article-schema.md §Voice` (and ideally a self-check before emit):

- **[friction] Titles trend clickbait.** Auto-titles like *'Chat → doc → feature: building a "Mental Math" panel from a tutoring session'* read as engagement-bait. Add a constraint: **plain, descriptive titles**; ban the "X → Y → Z" hook pattern and curiosity-gap phrasings.
- **[blocker] No cold-reader context.** The template opens at `TL;DR` with zero setup — a first-time reader has no idea what the project even is. **Add a mandatory first section that establishes what the product/repo is and what the document covers, before any takeaway.** The TL;DR currently assumes the reader already has context they don't have.
- **[friction] Over-narration / hero voice.** Phrasings like *"I made the AI teach me…"* overclaim. The schema should push **understated, genuine application** — describe what was done, not how clever it was.
- **[friction] Lessons stated like billboards.** The "Takeaway for PMs" section invites a bulleted list of bold pronouncements. Better result came from making the lesson **implied/subtle** — a short reflective close, not a lecture. Consider softening the section name and prompting for restraint.

A cheap mechanism: a pre-emit voice self-check (binary rubric) — "Does the title avoid hook patterns? Is there context before the first claim? Any sentence overclaiming the author's or the AI's cleverness? Is the lesson shown rather than declared?" — regenerate on fail.

---

## 3. Scout clustering: high `boundary_confidence` masked a multi-problem cluster  **[friction]**

The top candidate ("Understand T meaning in suits", 125 decisions / 12 sessions / 5 days) had `boundary_confidence: 1` yet bundled **three distinct problem threads** (a UX overhaul, a chat→doc→feature build, and several thin investigations). High confidence meant "these sessions belong together by attribution," NOT "this is one teachable problem." Two asks:

- **[friction]** In Phase 2, before deep-read, do a **cheap per-session opening-prompt extract** (jq over `select(.type=="user")`, grep `command-args`) and show it with each candidate. The verbatim first prompts reveal problem seams that score+confidence can't. (Stays within Anti-Pattern #1 — prompts only, ~1 line each.)
- **[nit]** The auto-title is derived from a stray prompt line and was actively misleading ("T" was a coaching reference to the Ten card, unrelated to the work). Either title from the dominant `command-args`/feature-slug, or label auto-titles as provisional.

---

## 4. Smaller notes  **[nit]**

- **[nit] Screenshots survive feature-worktree deletion via committed wireframes.** The feature worktrees were long gone, but `docs/pmos/features/*/wireframes*.html` are self-contained static HTML and screenshot cleanly via `python3 -m http.server` + Playwright at 1280×800. Worth calling out in the screenshot step as a reliable source when the live app is hard to drive — better than the "degrade to text" fallback.
- **[nit] Playwright left a `.playwright-mcp/` cache in the repo root** during capture. The skill should either run capture in a temp dir or clean up (it happened to be gitignored here; won't always be).
- **[nit] The render path worked exactly as documented** — stripping the substrate template's leading doc-comment before `renderArtifact()` was necessary and the regression note in `artifact-template.html` was accurate and helpful. No change needed; flagging that the doc-comment gotcha is real and the warning paid off.

---

## What this run ultimately shipped

After the feedback, the two per-problem articles were discarded and replaced with a single **project-evolution playbook** (`2026-06-17_poker-coach-evolution/`) following the structure in §1 — milestones anchored on inflection points, a "Where the pipeline mattered" callout per milestone, a cross-cutting process section, plain title, cold-reader intro, and a subtle close. That artifact is the concrete worked example of the proposed evolution mode.
