/**
 * Quartermaster Types Tests
 *
 * Validates the structure and constraints of Quartermaster governance types.
 */

import { describe, test, expect } from "bun:test";
import type {
  QuartermasterGovernanceReport,
  QuartermasterDimensionScore,
  QuartermasterFinding,
  QuartermasterInput,
  QuartermasterConfig,
} from "../../src/quartermaster/quartermaster-types";

describe("Quartermaster Types", () => {
  test("QuartermasterGovernanceReport has all required fields", () => {
    const report: QuartermasterGovernanceReport = {
      reportId: "rpt-001",
      confidenceScore: 85,
      dimensions: [],
      trustTier: "ai-verified",
      totalFindings: 0,
      findingsBySeverity: { critical: 0, warning: 0, info: 0 },
      executiveSummary: "Test summary",
      evaluatedAt: new Date().toISOString(),
      durationMs: 1000,
      model: "claude-sonnet-4-5-20250929",
      reportHash: "abc123",
    };

    expect(report.reportId).toBe("rpt-001");
    expect(report.confidenceScore).toBe(85);
    expect(report.trustTier).toBe("ai-verified");
    expect(report.totalFindings).toBe(0);
    expect(report.findingsBySeverity).toEqual({ critical: 0, warning: 0, info: 0 });
    expect(report.executiveSummary).toBe("Test summary");
    expect(typeof report.evaluatedAt).toBe("string");
    expect(report.durationMs).toBe(1000);
    expect(report.model).toBe("claude-sonnet-4-5-20250929");
    expect(report.reportHash).toBe("abc123");
  });

  test("QuartermasterDimensionScore has dimension, score, rationale, findings", () => {
    const dimension: QuartermasterDimensionScore = {
      dimension: "methodology",
      score: 90,
      weight: 0.3,
      rationale: "Strong methodology applied",
      findings: [],
    };

    expect(dimension.dimension).toBe("methodology");
    expect(dimension.score).toBe(90);
    expect(dimension.weight).toBe(0.3);
    expect(dimension.rationale).toBe("Strong methodology applied");
    expect(dimension.findings).toEqual([]);
  });

  test("QuartermasterFinding has severity, category, description, evidence, remediation", () => {
    const finding: QuartermasterFinding = {
      id: "ADM-001",
      severity: "critical",
      category: "evidence_integrity",
      description: "Hash chain broken at record 5",
      evidence: ["evidence/test.jsonl:5"],
      remediation: "Re-run evidence collection",
    };

    expect(finding.id).toBe("ADM-001");
    expect(finding.severity).toBe("critical");
    expect(finding.category).toBe("evidence_integrity");
    expect(finding.description).toContain("Hash chain broken");
    expect(finding.evidence).toHaveLength(1);
    expect(finding.remediation).toContain("Re-run");
  });

  test("QuartermasterInput has all required artifact fields", () => {
    const input: QuartermasterInput = {
      evidencePaths: ["evidence/test.jsonl"],
      markResults: [],
      raidResults: [],
      chartResults: [],
      scope: {
        providers: ["aws-cognito"],
        resourceCount: 1,
      },
    };

    expect(input.evidencePaths).toHaveLength(1);
    expect(input.markResults).toEqual([]);
    expect(input.raidResults).toEqual([]);
    expect(input.chartResults).toEqual([]);
    expect(input.scope.providers).toEqual(["aws-cognito"]);
    expect(input.scope.resourceCount).toBe(1);
  });

  test("Trust tier thresholds: <70=self-assessed, 70-89=ai-verified, >=90=auditor-verified", () => {
    // Verify the type allows all three trust tiers
    const tiers: Array<"self-assessed" | "ai-verified" | "auditor-verified"> = [
      "self-assessed",
      "ai-verified",
      "auditor-verified",
    ];

    expect(tiers).toHaveLength(3);
    expect(tiers).toContain("self-assessed");
    expect(tiers).toContain("ai-verified");
    expect(tiers).toContain("auditor-verified");

    // The mapping convention:
    // <70 → self-assessed
    // 70-89 → ai-verified
    // >=90 → auditor-verified
    const getTrustTier = (score: number): string => {
      if (score >= 90) return "auditor-verified";
      if (score >= 70) return "ai-verified";
      return "self-assessed";
    };

    expect(getTrustTier(50)).toBe("self-assessed");
    expect(getTrustTier(69)).toBe("self-assessed");
    expect(getTrustTier(70)).toBe("ai-verified");
    expect(getTrustTier(89)).toBe("ai-verified");
    expect(getTrustTier(90)).toBe("auditor-verified");
    expect(getTrustTier(100)).toBe("auditor-verified");
  });
});
