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

describe("sessionStore.mentalMathOpen (FR-18)", () => {
  it("defaults collapsed and the setter toggles it", () => {
    expect(useSessionStore.getState().mentalMathOpen).toBe(false);
    useSessionStore.getState().setMentalMathOpen(true);
    expect(useSessionStore.getState().mentalMathOpen).toBe(true);
    useSessionStore.getState().setMentalMathOpen(false);
    expect(useSessionStore.getState().mentalMathOpen).toBe(false);
  });
});
