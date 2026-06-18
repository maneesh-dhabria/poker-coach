import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSessionStore, defaultSettings } from "@/store/sessionStore";
import { useGameStore } from "@/store/gameStore";
import { personaFor } from "@/core/bots/personas";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes("/api/sessions") ? { id: "sess-x" } : { ok: true }),
    })),
  );
});

describe("sessionStore.startSession", () => {
  it("posts settings and stores the returned sessionId", async () => {
    const id = await useSessionStore.getState().startSession();
    expect(id).toBe("sess-x");
    expect(useSessionStore.getState().sessionId).toBe("sess-x");
    expect(fetch).toHaveBeenCalledWith("/api/sessions", expect.objectContaining({ method: "POST" }));
  });
});

describe("gameStore", () => {
  it("records an analyzed decision on a hero action and saves on hand-over", async () => {
    const settings = {
      ...defaultSettings(),
      numOpponents: 1,
      personas: [personaFor("Calling Station", "Beginner")], // calls down → reaches showdown
    };
    useGameStore.getState().configure("sess-x", settings, 42);
    useGameStore.getState().newHand();

    let guard = 0;
    while (!useGameStore.getState().flow!.isOver() && guard++ < 50) {
      const flow = useGameStore.getState().flow!;
      if (!flow.isHeroTurn()) break;
      const acts = flow.heroSpot().legal.actions;
      const action = acts.includes("check")
        ? { type: "check" as const }
        : acts.includes("call")
          ? { type: "call" as const }
          : { type: "fold" as const };
      await useGameStore.getState().heroAct(action);
    }

    const feedback = useGameStore.getState().feedback;
    expect(feedback).not.toBeNull();
    expect(["good", "thin", "mistake"]).toContain(feedback!.analysis.verdict);

    expect(useGameStore.getState().flow!.isOver()).toBe(true);
    expect(useGameStore.getState().saveStatus).toBe("saved");
    expect(fetch).toHaveBeenCalledWith("/api/hands", expect.objectContaining({ method: "POST" }));
  });
});

// iter-14 #1/#2: setCoachingDepth re-derives the current hand's recorded decisions + the panel's
// feedback at the new depth, so an in-play switch takes full effect without a new session.
describe("gameStore.setCoachingDepth (in-play depth)", () => {
  it("re-derives the recorded decisions + feedback to the new depth, preserving the verdict", async () => {
    const settings = {
      ...defaultSettings(),
      numOpponents: 1,
      personas: [personaFor("Calling Station", "Beginner")],
    };
    useGameStore.getState().configure("sess-x", settings, 42);
    useGameStore.getState().newHand();

    let guard = 0;
    while (!useGameStore.getState().flow!.isOver() && guard++ < 50) {
      const flow = useGameStore.getState().flow!;
      if (!flow.isHeroTurn()) break;
      const acts = flow.heroSpot().legal.actions;
      const action = acts.includes("check")
        ? { type: "check" as const }
        : acts.includes("call")
          ? { type: "call" as const }
          : { type: "fold" as const };
      await useGameStore.getState().heroAct(action);
    }

    const before = useGameStore.getState().feedback!;
    expect(before.analysis.coachingDepth).toBe("equity");

    useGameStore.getState().setCoachingDepth("conceptual");
    const after = useGameStore.getState().feedback!;
    // The feedback the panel reads is now at the new depth (copy switched)...
    expect(after.analysis.coachingDepth).toBe("conceptual");
    // ...the verdict is depth-independent and unchanged...
    expect(after.analysis.verdict).toBe(before.analysis.verdict);
    // ...and every recorded decision in the current hand is re-derived too.
    expect(
      useGameStore.getState().flow!.decisions().every((d) => d.analysis.coachingDepth === "conceptual"),
    ).toBe(true);
  });
});

// iter-20 MINOR #1 (REGRESSION): a fresh hand dealt while a depth is active must grade its FIRST
// decision at THAT depth — no re-toggle. The bug: gameStore kept its own `settings` copy (seeded by
// configure) and newHand() read THAT copy's coachingDepth; an in-play depth change updated only the
// session store + re-graded the current hand, leaving gameStore.settings.coachingDepth stale, so the
// next deal built its flow at the deal-time depth and leaked numbers on the first decision. Fix:
// setCoachingDepth mirrors the depth into gameStore.settings so the next deal reads the live depth.
describe("gameStore — fresh deal honors the active depth without a re-toggle (iter-20 #1)", () => {
  async function actOnce() {
    const flow = useGameStore.getState().flow!;
    if (!flow.isHeroTurn()) return;
    const acts = flow.heroSpot().legal.actions;
    const action = acts.includes("check")
      ? { type: "check" as const }
      : acts.includes("call")
        ? { type: "call" as const }
        : { type: "fold" as const };
    await useGameStore.getState().heroAct(action);
  }

  it("switch to conceptual mid-session, deal a fresh hand → first decision is conceptual (no re-toggle)", async () => {
    const settings = {
      ...defaultSettings(),
      numOpponents: 1,
      personas: [personaFor("Calling Station", "Beginner")],
    };
    useGameStore.getState().configure("sess-x", settings, 42);
    useGameStore.getState().newHand(); // dealt at the default "equity" depth
    await actOnce();
    expect(useGameStore.getState().feedback!.analysis.coachingDepth).toBe("equity");

    // The user flips the panel depth control to Conceptual mid-session (mirrors RightPanel.changeDepth:
    // it also calls setSettings on the SESSION store, but the gameStore deal reads its OWN settings).
    useGameStore.getState().setCoachingDepth("conceptual");

    // Deal a brand-new hand and act — its FIRST decision must be conceptual with NO intervening toggle.
    useGameStore.getState().newHand();
    await actOnce();
    const fresh = useGameStore.getState().feedback!;
    expect(fresh.analysis.coachingDepth).toBe("conceptual");
    // Conceptual is digit-free: the freshly-dealt first decision's copy carries no digits.
    expect(fresh.analysis.plainExplanation).not.toMatch(/\d/);
  });
});

describe("sessionStore.mentalMathOpen (FR-18)", () => {
  it("defaults collapsed and the setter toggles it", () => {
    expect(useSessionStore.getState().mentalMathOpen).toBe(false);
    useSessionStore.getState().setMentalMathOpen(true);
    expect(useSessionStore.getState().mentalMathOpen).toBe(true);
    useSessionStore.getState().setMentalMathOpen(false);
    expect(useSessionStore.getState().mentalMathOpen).toBe(false);
  });
});
