/**
 * Audit Engine Types — Full Compliance Audit Orchestration
 *
 * Types for the audit engine that orchestrates:
 * ingest evidence -> normalize -> score -> generate findings -> sign results.
 *
 * Consumes:
 *   - NormalizedEvidence from normalize engine
 *   - EvidenceQualityScore from scoring engine
 *   - GovernanceReport from quartermaster
 */

import type { NormalizedEvidence } from "../normalize/types";
import type { EvidenceQualityScore } from "../scoring/types";
import type { GovernanceReport } from "../quartermaster/types";

// =============================================================================
// AUDIT SCOPE
// =============================================================================

/** Audit scope definition — what to audit and how */
export interface AuditScope {
  /** Human-readable scope name (e.g., "AWS Production Environment") */
  name: string;

  /** Target compliance frameworks (e.g., ["SOC2", "NIST-800-53"]) */
  frameworks: string[];

  /** File paths or glob patterns for evidence files */
  evidencePaths: string[];

  /** Override format detection per path (same index as evidencePaths) */
  formats?: string[];

  /** Control IDs to exclude from the audit scope */
  excludeControls?: string[];
}

// =============================================================================
// AUDIT FINDINGS
// =============================================================================

/** Single audit finding — an observation from the audit */
export interface AuditFinding {
  /** Unique finding identifier (e.g., "CRIT-001", "HIGH-002") */
  id: string;

  /** Finding severity */
  severity: "critical" | "high" | "medium" | "low" | "info";

  /** Finding category */
  category: "gap" | "failure" | "weakness" | "observation" | "strength";

  /** Related control identifier */
  controlId: string;

  /** Short finding title */
  title: string;

  /** Detailed finding description */
  description: string;

  /** Remediation recommendation */
  recommendation?: string;

  /** Evidence reference */
  evidence: {
    source: string;
    controlStatus: string;
  };
}

// =============================================================================
// AUDIT RESULT
// =============================================================================

/** Complete audit result — everything the audit produced */
export interface AuditResult {
  /** Unique audit run identifier */
  id: string;

  /** The scope that was audited */
  scope: AuditScope;

  /** When the audit started (ISO 8601) */
  startedAt: string;

  /** When the audit completed (ISO 8601) */
  completedAt: string;

  /** Audit duration in milliseconds */
  duration: number;

  // Aggregated results
  /** All normalized evidence from all evidence files */
  evidence: NormalizedEvidence[];

  /** Combined evidence quality score */
  score: EvidenceQualityScore;

  /** Generated audit findings */
  findings: AuditFinding[];

  /** Governance report (when config.includeGovernance=true) */
  governance?: GovernanceReport;

  /** Audit summary statistics */
  summary: {
    totalControls: number;
    passed: number;
    failed: number;
    skipped: number;
    score: number;
    grade: string;
    criticalFindings: number;
    highFindings: number;
  };
}

// =============================================================================
// AUDIT CONFIG
// =============================================================================

/** Audit engine configuration */
export interface AuditConfig {
  /** Run quartermaster governance checks (default: false) */
  includeGovernance: boolean;

  /** Run scoring engine (default: true) */
  includeScore: boolean;

  /** Generate findings from evidence (default: true) */
  generateFindings: boolean;

  /** Sign the audit result as a CPOE (default: false) */
  signResult: boolean;

  /** Output format (default: "json") */
  outputFormat: "json" | "summary" | "full";
}
