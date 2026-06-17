// Controlled vocabulary of recurring-mistake / concept tags — spec §9.4.
// Shared by core/analysis (the sole producer) and the /poker-coach skill (consumer).
// Extensible: add a tag here and both sides stay in sync.

export const CONCEPT_TAGS = [
  "call_correct_price",
  "call_too_wide",
  // Action-neutral "kept playing a hand too weak for the spot" — used when the hero took the lead
  // (bet/raise) instead of calling, so the tag never says "call" about a raise (iter-03 #4).
  "played_too_wide",
  "fold_too_tight",
  "value_bet_missed",
  "thin_value_good",
  // A genuine made hand (pair or better) bet thin/vulnerable multiway — value, NOT a bluff. Keeps a
  // low-equity made-hand bet from being mislabeled "bluff_no_equity" (iter-06 #1).
  "made_hand_thin_value",
  "bluff_no_equity",
  // A preflop open/raise whose SIZE is far larger than a standard open (the decision to raise can
  // still be right — only the size is off) (iter-06 #3).
  "preflop_oversize",
  "overfold_vs_aggression",
  "wrong_sizing",
  "preflop_chart_deviation",
  "good_preflop_discipline",
  // Street-neutral "a disciplined fold" — used for a sound fold on any street (e.g. a correct river
  // fold) so the tag never claims "preflop" about a postflop decision (iter-03 #4).
  "good_fold_discipline",
  "position_misplay",
  "slowplay_costly",
] as const;

export type ConceptTag = (typeof CONCEPT_TAGS)[number];

/** Runtime guard — useful when reading tags back out of JSON. */
export function isConceptTag(s: string): s is ConceptTag {
  return (CONCEPT_TAGS as readonly string[]).includes(s);
}
