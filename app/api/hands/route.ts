// POST /api/hands — persist a played HandRecord, rejecting anything that fails the schema so the
// app↔coach contract stays intact (spec FR-31, §9.1, R4).
import { NextResponse } from "next/server";
import { saveHandRecord } from "@/lib/dataStore";
import { validateHandRecord, HandRecord } from "@/core/history/handRecord";

export async function POST(req: Request) {
  const record = (await req.json()) as HandRecord;
  const check = validateHandRecord(record);
  if (!check.valid) {
    return NextResponse.json({ ok: false, errors: check.errors }, { status: 400 });
  }
  const file = await saveHandRecord(record);
  return NextResponse.json({ ok: true, handId: record.handId, file });
}
