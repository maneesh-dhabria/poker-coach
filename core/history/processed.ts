// Processed-marker helpers (spec §9.3): which hands the /poker-coach skill has already reviewed,
// so a "coach the unreviewed hands" run is idempotent (app↔coach coordination, risk R4).

export const PROCESSED_SCHEMA_VERSION = 1;

export interface ProcessedMarker {
  schemaVersion: number;
  reviewed: Record<string, string>; // handId -> ISO timestamp reviewed
}

export function emptyProcessed(): ProcessedMarker {
  return { schemaVersion: PROCESSED_SCHEMA_VERSION, reviewed: {} };
}

export function isReviewed(marker: ProcessedMarker, handId: string): boolean {
  return handId in marker.reviewed;
}

/** Returns a new marker with handId recorded as reviewed (immutable). */
export function markReviewed(marker: ProcessedMarker, handId: string, at: string): ProcessedMarker {
  return {
    schemaVersion: marker.schemaVersion ?? PROCESSED_SCHEMA_VERSION,
    reviewed: { ...marker.reviewed, [handId]: at },
  };
}

/** Hand ids present in `all` that have not yet been reviewed. */
export function unreviewed(marker: ProcessedMarker, all: string[]): string[] {
  return all.filter((id) => !isReviewed(marker, id));
}
