import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { HeaderBar } from "@/components/HeaderBar";

describe("HeaderBar", () => {
  it("shows a winning session P/L with an up arrow and the bank via formatMoney", () => {
    const { getByText } = render(
      <HeaderBar sessionPnl={120} bank={1760} displayUnit="usd" bigBlind={2} />,
    );
    expect(getByText(/▲/)).toBeTruthy();
    expect(getByText(/\$1760/)).toBeTruthy();
    expect(getByText(/\$120/)).toBeTruthy();
  });

  it("shows a losing session P/L with a down arrow and a sign-paired amount (NFR-05)", () => {
    const { getByText } = render(
      <HeaderBar sessionPnl={-40} bank={960} displayUnit="usd" bigBlind={2} />,
    );
    expect(getByText(/▼/)).toBeTruthy();
    expect(getByText(/-\$40/)).toBeTruthy();
  });

  it("renders amounts in BB when the display unit is bb", () => {
    const { getByText } = render(
      <HeaderBar sessionPnl={20} bank={1000} displayUnit="bb" bigBlind={2} />,
    );
    expect(getByText(/10 BB/)).toBeTruthy();
    expect(getByText(/500 BB/)).toBeTruthy();
  });

  it("fires New table and New hand callbacks from real buttons", () => {
    const onNewTable = vi.fn();
    const onNewHand = vi.fn();
    const { getByRole } = render(
      <HeaderBar
        sessionPnl={0}
        bank={1000}
        displayUnit="usd"
        bigBlind={2}
        onNewTable={onNewTable}
        onNewHand={onNewHand}
      />,
    );
    fireEvent.click(getByRole("button", { name: /new table/i }));
    fireEvent.click(getByRole("button", { name: /new hand/i }));
    expect(onNewTable).toHaveBeenCalled();
    expect(onNewHand).toHaveBeenCalled();
  });
});
