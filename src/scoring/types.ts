/**
 * Scoring Types — 7-Dimension Evidence Quality Assessment
 *
 * The "FICO score for compliance" — deterministic, explainable,
 * computed from CanonicalControlEvidence[].
 *
 * 5/7 dimensions are fully deterministic.
 * 2/7 have deterministic baselines with future model-assisted enhancement.
 */

import type { CanonicalControlEvidence } from "../normalize/types";

// =============================================================================
// DIMENSION CONFIG
// =============================================================================

/** Scoring method for a dimension */
export type ScoringMethod = "deterministic" | "model-assisted";

/** Letter grade: A=90+, B=80-89, C=70-79, D=60-69, F=<60 */
export type LetterGrade = "A" | "B" | "C" | "D" | "F";

/** A single scored dimension */
export interface ScoredDimension {
  /** Dimension name */
  name: string;

  /** Raw score 0-100 */
  score: number;

  /** Weight 0.0-1.0 */
  weight: number;

  /** score * weight */
  weighted: number;

  /** How the score was computed */
  method: ScoringMethod;

  /** Human-readable explanation */
  detail: string;
}

// =============================================================================
// OUTPUT
// =============================================================================

/** The complete evidence quality score */
export interface EvidenceQualityScore {
  /** Composite score 0-100 (the FICO number) */
  composite: number;

  /** Letter grade */
  grade: LetterGrade;

  /** Per-dimension breakdown */
  dimensions: ScoredDimension[];

  /** Number of controls scored */
  controlsScored: number;

  /** When the score was computed (ISO 8601) */
  scoredAt: string;

  /** Engine version */
  engineVersion: string;
}

// =============================================================================
// DIMENSION WEIGHTS (MUST sum to 1.0)
// =============================================================================

export const DIMENSION_WEIGHTS = {
  sourceIndependence: 0.20,
  recency: 0.15,
  coverage: 0.15,
  reproducibility: 0.15,
  consistency: 0.10,
  evidenceQuality: 0.15,
  completeness: 0.10,
} as const;

/** Provenance source scores for source independence */
export const PROVENANCE_SCORES = {
  auditor: 100,
  tool: 80,
  self: 30,
} as const;

/** Evidence type scores for reproducibility */
export const REPRODUCIBILITY_SCORES = {
  scan: 90,
  test: 90,
  config: 70,
  observation: 70,
  document: 40,
  attestation: 40,
} as const;

/** Evidence type scores for evidence quality baseline */
export const EVIDENCE_QUALITY_SCORES = {
  attestation: 90,
  test: 85,
  scan: 80,
  config: 60,
  observation: 60,
  document: 40,
} as const;

/** Reproducibility bonus when process provenance receipts are present */
export const REPRODUCIBILITY_RECEIPT_BONUS = 10;

/** Engine version string */
export const SCORING_ENGINE_VERSION = "1.0.0";
