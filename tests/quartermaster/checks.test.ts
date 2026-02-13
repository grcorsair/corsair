/**
 * Quartermaster Governance Checks Tests — Deterministic Evidence Analysis
 *
 * TDD: These tests are written FIRST. They must FAIL before implementation.
 * Each check detects a specific governance issue without any LLM involvement.
 */

import { describe, test, expect } from "bun:test";
import type { CanonicalControlEvidence } from "../../src/normalize/types";
import type { GovernanceFinding } from "../../src/quartermaster/types";

// =============================================================================
// HELPERS — Build test controls
// =============================================================================

function makeControl(overrides: Partial<CanonicalControlEvidence> = {}): CanonicalControlEvidence {
  return {
    controlId: overrides.controlId ?? "ctrl-1",
    title: overrides.title ?? "Test Control",
    description: overrides.description ?? "A test control",
    status: overrides.status ?? "pass",
    severity: overrides.severity ?? "medium",
    source: {
      tool: "test-tool",
      version: "1.0",
      rawId: "raw-1",
      rawStatus: "PASS",
      timestamp: new Date().toISOString(),
      ...(overrides.source ?? {}),
    },
    frameworks: overrides.frameworks ?? [],
    evidence: {
      type: "scan",
      summary: "Scan result showing control is effective",
      ...(overrides.evidence ?? {}),
    },
    assurance: {
      level: 1,
      provenance: "tool",
      ...(overrides.assurance ?? {}),
    },
  };
}

// =============================================================================
// IMPORTS
// =============================================================================

import {
  checkEvidenceGaps,
  checkSeverityMismatch,
  checkFrameworkCoverage,
  checkConsistency,
  checkBoilerplate,
  checkRecency,
  runAllChecks,
} from "../../src/quartermaster/checks";

// =============================================================================
// 1. EVIDENCE GAP CHECK
// =============================================================================

describe("Evidence Gap Check", () => {
  test("should return no findings when all passing controls have evidence", () => {
    const controls = [
      makeControl({ status: "pass", evidence: { type: "scan", summary: "Found MFA enabled" } }),
      makeControl({ controlId: "ctrl-2", status: "pass", evidence: { type: "test", summary: "Test passed" } }),
    ];
    const findings = checkEvidenceGaps(controls);
    expect(findings).toHaveLength(0);
  });

  test("should flag passing controls with empty evidence summary", () => {
    const controls = [
      makeControl({ status: "pass", evidence: { type: "scan", summary: "" } }),
    ];
    const findings = checkEvidenceGaps(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].category).toBe("evidence_quality");
    expect(findings[0].controlIds).toContain("ctrl-1");
  });

  test("should flag passing controls with undefined evidence summary", () => {
    const controls = [
      makeControl({ status: "pass", evidence: { type: "scan", summary: undefined as unknown as string } }),
    ];
    const findings = checkEvidenceGaps(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
  });

  test("should not flag failed controls with empty evidence (expected)", () => {
    const controls = [
      makeControl({ status: "fail", evidence: { type: "scan", summary: "" } }),
    ];
    const findings = checkEvidenceGaps(controls);
    expect(findings).toHaveLength(0);
  });

  test("should not flag skipped controls with empty evidence", () => {
    const controls = [
      makeControl({ status: "skip", evidence: { type: "document", summary: "" } }),
    ];
    const findings = checkEvidenceGaps(controls);
    expect(findings).toHaveLength(0);
  });

  test("should collect multiple gap control IDs in a single finding", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", status: "pass", evidence: { type: "scan", summary: "" } }),
      makeControl({ controlId: "ctrl-2", status: "pass", evidence: { type: "scan", summary: "" } }),
      makeControl({ controlId: "ctrl-3", status: "pass", evidence: { type: "scan", summary: "Valid" } }),
    ];
    const findings = checkEvidenceGaps(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].controlIds).toContain("ctrl-1");
    expect(findings[0].controlIds).toContain("ctrl-2");
    expect(findings[0].controlIds).not.toContain("ctrl-3");
  });
});

// =============================================================================
// 2. SEVERITY MISMATCH CHECK
// =============================================================================

describe("Severity Mismatch Check", () => {
  test("should return no findings when critical controls have strong evidence", () => {
    const controls = [
      makeControl({ severity: "critical", evidence: { type: "scan", summary: "Full scan result" } }),
      makeControl({ controlId: "ctrl-2", severity: "high", evidence: { type: "test", summary: "Test result" } }),
    ];
    const findings = checkSeverityMismatch(controls);
    expect(findings).toHaveLength(0);
  });

  test("should flag critical controls that pass with only document evidence", () => {
    const controls = [
      makeControl({ severity: "critical", status: "pass", evidence: { type: "document", summary: "Policy says so" } }),
    ];
    const findings = checkSeverityMismatch(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].category).toBe("methodology");
    expect(findings[0].controlIds).toContain("ctrl-1");
  });

  test("should flag high severity controls with only document evidence", () => {
    const controls = [
      makeControl({ severity: "high", status: "pass", evidence: { type: "document", summary: "We have MFA policy" } }),
    ];
    const findings = checkSeverityMismatch(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
  });

  test("should not flag medium/low/info controls with document evidence", () => {
    const controls = [
      makeControl({ severity: "medium", status: "pass", evidence: { type: "document", summary: "Policy doc" } }),
      makeControl({ controlId: "ctrl-2", severity: "low", status: "pass", evidence: { type: "document", summary: "Policy doc" } }),
      makeControl({ controlId: "ctrl-3", severity: "info", status: "pass", evidence: { type: "document", summary: "Policy doc" } }),
    ];
    const findings = checkSeverityMismatch(controls);
    expect(findings).toHaveLength(0);
  });

  test("should not flag critical controls that fail (not a mismatch)", () => {
    const controls = [
      makeControl({ severity: "critical", status: "fail", evidence: { type: "document", summary: "Failed check" } }),
    ];
    const findings = checkSeverityMismatch(controls);
    expect(findings).toHaveLength(0);
  });

  test("should also flag attestation-only for critical controls", () => {
    const controls = [
      makeControl({ severity: "critical", status: "pass", evidence: { type: "attestation", summary: "Attested" } }),
    ];
    const findings = checkSeverityMismatch(controls);
    expect(findings).toHaveLength(1);
  });
});

// =============================================================================
// 3. FRAMEWORK COVERAGE CHECK
// =============================================================================

describe("Framework Coverage Check", () => {
  test("should return no findings when all controls have framework refs", () => {
    const controls = [
      makeControl({ frameworks: [{ framework: "SOC2", controlId: "CC6.1" }] }),
    ];
    const findings = checkFrameworkCoverage(controls);
    expect(findings).toHaveLength(0);
  });

  test("should flag controls with empty frameworks array", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", frameworks: [] }),
      makeControl({ controlId: "ctrl-2", frameworks: [{ framework: "SOC2", controlId: "CC6.1" }] }),
    ];
    const findings = checkFrameworkCoverage(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("info");
    expect(findings[0].category).toBe("completeness");
    expect(findings[0].controlIds).toContain("ctrl-1");
  });

  test("should return no findings when no controls exist", () => {
    const findings = checkFrameworkCoverage([]);
    expect(findings).toHaveLength(0);
  });

  test("should flag multiple controls without framework refs", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", frameworks: [] }),
      makeControl({ controlId: "ctrl-2", frameworks: [] }),
      makeControl({ controlId: "ctrl-3", frameworks: [] }),
    ];
    const findings = checkFrameworkCoverage(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].controlIds).toHaveLength(3);
  });
});

// =============================================================================
// 4. CONSISTENCY CHECK
// =============================================================================

describe("Consistency Check", () => {
  test("should return no findings when same control agrees across sources", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", status: "pass", source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "ctrl-1", status: "pass", source: { tool: "inspec", rawId: "i1", rawStatus: "passed", timestamp: new Date().toISOString() } }),
    ];
    const findings = checkConsistency(controls);
    expect(findings).toHaveLength(0);
  });

  test("should flag controls with conflicting statuses across sources", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", status: "pass", source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "ctrl-1", status: "fail", source: { tool: "inspec", rawId: "i1", rawStatus: "failed", timestamp: new Date().toISOString() } }),
    ];
    const findings = checkConsistency(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].category).toBe("consistency");
    expect(findings[0].controlIds).toContain("ctrl-1");
  });

  test("should not flag single-source controls (no inconsistency possible)", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", status: "pass", source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "ctrl-1", status: "fail", source: { tool: "prowler", rawId: "p2", rawStatus: "FAIL", timestamp: new Date().toISOString() } }),
    ];
    // Same tool = same source, not cross-source inconsistency
    const findings = checkConsistency(controls);
    expect(findings).toHaveLength(0);
  });

  test("should flag multiple inconsistent controls separately", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", status: "pass", source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "ctrl-1", status: "fail", source: { tool: "inspec", rawId: "i1", rawStatus: "failed", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "ctrl-2", status: "pass", source: { tool: "prowler", rawId: "p2", rawStatus: "PASS", timestamp: new Date().toISOString() } }),
      makeControl({ controlId: "ctrl-2", status: "fail", source: { tool: "trivy", rawId: "t1", rawStatus: "FAIL", timestamp: new Date().toISOString() } }),
    ];
    const findings = checkConsistency(controls);
    expect(findings).toHaveLength(2);
  });
});

// =============================================================================
// 5. BOILERPLATE DETECTION CHECK
// =============================================================================

describe("Boilerplate Detection Check", () => {
  test("should return no findings when all evidence summaries are unique", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", evidence: { type: "scan", summary: "MFA is enabled on all accounts" } }),
      makeControl({ controlId: "ctrl-2", evidence: { type: "scan", summary: "S3 bucket encryption verified" } }),
      makeControl({ controlId: "ctrl-3", evidence: { type: "test", summary: "Penetration test found no vulnerabilities" } }),
    ];
    const findings = checkBoilerplate(controls);
    expect(findings).toHaveLength(0);
  });

  test("should flag when 3+ controls share identical evidence summary", () => {
    const boilerplate = "Control is effective based on review";
    const controls = [
      makeControl({ controlId: "ctrl-1", evidence: { type: "scan", summary: boilerplate } }),
      makeControl({ controlId: "ctrl-2", evidence: { type: "scan", summary: boilerplate } }),
      makeControl({ controlId: "ctrl-3", evidence: { type: "scan", summary: boilerplate } }),
    ];
    const findings = checkBoilerplate(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].category).toBe("bias");
    expect(findings[0].controlIds).toHaveLength(3);
  });

  test("should not flag when only 2 controls share a summary", () => {
    const summary = "Control is effective";
    const controls = [
      makeControl({ controlId: "ctrl-1", evidence: { type: "scan", summary } }),
      makeControl({ controlId: "ctrl-2", evidence: { type: "scan", summary } }),
      makeControl({ controlId: "ctrl-3", evidence: { type: "test", summary: "Different" } }),
    ];
    const findings = checkBoilerplate(controls);
    expect(findings).toHaveLength(0);
  });

  test("should detect multiple boilerplate groups", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", evidence: { type: "scan", summary: "Template A" } }),
      makeControl({ controlId: "ctrl-2", evidence: { type: "scan", summary: "Template A" } }),
      makeControl({ controlId: "ctrl-3", evidence: { type: "scan", summary: "Template A" } }),
      makeControl({ controlId: "ctrl-4", evidence: { type: "test", summary: "Template B" } }),
      makeControl({ controlId: "ctrl-5", evidence: { type: "test", summary: "Template B" } }),
      makeControl({ controlId: "ctrl-6", evidence: { type: "test", summary: "Template B" } }),
    ];
    const findings = checkBoilerplate(controls);
    expect(findings).toHaveLength(2);
  });

  test("should ignore empty summaries (handled by evidence gap check)", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", evidence: { type: "scan", summary: "" } }),
      makeControl({ controlId: "ctrl-2", evidence: { type: "scan", summary: "" } }),
      makeControl({ controlId: "ctrl-3", evidence: { type: "scan", summary: "" } }),
    ];
    const findings = checkBoilerplate(controls);
    expect(findings).toHaveLength(0);
  });
});

// =============================================================================
// 6. RECENCY CHECK
// =============================================================================

describe("Recency Check", () => {
  test("should return no findings when all evidence is recent", () => {
    const recentDate = new Date().toISOString();
    const controls = [
      makeControl({ source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: recentDate } }),
    ];
    const findings = checkRecency(controls);
    expect(findings).toHaveLength(0);
  });

  test("should flag controls with evidence older than threshold (default 180 days)", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const controls = [
      makeControl({ controlId: "ctrl-1", source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: oldDate } }),
    ];
    const findings = checkRecency(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].category).toBe("methodology");
    expect(findings[0].controlIds).toContain("ctrl-1");
  });

  test("should respect custom threshold in days", () => {
    const date90daysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const controls = [
      makeControl({ source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: date90daysAgo } }),
    ];
    // Default 180 days - should not flag
    const findingsDefault = checkRecency(controls);
    expect(findingsDefault).toHaveLength(0);

    // Custom 90 days - should flag
    const findingsCustom = checkRecency(controls, 90);
    expect(findingsCustom).toHaveLength(1);
  });

  test("should flag controls with invalid timestamps", () => {
    const controls = [
      makeControl({ controlId: "ctrl-1", source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: "not-a-date" } }),
    ];
    const findings = checkRecency(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warning");
  });

  test("should collect multiple stale control IDs", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();
    const controls = [
      makeControl({ controlId: "ctrl-1", source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: oldDate } }),
      makeControl({ controlId: "ctrl-2", source: { tool: "prowler", rawId: "p2", rawStatus: "PASS", timestamp: oldDate } }),
      makeControl({ controlId: "ctrl-3", source: { tool: "prowler", rawId: "p3", rawStatus: "PASS", timestamp: recentDate } }),
    ];
    const findings = checkRecency(controls);
    expect(findings).toHaveLength(1);
    expect(findings[0].controlIds).toHaveLength(2);
  });
});

// =============================================================================
// 7. RUN ALL CHECKS
// =============================================================================

describe("runAllChecks", () => {
  test("should run all checks and return combined findings", () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const controls = [
      // Evidence gap: pass with empty evidence
      makeControl({ controlId: "ctrl-1", status: "pass", evidence: { type: "scan", summary: "" }, source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: oldDate } }),
      // Severity mismatch: critical with document-only
      makeControl({ controlId: "ctrl-2", severity: "critical", status: "pass", evidence: { type: "document", summary: "Policy says yes" }, source: { tool: "inspec", rawId: "i1", rawStatus: "passed", timestamp: new Date().toISOString() } }),
    ];
    const findings = runAllChecks(controls);
    // Should have at least 2 findings: evidence gap + severity mismatch + recency
    expect(findings.length).toBeGreaterThanOrEqual(2);
    // Each finding should have required fields
    for (const f of findings) {
      expect(f.id).toBeTruthy();
      expect(f.severity).toBeTruthy();
      expect(f.category).toBeTruthy();
      expect(f.description).toBeTruthy();
      expect(f.remediation).toBeTruthy();
    }
  });

  test("should return empty array for clean evidence", () => {
    const controls = [
      makeControl({
        controlId: "ctrl-1",
        status: "pass",
        severity: "medium",
        evidence: { type: "scan", summary: "MFA enabled" },
        frameworks: [{ framework: "SOC2", controlId: "CC6.1" }],
      }),
    ];
    const findings = runAllChecks(controls);
    expect(findings).toHaveLength(0);
  });

  test("should return empty array for empty controls", () => {
    const findings = runAllChecks([]);
    expect(findings).toHaveLength(0);
  });
});
