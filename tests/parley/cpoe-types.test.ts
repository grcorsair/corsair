/**
 * CPOE Types Test Contract
 *
 * Validates that all CPOE (Corsair Proof of Operational Effectiveness) types
 * are properly defined and can be instantiated with correct field structure.
 *
 * These are pure type validation tests -- create instances and verify fields.
 */

import { describe, test, expect } from "bun:test";
import type {
  CPOEDocument,
  CPOEScope,
  CPOESummary,
  CPOEEvidenceChain,
  CPOEFrameworkResult,
  CPOEAdmiralAttestation,
  CPOEIssuer,
  CPOEThreatModelSummary,
} from "../../src/parley/cpoe-types";

describe("CPOE Types - Proof of Operational Effectiveness", () => {
  test("CPOEDocument has all required fields (parley, cpoe, signature)", () => {
    const doc: CPOEDocument = {
      parley: "1.0",
      cpoe: {
        id: "cpoe-001",
        version: "1.0.0",
        issuer: { id: "issuer-1", name: "Corsair Engine" },
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        scope: { providers: ["aws-cognito"], resourceCount: 3, frameworksCovered: ["SOC2"] },
        summary: { controlsTested: 10, controlsPassed: 8, controlsFailed: 2, overallScore: 80 },
        evidenceChain: { hashChainRoot: "abc123", recordCount: 5, chainVerified: true },
        frameworks: {},
      },
      signature: "sig-placeholder",
    };

    expect(doc.parley).toBe("1.0");
    expect(doc.cpoe.id).toBe("cpoe-001");
    expect(doc.cpoe.version).toBe("1.0.0");
    expect(doc.cpoe.issuer.id).toBe("issuer-1");
    expect(doc.cpoe.generatedAt).toBeDefined();
    expect(doc.cpoe.expiresAt).toBeDefined();
    expect(doc.signature).toBe("sig-placeholder");
  });

  test("CPOEScope has providers, resourceCount, frameworksCovered", () => {
    const scope: CPOEScope = {
      providers: ["aws-cognito", "aws-s3"],
      resourceCount: 12,
      frameworksCovered: ["SOC2", "NIST-800-53", "MITRE-ATT&CK"],
    };

    expect(scope.providers).toHaveLength(2);
    expect(scope.providers).toContain("aws-cognito");
    expect(scope.resourceCount).toBe(12);
    expect(scope.frameworksCovered).toHaveLength(3);
    expect(scope.frameworksCovered).toContain("NIST-800-53");
  });

  test("CPOESummary has controlsTested, controlsPassed, controlsFailed, overallScore", () => {
    const summary: CPOESummary = {
      controlsTested: 25,
      controlsPassed: 20,
      controlsFailed: 5,
      overallScore: 80,
    };

    expect(summary.controlsTested).toBe(25);
    expect(summary.controlsPassed).toBe(20);
    expect(summary.controlsFailed).toBe(5);
    expect(summary.overallScore).toBe(80);
    expect(summary.controlsPassed + summary.controlsFailed).toBe(summary.controlsTested);
  });

  test("CPOEEvidenceChain has hashChainRoot, recordCount, chainVerified", () => {
    const chain: CPOEEvidenceChain = {
      hashChainRoot: "e3b0c44298fc1c149afbf4c8996fb924",
      recordCount: 42,
      chainVerified: true,
    };

    expect(chain.hashChainRoot).toBe("e3b0c44298fc1c149afbf4c8996fb924");
    expect(chain.recordCount).toBe(42);
    expect(chain.chainVerified).toBe(true);
  });

  test("CPOEFrameworkResult has controlsMapped, passed, failed, controls array", () => {
    const result: CPOEFrameworkResult = {
      controlsMapped: 3,
      passed: 2,
      failed: 1,
      controls: [
        { controlId: "AC-2", status: "passed" },
        { controlId: "AC-3", status: "passed" },
        { controlId: "IA-5", status: "failed" },
      ],
    };

    expect(result.controlsMapped).toBe(3);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.controls).toHaveLength(3);
    expect(result.controls[0].controlId).toBe("AC-2");
    expect(result.controls[0].status).toBe("passed");
    expect(result.controls[2].status).toBe("failed");
  });

  test("CPOEAdmiralAttestation has confidenceScore, dimensions, trustTier", () => {
    const attestation: CPOEAdmiralAttestation = {
      confidenceScore: 0.87,
      dimensions: [
        { dimension: "evidence-quality", score: 0.9 },
        { dimension: "coverage-breadth", score: 0.85 },
        { dimension: "temporal-consistency", score: 0.86 },
      ],
      trustTier: "ai-verified",
      evaluatedAt: new Date().toISOString(),
      reportHash: "sha256-abc123def456",
    };

    expect(attestation.confidenceScore).toBe(0.87);
    expect(attestation.dimensions).toHaveLength(3);
    expect(attestation.dimensions[0].dimension).toBe("evidence-quality");
    expect(attestation.dimensions[0].score).toBe(0.9);
    expect(attestation.trustTier).toBe("ai-verified");
    expect(attestation.evaluatedAt).toBeDefined();
    expect(attestation.reportHash).toBe("sha256-abc123def456");
  });
});
