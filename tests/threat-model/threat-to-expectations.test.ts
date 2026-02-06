/**
 * Threat-to-Expectations Conversion Test Contract
 *
 * Tests the StrideEngine's ability to convert STRIDE threats
 * back into MARK expectations for drift detection.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { StrideEngine } from "../../src/corsair-mvp";
import type { ThreatFinding } from "../../src/corsair-mvp";
import {
  nonCompliantSnapshot,
  nonCompliantS3Snapshot,
} from "../fixtures/mock-snapshots";

describe("STRIDE Engine - threatToExpectations", () => {
  let engine: StrideEngine;

  beforeAll(() => {
    engine = new StrideEngine();
  });

  test("threatToExpectations converts Spoofing/MFA threat to mfaConfiguration eq ON expectation", () => {
    const threats: ThreatFinding[] = [
      {
        id: "THREAT-cognito-1",
        stride: "Spoofing",
        description: "MFA disabled",
        mitreTechnique: "T1556",
        mitreName: "Modify Authentication Process",
        affectedField: "mfaConfiguration",
        severity: "CRITICAL",
        attackVectors: ["mfa-bypass"],
      },
    ];

    const expectations = engine.threatToExpectations(threats);
    const mfaExpectation = expectations.find((e) => e.field === "mfaConfiguration");

    expect(mfaExpectation).toBeDefined();
    expect(mfaExpectation?.operator).toBe("eq");
    expect(mfaExpectation?.value).toBe("ON");
  });

  test("threatToExpectations converts Info Disclosure/S3 threat to publicAccessBlock eq true", () => {
    const threats: ThreatFinding[] = [
      {
        id: "THREAT-s3-1",
        stride: "InformationDisclosure",
        description: "Public access",
        mitreTechnique: "T1530",
        mitreName: "Data from Cloud Storage",
        affectedField: "publicAccessBlock",
        severity: "CRITICAL",
        attackVectors: ["public-access-test"],
      },
    ];

    const expectations = engine.threatToExpectations(threats);
    const pubExpectation = expectations.find((e) => e.field === "publicAccessBlock");

    expect(pubExpectation).toBeDefined();
    expect(pubExpectation?.operator).toBe("eq");
    expect(pubExpectation?.value).toBe(true);
  });

  test("Multiple threats generate deduplicated expectations", () => {
    // Two threats affecting the same field should produce only one expectation
    const threats: ThreatFinding[] = [
      {
        id: "THREAT-cognito-1",
        stride: "Spoofing",
        description: "MFA disabled",
        mitreTechnique: "T1556",
        mitreName: "Modify Authentication Process",
        affectedField: "mfaConfiguration",
        severity: "CRITICAL",
        attackVectors: ["mfa-bypass"],
      },
      {
        id: "THREAT-cognito-2",
        stride: "ElevationOfPrivilege",
        description: "No MFA privilege escalation",
        mitreTechnique: "T1548",
        mitreName: "Abuse Elevation Control Mechanism",
        affectedField: "mfaConfiguration",
        severity: "CRITICAL",
        attackVectors: ["mfa-bypass"],
      },
    ];

    const expectations = engine.threatToExpectations(threats);
    const mfaExpectations = expectations.filter((e) => e.field === "mfaConfiguration");
    expect(mfaExpectations).toHaveLength(1); // deduplicated
  });

  test("Expectations preserve threat context (threatRef field)", () => {
    const threats: ThreatFinding[] = [
      {
        id: "THREAT-cognito-1",
        stride: "Spoofing",
        description: "MFA disabled",
        mitreTechnique: "T1556",
        mitreName: "Modify Authentication Process",
        affectedField: "mfaConfiguration",
        severity: "CRITICAL",
        attackVectors: ["mfa-bypass"],
      },
    ];

    const expectations = engine.threatToExpectations(threats);
    expect(expectations[0].threatRef).toBe("THREAT-cognito-1");
  });

  test("Empty threats array returns empty expectations", () => {
    const expectations = engine.threatToExpectations([]);
    expect(expectations).toHaveLength(0);
  });

  test("threatToExpectations for Cognito covers all 5 drift fields", () => {
    // Run full analysis to get all threats, then convert
    const result = engine.strideAnalyze(
      nonCompliantSnapshot as unknown as Record<string, unknown>,
      "aws-cognito"
    );

    const expectations = engine.threatToExpectations(result.threats);
    const fields = expectations.map((e) => e.field);

    // Non-compliant Cognito should produce expectations for these fields:
    expect(fields).toContain("mfaConfiguration");
    expect(fields).toContain("passwordPolicy.minimumLength");
    expect(fields).toContain("riskConfiguration");
    expect(fields).toContain("softwareTokenMfaEnabled");
    expect(fields).toContain("deviceConfiguration.challengeRequiredOnNewDevice");
  });

  test("threatToExpectations for S3 covers all 4 drift fields", () => {
    const result = engine.strideAnalyze(
      nonCompliantS3Snapshot as unknown as Record<string, unknown>,
      "aws-s3"
    );

    const expectations = engine.threatToExpectations(result.threats);
    const fields = expectations.map((e) => e.field);

    expect(fields).toContain("publicAccessBlock");
    expect(fields).toContain("encryption");
    expect(fields).toContain("versioning");
    expect(fields).toContain("logging");
  });
});
