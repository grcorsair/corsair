/**
 * Certification Engine -- Continuous Compliance Certification
 *
 * Manages ongoing compliance certifications: schedule audits,
 * detect drift, auto-renew CPOEs, and trigger alerts.
 *
 * In-memory Map storage. No database dependency.
 *
 * Pipeline:
 *   createCertification(orgId, policy, auditResult)
 *     -> checkCertification(certId)
 *     -> detectDrift(certId, newAuditResult)
 *     -> renewCertification(certId, auditResult)
 *     -> getExpiringCertifications(withinDays)
 */

import { randomUUID } from "crypto";
import type { AuditResult } from "../audit/types";
import type {
  Certification,
  CertificationConfig,
  CertificationPolicy,
  CertificationStatus,
  DriftReport,
} from "./types";

// =============================================================================
// CHECK RESULT
// =============================================================================

/** Result of a certification check */
export interface CertificationCheckResult {
  /** Current certification status */
  status: CertificationStatus;

  /** Whether a re-audit is needed (last audit is stale) */
  needsReaudit: boolean;

  /** Whether the grace period has expired (only relevant for degraded status) */
  gracePeriodExpired: boolean;

  /** Current score */
  currentScore: number;
}

// =============================================================================
// VALID STATUS TRANSITIONS
// =============================================================================

const VALID_TRANSITIONS: Record<CertificationStatus, CertificationStatus[]> = {
  active: ["warning", "degraded", "suspended", "revoked"],
  warning: ["active", "degraded", "suspended", "revoked"],
  degraded: ["active", "warning", "suspended", "revoked", "expired"],
  suspended: ["active", "revoked"],
  expired: ["active"],
  revoked: [], // Terminal state -- no transitions out
};

// =============================================================================
// DEFAULT ENGINE CONFIG
// =============================================================================

const DEFAULT_ENGINE_CONFIG: CertificationConfig = {
  defaultPolicy: {},
  checkIntervalMs: 3600000, // 1 hour
  maxConcurrentAudits: 3,
};

// =============================================================================
// DRIFT THRESHOLDS
// =============================================================================

/** Small drop threshold: delta <= this = "monitor" */
const DRIFT_MONITOR_THRESHOLD = 5;

/** Significant drop threshold: delta <= this = "investigate" */
const DRIFT_INVESTIGATE_THRESHOLD = 15;

// =============================================================================
// HELPERS
// =============================================================================

function computeGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000);
}

// =============================================================================
// CERTIFICATION ENGINE
// =============================================================================

export class CertificationEngine {
  private config: CertificationConfig;
  private certifications: Map<string, Certification> = new Map();
  private policies: Map<string, CertificationPolicy> = new Map();

  constructor(config?: Partial<CertificationConfig>) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------

  /** Returns the current engine configuration */
  getConfig(): CertificationConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  /**
   * Register a new certification with a policy and initial audit result.
   *
   * Status starts as:
   *   - "active" if score >= warningThreshold
   *   - "warning" if score >= minimumScore but < warningThreshold
   *   - "degraded" if score < minimumScore
   */
  createCertification(
    orgId: string,
    policy: CertificationPolicy,
    auditResult: AuditResult,
  ): Certification {
    const now = new Date();
    const certId = `cert-${randomUUID()}`;
    const score = auditResult.score.composite;
    const grade = computeGrade(score);

    // Store the policy
    this.policies.set(policy.id, policy);

    // Determine initial status
    let status: CertificationStatus;
    if (score < policy.minimumScore) {
      status = "degraded";
    } else if (score < policy.warningThreshold) {
      status = "warning";
    } else {
      status = "active";
    }

    const nextAuditAt = addDays(now, policy.auditIntervalDays);
    const expiresAt = addDays(now, policy.auditIntervalDays + policy.gracePeriodDays);

    const cert: Certification = {
      id: certId,
      policyId: policy.id,
      orgId,
      status,
      currentScore: score,
      currentGrade: grade,
      lastAuditAt: now.toISOString(),
      lastAuditResult: auditResult,
      nextAuditAt: nextAuditAt.toISOString(),
      statusHistory: [
        {
          status,
          changedAt: now.toISOString(),
          reason: "Initial certification",
          score,
        },
      ],
      certifiedSince: score >= policy.minimumScore ? now.toISOString() : undefined,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.certifications.set(certId, cert);
    return { ...cert };
  }

  // ---------------------------------------------------------------------------
  // GET
  // ---------------------------------------------------------------------------

  /** Get a certification by ID. Returns undefined if not found. */
  getCertification(certId: string): Certification | undefined {
    const cert = this.certifications.get(certId);
    return cert ? { ...cert, statusHistory: [...cert.statusHistory] } : undefined;
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  /** List certifications, optionally filtered by orgId. */
  listCertifications(orgId?: string): Certification[] {
    const result: Certification[] = [];
    for (const cert of this.certifications.values()) {
      if (orgId === undefined || cert.orgId === orgId) {
        result.push({ ...cert, statusHistory: [...cert.statusHistory] });
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // CHECK
  // ---------------------------------------------------------------------------

  /**
   * Check a certification against its policy.
   *
   * Evaluates:
   *   - Is the last audit still fresh? (within auditIntervalDays)
   *   - Is the score above minimumScore?
   *   - Is the score above warningThreshold?
   *   - Has the grace period expired? (for degraded certifications)
   */
  checkCertification(certId: string): CertificationCheckResult | undefined {
    const cert = this.certifications.get(certId);
    if (!cert) return undefined;

    const policy = this.policies.get(cert.policyId);
    if (!policy) return undefined;

    const now = new Date();
    const lastAudit = new Date(cert.lastAuditAt);
    const daysSinceAudit = daysBetween(lastAudit, now);
    const needsReaudit = daysSinceAudit > policy.auditIntervalDays;

    // Grace period check: only for degraded certifications
    let gracePeriodExpired = false;
    if (cert.status === "degraded") {
      // Find when it became degraded
      const degradedEntry = [...cert.statusHistory]
        .reverse()
        .find((h) => h.status === "degraded");
      if (degradedEntry) {
        const degradedAt = new Date(degradedEntry.changedAt);
        const daysDegraded = daysBetween(degradedAt, now);
        gracePeriodExpired = daysDegraded > policy.gracePeriodDays;
      }
    }

    return {
      status: cert.status,
      needsReaudit,
      gracePeriodExpired,
      currentScore: cert.currentScore,
    };
  }

  // ---------------------------------------------------------------------------
  // DRIFT DETECTION
  // ---------------------------------------------------------------------------

  /**
   * Compare new audit results against the last audit.
   *
   * Classifies recommendation:
   *   - "monitor": small dip (delta <= 5)
   *   - "investigate": significant drop (delta 5-15)
   *   - "suspend": below minimum score
   */
  detectDrift(
    certId: string,
    newAuditResult: AuditResult,
  ): DriftReport | undefined {
    const cert = this.certifications.get(certId);
    if (!cert) return undefined;

    const policy = this.policies.get(cert.policyId);
    if (!policy) return undefined;

    const previousScore = cert.currentScore;
    const currentScore = newAuditResult.score.composite;
    const scoreDelta = currentScore - previousScore;
    const absDelta = Math.abs(scoreDelta);

    // Determine recommendation
    let recommendation: DriftReport["recommendation"];
    if (currentScore < policy.minimumScore) {
      recommendation = "suspend";
    } else if (absDelta > DRIFT_MONITOR_THRESHOLD) {
      recommendation = "investigate";
    } else {
      recommendation = "monitor";
    }

    // Find degraded controls by comparing findings
    const previousFindings = cert.lastAuditResult?.findings ?? [];
    const currentFindings = newAuditResult.findings ?? [];

    const previousFailedIds = new Set(
      previousFindings
        .filter((f) => f.category === "failure")
        .map((f) => f.controlId),
    );

    const degradedControls: DriftReport["degradedControls"] = [];
    for (const finding of currentFindings) {
      if (finding.category === "failure" && !previousFailedIds.has(finding.controlId)) {
        degradedControls.push({
          controlId: finding.controlId,
          previousStatus: "pass",
          currentStatus: "fail",
          severity: finding.severity,
        });
      }
    }

    return {
      certificationId: certId,
      detectedAt: new Date().toISOString(),
      previousScore,
      currentScore,
      scoreDelta,
      degradedControls,
      recommendation,
    };
  }

  // ---------------------------------------------------------------------------
  // STATUS TRANSITIONS
  // ---------------------------------------------------------------------------

  /**
   * Transition certification status with history tracking.
   *
   * Enforces valid transitions. Returns null if transition is invalid
   * or certification not found.
   */
  updateStatus(
    certId: string,
    newStatus: CertificationStatus,
    reason: string,
  ): Certification | null {
    const cert = this.certifications.get(certId);
    if (!cert) return null;

    // Validate transition
    const validTargets = VALID_TRANSITIONS[cert.status];
    if (!validTargets.includes(newStatus)) {
      return null;
    }

    const now = new Date().toISOString();
    cert.status = newStatus;
    cert.updatedAt = now;

    // Track suspension timestamp
    if (newStatus === "suspended") {
      cert.suspendedAt = now;
    }

    // Record in history
    cert.statusHistory.push({
      status: newStatus,
      changedAt: now,
      reason,
      score: cert.currentScore,
    });

    return { ...cert, statusHistory: [...cert.statusHistory] };
  }

  // ---------------------------------------------------------------------------
  // RENEW
  // ---------------------------------------------------------------------------

  /**
   * Process a new audit for an existing certification.
   *
   * Updates score, detects drift, updates status based on thresholds,
   * and resets nextAuditAt.
   */
  renewCertification(
    certId: string,
    auditResult: AuditResult,
  ): Certification | undefined {
    const cert = this.certifications.get(certId);
    if (!cert) return undefined;

    const policy = this.policies.get(cert.policyId);
    if (!policy) return undefined;

    const now = new Date();
    const newScore = auditResult.score.composite;
    const newGrade = computeGrade(newScore);

    // Detect drift before updating
    const drift = this.detectDrift(certId, auditResult);

    // Update core fields
    cert.currentScore = newScore;
    cert.currentGrade = newGrade;
    cert.lastAuditAt = now.toISOString();
    cert.lastAuditResult = auditResult;
    cert.nextAuditAt = addDays(now, policy.auditIntervalDays).toISOString();
    cert.expiresAt = addDays(
      now,
      policy.auditIntervalDays + policy.gracePeriodDays,
    ).toISOString();
    cert.updatedAt = now.toISOString();

    // Determine new status based on score + policy + drift
    let newStatus: CertificationStatus;

    if (
      drift &&
      drift.recommendation === "suspend" &&
      policy.autoSuspend
    ) {
      // Auto-suspend on severe drift
      newStatus = "suspended";
      cert.suspendedAt = now.toISOString();
    } else if (newScore < policy.minimumScore) {
      newStatus = "degraded";
    } else if (newScore < policy.warningThreshold) {
      newStatus = "warning";
    } else {
      newStatus = "active";
      // Set certifiedSince if not already set
      if (!cert.certifiedSince) {
        cert.certifiedSince = now.toISOString();
      }
    }

    // Only record transition if status actually changed
    if (newStatus !== cert.status) {
      cert.statusHistory.push({
        status: newStatus,
        changedAt: now.toISOString(),
        reason: `Renewal audit: score ${newScore} (${newGrade})`,
        score: newScore,
      });
    }

    cert.status = newStatus;

    return { ...cert, statusHistory: [...cert.statusHistory] };
  }

  // ---------------------------------------------------------------------------
  // EXPIRING CERTIFICATIONS
  // ---------------------------------------------------------------------------

  /** Find certifications expiring within N days. */
  getExpiringCertifications(withinDays: number): Certification[] {
    const now = new Date();
    const cutoff = addDays(now, withinDays);
    const result: Certification[] = [];

    for (const cert of this.certifications.values()) {
      if (!cert.expiresAt) continue;
      const expires = new Date(cert.expiresAt);
      if (expires <= cutoff) {
        result.push({ ...cert, statusHistory: [...cert.statusHistory] });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // SUSPENDED CERTIFICATIONS
  // ---------------------------------------------------------------------------

  /** List all suspended certifications. */
  getSuspendedCertifications(): Certification[] {
    const result: Certification[] = [];
    for (const cert of this.certifications.values()) {
      if (cert.status === "suspended") {
        result.push({ ...cert, statusHistory: [...cert.statusHistory] });
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // TEST HELPERS (internal use for time-manipulation in tests)
  // ---------------------------------------------------------------------------

  /**
   * Override lastAuditAt for testing staleness. Not for production use.
   */
  setLastAuditAt(certId: string, isoDate: string): void {
    const cert = this.certifications.get(certId);
    if (cert) {
      cert.lastAuditAt = isoDate;
    }
  }

  /**
   * Override the changedAt timestamp for a specific status entry.
   * Used for testing grace period expiry. Not for production use.
   */
  setStatusChangedAt(
    certId: string,
    status: CertificationStatus,
    isoDate: string,
  ): void {
    const cert = this.certifications.get(certId);
    if (!cert) return;

    // Find the last entry with the given status and update its timestamp
    const entries = cert.statusHistory.filter((h) => h.status === status);
    if (entries.length > 0) {
      entries[entries.length - 1].changedAt = isoDate;
    }
  }
}
