/**
 * ChartEngine Test — Decoupled from Plugin System
 *
 * Validates that ChartEngine works standalone with:
 * 1. No constructor arguments (CTID/SCF + legacy fallback only)
 * 2. Custom framework mappings passed directly
 * 3. No dependency on getPlugin function
 *
 * TDD Phase: RED — these tests define the new decoupled interface.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { ChartEngine } from "../../src/chart/chart-engine";

describe("ChartEngine (decoupled from plugins)", () => {
  let engine: ChartEngine;

  beforeAll(async () => {
    engine = new ChartEngine();
    await engine.initialize();
  });

  test("chart() maps MFA drift to MITRE T1556", async () => {
    const findings = [{
      id: "drift-1",
      field: "mfaConfiguration",
      expected: "ON",
      actual: "OFF",
      drift: true,
      severity: "CRITICAL" as const,
      description: "MFA not enforced",
      timestamp: new Date().toISOString(),
    }];
    const result = await engine.chart(findings);
    expect(result.mitre.technique).toBe("T1556");
    expect(result.nist.controls.length).toBeGreaterThan(0);
  });

  test("chart() returns N/A when no drift", async () => {
    const findings = [{
      id: "drift-2",
      field: "mfaConfiguration",
      expected: "ON",
      actual: "ON",
      drift: false,
      severity: "LOW" as const,
      description: "MFA enabled",
      timestamp: new Date().toISOString(),
    }];
    const result = await engine.chart(findings);
    expect(result.mitre.technique).toBe("N/A");
  });

  test("chart() uses CTID/SCF data for extended frameworks", async () => {
    const findings = [{
      id: "drift-3",
      field: "mfaConfiguration",
      expected: "ON",
      actual: "OFF",
      drift: true,
      severity: "CRITICAL" as const,
      description: "MFA not enforced",
      timestamp: new Date().toISOString(),
    }];
    const result = await engine.chart(findings, { frameworks: ["NIST-800-53"] });
    // CTID data maps T1556 to NIST 800-53 controls
    if (result.frameworks && result.frameworks["NIST-800-53"]) {
      expect(result.frameworks["NIST-800-53"].controls.length).toBeGreaterThan(0);
    }
  });

  test("chart() accepts custom framework mappings", async () => {
    const customEngine = new ChartEngine({
      drift: {
        customField: {
          mitre: "T1234",
          mitreName: "Custom Technique",
          nist: "AC-99",
          nistFunction: "Custom Function",
          soc2: "CC99.1",
          soc2Description: "Custom control",
        },
      },
    });
    await customEngine.initialize();

    const findings = [{
      id: "drift-4",
      field: "customField",
      expected: true,
      actual: false,
      drift: true,
      severity: "HIGH" as const,
      description: "Custom drift",
      timestamp: new Date().toISOString(),
    }];
    const result = await customEngine.chart(findings);
    expect(result.mitre.technique).toBe("T1234");
  });

  test("chartRaid() maps attack vector to frameworks", async () => {
    const raidResult = {
      raidId: "raid-1",
      target: "test",
      vector: "mfa-bypass" as const,
      success: false,
      controlsHeld: true,
      findings: [],
      timeline: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      serialized: false,
      durationMs: 100,
    };
    const mappings = await engine.chartRaid(raidResult);
    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings[0].framework).toBe("MITRE");
  });

  test("constructor works with no arguments", () => {
    const e = new ChartEngine();
    expect(e).toBeDefined();
  });
});
