/**
 * PgCertificationEngine — Postgres-backed Continuous Compliance Certification
 *
 * Implements the same interface as the in-memory CertificationEngine but
 * persists all data to Postgres via Bun.sql tagged templates.
 *
 * Follows the established pattern from:
 *   - src/parley/pg-scitt-registry.ts
 *   - src/parley/pg-key-manager.ts
 *   - src/flagship/pg-ssf-stream.ts
 *
 * All queries use parameterized templates (no string interpolation).
 * Stores status_history and last_audit_result as JSONB.
 */

import { randomUUID } from "crypto";
import type { AuditResult } from "../audit/types";
import type {
  Certification,
  CertificationPolicy,
  CertificationStatus,
  DriftReport,
} from "./types";
import type { CertificationCheckResult } from "./certification-engine";

// =============================================================================
// DB INTERFACE (matches Bun.sql tagged template)
// =============================================================================

interface DbLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

// =============================================================================
// ROW TYPES (snake_case from Postgres)
// =============================================================================

interface CertificationRow {
  id: string;
  policy_id: string;
  org_id: string;
  status: CertificationStatus;
  current_score: number;
  current_grade: string;
  last_audit_at: string;
  last_audit_result: string | AuditResult | null;
  next_audit_at: string;
  status_history: string | Array<{ status: CertificationStatus; changedAt: string; reason: string; score?: number }>;
  certified_since: string | null;
  suspended_at: string | null;
  expires_at: string | null;
  cpoe_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PolicyRow {
  id: string;
  name: string;
  scope: string | Record<string, unknown>;
  minimum_score: number;
  warning_threshold: number;
  audit_interval_days: number;
  freshness_max_days: number;
  grace_period_days: number;
  auto_renew: boolean;
  auto_suspend: boolean;
  notify_on_change: boolean;
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
  revoked: [], // Terminal state
};

// =============================================================================
// DRIFT THRESHOLDS
// =============================================================================

const DRIFT_MONITOR_THRESHOLD = 5;
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

function parseJsonField<T>(value: string | T | null): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value;
}

// =============================================================================
// PG CERTIFICATION ENGINE
// =============================================================================

export class PgCertificationEngine {
  private db: DbLike;

  constructor(db: DbLike) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  /**
   * Register a new certification with a policy and initial audit result.
   * Also stores the policy in the policies table.
   */
  async createCertification(
    orgId: string,
    policy: CertificationPolicy,
    auditResult: AuditResult,
  ): Promise<Certification> {
    const now = new Date();
    const certId = `cert-${randomUUID()}`;
    const score = auditResult.score.composite;
    const grade = computeGrade(score);

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

    const statusHistory = [
      {
        status,
        changedAt: now.toISOString(),
        reason: "Initial certification",
        score,
      },
    ];

    const certifiedSince = score >= policy.minimumScore ? now.toISOString() : null;

    // Store the policy
    const scopeJson = JSON.stringify(policy.scope);
    await this.db`
      INSERT INTO certification_policies (id, name, scope, minimum_score, warning_threshold, audit_interval_days, freshness_max_days, grace_period_days, auto_renew, auto_suspend, notify_on_change)
      VALUES (${policy.id}, ${policy.name}, ${scopeJson}, ${policy.minimumScore}, ${policy.warningThreshold}, ${policy.auditIntervalDays}, ${policy.freshnessMaxDays}, ${policy.gracePeriodDays}, ${policy.autoRenew}, ${policy.autoSuspend}, ${policy.notifyOnChange})
      ON CONFLICT (id) DO UPDATE
      SET name = ${policy.name}, scope = ${scopeJson}, minimum_score = ${policy.minimumScore}, warning_threshold = ${policy.warningThreshold}
    `;

    // Store the certification
    const statusHistoryJson = JSON.stringify(statusHistory);
    const auditResultJson = JSON.stringify(auditResult);

    await this.db`
      INSERT INTO certifications (id, policy_id, org_id, status, current_score, current_grade, last_audit_at, last_audit_result, next_audit_at, status_history, certified_since, suspended_at, expires_at, cpoe_id, created_at, updated_at)
      VALUES (${certId}, ${policy.id}, ${orgId}, ${status}, ${score}, ${grade}, ${now.toISOString()}, ${auditResultJson}, ${nextAuditAt.toISOString()}, ${statusHistoryJson}, ${certifiedSince}, ${null}, ${expiresAt.toISOString()}, ${null}, ${now.toISOString()}, ${now.toISOString()})
    `;

    return {
      id: certId,
      policyId: policy.id,
      orgId,
      status,
      currentScore: score,
      currentGrade: grade,
      lastAuditAt: now.toISOString(),
      lastAuditResult: auditResult,
      nextAuditAt: nextAuditAt.toISOString(),
      statusHistory,
      certifiedSince: certifiedSince ?? undefined,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // GET
  // ---------------------------------------------------------------------------

  /** Get a certification by ID. Returns undefined if not found. */
  async getCertification(certId: string): Promise<Certification | undefined> {
    const rows = (await this.db`
      SELECT id, policy_id, org_id, status, current_score, current_grade, last_audit_at, last_audit_result, next_audit_at, status_history, certified_since, suspended_at, expires_at, cpoe_id, created_at, updated_at
      FROM certifications
      WHERE id = ${certId}
      LIMIT 1
    `) as CertificationRow[];

    if (rows.length === 0) return undefined;
    return this.rowToCertification(rows[0]);
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  /** List certifications, optionally filtered by orgId. */
  async listCertifications(orgId?: string): Promise<Certification[]> {
    let rows: CertificationRow[];

    if (orgId !== undefined) {
      rows = (await this.db`
        SELECT id, policy_id, org_id, status, current_score, current_grade, last_audit_at, last_audit_result, next_audit_at, status_history, certified_since, suspended_at, expires_at, cpoe_id, created_at, updated_at
        FROM certifications
        WHERE org_id = ${orgId}
        ORDER BY created_at DESC
      `) as CertificationRow[];
    } else {
      rows = (await this.db`
        SELECT id, policy_id, org_id, status, current_score, current_grade, last_audit_at, last_audit_result, next_audit_at, status_history, certified_since, suspended_at, expires_at, cpoe_id, created_at, updated_at
        FROM certifications
        ORDER BY created_at DESC
      `) as CertificationRow[];
    }

    return rows.map((row) => this.rowToCertification(row));
  }

  // ---------------------------------------------------------------------------
  // CHECK
  // ---------------------------------------------------------------------------

  /**
   * Check a certification against its policy.
   * Evaluates freshness, score thresholds, and grace period.
   */
  async checkCertification(certId: string): Promise<CertificationCheckResult | undefined> {
    const cert = await this.getCertification(certId);
    if (!cert) return undefined;

    const policy = await this.getPolicy(cert.policyId);
    if (!policy) return undefined;

    const now = new Date();
    const lastAudit = new Date(cert.lastAuditAt);
    const daysSinceAudit = daysBetween(lastAudit, now);
    const needsReaudit = daysSinceAudit > policy.auditIntervalDays;

    // Grace period check: only for degraded certifications
    let gracePeriodExpired = false;
    if (cert.status === "degraded") {
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
   * Returns undefined if certification or policy not found.
   */
  async detectDrift(
    certId: string,
    newAuditResult: AuditResult,
  ): Promise<DriftReport | undefined> {
    const cert = await this.getCertification(certId);
    if (!cert) return undefined;

    const policy = await this.getPolicy(cert.policyId);
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

    // Find degraded controls
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
   * Returns null if transition is invalid or certification not found.
   */
  async updateStatus(
    certId: string,
    newStatus: CertificationStatus,
    reason: string,
  ): Promise<Certification | null> {
    const cert = await this.getCertification(certId);
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

    const statusHistoryJson = JSON.stringify(cert.statusHistory);

    await this.db`
      UPDATE certifications
      SET status = ${newStatus}, updated_at = ${now}, suspended_at = ${cert.suspendedAt ?? null}, status_history = ${statusHistoryJson}
      WHERE id = ${certId}
    `;

    return { ...cert, statusHistory: [...cert.statusHistory] };
  }

  // ---------------------------------------------------------------------------
  // RENEW
  // ---------------------------------------------------------------------------

  /**
   * Process a new audit for an existing certification.
   * Updates score, detects drift, updates status, resets nextAuditAt.
   */
  async renewCertification(
    certId: string,
    auditResult: AuditResult,
  ): Promise<Certification | undefined> {
    const cert = await this.getCertification(certId);
    if (!cert) return undefined;

    const policy = await this.getPolicy(cert.policyId);
    if (!policy) return undefined;

    const now = new Date();
    const newScore = auditResult.score.composite;
    const newGrade = computeGrade(newScore);

    // Detect drift before updating
    const drift = await this.detectDrift(certId, auditResult);

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

    // Determine new status
    let newStatus: CertificationStatus;

    if (
      drift &&
      drift.recommendation === "suspend" &&
      policy.autoSuspend
    ) {
      newStatus = "suspended";
      cert.suspendedAt = now.toISOString();
    } else if (newScore < policy.minimumScore) {
      newStatus = "degraded";
    } else if (newScore < policy.warningThreshold) {
      newStatus = "warning";
    } else {
      newStatus = "active";
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

    // Persist to database
    const statusHistoryJson = JSON.stringify(cert.statusHistory);
    const auditResultJson = JSON.stringify(auditResult);

    await this.db`
      UPDATE certifications
      SET status = ${cert.status}, current_score = ${cert.currentScore}, current_grade = ${cert.currentGrade}, last_audit_at = ${cert.lastAuditAt}, last_audit_result = ${auditResultJson}, next_audit_at = ${cert.nextAuditAt}, status_history = ${statusHistoryJson}, certified_since = ${cert.certifiedSince ?? null}, suspended_at = ${cert.suspendedAt ?? null}, expires_at = ${cert.expiresAt ?? null}, updated_at = ${cert.updatedAt}
      WHERE id = ${certId}
    `;

    return { ...cert, statusHistory: [...cert.statusHistory] };
  }

  // ---------------------------------------------------------------------------
  // EXPIRING CERTIFICATIONS
  // ---------------------------------------------------------------------------

  /** Find certifications expiring within N days. */
  async getExpiringCertifications(withinDays: number): Promise<Certification[]> {
    const cutoff = addDays(new Date(), withinDays).toISOString();

    const rows = (await this.db`
      SELECT id, policy_id, org_id, status, current_score, current_grade, last_audit_at, last_audit_result, next_audit_at, status_history, certified_since, suspended_at, expires_at, cpoe_id, created_at, updated_at
      FROM certifications
      WHERE expires_at IS NOT NULL AND expires_at <= ${cutoff}
      ORDER BY expires_at ASC
    `) as CertificationRow[];

    return rows.map((row) => this.rowToCertification(row));
  }

  // ---------------------------------------------------------------------------
  // SUSPENDED CERTIFICATIONS
  // ---------------------------------------------------------------------------

  /** List all suspended certifications. */
  async getSuspendedCertifications(): Promise<Certification[]> {
    const rows = (await this.db`
      SELECT id, policy_id, org_id, status, current_score, current_grade, last_audit_at, last_audit_result, next_audit_at, status_history, certified_since, suspended_at, expires_at, cpoe_id, created_at, updated_at
      FROM certifications
      WHERE status = ${"suspended"}
      ORDER BY suspended_at DESC
    `) as CertificationRow[];

    return rows.map((row) => this.rowToCertification(row));
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /** Get a policy by ID from the database. */
  private async getPolicy(policyId: string): Promise<CertificationPolicy | undefined> {
    const rows = (await this.db`
      SELECT id, name, scope, minimum_score, warning_threshold, audit_interval_days, freshness_max_days, grace_period_days, auto_renew, auto_suspend, notify_on_change
      FROM certification_policies
      WHERE id = ${policyId}
      LIMIT 1
    `) as PolicyRow[];

    if (rows.length === 0) return undefined;
    return this.rowToPolicy(rows[0]);
  }

  /** Map a Postgres certification row to a Certification object. */
  private rowToCertification(row: CertificationRow): Certification {
    const statusHistory = parseJsonField<Certification["statusHistory"]>(
      row.status_history as string,
    ) ?? [];

    const lastAuditResult = parseJsonField<AuditResult>(
      row.last_audit_result as string,
    );

    return {
      id: row.id,
      policyId: row.policy_id,
      orgId: row.org_id,
      status: row.status,
      currentScore: row.current_score,
      currentGrade: row.current_grade,
      lastAuditAt: row.last_audit_at,
      lastAuditResult: lastAuditResult ?? undefined,
      nextAuditAt: row.next_audit_at,
      statusHistory,
      certifiedSince: row.certified_since ?? undefined,
      suspendedAt: row.suspended_at ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      cpoeId: row.cpoe_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Map a Postgres policy row to a CertificationPolicy object. */
  private rowToPolicy(row: PolicyRow): CertificationPolicy {
    const scope = typeof row.scope === "string" ? JSON.parse(row.scope) : row.scope;

    return {
      id: row.id,
      name: row.name,
      scope,
      minimumScore: row.minimum_score,
      warningThreshold: row.warning_threshold,
      auditIntervalDays: row.audit_interval_days,
      freshnessMaxDays: row.freshness_max_days,
      gracePeriodDays: row.grace_period_days,
      autoRenew: row.auto_renew,
      autoSuspend: row.auto_suspend,
      notifyOnChange: row.notify_on_change,
    };
  }
}
