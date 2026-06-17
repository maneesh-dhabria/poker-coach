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

const STREET_ORDER = ["preflop", "flop", "turn", "river"] as const;

export function RightPanel() {
  const activeTab = useSessionStore((s) => s.activeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const settings = useSessionStore((s) => s.settings);
  const sessionId = useSessionStore((s) => s.sessionId);
  const displayUnit = useSessionStore((s) => s.displayUnit);
  const mentalMathOpen = useSessionStore((s) => s.mentalMathOpen);

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

  // Mental Math only renders numbers on a post-flop hero spot AND when the section is expanded; on
  // preflop or while collapsed there's no number block to point at. Used to avoid the pending caption
  // over-promising an absent Mental Math block (finding #4).
  const mentalMathAvailable =
    mentalMathOpen && !!pendingStreet && pendingStreet !== "preflop";

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
            {/* While a NEW street's decision is pending, the last verdict describes a PRIOR decision
                (e.g. preflop while you're deciding the flop). Showing it next to Mental Math's
                current-spot numbers puts two unrelated win%/EV figures on screen at once. So when the
                pending spot is a later street than the shown verdict, replace the stale card with a
                "Deciding your <street>…" pending note — only ONE set of numbers describes the decision
                in front of the user (finding #5). The Mental Math section (inside FeedbackPanel) still
                tracks the live spot. */}
            {settings.feedbackEnabled && pendingStreet && isStale ? (
              <aside data-testid="feedback-pending" className="card" style={{ maxWidth: 420 }}>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  <strong>Deciding your {pendingStreet}…</strong> — the verdict and equity for this
                  spot appear once you act.
                  {/* Only promise the Mental Math numbers when they're actually present below: they
                      need a post-flop spot AND the section expanded. On preflop or while collapsed
                      there's nothing to point at, so don't over-promise an absent block (finding #4). */}
                  {mentalMathAvailable
                    ? ` The numbers below (Mental Math) are for this ${pendingStreet} decision; your last verdict was for an earlier street.`
                    : " Your last verdict was for an earlier street."}
                </p>
              </aside>
            ) : (
              <FeedbackPanel
                analysis={feedback?.analysis ?? null}
                enabled={settings.feedbackEnabled}
                displayUnit={displayUnit}
                context={
                  feedback
                    ? {
                        street: feedback.street,
                        potBefore: feedback.spot.potBefore,
                        toCall: feedback.spot.toCall,
                      }
                    : undefined
                }
              />
            )}
            {/* Empty state: a big blank pane reads as "broken", so tell the user feedback is coming
                (only while feedback is on, no decision yet, and we're not already showing the
                pending-decision card above). */}
            {settings.feedbackEnabled && !feedback?.analysis && !(pendingStreet && isStale) ? (
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
                  equity block is hidden. Turn instant feedback back on from <em>New session</em>.
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
