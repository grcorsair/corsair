/**
 * Quartermaster v2 Types — Governance Review Engine
 *
 * 7-dimension evidence quality assessment with deterministic governance checks.
 * Model enhancement is optional — deterministic mode works perfectly without LLM.
 */

import type { EvidenceQualityScore } from "../scoring/types";

// =============================================================================
// CONFIG
// =============================================================================

/** Configuration for a Quartermaster review */
export interface QuartermasterConfig {
  /** Model to use: "deterministic" (no LLM) or a model ID */
  model: "deterministic" | (string & {});

  /** Custom dimension weights (optional — defaults to scoring engine weights) */
  weights?: Partial<Record<string, number>>;
}

// =============================================================================
// GOVERNANCE FINDINGS
// =============================================================================

/** Severity level for governance findings */
export type FindingSeverity = "critical" | "warning" | "info";

/** Category of governance finding */
export type FindingCategory =
  | "methodology"
  | "evidence_quality"
  | "completeness"
  | "consistency"
  | "bias";

/** A single governance finding from deterministic or model-assisted checks */
export interface GovernanceFinding {
  /** Unique finding identifier */
  id: string;

  /** Severity: critical (-10), warning (-5), info (no impact) */
  severity: FindingSeverity;

  /** Which governance category this finding belongs to */
  category: FindingCategory;

  /** Human-readable description of the finding */
  description: string;

  /** Remediation guidance */
  remediation: string;

  /** Control IDs affected by this finding */
  controlIds?: string[];
}

// =============================================================================
// GOVERNANCE REPORT
// =============================================================================

/** The complete governance review report */
export interface GovernanceReport {
  /** Enhanced score (scoring engine + QM adjustments) */
  score: EvidenceQualityScore;

  /** Findings from governance review */
  findings: GovernanceFinding[];

  /** Model used for this review */
  model: string;

  /** Review timestamp (ISO 8601) */
  reviewedAt: string;

  /** Whether model enhancement was applied */
  modelEnhanced: boolean;
}

// =============================================================================
// DIMENSION-TO-CATEGORY MAPPING
// =============================================================================

/** Maps finding categories to scoring engine dimension names for score adjustment */
export const CATEGORY_TO_DIMENSION: Record<FindingCategory, string> = {
  methodology: "reproducibility",
  evidence_quality: "evidenceQuality",
  completeness: "completeness",
  consistency: "consistency",
  bias: "evidenceQuality",
};

/** Score penalty for each severity level */
export const SEVERITY_PENALTY: Record<FindingSeverity, number> = {
  critical: 10,
  warning: 5,
  info: 0,
};
