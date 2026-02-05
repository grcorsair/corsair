/**
 * OSCAL Generator Test Contract
 *
 * Tests the conversion of Corsair primitives to OSCAL Assessment Results format.
 *
 * Contract Requirements:
 * 1. Generator MUST produce valid OSCALAssessmentResult structure
 * 2. ISC criteria MUST map to OSCAL findings with correct satisfaction status
 * 3. MARK findings MUST map to OSCAL observations
 * 4. RAID results MUST map to OSCAL risks
 * 5. ChartResult frameworks MUST map to OSCAL control-selections
 * 6. Output MUST include valid metadata with OSCAL version
 * 7. toJSON MUST produce valid JSON string
 * 8. Generator MUST handle empty/missing optional fields gracefully
 */

import { describe, test, expect } from "bun:test";
import { OSCALGenerator } from "../../src/output/oscal-generator";
import type { DriftFinding, ChartResult, RaidResult } from "../../src/types";
import type { OSCALAssessmentResult } from "../../src/output/oscal-types";

// ===============================================================================
// TEST FIXTURES
// ===============================================================================

function createTestFindings(): DriftFinding[] {
  return [
    {
      id: "DRIFT-001",
      field: "mfaConfiguration",
      expected: "ON",
      actual: "OFF",
      drift: true,
      severity: "CRITICAL",
      description: "MFA is disabled on user pool",
      timestamp: "2026-01-15T10:00:00.000Z",
    },
    {
      id: "DRIFT-002",
      field: "passwordPolicy.minimumLength",
      expected: 12,
      actual: 6,
      drift: true,
      severity: "HIGH",
      description: "Password minimum length below requirement",
      timestamp: "2026-01-15T10:00:01.000Z",
    },
    {
      id: "DRIFT-003",
      field: "riskConfiguration",
      expected: "configured",
      actual: null,
      drift: true,
      severity: "MEDIUM",
      description: "Risk configuration not set",
      timestamp: "2026-01-15T10:00:02.000Z",
    },
  ];
}

function createTestChartResult(): ChartResult {
  return {
    mitre: {
      technique: "T1556",
      name: "Modify Authentication Process",
      tactic: "Credential Access",
      description: "MFA misconfiguration detected",
    },
    nist: {
      function: "Protect - Access Control",
      category: "Access Control",
      controls: ["PR.AC-7", "PR.AC-1"],
    },
    soc2: {
      principle: "Common Criteria",
      criteria: ["CC6.1", "CC6.2"],
      description: "Logical access security",
    },
    frameworks: {
      "NIST-800-53": {
        controls: [
          { controlId: "IA-2", controlName: "Identification and Authentication", status: "mapped" },
          { controlId: "IA-5", controlName: "Authenticator Management", status: "mapped" },
        ],
      },
      "ISO27001": {
        controls: [
          { controlId: "A.9.4.2", controlName: "Secure log-on procedures", status: "mapped" },
        ],
      },
    },
  };
}

function createTestRaidResults(): RaidResult[] {
  return [
    {
      raidId: "RAID-001",
      target: "us-west-2_TEST001",
      vector: "mfa-bypass",
      success: true,
      controlsHeld: false,
      findings: ["MFA bypass succeeded - control gap confirmed"],
      timeline: [
        { timestamp: "2026-01-15T10:01:00.000Z", action: "initiate", result: "started" },
        { timestamp: "2026-01-15T10:01:05.000Z", action: "bypass-attempt", result: "success" },
      ],
      startedAt: "2026-01-15T10:01:00.000Z",
      completedAt: "2026-01-15T10:01:05.000Z",
      serialized: true,
      durationMs: 5000,
    },
    {
      raidId: "RAID-002",
      target: "us-west-2_TEST001",
      vector: "password-spray",
      success: false,
      controlsHeld: true,
      findings: ["Password spray blocked by rate limiting"],
      timeline: [
        { timestamp: "2026-01-15T10:02:00.000Z", action: "initiate", result: "started" },
        { timestamp: "2026-01-15T10:02:03.000Z", action: "spray-attempt", result: "blocked" },
      ],
      startedAt: "2026-01-15T10:02:00.000Z",
      completedAt: "2026-01-15T10:02:03.000Z",
      serialized: true,
      durationMs: 3000,
    },
  ];
}

function createTestISCCriteria(): { text: string; satisfaction: string }[] {
  return [
    { text: "MFA enabled all accounts", satisfaction: "FAILED" },
    { text: "Password length minimum twelve", satisfaction: "FAILED" },
    { text: "Risk detection configured active", satisfaction: "SATISFIED" },
    { text: "Device tracking enabled", satisfaction: "PENDING" },
  ];
}

// ===============================================================================
// TESTS
// ===============================================================================

describe("OSCAL Generator", () => {
  const generator = new OSCALGenerator();

  describe("Document Structure", () => {
    test("generates valid top-level OSCALAssessmentResult", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      expect(result).toBeDefined();
      expect(result["assessment-results"]).toBeDefined();
      expect(result["assessment-results"].uuid).toBeDefined();
      expect(typeof result["assessment-results"].uuid).toBe("string");
      expect(result["assessment-results"].uuid.length).toBeGreaterThan(0);
    });

    test("includes valid metadata with OSCAL version", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const metadata = result["assessment-results"].metadata;
      expect(metadata).toBeDefined();
      expect(metadata.title).toBeDefined();
      expect(metadata["last-modified"]).toBeDefined();
      expect(metadata.version).toBeDefined();
      expect(metadata["oscal-version"]).toBe("1.1.2");
    });

    test("includes custom metadata when provided", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        metadata: {
          title: "Custom Assessment Title",
          description: "Custom description for the assessment",
        },
      });

      const metadata = result["assessment-results"].metadata;
      expect(metadata.title).toBe("Custom Assessment Title");
      expect(metadata.remarks).toBe("Custom description for the assessment");
    });

    test("results array contains exactly one result", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      expect(result["assessment-results"].results).toBeDefined();
      expect(Array.isArray(result["assessment-results"].results)).toBe(true);
      expect(result["assessment-results"].results.length).toBe(1);
    });

    test("result contains reviewed-controls from chart frameworks", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const assessmentResult = result["assessment-results"].results[0];
      expect(assessmentResult["reviewed-controls"]).toBeDefined();
      expect(assessmentResult["reviewed-controls"]["control-selections"]).toBeDefined();
      expect(assessmentResult["reviewed-controls"]["control-selections"].length).toBeGreaterThan(0);
    });
  });

  describe("Findings from ISC Criteria", () => {
    test("maps ISC criteria to OSCAL findings", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        iscCriteria: createTestISCCriteria(),
      });

      const assessmentResult = result["assessment-results"].results[0];
      expect(assessmentResult.findings).toBeDefined();
      expect(assessmentResult.findings!.length).toBe(4);
    });

    test("SATISFIED ISC maps to satisfied finding target", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        iscCriteria: [{ text: "Risk detection configured active", satisfaction: "SATISFIED" }],
      });

      const finding = result["assessment-results"].results[0].findings![0];
      expect(finding.target.status).toBe("satisfied");
    });

    test("FAILED ISC maps to not-satisfied finding target", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        iscCriteria: [{ text: "MFA enabled all accounts", satisfaction: "FAILED" }],
      });

      const finding = result["assessment-results"].results[0].findings![0];
      expect(finding.target.status).toBe("not-satisfied");
    });

    test("PENDING ISC maps to not-satisfied finding target", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        iscCriteria: [{ text: "Device tracking enabled", satisfaction: "PENDING" }],
      });

      const finding = result["assessment-results"].results[0].findings![0];
      expect(finding.target.status).toBe("not-satisfied");
    });

    test("finding includes ISC text in title and description", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        iscCriteria: [{ text: "MFA enabled all accounts", satisfaction: "FAILED" }],
      });

      const finding = result["assessment-results"].results[0].findings![0];
      expect(finding.title).toContain("MFA enabled all accounts");
      expect(finding.description).toContain("MFA enabled all accounts");
    });

    test("finding has valid UUID", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        iscCriteria: [{ text: "MFA enabled all accounts", satisfaction: "FAILED" }],
      });

      const finding = result["assessment-results"].results[0].findings![0];
      expect(finding.uuid).toBeDefined();
      expect(typeof finding.uuid).toBe("string");
      expect(finding.uuid.length).toBeGreaterThan(0);
    });
  });

  describe("Observations from MARK Findings", () => {
    test("maps drift findings to OSCAL observations", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const assessmentResult = result["assessment-results"].results[0];
      expect(assessmentResult.observations).toBeDefined();
      expect(assessmentResult.observations!.length).toBe(3);
    });

    test("observation includes drift field and severity", () => {
      const findings = [createTestFindings()[0]];
      const result = generator.generate({
        findings,
        chartResult: createTestChartResult(),
      });

      const observation = result["assessment-results"].results[0].observations![0];
      expect(observation.title).toContain("mfaConfiguration");
      expect(observation.description).toBeDefined();
      expect(observation.description.length).toBeGreaterThan(0);
    });

    test("observation uses TEST method for automated assessment", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const observation = result["assessment-results"].results[0].observations![0];
      expect(observation.methods).toContain("TEST");
    });

    test("observation includes collected timestamp from finding", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const observation = result["assessment-results"].results[0].observations![0];
      expect(observation.collected).toBe("2026-01-15T10:00:00.000Z");
    });

    test("observation includes severity as a property", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const observation = result["assessment-results"].results[0].observations![0];
      expect(observation.props).toBeDefined();
      const severityProp = observation.props!.find((p) => p.name === "severity");
      expect(severityProp).toBeDefined();
      expect(severityProp!.value).toBe("CRITICAL");
    });
  });

  describe("Risks from RAID Results", () => {
    test("maps RAID results to OSCAL risks", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        raidResults: createTestRaidResults(),
      });

      const assessmentResult = result["assessment-results"].results[0];
      expect(assessmentResult.risks).toBeDefined();
      expect(assessmentResult.risks!.length).toBe(2);
    });

    test("successful raid maps to open risk status", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        raidResults: [createTestRaidResults()[0]], // mfa-bypass succeeded
      });

      const risk = result["assessment-results"].results[0].risks![0];
      expect(risk.status).toBe("open");
    });

    test("blocked raid maps to closed risk status", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        raidResults: [createTestRaidResults()[1]], // password-spray blocked
      });

      const risk = result["assessment-results"].results[0].risks![0];
      expect(risk.status).toBe("closed");
    });

    test("risk includes attack vector information", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        raidResults: [createTestRaidResults()[0]],
      });

      const risk = result["assessment-results"].results[0].risks![0];
      expect(risk.title).toContain("mfa-bypass");
      expect(risk.description).toBeDefined();
    });

    test("risk includes characterization with severity facet", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        raidResults: createTestRaidResults(),
      });

      const risk = result["assessment-results"].results[0].risks![0];
      expect(risk.characterizations).toBeDefined();
      expect(risk.characterizations!.length).toBeGreaterThan(0);
      const facets = risk.characterizations![0].facets;
      expect(facets.length).toBeGreaterThan(0);
    });
  });

  describe("Control Selections from ChartResult", () => {
    test("maps NIST controls to control-selections", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const reviewedControls = result["assessment-results"].results[0]["reviewed-controls"];
      const selections = reviewedControls["control-selections"];
      expect(selections.length).toBeGreaterThan(0);

      // Should have include-controls from NIST
      const hasNistControls = selections.some(
        (s) => s["include-controls"] && s["include-controls"]!.some((c) => c["control-id"].startsWith("PR."))
      );
      expect(hasNistControls).toBe(true);
    });

    test("maps extended frameworks to control-selections", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const reviewedControls = result["assessment-results"].results[0]["reviewed-controls"];
      const selections = reviewedControls["control-selections"];

      // Should include NIST-800-53 controls from the frameworks field
      const hasExtended = selections.some(
        (s) =>
          s["include-controls"] &&
          s["include-controls"]!.some((c) => c["control-id"] === "IA-2" || c["control-id"] === "IA-5")
      );
      expect(hasExtended).toBe(true);
    });

    test("maps SOC2 criteria to control-selections", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const reviewedControls = result["assessment-results"].results[0]["reviewed-controls"];
      const selections = reviewedControls["control-selections"];

      const hasSoc2 = selections.some(
        (s) =>
          s["include-controls"] &&
          s["include-controls"]!.some((c) => c["control-id"].startsWith("CC6"))
      );
      expect(hasSoc2).toBe(true);
    });
  });

  describe("JSON Serialization", () => {
    test("toJSON produces valid JSON string", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const json = generator.toJSON(result);
      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(parsed["assessment-results"]).toBeDefined();
    });

    test("toJSON output is pretty-printed with 2-space indent", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const json = generator.toJSON(result);
      // Pretty-printed JSON should have newlines and indentation
      expect(json).toContain("\n");
      expect(json).toContain("  ");
    });

    test("round-trip preserves all data", () => {
      const original = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
        raidResults: createTestRaidResults(),
        iscCriteria: createTestISCCriteria(),
      });

      const json = generator.toJSON(original);
      const parsed = JSON.parse(json) as OSCALAssessmentResult;

      expect(parsed["assessment-results"].results[0].findings!.length).toBe(4);
      expect(parsed["assessment-results"].results[0].observations!.length).toBe(3);
      expect(parsed["assessment-results"].results[0].risks!.length).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    test("handles empty findings array", () => {
      const result = generator.generate({
        findings: [],
        chartResult: createTestChartResult(),
      });

      expect(result["assessment-results"]).toBeDefined();
      const assessmentResult = result["assessment-results"].results[0];
      expect(assessmentResult.observations).toBeDefined();
      expect(assessmentResult.observations!.length).toBe(0);
    });

    test("handles missing optional raidResults", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const assessmentResult = result["assessment-results"].results[0];
      // risks should be empty array, not undefined
      expect(assessmentResult.risks).toBeDefined();
      expect(assessmentResult.risks!.length).toBe(0);
    });

    test("handles missing optional iscCriteria", () => {
      const result = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      const assessmentResult = result["assessment-results"].results[0];
      // findings should be empty array, not undefined
      expect(assessmentResult.findings).toBeDefined();
      expect(assessmentResult.findings!.length).toBe(0);
    });

    test("handles chart result with no extended frameworks", () => {
      const chartResult: ChartResult = {
        mitre: { technique: "T1556", name: "Test", tactic: "Test", description: "Test" },
        nist: { function: "Protect", category: "AC", controls: ["PR.AC-7"] },
        soc2: { principle: "CC", criteria: ["CC6.1"], description: "Test" },
        // No frameworks field
      };

      const result = generator.generate({
        findings: createTestFindings(),
        chartResult,
      });

      expect(result["assessment-results"]).toBeDefined();
      const selections = result["assessment-results"].results[0]["reviewed-controls"]["control-selections"];
      expect(selections.length).toBeGreaterThan(0);
    });

    test("generates unique UUIDs across multiple calls", () => {
      const result1 = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });
      const result2 = generator.generate({
        findings: createTestFindings(),
        chartResult: createTestChartResult(),
      });

      expect(result1["assessment-results"].uuid).not.toBe(result2["assessment-results"].uuid);
    });
  });
});
