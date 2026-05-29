import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  saveSession,
  saveHandRecord,
  listCoaching,
  SESSION_SCHEMA_VERSION,
} from "@/lib/dataStore";
import { buildHandRecord } from "@/core/history/handRecord";
import { analyze } from "@/core/analysis/analyze";
import { Card } from "@/core/cards";

let root: string;
const c = (s: string) => s as Card;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "poker-data-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function sampleRecord(sessionId: string, handNumber: number) {
  return buildHandRecord({
    sessionId,
    handNumber,
    playedAt: "2026-05-29T00:00:00.000Z",
    config: { numPlayers: 2, smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
    heroSeat: 0,
    seats: [
      { seat: 0, name: "You", isHero: true, startingStack: 200, position: "BB", persona: null },
      { seat: 1, name: "Bot", isHero: false, startingStack: 200, position: "BTN", persona: { style: "TAG", skill: "Advanced" } },
    ],
    heroHole: ["Ac", "Jh"].map(c),
    board: [],
    actions: [],
    heroDecisions: [
      {
        decisionId: `h${handNumber}-d1`,
        street: "preflop",
        spot: { potBefore: 9, toCall: 4, position: "BB", stackBb: 48, numActiveOpponents: 1, facing: "raise" },
        heroAction: { action: "call", amount: 4 },
        analysis: analyze({ action: "call", potBefore: 9, toCall: 4, equityPct: 46 }),
      },
    ],
    outcome: { winners: [{ seat: 0, amount: 8 }], heroNet: 4, shown: [], endedAtShowdown: false },
  });
}

describe("saveSession", () => {
  it("writes a session JSON file", async () => {
    const file = await saveSession(
      {
        schemaVersion: SESSION_SCHEMA_VERSION,
        id: "sess-1",
        createdAt: "2026-05-29T00:00:00.000Z",
        settings: { numOpponents: 5, coachingDepth: "equity", feedbackEnabled: true },
      },
      root,
    );
    const onDisk = JSON.parse(await fs.readFile(file, "utf8"));
    expect(onDisk.id).toBe("sess-1");
    expect(onDisk.settings.numOpponents).toBe(5);
  });
});

describe("saveHandRecord", () => {
  it("writes data/hands/<sid>/hand-<n>.json with the embedded analysis", async () => {
    const file = await saveHandRecord(sampleRecord("sess-1", 7), root);
    expect(file).toContain(path.join("hands", "sess-1", "hand-7.json"));
    const onDisk = JSON.parse(await fs.readFile(file, "utf8"));
    expect(onDisk.handId).toBe("sess-1_h7");
    expect(onDisk.heroDecisions[0].analysis.verdict).toBe("good");
    // no leftover temp file
    const dir = path.join(root, "hands", "sess-1");
    expect((await fs.readdir(dir)).some((n) => n.endsWith(".tmp"))).toBe(false);
  });
});

describe("listCoaching", () => {
  it("returns [] when no coaching exists yet (E3)", async () => {
    expect(await listCoaching("sess-1", root)).toEqual([]);
  });

  it("lists markdown files sorted with their contents", async () => {
    const dir = path.join(root, "coaching", "sess-1");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "sess-1_h2.md"), "# Hand 2");
    await fs.writeFile(path.join(dir, "sess-1_h1.md"), "# Hand 1");
    const files = await listCoaching("sess-1", root);
    expect(files.map((f) => f.name)).toEqual(["sess-1_h1.md", "sess-1_h2.md"]);
    expect(files[0].content).toContain("Hand 1");
  });
});
