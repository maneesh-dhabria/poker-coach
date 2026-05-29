// Controlled vocabulary of recurring-mistake / concept tags — spec §9.4.
// Shared by core/analysis (the sole producer) and the /poker-coach skill (consumer).
// Extensible: add a tag here and both sides stay in sync.

export const CONCEPT_TAGS = [
  "call_correct_price",
  "call_too_wide",
  "fold_too_tight",
  "value_bet_missed",
  "thin_value_good",
  "bluff_no_equity",
  "overfold_vs_aggression",
  "wrong_sizing",
  "preflop_chart_deviation",
  "good_preflop_discipline",
  "position_misplay",
  "slowplay_costly",
] as const;

export type ConceptTag = (typeof CONCEPT_TAGS)[number];

/** Runtime guard — useful when reading tags back out of JSON. */
export function isConceptTag(s: string): s is ConceptTag {
  return (CONCEPT_TAGS as readonly string[]).includes(s);
}
