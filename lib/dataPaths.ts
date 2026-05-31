// Filesystem layout for the local data contract (spec §10). The browser can't write files, so all
// IO happens in Node route handlers under this single data root (overridable for tests via env).
import path from "node:path";

export function getDataDir(): string {
  return process.env.POKER_DATA_DIR ?? path.join(process.cwd(), "data");
}

export const paths = {
  sessionsDir: (root: string) => path.join(root, "sessions"),
  sessionFile: (root: string, sessionId: string) => path.join(root, "sessions", `${sessionId}.json`),
  handsDir: (root: string, sessionId: string) => path.join(root, "hands", sessionId),
  handFile: (root: string, sessionId: string, handNumber: number) =>
    path.join(root, "hands", sessionId, `hand-${handNumber}.json`),
  coachingDir: (root: string, sessionId: string) => path.join(root, "coaching", sessionId),
  processedFile: (root: string) => path.join(root, "coaching", "processed.json"),
  bankrollFile: (root: string) => path.join(root, "bankroll.json"),
};
