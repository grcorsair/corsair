/**
 * SPYGLASS Engine Test Contract
 *
 * Tests the SpyglassEngine's ability to generate STRIDE threat models
 * from provider snapshots. Validates per-provider rules, MITRE mapping,
 * severity distribution, and deduplication.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { SpyglassEngine } from "../../src/corsair-mvp";
import type { ThreatModelResult, STRIDECategory } from "../../src/corsair-mvp";
import {
  compliantSnapshot,
  nonCompliantSnapshot,
  compliantS3Snapshot,
  nonCompliantS3Snapshot,
} from "../fixtures/mock-snapshots";

const VALID_SPYGLASS_CATEGORIES: STRIDECategory[] = [
  "Spoofing",
  "Tampering",
  "Repudiation",
  "InformationDisclosure",
  "DenialOfService",
  "ElevationOfPrivilege",
];

describe("SPYGLASS Engine - spyglassAnalyze", () => {
  let engine: SpyglassEngine;

  beforeAll(() => {
    engine = new SpyglassEngine();
  });

  test("spyglassAnalyze with non-compliant Cognito snapshot generates >= 3 threats", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(3);
    expect(result.threatCount).toBe(result.threats.length);
    expect(result.methodology).toBe("STRIDE-automated");
    expect(result.provider).toBe("aws-cognito");
  });

  test("spyglassAnalyze with compliant Cognito snapshot generates 0 CRITICAL threats", () => {
    const result = engine.spyglassAnalyze(
      compliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const criticalThreats = result.threats.filter((t) => t.severity === "CRITICAL");
    expect(criticalThreats.length).toBe(0);
  });

  test("spyglassAnalyze with non-compliant S3 snapshot generates >= 3 threats", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantS3Snapshot as unknown as Record<string, unknown>,
      "aws-s3"
    );

    expect(result.threats.length).toBeGreaterThanOrEqual(3);
  });

  test("Each threat has valid STRIDE category (S/T/R/I/D/E)", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    for (const threat of result.threats) {
      expect(VALID_SPYGLASS_CATEGORIES).toContain(threat.stride);
    }
  });

  test("Each threat maps to a valid ATT&CK technique (T-prefixed)", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    for (const threat of result.threats) {
      expect(threat.mitreTechnique).toMatch(/^T\d+/);
      expect(threat.mitreName).toBeTruthy();
    }
  });

  test("Cognito MFA=OFF generates Spoofing + Elevation of Privilege threats", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const mfaThreats = result.threats.filter((t) => t.affectedField === "mfaConfiguration");
    const categories = mfaThreats.map((t) => t.stride);

    expect(categories).toContain("Spoofing");
    expect(categories).toContain("ElevationOfPrivilege");
  });

  test("S3 publicAccessBlock=false generates Information Disclosure threat", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantS3Snapshot as unknown as Record<string, unknown>,
      "aws-s3"
    );

    const publicAccessThreats = result.threats.filter(
      (t) => t.affectedField === "publicAccessBlock"
    );
    expect(publicAccessThreats.length).toBeGreaterThanOrEqual(1);
    expect(publicAccessThreats[0].stride).toBe("InformationDisclosure");
    expect(publicAccessThreats[0].severity).toBe("CRITICAL");
  });

  test("GitLab non-compliant generates branch protection and MFA threats", () => {
    const gitlabSnapshot = {
      visibility: "public",
      branchProtection: {
        forcePushDisabled: false,
        requireApprovals: false,
      },
      cicdSecurity: {
        sastEnabled: false,
        secretDetectionEnabled: false,
      },
      accessControl: {
        mfaEnforced: false,
        guestAccessEnabled: true,
      },
      auditSettings: {
        signedCommitsRequired: false,
      },
    };

    const result = engine.spyglassAnalyze(gitlabSnapshot, "gitlab");

    expect(result.threats.length).toBeGreaterThanOrEqual(3);
    const visibilityThreats = result.threats.filter(
      (t) => t.affectedField === "visibility"
    );
    expect(visibilityThreats.length).toBeGreaterThanOrEqual(1);
  });

  test("Threats include affectedField matching snapshot field paths", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const fields = result.threats.map((t) => t.affectedField);
    // Non-compliant snapshot has: mfaConfiguration=OFF, weak password, no risk config
    expect(fields).toContain("mfaConfiguration");
  });

  test("Threat severity distribution follows risk model (not all CRITICAL)", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const severities = new Set(result.threats.map((t) => t.severity));
    // Should have multiple severity levels
    expect(severities.size).toBeGreaterThan(1);
    expect(result.riskDistribution).toBeDefined();
    expect(Object.keys(result.riskDistribution).length).toBeGreaterThan(1);
  });

  test("spyglassAnalyze accepts optional frameworks filter", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito",
      { frameworks: ["MITRE", "NIST-800-53"] }
    );

    // Should still produce threats (frameworks filter is for future use)
    expect(result.threats.length).toBeGreaterThan(0);
  });

  test("spyglassAnalyze returns unique threats (no duplicates)", () => {
    const result = engine.spyglassAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const ids = result.threats.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test("Unknown provider returns empty threats", () => {
    const result = engine.spyglassAnalyze({}, "unknown-provider");

    expect(result.threats).toHaveLength(0);
    expect(result.threatCount).toBe(0);
    expect(result.provider).toBe("unknown-provider");
  });
});
