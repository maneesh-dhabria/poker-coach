// Generates the committed demo fixtures (deterministically) and verifies every HandRecord against
// the JSON schema, plus the honesty invariants the /poker-coach skill relies on (T19, FR-40..45, R4).
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { playHand, PlaySeat } from "@/core/playHand";
import { validateHandRecord, HandRecord } from "@/core/history/handRecord";
import { personaFor } from "@/core/bots/personas";
import { mulberry32 } from "@/core/cards";
import { SESSION_SCHEMA_VERSION } from "@/lib/dataStore";

const SAMPLES = path.join(process.cwd(), "samples", "session-demo");
const SESSION_ID = "demo";
const NUM_HANDS = 4;

function seats(): PlaySeat[] {
  return [
    { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
    { seat: 1, name: "Nora (Nit)", isHero: false, stack: 200, persona: personaFor("Nit", "Advanced") },
    { seat: 2, name: "Leo (LAG)", isHero: false, stack: 200, persona: personaFor("LAG", "Intermediate") },
    { seat: 3, name: "Cleo (Station)", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
  ];
}

function buildDemoHands(): HandRecord[] {
  const records: HandRecord[] = [];
  for (let n = 1; n <= NUM_HANDS; n++) {
    records.push(
      playHand({
        config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
        seats: seats(),
        buttonIndex: n % 4,
        rng: mulberry32(1000 + n),
        sessionId: SESSION_ID,
        handNumber: n,
        playedAt: `2026-05-29T12:0${n}:00.000Z`,
        coachingDepth: "equity",
        heroAct: ({ legal }) =>
          legal.actions.includes("check")
            ? { type: "check" }
            : legal.actions.includes("call")
              ? { type: "call" }
              : { type: "fold" },
        equityIterations: 600,
      }),
    );
  }
  return records;
}

describe("demo fixtures", () => {
  it("writes the committed demo session + hand records", async () => {
    await fs.mkdir(SAMPLES, { recursive: true });
    const records = buildDemoHands();
    await fs.writeFile(
      path.join(SAMPLES, "session.json"),
      JSON.stringify(
        {
          schemaVersion: SESSION_SCHEMA_VERSION,
          id: SESSION_ID,
          createdAt: "2026-05-29T12:00:00.000Z",
          settings: { numOpponents: 3, coachingDepth: "equity", feedbackEnabled: true },
        },
        null,
        2,
      ),
    );
    for (const rec of records) {
      await fs.writeFile(path.join(SAMPLES, `hand-${rec.handNumber}.json`), JSON.stringify(rec, null, 2));
    }
    const written = (await fs.readdir(SAMPLES)).filter((f) => f.startsWith("hand-"));
    expect(written).toHaveLength(NUM_HANDS);
  });

  it("every committed hand record validates against the schema", async () => {
    const files = (await fs.readdir(SAMPLES)).filter((f) => f.startsWith("hand-"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const rec = JSON.parse(await fs.readFile(path.join(SAMPLES, f), "utf8"));
      const res = validateHandRecord(rec);
      expect(res.errors).toEqual([]);
      expect(res.valid).toBe(true);
    }
  });

  it("every hero decision carries an analysis the coach can read as ground truth", async () => {
    const files = (await fs.readdir(SAMPLES)).filter((f) => f.startsWith("hand-"));
    for (const f of files) {
      const rec: HandRecord = JSON.parse(await fs.readFile(path.join(SAMPLES, f), "utf8"));
      for (const d of rec.heroDecisions) {
        expect(["good", "thin", "mistake"]).toContain(d.analysis.verdict);
        expect(d.analysis.numbers).toBeDefined();
        // Honesty: gtoClaim is true ONLY for preflop chart feedback (§9.2); all postflop is false.
        if (d.street !== "preflop") expect(d.analysis.gtoClaim).toBe(false);
      }
    }
  });
});
