/**
 * MARQUE Types Test Contract
 *
 * Validates that all MARQUE (Corsair Proof of Operational Effectiveness) types
 * are properly defined and can be instantiated with correct field structure.
 *
 * These are pure type validation tests -- create instances and verify fields.
 */

import { describe, test, expect } from "bun:test";
import type {
  MarqueDocument,
  MarqueScope,
  MarqueSummary,
  MarqueEvidenceChain,
  MarqueFrameworkResult,
  MarqueQuartermasterAttestation,
  MarqueIssuer,
  MarqueThreatModelSummary,
} from "../../src/parley/marque-types";

describe("MARQUE Types - Proof of Operational Effectiveness", () => {
  test("MarqueDocument has all required fields (parley, marque, signature)", () => {
    const doc: MarqueDocument = {
      parley: "1.0",
      marque: {
        id: "marque-001",
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
    expect(doc.marque.id).toBe("marque-001");
    expect(doc.marque.version).toBe("1.0.0");
    expect(doc.marque.issuer.id).toBe("issuer-1");
    expect(doc.marque.generatedAt).toBeDefined();
    expect(doc.marque.expiresAt).toBeDefined();
    expect(doc.signature).toBe("sig-placeholder");
  });

  test("MarqueScope has providers, resourceCount, frameworksCovered", () => {
    const scope: MarqueScope = {
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

  test("MarqueSummary has controlsTested, controlsPassed, controlsFailed, overallScore", () => {
    const summary: MarqueSummary = {
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

  test("MarqueEvidenceChain has hashChainRoot, recordCount, chainVerified", () => {
    const chain: MarqueEvidenceChain = {
      hashChainRoot: "e3b0c44298fc1c149afbf4c8996fb924",
      recordCount: 42,
      chainVerified: true,
    };

    expect(chain.hashChainRoot).toBe("e3b0c44298fc1c149afbf4c8996fb924");
    expect(chain.recordCount).toBe(42);
    expect(chain.chainVerified).toBe(true);
  });

  test("MarqueFrameworkResult has controlsMapped, passed, failed, controls array", () => {
    const result: MarqueFrameworkResult = {
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

  test("MarqueQuartermasterAttestation has confidenceScore, dimensions, trustTier", () => {
    const attestation: MarqueQuartermasterAttestation = {
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
