// T2 — the right column is a tab host. Only the tab body (#tab-body) scrolls; the strip is pinned.
// Tabs are real role="tab" buttons with aria-selected; the selected panel renders in #tab-body.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RightPanel } from "@/components/RightPanel";
import { useSessionStore } from "@/store/sessionStore";

beforeEach(() => {
  cleanup();
  useSessionStore.getState().setActiveTab("feedback");
});

describe("RightPanel", () => {
  it("shows Feedback by default and only the tab body scrolls", () => {
    const { container } = render(<RightPanel />);
    const body = container.querySelector('[data-testid="tab-body"]') as HTMLElement;
    expect(body).toBeTruthy();
    expect(body.id).toBe("tab-body");
    expect(body.style.overflowY).toBe("auto");
    expect(screen.getByRole("tab", { name: /feedback/i })).toHaveAttribute("aria-selected", "true");
  });

  it("switches tabs on click", () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /rankings/i }));
    expect(screen.getByRole("tab", { name: /rankings/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /feedback/i })).toHaveAttribute("aria-selected", "false");
  });
});
