// GET /api/coaching?sessionId=... — list the coaching markdown the /poker-coach skill has written
// for a session (spec FR-54, E3: empty list when none yet).
import { NextResponse } from "next/server";
import { listCoaching } from "@/lib/dataStore";

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
  }
  const files = await listCoaching(sessionId);
  return NextResponse.json({ ok: true, sessionId, files });
}
