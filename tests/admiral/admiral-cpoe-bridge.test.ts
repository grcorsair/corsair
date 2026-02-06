/**
 * Admiral CPOE Bridge Tests
 *
 * Tests the conversion from AdmiralGovernanceReport to CPOEAdmiralAttestation.
 */

import { describe, test, expect } from "bun:test";
import { admiralReportToAttestation } from "../../src/admiral/admiral-cpoe-bridge";
import type { AdmiralGovernanceReport } from "../../src/admiral/admiral-types";
import type { CPOEAdmiralAttestation } from "../../src/parley/cpoe-types";

function makeReport(overrides: Partial<AdmiralGovernanceReport> = {}): AdmiralGovernanceReport {
  return {
    reportId: "rpt-001",
    confidenceScore: 82,
    dimensions: [
      {
        dimension: "methodology",
        score: 85,
        weight: 0.3,
        rationale: "Sound methodology",
        findings: [],
      },
      {
        dimension: "evidence_integrity",
        score: 90,
        weight: 0.25,
        rationale: "All chains valid",
        findings: [],
      },
      {
        dimension: "completeness",
        score: 75,
        weight: 0.25,
        rationale: "Some gaps in coverage",
        findings: [],
      },
      {
        dimension: "bias_detection",
        score: 80,
        weight: 0.2,
        rationale: "Minimal bias detected",
        findings: [],
      },
    ],
    trustTier: "ai-verified",
    totalFindings: 3,
    findingsBySeverity: { critical: 0, warning: 2, info: 1 },
    executiveSummary: "Assessment shows adequate controls with minor gaps.",
    evaluatedAt: "2025-01-15T10:00:00.000Z",
    durationMs: 5000,
    model: "claude-sonnet-4-5-20250929",
    reportHash: "abc123def456",
    ...overrides,
  };
}

describe("Admiral CPOE Bridge", () => {
  test("admiralReportToAttestation extracts correct confidence score", () => {
    const report = makeReport({ confidenceScore: 92 });
    const attestation = admiralReportToAttestation(report);

    // CPOE attestation uses 0-1 scale, report uses 0-100
    expect(attestation.confidenceScore).toBeCloseTo(0.92, 2);
  });

  test("admiralReportToAttestation maps all 4 dimension scores", () => {
    const report = makeReport();
    const attestation = admiralReportToAttestation(report);

    expect(attestation.dimensions).toHaveLength(4);

    const dimNames = attestation.dimensions.map((d) => d.dimension);
    expect(dimNames).toContain("methodology");
    expect(dimNames).toContain("evidence_integrity");
    expect(dimNames).toContain("completeness");
    expect(dimNames).toContain("bias_detection");

    // Scores should be normalized to 0-1
    for (const dim of attestation.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(1);
    }
  });

  test("admiralReportToAttestation sets correct trust tier", () => {
    const selfAssessed = admiralReportToAttestation(makeReport({ trustTier: "self-assessed" }));
    expect(selfAssessed.trustTier).toBe("self-assessed");

    const aiVerified = admiralReportToAttestation(makeReport({ trustTier: "ai-verified" }));
    expect(aiVerified.trustTier).toBe("ai-verified");

    const auditorVerified = admiralReportToAttestation(makeReport({ trustTier: "auditor-verified" }));
    expect(auditorVerified.trustTier).toBe("auditor-verified");
  });

  test("admiralReportToAttestation includes report hash", () => {
    const report = makeReport({ reportHash: "sha256-deadbeef" });
    const attestation = admiralReportToAttestation(report);

    expect(attestation.reportHash).toBe("sha256-deadbeef");
  });

  test("admiralReportToAttestation includes evaluatedAt timestamp", () => {
    const report = makeReport({ evaluatedAt: "2025-06-15T12:00:00.000Z" });
    const attestation = admiralReportToAttestation(report);

    expect(attestation.evaluatedAt).toBe("2025-06-15T12:00:00.000Z");
  });

  test("Round-trip: dimension scores map correctly to 0-1 scale", () => {
    const report = makeReport({
      dimensions: [
        { dimension: "methodology", score: 100, weight: 0.3, rationale: "Perfect", findings: [] },
        { dimension: "evidence_integrity", score: 0, weight: 0.25, rationale: "None", findings: [] },
        { dimension: "completeness", score: 50, weight: 0.25, rationale: "Half", findings: [] },
        { dimension: "bias_detection", score: 75, weight: 0.2, rationale: "Good", findings: [] },
      ],
    });

    const attestation = admiralReportToAttestation(report);

    const methodologyDim = attestation.dimensions.find((d) => d.dimension === "methodology");
    const integrityDim = attestation.dimensions.find((d) => d.dimension === "evidence_integrity");
    const completenessDim = attestation.dimensions.find((d) => d.dimension === "completeness");
    const biasDim = attestation.dimensions.find((d) => d.dimension === "bias_detection");

    expect(methodologyDim!.score).toBeCloseTo(1.0, 2);
    expect(integrityDim!.score).toBeCloseTo(0.0, 2);
    expect(completenessDim!.score).toBeCloseTo(0.5, 2);
    expect(biasDim!.score).toBeCloseTo(0.75, 2);
  });
});
