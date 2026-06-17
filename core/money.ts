// Pure money formatter (spec FR-70/71/72, NFR-02/05). No React/DOM/store imports — core stays pure.
// `usd` renders whole dollars; `bb` renders multiples of the big blind to ≤1 decimal. Negatives pair
// the sign with the glyph (NFR-05: sign is not color-only), e.g. "-$15".
export type MoneyUnit = "usd" | "bb";

export function formatMoney(dollars: number, unit: MoneyUnit, bigBlind: number): string {
  // bb mode requires a positive big blind; otherwise fall back to usd (E8 guard).
  if (unit === "bb" && bigBlind > 0) {
    const bb = dollars / bigBlind;
    // Round to ≤1 decimal, then strip a trailing ".0".
    let rounded = Math.round(bb * 10) / 10;
    if (rounded === 0) rounded = 0; // collapse a tiny -0 so we never render "-0 BB" (iter-06 #5)
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${text} BB`;
  }
  const whole = Math.round(Math.abs(dollars));
  // A magnitude that rounds to zero must read "$0", never "-$0" (iter-06 #5): the sign is dropped
  // once the displayed value is zero.
  const neg = dollars < 0 && whole !== 0 ? "-" : "";
  return `${neg}$${whole}`;
}
