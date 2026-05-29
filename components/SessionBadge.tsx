"use client";
// Shows the current session id with a Copy button (observation #5). The id is what /poker-coach
// targets for an OLDER session; the badge also reminds the user that `last` / `session` need no id.
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function SessionBadge({ sessionId }: { sessionId: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!sessionId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      data-testid="session-badge"
      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}
    >
      <span>Session</span>
      <code
        data-testid="session-id"
        style={{
          background: "var(--panel-2)",
          padding: "2px 8px",
          borderRadius: "var(--r-sm)",
          color: "var(--ink)",
        }}
      >
        {sessionId}
      </code>
      <Button variant="ghost" size="sm" aria-label="Copy session id" onClick={() => void copy()}>
        {copied ? "Copied ✓" : "Copy"}
      </Button>
    </div>
  );
}
