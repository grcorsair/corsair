/**
 * PgCertificationEngine Tests -- Postgres-backed Continuous Compliance Certification
 *
 * Tests for Postgres-backed certification engine. Uses a mock sql connection
 * to verify query construction, row mapping, and interface compatibility
 * without requiring a real Postgres instance.
 *
 * TDD: Tests written FIRST, then implementation makes them green.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { PgCertificationEngine } from "../../src/certification/pg-certification-engine";
import type { AuditResult, AuditScope } from "../../src/audit/types";
import type { EvidenceQualityScore } from "../../src/scoring/types";
import type {
  Certification,
  CertificationPolicy,
  CertificationStatus,
  DriftReport,
} from "../../src/certification/types";

// =============================================================================
// MOCK SQL HELPER
// =============================================================================

interface MockSqlCall {
  strings: readonly string[];
  values: unknown[];
}

function createMockSql(defaultRows: unknown[] = []) {
  const calls: MockSqlCall[] = [];
  let nextResult: unknown[] = defaultRows;

  const mockSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ strings: [...strings], values });
    const result = nextResult;
    nextResult = defaultRows;
    return Promise.resolve(result);
  };

  return {
    sql: mockSql as unknown as ReturnType<typeof import("../../src/db/connection").getDb>,
    calls,
    setNextResult: (rows: unknown[]) => {
      nextResult = rows;
    },
  };
}

// =============================================================================
// TEST DATA HELPERS
// =============================================================================

function makeScope(overrides: Partial<AuditScope> = {}): AuditScope {
  return {
    name: overrides.name ?? "AWS Production",
    frameworks: overrides.frameworks ?? ["SOC2"],
    evidencePaths: overrides.evidencePaths ?? ["/tmp/evidence.json"],
  };
}

function makeScore(composite: number): EvidenceQualityScore {
  const g =
    composite >= 90 ? "A" : composite >= 80 ? "B" : composite >= 70 ? "C" : composite >= 60 ? "D" : "F";
  return {
    composite,
    grade: g as EvidenceQualityScore["grade"],
    dimensions: [],
    controlsScored: 10,
    scoredAt: new Date().toISOString(),
    engineVersion: "1.0.0",
  };
}

function makeAuditResult(score: number = 85): AuditResult {
  return {
    id: `audit-${crypto.randomUUID()}`,
    scope: makeScope(),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    duration: 1000,
    evidence: [],
    score: makeScore(score),
    findings: [],
    summary: {
      totalControls: 10,
      passed: score >= 70 ? 8 : 5,
      failed: score >= 70 ? 2 : 5,
      skipped: 0,
      score,
      grade: score >= 90 ? "A" : score >= 80 ? "B" : "C",
      criticalFindings: 0,
      highFindings: score >= 70 ? 1 : 3,
    },
  };
}

function makePolicy(overrides: Partial<CertificationPolicy> = {}): CertificationPolicy {
  return {
    id: overrides.id ?? "policy-1",
    name: overrides.name ?? "SOC 2 Production",
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
// TESTS
// =============================================================================

describe("PgCertificationEngine", () => {
  // ===========================================================================
  // INSTANTIATION
  // ===========================================================================

  describe("constructor", () => {
    test("should instantiate with a mock sql connection", () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      expect(engine).toBeDefined();
    });

    test("should expose all expected methods", () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      expect(typeof engine.createCertification).toBe("function");
      expect(typeof engine.getCertification).toBe("function");
      expect(typeof engine.listCertifications).toBe("function");
      expect(typeof engine.checkCertification).toBe("function");
      expect(typeof engine.detectDrift).toBe("function");
      expect(typeof engine.updateStatus).toBe("function");
      expect(typeof engine.renewCertification).toBe("function");
      expect(typeof engine.getExpiringCertifications).toBe("function");
      expect(typeof engine.getSuspendedCertifications).toBe("function");
    });
  });

  // ===========================================================================
  // CREATE CERTIFICATION
  // ===========================================================================

  describe("createCertification", () => {
    test("should insert a certification row via SQL", async () => {
      const { sql, calls } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const policy = makePolicy();
      const audit = makeAuditResult(85);

      const cert = await engine.createCertification("org-1", policy, audit);
      expect(cert.orgId).toBe("org-1");
      expect(cert.policyId).toBe("policy-1");
      expect(cert.status).toBe("active");
      expect(calls.length).toBeGreaterThan(0);
    });

    test("should generate a unique certification ID", async () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.createCertification("org-1", makePolicy(), makeAuditResult(85));
      expect(cert.id).toBeDefined();
      expect(cert.id).toMatch(/^cert-/);
    });

    test("should set status to active when score >= warningThreshold", async () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.createCertification("org-1", makePolicy(), makeAuditResult(85));
      expect(cert.status).toBe("active");
    });

    test("should set status to warning when score between minimum and warning", async () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.createCertification(
        "org-1",
        makePolicy({ minimumScore: 70, warningThreshold: 80 }),
        makeAuditResult(75),
      );
      expect(cert.status).toBe("warning");
    });

    test("should set status to degraded when score < minimumScore", async () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.createCertification(
        "org-1",
        makePolicy({ minimumScore: 70 }),
        makeAuditResult(50),
      );
      expect(cert.status).toBe("degraded");
    });

    test("should compute grade from score", async () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.createCertification("org-1", makePolicy(), makeAuditResult(92));
      expect(cert.currentGrade).toBe("A");
    });

    test("should initialize status history", async () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.createCertification("org-1", makePolicy(), makeAuditResult(85));
      expect(cert.statusHistory).toBeDefined();
      expect(cert.statusHistory.length).toBe(1);
      expect(cert.statusHistory[0].status).toBe("active");
      expect(cert.statusHistory[0].reason).toBe("Initial certification");
    });

    test("should set nextAuditAt based on policy interval", async () => {
      const { sql } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.createCertification(
        "org-1",
        makePolicy({ auditIntervalDays: 90 }),
        makeAuditResult(85),
      );
      expect(cert.nextAuditAt).toBeDefined();
      const nextAudit = new Date(cert.nextAuditAt);
      const now = new Date();
      const diffDays = (nextAudit.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(85);
      expect(diffDays).toBeLessThan(95);
    });

    test("should use parameterized SQL queries", async () => {
      const { sql, calls } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      await engine.createCertification("org-1", makePolicy(), makeAuditResult(85));

      for (const call of calls) {
        const joined = call.strings.join("");
        expect(joined).not.toContain("org-1");
      }
    });
  });

  // ===========================================================================
  // GET CERTIFICATION
  // ===========================================================================

  describe("getCertification", () => {
    test("should return certification from database row", async () => {
      const mockRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: "2026-02-01T00:00:00.000Z",
        last_audit_result: JSON.stringify(makeAuditResult(85)),
        next_audit_at: "2026-05-01T00:00:00.000Z",
        status_history: JSON.stringify([
          { status: "active", changedAt: "2026-02-01T00:00:00.000Z", reason: "Initial", score: 85 },
        ]),
        certified_since: "2026-02-01T00:00:00.000Z",
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([mockRow]);

      const cert = await engine.getCertification("cert-123");
      expect(cert).toBeDefined();
      expect(cert!.id).toBe("cert-123");
      expect(cert!.orgId).toBe("org-1");
      expect(cert!.status).toBe("active");
      expect(cert!.currentScore).toBe(85);
      expect(cert!.currentGrade).toBe("B");
    });

    test("should return undefined when not found", async () => {
      const { sql } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const cert = await engine.getCertification("cert-nonexistent");
      expect(cert).toBeUndefined();
    });

    test("should handle JSONB status_history", async () => {
      const history = [
        { status: "active", changedAt: "2026-02-01T00:00:00.000Z", reason: "Initial", score: 85 },
        { status: "warning", changedAt: "2026-02-10T00:00:00.000Z", reason: "Score drop", score: 75 },
      ];
      const mockRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "warning",
        current_score: 75,
        current_grade: "C",
        last_audit_at: "2026-02-10T00:00:00.000Z",
        last_audit_result: null,
        next_audit_at: "2026-05-10T00:00:00.000Z",
        status_history: JSON.stringify(history),
        certified_since: "2026-02-01T00:00:00.000Z",
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-10T00:00:00.000Z",
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([mockRow]);

      const cert = await engine.getCertification("cert-123");
      expect(cert!.statusHistory).toHaveLength(2);
      expect(cert!.statusHistory[1].status).toBe("warning");
    });

    test("should handle already-parsed JSONB objects", async () => {
      const history = [
        { status: "active", changedAt: "2026-02-01T00:00:00.000Z", reason: "Initial", score: 85 },
      ];
      const mockRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: "2026-02-01T00:00:00.000Z",
        last_audit_result: makeAuditResult(85), // Already parsed object
        next_audit_at: "2026-05-01T00:00:00.000Z",
        status_history: history, // Already parsed array
        certified_since: "2026-02-01T00:00:00.000Z",
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: "2026-02-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([mockRow]);

      const cert = await engine.getCertification("cert-123");
      expect(cert!.statusHistory).toHaveLength(1);
      expect(cert!.lastAuditResult).toBeDefined();
    });
  });

  // ===========================================================================
  // LIST CERTIFICATIONS
  // ===========================================================================

  describe("listCertifications", () => {
    test("should return all certifications when no filter", async () => {
      const rows = [
        {
          id: "cert-1", policy_id: "p-1", org_id: "org-1", status: "active",
          current_score: 85, current_grade: "B",
          last_audit_at: "2026-02-01T00:00:00.000Z", last_audit_result: null,
          next_audit_at: "2026-05-01T00:00:00.000Z",
          status_history: "[]",
          certified_since: null, suspended_at: null, expires_at: null, cpoe_id: null,
          created_at: "2026-02-01T00:00:00.000Z", updated_at: "2026-02-01T00:00:00.000Z",
        },
        {
          id: "cert-2", policy_id: "p-2", org_id: "org-2", status: "warning",
          current_score: 75, current_grade: "C",
          last_audit_at: "2026-02-01T00:00:00.000Z", last_audit_result: null,
          next_audit_at: "2026-05-01T00:00:00.000Z",
          status_history: "[]",
          certified_since: null, suspended_at: null, expires_at: null, cpoe_id: null,
          created_at: "2026-02-01T00:00:00.000Z", updated_at: "2026-02-01T00:00:00.000Z",
        },
      ];
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult(rows);

      const certs = await engine.listCertifications();
      expect(certs).toHaveLength(2);
    });

    test("should filter by orgId when provided", async () => {
      const { sql, calls } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      await engine.listCertifications("org-1");

      // Should use a WHERE clause with org_id parameter
      const hasOrgFilter = calls.some((c) =>
        c.strings.join("").toLowerCase().includes("org_id"),
      );
      expect(hasOrgFilter).toBe(true);
    });

    test("should return empty array when no certifications exist", async () => {
      const { sql } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const certs = await engine.listCertifications();
      expect(certs).toHaveLength(0);
    });
  });

  // ===========================================================================
  // CHECK CERTIFICATION
  // ===========================================================================

  describe("checkCertification", () => {
    test("should return check result from database row", async () => {
      const certRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: new Date().toISOString(),
        last_audit_result: null,
        next_audit_at: "2026-05-01T00:00:00.000Z",
        status_history: JSON.stringify([
          { status: "active", changedAt: new Date().toISOString(), reason: "Initial", score: 85 },
        ]),
        certified_since: new Date().toISOString(),
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const policyRow = {
        id: "policy-1",
        name: "SOC 2 Production",
        scope: JSON.stringify(makeScope()),
        minimum_score: 70,
        warning_threshold: 80,
        audit_interval_days: 90,
        freshness_max_days: 7,
        grace_period_days: 14,
        auto_renew: true,
        auto_suspend: true,
        notify_on_change: true,
      };

      let callCount = 0;
      const customSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([certRow]);
        return Promise.resolve([policyRow]);
      };
      const engine = new PgCertificationEngine(customSql as any);

      const result = await engine.checkCertification("cert-123");
      expect(result).toBeDefined();
      expect(result!.status).toBe("active");
      expect(result!.currentScore).toBe(85);
    });

    test("should return undefined when certification not found", async () => {
      const { sql } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const result = await engine.checkCertification("cert-nonexistent");
      expect(result).toBeUndefined();
    });
  });

  // ===========================================================================
  // DRIFT DETECTION
  // ===========================================================================

  describe("detectDrift", () => {
    test("should return drift report comparing scores", async () => {
      const certRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: new Date().toISOString(),
        last_audit_result: JSON.stringify(makeAuditResult(85)),
        next_audit_at: "2026-05-01T00:00:00.000Z",
        status_history: "[]",
        certified_since: new Date().toISOString(),
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const policyRow = {
        id: "policy-1",
        name: "SOC 2 Production",
        scope: JSON.stringify(makeScope()),
        minimum_score: 70,
        warning_threshold: 80,
        audit_interval_days: 90,
        freshness_max_days: 7,
        grace_period_days: 14,
        auto_renew: true,
        auto_suspend: true,
        notify_on_change: true,
      };

      let callCount = 0;
      const customSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
        callCount++;
        if (callCount === 1) return Promise.resolve([certRow]);
        return Promise.resolve([policyRow]);
      };
      const engine = new PgCertificationEngine(customSql as any);

      const newAudit = makeAuditResult(65); // Score dropped
      const drift = await engine.detectDrift("cert-123", newAudit);
      expect(drift).toBeDefined();
      expect(drift!.previousScore).toBe(85);
      expect(drift!.currentScore).toBe(65);
      expect(drift!.scoreDelta).toBe(-20);
      expect(drift!.recommendation).toBe("suspend"); // Below minimum score
    });

    test("should return undefined when certification not found", async () => {
      const { sql } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const drift = await engine.detectDrift("cert-nonexistent", makeAuditResult(85));
      expect(drift).toBeUndefined();
    });
  });

  // ===========================================================================
  // UPDATE STATUS
  // ===========================================================================

  describe("updateStatus", () => {
    test("should update status and record in history", async () => {
      const certRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: new Date().toISOString(),
        last_audit_result: null,
        next_audit_at: "2026-05-01T00:00:00.000Z",
        status_history: JSON.stringify([
          { status: "active", changedAt: new Date().toISOString(), reason: "Initial", score: 85 },
        ]),
        certified_since: new Date().toISOString(),
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([certRow]);

      const result = await engine.updateStatus("cert-123", "warning", "Score degrading");
      expect(result).not.toBeNull();
      expect(result!.status).toBe("warning");
      expect(result!.statusHistory.length).toBe(2);
      expect(result!.statusHistory[1].reason).toBe("Score degrading");
    });

    test("should return null for invalid transition", async () => {
      const certRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "revoked",
        current_score: 85,
        current_grade: "B",
        last_audit_at: new Date().toISOString(),
        last_audit_result: null,
        next_audit_at: "2026-05-01T00:00:00.000Z",
        status_history: "[]",
        certified_since: null,
        suspended_at: null,
        expires_at: null,
        cpoe_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([certRow]);

      const result = await engine.updateStatus("cert-123", "active", "Trying to reactivate");
      expect(result).toBeNull();
    });

    test("should return null when certification not found", async () => {
      const { sql } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const result = await engine.updateStatus("cert-nonexistent", "warning", "Test");
      expect(result).toBeNull();
    });

    test("should set suspendedAt when transitioning to suspended", async () => {
      const certRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: new Date().toISOString(),
        last_audit_result: null,
        next_audit_at: "2026-05-01T00:00:00.000Z",
        status_history: JSON.stringify([
          { status: "active", changedAt: new Date().toISOString(), reason: "Initial", score: 85 },
        ]),
        certified_since: new Date().toISOString(),
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([certRow]);

      const result = await engine.updateStatus("cert-123", "suspended", "Drift detected");
      expect(result!.suspendedAt).toBeDefined();
    });
  });

  // ===========================================================================
  // RENEW CERTIFICATION
  // ===========================================================================

  describe("renewCertification", () => {
    test("should update score and reset nextAuditAt", async () => {
      const certRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: "2026-01-01T00:00:00.000Z",
        last_audit_result: JSON.stringify(makeAuditResult(85)),
        next_audit_at: "2026-04-01T00:00:00.000Z",
        status_history: JSON.stringify([
          { status: "active", changedAt: "2026-01-01T00:00:00.000Z", reason: "Initial", score: 85 },
        ]),
        certified_since: "2026-01-01T00:00:00.000Z",
        suspended_at: null,
        expires_at: "2026-06-01T00:00:00.000Z",
        cpoe_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };
      const policyRow = {
        id: "policy-1",
        name: "SOC 2 Production",
        scope: JSON.stringify(makeScope()),
        minimum_score: 70,
        warning_threshold: 80,
        audit_interval_days: 90,
        freshness_max_days: 7,
        grace_period_days: 14,
        auto_renew: true,
        auto_suspend: true,
        notify_on_change: true,
      };

      // renewCertification call sequence:
      // 1. getCertification -> certRow
      // 2. getPolicy -> policyRow
      // 3. detectDrift -> getCertification -> certRow
      // 4. detectDrift -> getPolicy -> policyRow
      // 5. UPDATE SQL -> []
      let callCount = 0;
      const customSql = (strings: TemplateStringsArray, ...values: unknown[]) => {
        callCount++;
        const joined = strings.join("").toLowerCase();
        if (joined.includes("certification_policies") || joined.includes("from certification_policies")) {
          return Promise.resolve([policyRow]);
        }
        if (joined.includes("from certifications")) {
          return Promise.resolve([certRow]);
        }
        return Promise.resolve([]);
      };
      const engine = new PgCertificationEngine(customSql as any);

      const newAudit = makeAuditResult(92);
      const result = await engine.renewCertification("cert-123", newAudit);
      expect(result).toBeDefined();
      expect(result!.currentScore).toBe(92);
      expect(result!.currentGrade).toBe("A");
    });

    test("should return undefined when certification not found", async () => {
      const { sql } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const result = await engine.renewCertification("cert-nonexistent", makeAuditResult(85));
      expect(result).toBeUndefined();
    });
  });

  // ===========================================================================
  // EXPIRING CERTIFICATIONS
  // ===========================================================================

  describe("getExpiringCertifications", () => {
    test("should query for certifications expiring within N days", async () => {
      const { sql, calls } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const result = await engine.getExpiringCertifications(30);
      expect(result).toHaveLength(0);
      expect(calls.length).toBeGreaterThan(0);
    });

    test("should return certifications from database", async () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const row = {
        id: "cert-expiring",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "active",
        current_score: 85,
        current_grade: "B",
        last_audit_at: now.toISOString(),
        last_audit_result: null,
        next_audit_at: now.toISOString(),
        status_history: "[]",
        certified_since: now.toISOString(),
        suspended_at: null,
        expires_at: expires.toISOString(),
        cpoe_id: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([row]);

      const result = await engine.getExpiringCertifications(30);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("cert-expiring");
    });
  });

  // ===========================================================================
  // SUSPENDED CERTIFICATIONS
  // ===========================================================================

  describe("getSuspendedCertifications", () => {
    test("should query for suspended certifications", async () => {
      const { sql, calls } = createMockSql([]);
      const engine = new PgCertificationEngine(sql);
      const result = await engine.getSuspendedCertifications();
      expect(result).toHaveLength(0);
      expect(calls.length).toBeGreaterThan(0);
    });

    test("should return only suspended certifications", async () => {
      const row = {
        id: "cert-suspended",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "suspended",
        current_score: 50,
        current_grade: "F",
        last_audit_at: new Date().toISOString(),
        last_audit_result: null,
        next_audit_at: new Date().toISOString(),
        status_history: "[]",
        certified_since: null,
        suspended_at: new Date().toISOString(),
        expires_at: null,
        cpoe_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([row]);

      const result = await engine.getSuspendedCertifications();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("suspended");
    });
  });

  // ===========================================================================
  // SQL SAFETY
  // ===========================================================================

  describe("SQL safety", () => {
    test("should never include raw IDs in SQL template strings", async () => {
      const { sql, calls } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      await engine.createCertification("org-drop-tables", makePolicy(), makeAuditResult(85));

      for (const call of calls) {
        const joined = call.strings.join("");
        expect(joined).not.toContain("org-drop-tables");
      }
    });

    test("should pass values as parameterized SQL values", async () => {
      const { sql, calls } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      await engine.createCertification("org-1", makePolicy(), makeAuditResult(85));

      const hasOrgValue = calls.some((c) =>
        c.values.some((v) => v === "org-1"),
      );
      expect(hasOrgValue).toBe(true);
    });
  });

  // ===========================================================================
  // ROW MAPPING
  // ===========================================================================

  describe("row mapping", () => {
    test("should handle null optional fields", async () => {
      const mockRow = {
        id: "cert-123",
        policy_id: "policy-1",
        org_id: "org-1",
        status: "degraded",
        current_score: 50,
        current_grade: "F",
        last_audit_at: new Date().toISOString(),
        last_audit_result: null,
        next_audit_at: new Date().toISOString(),
        status_history: "[]",
        certified_since: null,
        suspended_at: null,
        expires_at: null,
        cpoe_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { sql, setNextResult } = createMockSql();
      const engine = new PgCertificationEngine(sql);
      setNextResult([mockRow]);

      const cert = await engine.getCertification("cert-123");
      expect(cert!.certifiedSince).toBeUndefined();
      expect(cert!.suspendedAt).toBeUndefined();
      expect(cert!.expiresAt).toBeUndefined();
      expect(cert!.cpoeId).toBeUndefined();
    });
  });
});
