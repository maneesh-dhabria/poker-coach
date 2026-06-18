import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ActionBar } from "@/components/ActionBar";
import { Seat, shouldRevealHoleCards } from "@/components/table/Seat";
import { Card } from "@/core/cards";
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

    fireEvent.change(slider, { target: { value: "500" } }); // beyond max → clamps to 100
    // 100 === maxRaiseTo (the hero's all-in raise-to), so the button now reads "All-in $100" rather
    // than "Raise to $100" (iter-23 MINOR #2). The clamp behavior under test is unchanged — the action
    // still fires the clamped amount; only the label says All-in because the clamp landed on the stack.
    fireEvent.click(screen.getByRole("button", { name: /all-in \$100/i }));
    expect(onAction).toHaveBeenCalledWith({ type: "raise", amount: 100 });
  });

  // iter-22 NIT #8: the slider uses a FINE step (1 small blind = $1 at $1/$2) so a precise size can be
  // dialed by keyboard — the default (max−min)/100 jumped ~$48 on a deep stack (the reviewer's gripe).
  it("uses a fine 1-small-blind slider step for precise keyboard sizing (iter-22 NIT #8)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call", "raise"], toCall: 8, minRaiseTo: 16, maxRaiseTo: 1000 }}
        onAction={vi.fn()}
        bigBlind={2}
      />,
    );
    expect(screen.getByRole("slider")).toHaveAttribute("step", "1"); // 1 SB, not ~$10/$48
  });

  // iter-22 NIT #8: a subtle "overbet" hint appears when the chosen size puts MORE than the pot in —
  // no hard block, just a cue. Absent for an at-or-below-pot size.
  it("shows an overbet hint only when the size exceeds the pot (iter-22 NIT #8)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 500 }}
        onAction={vi.fn()}
        pot={20}
      />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "10" } }); // half pot → no hint
    expect(screen.queryByTestId("overbet-hint")).not.toBeInTheDocument();
    fireEvent.change(slider, { target: { value: "50" } }); // 50 into a 20 pot → overbet
    expect(screen.getByTestId("overbet-hint")).toBeInTheDocument();
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

  it("hides Fold when checking is free (fold is strictly dominated)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 200 }}
        onAction={() => {}}
        pot={20}
      />,
    );
    expect(screen.queryByRole("button", { name: /fold/i })).toBeNull();
    expect(screen.getByRole("button", { name: /check/i })).toBeInTheDocument();
  });

  it("renders amounts in BB when displayUnit is bb (finding #7 — no mixed units)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call", "raise"], toCall: 8, minRaiseTo: 16, maxRaiseTo: 100 }}
        onAction={() => {}}
        displayUnit="bb"
        bigBlind={2}
      />,
    );
    // $8 to call → 4 BB; the call button and bet size show BB, no "$" anywhere.
    expect(screen.getByRole("button", { name: /call 4 BB/i })).toBeInTheDocument();
    expect(screen.getByTestId("action-bar").textContent).not.toContain("$");
    expect(screen.getByRole("button", { name: /raise to 8 BB/i })).toBeInTheDocument(); // 16 → 8 BB
  });

  it("caps the offered bet/raise max to the effective opponent stack when the hero covers the table (iter-20 #3)", () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 584 }}
        onAction={onAction}
        pot={50}
        effectiveMaxRaiseTo={200}
      />,
    );
    const slider = screen.getByRole("slider");
    // The slider/button never offer above the effective stack ($200), not the hero's $584 all-in.
    expect(slider).toHaveAttribute("max", "200");
    fireEvent.change(slider, { target: { value: "584" } }); // try to drag past the cap
    expect(screen.getByTestId("bet-size")).toHaveTextContent("$200");
    fireEvent.click(screen.getByRole("button", { name: /bet \$200/i }));
    expect(onAction).toHaveBeenCalledWith({ type: "bet", amount: 200 });
  });

  it("leaves the offered max at the hero's all-in when the hero is the SHORT stack (iter-20 #3)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 120 }}
        onAction={() => {}}
        pot={50}
        effectiveMaxRaiseTo={400} // opponents cover far more; hero's own all-in ($120) is the binding cap
      />,
    );
    // Hero's all-in (120) < effective opponent stack (400) → max stays the hero's all-in, unchanged.
    expect(screen.getByRole("slider")).toHaveAttribute("max", "120");
  });

  it("highlights a quick-size button only while the amount matches it, clearing on a non-matching change (iter-21 NIT 1)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 200 }}
        onAction={() => {}}
        pot={20}
      />,
    );
    const potBtn = screen.getByLabelText("Size to pot");
    const slider = screen.getByRole("slider");

    // Click Pot → Pot is active (highlighted).
    fireEvent.click(potBtn);
    expect(screen.getByTestId("bet-size")).toHaveTextContent("$20");
    expect(potBtn).toHaveAttribute("aria-pressed", "true");

    // Drag the slider OFF the pot value → the Pot highlight clears (derived, not sticky).
    fireEvent.change(slider, { target: { value: "12" } });
    expect(potBtn).toHaveAttribute("aria-pressed", "false");

    // Set it back to the pot value → Pot re-highlights.
    fireEvent.change(slider, { target: { value: "20" } });
    expect(potBtn).toHaveAttribute("aria-pressed", "true");
  });

  // iter-23 MINOR #2: when the chosen size commits the hero's ENTIRE remaining stack (sized ===
  // legal.maxRaiseTo, the engine's all-in raise-to) the button must say "All-in" so a newcomer knows
  // the bet busts them. A partial size keeps the plain "Bet $X" / "Raise to $X" label.
  it("the bet button says 'All-in' when the size commits the hero's full remaining stack (iter-23 MINOR #2)", () => {
    const onAction = vi.fn();
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "check", "bet"], toCall: 0, minRaiseTo: 2, maxRaiseTo: 170 }}
        onAction={onAction}
        pot={50}
      />,
    );
    const slider = screen.getByRole("slider");
    // A partial bet ($80 < $170 all-in) → plain "Bet", NOT "All-in", and no whole-stack hint.
    fireEvent.change(slider, { target: { value: "80" } });
    expect(screen.getByRole("button", { name: /^bet \$80$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /all-in/i })).toBeNull();
    expect(screen.queryByTestId("all-in-hint")).not.toBeInTheDocument();

    // Push the entire remaining stack ($170 === maxRaiseTo) → button says "All-in $170" + hint.
    fireEvent.change(slider, { target: { value: "170" } });
    const allInBtn = screen.getByRole("button", { name: /all-in \$170/i });
    expect(allInBtn).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^bet \$170$/i })).toBeNull();
    expect(screen.getByTestId("all-in-hint")).toBeInTheDocument();
    // The engine action is unchanged — it still fires the same bet amount, just labeled All-in.
    fireEvent.click(allInBtn);
    expect(onAction).toHaveBeenCalledWith({ type: "bet", amount: 170 });
  });

  it("a full-stack RAISE also says 'All-in' (iter-23 MINOR #2)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call", "raise"], toCall: 8, minRaiseTo: 16, maxRaiseTo: 100 }}
        onAction={vi.fn()}
      />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "100" } }); // raise-to == all-in
    expect(screen.getByRole("button", { name: /all-in \$100/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /raise to/i })).toBeNull();
  });

  it("shows Fold when facing a bet (no check available)", () => {
    render(
      <ActionBar
        legal={{ toAct: 0, actions: ["fold", "call", "raise"], toCall: 8, minRaiseTo: 16, maxRaiseTo: 100 }}
        onAction={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /fold/i })).toBeInTheDocument();
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

  it("shows an action badge for an opponent's latest action (observation #3)", () => {
    render(<Seat seat={base} lastAction={{ action: "raise", amount: 6 }} />);
    expect(screen.getByTestId("seat-action").textContent).toBe("Raise $6");
  });

  it("does not show an action badge on the hero seat", () => {
    render(<Seat seat={{ ...base, isHero: true }} lastAction={{ action: "call", amount: 2 }} />);
    expect(screen.queryByTestId("seat-action")).toBeNull();
  });
});

describe("shouldRevealHoleCards (iter-21 NIT 5 — only showdown cards are exposed)", () => {
  const cards: Card[] = ["Ah", "Kh"];
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

  it("reveals the hero's own cards always", () => {
    expect(shouldRevealHoleCards({ isHero: true, folded: false, cards })).toBe(true);
    // Even a folded hero sees their own cards (their pane is always face-up).
    expect(shouldRevealHoleCards({ isHero: true, folded: true, cards })).toBe(true);
  });

  it("reveals an opponent who reached showdown (not folded, cards present)", () => {
    expect(shouldRevealHoleCards({ isHero: false, folded: false, cards })).toBe(true);
  });

  it("keeps a FOLDED opponent's cards hidden even if cards are attached (mucked)", () => {
    expect(shouldRevealHoleCards({ isHero: false, folded: true, cards })).toBe(false);
  });

  it("hides an opponent with no cards available (no reveal upstream)", () => {
    expect(shouldRevealHoleCards({ isHero: false, folded: false, cards: null })).toBe(false);
  });

  it("renders face-down cards for a folded opponent even when cards are passed in", () => {
    const { container } = render(<Seat seat={{ ...base, folded: true, cards }} />);
    // Folded → only face-down card backs, never a face-up card glyph.
    expect(container.querySelectorAll('[data-testid="card"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="card-back"]')).toHaveLength(2);
  });

  it("renders face-up cards for an opponent who reached showdown", () => {
    const { container } = render(<Seat seat={{ ...base, folded: false, cards }} />);
    expect(container.querySelectorAll('[data-testid="card"]')).toHaveLength(2);
  });
});
