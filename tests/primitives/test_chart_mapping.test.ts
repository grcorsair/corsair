/**
 * CHART Primitive Test Contract
 *
 * CHART maps attack findings to compliance frameworks.
 * MITRE ATT&CK -> NIST CSF -> SOC2 CC
 *
 * Contract Requirements:
 * 1. CHART MUST map findings to MITRE ATT&CK techniques
 * 2. CHART MUST map MITRE to NIST CSF functions
 * 3. CHART MUST map NIST to SOC2 Common Criteria
 * 4. CHART MUST return ComplianceMapping with chain
 * 5. CHART MUST support multiple framework outputs
 * 6. CHART MUST include evidence references
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Corsair, ComplianceMapping, DriftFinding, RaidResult } from "../../src/corsair-mvp";
import { nonCompliantSnapshot } from "../fixtures/mock-snapshots";

describe("CHART Primitive - Framework Mapping", () => {
  let corsair: Corsair;

  beforeAll(() => {
    corsair = new Corsair();
  });

  test("CHART maps MFA drift to MITRE ATT&CK", async () => {
    const result = await corsair.mark(nonCompliantSnapshot, [
      { field: "mfaConfiguration", operator: "eq", value: "ON" },
    ]);

    const chartResult = await corsair.chart(result.findings);

    expect(chartResult).toBeDefined();
    expect(chartResult.mitre).toBeDefined();
    expect(chartResult.mitre.technique).toBeDefined();
    expect(chartResult.mitre.technique).toMatch(/T1078|T1556|T1110/);
    expect(chartResult.mitre.name).toBeDefined();
    expect(chartResult.mitre.tactic).toBeDefined();
  });

  test("CHART maps MITRE to NIST CSF", async () => {
    const result = await corsair.mark(nonCompliantSnapshot, [
      { field: "mfaConfiguration", operator: "eq", value: "ON" },
    ]);

    const chartResult = await corsair.chart(result.findings);

    expect(chartResult.nist).toBeDefined();
    expect(chartResult.nist.function).toBeDefined();
    expect(chartResult.nist.category).toBeDefined();
    expect(chartResult.nist.controls).toBeDefined();
    expect(Array.isArray(chartResult.nist.controls)).toBe(true);
    expect(chartResult.nist.controls.length).toBeGreaterThan(0);
    // Should have PR.AC or similar controls
    expect(chartResult.nist.controls.some((c) => c.startsWith("PR."))).toBe(true);
  });

  test("CHART maps NIST to SOC2 CC", async () => {
    const result = await corsair.mark(nonCompliantSnapshot, [
      { field: "mfaConfiguration", operator: "eq", value: "ON" },
    ]);

    const chartResult = await corsair.chart(result.findings);

    expect(chartResult.soc2).toBeDefined();
    expect(chartResult.soc2.principle).toBeDefined();
    expect(chartResult.soc2.criteria).toBeDefined();
    expect(Array.isArray(chartResult.soc2.criteria)).toBe(true);
    expect(chartResult.soc2.criteria.length).toBeGreaterThan(0);
    // Should have CC6.x controls for access security
    expect(chartResult.soc2.criteria.some((c) => c.startsWith("CC6"))).toBe(true);
  });

  test("CHART returns ChartResult with all frameworks", async () => {
    const result = await corsair.mark(nonCompliantSnapshot, [
      { field: "mfaConfiguration", operator: "eq", value: "ON" },
    ]);

    const chartResult = await corsair.chart(result.findings);

    // Verify all three framework sections exist
    expect(chartResult).toHaveProperty("mitre");
    expect(chartResult).toHaveProperty("nist");
    expect(chartResult).toHaveProperty("soc2");

    // Verify MITRE structure
    expect(chartResult.mitre).toHaveProperty("technique");
    expect(chartResult.mitre).toHaveProperty("name");
    expect(chartResult.mitre).toHaveProperty("tactic");
    expect(chartResult.mitre).toHaveProperty("description");

    // Verify NIST structure
    expect(chartResult.nist).toHaveProperty("function");
    expect(chartResult.nist).toHaveProperty("category");
    expect(chartResult.nist).toHaveProperty("controls");

    // Verify SOC2 structure
    expect(chartResult.soc2).toHaveProperty("principle");
    expect(chartResult.soc2).toHaveProperty("criteria");
    expect(chartResult.soc2).toHaveProperty("description");
  });

  test("CHART maps password policy drift correctly", async () => {
    const result = await corsair.mark(nonCompliantSnapshot, [
      { field: "passwordPolicy.minimumLength", operator: "gte", value: 12 },
    ]);

    const chartResult = await corsair.chart(result.findings);

    // Password policy should map to access/credential-related controls
    expect(chartResult.soc2.criteria.some((c) => c.includes("CC6"))).toBe(true);
    expect(chartResult.soc2.description.toLowerCase()).toMatch(/access|credential/);
  });
});
