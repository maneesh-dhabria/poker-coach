// Node filesystem reads/writes for sessions, hand records, and coaching markdown (spec §10, FR-31,
// FR-54). All writes are atomic (temp file + rename) so a crash mid-write never corrupts the
// app↔coach contract. Pure of Next types — route handlers wrap these.
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDataDir, paths } from "@/lib/dataPaths";
import { HandRecord } from "@/core/history/handRecord";

export const SESSION_SCHEMA_VERSION = 1;

export interface SessionSettings {
  numOpponents: number;
  coachingDepth: "conceptual" | "equity" | "strict";
  feedbackEnabled: boolean;
  [key: string]: unknown;
}

export interface SessionRecord {
  schemaVersion: number;
  id: string;
  createdAt: string;
  settings: SessionSettings;
}

async function writeAtomic(file: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, file);
}

export async function saveSession(session: SessionRecord, root = getDataDir()): Promise<string> {
  const file = paths.sessionFile(root, session.id);
  await writeAtomic(file, JSON.stringify(session, null, 2));
  return file;
}

export async function saveHandRecord(record: HandRecord, root = getDataDir()): Promise<string> {
  const file = paths.handFile(root, record.sessionId, record.handNumber);
  await writeAtomic(file, JSON.stringify(record, null, 2));
  return file;
}

export interface CoachingFile {
  name: string;
  content: string;
}

/** All coaching markdown for a session, sorted by filename. Empty if none yet (spec E3). */
export async function listCoaching(sessionId: string, root = getDataDir()): Promise<CoachingFile[]> {
  const dir = paths.coachingDir(root, sessionId);
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((n) => n.endsWith(".md"));
  } catch {
    return []; // directory doesn't exist yet — no coaching has been written
  }
  names.sort();
  const out: CoachingFile[] = [];
  for (const name of names) {
    out.push({ name, content: await fs.readFile(path.join(dir, name), "utf8") });
  }
  return out;
}
