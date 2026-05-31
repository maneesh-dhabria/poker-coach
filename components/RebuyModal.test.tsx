import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { RebuyModal } from "@/components/RebuyModal";

describe("RebuyModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RebuyModal
        open={false}
        heroStack={1}
        startingStack={200}
        bank={500}
        displayUnit="usd"
        bigBlind={2}
        onRebuy={() => {}}
        onNewTable={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("offers a rebuy when the bank can fund the top-up", () => {
    const { getByRole } = render(
      <RebuyModal
        open
        heroStack={1}
        startingStack={200}
        bank={500}
        displayUnit="usd"
        bigBlind={2}
        onRebuy={() => {}}
        onNewTable={() => {}}
      />,
    );
    expect(getByRole("button", { name: /rebuy/i })).toBeTruthy();
  });

  it("shows out-of-chips / new table (no rebuy CTA) when the bank is empty", () => {
    const { queryByRole, getAllByText } = render(
      <RebuyModal
        open
        heroStack={1}
        startingStack={200}
        bank={0}
        displayUnit="usd"
        bigBlind={2}
        onRebuy={() => {}}
        onNewTable={() => {}}
      />,
    );
    expect(queryByRole("button", { name: /rebuy/i })).toBeNull();
    expect(getAllByText(/out of chips|new table/i).length).toBeGreaterThan(0);
  });

  it("fires onRebuy from a real button", () => {
    const onRebuy = vi.fn();
    const { getByRole } = render(
      <RebuyModal
        open
        heroStack={1}
        startingStack={200}
        bank={500}
        displayUnit="usd"
        bigBlind={2}
        onRebuy={onRebuy}
        onNewTable={() => {}}
      />,
    );
    fireEvent.click(getByRole("button", { name: /rebuy/i }));
    expect(onRebuy).toHaveBeenCalled();
  });

  it("fires onNewTable from the empty-bank end state", () => {
    const onNewTable = vi.fn();
    const { getByRole } = render(
      <RebuyModal
        open
        heroStack={0}
        startingStack={200}
        bank={0}
        displayUnit="usd"
        bigBlind={2}
        onRebuy={() => {}}
        onNewTable={onNewTable}
      />,
    );
    fireEvent.click(getByRole("button", { name: /new table/i }));
    expect(onNewTable).toHaveBeenCalled();
  });

  it("renders an auto-rebuy toggle that fires onToggleAuto when funds allow", () => {
    const onToggleAuto = vi.fn();
    const { getByRole } = render(
      <RebuyModal
        open
        heroStack={1}
        startingStack={200}
        bank={500}
        autoRebuy={false}
        displayUnit="usd"
        bigBlind={2}
        onRebuy={() => {}}
        onToggleAuto={onToggleAuto}
        onNewTable={() => {}}
      />,
    );
    const toggle = getByRole("checkbox", { name: /auto-rebuy/i });
    fireEvent.click(toggle);
    expect(onToggleAuto).toHaveBeenCalledWith(true);
  });
});
