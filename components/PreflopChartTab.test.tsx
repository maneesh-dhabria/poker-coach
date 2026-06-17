import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PreflopChartTab } from "@/components/PreflopChartTab";

describe("PreflopChartTab", () => {
  it("renders 169 keyboard-reachable cells with action aria-labels", () => {
    const { getAllByRole, getByLabelText } = render(<PreflopChartTab />);
    expect(getAllByRole("button").length).toBeGreaterThanOrEqual(169);
    // every cell is a real <button> labelled "<key>, <action>"
    expect(getByLabelText(/AKs, (raise|call|fold)/)).toBeTruthy();
  });

  it("shows a plain-language detail card on cell click", () => {
    const { getByLabelText, getByText } = render(<PreflopChartTab />);
    fireEvent.click(getByLabelText(/AKs, /));
    expect(getByText(/wins ~\d+ out of 100 vs a random hand/i)).toBeTruthy();
    expect(getByText(/baseline/i)).toBeTruthy();
    expect(getByText(/overstates/i)).toBeTruthy(); // the honest vs-random caveat
  });

  it("offers a position selector with all six table positions", () => {
    const { getByLabelText } = render(<PreflopChartTab />);
    const select = getByLabelText(/position/i) as HTMLSelectElement;
    expect(select).toBeTruthy();
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toEqual(expect.arrayContaining(["UTG", "MP", "CO", "BTN", "SB", "BB"]));
  });

  it("defaults to the player's actual seat when known (finding #10)", () => {
    const { getByLabelText } = render(<PreflopChartTab heroPosition="CO" />);
    const select = getByLabelText(/position/i) as HTMLSelectElement;
    expect(select.value).toBe("CO");
  });

  it("falls back to BTN when no hand / seat is known", () => {
    const { getByLabelText } = render(<PreflopChartTab />);
    const select = getByLabelText(/position/i) as HTMLSelectElement;
    expect(select.value).toBe("BTN");
  });

  it("lets the user override the position; the manual pick sticks", () => {
    const { getByLabelText } = render(<PreflopChartTab heroPosition="CO" />);
    const select = getByLabelText(/position/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "UTG" } });
    expect(select.value).toBe("UTG");
  });
});
