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

  // iter-10 #1 (MAJOR): with Position = BB + the unopened/first-in facing the chart has NO open
  // range, so it must NOT render a "Fold AA/AKs from BB" grid or detail — it shows an explanatory
  // panel instead. The big blind never opens unopened (it just checks its option).
  describe("BB + unopened facing (#1)", () => {
    it("shows the explanatory panel, not an all-Fold grid", () => {
      const { getByLabelText, getByTestId, queryByRole } = render(<PreflopChartTab />);
      fireEvent.change(getByLabelText(/position/i), { target: { value: "BB" } });
      // facing defaults to unopened
      expect(getByTestId("chart-bb-no-open")).toBeTruthy();
      // the 13×13 grid is absent (no clickable all-Fold cells)
      expect(queryByRole("grid")).toBeNull();
    });

    it("never shows a 'AA — Fold from BB' or 'AKs — Fold from BB' detail", () => {
      const { getByLabelText, queryByText } = render(<PreflopChartTab heroPosition="BB" />);
      // hero seat BB ⇒ position defaults to BB, facing unopened ⇒ explanatory panel, no grid to click.
      expect(getByLabelText(/facing/i)).toBeTruthy();
      expect(queryByText(/AA — Fold from BB/i)).toBeNull();
      expect(queryByText(/AKs — Fold from BB/i)).toBeNull();
    });

    it("restores a real chart when Facing is switched to 'vs a raise' for BB", () => {
      const { getByLabelText, getByText, getByTestId } = render(<PreflopChartTab heroPosition="BB" />);
      fireEvent.change(getByLabelText(/facing/i), { target: { value: "raise" } });
      // The explanatory panel is gone; AA defends as a raise (a real chart action), not a fold.
      expect(() => getByTestId("chart-bb-no-open")).toThrow();
      fireEvent.click(getByLabelText(/AA, /));
      expect(getByText(/AA — Raise from BB/i)).toBeTruthy();
      // A junk hand the BB folds to a raise shows a real "Fold" — that IS correct vs a raise.
      fireEvent.click(getByLabelText(/72o, /));
      expect(getByText(/72o — Fold from BB/i)).toBeTruthy();
    });
  });

  // iter-11 #2 (MAJOR): the chart only models opening (first-in) ranges per position + BB defense vs a
  // raise. Selecting Facing = "vs a raise" at any NON-BB position has no modeled range, so it must show
  // the explanatory panel — NEVER a fabricated all-Fold grid that reads "AA — Fold from BTN".
  describe("non-BB + vs a raise (#2)", () => {
    for (const pos of ["BTN", "CO", "UTG", "MP", "SB"] as const) {
      it(`${pos} + vs a raise shows the explanatory panel and no 'Fold from ${pos}' detail`, () => {
        const { getByLabelText, getByTestId, queryByRole, queryByText } = render(
          <PreflopChartTab heroPosition={pos} />,
        );
        fireEvent.change(getByLabelText(/facing/i), { target: { value: "raise" } });
        expect(getByTestId("chart-no-range")).toBeTruthy();
        // no grid to click ⇒ no fabricated all-fold cells / detail card
        expect(queryByRole("grid")).toBeNull();
        expect(queryByText(new RegExp(`AA — Fold from ${pos}`, "i"))).toBeNull();
      });
    }

    it("BB + vs a raise still renders the real defend grid (AA is a non-fold action)", () => {
      const { getByLabelText, getByText, queryByTestId, getByRole } = render(
        <PreflopChartTab heroPosition="BB" />,
      );
      fireEvent.change(getByLabelText(/facing/i), { target: { value: "raise" } });
      expect(queryByTestId("chart-no-range")).toBeNull();
      expect(getByRole("grid")).toBeTruthy();
      fireEvent.click(getByLabelText(/AA, /));
      // AA defends — never a fold vs a raise.
      expect(getByText(/AA — (Raise|Call) from BB/i)).toBeTruthy();
    });

    it("first-in (unopened) still renders the real opening grid for each position", () => {
      for (const pos of ["UTG", "MP", "CO", "BTN", "SB"] as const) {
        const { getByLabelText, getByText, getByRole, unmount } = render(
          <PreflopChartTab heroPosition={pos} />,
        );
        // facing defaults to unopened ⇒ real opening grid
        expect(getByRole("grid")).toBeTruthy();
        fireEvent.click(getByLabelText(/AA, /));
        expect(getByText(new RegExp(`AA — Raise from ${pos}`, "i"))).toBeTruthy();
        unmount();
      }
    });
  });
});
