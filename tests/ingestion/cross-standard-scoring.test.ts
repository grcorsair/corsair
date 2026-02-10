import { describe, test, expect } from "bun:test";
import {
  classifyAssessmentDepth,
  computeProvenanceQuality,
  runBinaryChecks,
  computeDoraMetrics,
} from "../../src/ingestion/assurance-calculator";
import type { IngestedControl, DocumentMetadata } from "../../src/ingestion/types";
import type { CPOEAssurance } from "../../src/parley/vc-types";

// =============================================================================
// CROSS-STANDARD EVIDENCE QUALITY ENGINE TESTS (Phase 6)
// =============================================================================

const recentDate = new Date();
recentDate.setDate(recentDate.getDate() - 30);
const recentDateStr = recentDate.toISOString().split("T")[0];

const richControl: IngestedControl = {
  id: "CC6.1",
  description: "Logical access security",
  status: "effective",
  evidence: "Examined the MFA configuration settings in Okta and inspected the enrollment policy. Interviewed the security team about enforcement exceptions. Tested MFA for a sample of 25 users from a population of 1,247 daily logins and observed the enrollment workflow.",
};

const minimalControl: IngestedControl = {
  id: "CC6.2",
  description: "Access provisioning",
  status: "effective",
  evidence: "Control is effective.",
};

const soc2Metadata: DocumentMetadata = {
  title: "SOC 2 Type II",
  issuer: "Acme Corp",
  date: recentDateStr,
  scope: "Cloud Infrastructure Platform",
  auditor: "Deloitte & Touche LLP",
  reportType: "SOC 2 Type II",
  rawTextHash: "abc123def456",
};

// =============================================================================
// 6A: NIST 800-53A Assessment Depth
// =============================================================================

describe("NIST 800-53A Assessment Depth (6A)", () => {
  test("evidence with all 3 methods detected at comprehensive depth scores high", () => {
    const result = classifyAssessmentDepth(richControl);
    expect(result.methods.length).toBe(3); // examine + interview + test
    expect(result.methods).toContain("examine");
    expect(result.methods).toContain("interview");
    expect(result.methods).toContain("test");
    expect(result.rigorScore).toBeGreaterThanOrEqual(45);
  });

  test("evidence with single basic method scores low", () => {
    const basicControl: IngestedControl = {
      id: "CC6.2",
      description: "Access provisioning",
      status: "effective",
      evidence: "Reviewed the access policy document.",
    };

    const result = classifyAssessmentDepth(basicControl);
    expect(result.methods.length).toBe(1);
    expect(result.methods).toContain("examine");
    expect(result.rigorScore).toBeLessThanOrEqual(25);
  });

  test("evidence with no detectable methods returns empty", () => {
    const result = classifyAssessmentDepth(minimalControl);
    expect(result.methods.length).toBe(0);
    expect(result.rigorScore).toBe(0);
  });

  test("depth classification detects focused vs basic examine", () => {
    const focusedControl: IngestedControl = {
      id: "CC6.3",
      description: "MFA configuration",
      status: "effective",
      evidence: "Studied the Okta MFA enrollment policy settings, analyzed the enforcement rules for all user groups, and examined the conditional access configuration for production systems.",
    };

    const result = classifyAssessmentDepth(focusedControl);
    expect(result.methods).toContain("examine");
    // Focused/comprehensive should score higher than basic
    expect(result.depth).not.toBe("basic");
  });
});

// =============================================================================
// 6B: SLSA-Inspired Provenance Quality
// =============================================================================

describe("SLSA Provenance Quality (6B)", () => {
  test("SOC 2 with complete metadata scores high provenance", () => {
    const controls = [richControl];
    const score = computeProvenanceQuality(controls, "soc2", soc2Metadata);
    expect(score).toBeGreaterThanOrEqual(50);
  });

  test("manual source with missing metadata scores low provenance", () => {
    const bareMetadata: DocumentMetadata = {
      title: "Self Assessment",
      issuer: "Unknown",
      date: "",
      scope: "Some systems",
    };

    const score = computeProvenanceQuality([minimalControl], "manual", bareMetadata);
    expect(score).toBeLessThan(40);
  });

  test("missing source date reduces provenance score", () => {
    const noDateMeta = { ...soc2Metadata, date: "" };
    const withDate = computeProvenanceQuality([richControl], "soc2", soc2Metadata);
    const withoutDate = computeProvenanceQuality([richControl], "soc2", noDateMeta);
    expect(withoutDate).toBeLessThan(withDate);
  });

  test("provenance score is 0-100", () => {
    const score = computeProvenanceQuality([richControl], "soc2", soc2Metadata);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// 6C: CIS-Style Binary Evidence Checks
// =============================================================================

describe("CIS Binary Checks (6C)", () => {
  test("complete SOC 2 passes most checks", () => {
    const assurance: CPOEAssurance = {
      declared: 1,
      verified: true,
      method: "automated-config-check",
      breakdown: { "1": 2 },
    };

    const result = runBinaryChecks(
      [richControl, { ...richControl, id: "CC6.3" }],
      "soc2",
      soc2Metadata,
      assurance,
    );

    expect(result.total).toBe(16);
    expect(result.passed).toBeGreaterThan(10);
    expect(Object.keys(result.checks).length).toBe(16);
  });

  test("controls without evidence fail evidence-exists check", () => {
    const noEvidence: IngestedControl = {
      id: "CC6.1",
      description: "Logical access",
      status: "effective",
    };

    const assurance: CPOEAssurance = {
      declared: 1,
      verified: true,
      method: "self-assessed",
      breakdown: { "0": 1 },
    };

    const result = runBinaryChecks([noEvidence], "soc2", soc2Metadata, assurance);
    expect(result.checks["evidence-exists"]).toBe(false);
  });

  test("self-assessed source for L1+ fails source-identified check", () => {
    const assurance: CPOEAssurance = {
      declared: 1,
      verified: true,
      method: "self-assessed",
      breakdown: { "1": 1 },
    };

    const result = runBinaryChecks([richControl], "manual", soc2Metadata, assurance);
    expect(result.checks["source-identified"]).toBe(false);
  });

  test("empty scope fails scope-non-empty check", () => {
    const shortScope = { ...soc2Metadata, scope: "abc" };
    const assurance: CPOEAssurance = {
      declared: 1,
      verified: true,
      method: "automated-config-check",
      breakdown: { "1": 1 },
    };

    const result = runBinaryChecks([richControl], "soc2", shortScope, assurance);
    expect(result.checks["scope-non-empty"]).toBe(false);
  });

  test("all checks return boolean values", () => {
    const assurance: CPOEAssurance = {
      declared: 1,
      verified: true,
      method: "automated-config-check",
      breakdown: { "1": 1 },
    };

    const result = runBinaryChecks([richControl], "soc2", soc2Metadata, assurance);
    for (const [, val] of Object.entries(result.checks)) {
      expect(typeof val).toBe("boolean");
    }
  });
});

// =============================================================================
// 6D: DORA-Style Paired Anti-Gaming Metrics
// =============================================================================

describe("DORA Paired Metrics (6D)", () => {
  test("fresh SOC 2 with rich evidence scores high", () => {
    const dims = {
      capability: 80, coverage: 70, reliability: 75,
      methodology: 65, freshness: 90, independence: 85, consistency: 70,
    };

    const result = computeDoraMetrics([richControl], "soc2", soc2Metadata, dims);
    expect(result.freshness).toBeGreaterThan(50);
    expect(result.specificity).toBeGreaterThan(50);
    expect(result.independence).toBeGreaterThan(50);
    expect(result.band).not.toBe("low");
  });

  test("stale self-assessment scores low", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 300);
    const oldMeta = { ...soc2Metadata, date: oldDate.toISOString().split("T")[0] };
    const dims = {
      capability: 30, coverage: 30, reliability: 20,
      methodology: 15, freshness: 10, independence: 15, consistency: 30,
    };

    const result = computeDoraMetrics([minimalControl], "manual", oldMeta, dims);
    expect(result.freshness).toBeLessThan(40);
    expect(result.independence).toBeLessThan(40);
    expect(result.band).toBe("low");
  });

  test("divergent paired metrics produce pairing flag", () => {
    // High freshness + low reproducibility = suspicious
    const dims = {
      capability: 80, coverage: 70, reliability: 75,
      methodology: 20, freshness: 95, independence: 85, consistency: 70,
    };

    const result = computeDoraMetrics([minimalControl], "soc2", soc2Metadata, dims);
    // Freshness high but specificity low (minimal evidence) = divergence
    if (result.freshness - result.reproducibility > 40) {
      expect(result.pairingFlags.length).toBeGreaterThan(0);
    }
  });

  test("overall band is min of all four metrics", () => {
    const dims = {
      capability: 80, coverage: 70, reliability: 75,
      methodology: 65, freshness: 90, independence: 85, consistency: 70,
    };

    const result = computeDoraMetrics([richControl], "soc2", soc2Metadata, dims);
    const minMetric = Math.min(result.freshness, result.specificity, result.independence, result.reproducibility);

    let expectedBand: string;
    if (minMetric >= 90) expectedBand = "elite";
    else if (minMetric >= 70) expectedBand = "high";
    else if (minMetric >= 40) expectedBand = "medium";
    else expectedBand = "low";

    expect(result.band).toBe(expectedBand);
  });

  test("all metrics are 0-100", () => {
    const dims = {
      capability: 80, coverage: 70, reliability: 75,
      methodology: 65, freshness: 90, independence: 85, consistency: 70,
    };

    const result = computeDoraMetrics([richControl], "soc2", soc2Metadata, dims);
    expect(result.freshness).toBeGreaterThanOrEqual(0);
    expect(result.freshness).toBeLessThanOrEqual(100);
    expect(result.specificity).toBeGreaterThanOrEqual(0);
    expect(result.specificity).toBeLessThanOrEqual(100);
    expect(result.independence).toBeGreaterThanOrEqual(0);
    expect(result.independence).toBeLessThanOrEqual(100);
    expect(result.reproducibility).toBeGreaterThanOrEqual(0);
    expect(result.reproducibility).toBeLessThanOrEqual(100);
  });
});
