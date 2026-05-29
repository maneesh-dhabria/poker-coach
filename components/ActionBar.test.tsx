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

  it("exposes ½/¾/pot quick-sizing buttons that set a pot-relative, legal amount (FR-52)", () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 200 }}
        onAction={onAction}
        pot={20}
      />,
    );
    // All three quick-size affordances present and labeled for a11y.
    expect(screen.getByLabelText("Size to half pot")).toBeInTheDocument();
    expect(screen.getByLabelText("Size to three-quarter pot")).toBeInTheDocument();
    const potBtn = screen.getByLabelText("Size to pot");

    // Pot button → bet of $20 (pot*1, toCall 0), within [2,200].
    fireEvent.click(potBtn);
    expect(screen.getByTestId("bet-size")).toHaveTextContent("$20");
    fireEvent.click(screen.getByRole("button", { name: /bet \$20/i }));
    expect(onAction).toHaveBeenCalledWith({ type: "bet", amount: 20 });

    // Half-pot → $10.
    fireEvent.click(screen.getByLabelText("Size to half pot"));
    expect(screen.getByTestId("bet-size")).toHaveTextContent("$10");
  });

  it("clamps a pot-sized bet up to the legal minimum when the pot is tiny (FR-52, always legal)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 5, maxRaiseTo: 200 }}
        onAction={() => {}}
        pot={4}
      />,
    );
    fireEvent.click(screen.getByLabelText("Size to half pot")); // 0.5*4=2 → clamped up to min 5
    expect(screen.getByTestId("bet-size")).toHaveTextContent("$5");
  });

  it("hides quick-size buttons when there is no sizing action", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call"], toCall: 5, minRaiseTo: 0, maxRaiseTo: 0 }}
        onAction={() => {}}
        pot={20}
      />,
    );
    expect(screen.queryByLabelText("Size to pot")).toBeNull();
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
