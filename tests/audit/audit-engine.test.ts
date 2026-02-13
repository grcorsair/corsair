/**
 * Audit Engine Tests — Full Compliance Audit Orchestration
 *
 * TDD: These tests are written FIRST. They must FAIL before implementation.
 * Then implementation makes them green.
 *
 * Covers:
 *   - runAudit() orchestration (single/multi-file, format override, config options)
 *   - generateFindings() finding generation by category
 *   - formatAuditSummary() human-readable output
 *   - Edge cases (empty input, excluded controls, dedup, sorting)
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { runAudit, generateFindings, formatAuditSummary } from "../../src/audit/audit-engine";
import type { AuditScope, AuditResult, AuditConfig, AuditFinding } from "../../src/audit/types";
import type { NormalizedEvidence, CanonicalControlEvidence } from "../../src/normalize/types";

// =============================================================================
// TEST EVIDENCE DATA — Minimal inline JSON for generic format
// =============================================================================

const PASSING_EVIDENCE = {
  metadata: {
    title: "Test Scan - Passing",
    issuer: "TestTool v1",
    date: new Date().toISOString().split("T")[0],
    scope: "Test Environment",
  },
  controls: [
    { id: "AC-1", description: "Access Control Policy", status: "effective", severity: "high", evidence: "MFA enforced on all accounts" },
    { id: "AC-2", description: "Account Management", status: "effective", severity: "medium", evidence: "Automated provisioning via SCIM" },
    { id: "SC-7", description: "Boundary Protection", status: "effective", severity: "critical", evidence: "WAF and firewall rules in place" },
    { id: "AU-2", description: "Audit Events", status: "effective", severity: "medium", evidence: "CloudTrail enabled in all regions" },
  ],
};

const MIXED_EVIDENCE = {
  metadata: {
    title: "Test Scan - Mixed",
    issuer: "TestTool v1",
    date: new Date().toISOString().split("T")[0],
    scope: "Test Environment",
  },
  controls: [
    { id: "AC-1", description: "Access Control Policy", status: "effective", severity: "high", evidence: "MFA enforced" },
    { id: "AC-3", description: "Access Enforcement", status: "ineffective", severity: "critical", evidence: "Missing role-based access" },
    { id: "AU-3", description: "Content of Audit Records", status: "ineffective", severity: "high", evidence: "Incomplete log fields" },
    { id: "SC-28", description: "Encryption at Rest", status: "ineffective", severity: "critical", evidence: "S3 buckets unencrypted" },
    { id: "CM-6", description: "Configuration Settings", status: "not-tested", severity: "medium" },
    { id: "IR-4", description: "Incident Handling", status: "not-tested", severity: "high" },
  ],
};

const FAILING_EVIDENCE = {
  metadata: {
    title: "Test Scan - Failing",
    issuer: "TestTool v1",
    date: new Date().toISOString().split("T")[0],
    scope: "Test Environment",
  },
  controls: [
    { id: "IA-2", description: "Identification and Auth", status: "ineffective", severity: "critical", evidence: "No MFA configured" },
    { id: "IA-5", description: "Authenticator Management", status: "ineffective", severity: "high", evidence: "Weak password policy" },
  ],
};

const WEAKNESS_EVIDENCE = {
  metadata: {
    title: "Self-Assessment",
    issuer: "Manual",
    date: new Date().toISOString().split("T")[0],
    scope: "Test Environment",
  },
  controls: [
    { id: "PL-1", description: "Security Planning Policy", status: "effective", severity: "low", evidence: "Policy document exists" },
    { id: "PL-2", description: "System Security Plan", status: "effective", severity: "low" },
  ],
};

// =============================================================================
// TEMP FILE HELPERS
// =============================================================================

const tmpDir = `/tmp/corsair-audit-test-${Date.now()}`;

beforeAll(async () => {
  await Bun.write(`${tmpDir}/passing.json`, JSON.stringify(PASSING_EVIDENCE));
  await Bun.write(`${tmpDir}/mixed.json`, JSON.stringify(MIXED_EVIDENCE));
  await Bun.write(`${tmpDir}/failing.json`, JSON.stringify(FAILING_EVIDENCE));
  await Bun.write(`${tmpDir}/weakness.json`, JSON.stringify(WEAKNESS_EVIDENCE));

  // Prowler-format evidence for format override test
  const prowlerEvidence = [
    {
      StatusCode: "PASS",
      Severity: "High",
      FindingInfo: { Uid: "prowler-check-1", Title: "S3 bucket encryption enabled" },
      Remediation: { Recommendation: "Already encrypted" },
    },
    {
      StatusCode: "FAIL",
      Severity: "Critical",
      FindingInfo: { Uid: "prowler-check-2", Title: "MFA not enabled on root" },
      Remediation: { Recommendation: "Enable MFA on root account" },
    },
  ];
  await Bun.write(`${tmpDir}/prowler.json`, JSON.stringify(prowlerEvidence));
});

afterAll(async () => {
  // Clean up temp files
  const { rm } = await import("fs/promises");
  await rm(tmpDir, { recursive: true, force: true });
});

// =============================================================================
// HELPER — Build scope
// =============================================================================

function makeScope(overrides: Partial<AuditScope> = {}): AuditScope {
  return {
    name: overrides.name ?? "Test Audit",
    frameworks: overrides.frameworks ?? ["SOC2"],
    evidencePaths: overrides.evidencePaths ?? [`${tmpDir}/passing.json`],
    formats: overrides.formats,
    excludeControls: overrides.excludeControls,
  };
}

function makeConfig(overrides: Partial<AuditConfig> = {}): AuditConfig {
  return {
    includeGovernance: overrides.includeGovernance ?? false,
    includeScore: overrides.includeScore ?? true,
    generateFindings: overrides.generateFindings ?? true,
    signResult: overrides.signResult ?? false,
    outputFormat: overrides.outputFormat ?? "json",
  };
}

// =============================================================================
// 1. runAudit() — ORCHESTRATION
// =============================================================================

describe("runAudit", () => {
  test("should run audit with single evidence file", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const result = await runAudit(scope);

    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
    expect(result.scope).toEqual(scope);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.summary.totalControls).toBe(4);
    expect(result.summary.passed).toBe(4);
    expect(result.summary.failed).toBe(0);
  });

  test("should run audit with multiple evidence files", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/passing.json`, `${tmpDir}/failing.json`],
    });
    const result = await runAudit(scope);

    expect(result.evidence.length).toBe(2);
    expect(result.summary.totalControls).toBe(6); // 4 passing + 2 failing
    expect(result.summary.passed).toBe(4);
    expect(result.summary.failed).toBe(2);
  });

  test("should run audit with format override", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/prowler.json`],
      formats: ["prowler"],
    });
    const result = await runAudit(scope);

    expect(result.evidence.length).toBe(1);
    expect(result.summary.totalControls).toBe(2);
    // Prowler PASS maps to effective -> pass, FAIL maps to ineffective -> fail
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
  });

  test("should handle empty evidence paths gracefully", async () => {
    const scope = makeScope({ evidencePaths: [] });
    const result = await runAudit(scope);

    expect(result.evidence).toEqual([]);
    expect(result.summary.totalControls).toBe(0);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.skipped).toBe(0);
    expect(result.findings).toEqual([]);
  });

  test("should track duration (completedAt > startedAt)", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const result = await runAudit(scope);

    const started = new Date(result.startedAt).getTime();
    const completed = new Date(result.completedAt).getTime();

    expect(completed).toBeGreaterThanOrEqual(started);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.duration).toBe(completed - started);
  });

  test("should generate unique ID per audit run", async () => {
    const scope = makeScope();
    const result1 = await runAudit(scope);
    const result2 = await runAudit(scope);

    expect(result1.id).toBeTruthy();
    expect(result2.id).toBeTruthy();
    expect(result1.id).not.toBe(result2.id);
  });

  test("should use default config when none provided", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const result = await runAudit(scope);

    // Default config: includeScore=true, generateFindings=true, includeGovernance=false
    expect(result.score).toBeDefined();
    expect(result.score.composite).toBeGreaterThanOrEqual(0);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.governance).toBeUndefined();
  });

  test("should exclude controls when excludeControls is set", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/passing.json`],
      excludeControls: ["AC-1", "SC-7"],
    });
    const result = await runAudit(scope);

    // 4 controls - 2 excluded = 2 remaining
    expect(result.summary.totalControls).toBe(2);
    expect(result.summary.passed).toBe(2);

    // Verify excluded controls are not in findings
    const controlIdsInFindings = result.findings.map(f => f.controlId);
    expect(controlIdsInFindings).not.toContain("AC-1");
    expect(controlIdsInFindings).not.toContain("SC-7");
  });

  test("should include score when config.includeScore=true", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const config = makeConfig({ includeScore: true });
    const result = await runAudit(scope, config);

    expect(result.score).toBeDefined();
    expect(result.score.composite).toBeGreaterThan(0);
    expect(result.score.grade).toBeTruthy();
    expect(result.score.dimensions.length).toBe(7);
    expect(result.score.controlsScored).toBe(4);
  });

  test("should return zero score when config.includeScore=false", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const config = makeConfig({ includeScore: false });
    const result = await runAudit(scope, config);

    expect(result.score.composite).toBe(0);
    expect(result.score.controlsScored).toBe(0);
  });

  test("should include governance when config.includeGovernance=true", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const config = makeConfig({ includeGovernance: true });
    const result = await runAudit(scope, config);

    expect(result.governance).toBeDefined();
    expect(result.governance!.score).toBeDefined();
    expect(result.governance!.findings).toBeDefined();
    expect(result.governance!.model).toBe("deterministic");
    expect(result.governance!.reviewedAt).toBeTruthy();
  });

  test("should compute summary score as pass percentage", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const result = await runAudit(scope);

    // MIXED: 1 pass, 3 fail, 2 skip → total=6, passed=1
    const expectedScore = Math.round((1 / 6) * 100);
    expect(result.summary.score).toBe(expectedScore);
  });

  test("should compute summary grade correctly", async () => {
    // All passing → high score → A
    const passingScope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const passingResult = await runAudit(passingScope);
    expect(passingResult.summary.grade).toBe("A");

    // All failing → 0% → F
    const failingScope = makeScope({ evidencePaths: [`${tmpDir}/failing.json`] });
    const failingResult = await runAudit(failingScope);
    expect(failingResult.summary.grade).toBe("F");
  });

  test("should count critical and high findings in summary", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const result = await runAudit(scope);

    // Count findings manually for verification
    const criticalCount = result.findings.filter(f => f.severity === "critical").length;
    const highCount = result.findings.filter(f => f.severity === "high").length;

    expect(result.summary.criticalFindings).toBe(criticalCount);
    expect(result.summary.highFindings).toBe(highCount);
  });

  test("should handle nonexistent file gracefully", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/nonexistent.json`] });

    // Should not crash — graceful degradation
    await expect(runAudit(scope)).rejects.toThrow();
  });

  test("should preserve scope in result", async () => {
    const scope = makeScope({
      name: "Production Audit",
      frameworks: ["SOC2", "NIST-800-53"],
    });
    const result = await runAudit(scope);

    expect(result.scope.name).toBe("Production Audit");
    expect(result.scope.frameworks).toEqual(["SOC2", "NIST-800-53"]);
  });
});

// =============================================================================
// 2. generateFindings() — FINDING GENERATION
// =============================================================================

describe("generateFindings", () => {
  // Helper to build NormalizedEvidence with specific controls
  function makeNormalized(controls: Partial<CanonicalControlEvidence>[]): NormalizedEvidence[] {
    const fullControls: CanonicalControlEvidence[] = controls.map((c, i) => ({
      controlId: c.controlId ?? `ctrl-${i + 1}`,
      title: c.title ?? `Control ${i + 1}`,
      description: c.description ?? `Description ${i + 1}`,
      status: c.status ?? "pass",
      severity: c.severity ?? "medium",
      source: {
        tool: "test-tool",
        rawId: `raw-${i + 1}`,
        rawStatus: c.status === "pass" ? "PASS" : "FAIL",
        timestamp: new Date().toISOString(),
        ...(c.source ?? {}),
      },
      frameworks: c.frameworks ?? [],
      evidence: {
        type: "scan",
        summary: "Test evidence",
        ...(c.evidence ?? {}),
      },
      assurance: {
        level: 1,
        provenance: "tool",
        ...(c.assurance ?? {}),
      },
    }));

    return [{
      controls: fullControls,
      metadata: {
        sourceFormat: "generic",
        title: "Test",
        issuer: "Test",
        date: new Date().toISOString().split("T")[0],
        scope: "Test",
        toolAssuranceLevel: 1,
        stats: {
          total: fullControls.length,
          passed: fullControls.filter(c => c.status === "pass").length,
          failed: fullControls.filter(c => c.status === "fail").length,
          skipped: fullControls.filter(c => c.status === "skip").length,
          errors: 0,
        },
      },
    }];
  }

  test("should generate failure findings for failed controls", () => {
    const evidence = makeNormalized([
      { controlId: "AC-3", status: "fail", severity: "critical" },
      { controlId: "SC-28", status: "fail", severity: "high" },
    ]);

    const findings = generateFindings(evidence);
    const failures = findings.filter(f => f.category === "failure");

    expect(failures.length).toBe(2);
    expect(failures[0].controlId).toBe("AC-3");
    expect(failures[1].controlId).toBe("SC-28");
  });

  test("should generate gap findings for controls with no evidence", () => {
    const evidence = makeNormalized([
      {
        controlId: "CM-6",
        status: "skip",
        evidence: { type: "document", summary: "" } as CanonicalControlEvidence["evidence"],
      },
    ]);

    const findings = generateFindings(evidence);
    const gaps = findings.filter(f => f.category === "gap");

    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some(g => g.controlId === "CM-6")).toBe(true);
  });

  test("should generate weakness findings for L0-only controls", () => {
    const evidence = makeNormalized([
      {
        controlId: "PL-1",
        status: "pass",
        severity: "low",
        assurance: { level: 0, provenance: "self" },
        evidence: { type: "document", summary: "Policy doc" } as CanonicalControlEvidence["evidence"],
      },
    ]);

    const findings = generateFindings(evidence);
    const weaknesses = findings.filter(f => f.category === "weakness");

    expect(weaknesses.length).toBeGreaterThan(0);
    expect(weaknesses.some(w => w.controlId === "PL-1")).toBe(true);
  });

  test("should generate strength findings for passed critical controls", () => {
    const evidence = makeNormalized([
      { controlId: "SC-7", status: "pass", severity: "critical" },
    ]);

    const findings = generateFindings(evidence);
    const strengths = findings.filter(f => f.category === "strength");

    expect(strengths.length).toBe(1);
    expect(strengths[0].controlId).toBe("SC-7");
    expect(strengths[0].severity).toBe("info");
  });

  test("should map finding severity from control severity for failures", () => {
    const evidence = makeNormalized([
      { controlId: "critical-ctrl", status: "fail", severity: "critical" },
      { controlId: "high-ctrl", status: "fail", severity: "high" },
      { controlId: "medium-ctrl", status: "fail", severity: "medium" },
      { controlId: "low-ctrl", status: "fail", severity: "low" },
      { controlId: "info-ctrl", status: "fail", severity: "info" },
    ]);

    const findings = generateFindings(evidence);
    const failures = findings.filter(f => f.category === "failure");

    const criticalFinding = failures.find(f => f.controlId === "critical-ctrl");
    const highFinding = failures.find(f => f.controlId === "high-ctrl");
    const mediumFinding = failures.find(f => f.controlId === "medium-ctrl");
    const lowFinding = failures.find(f => f.controlId === "low-ctrl");
    const infoFinding = failures.find(f => f.controlId === "info-ctrl");

    expect(criticalFinding?.severity).toBe("critical");
    expect(highFinding?.severity).toBe("high");
    expect(mediumFinding?.severity).toBe("medium");
    expect(lowFinding?.severity).toBe("low");
    expect(infoFinding?.severity).toBe("info");
  });

  test("should sort findings by severity (critical first)", () => {
    const evidence = makeNormalized([
      { controlId: "low-ctrl", status: "fail", severity: "low" },
      { controlId: "critical-ctrl", status: "fail", severity: "critical" },
      { controlId: "medium-ctrl", status: "fail", severity: "medium" },
      { controlId: "high-ctrl", status: "fail", severity: "high" },
    ]);

    const findings = generateFindings(evidence);

    const severityOrder = ["critical", "high", "medium", "low", "info"];
    for (let i = 1; i < findings.length; i++) {
      const prevIdx = severityOrder.indexOf(findings[i - 1].severity);
      const currIdx = severityOrder.indexOf(findings[i].severity);
      expect(prevIdx).toBeLessThanOrEqual(currIdx);
    }
  });

  test("should return empty findings for empty evidence", () => {
    const findings = generateFindings([]);
    expect(findings).toEqual([]);
  });

  test("should generate unique finding IDs", () => {
    const evidence = makeNormalized([
      { controlId: "AC-1", status: "fail", severity: "critical" },
      { controlId: "AC-2", status: "fail", severity: "high" },
      { controlId: "AC-3", status: "fail", severity: "medium" },
    ]);

    const findings = generateFindings(evidence);
    const ids = findings.map(f => f.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  test("should include evidence source and status in finding", () => {
    const evidence = makeNormalized([
      {
        controlId: "AC-3",
        status: "fail",
        severity: "critical",
        source: {
          tool: "prowler",
          rawId: "prowler-check-1",
          rawStatus: "FAIL",
          timestamp: new Date().toISOString(),
        },
      },
    ]);

    const findings = generateFindings(evidence);
    const failure = findings.find(f => f.category === "failure");

    expect(failure).toBeDefined();
    expect(failure!.evidence.source).toBe("prowler");
    expect(failure!.evidence.controlStatus).toBe("fail");
  });

  test("should handle mixed evidence from multiple normalized documents", () => {
    const ev1 = [{
      controls: [{
        controlId: "AC-1",
        title: "Access Control",
        description: "Access control policy",
        status: "pass" as const,
        severity: "high" as const,
        source: { tool: "prowler", rawId: "p-1", rawStatus: "PASS", timestamp: new Date().toISOString() },
        frameworks: [],
        evidence: { type: "scan" as const, summary: "MFA enabled" },
        assurance: { level: 1 as const, provenance: "tool" as const },
      }],
      metadata: {
        sourceFormat: "prowler",
        title: "Prowler Scan",
        issuer: "Prowler",
        date: new Date().toISOString().split("T")[0],
        scope: "AWS",
        toolAssuranceLevel: 1 as const,
        stats: { total: 1, passed: 1, failed: 0, skipped: 0, errors: 0 },
      },
    }] as NormalizedEvidence[];

    const ev2 = [{
      controls: [{
        controlId: "IA-2",
        title: "Auth",
        description: "Auth policy",
        status: "fail" as const,
        severity: "critical" as const,
        source: { tool: "inspec", rawId: "i-1", rawStatus: "FAIL", timestamp: new Date().toISOString() },
        frameworks: [],
        evidence: { type: "scan" as const, summary: "No MFA" },
        assurance: { level: 1 as const, provenance: "tool" as const },
      }],
      metadata: {
        sourceFormat: "inspec",
        title: "InSpec Scan",
        issuer: "InSpec",
        date: new Date().toISOString().split("T")[0],
        scope: "Linux",
        toolAssuranceLevel: 1 as const,
        stats: { total: 1, passed: 0, failed: 1, skipped: 0, errors: 0 },
      },
    }] as NormalizedEvidence[];

    const combined = [...ev1, ...ev2];
    const findings = generateFindings(combined);

    // Should have at least one strength (AC-1 pass+high) and one failure (IA-2 fail+critical)
    const strengths = findings.filter(f => f.category === "strength");
    const failures = findings.filter(f => f.category === "failure");

    // AC-1 is high, not critical — strength only for critical controls
    expect(failures.length).toBe(1);
    expect(failures[0].controlId).toBe("IA-2");
  });

  test("should not generate duplicate findings for the same control", () => {
    const evidence = makeNormalized([
      { controlId: "AC-1", status: "fail", severity: "high" },
    ]);

    const findings = generateFindings(evidence);
    const ac1Failures = findings.filter(f => f.controlId === "AC-1" && f.category === "failure");

    expect(ac1Failures.length).toBe(1);
  });
});

// =============================================================================
// 3. formatAuditSummary() — HUMAN-READABLE OUTPUT
// =============================================================================

describe("formatAuditSummary", () => {
  test("should format a well-structured summary", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });

  test("should include audit scope in summary", async () => {
    const scope = makeScope({
      name: "AWS Production",
      frameworks: ["SOC2", "NIST-800-53"],
      evidencePaths: [`${tmpDir}/passing.json`],
    });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    expect(summary).toContain("AWS Production");
    expect(summary).toContain("SOC2");
    expect(summary).toContain("NIST-800-53");
  });

  test("should include score and grade in summary", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    expect(summary).toContain(String(result.summary.score));
    expect(summary).toContain(result.summary.grade);
  });

  test("should include control counts in summary", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    expect(summary).toContain(`${result.summary.totalControls}`);
    expect(summary).toContain(`${result.summary.passed} passed`);
    expect(summary).toContain(`${result.summary.failed} failed`);
  });

  test("should list critical findings in summary", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    const criticalFindings = result.findings.filter(f => f.severity === "critical");
    if (criticalFindings.length > 0) {
      expect(summary).toContain("CRITICAL");
    }
  });

  test("should include duration in summary", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    // Duration should be present in some form (seconds)
    expect(summary).toMatch(/\d+(\.\d+)?s/);
  });

  test("should handle empty audit result gracefully", async () => {
    const scope = makeScope({ evidencePaths: [] });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    expect(typeof summary).toBe("string");
    expect(summary).toContain("0");
  });

  test("should include CORSAIR AUDIT REPORT header", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const result = await runAudit(scope);
    const summary = formatAuditSummary(result);

    expect(summary).toContain("CORSAIR AUDIT REPORT");
  });
});

// =============================================================================
// 4. INTEGRATION — Full pipeline tests
// =============================================================================

describe("Integration", () => {
  test("should run full audit pipeline with scoring and findings", async () => {
    const scope = makeScope({
      name: "Full Pipeline Test",
      frameworks: ["SOC2"],
      evidencePaths: [`${tmpDir}/mixed.json`],
    });
    const config = makeConfig({ includeScore: true, generateFindings: true });
    const result = await runAudit(scope, config);

    // All pieces should be populated
    expect(result.id).toBeTruthy();
    expect(result.scope.name).toBe("Full Pipeline Test");
    expect(result.evidence.length).toBe(1);
    expect(result.score.composite).toBeGreaterThanOrEqual(0);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.summary.totalControls).toBe(6);
    expect(result.completedAt).toBeTruthy();
  });

  test("should run full audit with governance", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/mixed.json`],
    });
    const config = makeConfig({ includeGovernance: true, includeScore: true });
    const result = await runAudit(scope, config);

    expect(result.governance).toBeDefined();
    expect(result.governance!.score.composite).toBeGreaterThanOrEqual(0);
    expect(result.governance!.findings).toBeDefined();
    expect(result.score).toBeDefined();
  });

  test("should aggregate controls from multiple files correctly", async () => {
    const scope = makeScope({
      evidencePaths: [
        `${tmpDir}/passing.json`,
        `${tmpDir}/mixed.json`,
        `${tmpDir}/failing.json`,
      ],
    });
    const result = await runAudit(scope);

    // 4 + 6 + 2 = 12 total controls
    expect(result.summary.totalControls).toBe(12);
    expect(result.evidence.length).toBe(3);
  });

  test("should exclude controls across all evidence files", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/passing.json`, `${tmpDir}/mixed.json`],
      excludeControls: ["AC-1", "AC-3"],
    });
    const result = await runAudit(scope);

    // Passing has AC-1 (excluded), Mixed has AC-1 (excluded) + AC-3 (excluded)
    // Passing: AC-2, SC-7, AU-2 = 3 controls
    // Mixed: AU-3, SC-28, CM-6, IR-4 = 4 controls
    // Total = 7
    expect(result.summary.totalControls).toBe(7);

    // Verify excluded controls not in any evidence
    for (const ev of result.evidence) {
      const controlIds = ev.controls.map(c => c.controlId);
      expect(controlIds).not.toContain("AC-1");
      expect(controlIds).not.toContain("AC-3");
    }
  });

  test("should produce findings sorted by severity across all sources", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/mixed.json`, `${tmpDir}/failing.json`],
    });
    const result = await runAudit(scope);

    const severityOrder = ["critical", "high", "medium", "low", "info"];
    for (let i = 1; i < result.findings.length; i++) {
      const prevIdx = severityOrder.indexOf(result.findings[i - 1].severity);
      const currIdx = severityOrder.indexOf(result.findings[i].severity);
      expect(prevIdx).toBeLessThanOrEqual(currIdx);
    }
  });

  test("should set summary grade to F when all controls fail", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/failing.json`] });
    const result = await runAudit(scope);

    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(2);
    expect(result.summary.score).toBe(0);
    expect(result.summary.grade).toBe("F");
  });

  test("should set summary grade to A when all controls pass", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/passing.json`] });
    const result = await runAudit(scope);

    expect(result.summary.passed).toBe(4);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.score).toBe(100);
    expect(result.summary.grade).toBe("A");
  });

  test("should apply format override only to the matching index", async () => {
    // First file is prowler format, second is generic format
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/prowler.json`, `${tmpDir}/passing.json`],
      formats: ["prowler", undefined as unknown as string],
    });
    const result = await runAudit(scope);

    // Prowler: 2 controls, Passing: 4 controls = 6 total
    expect(result.summary.totalControls).toBe(6);
    expect(result.evidence.length).toBe(2);
  });

  test("should not generate findings when config.generateFindings=false", async () => {
    const scope = makeScope({ evidencePaths: [`${tmpDir}/mixed.json`] });
    const config = makeConfig({ generateFindings: false });
    const result = await runAudit(scope, config);

    expect(result.findings).toEqual([]);
    expect(result.summary.criticalFindings).toBe(0);
    expect(result.summary.highFindings).toBe(0);
  });
});

// =============================================================================
// 5. EDGE CASES
// =============================================================================

describe("Edge Cases", () => {
  test("should handle evidence file with no controls", async () => {
    const emptyEvidence = { metadata: { title: "Empty" }, controls: [] };
    await Bun.write(`${tmpDir}/empty.json`, JSON.stringify(emptyEvidence));

    const scope = makeScope({ evidencePaths: [`${tmpDir}/empty.json`] });
    const result = await runAudit(scope);

    expect(result.summary.totalControls).toBe(0);
    expect(result.findings).toEqual([]);
  });

  test("should handle audit scope with empty frameworks", async () => {
    const scope = makeScope({
      frameworks: [],
      evidencePaths: [`${tmpDir}/passing.json`],
    });
    const result = await runAudit(scope);

    expect(result.scope.frameworks).toEqual([]);
    expect(result.summary.totalControls).toBe(4);
  });

  test("should handle very large control sets without crashing", async () => {
    const largeEvidence = {
      metadata: { title: "Large Set" },
      controls: Array.from({ length: 500 }, (_, i) => ({
        id: `ctrl-${i}`,
        description: `Control ${i}`,
        status: i % 3 === 0 ? "ineffective" : "effective",
        severity: i % 5 === 0 ? "critical" : "medium",
        evidence: `Evidence for control ${i}`,
      })),
    };
    await Bun.write(`${tmpDir}/large.json`, JSON.stringify(largeEvidence));

    const scope = makeScope({ evidencePaths: [`${tmpDir}/large.json`] });
    const result = await runAudit(scope);

    expect(result.summary.totalControls).toBe(500);
    expect(result.duration).toBeLessThan(10000); // Should complete in <10s
  });

  test("should exclude all controls when all are in excludeControls", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/failing.json`],
      excludeControls: ["IA-2", "IA-5"],
    });
    const result = await runAudit(scope);

    expect(result.summary.totalControls).toBe(0);
    expect(result.findings).toEqual([]);
  });

  test("should handle excludeControls that don't match any control", async () => {
    const scope = makeScope({
      evidencePaths: [`${tmpDir}/passing.json`],
      excludeControls: ["NONEXISTENT-1", "NONEXISTENT-2"],
    });
    const result = await runAudit(scope);

    // All 4 controls should remain (none matched exclusion)
    expect(result.summary.totalControls).toBe(4);
  });
});
