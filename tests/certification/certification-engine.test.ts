/**
 * Certification Engine Tests -- Continuous Compliance Certification
 *
 * TDD: These tests are written FIRST. They must FAIL before implementation.
 * Then implementation makes them green.
 *
 * Coverage:
 *   - Create certification (passing + failing initial audit)
 *   - Get / list certifications
 *   - Check certification freshness + thresholds
 *   - Drift detection + recommendations
 *   - Status transitions (valid + invalid)
 *   - Renewal pipeline
 *   - Auto-suspend / warning / grace period
 *   - Expiring + suspended queries
 *   - Multiple orgs independence
 *   - Default policy values
 */

import { describe, test, expect, beforeEach } from "bun:test";
import type { AuditResult, AuditScope } from "../../src/audit/types";
import type { EvidenceQualityScore } from "../../src/scoring/types";
import type {
  Certification,
  CertificationPolicy,
  CertificationStatus,
  DriftReport,
} from "../../src/certification/types";
import { CertificationEngine } from "../../src/certification/certification-engine";

// =============================================================================
// HELPERS -- Build test data
// =============================================================================

function makeScope(overrides: Partial<AuditScope> = {}): AuditScope {
  return {
    name: overrides.name ?? "AWS Production",
    frameworks: overrides.frameworks ?? ["SOC2"],
    evidencePaths: overrides.evidencePaths ?? ["/tmp/evidence.json"],
    ...(overrides.formats ? { formats: overrides.formats } : {}),
    ...(overrides.excludeControls
      ? { excludeControls: overrides.excludeControls }
      : {}),
  };
}

function makeScore(
  composite: number,
  grade?: string,
): EvidenceQualityScore {
  const g =
    grade ??
    (composite >= 90
      ? "A"
      : composite >= 80
        ? "B"
        : composite >= 70
          ? "C"
          : composite >= 60
            ? "D"
            : "F");
  return {
    composite,
    grade: g as EvidenceQualityScore["grade"],
    dimensions: [],
    controlsScored: 10,
    scoredAt: new Date().toISOString(),
    engineVersion: "1.0.0",
  };
}

function makeAuditResult(
  overrides: Partial<AuditResult> & { score?: EvidenceQualityScore } = {},
): AuditResult {
  const score = overrides.score ?? makeScore(85);
  return {
    id: overrides.id ?? `audit-${crypto.randomUUID()}`,
    scope: overrides.scope ?? makeScope(),
    startedAt: overrides.startedAt ?? new Date().toISOString(),
    completedAt: overrides.completedAt ?? new Date().toISOString(),
    duration: overrides.duration ?? 1200,
    evidence: overrides.evidence ?? [],
    score,
    findings: overrides.findings ?? [],
    governance: overrides.governance,
    summary: overrides.summary ?? {
      totalControls: 20,
      passed: 18,
      failed: 2,
      skipped: 0,
      score: score.composite,
      grade: score.grade,
      criticalFindings: 0,
      highFindings: 1,
    },
  };
}

function makePolicy(
  overrides: Partial<CertificationPolicy> = {},
): CertificationPolicy {
  return {
    id: overrides.id ?? `policy-${crypto.randomUUID()}`,
    name: overrides.name ?? "SOC 2 Certification",
    scope: overrides.scope ?? makeScope(),
    minimumScore: overrides.minimumScore ?? 70,
    warningThreshold: overrides.warningThreshold ?? 80,
    auditIntervalDays: overrides.auditIntervalDays ?? 90,
    freshnessMaxDays: overrides.freshnessMaxDays ?? 7,
    gracePeriodDays: overrides.gracePeriodDays ?? 14,
    autoRenew: overrides.autoRenew ?? true,
    autoSuspend: overrides.autoSuspend ?? true,
    notifyOnChange: overrides.notifyOnChange ?? true,
  };
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe("CertificationEngine", () => {
  let engine: CertificationEngine;

  beforeEach(() => {
    engine = new CertificationEngine();
  });

  // ===========================================================================
  // CREATE CERTIFICATION
  // ===========================================================================

  describe("createCertification", () => {
    test("should create certification with passing audit result -> active status", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const auditResult = makeAuditResult({ score: makeScore(85) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      expect(cert.id).toBeTruthy();
      expect(cert.policyId).toBe(policy.id);
      expect(cert.orgId).toBe("org-1");
      expect(cert.status).toBe("active");
      expect(cert.currentScore).toBe(85);
      expect(cert.lastAuditResult).toBeDefined();
      expect(cert.createdAt).toBeTruthy();
      expect(cert.nextAuditAt).toBeTruthy();
    });

    test("should create certification with failing audit result -> degraded status", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const auditResult = makeAuditResult({ score: makeScore(55) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      expect(cert.status).toBe("degraded");
      expect(cert.currentScore).toBe(55);
    });

    test("should create certification with score at warning threshold -> warning status", () => {
      const policy = makePolicy({
        minimumScore: 70,
        warningThreshold: 80,
      });
      const auditResult = makeAuditResult({ score: makeScore(75) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      expect(cert.status).toBe("warning");
      expect(cert.currentScore).toBe(75);
    });

    test("should set certifiedSince when initial audit passes", () => {
      const policy = makePolicy();
      const auditResult = makeAuditResult({ score: makeScore(90) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      expect(cert.certifiedSince).toBeTruthy();
    });

    test("should NOT set certifiedSince when initial audit fails", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const auditResult = makeAuditResult({ score: makeScore(50) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      expect(cert.certifiedSince).toBeUndefined();
    });

    test("should set nextAuditAt based on policy auditIntervalDays", () => {
      const policy = makePolicy({ auditIntervalDays: 30 });
      const auditResult = makeAuditResult({ score: makeScore(85) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      const nextAudit = new Date(cert.nextAuditAt);
      const now = new Date();
      const diffDays = (nextAudit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Should be approximately 30 days from now (allow 1 day tolerance)
      expect(diffDays).toBeGreaterThan(28);
      expect(diffDays).toBeLessThan(31);
    });

    test("should set expiresAt based on audit interval + grace period", () => {
      const policy = makePolicy({
        auditIntervalDays: 90,
        gracePeriodDays: 14,
      });
      const auditResult = makeAuditResult({ score: makeScore(85) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      expect(cert.expiresAt).toBeTruthy();
      const expires = new Date(cert.expiresAt!);
      const now = new Date();
      const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Should be approximately 90 + 14 = 104 days
      expect(diffDays).toBeGreaterThan(102);
      expect(diffDays).toBeLessThan(106);
    });

    test("should record initial status in statusHistory", () => {
      const policy = makePolicy();
      const auditResult = makeAuditResult({ score: makeScore(85) });

      const cert = engine.createCertification("org-1", policy, auditResult);

      expect(cert.statusHistory.length).toBe(1);
      expect(cert.statusHistory[0].status).toBe("active");
      expect(cert.statusHistory[0].reason).toBe("Initial certification");
      expect(cert.statusHistory[0].score).toBe(85);
    });
  });

  // ===========================================================================
  // GET CERTIFICATION
  // ===========================================================================

  describe("getCertification", () => {
    test("should return certification by ID", () => {
      const policy = makePolicy();
      const auditResult = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, auditResult);

      const retrieved = engine.getCertification(cert.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(cert.id);
      expect(retrieved!.orgId).toBe("org-1");
    });

    test("should return undefined for non-existent ID", () => {
      const result = engine.getCertification("non-existent-id");
      expect(result).toBeUndefined();
    });
  });

  // ===========================================================================
  // LIST CERTIFICATIONS
  // ===========================================================================

  describe("listCertifications", () => {
    test("should list certifications filtered by orgId", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });

      engine.createCertification("org-1", policy, audit);
      engine.createCertification("org-1", makePolicy(), audit);
      engine.createCertification("org-2", makePolicy(), audit);

      const org1Certs = engine.listCertifications("org-1");
      expect(org1Certs.length).toBe(2);
      expect(org1Certs.every((c) => c.orgId === "org-1")).toBe(true);
    });

    test("should list all certifications when no orgId provided", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });

      engine.createCertification("org-1", policy, audit);
      engine.createCertification("org-2", makePolicy(), audit);
      engine.createCertification("org-3", makePolicy(), audit);

      const allCerts = engine.listCertifications();
      expect(allCerts.length).toBe(3);
    });

    test("should return empty array when no certifications exist", () => {
      const result = engine.listCertifications();
      expect(result).toEqual([]);
    });

    test("should return empty array for org with no certifications", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      engine.createCertification("org-1", policy, audit);

      const result = engine.listCertifications("org-2");
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // CHECK CERTIFICATION
  // ===========================================================================

  describe("checkCertification", () => {
    test("should return active when fresh and score above warning threshold", () => {
      const policy = makePolicy({
        minimumScore: 70,
        warningThreshold: 80,
        auditIntervalDays: 90,
      });
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      const check = engine.checkCertification(cert.id);

      expect(check).toBeDefined();
      expect(check!.status).toBe("active");
      expect(check!.needsReaudit).toBe(false);
    });

    test("should flag needs re-audit when audit is stale", () => {
      const policy = makePolicy({ auditIntervalDays: 1 }); // 1 day
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      // Manually set lastAuditAt to 2 days ago to simulate staleness
      engine.setLastAuditAt(
        cert.id,
        new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      );

      const check = engine.checkCertification(cert.id);

      expect(check).toBeDefined();
      expect(check!.needsReaudit).toBe(true);
    });

    test("should return warning when score below warning threshold but above minimum", () => {
      const policy = makePolicy({
        minimumScore: 70,
        warningThreshold: 80,
      });
      const audit = makeAuditResult({ score: makeScore(75) });
      const cert = engine.createCertification("org-1", policy, audit);

      const check = engine.checkCertification(cert.id);

      expect(check).toBeDefined();
      expect(check!.status).toBe("warning");
    });

    test("should return degraded when score below minimum", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);

      const check = engine.checkCertification(cert.id);

      expect(check).toBeDefined();
      expect(check!.status).toBe("degraded");
    });

    test("should return undefined for non-existent certification", () => {
      const check = engine.checkCertification("non-existent");
      expect(check).toBeUndefined();
    });
  });

  // ===========================================================================
  // DRIFT DETECTION
  // ===========================================================================

  describe("detectDrift", () => {
    test("should detect small score drop -> monitor recommendation", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({
        score: makeScore(82),
        summary: {
          totalControls: 20,
          passed: 17,
          failed: 3,
          skipped: 0,
          score: 82,
          grade: "B",
          criticalFindings: 0,
          highFindings: 1,
        },
      });

      const drift = engine.detectDrift(cert.id, newAudit);

      expect(drift).toBeDefined();
      expect(drift!.previousScore).toBe(85);
      expect(drift!.currentScore).toBe(82);
      expect(drift!.scoreDelta).toBe(-3);
      expect(drift!.recommendation).toBe("monitor");
    });

    test("should detect significant score drop -> investigate recommendation", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(72) });

      const drift = engine.detectDrift(cert.id, newAudit);

      expect(drift).toBeDefined();
      expect(drift!.scoreDelta).toBe(-13);
      expect(drift!.recommendation).toBe("investigate");
    });

    test("should detect drop below minimum -> suspend recommendation", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(55) });

      const drift = engine.detectDrift(cert.id, newAudit);

      expect(drift).toBeDefined();
      expect(drift!.currentScore).toBe(55);
      expect(drift!.recommendation).toBe("suspend");
    });

    test("should find degraded controls between audits", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const initialAudit = makeAuditResult({
        score: makeScore(85),
        summary: {
          totalControls: 20,
          passed: 18,
          failed: 2,
          skipped: 0,
          score: 85,
          grade: "B",
          criticalFindings: 0,
          highFindings: 0,
        },
        findings: [
          {
            id: "HIGH-001",
            severity: "high",
            category: "failure",
            controlId: "CTRL-1",
            title: "Control 1 failed",
            description: "desc",
            evidence: { source: "prowler", controlStatus: "fail" },
          },
        ],
      });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({
        score: makeScore(72),
        summary: {
          totalControls: 20,
          passed: 14,
          failed: 6,
          skipped: 0,
          score: 72,
          grade: "C",
          criticalFindings: 1,
          highFindings: 2,
        },
        findings: [
          {
            id: "CRIT-001",
            severity: "critical",
            category: "failure",
            controlId: "CTRL-2",
            title: "Control 2 failed",
            description: "desc",
            evidence: { source: "prowler", controlStatus: "fail" },
          },
          {
            id: "HIGH-001",
            severity: "high",
            category: "failure",
            controlId: "CTRL-1",
            title: "Control 1 still failed",
            description: "desc",
            evidence: { source: "prowler", controlStatus: "fail" },
          },
          {
            id: "HIGH-002",
            severity: "high",
            category: "failure",
            controlId: "CTRL-3",
            title: "Control 3 failed",
            description: "desc",
            evidence: { source: "prowler", controlStatus: "fail" },
          },
        ],
      });

      const drift = engine.detectDrift(cert.id, newAudit);

      expect(drift).toBeDefined();
      // New findings that weren't in previous should appear as degraded controls
      expect(drift!.degradedControls.length).toBeGreaterThan(0);
    });

    test("should return undefined for non-existent certification", () => {
      const newAudit = makeAuditResult({ score: makeScore(85) });
      const drift = engine.detectDrift("non-existent", newAudit);
      expect(drift).toBeUndefined();
    });

    test("should set certificationId on drift report", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(75) });
      const drift = engine.detectDrift(cert.id, newAudit);

      expect(drift).toBeDefined();
      expect(drift!.certificationId).toBe(cert.id);
      expect(drift!.detectedAt).toBeTruthy();
    });
  });

  // ===========================================================================
  // STATUS TRANSITIONS
  // ===========================================================================

  describe("updateStatus", () => {
    test("should transition active -> warning (valid)", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "warning", "Score declining");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("warning");
    });

    test("should transition active -> degraded (valid)", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "degraded", "Score below minimum");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("degraded");
    });

    test("should transition active -> suspended (valid)", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "suspended", "Drift detected");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("suspended");
      expect(updated!.suspendedAt).toBeTruthy();
    });

    test("should transition active -> revoked (valid)", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "revoked", "Manual revocation");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("revoked");
    });

    test("should transition warning -> active (valid)", () => {
      const policy = makePolicy({ minimumScore: 70, warningThreshold: 80 });
      const audit = makeAuditResult({ score: makeScore(75) });
      const cert = engine.createCertification("org-1", policy, audit);
      expect(cert.status).toBe("warning");

      const updated = engine.updateStatus(cert.id, "active", "Score recovered");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("active");
    });

    test("should transition warning -> degraded (valid)", () => {
      const policy = makePolicy({ minimumScore: 70, warningThreshold: 80 });
      const audit = makeAuditResult({ score: makeScore(75) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "degraded", "Score dropped further");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("degraded");
    });

    test("should transition degraded -> active (valid, re-recovery)", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);
      expect(cert.status).toBe("degraded");

      const updated = engine.updateStatus(cert.id, "active", "Full recovery");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("active");
    });

    test("should transition degraded -> suspended (valid)", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "suspended", "Grace period expired");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("suspended");
    });

    test("should transition degraded -> expired (valid)", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "expired", "Not renewed in time");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("expired");
    });

    test("should transition suspended -> active (valid, re-certification)", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);
      engine.updateStatus(cert.id, "suspended", "Drift");

      const updated = engine.updateStatus(cert.id, "active", "Re-certified after remediation");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("active");
    });

    test("should transition suspended -> revoked (valid)", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);
      engine.updateStatus(cert.id, "suspended", "Drift");

      const updated = engine.updateStatus(cert.id, "revoked", "Manual revocation");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("revoked");
    });

    test("should transition expired -> active (valid, re-certification)", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);
      engine.updateStatus(cert.id, "expired", "Timeout");

      const updated = engine.updateStatus(cert.id, "active", "Re-certified");

      expect(updated).toBeDefined();
      expect(updated!.status).toBe("active");
    });

    test("should reject transition from revoked (terminal state)", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);
      engine.updateStatus(cert.id, "revoked", "Manual revocation");

      const updated = engine.updateStatus(cert.id, "active", "Attempt to revive");

      expect(updated).toBeNull();
    });

    test("should reject invalid transition from active -> expired", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      const updated = engine.updateStatus(cert.id, "expired", "Invalid transition");

      expect(updated).toBeNull();
    });

    test("should record status change in history", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      engine.updateStatus(cert.id, "warning", "Score declining");
      engine.updateStatus(cert.id, "degraded", "Below threshold");

      const updated = engine.getCertification(cert.id);
      expect(updated!.statusHistory.length).toBe(3); // initial + 2 transitions
      expect(updated!.statusHistory[1].status).toBe("warning");
      expect(updated!.statusHistory[1].reason).toBe("Score declining");
      expect(updated!.statusHistory[2].status).toBe("degraded");
    });

    test("should return null for non-existent certification", () => {
      const result = engine.updateStatus("non-existent", "active", "test");
      expect(result).toBeNull();
    });

    test("should update updatedAt timestamp on status change", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);
      const originalUpdatedAt = cert.updatedAt;

      // Small delay to ensure timestamp differs
      const updated = engine.updateStatus(cert.id, "warning", "Score declining");

      expect(updated!.updatedAt).toBeTruthy();
      // updatedAt should be same or after original
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(originalUpdatedAt).getTime(),
      );
    });
  });

  // ===========================================================================
  // RENEW CERTIFICATION
  // ===========================================================================

  describe("renewCertification", () => {
    test("should update score and grade on passing audit", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const initialAudit = makeAuditResult({ score: makeScore(80) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(92) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      expect(renewed!.currentScore).toBe(92);
      expect(renewed!.currentGrade).toBe("A");
    });

    test("should set nextAuditAt on renewal", () => {
      const policy = makePolicy({
        minimumScore: 70,
        auditIntervalDays: 30,
      });
      const initialAudit = makeAuditResult({ score: makeScore(80) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(88) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      const nextAudit = new Date(renewed!.nextAuditAt);
      const now = new Date();
      const diffDays = (nextAudit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(28);
      expect(diffDays).toBeLessThan(31);
    });

    test("should trigger degraded status on failing audit", () => {
      const policy = makePolicy({ minimumScore: 70, autoSuspend: false });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(55) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      expect(renewed!.status).toBe("degraded");
      expect(renewed!.currentScore).toBe(55);
    });

    test("should auto-suspend on drift when policy.autoSuspend is true", () => {
      const policy = makePolicy({
        minimumScore: 70,
        autoSuspend: true,
      });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      // Drop below minimum = suspend recommendation
      const newAudit = makeAuditResult({ score: makeScore(50) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      expect(renewed!.status).toBe("suspended");
      expect(renewed!.suspendedAt).toBeTruthy();
    });

    test("should NOT auto-suspend when policy.autoSuspend is false", () => {
      const policy = makePolicy({
        minimumScore: 70,
        autoSuspend: false,
      });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(50) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      // Should be degraded, NOT suspended (autoSuspend=false)
      expect(renewed!.status).toBe("degraded");
    });

    test("should trigger warning when score drops below warning threshold", () => {
      const policy = makePolicy({
        minimumScore: 70,
        warningThreshold: 80,
      });
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(75) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      expect(renewed!.status).toBe("warning");
    });

    test("should update lastAuditResult on renewal", () => {
      const policy = makePolicy();
      const initialAudit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, initialAudit);

      const newAudit = makeAuditResult({ score: makeScore(90) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      expect(renewed!.lastAuditResult).toBeDefined();
      expect(renewed!.lastAuditResult!.score.composite).toBe(90);
    });

    test("should return undefined for non-existent certification", () => {
      const audit = makeAuditResult({ score: makeScore(85) });
      const result = engine.renewCertification("non-existent", audit);
      expect(result).toBeUndefined();
    });

    test("should recover from warning to active when score improves", () => {
      const policy = makePolicy({
        minimumScore: 70,
        warningThreshold: 80,
      });
      const initialAudit = makeAuditResult({ score: makeScore(75) });
      const cert = engine.createCertification("org-1", policy, initialAudit);
      expect(cert.status).toBe("warning");

      const newAudit = makeAuditResult({ score: makeScore(90) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      expect(renewed!.status).toBe("active");
      expect(renewed!.currentScore).toBe(90);
    });
  });

  // ===========================================================================
  // GRACE PERIOD
  // ===========================================================================

  describe("grace period", () => {
    test("should transition degraded -> suspended after grace period expires", () => {
      const policy = makePolicy({
        minimumScore: 70,
        gracePeriodDays: 14,
      });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);
      expect(cert.status).toBe("degraded");

      // Simulate grace period expiry by setting degraded timestamp in the past
      engine.setStatusChangedAt(
        cert.id,
        "degraded",
        new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      );

      const check = engine.checkCertification(cert.id);

      expect(check).toBeDefined();
      expect(check!.gracePeriodExpired).toBe(true);
    });

    test("should NOT expire grace period if within grace period days", () => {
      const policy = makePolicy({
        minimumScore: 70,
        gracePeriodDays: 14,
      });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);

      const check = engine.checkCertification(cert.id);

      expect(check).toBeDefined();
      expect(check!.gracePeriodExpired).toBe(false);
    });
  });

  // ===========================================================================
  // EXPIRING / SUSPENDED QUERIES
  // ===========================================================================

  describe("getExpiringCertifications", () => {
    test("should find certifications expiring within N days", () => {
      const policy = makePolicy({
        auditIntervalDays: 5,
        gracePeriodDays: 2,
      });
      const audit = makeAuditResult({ score: makeScore(85) });
      const cert = engine.createCertification("org-1", policy, audit);

      // This cert expires in ~7 days (5 + 2)
      const expiring = engine.getExpiringCertifications(10);
      expect(expiring.length).toBe(1);
      expect(expiring[0].id).toBe(cert.id);
    });

    test("should NOT find certifications expiring beyond N days", () => {
      const policy = makePolicy({
        auditIntervalDays: 90,
        gracePeriodDays: 14,
      });
      const audit = makeAuditResult({ score: makeScore(85) });
      engine.createCertification("org-1", policy, audit);

      // This cert expires in ~104 days, querying for 30 should miss it
      const expiring = engine.getExpiringCertifications(30);
      expect(expiring.length).toBe(0);
    });

    test("should return empty array when no certifications exist", () => {
      const expiring = engine.getExpiringCertifications(30);
      expect(expiring).toEqual([]);
    });
  });

  describe("getSuspendedCertifications", () => {
    test("should list all suspended certifications", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });

      const cert1 = engine.createCertification("org-1", policy, audit);
      const cert2 = engine.createCertification("org-2", makePolicy(), audit);
      engine.createCertification("org-3", makePolicy(), audit);

      engine.updateStatus(cert1.id, "suspended", "Drift");
      engine.updateStatus(cert2.id, "suspended", "Drift");

      const suspended = engine.getSuspendedCertifications();
      expect(suspended.length).toBe(2);
      expect(suspended.map((c) => c.status)).toEqual(["suspended", "suspended"]);
    });

    test("should return empty array when no suspended certifications", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });
      engine.createCertification("org-1", policy, audit);

      const suspended = engine.getSuspendedCertifications();
      expect(suspended).toEqual([]);
    });
  });

  // ===========================================================================
  // MULTIPLE ORGS INDEPENDENCE
  // ===========================================================================

  describe("multi-org isolation", () => {
    test("should maintain independent certifications for different orgs", () => {
      const policy1 = makePolicy({ minimumScore: 70 });
      const policy2 = makePolicy({ minimumScore: 80 });

      const audit1 = makeAuditResult({ score: makeScore(75) });
      const audit2 = makeAuditResult({ score: makeScore(75) });

      const cert1 = engine.createCertification("org-1", policy1, audit1);
      const cert2 = engine.createCertification("org-2", policy2, audit2);

      // Same score (75) but different policies
      // org-1: 75 >= 70 minimum, but need to check warningThreshold (default 80), so warning
      // org-2: 75 < 80 minimum, so degraded
      expect(cert1.status).toBe("warning");
      expect(cert2.status).toBe("degraded");
    });

    test("should not affect other org when updating one org certification", () => {
      const policy = makePolicy();
      const audit = makeAuditResult({ score: makeScore(85) });

      const cert1 = engine.createCertification("org-1", policy, audit);
      const cert2 = engine.createCertification("org-2", makePolicy(), audit);

      engine.updateStatus(cert1.id, "suspended", "Drift");

      const org1Cert = engine.getCertification(cert1.id);
      const org2Cert = engine.getCertification(cert2.id);

      expect(org1Cert!.status).toBe("suspended");
      expect(org2Cert!.status).toBe("active");
    });
  });

  // ===========================================================================
  // RE-CERTIFICATION AFTER EXPIRY
  // ===========================================================================

  describe("re-certification", () => {
    test("should allow re-certification after expiry via renewal", () => {
      const policy = makePolicy({ minimumScore: 70 });
      const audit = makeAuditResult({ score: makeScore(60) });
      const cert = engine.createCertification("org-1", policy, audit);

      // Move to expired
      engine.updateStatus(cert.id, "expired", "Timeout");
      expect(engine.getCertification(cert.id)!.status).toBe("expired");

      // Re-certify with passing audit
      const newAudit = makeAuditResult({ score: makeScore(90) });
      const renewed = engine.renewCertification(cert.id, newAudit);

      expect(renewed).toBeDefined();
      expect(renewed!.status).toBe("active");
      expect(renewed!.currentScore).toBe(90);
    });
  });

  // ===========================================================================
  // DEFAULT POLICY VALUES
  // ===========================================================================

  describe("default policy values", () => {
    test("should use sensible defaults in CertificationEngine config", () => {
      const config = engine.getConfig();

      expect(config.checkIntervalMs).toBe(3600000); // 1 hour
      expect(config.maxConcurrentAudits).toBe(3);
    });

    test("should allow custom config on engine creation", () => {
      const customEngine = new CertificationEngine({
        checkIntervalMs: 1800000,
        maxConcurrentAudits: 5,
        defaultPolicy: {},
      });

      const config = customEngine.getConfig();
      expect(config.checkIntervalMs).toBe(1800000);
      expect(config.maxConcurrentAudits).toBe(5);
    });
  });
});
