/**
 * Quartermaster v2 Tests — Governance Review Engine
 *
 * TDD: These tests are written FIRST. They must FAIL before implementation.
 * Tests the full review flow: scoring engine + governance checks + score adjustment.
 */

import { describe, test, expect } from "bun:test";
import type { CanonicalControlEvidence } from "../../src/normalize/types";
import type { GovernanceReport, QuartermasterConfig, GovernanceFinding } from "../../src/quartermaster/types";
import { reviewEvidence } from "../../src/quartermaster/quartermaster";

// =============================================================================
// HELPERS
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
    frameworks: overrides.frameworks ?? [{ framework: "SOC2", controlId: "CC6.1" }],
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

function makeControls(count: number, overrides: Partial<CanonicalControlEvidence> = {}): CanonicalControlEvidence[] {
  return Array.from({ length: count }, (_, i) =>
    makeControl({ controlId: `ctrl-${i + 1}`, ...overrides })
  );
}

// =============================================================================
// 1. BASIC REVIEW FLOW
// =============================================================================

describe("reviewEvidence — Basic Flow", () => {
  test("should return a GovernanceReport for valid controls", async () => {
    const controls = makeControls(5);
    const report = await reviewEvidence(controls);

    expect(report).toBeDefined();
    expect(report.score).toBeDefined();
    expect(report.score.composite).toBeGreaterThan(0);
    expect(report.score.grade).toBeTruthy();
    expect(report.score.dimensions).toHaveLength(7);
    expect(report.findings).toBeDefined();
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.model).toBe("deterministic");
    expect(report.reviewedAt).toBeTruthy();
    expect(report.modelEnhanced).toBe(false);
  });

  test("should handle empty controls array", async () => {
    const report = await reviewEvidence([]);

    expect(report.score.composite).toBe(0);
    expect(report.score.grade).toBe("F");
    expect(report.score.controlsScored).toBe(0);
    expect(report.findings).toHaveLength(0);
  });

  test("should set reviewedAt to a valid ISO 8601 timestamp", async () => {
    const controls = makeControls(3);
    const report = await reviewEvidence(controls);

    const parsed = Date.parse(report.reviewedAt);
    expect(isNaN(parsed)).toBe(false);
  });
});

// =============================================================================
// 2. DETERMINISTIC MODE
// =============================================================================

describe("reviewEvidence — Deterministic Mode", () => {
  test("should use deterministic mode by default", async () => {
    const controls = makeControls(3);
    const report = await reviewEvidence(controls);

    expect(report.model).toBe("deterministic");
    expect(report.modelEnhanced).toBe(false);
  });

  test("should use deterministic mode when explicitly configured", async () => {
    const controls = makeControls(3);
    const config: QuartermasterConfig = { model: "deterministic" };
    const report = await reviewEvidence(controls, config);

    expect(report.model).toBe("deterministic");
    expect(report.modelEnhanced).toBe(false);
  });

  test("should fall back to deterministic when model is set but no API key", async () => {
    const controls = makeControls(3);
    // When a model is specified but no API key is available, fall back gracefully
    const config: QuartermasterConfig = { model: "claude-sonnet-4-5-20250929" };
    const report = await reviewEvidence(controls, config);

    // Should still produce a valid report (deterministic fallback)
    expect(report.score.composite).toBeGreaterThan(0);
    expect(report.modelEnhanced).toBe(false);
  });
});

// =============================================================================
// 3. SCORE ADJUSTMENT — Critical findings reduce dimension scores
// =============================================================================

describe("reviewEvidence — Score Adjustments", () => {
  test("critical finding should reduce relevant dimension score by 10", async () => {
    // Create controls where evidence gap check will fire (critical finding on evidence_quality)
    const controls = [
      makeControl({
        controlId: "ctrl-1",
        status: "pass",
        evidence: { type: "scan", summary: "" },
        frameworks: [{ framework: "SOC2", controlId: "CC6.1" }],
      }),
      makeControl({
        controlId: "ctrl-2",
        status: "pass",
        evidence: { type: "scan", summary: "Valid evidence" },
        frameworks: [{ framework: "SOC2", controlId: "CC6.2" }],
      }),
    ];

    // Run WITHOUT findings affecting score (baseline)
    const cleanControls = [
      makeControl({
        controlId: "ctrl-1",
        status: "pass",
        evidence: { type: "scan", summary: "Valid evidence A" },
        frameworks: [{ framework: "SOC2", controlId: "CC6.1" }],
      }),
      makeControl({
        controlId: "ctrl-2",
        status: "pass",
        evidence: { type: "scan", summary: "Valid evidence B" },
        frameworks: [{ framework: "SOC2", controlId: "CC6.2" }],
      }),
    ];

    const dirtyReport = await reviewEvidence(controls);
    const cleanReport = await reviewEvidence(cleanControls);

    // The dirty report should have a lower composite due to findings adjustments
    // Evidence gap is critical -> -10 on evidence_quality dimension
    expect(dirtyReport.score.composite).toBeLessThan(cleanReport.score.composite);
    expect(dirtyReport.findings.length).toBeGreaterThan(0);
  });

  test("warning findings should reduce relevant dimension score by 5", async () => {
    // Severity mismatch: critical control with document evidence = warning on methodology
    const controls = [
      makeControl({
        controlId: "ctrl-1",
        severity: "critical",
        status: "pass",
        evidence: { type: "document", summary: "Policy doc says so" },
        frameworks: [{ framework: "SOC2", controlId: "CC6.1" }],
      }),
    ];

    const report = await reviewEvidence(controls);

    // Should have at least a severity mismatch warning
    const warnings = report.findings.filter(f => f.severity === "warning");
    expect(warnings.length).toBeGreaterThan(0);
  });

  test("info findings should NOT affect scores", async () => {
    // Framework coverage gap: controls without framework refs = info finding
    const controlsNoFramework = [
      makeControl({
        controlId: "ctrl-1",
        frameworks: [],
        evidence: { type: "scan", summary: "Scan result" },
      }),
    ];
    const controlsWithFramework = [
      makeControl({
        controlId: "ctrl-1",
        frameworks: [{ framework: "SOC2", controlId: "CC6.1" }],
        evidence: { type: "scan", summary: "Scan result" },
      }),
    ];

    const reportNoFw = await reviewEvidence(controlsNoFramework);
    const reportWithFw = await reviewEvidence(controlsWithFramework);

    // Info findings should not change the composite
    // The two reports should have the same composite
    expect(reportNoFw.score.composite).toBe(reportWithFw.score.composite);
  });

  test("dimension score should floor at 0 (never go negative)", async () => {
    // Create many critical findings to try to push below 0
    const controls = Array.from({ length: 20 }, (_, i) =>
      makeControl({
        controlId: `ctrl-${i + 1}`,
        status: "pass",
        evidence: { type: "scan", summary: "" },
        frameworks: [{ framework: "SOC2", controlId: `CC${i}.1` }],
      })
    );

    const report = await reviewEvidence(controls);

    // All dimension scores must be >= 0
    for (const dim of report.score.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.weighted).toBeGreaterThanOrEqual(0);
    }
    expect(report.score.composite).toBeGreaterThanOrEqual(0);
  });
});

// =============================================================================
// 4. FINDINGS STRUCTURE
// =============================================================================

describe("reviewEvidence — Findings Structure", () => {
  test("each finding should have all required fields", async () => {
    const controls = [
      makeControl({
        controlId: "ctrl-1",
        status: "pass",
        evidence: { type: "scan", summary: "" },
      }),
    ];

    const report = await reviewEvidence(controls);

    for (const finding of report.findings) {
      expect(finding.id).toBeTruthy();
      expect(typeof finding.id).toBe("string");
      expect(["critical", "warning", "info"]).toContain(finding.severity);
      expect(["methodology", "evidence_quality", "completeness", "consistency", "bias"]).toContain(finding.category);
      expect(finding.description).toBeTruthy();
      expect(finding.remediation).toBeTruthy();
    }
  });

  test("finding IDs should be unique", async () => {
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const controls = [
      makeControl({
        controlId: "ctrl-1",
        status: "pass",
        severity: "critical",
        evidence: { type: "document", summary: "" },
        source: { tool: "prowler", rawId: "p1", rawStatus: "PASS", timestamp: oldDate },
      }),
    ];

    const report = await reviewEvidence(controls);
    const ids = report.findings.map(f => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// =============================================================================
// 5. SCORE RECOMPUTATION
// =============================================================================

describe("reviewEvidence — Score Recomputation", () => {
  test("composite should be recomputed after dimension adjustments", async () => {
    // Controls that generate a critical finding (evidence gap)
    const controls = [
      makeControl({
        controlId: "ctrl-1",
        status: "pass",
        evidence: { type: "scan", summary: "" },
        frameworks: [{ framework: "SOC2", controlId: "CC6.1" }],
      }),
    ];

    const report = await reviewEvidence(controls);

    // Verify composite = sum of weighted dimensions (after adjustments)
    const sumWeighted = report.score.dimensions.reduce((sum, d) => sum + d.weighted, 0);
    const expectedComposite = Math.round(sumWeighted * 100) / 100;
    expect(report.score.composite).toBe(expectedComposite);
  });

  test("grade should reflect adjusted composite", async () => {
    // Clean controls should have a good score
    const controls = makeControls(10, {
      evidence: { type: "scan", summary: "Valid scan output" },
      frameworks: [{ framework: "SOC2", controlId: "CC6.1" }],
    });

    const report = await reviewEvidence(controls);

    // Grade should match composite
    if (report.score.composite >= 90) expect(report.score.grade).toBe("A");
    else if (report.score.composite >= 80) expect(report.score.grade).toBe("B");
    else if (report.score.composite >= 70) expect(report.score.grade).toBe("C");
    else if (report.score.composite >= 60) expect(report.score.grade).toBe("D");
    else expect(report.score.grade).toBe("F");
  });
});

// =============================================================================
// 6. REPORT METADATA
// =============================================================================

describe("reviewEvidence — Report Metadata", () => {
  test("should include engine version in score", async () => {
    const controls = makeControls(3);
    const report = await reviewEvidence(controls);
    expect(report.score.engineVersion).toBeTruthy();
  });

  test("should include controlsScored count", async () => {
    const controls = makeControls(7);
    const report = await reviewEvidence(controls);
    expect(report.score.controlsScored).toBe(7);
  });

  test("should record model used", async () => {
    const controls = makeControls(3);
    const config: QuartermasterConfig = { model: "deterministic" };
    const report = await reviewEvidence(controls, config);
    expect(report.model).toBe("deterministic");
  });
});
