import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SetupScreen } from "@/components/SetupScreen";
import { useSessionStore, defaultSettings } from "@/store/sessionStore";

beforeEach(() => {
  cleanup();
  useSessionStore.setState({ settings: defaultSettings(), sessionId: null });
});

describe("SetupScreen", () => {
  it("renders one persona row per opponent and resizes when count changes", () => {
    render(<SetupScreen onDeal={() => {}} />);
    expect(screen.getAllByLabelText(/Style for Bot/)).toHaveLength(5);

    fireEvent.change(screen.getByLabelText("Number of opponents"), { target: { value: "3" } });
    expect(screen.getAllByLabelText(/Style for Bot/)).toHaveLength(3);
    expect(useSessionStore.getState().settings.personas).toHaveLength(3);
  });

  it("applying a preset populates the seats", () => {
    render(<SetupScreen onDeal={() => {}} />);
    fireEvent.change(screen.getByLabelText("Number of opponents"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "aggro" }));
    expect(useSessionStore.getState().settings.personas).toHaveLength(3);
  });

  it("coaching depth uses a radiogroup with aria-checked", () => {
    render(<SetupScreen onDeal={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: /coaching depth/i });
    expect(group).toBeInTheDocument();
    const equity = screen.getByRole("radio", { name: /equity/i });
    expect(equity).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: /conceptual/i }));
    expect(screen.getByRole("radio", { name: /conceptual/i })).toHaveAttribute("aria-checked", "true");
    expect(useSessionStore.getState().settings.coachingDepth).toBe("conceptual");
  });

  it("each style dropdown has a tooltip describing its selected style", () => {
    render(<SetupScreen onDeal={() => {}} />);
    const bot1Style = screen.getByLabelText("Style for Bot 1");
    // default persona style is TAG → tooltip explains Tight-Aggressive
    expect(bot1Style).toHaveAttribute("title", expect.stringContaining("Tight-Aggressive"));

    fireEvent.change(bot1Style, { target: { value: "Calling Station" } });
    expect(screen.getByLabelText("Style for Bot 1")).toHaveAttribute(
      "title",
      expect.stringContaining("loose-passive"),
    );
  });

  it("Deal triggers the start callback", () => {
    const onDeal = vi.fn();
    render(<SetupScreen onDeal={onDeal} />);
    fireEvent.click(screen.getByRole("button", { name: "Deal" }));
    expect(onDeal).toHaveBeenCalledOnce();
  });
});
