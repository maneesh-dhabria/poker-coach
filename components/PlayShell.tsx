"use client";
// The play screen as a no-scroll, 100vh, two-column flex shell (spec FR-01/02/03, FR-06, NFR-01).
// Extracted from app/page.tsx into its own module so it can be a named export the structural
// no-scroll contract test renders without driving setup — Next.js page files may only export the
// page default + a fixed allowlist, so a named PlayShell export cannot live in app/page.tsx (plan T1).
// The page itself never scrolls; the right column is a tab host whose #tab-body is the single scroll
// region (T2). The header is the HeaderBar (Session P/L + Bank + New table/New hand — T13), and a
// RebuyModal overlays on hero bust so the table is never dead (T14).
import { useEffect } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { useGameStore } from "@/store/gameStore";
import { useBankrollStore } from "@/store/bankrollStore";
import { PokerTable } from "@/components/table/PokerTable";
import { RightPanel } from "@/components/RightPanel";
import { HeaderBar } from "@/components/HeaderBar";
import { RebuyModal } from "@/components/RebuyModal";
import { Button } from "@/components/ui/Button";

const BIG_BLIND = 2; // table plays a $1/$2 blind, so 1 BB = $2

export function PlayShell({ onNewSession }: { onNewSession: () => void }) {
  const settings = useSessionStore((s) => s.settings);
  const displayUnit = useSessionStore((s) => s.displayUnit);
  const bankroll = useBankrollStore((s) => s.bankroll);
  const flow = useGameStore((s) => s.flow);
  const newHand = useGameStore((s) => s.newHand);
  useGameStore((s) => s.tick); // re-render on game changes

  const bank = bankroll?.bank ?? 0;
  const sessionPnl = bankroll?.sessionPnl ?? 0;
  const startingStack = bankroll?.startingStack ?? settings.startingStackBb * BIG_BLIND;
  const autoRebuy = bankroll?.autoRebuy ?? false;

  // Read the hero's final stack from the engine's table view — the same source gameStore.saveHand
  // uses to carry stacks into the bankroll. A hand that's over with the hero below a big blind is a
  // bust: surface the rebuy choice (unless auto-rebuy already handled it).
  const view = flow?.tableView();
  const heroSeatView = view?.seats.find((s) => s.isHero);
  const heroStack = heroSeatView?.stack ?? startingStack;
  const heroSeat = heroSeatView?.seat ?? 0;
  const handOver = flow?.isOver() ?? false;
  const busted = handOver && heroStack < BIG_BLIND;
  const rebuyOpen = busted && !autoRebuy;

  const doRebuy = async () => {
    await useBankrollStore.getState().rebuy(heroSeat);
    newHand();
  };
  const doNewTable = async () => {
    await useBankrollStore.getState().newTable(settings.startingStackBb * BIG_BLIND, BIG_BLIND);
    newHand();
  };
  const toggleAuto = async (on: boolean) => {
    await useBankrollStore.getState().setAutoRebuy(on);
    if (on && bank >= BIG_BLIND) await doRebuy();
  };

  // Auto-rebuy at hand-end: when the toggle is on and the bank can fund it, top up and deal the next
  // hand without showing the modal (FR-25). Keyed on the over-state so it fires once per bust.
  useEffect(() => {
    if (busted && autoRebuy && bank >= BIG_BLIND) void doRebuy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busted, autoRebuy]);

  return (
    <div
      data-testid="play-shell"
      style={{ height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
    >
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <HeaderBar
            sessionPnl={sessionPnl}
            bank={bank}
            displayUnit={displayUnit}
            bigBlind={BIG_BLIND}
            onNewTable={() => void doNewTable()}
            onNewHand={() => newHand()}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onNewSession} style={{ marginRight: 16 }}>
          New session
        </Button>
      </div>
      <div
        className="play-grid"
        style={{
          flex: 1,
          minHeight: 0,
          padding: "0 16px 16px",
        }}
      >
        <div
          data-testid="left-col"
          style={{ minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          <PokerTable />
        </div>
        <div data-testid="right-col" style={{ minHeight: 0, overflow: "hidden" }}>
          <RightPanel />
        </div>
      </div>
      <RebuyModal
        open={rebuyOpen}
        heroStack={heroStack}
        startingStack={startingStack}
        bank={bank}
        autoRebuy={autoRebuy}
        displayUnit={displayUnit}
        bigBlind={BIG_BLIND}
        onRebuy={() => void doRebuy()}
        onToggleAuto={(on) => void toggleAuto(on)}
        onNewTable={() => void doNewTable()}
      />
    </div>
  );
}
