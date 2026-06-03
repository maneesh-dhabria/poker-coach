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

export function RightPanel() {
  const activeTab = useSessionStore((s) => s.activeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const settings = useSessionStore((s) => s.settings);
  const sessionId = useSessionStore((s) => s.sessionId);

  const feedback = useGameStore((s) => s.feedback);
  const flow = useGameStore((s) => s.flow);
  useGameStore((s) => s.tick); // re-render on game changes

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
            <FeedbackPanel analysis={feedback?.analysis ?? null} enabled={settings.feedbackEnabled} />
            {flow ? (
              <HandRecap decisions={flow.decisions()} heroNet={flow.tableView().heroNet} />
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
