// HandRecord: the persisted, versioned record of one played hand and the app↔coach
// contract (spec §9.1). buildHandRecord assembles it; validateHandRecord checks it against
// the JSON schema so app and coach can never silently drift (risk R4).
import { Card } from "@/core/cards";
import { DecisionAnalysis } from "@/core/analysis/analyze";
import schema from "@/core/history/handRecord.schema.json";

export const HANDRECORD_SCHEMA_VERSION = 1;

export type Street = "preflop" | "flop" | "turn" | "river";

export interface Persona {
  style: string;
  skill: string;
}

export interface SeatRecord {
  seat: number;
  name: string;
  isHero: boolean;
  startingStack: number;
  position: string;
  persona: Persona | null;
}

export interface ActionRecord {
  street: Street;
  seat: number;
  action: string;
  // Chips this action put into the pot (the increment) — used for all pot math.
  amount: number;
  // For a bet/raise only: the TOTAL street commitment the action raised TO (the "raise to N" the
  // player saw on the button), so display copy is consistent end-to-end (iter-03 #6). Optional and
  // additive — older records / non-aggressive actions omit it and fall back to `amount`.
  toAmount?: number;
}

export interface SpotRecord {
  potBefore: number;
  toCall: number;
  position: string;
  stackBb: number;
  numActiveOpponents: number;
  facing: string;
}

export interface HeroDecisionRecord {
  decisionId: string;
  street: Street;
  spot: SpotRecord;
  heroAction: { action: string; amount: number; toAmount?: number };
  analysis: DecisionAnalysis;
}

export interface OutcomeRecord {
  winners: { seat: number; amount: number }[];
  heroNet: number;
  shown: { seat: number; cards: Card[] }[];
  endedAtShowdown: boolean;
}

export interface HandConfig {
  numPlayers: number;
  smallBlind: number;
  bigBlind: number;
  startingStackBb: number;
}

export interface HandRecord {
  schemaVersion: number;
  handId: string;
  sessionId: string;
  handNumber: number;
  playedAt: string;
  config: HandConfig;
  heroSeat: number;
  seats: SeatRecord[];
  heroHole: Card[];
  board: Card[];
  actions: ActionRecord[];
  heroDecisions: HeroDecisionRecord[];
  outcome: OutcomeRecord;
}

/** Everything buildHandRecord needs except the derived handId + schemaVersion. */
export type BuildHandRecordInput = Omit<HandRecord, "schemaVersion" | "handId" | "playedAt"> & {
  /** ISO timestamp; pass explicitly for deterministic tests, else wall-clock now. */
  playedAt?: string;
};

export function buildHandRecord(input: BuildHandRecordInput): HandRecord {
  const { sessionId, handNumber } = input;
  return {
    schemaVersion: HANDRECORD_SCHEMA_VERSION,
    handId: `${sessionId}_h${handNumber}`,
    sessionId,
    handNumber,
    playedAt: input.playedAt ?? new Date().toISOString(),
    config: input.config,
    heroSeat: input.heroSeat,
    seats: input.seats,
    heroHole: input.heroHole,
    board: input.board,
    actions: input.actions,
    heroDecisions: input.heroDecisions,
    outcome: input.outcome,
  };
}

// --- Minimal JSON-Schema (draft-07 subset) validator --------------------------------
// Supports: type (incl. union arrays), required, properties, items. Enough to enforce the
// HandRecord contract without pulling in a validation dependency (keeps core dependency-light).

type JsonSchema = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function jsonType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer"; // a valid "number" too — handled below
  return typeof v;
}

function typeMatches(value: unknown, expected: string): boolean {
  const actual = jsonType(value);
  if (expected === "number") return actual === "number" || actual === "integer";
  return actual === expected;
}

function validateNode(value: unknown, node: JsonSchema, path: string, errors: string[]): void {
  if (node.type !== undefined) {
    const allowed = Array.isArray(node.type) ? node.type : [node.type];
    if (!allowed.some((t) => typeMatches(value, t))) {
      errors.push(`${path || "<root>"}: expected ${allowed.join("|")}, got ${jsonType(value)}`);
      return; // type wrong → don't descend
    }
  }

  if (node.properties && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of node.required ?? []) {
      if (!(key in obj)) errors.push(`${path ? path + "." : ""}${key}: required key missing`);
    }
    for (const [key, childSchema] of Object.entries(node.properties)) {
      if (key in obj) validateNode(obj[key], childSchema, `${path ? path + "." : ""}${key}`, errors);
    }
  } else if (node.required && value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of node.required) {
      if (!(key in obj)) errors.push(`${path ? path + "." : ""}${key}: required key missing`);
    }
  }

  if (node.items && Array.isArray(value)) {
    value.forEach((item, i) => validateNode(item, node.items!, `${path}[${i}]`, errors));
  }
}

export function validateHandRecord(record: unknown): ValidationResult {
  const errors: string[] = [];
  validateNode(record, schema as JsonSchema, "", errors);
  return { valid: errors.length === 0, errors };
}
