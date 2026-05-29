import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

beforeEach(() => cleanup());

describe("Button", () => {
  it("applies the variant and selected classes (observations #1, #2)", () => {
    render(
      <Button variant="primary" selected>
        Deal
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Deal" });
    expect(btn.className).toContain("btn");
    expect(btn.className).toContain("btn--primary");
    expect(btn.className).toContain("btn--selected");
  });

  it("omits the selected class when not selected", () => {
    render(<Button variant="ghost">Skip</Button>);
    expect(screen.getByRole("button", { name: "Skip" }).className).not.toContain("btn--selected");
  });

  it("forwards aria + role props (so toggles stay accessible)", () => {
    render(
      <Button role="radio" aria-checked aria-label="Equity">
        Equity
      </Button>,
    );
    const btn = screen.getByRole("radio", { name: "Equity" });
    expect(btn).toHaveAttribute("aria-checked", "true");
  });

  it("defaults to type=button", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "button");
  });
});
