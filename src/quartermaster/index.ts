/**
 * Quartermaster v2 — Governance Review Engine
 *
 * 7-dimension evidence quality assessment with deterministic governance checks.
 * "7-dimension evidence quality assessment" NOT "AI-powered."
 * 5/7 deterministic, 2/7 model-assisted with deterministic baselines.
 */

export { reviewEvidence } from "./quartermaster";
export {
  checkEvidenceGaps,
  checkSeverityMismatch,
  checkFrameworkCoverage,
  checkConsistency,
  checkBoilerplate,
  checkRecency,
  runAllChecks,
} from "./checks";
export type {
  GovernanceReport,
  GovernanceFinding,
  QuartermasterConfig,
  FindingSeverity,
  FindingCategory,
} from "./types";
export { CATEGORY_TO_DIMENSION, SEVERITY_PENALTY } from "./types";
