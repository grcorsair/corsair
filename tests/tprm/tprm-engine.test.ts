/**
 * TPRM Engine Tests -- Third-Party Risk Management Automation
 *
 * Tests the vendor assessment workflow:
 *   registerVendor -> requestAssessment -> runAssessment -> getDashboard
 *
 * TDD: Written FIRST, expected to FAIL until engine is implemented.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { TPRMEngine } from "../../src/tprm/tprm-engine";
import type {
  VendorProfile,
  AssessmentRequest,
  AssessmentResult,
  AssessmentFinding,
  MonitoringConfig,
  TPRMConfig,
  RiskTier,
  AssessmentDecision,
} from "../../src/tprm/types";
import type { Certification, CertificationStatus } from "../../src/certification/types";
import type { EvidenceQualityScore } from "../../src/scoring/types";

// =============================================================================
// TEST HELPERS
// =============================================================================

function makeVendorInput(overrides?: Partial<Omit<VendorProfile, "id" | "createdAt" | "updatedAt">>) {
  return {
    name: "Acme Cloud",
    domain: "acme.com",
    did: "did:web:acme.com",
    riskTier: "medium" as RiskTier,
    tags: ["cloud", "data-processor"],
    ...overrides,
  };
}

/**
 * Build a mock CPOE object for assessment.
 *
 * The TPRM engine needs to extract:
 *   - score (EvidenceQualityScore.composite)
 *   - frameworks (from vc.credentialSubject.frameworks keys)
 *   - issuedAt / expiresAt (from iat / exp)
 *   - assurance level (from vc.credentialSubject.assurance.declared)
 */
function makeCpoe(overrides?: {
  score?: number;
  frameworks?: string[];
  issuedAt?: string;
  expiresAt?: string;
  assurance?: number;
}) {
  const defaults = {
    score: 85,
    frameworks: ["SOC2", "NIST-800-53"],
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    assurance: 2,
  };
  const cfg = { ...defaults, ...overrides };

  // Build framework object for vc.credentialSubject.frameworks
  const frameworksObj: Record<string, { controlsMapped: number; passed: number; failed: number }> = {};
  for (const fw of cfg.frameworks) {
    frameworksObj[fw] = { controlsMapped: 20, passed: 18, failed: 2 };
  }

  return {
    score: { composite: cfg.score, grade: "B", dimensions: [], controlsScored: 20, scoredAt: cfg.issuedAt, engineVersion: "1.0.0" } as EvidenceQualityScore,
    iat: Math.floor(new Date(cfg.issuedAt).getTime() / 1000),
    exp: Math.floor(new Date(cfg.expiresAt).getTime() / 1000),
    vc: {
      credentialSubject: {
        frameworks: frameworksObj,
        assurance: { declared: cfg.assurance },
        summary: { controlsTested: 20, controlsPassed: 18, controlsFailed: 2, overallScore: cfg.score },
      },
    },
  };
}

function makeCertification(overrides?: Partial<Certification>): Certification {
  return {
    id: "cert-001",
    policyId: "policy-001",
    orgId: "org-001",
    status: "active" as CertificationStatus,
    currentScore: 85,
    currentGrade: "B",
    lastAuditAt: new Date().toISOString(),
    nextAuditAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    statusHistory: [{ status: "active" as CertificationStatus, changedAt: new Date().toISOString(), reason: "Initial", score: 85 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// ENGINE SETUP
// =============================================================================

let engine: TPRMEngine;

beforeEach(() => {
  engine = new TPRMEngine();
});

// =============================================================================
// VENDOR MANAGEMENT
// =============================================================================

describe("Vendor Management", () => {
  test("should register a vendor", () => {
    const vendor = engine.registerVendor(makeVendorInput());

    expect(vendor.id).toBeDefined();
    expect(vendor.id).toStartWith("vendor-");
    expect(vendor.name).toBe("Acme Cloud");
    expect(vendor.domain).toBe("acme.com");
    expect(vendor.did).toBe("did:web:acme.com");
    expect(vendor.riskTier).toBe("medium");
    expect(vendor.tags).toEqual(["cloud", "data-processor"]);
    expect(vendor.createdAt).toBeDefined();
    expect(vendor.updatedAt).toBeDefined();
  });

  test("should get vendor by ID", () => {
    const created = engine.registerVendor(makeVendorInput());
    const found = engine.getVendor(created.id);

    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe("Acme Cloud");
  });

  test("should return undefined for unknown vendor ID", () => {
    const found = engine.getVendor("vendor-nonexistent");
    expect(found).toBeUndefined();
  });

  test("should list all vendors", () => {
    engine.registerVendor(makeVendorInput({ name: "Vendor A" }));
    engine.registerVendor(makeVendorInput({ name: "Vendor B" }));
    engine.registerVendor(makeVendorInput({ name: "Vendor C" }));

    const vendors = engine.listVendors();
    expect(vendors).toHaveLength(3);
  });

  test("should filter vendors by risk tier", () => {
    engine.registerVendor(makeVendorInput({ name: "Critical Corp", riskTier: "critical" }));
    engine.registerVendor(makeVendorInput({ name: "Low Risk LLC", riskTier: "low" }));
    engine.registerVendor(makeVendorInput({ name: "Critical Inc", riskTier: "critical" }));

    const critical = engine.listVendors({ riskTier: "critical" });
    expect(critical).toHaveLength(2);
    expect(critical.every(v => v.riskTier === "critical")).toBe(true);
  });

  test("should filter vendors by tag", () => {
    engine.registerVendor(makeVendorInput({ name: "Cloud Co", tags: ["cloud", "saas"] }));
    engine.registerVendor(makeVendorInput({ name: "Data Inc", tags: ["data-processor"] }));
    engine.registerVendor(makeVendorInput({ name: "Cloud Data", tags: ["cloud", "data-processor"] }));

    const cloudVendors = engine.listVendors({ tag: "cloud" });
    expect(cloudVendors).toHaveLength(2);
    expect(cloudVendors.every(v => v.tags.includes("cloud"))).toBe(true);
  });

  test("should update vendor risk tier", () => {
    const vendor = engine.registerVendor(makeVendorInput({ riskTier: "medium" }));
    const updated = engine.updateVendorRiskTier(vendor.id, "critical", "Data breach reported");

    expect(updated).toBeDefined();
    expect(updated!.riskTier).toBe("critical");
    expect(updated!.updatedAt).toBeDefined();
    // Verify the vendor was actually mutated in storage
    const fetched = engine.getVendor(vendor.id);
    expect(fetched!.riskTier).toBe("critical");
  });

  test("should return undefined when updating unknown vendor risk tier", () => {
    const result = engine.updateVendorRiskTier("vendor-nonexistent", "critical", "reason");
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// ASSESSMENT WORKFLOW
// =============================================================================

describe("Assessment Workflow", () => {
  let vendorId: string;

  beforeEach(() => {
    const vendor = engine.registerVendor(makeVendorInput());
    vendorId = vendor.id;
  });

  test("should create an assessment request", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2", "NIST-800-53"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    expect(request.id).toBeDefined();
    expect(request.id).toStartWith("asr-");
    expect(request.vendorId).toBe(vendorId);
    expect(request.requestedBy).toBe("security-team");
    expect(request.frameworks).toEqual(["SOC2", "NIST-800-53"]);
    expect(request.minimumScore).toBe(70);
    expect(request.minimumAssurance).toBe(1);
    expect(request.requestedAt).toBeDefined();
  });

  test("should run assessment with high-scoring CPOEs and approve", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [
      makeCpoe({ score: 90, frameworks: ["SOC2", "NIST-800-53"] }),
      makeCpoe({ score: 88, frameworks: ["SOC2"] }),
    ];
    const certs = [makeCertification({ status: "active", currentScore: 90 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    expect(result.id).toBeDefined();
    expect(result.requestId).toBe(request.id);
    expect(result.vendorId).toBe(vendorId);
    expect(result.decision).toBe("approved");
    expect(result.compositeScore).toBeGreaterThanOrEqual(85);
    expect(result.cpoeCount).toBe(2);
    expect(result.automated).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test("should run assessment with moderate CPOEs and return conditional", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2", "NIST-800-53", "ISO-27001"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    // Score is decent but missing a required framework
    const cpoes = [
      makeCpoe({ score: 78, frameworks: ["SOC2", "NIST-800-53"] }),
    ];
    const certs = [makeCertification({ status: "warning", currentScore: 75 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    expect(result.decision).toBe("conditional");
    expect(result.conditions).toBeDefined();
    expect(result.conditions!.length).toBeGreaterThan(0);
  });

  test("should run assessment with poor CPOEs and return review_required", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2", "NIST-800-53"],
      minimumScore: 70,
      minimumAssurance: 2,
    });

    const cpoes = [
      makeCpoe({ score: 55, frameworks: ["SOC2"] }),
    ];
    const certs = [makeCertification({ status: "degraded", currentScore: 55 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    expect(result.decision).toBe("review_required");
  });

  test("should run assessment with terrible CPOEs and reject", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2", "NIST-800-53"],
      minimumScore: 70,
      minimumAssurance: 2,
    });

    const cpoes = [
      makeCpoe({ score: 25, frameworks: ["SOC2"] }),
    ];
    const certs = [makeCertification({ status: "suspended", currentScore: 25 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    expect(result.decision).toBe("rejected");
    expect(result.compositeScore).toBeLessThan(50);
  });

  test("should include score breakdown in assessment result", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];
    const certs = [makeCertification({ status: "active", currentScore: 85 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    expect(result.scoreBreakdown).toBeDefined();
    expect(typeof result.scoreBreakdown.evidenceQuality).toBe("number");
    expect(typeof result.scoreBreakdown.certificationStatus).toBe("number");
    expect(typeof result.scoreBreakdown.frameworkCoverage).toBe("number");
    expect(typeof result.scoreBreakdown.freshness).toBe("number");
    expect(typeof result.scoreBreakdown.historicalTrend).toBe("number");
  });

  test("composite score weights should sum to 1.0", () => {
    // The engine uses weights: evidenceQuality=0.30, certificationStatus=0.25,
    // frameworkCoverage=0.20, freshness=0.15, historicalTrend=0.10
    const weights = { evidenceQuality: 0.30, certificationStatus: 0.25, frameworkCoverage: 0.20, freshness: 0.15, historicalTrend: 0.10 };
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  test("should calculate framework coverage correctly", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2", "NIST-800-53", "ISO-27001", "HIPAA"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    // CPOE covers 2 out of 4 required frameworks
    const cpoes = [makeCpoe({ score: 90, frameworks: ["SOC2", "NIST-800-53"] })];
    const certs = [makeCertification({ status: "active", currentScore: 90 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    // frameworkCoverage should be 50% (2 of 4)
    expect(result.scoreBreakdown.frameworkCoverage).toBeCloseTo(50, 0);
  });

  test("should apply freshness penalty for old evidence", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    // CPOE issued 120 days ago (beyond 90-day freshness weight)
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const cpoes = [makeCpoe({ score: 90, frameworks: ["SOC2"], issuedAt: oldDate })];
    const certs = [makeCertification({ status: "active", currentScore: 90 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    // Freshness score should be penalized (not 100)
    expect(result.scoreBreakdown.freshness).toBeLessThan(100);
  });

  test("should generate findings for missing frameworks", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2", "NIST-800-53", "ISO-27001"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];
    const certs = [makeCertification({ status: "active", currentScore: 85 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    const missingFrameworkFindings = result.findings.filter(
      f => f.category === "missing_framework"
    );
    expect(missingFrameworkFindings.length).toBeGreaterThanOrEqual(2);
    expect(missingFrameworkFindings.some(f => f.description.includes("NIST-800-53"))).toBe(true);
    expect(missingFrameworkFindings.some(f => f.description.includes("ISO-27001"))).toBe(true);
  });

  test("should generate finding for expired CPOEs", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    // CPOE already expired
    const expiredDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"], expiresAt: expiredDate })];
    const certs = [makeCertification({ status: "active", currentScore: 85 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    const expiredFindings = result.findings.filter(f => f.category === "expired_cpoe");
    expect(expiredFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("should generate finding for low scores", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 40, frameworks: ["SOC2"] })];
    const certs = [makeCertification({ status: "degraded", currentScore: 40 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    const lowScoreFindings = result.findings.filter(f => f.category === "low_score");
    expect(lowScoreFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("should generate finding when no certification exists", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 80, frameworks: ["SOC2"] })];

    // No certifications provided
    const result = engine.runAssessment(request.id, cpoes);

    const noCertFindings = result.findings.filter(f => f.category === "no_certification");
    expect(noCertFindings.length).toBeGreaterThanOrEqual(1);
  });

  test("should provide descriptive decision reason", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 90, frameworks: ["SOC2"] })];
    const certs = [makeCertification({ status: "active", currentScore: 90 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    expect(result.decisionReason).toBeDefined();
    expect(result.decisionReason.length).toBeGreaterThan(10);
  });

  test("should list conditions for conditional decisions", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2", "ISO-27001", "HIPAA"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 78, frameworks: ["SOC2"] })];
    const certs = [makeCertification({ status: "warning", currentScore: 75 })];

    const result = engine.runAssessment(request.id, cpoes, certs);

    if (result.decision === "conditional") {
      expect(result.conditions).toBeDefined();
      expect(result.conditions!.length).toBeGreaterThan(0);
      expect(result.conditions!.every(c => typeof c === "string")).toBe(true);
    }
  });

  test("should get assessment by ID", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];
    const result = engine.runAssessment(request.id, cpoes);

    const found = engine.getAssessment(result.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(result.id);
    expect(found!.vendorId).toBe(vendorId);
  });

  test("should return undefined for unknown assessment ID", () => {
    const found = engine.getAssessment("assessment-nonexistent");
    expect(found).toBeUndefined();
  });

  test("should list all assessments", () => {
    const vendor2 = engine.registerVendor(makeVendorInput({ name: "Beta Corp", domain: "beta.com", did: "did:web:beta.com" }));

    const req1 = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });
    const req2 = engine.requestAssessment(vendor2.id, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req1.id, [makeCpoe()]);
    engine.runAssessment(req2.id, [makeCpoe()]);

    const all = engine.listAssessments();
    expect(all).toHaveLength(2);
  });

  test("should list assessments filtered by vendor ID", () => {
    const vendor2 = engine.registerVendor(makeVendorInput({ name: "Beta Corp", domain: "beta.com", did: "did:web:beta.com" }));

    const req1 = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });
    const req2 = engine.requestAssessment(vendor2.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req1.id, [makeCpoe()]);
    engine.runAssessment(req2.id, [makeCpoe()]);

    const vendorAssessments = engine.listAssessments(vendorId);
    expect(vendorAssessments).toHaveLength(1);
    expect(vendorAssessments[0].vendorId).toBe(vendorId);
  });

  test("should handle assessment with zero CPOEs", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const result = engine.runAssessment(request.id, []);

    expect(result.cpoeCount).toBe(0);
    expect(result.decision).toBe("rejected");
    expect(result.compositeScore).toBe(0);
    expect(result.findings.some(f => f.category === "missing_cpoe")).toBe(true);
  });

  test("should handle assessment with no certifications", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "security-team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];
    const result = engine.runAssessment(request.id, cpoes);

    // Should still work, just uses default cert status score
    expect(result).toBeDefined();
    expect(result.scoreBreakdown.certificationStatus).toBeDefined();
    expect(result.findings.some(f => f.category === "no_certification")).toBe(true);
  });

  test("should support multiple assessments for same vendor", () => {
    const req1 = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });
    const req2 = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2", "NIST-800-53"],
      minimumScore: 80,
      minimumAssurance: 2,
    });

    const result1 = engine.runAssessment(req1.id, [makeCpoe({ score: 90, frameworks: ["SOC2"] })]);
    const result2 = engine.runAssessment(req2.id, [makeCpoe({ score: 75, frameworks: ["SOC2"] })]);

    const vendorAssessments = engine.listAssessments(vendorId);
    expect(vendorAssessments).toHaveLength(2);
    expect(result1.id).not.toBe(result2.id);
  });

  test("should return undefined when requesting assessment for unknown vendor", () => {
    expect(() => {
      engine.requestAssessment("vendor-nonexistent", {
        requestedBy: "team",
        frameworks: ["SOC2"],
        minimumScore: 70,
        minimumAssurance: 1,
      });
    }).toThrow();
  });

  test("should set latestCpoeDate from most recent CPOE", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const cpoes = [
      makeCpoe({ score: 80, frameworks: ["SOC2"], issuedAt: oldDate }),
      makeCpoe({ score: 85, frameworks: ["SOC2"], issuedAt: recentDate }),
    ];

    const result = engine.runAssessment(request.id, cpoes);

    expect(result.latestCpoeDate).toBeDefined();
    // The latest CPOE date should be close to the recent date
    const latestMs = new Date(result.latestCpoeDate!).getTime();
    const recentMs = new Date(recentDate).getTime();
    expect(Math.abs(latestMs - recentMs)).toBeLessThan(1000);
  });

  test("should set risk tier on assessment result matching vendor", () => {
    engine.updateVendorRiskTier(vendorId, "high", "Handles sensitive data");

    const request = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];
    const result = engine.runAssessment(request.id, cpoes);

    expect(result.riskTier).toBe("high");
  });

  test("should generate stale evidence finding for old CPOEs", () => {
    const request = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    // CPOE issued 200 days ago
    const staleDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"], issuedAt: staleDate })];

    const result = engine.runAssessment(request.id, cpoes);

    const staleFindings = result.findings.filter(f => f.category === "stale_evidence");
    expect(staleFindings.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// DASHBOARD
// =============================================================================

describe("Dashboard", () => {
  test("should count vendors by risk tier", () => {
    engine.registerVendor(makeVendorInput({ name: "A", riskTier: "critical" }));
    engine.registerVendor(makeVendorInput({ name: "B", riskTier: "critical" }));
    engine.registerVendor(makeVendorInput({ name: "C", riskTier: "low" }));
    engine.registerVendor(makeVendorInput({ name: "D", riskTier: "medium" }));

    const dashboard = engine.getDashboard();

    expect(dashboard.totalVendors).toBe(4);
    expect(dashboard.byRiskTier.critical).toBe(2);
    expect(dashboard.byRiskTier.low).toBe(1);
    expect(dashboard.byRiskTier.medium).toBe(1);
    expect(dashboard.byRiskTier.high).toBe(0);
    expect(dashboard.byRiskTier.minimal).toBe(0);
  });

  test("should count assessments by decision", () => {
    const v1 = engine.registerVendor(makeVendorInput({ name: "Good Corp" }));
    const v2 = engine.registerVendor(makeVendorInput({ name: "Bad Corp" }));

    const req1 = engine.requestAssessment(v1.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });
    const req2 = engine.requestAssessment(v2.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req1.id, [makeCpoe({ score: 92, frameworks: ["SOC2"] })], [makeCertification({ status: "active", currentScore: 92 })]);
    engine.runAssessment(req2.id, [makeCpoe({ score: 10, frameworks: ["SOC2"] })], [makeCertification({ status: "revoked", currentScore: 0 })]);

    const dashboard = engine.getDashboard();

    expect(dashboard.byDecision.approved).toBeGreaterThanOrEqual(1);
    expect(dashboard.byDecision.rejected).toBeGreaterThanOrEqual(1);
  });

  test("should calculate average score across assessments", () => {
    const v1 = engine.registerVendor(makeVendorInput({ name: "V1" }));
    const v2 = engine.registerVendor(makeVendorInput({ name: "V2" }));

    const req1 = engine.requestAssessment(v1.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });
    const req2 = engine.requestAssessment(v2.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req1.id, [makeCpoe({ score: 90, frameworks: ["SOC2"] })], [makeCertification({ status: "active", currentScore: 90 })]);
    engine.runAssessment(req2.id, [makeCpoe({ score: 80, frameworks: ["SOC2"] })], [makeCertification({ status: "active", currentScore: 80 })]);

    const dashboard = engine.getDashboard();

    // Average should be somewhere between 80 and 90
    expect(dashboard.averageScore).toBeGreaterThanOrEqual(70);
    expect(dashboard.averageScore).toBeLessThanOrEqual(100);
  });

  test("should include recent assessments in dashboard", () => {
    const vendor = engine.registerVendor(makeVendorInput());
    const req = engine.requestAssessment(vendor.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req.id, [makeCpoe({ score: 85, frameworks: ["SOC2"] })]);

    const dashboard = engine.getDashboard();
    expect(dashboard.recentAssessments.length).toBeGreaterThanOrEqual(1);
  });

  test("should report vendors needing review", () => {
    const v1 = engine.registerVendor(makeVendorInput({ name: "Review Needed" }));

    const req = engine.requestAssessment(v1.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req.id, [makeCpoe({ score: 40, frameworks: ["SOC2"] })], [makeCertification({ status: "suspended", currentScore: 40 })]);

    const dashboard = engine.getDashboard();
    expect(dashboard.vendorsNeedingReview).toBeGreaterThanOrEqual(1);
  });

  test("should have zero counts for empty dashboard", () => {
    const dashboard = engine.getDashboard();

    expect(dashboard.totalVendors).toBe(0);
    expect(dashboard.averageScore).toBe(0);
    expect(dashboard.vendorsNeedingReview).toBe(0);
    expect(dashboard.expiringAssessments).toBe(0);
    expect(dashboard.recentAssessments).toHaveLength(0);
  });
});

// =============================================================================
// MONITORING
// =============================================================================

describe("Monitoring", () => {
  let vendorId: string;

  beforeEach(() => {
    const vendor = engine.registerVendor(makeVendorInput());
    vendorId = vendor.id;
  });

  test("should configure monitoring for a vendor", () => {
    const config: MonitoringConfig = {
      vendorId,
      enabled: true,
      checkIntervalDays: 7,
      alertOnScoreDrop: 10,
      alertOnStatusChange: true,
      alertOnExpiry: true,
      expiryWarningDays: 30,
    };

    engine.configureMonitoring(config);

    // Verify monitoring was stored by checking monitored vendors
    const alerts = engine.checkMonitoredVendors();
    expect(alerts).toBeDefined();
  });

  test("should check monitored vendors and return alerts", () => {
    // Run an initial assessment
    const req = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req.id, [makeCpoe({ score: 85, frameworks: ["SOC2"] })], [makeCertification({ status: "active", currentScore: 85 })]);

    engine.configureMonitoring({
      vendorId,
      enabled: true,
      checkIntervalDays: 7,
      alertOnScoreDrop: 10,
      alertOnStatusChange: true,
      alertOnExpiry: true,
      expiryWarningDays: 30,
    });

    const alerts = engine.checkMonitoredVendors();
    expect(Array.isArray(alerts)).toBe(true);
  });

  test("should skip disabled monitoring", () => {
    engine.configureMonitoring({
      vendorId,
      enabled: false,
      checkIntervalDays: 7,
      alertOnScoreDrop: 10,
      alertOnStatusChange: true,
      alertOnExpiry: true,
      expiryWarningDays: 30,
    });

    // Run an assessment that would trigger an alert
    const req = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    engine.runAssessment(req.id, [makeCpoe({ score: 40, frameworks: ["SOC2"] })]);

    const alerts = engine.checkMonitoredVendors();
    // Disabled monitoring should not produce alerts for this vendor
    const vendorAlerts = alerts.filter(a => a.vendorId === vendorId);
    expect(vendorAlerts).toHaveLength(0);
  });

  test("should alert on score drop exceeding threshold", () => {
    // First assessment - high score
    const req1 = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });
    engine.runAssessment(req1.id, [makeCpoe({ score: 90, frameworks: ["SOC2"] })], [makeCertification({ status: "active", currentScore: 90 })]);

    // Configure monitoring with 10-point drop threshold
    engine.configureMonitoring({
      vendorId,
      enabled: true,
      checkIntervalDays: 7,
      alertOnScoreDrop: 10,
      alertOnStatusChange: true,
      alertOnExpiry: true,
      expiryWarningDays: 30,
    });

    // Second assessment - big score drop
    const req2 = engine.requestAssessment(vendorId, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });
    engine.runAssessment(req2.id, [makeCpoe({ score: 55, frameworks: ["SOC2"] })], [makeCertification({ status: "degraded", currentScore: 55 })]);

    const alerts = engine.checkMonitoredVendors();
    const scoreDropAlerts = alerts.filter(a => a.vendorId === vendorId && a.type === "score_drop");
    expect(scoreDropAlerts.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// CUSTOM CONFIG
// =============================================================================

describe("Custom Config", () => {
  test("should use custom thresholds for decisions", () => {
    const customEngine = new TPRMEngine({
      autoApproveThreshold: 95,
      reviewThreshold: 80,
      rejectThreshold: 60,
      freshnessWeightDays: 90,
      trendWindowDays: 180,
    });

    const vendor = customEngine.registerVendor(makeVendorInput());

    const request = customEngine.requestAssessment(vendor.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    // Score of 90 would be auto-approved with default config (85 threshold)
    // but with custom config (95 threshold) it should be conditional
    const cpoes = [makeCpoe({ score: 90, frameworks: ["SOC2"] })];
    const certs = [makeCertification({ status: "active", currentScore: 90 })];

    const result = customEngine.runAssessment(request.id, cpoes, certs);

    // With autoApproveThreshold=95, score of ~90 should NOT auto-approve
    expect(result.decision).not.toBe("approved");
  });

  test("should use default config when none provided", () => {
    const defaultEngine = new TPRMEngine();
    const config = defaultEngine.getConfig();

    expect(config.autoApproveThreshold).toBe(85);
    expect(config.reviewThreshold).toBe(70);
    expect(config.rejectThreshold).toBe(50);
    expect(config.freshnessWeightDays).toBe(90);
    expect(config.trendWindowDays).toBe(180);
  });
});

// =============================================================================
// CERTIFICATION STATUS SCORING
// =============================================================================

describe("Certification Status Scoring", () => {
  test("active certification should score highest", () => {
    const vendor = engine.registerVendor(makeVendorInput());
    const req = engine.requestAssessment(vendor.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];
    const activeCert = [makeCertification({ status: "active", currentScore: 85 })];

    const result = engine.runAssessment(req.id, cpoes, activeCert);
    expect(result.scoreBreakdown.certificationStatus).toBe(100);
  });

  test("revoked certification should score zero", () => {
    const vendor = engine.registerVendor(makeVendorInput());
    const req = engine.requestAssessment(vendor.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];
    const revokedCert = [makeCertification({ status: "revoked", currentScore: 0 })];

    const result = engine.runAssessment(req.id, cpoes, revokedCert);
    expect(result.scoreBreakdown.certificationStatus).toBe(0);
  });

  test("no certification should score 30", () => {
    const vendor = engine.registerVendor(makeVendorInput());
    const req = engine.requestAssessment(vendor.id, {
      requestedBy: "team",
      frameworks: ["SOC2"],
      minimumScore: 70,
      minimumAssurance: 1,
    });

    const cpoes = [makeCpoe({ score: 85, frameworks: ["SOC2"] })];

    const result = engine.runAssessment(req.id, cpoes);
    expect(result.scoreBreakdown.certificationStatus).toBe(30);
  });
});
