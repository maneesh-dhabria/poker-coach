// POST /api/sessions — create a session from the chosen settings and persist it (spec §10).
import { NextResponse } from "next/server";
import { saveSession, SESSION_SCHEMA_VERSION, SessionSettings } from "@/lib/dataStore";

function newSessionId(): string {
  const now = new Date();
  const iso = now.toISOString().replace(/[-:T]/g, ""); // YYYYMMDDHHMMSS...
  const date = iso.slice(0, 8); // YYYYMMDD
  const time = iso.slice(8, 14); // HHMMSS
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${date}-${time}-${suffix}`; // YYYYMMDD-HHMMSS-<rand> (spec FR-30 / §9.1)
}

export async function POST(req: Request) {
  const settings = (await req.json()) as SessionSettings;
  const id = newSessionId();
  const session = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id,
    createdAt: new Date().toISOString(),
    settings,
  };
  await saveSession(session);
  return NextResponse.json({ id, session });
}
