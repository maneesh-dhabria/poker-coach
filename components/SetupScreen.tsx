"use client";
// Setup screen (spec FR-50, FR-55; wireframe 02): choose opponent count (1–5 → true 6-max),
// per-seat style×skill, whole-table presets, coaching depth, and the feedback toggle, then deal.
import { useSessionStore } from "@/store/sessionStore";
import { personaFor, tablePreset, Style, Skill, PresetName } from "@/core/bots/personas";
import { BotParams } from "@/core/bots/botEngine";
import { CoachingDepth } from "@/core/analysis/types";
import { Button } from "@/components/ui/Button";

// Which preset is currently applied, for the selected affordance (observation #2). A preset is
// "active" when every seat's (style, skill) matches what that preset would produce.
function activePreset(personas: BotParams[], n: number): PresetName | null {
  for (const preset of PRESETS) {
    const want = tablePreset(preset, n);
    if (
      personas.length >= n &&
      want.every((w, i) => personas[i]?.style === w.style && personas[i]?.skill === w.skill)
    ) {
      return preset;
    }
  }
  return null;
}

const STYLES: Style[] = ["TAG", "LAG", "Nit", "Calling Station"];

// Plain-language tooltips for each opponent style (shown as native title tooltips).
const STYLE_INFO: Record<Style, string> = {
  TAG: "Tight-Aggressive — plays few hands but bets and raises hard when it does. Disciplined and tough to play against; don't bluff it much.",
  LAG: "Loose-Aggressive — plays lots of hands and bets/raises hard. Pressuring and wild; tighten up and let it hang itself.",
  Nit: "Nit — ultra-tight. Folds almost everything and only shows up with monster hands. Steal pots from it, but believe its big bets.",
  "Calling Station": "Calling Station — loose-passive. Calls a lot, rarely folds or raises. Never bluff it; bet your strong hands for value and get paid.",
};
// Short plain-language gloss for each style, shown as an always-visible legend (the native title
// tooltips above aren't discoverable for a first-time player).
const STYLE_GLOSS: Record<Style, string> = {
  TAG: "tight & aggressive",
  LAG: "loose & aggressive",
  Nit: "ultra-tight, folds a lot",
  "Calling Station": "calls a lot, rarely folds",
};
const SKILLS: Skill[] = ["Beginner", "Intermediate", "Advanced"];
const PRESETS: PresetName[] = ["balanced", "aggro", "passive", "reg-heavy"];

// Plain-language meaning of each whole-table preset (shown as a tooltip on the preset buttons).
const PRESET_INFO: Record<PresetName, string> = {
  balanced: "A realistic mix of styles and skills — a good default to learn against.",
  aggro: "Aggressive table — lots of betting and raising. Expect pressure.",
  passive: "Passive table — opponents call a lot and rarely raise. Bet your good hands.",
  "reg-heavy": "Tough table of disciplined regulars — tight and skilled.",
};
const STACK_PRESETS = [50, 100, 200] as const; // buy-in depth in BB; default 100 (D15)
const DEPTHS: { value: CoachingDepth; label: string; hint: string }[] = [
  { value: "conceptual", label: "Conceptual", hint: "Plain words, no numbers" },
  { value: "equity", label: "Equity + Heuristics", hint: "Odds and reasons" },
  { value: "strict", label: "Strict (charts)", hint: "Chart-based, preflop GTO" },
];

function resizePersonas(personas: BotParams[], n: number): BotParams[] {
  const out = personas.slice(0, n);
  while (out.length < n) out.push(personaFor("TAG", "Intermediate"));
  return out;
}

export function SetupScreen({ onDeal }: { onDeal: () => void }) {
  const settings = useSessionStore((s) => s.settings);
  const setSettings = useSessionStore((s) => s.setSettings);

  const setOpponents = (n: number) =>
    setSettings({ numOpponents: n, personas: resizePersonas(settings.personas, n) });

  const setPersona = (i: number, patch: Partial<Pick<BotParams, "style" | "skill">>) => {
    const current = settings.personas[i];
    const next = personaFor(
      (patch.style ?? current.style) as Style,
      (patch.skill ?? current.skill) as Skill,
    );
    const personas = settings.personas.slice();
    personas[i] = next;
    setSettings({ personas });
  };

  const selectedPreset = activePreset(settings.personas, settings.numOpponents);

  return (
    // No-scroll setup shell (spec FR-05/FR-06, NFR-01): fills one viewport at ≥1280×800; the page
    // never scrolls. Body reflows into a denser 2-column grid per wireframe 01 so opponents +
    // presets + coaching depth + Deal all fit a 1280×800 fold.
    <main
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        gap: 16,
      }}
    >
      <h1 style={{ color: "var(--gold)", margin: 0, flex: "0 0 auto" }}>New Session</h1>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignContent: "start",
        }}
      >
      <section className="card">
        <label htmlFor="numOpponents">Number of opponents</label>{" "}
        <select
          id="numOpponents"
          className="select"
          value={settings.numOpponents}
          onChange={(e) => setOpponents(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Table presets:</span>
          {PRESETS.map((p) => (
            <Button
              key={p}
              size="sm"
              title={PRESET_INFO[p]}
              variant={selectedPreset === p ? "primary" : "ghost"}
              selected={selectedPreset === p}
              onClick={() => setSettings({ personas: tablePreset(p, settings.numOpponents) })}
            >
              {p}
            </Button>
          ))}
        </div>
        <p data-testid="preset-hint" style={{ color: "var(--ink-soft)", fontSize: 12, margin: "8px 0 0" }}>
          Picking a preset fills in every bot&apos;s style and skill for you (replacing your per-bot
          choices below). Want a custom table? Just set each bot yourself and skip the presets.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Opponents</h2>
        <p data-testid="style-legend" style={{ color: "var(--ink-soft)", fontSize: 12, margin: "0 0 10px" }}>
          {STYLES.map((s, i) => (
            <span key={s} title={STYLE_INFO[s]}>
              <strong>{s}</strong> — {STYLE_GLOSS[s]}
              {i < STYLES.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
        {settings.personas.slice(0, settings.numOpponents).map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <span style={{ width: 64 }}>Bot {i + 1}</span>
            <select
              className="select"
              aria-label={`Style for Bot ${i + 1}`}
              title={STYLE_INFO[p.style as Style]}
              value={p.style}
              onChange={(e) => setPersona(i, { style: e.target.value as Style })}
            >
              {STYLES.map((s) => (
                <option key={s} title={STYLE_INFO[s]}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label={`Skill for Bot ${i + 1}`}
              value={p.skill}
              onChange={(e) => setPersona(i, { skill: e.target.value as Skill })}
            >
              {SKILLS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 id="depth-label" style={{ marginTop: 0 }}>
          Coaching depth
        </h2>
        <div role="radiogroup" aria-labelledby="depth-label" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {DEPTHS.map((d) => (
            <Button
              key={d.value}
              role="radio"
              aria-checked={settings.coachingDepth === d.value}
              variant={settings.coachingDepth === d.value ? "primary" : "ghost"}
              selected={settings.coachingDepth === d.value}
              onClick={() => setSettings({ coachingDepth: d.value })}
              title={d.hint}
            >
              {d.label}
            </Button>
          ))}
        </div>
        <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: "8px 0 0" }}>
          {DEPTHS.find((d) => d.value === settings.coachingDepth)?.hint}
        </p>
      </section>

      <section className="card">
        <h2 id="stack-label" style={{ marginTop: 0 }}>
          Starting stack
        </h2>
        <div role="group" aria-labelledby="stack-label" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STACK_PRESETS.map((bb) => {
            const selected = settings.startingStackBb === bb;
            return (
              <Button
                key={bb}
                size="sm"
                aria-pressed={selected}
                variant={selected ? "primary" : "ghost"}
                selected={selected}
                onClick={() => setSettings({ startingStackBb: bb })}
              >
                {bb} BB
              </Button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={settings.feedbackEnabled}
            onChange={(e) => setSettings({ feedbackEnabled: e.target.checked })}
          />
          Show instant feedback after each of my decisions
        </label>
      </section>

        <div>
          <Button variant="primary" onClick={onDeal} style={{ padding: "10px 28px", fontSize: 16 }}>
            Deal
          </Button>
        </div>
      </div>
    </main>
  );
}
