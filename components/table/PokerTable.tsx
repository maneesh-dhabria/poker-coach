"use client";
// The play surface: seats, board, pot, and the hero action bar (spec FR-51, FR-52; wireframe 01).
// Reads the render snapshot from the game store's HandFlow; the hero's action drives the store.
// Bot actions are revealed one at a time (observation #3) so the table tells the story of the hand:
// each seat shows what it just did, and committed chips animate toward the pot.
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { latestActionPerSeat } from "@/core/handFlow";
import { winningCards, handCategoryLabel } from "@/core/eval/handEval";
import { Seat } from "@/components/table/Seat";
import { Board } from "@/components/table/Board";
import { CenterStack } from "@/components/table/CenterStack";
import { ActionBar } from "@/components/ActionBar";
import { Button } from "@/components/ui/Button";

const REVEAL_MS = 380; // pause between each bot's action so the user can follow the table

// The seat that should glow gold. While the reveal cursor is walking the bot actions, glow the
// seat whose action is being revealed; once the reveal finishes, glow whoever is to act (the hero
// on their turn); during showdown (hand over) nothing glows. (spec FR-12)
export function selectActingSeat(
  revealing: boolean,
  log: { seat: number }[],
  revealed: number,
  view: { isOver: boolean; toAct: number | null },
): number | null {
  if (revealing) return log[revealed]?.seat ?? null;
  return view.isOver ? null : view.toAct;
}

// How many community cards the Board should show. While the bot-reveal animation is walking
// (`revealing`), cap to the snapshot's street count so cards turn over in step with the cursor.
// Otherwise — a static hero decision or the hand being over — show ALL dealt cards (undefined =
// uncapped) so the hero always sees the street they're deciding and the full run-out at showdown.
// `view.board` already holds exactly the cards dealt so far for the live street, so an uncapped
// board on a hero decision never reveals a card ahead of the action (iter-03 #1 regression fix).
export function boardShowCount(revealing: boolean, snapshotBoardCount: number): number | undefined {
  return revealing ? snapshotBoardCount : undefined;
}

export function PokerTable() {
  const flow = useGameStore((s) => s.flow);
  const busy = useGameStore((s) => s.busy);
  const heroAct = useGameStore((s) => s.heroAct);
  const newHand = useGameStore((s) => s.newHand);
  const handNumber = useGameStore((s) => s.handNumber);
  const displayUnit = useSessionStore((s) => s.displayUnit);
  useGameStore((s) => s.tick); // subscribe so the table re-renders on each change

  const log = flow ? flow.actionLog() : [];
  const total = log.length;
  const [revealed, setRevealed] = useState(0);

  // Reset the reveal cursor when a new hand is dealt.
  useEffect(() => {
    setRevealed(0);
  }, [handNumber]);

  // Walk the reveal cursor forward one action at a time.
  useEffect(() => {
    if (revealed >= total) return;
    const t = setTimeout(() => setRevealed((c) => Math.min(c + 1, total)), REVEAL_MS);
    return () => clearTimeout(t);
  }, [revealed, total]);

  if (!flow) return <p style={{ padding: 24 }}>No hand in progress. Deal to begin.</p>;
  const view = flow.tableView();
  const revealing = revealed < total;
  const actingSeat = selectActingSeat(revealing, log, revealed, view);
  const latest = latestActionPerSeat(log.slice(0, revealed));
  const snapshot = flow.replayAt(revealed);
  const BIG_BLIND = 2; // fixed for W2; persistent config arrives in W3

  // ── Showdown layer (FR-13/14/15/16). Only after the reveal finishes and the hand is over. ──
  const showdownDone = !revealing && view.isOver;
  const winnerSeats = new Set(view.winners.map((w) => w.seat));
  // The single showdown winner whose cards are shown drives the yellow winning-5 + the banner.
  // Fold-out (no shown cards) → winner + nets only, no banner, no card highlight (FR-15).
  const shownWinner =
    showdownDone && view.winners.length === 1
      ? view.seats.find((s) => winnerSeats.has(s.seat) && s.cards && s.cards.length >= 2)
      : undefined;
  let categoryBanner: string | null = null;
  let highlightSet: Set<string> | null = null;
  if (shownWinner && shownWinner.cards && view.board.length >= 3) {
    const hole = shownWinner.cards.slice(0, 2);
    const best = winningCards(hole, view.board);
    highlightSet = new Set(best as string[]);
    const category = handCategoryLabel([...shownWinner.cards, ...view.board]);
    // Attribute the winning hand clearly to whoever made it (finding #9): the banner sits near the
    // board and the hero's cards, so an unattributed "Flush, Queens high" reads as if it labels the
    // hero's hand. Name the winner ("You win with…" / "<Bot> wins with…").
    const winnerName = shownWinner.isHero ? "You" : shownWinner.name;
    const verb = shownWinner.isHero ? "win" : "wins";
    categoryBanner = `${winnerName} ${verb} with ${category}`;
  }

  // Lay the seats out around an oval, hero anchored at the bottom, so the pot/chip stack can sit
  // above center with everyone arranged around it (like a real table). The radii are kept well
  // inside the felt so no seat is clipped off an edge once the felt scales down on small/short
  // viewports (finding #6); the felt itself preserves aspect ratio (see the felt box below) so the
  // whole oval shrinks proportionally rather than squashing seats against the edges.
  const n = view.seats.length;
  const heroIndex = Math.max(0, view.seats.findIndex((s) => s.isHero));
  const RX = 38; // horizontal radius (% of felt)
  const RY = 32; // vertical radius (% of felt) — kept inside so top/bottom seats don't clip
  const seatPosition = (i: number) => {
    const k = (i - heroIndex + n) % n; // 0 = hero, then around the ring
    const theta = Math.PI / 2 + (k * 2 * Math.PI) / n; // 90° points to the bottom
    return {
      left: `${50 + RX * Math.cos(theta)}%`,
      top: `${50 + RY * Math.sin(theta)}%`,
    };
  };

  return (
    // Fill the left column as a flex column so the felt SHRINKS to fit short viewports while the
    // action bar (flex:0 0 auto, below) always stays in view — the action controls must never be
    // clipped on small/zoomed windows (no-scroll contract preserved; felt absorbs the shrinkage).
    <section
      style={{
        padding: 16,
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div
        data-testid="felt"
        style={{
          position: "relative",
          background: "radial-gradient(ellipse at center, var(--felt), var(--felt-deep))",
          borderRadius: "var(--r-lg)",
          flex: "1 1 auto",
          minHeight: 0,
          maxHeight: 580,
          width: "100%",
          maxWidth: 760,
          // Preserve a fixed felt aspect ratio so the oval scales to fit BOTH the available width and
          // height — on a short/narrow viewport it shrinks proportionally (seats keep their relative
          // positions and never clip off an edge) instead of stretching to fill and squashing seats
          // against the borders (finding #6). Combined with the inset radii above, the whole table
          // stays inside its container at 800×600 / 600×900.
          aspectRatio: "760 / 520",
          margin: "0 auto",
        }}
      >
        {/* Center pot/log is painted FIRST so the seats (rendered after) sit on top of it — when the
            felt is short and the central "THIS ROUND" log would otherwise overlap the You/center
            seats, the seats stay readable rather than being hidden behind the log (finding #6). The
            log itself is width- and height-capped so it can't sprawl across the center seats. */}
        <div
          data-testid="center-stack-wrap"
          style={{
            position: "absolute",
            left: "50%",
            // Anchor the board + pot/round-summary in the UPPER-MIDDLE and bound it to a zone that
            // ENDS well above the bottom hero ("You") seat, so the pot readout and "THIS ROUND"
            // summary are never hidden behind — or colliding with — the hero seat at short/narrow
            // sizes (iter-03 #3). The hero seat's center sits at ~82% of the felt height (RY below),
            // so its top edge is ~74%; capping this block's bottom at ~70% guarantees a gap. Seats
            // also paint above this block (zIndex) as a belt-and-braces guard.
            top: "36%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            maxWidth: "44%",
            // 36% center ± 34% half-height ⇒ spans ~2%–70% of the felt, ending clear of the hero seat.
            maxHeight: "68%",
            overflow: "hidden",
            zIndex: 0,
          }}
        >
          {/* The board count is capped ONLY while the bot-action reveal animation is walking
              (`revealing`) so cards turn over street-by-street in step with the reveal cursor. The
              moment the reveal finishes — i.e. it's the hero's turn / a static "your decision" state
              or the hand is over — show the ACTUAL dealt board in full (`view.board`), so the player
              always sees the card(s) for the street they're deciding (iter-03 #1 regression fix) and
              the full run-out at showdown (finding #12). `view.board` already holds exactly the cards
              dealt so far for the live street, so this never reveals a card ahead of the action. */}
          <Board cards={view.board} count={boardShowCount(revealing, snapshot.boardCount)} />
          <CenterStack
            snapshot={snapshot}
            categoryBanner={categoryBanner}
            displayUnit={displayUnit}
            bigBlind={BIG_BLIND}
          />
        </div>
        {view.seats.map((s, i) => (
          <div
            key={s.seat}
            style={{
              position: "absolute",
              ...seatPosition(i),
              transform: "translate(-50%, -50%)",
              zIndex: 1, // seats paint above the central log so they're never hidden behind it (#6)
            }}
          >
            <Seat
              seat={s}
              lastAction={latest[s.seat] ?? null}
              bigBlind={BIG_BLIND}
              isActing={actingSeat != null && s.seat === actingSeat}
              isWinner={showdownDone && winnerSeats.has(s.seat)}
              net={showdownDone ? s.net : null}
              highlightCards={shownWinner && s.seat === shownWinner.seat ? highlightSet : null}
            />
          </div>
        ))}
      </div>

      <div style={{ flex: "0 0 auto", marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {revealing ? (
          <p data-testid="opponents-acting" style={{ color: "var(--ink-soft)" }}>
            Opponents acting…
          </p>
        ) : view.isOver ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Button variant="primary" onClick={newHand}>
              Next hand
            </Button>
          </div>
        ) : view.isHeroTurn ? (
          <ActionBar
            legal={view.legal}
            onAction={heroAct}
            disabled={busy}
            pot={view.pot}
            displayUnit={displayUnit}
            bigBlind={BIG_BLIND}
          />
        ) : (
          <p style={{ color: "var(--ink-soft)" }}>Opponents acting…</p>
        )}
      </div>
    </section>
  );
}
