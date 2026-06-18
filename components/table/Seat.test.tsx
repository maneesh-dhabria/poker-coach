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

describe("Seat — all-in badge", () => {
  it("shows ALL-IN and labels the amount as the TOTAL committed this hand (iter-24 NIT 2)", () => {
    // The badge's number is the running TOTAL committed (blinds + prior bets), a DIFFERENT quantity
    // from the all-in BUTTON's chips-this-action. Label it "· $46 in" so the two aren't read as equal.
    const { getByTestId } = render(
      <Seat seat={{ ...baseSeat, allIn: true, allInAmount: 46 } as any} bigBlind={2} />,
    );
    const badge = getByTestId("seat-allin");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toMatch(/ALL-IN/);
    expect(badge.textContent).toMatch(/\$46 in/); // labeled as a total, not a bare "$46"
    expect(badge.getAttribute("title")).toMatch(/committed in total/i);
  });

  it("renders no all-in badge for a seat with chips behind", () => {
    const { queryByTestId } = render(<Seat seat={baseSeat} />);
    expect(queryByTestId("seat-allin")).toBeFalsy();
  });
});
