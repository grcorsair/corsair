import { describe, test, expect } from "bun:test";
import {
  queryEvidence,
  findFailingCritical,
  findByFramework,
  summarizeByFramework,
  findRegressions,
} from "../../src/query";
import type { CanonicalControlEvidence } from "../../src/normalize/types";
import type { EvidenceQuery, QueryResult } from "../../src/query/types";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function makeControl(overrides: Partial<CanonicalControlEvidence> & { controlId: string }): CanonicalControlEvidence {
  return {
    controlId: overrides.controlId,
    title: overrides.title ?? `Control ${overrides.controlId}`,
    description: overrides.description ?? `Description for ${overrides.controlId}`,
    status: overrides.status ?? "pass",
    severity: overrides.severity ?? "medium",
    source: overrides.source ?? {
      tool: "test-tool",
      version: "1.0",
      rawId: overrides.controlId,
      rawStatus: "PASS",
      timestamp: "2026-02-13T00:00:00Z",
    },
    frameworks: overrides.frameworks ?? [],
    evidence: overrides.evidence ?? {
      type: "scan",
      summary: "Test evidence",
    },
    assurance: overrides.assurance ?? {
      level: 1,
      provenance: "tool",
    },
  };
}

const fixtures: CanonicalControlEvidence[] = [
  makeControl({
    controlId: "AC-1",
    title: "Access Control Policy",
    description: "Access control policy enforcement",
    status: "pass",
    severity: "high",
    frameworks: [
      { framework: "SOC2", controlId: "CC6.1", controlName: "Logical Access" },
      { framework: "NIST-800-53", controlId: "AC-1", controlName: "Access Control Policy" },
    ],
    evidence: { type: "config", summary: "MFA enabled" },
    assurance: { level: 1, provenance: "tool" },
  }),
  makeControl({
    controlId: "AC-2",
    title: "Account Management",
    description: "User account lifecycle management",
    status: "fail",
    severity: "critical",
    frameworks: [
      { framework: "SOC2", controlId: "CC6.2", controlName: "Account Mgmt" },
    ],
    evidence: { type: "scan", summary: "Orphaned accounts found" },
    assurance: { level: 2, provenance: "tool" },
  }),
  makeControl({
    controlId: "CM-1",
    title: "Configuration Management",
    description: "Configuration baseline management",
    status: "pass",
    severity: "medium",
    frameworks: [
      { framework: "NIST-800-53", controlId: "CM-1", controlName: "Config Mgmt" },
      { framework: "ISO27001", controlId: "A.12.5.1", controlName: "Config Control" },
    ],
    evidence: { type: "test", summary: "Baseline drift test passed" },
    assurance: { level: 2, provenance: "auditor" },
  }),
  makeControl({
    controlId: "IR-1",
    title: "Incident Response Plan",
    description: "Incident response procedures documented",
    status: "skip",
    severity: "low",
    frameworks: [
      { framework: "SOC2", controlId: "CC7.3", controlName: "Incident Response" },
    ],
    evidence: { type: "document", summary: "IR plan document" },
    assurance: { level: 0, provenance: "self" },
  }),
  makeControl({
    controlId: "SC-1",
    title: "System Communications Protection",
    description: "Encryption and TLS configuration",
    status: "fail",
    severity: "critical",
    frameworks: [
      { framework: "SOC2", controlId: "CC6.7", controlName: "Encryption" },
      { framework: "NIST-800-53", controlId: "SC-1", controlName: "System Comm" },
      { framework: "ISO27001", controlId: "A.10.1.1", controlName: "Crypto Policy" },
    ],
    evidence: { type: "scan", summary: "TLS 1.0 still enabled" },
    assurance: { level: 1, provenance: "tool" },
  }),
  makeControl({
    controlId: "AU-1",
    title: "Audit Logging",
    description: "Audit and accountability logging configuration",
    status: "error",
    severity: "high",
    frameworks: [
      { framework: "NIST-800-53", controlId: "AU-1", controlName: "Audit Logging" },
    ],
    evidence: { type: "observation", summary: "Log collection agent crashed" },
    assurance: { level: 3, provenance: "tool" },
  }),
  makeControl({
    controlId: "RA-1",
    title: "Risk Assessment",
    description: "Risk assessment performed by third party",
    status: "pass",
    severity: "info",
    frameworks: [
      { framework: "ISO27001", controlId: "A.8.2.1", controlName: "Asset Classification" },
    ],
    evidence: { type: "attestation", summary: "Attested by Deloitte LLP" },
    assurance: { level: 4, provenance: "auditor" },
  }),
];

// =============================================================================
// STATUS FILTERING
// =============================================================================

describe("Query Engine — Status Filtering", () => {
  test("should filter by single status", () => {
    const result = queryEvidence(fixtures, { status: "fail" });
    expect(result.controls.length).toBe(2);
    expect(result.total).toBe(2);
    expect(result.controls.every((c) => c.status === "fail")).toBe(true);
  });

  test("should filter by multiple statuses", () => {
    const result = queryEvidence(fixtures, { status: ["fail", "error"] });
    expect(result.controls.length).toBe(3);
    expect(result.controls.every((c) => c.status === "fail" || c.status === "error")).toBe(true);
  });

  test("should return empty when no controls match status", () => {
    const result = queryEvidence(fixtures, { status: "error" });
    // Only AU-1 is error
    expect(result.controls.length).toBe(1);
    expect(result.controls[0].controlId).toBe("AU-1");
  });

  test("should return empty array for status that matches nothing in subset", () => {
    const singlePass = [makeControl({ controlId: "X-1", status: "pass" })];
    const result = queryEvidence(singlePass, { status: "fail" });
    expect(result.controls.length).toBe(0);
    expect(result.total).toBe(0);
  });
});

// =============================================================================
// SEVERITY FILTERING
// =============================================================================

describe("Query Engine — Severity Filtering", () => {
  test("should filter by single severity", () => {
    const result = queryEvidence(fixtures, { severity: "critical" });
    expect(result.controls.length).toBe(2);
    expect(result.controls.every((c) => c.severity === "critical")).toBe(true);
  });

  test("should filter by multiple severities", () => {
    const result = queryEvidence(fixtures, { severity: ["critical", "high"] });
    expect(result.controls.length).toBe(4);
  });

  test("should sort by severity ordinal ascending", () => {
    const result = queryEvidence(fixtures, { sortBy: "severity", sortDirection: "asc" });
    const severities = result.controls.map((c) => c.severity);
    const ordinals = severities.map(severityToOrdinal);
    for (let i = 1; i < ordinals.length; i++) {
      expect(ordinals[i]).toBeGreaterThanOrEqual(ordinals[i - 1]);
    }
  });

  test("should sort by severity ordinal descending", () => {
    const result = queryEvidence(fixtures, { sortBy: "severity", sortDirection: "desc" });
    const severities = result.controls.map((c) => c.severity);
    const ordinals = severities.map(severityToOrdinal);
    for (let i = 1; i < ordinals.length; i++) {
      expect(ordinals[i]).toBeLessThanOrEqual(ordinals[i - 1]);
    }
  });
});

function severityToOrdinal(s: string): number {
  const map: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return map[s] ?? 999;
}

// =============================================================================
// FRAMEWORK FILTERING
// =============================================================================

describe("Query Engine — Framework Filtering", () => {
  test("should filter by single framework", () => {
    const result = queryEvidence(fixtures, { framework: "SOC2" });
    // AC-1 (SOC2), AC-2 (SOC2), IR-1 (SOC2), SC-1 (SOC2)
    expect(result.controls.length).toBe(4);
  });

  test("should filter by multiple frameworks (union)", () => {
    const result = queryEvidence(fixtures, { framework: ["SOC2", "ISO27001"] });
    // SOC2: AC-1, AC-2, IR-1, SC-1; ISO27001: CM-1, SC-1, RA-1 → union = AC-1, AC-2, CM-1, IR-1, SC-1, RA-1
    expect(result.controls.length).toBe(6);
  });

  test("should handle controls mapped to multiple frameworks", () => {
    const result = queryEvidence(fixtures, { framework: "NIST-800-53" });
    // AC-1, CM-1, SC-1, AU-1
    expect(result.controls.length).toBe(4);
    const ids = result.controls.map((c) => c.controlId).sort();
    expect(ids).toEqual(["AC-1", "AU-1", "CM-1", "SC-1"]);
  });

  test("should return empty for non-existent framework", () => {
    const result = queryEvidence(fixtures, { framework: "PCI-DSS" });
    expect(result.controls.length).toBe(0);
    expect(result.total).toBe(0);
  });
});

// =============================================================================
// PROVENANCE FILTERING
// =============================================================================

describe("Query Engine — Provenance Filtering", () => {
  test("should filter by single provenance", () => {
    const result = queryEvidence(fixtures, { provenance: "auditor" });
    expect(result.controls.length).toBe(2);
    expect(result.controls.every((c) => c.assurance.provenance === "auditor")).toBe(true);
  });

  test("should filter by multiple provenances", () => {
    const result = queryEvidence(fixtures, { provenance: ["self", "auditor"] });
    expect(result.controls.length).toBe(3);
  });
});

// =============================================================================
// ASSURANCE FILTERING
// =============================================================================

describe("Query Engine — Assurance Filtering", () => {
  test("should filter by minimum assurance level", () => {
    const result = queryEvidence(fixtures, { minAssurance: 2 });
    // CM-1 (L2), AC-2 (L2), AU-1 (L3), RA-1 (L4) = 4
    expect(result.controls.length).toBe(4);
    expect(result.controls.every((c) => c.assurance.level >= 2)).toBe(true);
  });

  test("should filter by minAssurance=0 returning all", () => {
    const result = queryEvidence(fixtures, { minAssurance: 0 });
    expect(result.controls.length).toBe(fixtures.length);
  });

  test("should return empty for minAssurance above all controls", () => {
    const lowControls = [makeControl({ controlId: "X-1", assurance: { level: 0, provenance: "self" } })];
    const result = queryEvidence(lowControls, { minAssurance: 4 });
    expect(result.controls.length).toBe(0);
  });
});

// =============================================================================
// EVIDENCE TYPE FILTERING
// =============================================================================

describe("Query Engine — Evidence Type Filtering", () => {
  test("should filter by single evidence type", () => {
    const result = queryEvidence(fixtures, { evidenceType: "scan" });
    // AC-2 (scan), SC-1 (scan)
    expect(result.controls.length).toBe(2);
  });

  test("should filter by multiple evidence types", () => {
    const result = queryEvidence(fixtures, { evidenceType: ["config", "test"] });
    // AC-1 (config), CM-1 (test)
    expect(result.controls.length).toBe(2);
  });
});

// =============================================================================
// TEXT SEARCH
// =============================================================================

describe("Query Engine — Text Search", () => {
  test("should search case-insensitively across controlId", () => {
    const result = queryEvidence(fixtures, { search: "ac-1" });
    expect(result.controls.length).toBe(1);
    expect(result.controls[0].controlId).toBe("AC-1");
  });

  test("should search case-insensitively across title", () => {
    const result = queryEvidence(fixtures, { search: "incident response" });
    expect(result.controls.length).toBe(1);
    expect(result.controls[0].controlId).toBe("IR-1");
  });

  test("should search across description", () => {
    const result = queryEvidence(fixtures, { search: "encryption" });
    expect(result.controls.length).toBe(1);
    expect(result.controls[0].controlId).toBe("SC-1");
  });

  test("should return partial matches", () => {
    const result = queryEvidence(fixtures, { search: "account" });
    // AC-2 title "Account Management" + AU-1 desc "Audit and accountability..."
    expect(result.controls.length).toBeGreaterThanOrEqual(1);
    expect(result.controls.some((c) => c.controlId === "AC-2")).toBe(true);
  });

  test("should return empty for no matches", () => {
    const result = queryEvidence(fixtures, { search: "xyznonexistent" });
    expect(result.controls.length).toBe(0);
  });
});

// =============================================================================
// AGGREGATIONS
// =============================================================================

describe("Query Engine — Aggregations", () => {
  test("should compute aggregations on full set when no filters", () => {
    const result = queryEvidence(fixtures, {});
    expect(result.aggregations.byStatus.pass).toBe(3);
    expect(result.aggregations.byStatus.fail).toBe(2);
    expect(result.aggregations.byStatus.skip).toBe(1);
    expect(result.aggregations.byStatus.error).toBe(1);
  });

  test("should compute severity aggregations", () => {
    const result = queryEvidence(fixtures, {});
    expect(result.aggregations.bySeverity.critical).toBe(2);
    expect(result.aggregations.bySeverity.high).toBe(2);
    expect(result.aggregations.bySeverity.medium).toBe(1);
    expect(result.aggregations.bySeverity.low).toBe(1);
    expect(result.aggregations.bySeverity.info).toBe(1);
  });

  test("should compute framework aggregations (counts controls per framework)", () => {
    const result = queryEvidence(fixtures, {});
    expect(result.aggregations.byFramework["SOC2"]).toBe(4);
    expect(result.aggregations.byFramework["NIST-800-53"]).toBe(4);
    expect(result.aggregations.byFramework["ISO27001"]).toBe(3);
  });

  test("should compute provenance aggregations", () => {
    const result = queryEvidence(fixtures, {});
    expect(result.aggregations.byProvenance.tool).toBe(4);
    expect(result.aggregations.byProvenance.auditor).toBe(2);
    expect(result.aggregations.byProvenance.self).toBe(1);
  });

  test("should compute assurance level aggregations", () => {
    const result = queryEvidence(fixtures, {});
    expect(result.aggregations.byAssurance["0"]).toBe(1);
    expect(result.aggregations.byAssurance["1"]).toBe(2);
    expect(result.aggregations.byAssurance["2"]).toBe(2);
    expect(result.aggregations.byAssurance["3"]).toBe(1);
    expect(result.aggregations.byAssurance["4"]).toBe(1);
  });

  test("should compute aggregations on FILTERED set, not full set", () => {
    const result = queryEvidence(fixtures, { status: "fail" });
    expect(result.aggregations.byStatus.fail).toBe(2);
    expect(result.aggregations.byStatus.pass).toBe(0);
    expect(result.aggregations.bySeverity.critical).toBe(2);
    expect(result.total).toBe(2);
  });
});

// =============================================================================
// SORTING
// =============================================================================

describe("Query Engine — Sorting", () => {
  test("should sort by controlId ascending", () => {
    const result = queryEvidence(fixtures, { sortBy: "controlId", sortDirection: "asc" });
    const ids = result.controls.map((c) => c.controlId);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  test("should sort by controlId descending", () => {
    const result = queryEvidence(fixtures, { sortBy: "controlId", sortDirection: "desc" });
    const ids = result.controls.map((c) => c.controlId);
    const sorted = [...ids].sort().reverse();
    expect(ids).toEqual(sorted);
  });

  test("should sort by status ascending", () => {
    const result = queryEvidence(fixtures, { sortBy: "status", sortDirection: "asc" });
    const statuses = result.controls.map((c) => c.status);
    const sorted = [...statuses].sort();
    expect(statuses).toEqual(sorted);
  });

  test("should sort by assurance ascending", () => {
    const result = queryEvidence(fixtures, { sortBy: "assurance", sortDirection: "asc" });
    const levels = result.controls.map((c) => c.assurance.level);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    }
  });

  test("should default to ascending when no direction specified", () => {
    const result = queryEvidence(fixtures, { sortBy: "controlId" });
    const ids = result.controls.map((c) => c.controlId);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

// =============================================================================
// PAGINATION
// =============================================================================

describe("Query Engine — Pagination", () => {
  test("should limit results", () => {
    const result = queryEvidence(fixtures, { limit: 3 });
    expect(result.controls.length).toBe(3);
    expect(result.total).toBe(7); // total is before pagination
  });

  test("should offset results", () => {
    const sorted = queryEvidence(fixtures, { sortBy: "controlId", sortDirection: "asc" });
    const withOffset = queryEvidence(fixtures, { sortBy: "controlId", sortDirection: "asc", offset: 2, limit: 2 });
    expect(withOffset.controls.length).toBe(2);
    expect(withOffset.controls[0].controlId).toBe(sorted.controls[2].controlId);
    expect(withOffset.controls[1].controlId).toBe(sorted.controls[3].controlId);
    expect(withOffset.total).toBe(7);
  });

  test("should return empty if offset exceeds total", () => {
    const result = queryEvidence(fixtures, { offset: 100, limit: 10 });
    expect(result.controls.length).toBe(0);
    expect(result.total).toBe(7);
  });

  test("should return remaining if limit exceeds available after offset", () => {
    const result = queryEvidence(fixtures, { offset: 5, limit: 10 });
    expect(result.controls.length).toBe(2); // 7 - 5 = 2
    expect(result.total).toBe(7);
  });
});

// =============================================================================
// COMBINED FILTERS
// =============================================================================

describe("Query Engine — Combined Filters", () => {
  test("should combine status + severity filters", () => {
    const result = queryEvidence(fixtures, { status: "fail", severity: "critical" });
    expect(result.controls.length).toBe(2);
    expect(result.controls.every((c) => c.status === "fail" && c.severity === "critical")).toBe(true);
  });

  test("should combine framework + status filters", () => {
    const result = queryEvidence(fixtures, { framework: "SOC2", status: "fail" });
    // SOC2 controls: AC-1(pass), AC-2(fail), IR-1(skip), SC-1(fail) → fail: AC-2, SC-1
    expect(result.controls.length).toBe(2);
    expect(result.controls.every((c) => c.status === "fail")).toBe(true);
  });

  test("should combine all filters", () => {
    const result = queryEvidence(fixtures, {
      status: "fail",
      severity: "critical",
      framework: "SOC2",
      provenance: "tool",
      minAssurance: 1,
      evidenceType: "scan",
    });
    // AC-2: fail, critical, SOC2, tool, L2, scan → YES
    // SC-1: fail, critical, SOC2, tool, L1, scan → YES
    expect(result.controls.length).toBe(2);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("Query Engine — Edge Cases", () => {
  test("should return all controls with empty query", () => {
    const result = queryEvidence(fixtures, {});
    expect(result.controls.length).toBe(7);
    expect(result.total).toBe(7);
  });

  test("should handle empty controls array", () => {
    const result = queryEvidence([], {});
    expect(result.controls.length).toBe(0);
    expect(result.total).toBe(0);
    expect(result.aggregations.byStatus.pass).toBe(0);
    expect(result.aggregations.byStatus.fail).toBe(0);
  });

  test("should handle empty controls with filters", () => {
    const result = queryEvidence([], { status: "fail", severity: "critical" });
    expect(result.controls.length).toBe(0);
    expect(result.total).toBe(0);
  });
});

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

describe("Query Engine — findFailingCritical", () => {
  test("should find controls that are fail + critical", () => {
    const result = findFailingCritical(fixtures);
    expect(result.length).toBe(2);
    expect(result.every((c) => c.status === "fail" && c.severity === "critical")).toBe(true);
    const ids = result.map((c) => c.controlId).sort();
    expect(ids).toEqual(["AC-2", "SC-1"]);
  });

  test("should return empty if no failing critical controls", () => {
    const passing = [makeControl({ controlId: "X-1", status: "pass", severity: "critical" })];
    const result = findFailingCritical(passing);
    expect(result.length).toBe(0);
  });
});

describe("Query Engine — findByFramework", () => {
  test("should find all controls for a given framework", () => {
    const result = findByFramework(fixtures, "SOC2");
    expect(result.length).toBe(4);
  });

  test("should return empty for unknown framework", () => {
    const result = findByFramework(fixtures, "HIPAA");
    expect(result.length).toBe(0);
  });
});

describe("Query Engine — summarizeByFramework", () => {
  test("should produce per-framework pass/fail summary", () => {
    const summary = summarizeByFramework(fixtures);
    expect(summary["SOC2"]).toEqual({ total: 4, passed: 1, failed: 2 });
    // NIST-800-53: AC-1(pass), CM-1(pass), SC-1(fail), AU-1(error) → passed=2, failed=1
    expect(summary["NIST-800-53"]).toEqual({ total: 4, passed: 2, failed: 1 });
    // ISO27001: CM-1(pass), SC-1(fail), RA-1(pass) → passed=2, failed=1
    expect(summary["ISO27001"]).toEqual({ total: 3, passed: 2, failed: 1 });
  });

  test("should handle empty controls", () => {
    const summary = summarizeByFramework([]);
    expect(Object.keys(summary).length).toBe(0);
  });
});

describe("Query Engine — findRegressions", () => {
  test("should find controls that went from pass to fail", () => {
    const previous = [
      makeControl({ controlId: "AC-1", status: "pass" }),
      makeControl({ controlId: "AC-2", status: "pass" }),
      makeControl({ controlId: "CM-1", status: "fail" }),
    ];
    const current = [
      makeControl({ controlId: "AC-1", status: "pass" }),
      makeControl({ controlId: "AC-2", status: "fail" }),
      makeControl({ controlId: "CM-1", status: "fail" }),
    ];
    const regressions = findRegressions(current, previous);
    expect(regressions.length).toBe(1);
    expect(regressions[0].controlId).toBe("AC-2");
    expect(regressions[0].status).toBe("fail");
  });

  test("should return empty if no regressions", () => {
    const previous = [makeControl({ controlId: "AC-1", status: "pass" })];
    const current = [makeControl({ controlId: "AC-1", status: "pass" })];
    const regressions = findRegressions(current, previous);
    expect(regressions.length).toBe(0);
  });

  test("should ignore new controls not in previous", () => {
    const previous = [makeControl({ controlId: "AC-1", status: "pass" })];
    const current = [
      makeControl({ controlId: "AC-1", status: "pass" }),
      makeControl({ controlId: "AC-2", status: "fail" }),
    ];
    const regressions = findRegressions(current, previous);
    expect(regressions.length).toBe(0);
  });

  test("should ignore controls that went from fail to pass (improvement)", () => {
    const previous = [makeControl({ controlId: "AC-1", status: "fail" })];
    const current = [makeControl({ controlId: "AC-1", status: "pass" })];
    const regressions = findRegressions(current, previous);
    expect(regressions.length).toBe(0);
  });

  test("should handle empty previous (no regressions possible)", () => {
    const regressions = findRegressions(fixtures, []);
    expect(regressions.length).toBe(0);
  });
});
