// Position-label assignment shared by the one-shot orchestrator (playHand) and the interactive
// driver (handFlow). Labels run in seat order starting from the small blind, ending on the button.
import { Position } from "@/core/charts/preflop";

const POSITION_TEMPLATE: Record<number, Position[]> = {
  2: ["SB", "BB"],
  3: ["SB", "BB", "BTN"],
  4: ["SB", "BB", "UTG", "BTN"],
  5: ["SB", "BB", "UTG", "CO", "BTN"],
  6: ["SB", "BB", "UTG", "MP", "CO", "BTN"],
};

export function assignPositions(n: number, buttonIndex: number): Position[] {
  const template = POSITION_TEMPLATE[n] ?? POSITION_TEMPLATE[6];
  const start = n === 2 ? buttonIndex : (buttonIndex + 1) % n;
  const pos: Position[] = new Array(n);
  for (let k = 0; k < n; k++) pos[(start + k) % n] = template[k];
  return pos;
}
