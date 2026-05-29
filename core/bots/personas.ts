// Persona generation (spec FR-10, FR-14, FR-15): map a {style, skill} pair to the BotParams the
// bot engine consumes, and assemble whole-table presets. Style sets the baseline tendencies;
// skill perturbs them (weaker skill = noisier, looser, more passive call-downs).
import { BotParams } from "@/core/bots/botEngine";

export type Style = "TAG" | "LAG" | "Nit" | "Calling Station";
export type Skill = "Beginner" | "Intermediate" | "Advanced";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

interface StyleBase {
  vpip: number;
  aggression: number;
  bluffFreq: number;
  callStation: number;
  raiseSizePct: number;
}

const STYLE_BASE: Record<Style, StyleBase> = {
  Nit: { vpip: 0.12, aggression: 0.6, bluffFreq: 0.05, callStation: 0.05, raiseSizePct: 0.6 },
  TAG: { vpip: 0.24, aggression: 0.75, bluffFreq: 0.15, callStation: 0.1, raiseSizePct: 0.66 },
  LAG: { vpip: 0.4, aggression: 0.85, bluffFreq: 0.35, callStation: 0.15, raiseSizePct: 0.8 },
  "Calling Station": { vpip: 0.45, aggression: 0.25, bluffFreq: 0.05, callStation: 0.8, raiseSizePct: 0.5 },
};

interface SkillMod {
  noise: number;
  vpip: number;
  aggression: number;
  callStation: number;
}

const SKILL_MOD: Record<Skill, SkillMod> = {
  Beginner: { noise: 0.35, vpip: 0.08, aggression: -0.1, callStation: 0.2 },
  Intermediate: { noise: 0.15, vpip: 0.0, aggression: 0.0, callStation: 0.0 },
  Advanced: { noise: 0.0, vpip: -0.02, aggression: 0.05, callStation: -0.05 },
};

export function personaFor(style: Style, skill: Skill): BotParams {
  const b = STYLE_BASE[style];
  const m = SKILL_MOD[skill];
  return {
    style,
    skill,
    vpip: clamp01(b.vpip + m.vpip),
    aggression: clamp01(b.aggression + m.aggression),
    bluffFreq: clamp01(b.bluffFreq),
    callStation: clamp01(b.callStation + m.callStation),
    raiseSizePct: b.raiseSizePct,
    noise: m.noise,
  };
}

export type PresetName = "balanced" | "aggro" | "passive" | "reg-heavy";

const PRESET_TEMPLATES: Record<PresetName, { style: Style; skill: Skill }[]> = {
  balanced: [
    { style: "TAG", skill: "Advanced" },
    { style: "TAG", skill: "Intermediate" },
    { style: "Nit", skill: "Intermediate" },
    { style: "LAG", skill: "Intermediate" },
    { style: "Calling Station", skill: "Beginner" },
  ],
  aggro: [
    { style: "LAG", skill: "Advanced" },
    { style: "LAG", skill: "Intermediate" },
    { style: "TAG", skill: "Advanced" },
    { style: "LAG", skill: "Beginner" },
    { style: "TAG", skill: "Intermediate" },
  ],
  passive: [
    { style: "Calling Station", skill: "Beginner" },
    { style: "Calling Station", skill: "Intermediate" },
    { style: "Nit", skill: "Beginner" },
    { style: "Nit", skill: "Intermediate" },
    { style: "Calling Station", skill: "Beginner" },
  ],
  "reg-heavy": [
    { style: "TAG", skill: "Advanced" },
    { style: "Nit", skill: "Advanced" },
    { style: "TAG", skill: "Advanced" },
    { style: "TAG", skill: "Intermediate" },
    { style: "Nit", skill: "Intermediate" },
  ],
};

/** Build `numSeats` personas from a named preset (cycles the template to fill the table). */
export function tablePreset(name: PresetName, numSeats: number): BotParams[] {
  const template = PRESET_TEMPLATES[name];
  const out: BotParams[] = [];
  for (let i = 0; i < numSeats; i++) {
    const t = template[i % template.length];
    out.push(personaFor(t.style, t.skill));
  }
  return out;
}
