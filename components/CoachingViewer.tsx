"use client";
// Coaching viewer (spec FR-54, E3; wireframe 03). Fetches the markdown the /poker-coach skill wrote
// for the session and renders it; shows a how-to empty state when there's none yet. Refresh re-reads.
import { useCallback, useEffect, useState, Fragment } from "react";

interface CoachingFile {
  name: string;
  content: string;
}

// Minimal markdown → React: #/##/### headings, "- " lists, **bold**, paragraphs. Avoids a dep.
function renderInline(text: string, keyBase: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>
    ),
  );
}

function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = (k: string) => {
    if (list.length) {
      out.push(
        <ul key={k}>
          {list.map((li, i) => (
            <li key={i}>{renderInline(li, `${k}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  lines.forEach((line, i) => {
    const k = `l${i}`;
    if (line.startsWith("### ")) {
      flushList(`${k}-pl`);
      out.push(<h3 key={k}>{renderInline(line.slice(4), k)}</h3>);
    } else if (line.startsWith("## ")) {
      flushList(`${k}-pl`);
      out.push(<h2 key={k}>{renderInline(line.slice(3), k)}</h2>);
    } else if (line.startsWith("# ")) {
      flushList(`${k}-pl`);
      out.push(<h1 key={k}>{renderInline(line.slice(2), k)}</h1>);
    } else if (line.startsWith("- ")) {
      list.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList(`${k}-pl`);
    } else {
      flushList(`${k}-pl`);
      out.push(<p key={k}>{renderInline(line, k)}</p>);
    }
  });
  flushList("end");
  return out;
}

function EmptyState() {
  return (
    <div data-testid="coaching-empty" style={{ color: "var(--ink-soft)" }}>
      <h2>No coaching yet</h2>
      <p>
        Finish a hand, then in your terminal run <code>/poker-coach last</code> (or{" "}
        <code>/poker-coach session</code>) to generate a plain-language review. Then click Refresh.
      </p>
    </div>
  );
}

export function CoachingViewer({ sessionId }: { sessionId: string | null }) {
  const [files, setFiles] = useState<CoachingFile[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/coaching?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ color: "var(--gold)" }}>Coaching</h1>
        <button type="button" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {loading ? <p>Loading…</p> : null}
      {!loading && files.length === 0 ? (
        <EmptyState />
      ) : (
        files.map((f) => (
          <article key={f.name} data-testid="coaching-doc" style={{ marginTop: 16 }}>
            {renderMarkdown(f.content)}
          </article>
        ))
      )}
    </section>
  );
}
