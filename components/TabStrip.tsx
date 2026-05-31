"use client";
// Pinned tab strip for the right column (spec FR-03, FR-07; wireframe 02). Each tab is a real
// keyboard-reachable <button role="tab"> with an accessible name and aria-selected; arrow keys move
// between tabs (roving focus), and each tab controls the shared #tab-body panel.
import { TabKey } from "@/store/sessionStore";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "feedback", label: "Feedback" },
  { key: "coaching", label: "Coaching" },
  { key: "hands", label: "Hands" },
  { key: "rankings", label: "Rankings" },
  { key: "preflop", label: "Preflop Chart" },
];

export function TabStrip({
  active,
  onSelect,
}: {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  const move = (delta: number) => {
    const i = TABS.findIndex((t) => t.key === active);
    const next = (i + delta + TABS.length) % TABS.length;
    onSelect(TABS[next].key);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(TABS[0].key);
    } else if (e.key === "End") {
      e.preventDefault();
      onSelect(TABS[TABS.length - 1].key);
    }
  };

  return (
    <nav
      role="tablist"
      aria-label="Coaching panel"
      onKeyDown={onKeyDown}
      style={{
        flex: "0 0 auto",
        display: "flex",
        gap: 4,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        overflowX: "auto",
      }}
    >
      {TABS.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={selected}
            aria-controls="tab-body"
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t.key)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${selected ? "var(--gold)" : "transparent"}`,
              color: selected ? "var(--gold)" : "var(--ink-soft)",
              padding: "8px 12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
