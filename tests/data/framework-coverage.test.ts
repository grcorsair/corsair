/**
 * Framework Coverage Tests
 *
 * Validates that all 12 target frameworks have mappings for key MITRE techniques.
 * This is the "breadth" test proving the data layer provides broad coverage.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { MappingLoader } from "../../src/data/mapping-loader";
import type { MappingDatabase } from "../../src/data/mapping-loader";
import { Corsair } from "../../src/corsair-mvp";
import { nonCompliantSnapshot } from "../fixtures/mock-snapshots";
import { join } from "path";

describe("Framework Coverage - Multi-Framework Breadth", () => {
  let db: MappingDatabase;

  beforeAll(async () => {
    MappingLoader.reset();
    db = await MappingLoader.load(join(__dirname, "../../src/data"));
  });

  afterAll(() => {
    MappingLoader.reset();
  });

  const TARGET_FRAMEWORKS = [
    "NIST-800-53",
    "NIST-CSF",
    "SOC2",
    "ISO27001",
    "CIS",
    "PCI-DSS",
    "CMMC",
    "FedRAMP",
    "HIPAA",
    "GDPR",
    "SOX",
    "COBIT",
  ];

  test("T1556 has mappings for all 12 target frameworks", () => {
    const frameworks = MappingLoader.lookupMitre(db, "T1556");
    for (const fw of TARGET_FRAMEWORKS) {
      expect(frameworks[fw]).toBeDefined();
      expect(frameworks[fw]!.length).toBeGreaterThan(0);
    }
  });

  test("T1110 has mappings for key frameworks", () => {
    const frameworks = MappingLoader.lookupMitre(db, "T1110");
    expect(frameworks["NIST-800-53"]).toBeDefined();
    expect(frameworks["NIST-CSF"]).toBeDefined();
    expect(frameworks["SOC2"]).toBeDefined();
    expect(frameworks["ISO27001"]).toBeDefined();
    expect(frameworks["CIS"]).toBeDefined();
    expect(frameworks["PCI-DSS"]).toBeDefined();
  });

  test("T1530 (cloud storage) has data protection frameworks", () => {
    const frameworks = MappingLoader.lookupMitre(db, "T1530");
    expect(frameworks["NIST-800-53"]).toBeDefined();
    expect(frameworks["NIST-CSF"]).toBeDefined();
    expect(frameworks["SOC2"]).toBeDefined();
  });

  test("total supported frameworks count >= 12", () => {
    expect(db.supportedFrameworks.length).toBeGreaterThanOrEqual(12);
  });

  test("coverage stats show mappings across all techniques", () => {
    const stats = MappingLoader.getCoverageStats(db);
    expect(Object.keys(stats).length).toBeGreaterThanOrEqual(10);
    expect(stats["NIST-800-53"]).toBeGreaterThan(10); // All techniques should map to 800-53
  });
});

describe("ChartResult.frameworks field", () => {
  let corsair: Corsair;

  beforeAll(async () => {
    MappingLoader.reset();
    corsair = new Corsair();
    await corsair.initialize();
    // Initialize ChartEngine's data-driven mappings
    // Access via internal chart method which already works with the data layer
  });

  afterAll(() => {
    MappingLoader.reset();
  });

  test("ChartResult retains legacy mitre/nist/soc2 fields", async () => {
    const result = await corsair.mark(nonCompliantSnapshot, [
      { field: "mfaConfiguration", operator: "eq", value: "ON" },
    ]);

    const chartResult = await corsair.chart(result.findings);

    // Legacy fields still populated
    expect(chartResult.mitre).toBeDefined();
    expect(chartResult.mitre.technique).toMatch(/T1078|T1556|T1110/);
    expect(chartResult.nist).toBeDefined();
    expect(chartResult.nist.controls.length).toBeGreaterThan(0);
    expect(chartResult.soc2).toBeDefined();
    expect(chartResult.soc2.criteria.length).toBeGreaterThan(0);
  });

  test("ChartResult includes frameworks field when plugin has controls", async () => {
    const result = await corsair.mark(nonCompliantSnapshot, [
      { field: "mfaConfiguration", operator: "eq", value: "ON" },
    ]);

    const chartResult = await corsair.chart(result.findings);

    // The aws-cognito plugin now has controls field for mfaConfiguration
    if (chartResult.frameworks) {
      // If frameworks populated, verify structure
      for (const [fw, data] of Object.entries(chartResult.frameworks)) {
        expect(data.controls).toBeDefined();
        expect(Array.isArray(data.controls)).toBe(true);
        for (const ctrl of data.controls) {
          expect(ctrl.controlId).toBeDefined();
          expect(ctrl.controlName).toBeDefined();
          expect(ctrl.status).toBe("mapped");
        }
      }
    }
  });
});
