"use client";
// Setup screen (spec FR-50, FR-55; wireframe 02): choose opponent count (1–5 → true 6-max),
// per-seat style×skill, whole-table presets, coaching depth, and the feedback toggle, then deal.
import { useSessionStore } from "@/store/sessionStore";
import { personaFor, tablePreset, Style, Skill, PresetName } from "@/core/bots/personas";
import { BotParams } from "@/core/bots/botEngine";
import { CoachingDepth } from "@/core/analysis/types";

const STYLES: Style[] = ["TAG", "LAG", "Nit", "Calling Station"];
const SKILLS: Skill[] = ["Beginner", "Intermediate", "Advanced"];
const PRESETS: PresetName[] = ["balanced", "aggro", "passive", "reg-heavy"];
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

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ color: "var(--gold)" }}>New Session</h1>

      <section>
        <label htmlFor="numOpponents">Number of opponents</label>{" "}
        <select
          id="numOpponents"
          value={settings.numOpponents}
          onChange={(e) => setOpponents(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </section>

      <section style={{ marginTop: 12 }}>
        <span>Table presets:</span>{" "}
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSettings({ personas: tablePreset(p, settings.numOpponents) })}
            style={{ marginRight: 6 }}
          >
            {p}
          </button>
        ))}
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>Opponents</h2>
        {settings.personas.slice(0, settings.numOpponents).map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 64 }}>Bot {i + 1}</span>
            <select
              aria-label={`Style for Bot ${i + 1}`}
              value={p.style}
              onChange={(e) => setPersona(i, { style: e.target.value as Style })}
            >
              {STYLES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
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

      <section style={{ marginTop: 16 }}>
        <h2 id="depth-label">Coaching depth</h2>
        <div role="radiogroup" aria-labelledby="depth-label">
          {DEPTHS.map((d) => (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={settings.coachingDepth === d.value}
              onClick={() => setSettings({ coachingDepth: d.value })}
              style={{ marginRight: 6 }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <label>
          <input
            type="checkbox"
            checked={settings.feedbackEnabled}
            onChange={(e) => setSettings({ feedbackEnabled: e.target.checked })}
          />{" "}
          Show instant feedback after each of my decisions
        </label>
      </section>

      <button
        type="button"
        onClick={onDeal}
        style={{
          marginTop: 24,
          background: "var(--gold)",
          color: "#1b1b1b",
          border: "none",
          borderRadius: "var(--r-pill)",
          padding: "10px 24px",
          fontWeight: 700,
        }}
      >
        Deal
      </button>
    </main>
  );
}
