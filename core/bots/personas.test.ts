import { describe, it, expect } from "vitest";
import { personaFor, tablePreset } from "@/core/bots/personas";

describe("personaFor", () => {
  it("a Nit opens tighter than a LAG (smaller vpip)", () => {
    const nit = personaFor("Nit", "Intermediate");
    const lag = personaFor("LAG", "Intermediate");
    expect(nit.vpip).toBeLessThan(lag.vpip);
  });

  it("a Beginner calls down looser than an Advanced of the same style", () => {
    const beginner = personaFor("TAG", "Beginner");
    const advanced = personaFor("TAG", "Advanced");
    expect(beginner.callStation).toBeGreaterThan(advanced.callStation);
  });

  it("weaker skill carries more noise", () => {
    expect(personaFor("TAG", "Beginner").noise).toBeGreaterThan(personaFor("TAG", "Advanced").noise);
  });

  it("keeps all frequencies within [0,1]", () => {
    const p = personaFor("Calling Station", "Beginner");
    for (const v of [p.vpip, p.aggression, p.bluffFreq, p.callStation]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("tablePreset", () => {
  it("fills exactly N seats", () => {
    expect(tablePreset("balanced", 5)).toHaveLength(5);
    expect(tablePreset("aggro", 3)).toHaveLength(3);
    expect(tablePreset("passive", 1)).toHaveLength(1);
  });

  it("produces well-formed personas with a style and skill", () => {
    for (const p of tablePreset("reg-heavy", 5)) {
      expect(p.style).toBeTruthy();
      expect(p.skill).toBeTruthy();
    }
  });
});
