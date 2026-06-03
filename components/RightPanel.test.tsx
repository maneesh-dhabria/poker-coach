// T2 — the right column is a tab host. Only the tab body (#tab-body) scrolls; the strip is pinned.
// Tabs are real role="tab" buttons with aria-selected; the selected panel renders in #tab-body.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RightPanel } from "@/components/RightPanel";
import { useSessionStore } from "@/store/sessionStore";

beforeEach(() => {
  cleanup();
  useSessionStore.getState().setActiveTab("live-feedback");
});

describe("RightPanel", () => {
  it("shows Live Feedback by default and only the tab body scrolls", () => {
    const { container } = render(<RightPanel />);
    const body = container.querySelector('[data-testid="tab-body"]') as HTMLElement;
    expect(body.id).toBe("tab-body");
    expect(body.style.overflowY).toBe("auto");
    expect(screen.getByRole("tab", { name: /live feedback/i })).toHaveAttribute("aria-selected", "true");
  });

  it("renders exactly three tabs and no legacy standalone tabs", () => {
    render(<RightPanel />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /live feedback/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /coaching/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /references/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^hands$/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /^rankings$/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /preflop/i })).toBeNull();
  });

  it("switches to References on click", () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /references/i }));
    expect(screen.getByRole("tab", { name: /references/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /live feedback/i })).toHaveAttribute("aria-selected", "false");
  });

  it("coerces a stale persisted tab key to live-feedback", () => {
    // @ts-expect-error — simulate an old persisted value outside the new union
    useSessionStore.getState().setActiveTab("rankings");
    expect(useSessionStore.getState().activeTab).toBe("live-feedback");
  });
});
