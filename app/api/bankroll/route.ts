// GET/PUT /api/bankroll — the only layer doing filesystem IO for the lifetime bankroll (spec FR-21,
// FR-30, §9.1, §9.2, E2). GET loads (creating a default on miss); PUT validates the payload shape
// before an atomic write so a malformed body never corrupts data/bankroll.json. Mirrors
// app/api/hands/route.ts.
import { NextResponse } from "next/server";
import { loadBankroll, saveBankroll } from "@/lib/dataStore";
import { Bankroll, BANKROLL_SCHEMA_VERSION } from "@/core/bankroll";

function validateBankroll(payload: unknown): payload is Bankroll {
  if (typeof payload !== "object" || payload === null) return false;
  const b = payload as Record<string, unknown>;
  if (typeof b.bank !== "number" || !Number.isFinite(b.bank)) return false;
  if (typeof b.startingStack !== "number" || !Number.isFinite(b.startingStack)) return false;
  if (typeof b.sessionPnl !== "number" || !Number.isFinite(b.sessionPnl)) return false;
  if (typeof b.autoRebuy !== "boolean") return false;
  if (!Array.isArray(b.seats)) return false;
  for (const s of b.seats) {
    if (typeof s !== "object" || s === null) return false;
    const seat = s as Record<string, unknown>;
    if (typeof seat.seatId !== "number" || typeof seat.stack !== "number") return false;
  }
  return true;
}

export async function GET() {
  return NextResponse.json(await loadBankroll());
}

export async function PUT(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid bankroll payload" }, { status: 400 });
  }
  if (!validateBankroll(payload)) {
    return NextResponse.json({ error: "invalid bankroll payload" }, { status: 400 });
  }
  try {
    await saveBankroll({ ...payload, schemaVersion: BANKROLL_SCHEMA_VERSION });
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
