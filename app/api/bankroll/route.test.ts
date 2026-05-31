import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET, PUT } from "@/app/api/bankroll/route";
import { defaultBankroll, BANKROLL_SCHEMA_VERSION } from "@/core/bankroll";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "poker-bankroll-"));
  process.env.POKER_DATA_DIR = root; // route handlers resolve FS via getDataDir()
});
afterEach(async () => {
  delete process.env.POKER_DATA_DIR;
  await fs.rm(root, { recursive: true, force: true });
});

describe("GET/PUT /api/bankroll", () => {
  it("PUT then GET round-trips and carries schemaVersion", async () => {
    const b = defaultBankroll(200, 6);
    const put = await PUT(
      new Request("http://x/api/bankroll", { method: "PUT", body: JSON.stringify(b) }),
    );
    expect(put.status).toBe(200);
    expect(await put.json()).toEqual({ ok: true });

    const got = await (await GET()).json();
    expect(got.startingStack).toBe(200);
    expect(got.schemaVersion).toBe(BANKROLL_SCHEMA_VERSION);
  });

  it("GET on a missing file returns the default (200)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const got = await res.json();
    expect(got.schemaVersion).toBe(BANKROLL_SCHEMA_VERSION);
    expect(got.bank).toBeGreaterThan(0);
  });

  it("rejects an invalid payload with 400 and writes nothing", async () => {
    const res = await PUT(
      new Request("http://x/api/bankroll", { method: "PUT", body: JSON.stringify({ nope: 1 }) }),
    );
    expect(res.status).toBe(400);
    // nothing persisted → GET still returns a default
    const got = await (await GET()).json();
    expect(got.startingStack).toBe(200); // default seat depth, not the rejected payload
    await expect(fs.access(path.join(root, "bankroll.json"))).rejects.toBeTruthy();
  });
});
