/**
 * Certification Engine Types -- Continuous Compliance Certification
 *
 * Manages ongoing compliance certifications: scheduling audits,
 * detecting drift, auto-renewing CPOEs, and triggering alerts.
 *
 * Consumes:
 *   - AuditResult, AuditScope from audit engine
 *   - EvidenceQualityScore from scoring engine
 */

import type { AuditResult, AuditScope } from "../audit/types";
import type { EvidenceQualityScore } from "../scoring/types";

// =============================================================================
// CERTIFICATION STATUS
// =============================================================================

/** Certification lifecycle status */
export type CertificationStatus =
  | "active"     // Currently certified, all checks passing
  | "warning"    // Certified but score degrading
  | "degraded"   // Below threshold, grace period
  | "suspended"  // Certification suspended (drift detected)
  | "expired"    // Certification expired (not renewed)
  | "revoked";   // Manually revoked

// =============================================================================
// CERTIFICATION POLICY
// =============================================================================

/** Certification policy -- defines what "certified" means */
export interface CertificationPolicy {
  /** Unique policy identifier */
  id: string;

  /** Human-readable policy name */
  name: string;

  /** Audit scope definition */
  scope: AuditScope;

  // --- Thresholds ---

  /** Minimum passing score (default 70) */
  minimumScore: number;

  /** Score below this triggers warning (default 80) */
  warningThreshold: number;

  // --- Schedule ---

  /** Re-audit every N days (default 90) */
  auditIntervalDays: number;

  /** Max age before stale (default 7) */
  freshnessMaxDays: number;

  /** Days below threshold before suspension (default 14) */
  gracePeriodDays: number;

  // --- Auto-actions ---

  /** Auto-renew CPOE on passing audit */
  autoRenew: boolean;

  /** Auto-suspend on drift */
  autoSuspend: boolean;

  /** Send webhook/FLAGSHIP on status change */
  notifyOnChange: boolean;
}

// =============================================================================
// CERTIFICATION RECORD
// =============================================================================

/** A certification record */
export interface Certification {
  /** Unique certification identifier */
  id: string;

  /** Policy governing this certification */
  policyId: string;

  /** Organization identifier */
  orgId: string;

  /** Current certification status */
  status: CertificationStatus;

  // --- Current state ---

  /** Current composite score (0-100) */
  currentScore: number;

  /** Current letter grade (A-F) */
  currentGrade: string;

  /** When the last audit was run (ISO 8601) */
  lastAuditAt: string;

  /** Result of the most recent audit */
  lastAuditResult?: AuditResult;

  /** When the next audit is scheduled (ISO 8601) */
  nextAuditAt: string;

  // --- History ---

  /** Status change history for audit trail */
  statusHistory: Array<{
    status: CertificationStatus;
    changedAt: string;
    reason: string;
    score?: number;
  }>;

  // --- Metadata ---

  /** When the org was first certified (ISO 8601) */
  certifiedSince?: string;

  /** When the certification was suspended (ISO 8601) */
  suspendedAt?: string;

  /** When the certification expires (ISO 8601) */
  expiresAt?: string;

  /** Current CPOE JWT ID */
  cpoeId?: string;

  /** When this record was created (ISO 8601) */
  createdAt: string;

  /** When this record was last updated (ISO 8601) */
  updatedAt: string;
}

// =============================================================================
// DRIFT REPORT
// =============================================================================

/** Drift detection result */
export interface DriftReport {
  /** Certification this drift was detected for */
  certificationId: string;

  /** When drift was detected (ISO 8601) */
  detectedAt: string;

  /** Previous composite score */
  previousScore: number;

  /** Current composite score */
  currentScore: number;

  /** Score delta (current - previous) */
  scoreDelta: number;

  /** Controls that degraded */
  degradedControls: Array<{
    controlId: string;
    previousStatus: string;
    currentStatus: string;
    severity: string;
  }>;

  /** Recommendation based on severity of drift */
  recommendation: "monitor" | "investigate" | "suspend";
}

// =============================================================================
// CERTIFICATION CONFIG
// =============================================================================

/** Certification engine configuration */
export interface CertificationConfig {
  /** Default policy values for new certifications */
  defaultPolicy: Partial<CertificationPolicy>;

  /** How often to check certifications in ms (default 3600000 = 1hr) */
  checkIntervalMs: number;

  /** Maximum concurrent audits (default 3) */
  maxConcurrentAudits: number;
}
