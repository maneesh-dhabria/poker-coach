"use client";
// The right column as a tab host (spec FR-03, FR-04, FR-07; wireframe 02). The TabStrip is pinned;
// only #tab-body scrolls (the single scroll region of the no-scroll shell, plan D4). Three tabs:
// Live Feedback (FeedbackPanel + HandRecap stacked, FR-05), Coaching (CoachingViewer, FR-07), and
// References (RankingsTab + PreflopChartTab stacked, FR-06).
import { useSessionStore } from "@/store/sessionStore";
import { useGameStore } from "@/store/gameStore";
import { TabStrip } from "@/components/TabStrip";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { CoachingViewer } from "@/components/CoachingViewer";
import { HandRecap } from "@/components/HandRecap";
import { RankingsTab } from "@/components/RankingsTab";
import { PreflopChartTab } from "@/components/PreflopChartTab";
import { CoachingDepth } from "@/core/analysis/types";

const STREET_ORDER = ["preflop", "flop", "turn", "river"] as const;

// In-play coaching controls (iter-13 #3): change coaching depth + toggle instant feedback WITHOUT
// starting a new session. Writes through useSessionStore().setSettings — the same field the setup
// screen sets — so the live feedback re-renders at the new depth (components read settings) and the
// feedback toggle behaves exactly like the setup-screen one. Compact, in the live-feedback tab header.
const DEPTH_OPTIONS: { value: CoachingDepth; label: string }[] = [
  { value: "conceptual", label: "Conceptual" },
  { value: "equity", label: "Equity" },
  { value: "strict", label: "Strict" },
];

function InPlayControls() {
  const settings = useSessionStore((s) => s.settings);
  const setSettings = useSessionStore((s) => s.setSettings);
  return (
    <div
      data-testid="inplay-controls"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
        padding: "8px 10px",
        background: "var(--panel-2, #1d2c26)",
        border: "1px solid #2a3a32",
        borderRadius: "var(--r-md)",
        fontSize: 12,
      }}
    >
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)" }}>
        Depth
        <select
          data-testid="inplay-depth"
          value={settings.coachingDepth}
          onChange={(e) => setSettings({ coachingDepth: e.target.value as CoachingDepth })}
          style={{
            background: "var(--panel)",
            color: "var(--ink)",
            border: "1px solid #2a3a32",
            borderRadius: "var(--r-md)",
            padding: "2px 6px",
            fontSize: 12,
          }}
        >
          {DEPTH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-soft)", cursor: "pointer" }}>
        <input
          data-testid="inplay-feedback-toggle"
          type="checkbox"
          checked={settings.feedbackEnabled}
          onChange={(e) => setSettings({ feedbackEnabled: e.target.checked })}
        />
        Instant feedback
      </label>
    </div>
  );
}

export function RightPanel() {
  const activeTab = useSessionStore((s) => s.activeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const settings = useSessionStore((s) => s.settings);
  const sessionId = useSessionStore((s) => s.sessionId);
  const displayUnit = useSessionStore((s) => s.displayUnit);

  const feedback = useGameStore((s) => s.feedback);
  const flow = useGameStore((s) => s.flow);
  useGameStore((s) => s.tick); // re-render on game changes

  // Is the hero deciding a fresh street whose verdict hasn't been computed yet? If so, the `feedback`
  // we'd render describes an EARLIER decision (e.g. preflop while deciding the flop). Compare the
  // live spot's street to the last verdict's street to detect that staleness (finding #5).
  const heroTurn = flow?.isHeroTurn() ?? false;
  const handOver = flow?.isOver() ?? false;
  const pendingStreet = heroTurn && flow ? flow.heroSpot().street : null;
  const isStale =
    !!pendingStreet &&
    !!feedback &&
    STREET_ORDER.indexOf(pendingStreet as (typeof STREET_ORDER)[number]) >
      STREET_ORDER.indexOf(feedback.street as (typeof STREET_ORDER)[number]);

  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <TabStrip active={activeTab} onSelect={setActiveTab} />
      <div
        id="tab-body"
        data-testid="tab-body"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 12 }}
      >
        {activeTab === "live-feedback" && (
          <>
            {/* In-play coaching controls (iter-13 #3): switch depth / toggle instant feedback without a
                new session. Always shown on the live-feedback tab so the user can compare modes mid-play. */}
            <InPlayControls />
            {/* While a NEW street's decision is pending, the last verdict describes a PRIOR decision
                (e.g. preflop while you're deciding the flop). iter-02 blanked this to an empty
                "Deciding your <street>…" placeholder so two unrelated win%/EV figures never read AS
                the current spot — but because bots act instantly, an instant-feedback newcomer then
                NEVER got to read the verdict + equity bar + Mental Math they turned on (iter-09 #3).
                So instead of blanking, we KEEP the prior decision's full feedback visible and
                READABLE, clearly RE-LABELED ("Your last decision — <street>") with a line saying
                you're now deciding a later street and this updates when you act — so it can't be
                mistaken for the current spot. (At end-of-hand the feedback clears, which is fine.) */}
            {settings.feedbackEnabled && feedback ? (
              <FeedbackPanel
                analysis={feedback.analysis ?? null}
                enabled={settings.feedbackEnabled}
                displayUnit={displayUnit}
                priorDecision={
                  pendingStreet && isStale ? { pendingStreet } : null
                }
                context={{
                  street: feedback.street,
                  potBefore: feedback.spot.potBefore,
                  toCall: feedback.spot.toCall,
                  // The action the verdict judges — lets the panel keep the call/draw pot-odds
                  // framing and the "call" EV row to facing-a-bet continue decisions (#2, #8).
                  action: feedback.heroAction.action,
                }}
              />
            ) : settings.feedbackEnabled ? (
              <FeedbackPanel
                analysis={null}
                enabled={settings.feedbackEnabled}
                displayUnit={displayUnit}
              />
            ) : null}
            {/* Empty state: a big blank pane reads as "broken", so tell the user feedback is coming
                (only while feedback is on and no decision has been graded yet — once there's a
                verdict, we keep showing it relabeled as the prior decision rather than blanking). */}
            {settings.feedbackEnabled && !feedback?.analysis ? (
              <aside data-testid="feedback-empty" className="card" style={{ maxWidth: 420 }}>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  <strong>Make your move</strong> — after each of your decisions I&apos;ll break down
                  the verdict, your equity, and the plain-English math right here.
                </p>
              </aside>
            ) : null}
            {/* Feedback OFF: don't silently blank the panel during play — say it's intentional and
                how to turn it back on (finding #8). The post-hand Hand review still shows below. */}
            {!settings.feedbackEnabled && !handOver ? (
              <aside data-testid="feedback-off" className="card" style={{ maxWidth: 420 }}>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  <strong>Instant per-decision verdicts are off.</strong> You&apos;ll still see the
                  running hand review below populate after each move as you play; the big verdict and
                  equity block is hidden. Flip <em>Instant feedback</em> back on above to show it again.
                </p>
              </aside>
            ) : null}
            {flow ? (
              <HandRecap
                decisions={flow.decisions()}
                heroNet={flow.tableView().heroNet}
                displayUnit={displayUnit}
                handComplete={handOver}
              />
            ) : null}
          </>
        )}
        {activeTab === "coaching" && <CoachingViewer sessionId={sessionId} />}
        {activeTab === "references" && (
          <>
            <RankingsTab />
            <PreflopChartTab />
          </>
        )}
      </div>
    </div>
  );
}
