/**
 * MARQUE-OSCAL Mapper Tests
 *
 * Tests conversion from MarqueDocument to OSCALAssessmentResult.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { mapToOSCAL } from "../../src/parley/marque-oscal-mapper";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { MarqueGenerator } from "../../src/parley/marque-generator";
import type { MarqueDocument } from "../../src/parley/marque-types";
import type { ChartResult } from "../../src/types";

const TEST_DIR = "/tmp/marque-oscal-mapper-test";
let testMarque: MarqueDocument;

async function createTestMarque(): Promise<MarqueDocument> {
  const keyDir = `${TEST_DIR}/keys`;
  if (!existsSync(keyDir)) mkdirSync(keyDir, { recursive: true });

  const keyManager = new MarqueKeyManager(keyDir);
  await keyManager.generateKeypair();
  const generator = new MarqueGenerator(keyManager);

  const chartResult: ChartResult = {
    mitre: { technique: "T1556", name: "MFA Bypass", tactic: "Credential Access", description: "Test" },
    nist: { function: "PROTECT", category: "Access Control", controls: ["AC-2"] },
    soc2: { principle: "Security", criteria: ["CC6.1"], description: "Test" },
    frameworks: {
      "NIST-800-53": {
        controls: [
          { controlId: "AC-2", status: "passed" as any, description: "Account Mgmt" },
          { controlId: "AC-7", status: "failed" as any, description: "Unsuccessful Login" },
        ],
      },
      "SOC2": {
        controls: [
          { controlId: "CC6.1", status: "passed" as any, description: "Logical Access" },
        ],
      },
    },
  };

  return generator.generate({
    markResults: [{
      findings: [
        { field: "mfaConfiguration", expected: "ON", actual: "OFF", drift: true, severity: "CRITICAL" as any, timestamp: new Date().toISOString() },
      ],
      driftDetected: true,
      checkedAt: new Date().toISOString(),
    }],
    raidResults: [],
    chartResults: [chartResult],
    evidencePaths: [],
    issuer: { id: "test-issuer", name: "Test Issuer", organization: "Test Org" },
    providers: ["aws-cognito"],
    threatModel: {
      threats: [],
      methodology: "STRIDE-automated",
      provider: "aws-cognito",
      analyzedAt: new Date().toISOString(),
      threatCount: 3,
      riskDistribution: { CRITICAL: 1, HIGH: 1, MEDIUM: 1 },
    },
  });
}

beforeAll(async () => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  testMarque = await createTestMarque();
});

afterAll(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("MARQUE-OSCAL Mapper", () => {
  test("mapToOSCAL converts MarqueDocument to OSCALAssessmentResult", () => {
    const oscal = mapToOSCAL(testMarque);

    expect(oscal["assessment-results"]).toBeDefined();
    expect(oscal["assessment-results"].uuid).toBeDefined();
    expect(oscal["assessment-results"].metadata).toBeDefined();
    expect(oscal["assessment-results"].results).toHaveLength(1);
  });

  test("MARQUE frameworks map to OSCAL reviewed controls", () => {
    const oscal = mapToOSCAL(testMarque);
    const result = oscal["assessment-results"].results[0];

    expect(result["reviewed-controls"]).toBeDefined();
    const controlSelections = result["reviewed-controls"]["control-selections"];
    expect(controlSelections.length).toBeGreaterThanOrEqual(1);

    // Should have frameworks from the MARQUE
    const frameworkNames = controlSelections.flatMap((cs) =>
      cs.props?.map((p) => p.value) || []
    );
    expect(frameworkNames.some((f) => f.includes("NIST") || f.includes("SOC2"))).toBe(true);
  });

  test("MARQUE evidence chain maps to OSCAL observations", () => {
    const oscal = mapToOSCAL(testMarque);
    const result = oscal["assessment-results"].results[0];

    expect(result.observations.length).toBeGreaterThanOrEqual(1);

    // Should have evidence chain observation
    const chainObs = result.observations.find((o) =>
      o.title.includes("Evidence Chain")
    );
    expect(chainObs).toBeDefined();
  });

  test("MARQUE summary maps to OSCAL result metadata", () => {
    const oscal = mapToOSCAL(testMarque);
    const result = oscal["assessment-results"].results[0];

    expect(result.title).toContain("MARQUE Assessment");
    expect(result.description).toContain("MARQUE");
    expect(result.start).toBeDefined();
    expect(result.end).toBeDefined();
  });

  test("Round-trip: Corsair results to MARQUE to OSCAL preserves key data", () => {
    const oscal = mapToOSCAL(testMarque);
    const result = oscal["assessment-results"].results[0];

    // Controls should be present
    expect(result.findings.length).toBeGreaterThanOrEqual(1);

    // Summary observation should exist
    const summaryObs = result.observations.find((o) =>
      o.title.includes("Summary")
    );
    expect(summaryObs).toBeDefined();

    // Threat model observation should exist (since we included one)
    const threatObs = result.observations.find((o) =>
      o.title.includes("Threat Model")
    );
    expect(threatObs).toBeDefined();
  });
});
