// Public API for the Mental Math core module (spec §2). Pure TypeScript — no React/DOM (§17, FR-22).
export * from "@/core/mental/types";
export { countOuts } from "@/core/mental/outs";
export { ruleOf2And4, exactHitPct, bigDrawCaveat } from "@/core/mental/hit";
export { detectTaint, buildMentalEstimate } from "@/core/mental/estimate";
