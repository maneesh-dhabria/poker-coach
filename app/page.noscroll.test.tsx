// T1 — structural no-scroll contract for the play shell (plan D4: jsdom has no layout
// engine, so we assert the CSS contract, not pixel scrollHeight). The real pixel check is a
// Playwright MCP step in TN.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PlayShell } from "@/app/page";

describe("play shell no-scroll contract", () => {
  it("root fills the viewport and hides overflow", () => {
    const { container } = render(<PlayShell onNewSession={() => {}} />);
    const root = container.querySelector('[data-testid="play-shell"]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.height).toBe("100vh");
    expect(root.style.overflow).toBe("hidden");
  });

  it("left column is not a scroll region", () => {
    const { container } = render(<PlayShell onNewSession={() => {}} />);
    const left = container.querySelector('[data-testid="left-col"]') as HTMLElement;
    expect(left).toBeTruthy();
    expect(left.style.overflowY === "" || left.style.overflowY === "hidden").toBe(true);
  });
});
