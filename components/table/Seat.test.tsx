import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Seat } from "@/components/table/Seat";

const baseSeat = {
  seat: 3,
  name: "Bot",
  isHero: false,
  position: "CO",
  stack: 100,
  folded: false,
  isButton: false,
  cards: null,
  net: null,
} as any;

describe("Seat", () => {
  it("applies acting-glow to the seat to act", () => {
    const { container } = render(<Seat seat={baseSeat} isActing />);
    expect(container.querySelector(".acting-glow")).toBeTruthy();
  });

  it("does not apply acting-glow when not acting", () => {
    const { container } = render(<Seat seat={baseSeat} />);
    expect(container.querySelector(".acting-glow")).toBeFalsy();
  });
});

describe("Seat — showdown winner glow + net chip (T8)", () => {
  it("marks the winner seat and shows a positive net chip", () => {
    const { container, getByText } = render(
      <Seat seat={baseSeat} isWinner net={120} bigBlind={2} />,
    );
    expect(container.querySelector(".winner-glow")).toBeTruthy();
    expect(getByText(/\+\$120/)).toBeTruthy();
  });

  it("shows a negative net chip with a minus glyph (NFR-05)", () => {
    const { getByText } = render(<Seat seat={baseSeat} net={-40} bigBlind={2} />);
    expect(getByText(/-\$40/)).toBeTruthy();
  });

  it("renders no net chip while the hand is live (net null)", () => {
    const { container } = render(<Seat seat={baseSeat} />);
    expect(container.querySelector(".netchip")).toBeFalsy();
  });
});
