// T2 — the right column is a tab host. Only the tab body (#tab-body) scrolls; the strip is pinned.
// Tabs are real role="tab" buttons with aria-selected; the selected panel renders in #tab-body.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { RightPanel } from "@/components/RightPanel";
import { useSessionStore, defaultSettings } from "@/store/sessionStore";
import { useGameStore } from "@/store/gameStore";
import { analyze } from "@/core/analysis/analyze";
import { Card, mulberry32 } from "@/core/cards";
import { startHand } from "@/core/handFlow";
import { personaFor } from "@/core/bots/personas";
import { equity } from "@/core/equity/equity";

const c = (s: string) => s as Card;

// A REAL HandFlow played to at least one hero decision — so an in-play depth switch exercises the
// genuine re-derive path (gameStore.setCoachingDepth → flow.reanalyzeAt), not a hand-swapped double.
function realFlowWithOneDecision() {
  const flow = startHand({
    config: { smallBlind: 1, bigBlind: 2, startingStackBb: 100 },
    seats: [
      { seat: 0, name: "You", isHero: true, stack: 200, persona: null },
      { seat: 1, name: "Sta", isHero: false, stack: 200, persona: personaFor("Calling Station", "Beginner") },
    ],
    buttonIndex: 1,
    rng: mulberry32(9),
    sessionId: "s",
    handNumber: 1,
    coachingDepth: "equity",
  });
  let guard = 0;
  while (!flow.isOver() && flow.isHeroTurn() && guard++ < 30) {
    const spot = flow.heroSpot();
    const eq = equity({
      hero: spot.hole,
      board: spot.board,
      numOpponents: Math.max(1, spot.numActiveOpponents),
      iterations: 300,
      seed: 5 + guard,
    }).equityPct;
    const action = spot.legal.actions.includes("check")
      ? { type: "check" as const }
      : { type: "call" as const };
    flow.heroAct(action, eq);
  }
  return flow;
}

// Minimal HandFlow stand-in exposing only what RightPanel reads.
function fakeFlow(opts: { street?: string; heroTurn?: boolean; over?: boolean } = {}) {
  const street = opts.street ?? "flop";
  return {
    isHeroTurn: () => opts.heroTurn ?? true,
    isOver: () => opts.over ?? false,
    heroSpot: () => ({
      legal: {},
      hole: [c("Ah"), c("2h")] as [Card, Card],
      board: [c("4h"), c("Ac"), c("3d")],
      potBefore: 32,
      toCall: 12,
      street,
      position: "BTN",
      numActiveOpponents: 1,
      facing: "unopened",
      stackBb: 100,
    }),
    heroHole: () => [c("Ah"), c("2h")] as [Card, Card],
    board: [c("4h"), c("Ac"), c("3d")],
    street,
    potNow: () => 32,
    decisions: () => [],
    tableView: () => ({
      seats: [{ isHero: true, folded: false }, { isHero: false, folded: false }],
      heroNet: null,
    }),
  };
}

beforeEach(() => {
  cleanup();
  useSessionStore.setState({ settings: defaultSettings() });
  useSessionStore.getState().setActiveTab("live-feedback");
  act(() => useGameStore.setState({ flow: null, feedback: null, tick: 0 }));
});

describe("RightPanel", () => {
  it("shows Live Feedback by default and only the tab body scrolls", () => {
    const { container } = render(<RightPanel />);
    const body = container.querySelector('[data-testid="tab-body"]') as HTMLElement;
    expect(body.id).toBe("tab-body");
    expect(body.style.overflowY).toBe("auto");
    expect(screen.getByRole("tab", { name: /live feedback/i })).toHaveAttribute("aria-selected", "true");
  });

  it("renders exactly three tabs and no legacy standalone tabs", () => {
    render(<RightPanel />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /live feedback/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /coaching/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /references/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /^hands$/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /^rankings$/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /preflop/i })).toBeNull();
  });

  it("switches to References on click", () => {
    render(<RightPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /references/i }));
    expect(screen.getByRole("tab", { name: /references/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /live feedback/i })).toHaveAttribute("aria-selected", "false");
  });

  it("shows a friendly empty state on Live Feedback before any decision (not a blank pane)", () => {
    render(<RightPanel />);
    const empty = screen.getByTestId("feedback-empty");
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toMatch(/make your move/i);
  });

  it("keeps the prior decision's verdict + equity visible, relabeled, when deciding a later street (#3)", () => {
    // iter-09 #3 REVERSES iter-02's blanking: bots act instantly, so blanking the rich panel to an
    // empty placeholder meant instant-feedback users could never read the verdict/equity/Mental Math
    // they turned on. Now we KEEP the prior decision's full feedback visible but clearly RE-LABELED
    // ("Your last decision — preflop" + "now deciding your flop; updates when you act") so it can't be
    // mistaken for the current spot.
    const preflopVerdict = {
      decisionId: "h1-d1",
      street: "preflop",
      spot: { potBefore: 6, toCall: 2, position: "BTN", stackBb: 100, numActiveOpponents: 1, facing: "unopened" },
      heroAction: { action: "call", amount: 2 },
      analysis: analyze({ action: "call", potBefore: 6, toCall: 2, equityPct: 42, unit: "usd" }),
    };
    act(() =>
      useGameStore.setState({ flow: fakeFlow({ street: "flop", heroTurn: true }) as never, feedback: preflopVerdict as never, tick: 1 }),
    );
    render(<RightPanel />);
    // The prior verdict + equity ARE still rendered (no blank placeholder).
    expect(screen.getByTestId("verdict-badge")).toBeInTheDocument();
    expect(screen.getByTestId("equity-bar")).toBeInTheDocument();
    // …and clearly labeled as the PREVIOUS decision, naming the street it described and the new spot.
    const prior = screen.getByTestId("feedback-prior");
    expect(prior.textContent).toMatch(/your last decision/i);
    expect(prior.textContent).toMatch(/preflop/i);
    expect(prior.textContent).toMatch(/now deciding your flop/i);
    expect(prior.textContent).toMatch(/updates when you act/i);
    // The old empty pending placeholder is gone.
    expect(screen.queryByTestId("feedback-pending")).toBeNull();
  });

  it("does NOT show the prior-decision banner when the shown verdict IS the current spot (#3)", () => {
    // Same street: the feedback describes the spot the hero is in, so no "last decision" relabeling.
    const flopVerdict = {
      decisionId: "h1-d2",
      street: "flop",
      spot: { potBefore: 32, toCall: 12, position: "BTN", stackBb: 100, numActiveOpponents: 1, facing: "unopened" },
      heroAction: { action: "call", amount: 12 },
      analysis: analyze({ action: "call", potBefore: 32, toCall: 12, equityPct: 47, unit: "usd" }),
    };
    act(() =>
      useGameStore.setState({ flow: fakeFlow({ street: "flop", heroTurn: false }) as never, feedback: flopVerdict as never, tick: 1 }),
    );
    render(<RightPanel />);
    expect(screen.getByTestId("verdict-badge")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-prior")).toBeNull();
  });

  it("shows an intentional 'feedback is off' hint during play that says the review still populates live (#8/iter3 #5)", () => {
    act(() => {
      useSessionStore.setState({ settings: { ...defaultSettings(), feedbackEnabled: false } });
      useGameStore.setState({ flow: fakeFlow({ over: false }) as never, feedback: null, tick: 1 });
    });
    render(<RightPanel />);
    const off = screen.getByTestId("feedback-off");
    // iter-03 #5: the copy must describe what actually happens — only the big verdict/equity block is
    // hidden; the running hand review still populates live after each move (it does NOT wait for the
    // hand to end). So the copy must no longer claim the review only comes "when the hand ends".
    expect(off.textContent).toMatch(/per-decision verdicts are off/i);
    expect(off.textContent).toMatch(/running hand review/i);
    expect(off.textContent).toMatch(/after each move/i);
    expect(off.textContent).not.toMatch(/when the hand ends/i);
  });

  // iter-13 #3 / iter-14 #1+#2: in-play coaching controls change depth WITHOUT a new session. The
  // switch must take FULL effect on the CURRENT hand via the REAL re-derive path (no hand swap):
  // Conceptual strips ALL digits (equity bar gone), Strict shows the chart badge / off-model note.
  it("(iter-14 #1) an in-play switch to Conceptual makes the panel digit-free for an ALREADY-DECIDED spot", () => {
    const flow = realFlowWithOneDecision();
    const latest = flow.decisions()[flow.decisions().length - 1];
    act(() => useGameStore.setState({ flow: flow as never, feedback: latest as never, tick: 1 }));
    render(<RightPanel />);
    // Equity depth shows the equity bar with digits.
    expect(screen.getByTestId("equity-bar")).toBeInTheDocument();
    // Switch depth in-play to Conceptual via the control — the gameStore re-derives the recorded
    // decision through flow.reanalyzeAt; NO manual feedback swap.
    act(() => fireEvent.change(screen.getByTestId("inplay-depth"), { target: { value: "conceptual" } }));
    expect(useSessionStore.getState().settings.coachingDepth).toBe("conceptual");
    // Conceptual: the equity bar (and its digits) are gone — fully switched, not half.
    expect(screen.queryByTestId("equity-bar")).toBeNull();
    const panel = screen.getByTestId("feedback-panel").textContent ?? "";
    expect(panel).not.toMatch(/\d+%/); // no percentages anywhere on the verdict card
  });

  it("(iter-14 #2) an in-play switch to Strict shows the chart badge or off-model note for the decided spot", () => {
    const flow = realFlowWithOneDecision();
    const latest = flow.decisions()[flow.decisions().length - 1];
    act(() => useGameStore.setState({ flow: flow as never, feedback: latest as never, tick: 1 }));
    render(<RightPanel />);
    act(() => fireEvent.change(screen.getByTestId("inplay-depth"), { target: { value: "strict" } }));
    expect(useSessionStore.getState().settings.coachingDepth).toBe("strict");
    // Strict must NOT silently look like Equity: either the gtoClaim "chart-based" badge (a chart spot)
    // or the explicit "No baseline chart covers this spot" note (off-model) is present.
    const panel = screen.getByTestId("feedback-panel").textContent ?? "";
    const hasBadge = /chart-based/.test(panel);
    const hasOffModel = screen.queryByTestId("off-model-note") !== null;
    expect(hasBadge || hasOffModel).toBe(true);
  });

  it("toggling instant feedback off/on in-play hides/shows the live verdict panel", () => {
    const flopVerdict = {
      decisionId: "h1-d2",
      street: "flop",
      spot: { potBefore: 32, toCall: 12, position: "BTN", stackBb: 100, numActiveOpponents: 1, facing: "unopened" },
      heroAction: { action: "call", amount: 12 },
      analysis: analyze({ action: "call", potBefore: 32, toCall: 12, equityPct: 47, unit: "usd" }),
    };
    act(() =>
      useGameStore.setState({ flow: fakeFlow({ street: "flop", heroTurn: false }) as never, feedback: flopVerdict as never, tick: 1 }),
    );
    render(<RightPanel />);
    expect(screen.getByTestId("verdict-badge")).toBeInTheDocument();
    // Toggle feedback OFF in-play.
    fireEvent.click(screen.getByTestId("inplay-feedback-toggle"));
    expect(useSessionStore.getState().settings.feedbackEnabled).toBe(false);
    expect(screen.queryByTestId("verdict-badge")).toBeNull();
    expect(screen.getByTestId("feedback-off")).toBeInTheDocument();
    // Toggle back ON.
    fireEvent.click(screen.getByTestId("inplay-feedback-toggle"));
    expect(useSessionStore.getState().settings.feedbackEnabled).toBe(true);
    expect(screen.getByTestId("verdict-badge")).toBeInTheDocument();
  });

  it("the in-play controls are present on the live-feedback tab", () => {
    render(<RightPanel />);
    expect(screen.getByTestId("inplay-controls")).toBeInTheDocument();
    expect(screen.getByTestId("inplay-depth")).toBeInTheDocument();
    expect(screen.getByTestId("inplay-feedback-toggle")).toBeInTheDocument();
  });

  it("coerces a stale persisted tab key to live-feedback", () => {
    // @ts-expect-error — simulate an old persisted value outside the new union
    useSessionStore.getState().setActiveTab("rankings");
    expect(useSessionStore.getState().activeTab).toBe("live-feedback");
  });
});
