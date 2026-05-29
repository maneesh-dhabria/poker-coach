import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ActionBar } from "@/components/ActionBar";
import { Seat } from "@/components/table/Seat";
import { TableSeatView } from "@/core/handFlow";

beforeEach(() => cleanup());

describe("ActionBar", () => {
  it("renders only the legal actions", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call"], toCall: 8, minRaiseTo: 0, maxRaiseTo: 0 }}
        onAction={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /fold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /call/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /raise/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /check/i })).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("clamps the raise slider to [min,max] and raises to the clamped value", () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call", "raise"], toCall: 8, minRaiseTo: 16, maxRaiseTo: 100 }}
        onAction={onAction}
      />,
    );
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("min", "16");
    expect(slider).toHaveAttribute("max", "100");

    fireEvent.change(slider, { target: { value: "500" } }); // beyond max
    fireEvent.click(screen.getByRole("button", { name: /raise to/i }));
    expect(onAction).toHaveBeenCalledWith({ type: "raise", amount: 100 });
  });
});

describe("Seat", () => {
  const base: TableSeatView = {
    seat: 1,
    name: "Bot 1",
    isHero: false,
    position: "BTN",
    stack: 100,
    folded: false,
    isButton: true,
    cards: null,
  };

  it("dims a folded seat", () => {
    const { container } = render(<Seat seat={{ ...base, folded: true }} />);
    expect(container.querySelector('[data-folded="true"]')).toBeInTheDocument();
  });

  it("shows the dealer button marker", () => {
    render(<Seat seat={base} />);
    expect(screen.getByLabelText("dealer button")).toBeInTheDocument();
  });
});
