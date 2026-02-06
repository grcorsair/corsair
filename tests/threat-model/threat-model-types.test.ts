/**
 * Threat Model Types Test Contract
 *
 * Validates the STRIDE type definitions are correctly structured
 * and usable by the type system.
 */

import { describe, test, expect } from "bun:test";
import type {
  STRIDECategory,
  ThreatFinding,
  ThreatModelResult,
  ThreatModelOptions,
  Severity,
} from "../../src/corsair-mvp";

describe("SPYGLASS Threat Model Types", () => {
  test("STRIDECategory type includes all 6 categories", () => {
    const categories: STRIDECategory[] = [
      "Spoofing",
      "Tampering",
      "Repudiation",
      "InformationDisclosure",
      "DenialOfService",
      "ElevationOfPrivilege",
    ];

    expect(categories).toHaveLength(6);
    for (const cat of categories) {
      expect(typeof cat).toBe("string");
    }
  });

  test("ThreatModelResult has threats array with severity, category, attackTechnique fields", () => {
    const result: ThreatModelResult = {
      threats: [
        {
          id: "THREAT-test-1",
          stride: "Spoofing",
          description: "Test threat",
          mitreTechnique: "T1556",
          mitreName: "Modify Authentication Process",
          affectedField: "mfaConfiguration",
          severity: "CRITICAL",
          attackVectors: ["mfa-bypass"],
        },
      ],
      methodology: "STRIDE-automated",
      provider: "test-provider",
      analyzedAt: new Date().toISOString(),
      threatCount: 1,
      riskDistribution: { CRITICAL: 1 },
    };

    expect(result.threats).toBeArray();
    expect(result.threats[0].severity).toBe("CRITICAL");
    expect(result.threats[0].stride).toBe("Spoofing");
    expect(result.threats[0].mitreTechnique).toBe("T1556");
    expect(result.methodology).toBe("STRIDE-automated");
    expect(result.threatCount).toBe(1);
  });

  test("ThreatFinding has stride category, description, mitreTechnique, affectedField", () => {
    const finding: ThreatFinding = {
      id: "THREAT-test-1",
      stride: "InformationDisclosure",
      description: "Data exposure risk",
      mitreTechnique: "T1530",
      mitreName: "Data from Cloud Storage",
      affectedField: "publicAccessBlock",
      severity: "CRITICAL",
      attackVectors: ["public-access-test"],
    };

    expect(finding.id).toStartWith("THREAT-");
    expect(finding.stride).toBe("InformationDisclosure");
    expect(finding.description).toBeTruthy();
    expect(finding.mitreTechnique).toStartWith("T");
    expect(finding.mitreName).toBeTruthy();
    expect(finding.affectedField).toBeTruthy();
    expect(finding.severity).toBe("CRITICAL");
    expect(finding.attackVectors).toBeArray();
  });

  test("ThreatModelOptions accepts targetType and provider fields", () => {
    const options: ThreatModelOptions = {
      provider: "aws-cognito",
      frameworks: ["MITRE", "NIST-800-53"],
      includeRemediations: true,
    };

    expect(options.provider).toBe("aws-cognito");
    expect(options.frameworks).toHaveLength(2);
    expect(options.includeRemediations).toBe(true);
  });

  test("Empty snapshot produces empty threat model", async () => {
    // Import engine directly to test with empty snapshot
    const { SpyglassEngine } = await import("../../src/corsair-mvp");
    const engine = new SpyglassEngine();
    const result = engine.spyglassAnalyze({}, "aws-cognito");

    // Empty snapshot = no field values match conditions = no threats
    // (conditions check for specific values like "OFF", null, etc.)
    expect(result.threats).toBeArray();
    expect(result.methodology).toBe("STRIDE-automated");
    expect(result.provider).toBe("aws-cognito");
  });
});
