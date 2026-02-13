/**
 * Scoring — 7-Dimension Evidence Quality Assessment
 *
 * The "FICO score for compliance" — deterministic, explainable.
 */

export { scoreEvidence } from "./scoring-engine";
export type { ScoreOptions } from "./scoring-engine";
export type {
  EvidenceQualityScore,
  ScoredDimension,
  LetterGrade,
  ScoringMethod,
} from "./types";
export {
  DIMENSION_WEIGHTS,
  PROVENANCE_SCORES,
  REPRODUCIBILITY_SCORES,
  EVIDENCE_QUALITY_SCORES,
  REPRODUCIBILITY_RECEIPT_BONUS,
  SCORING_ENGINE_VERSION,
} from "./types";
