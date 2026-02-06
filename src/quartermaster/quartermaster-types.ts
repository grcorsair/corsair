/**
 * Quartermaster Agent Types — Governance Verification Layer
 *
 * The Quartermaster is an adversarial evaluator that reviews Corsair assessment
 * results for integrity, completeness, methodology, and bias.
 *
 * Architecture: Separate Claude API call from the Corsair agent to prevent
 * self-validation. Deterministic checks run first (no LLM), then LLM
 * analysis for judgment calls.
 */

import type {
  MarkResult,
  RaidResult,
  ChartResult,
  PlunderResult,
  ThreatModelResult,
} from "../types";
import type { ISCCriterion } from "../types/isc";

// =============================================================================
// ADMIRAL FINDING
// =============================================================================

/**
 * A specific finding from the Quartermaster's analysis.
 */
export interface QuartermasterFinding {
  /** Unique finding identifier */
  id: string;

  /** Severity of the finding */
  severity: "critical" | "warning" | "info";

  /** Category of the finding */
  category: string;

  /** Human-readable description */
  description: string;

  /** Evidence references supporting this finding */
  evidence: string[];

  /** Suggested remediation action */
  remediation: string;
}

// =============================================================================
// ADMIRAL DIMENSION SCORE
// =============================================================================

/**
 * Score for a single evaluation dimension.
 */
export interface QuartermasterDimensionScore {
  /** Dimension name */
  dimension: "methodology" | "evidence_integrity" | "completeness" | "bias_detection";

  /** Score for this dimension (0-100) */
  score: number;

  /** Weight of this dimension in overall score */
  weight: number;

  /** Human-readable rationale for the score */
  rationale: string;

  /** Findings that contributed to this dimension's score */
  findings: QuartermasterFinding[];
}

// =============================================================================
// ADMIRAL GOVERNANCE REPORT
// =============================================================================

/**
 * Complete governance report from the Quartermaster agent.
 */
export interface QuartermasterGovernanceReport {
  /** Unique report identifier */
  reportId: string;

  /** Overall confidence score (0-100) */
  confidenceScore: number;

  /** Per-dimension breakdown */
  dimensions: QuartermasterDimensionScore[];

  /** Trust tier derived from confidence score */
  trustTier: "self-assessed" | "ai-verified" | "auditor-verified";

  /** Total findings across all dimensions */
  totalFindings: number;

  /** Finding counts by severity */
  findingsBySeverity: {
    critical: number;
    warning: number;
    info: number;
  };

  /** Executive summary (2-3 sentences) */
  executiveSummary: string;

  /** ISO-8601 timestamp of evaluation */
  evaluatedAt: string;

  /** Duration of Quartermaster evaluation in milliseconds */
  durationMs: number;

  /** Model used for evaluation */
  model: string;

  /** SHA-256 hash of this report (for MARQUE embedding) */
  reportHash: string;
}

// =============================================================================
// ADMIRAL INPUT
// =============================================================================

/**
 * Everything the Quartermaster needs to evaluate a Corsair run.
 */
export interface QuartermasterInput {
  /** Evidence file paths for chain verification */
  evidencePaths: string[];

  /** All MARK results from the run */
  markResults: MarkResult[];

  /** All RAID results from the run */
  raidResults: RaidResult[];

  /** All CHART results from the run */
  chartResults: ChartResult[];

  /** ISC criteria if available */
  iscCriteria?: ISCCriterion[];

  /** Threat model if available */
  threatModel?: ThreatModelResult;

  /** Scope metadata */
  scope: {
    providers: string[];
    resourceCount: number;
  };
}

// =============================================================================
// ADMIRAL CONFIGURATION
// =============================================================================

/**
 * Configuration for the Quartermaster agent.
 */
export interface QuartermasterConfig {
  /** Anthropic API key */
  apiKey: string;

  /** Model to use for evaluation */
  model?: string;

  /** Maximum tokens for evaluation response */
  maxTokens?: number;

  /** Dimension weights (must sum to 1.0) */
  weights?: Partial<Record<string, number>>;

  /** Trust tier thresholds */
  trustThresholds?: {
    aiVerified?: number;
    auditorVerified?: number;
  };
}
