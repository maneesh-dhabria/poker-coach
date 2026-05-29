// POST /api/sessions — create a session from the chosen settings and persist it (spec §10).
import { NextResponse } from "next/server";
import { saveSession, SESSION_SCHEMA_VERSION, SessionSettings } from "@/lib/dataStore";

function newSessionId(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15); // YYYYMMDDhhmmss
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${suffix}`;
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
