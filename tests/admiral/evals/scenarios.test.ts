/**
 * Admiral Adversarial Scenarios Tests
 *
 * Tests that each scenario produces valid, well-structured inputs
 * and has reasonable expected outcomes.
 */

import { describe, test, expect, afterAll } from "bun:test";
import { rmSync, existsSync } from "fs";
import {
  brokenHashChainScenario,
  skippedMFAControlsScenario,
  severityBiasScenario,
  timestampManipulationScenario,
  phantomCoverageScenario,
  perfectScoreScenario,
  selectiveTestingScenario,
  trivialISCScenario,
  getAllScenarios,
} from "../../../src/admiral/evals/scenarios";

const SCENARIO_DIR = "/tmp/admiral-eval-scenarios";

afterAll(() => {
  if (existsSync(SCENARIO_DIR)) {
    rmSync(SCENARIO_DIR, { recursive: true, force: true });
  }
});

describe("Admiral Adversarial Scenarios", () => {
  test("brokenHashChainScenario has corrupted evidence", () => {
    const scenario = brokenHashChainScenario();
    expect(scenario.id).toBe("broken-hash-chain");
    expect(scenario.input.evidencePaths.length).toBeGreaterThanOrEqual(1);
    expect(scenario.expectedFindingCategories).toContain("evidence_integrity");
  });

  test("skippedMFAControlsScenario has MFA excluded from scope", () => {
    const scenario = skippedMFAControlsScenario();
    expect(scenario.id).toBe("skipped-mfa-controls");
    expect(scenario.input.markResults).toHaveLength(0);
    expect(scenario.expectedFindingCategories).toContain("methodology");
  });

  test("severityBiasScenario has all LOW findings", () => {
    const scenario = severityBiasScenario();
    expect(scenario.id).toBe("severity-bias");
    const allFindings = scenario.input.markResults.flatMap((m) => m.findings);
    expect(allFindings.length).toBeGreaterThanOrEqual(3);
    for (const finding of allFindings) {
      expect(finding.severity).toBe("LOW");
    }
  });

  test("timestampManipulationScenario has out-of-order timestamps", () => {
    const scenario = timestampManipulationScenario();
    expect(scenario.id).toBe("timestamp-manipulation");
    expect(scenario.expectedFindingCategories).toContain("timestamp_consistency");
  });

  test("phantomCoverageScenario has framework claims without evidence", () => {
    const scenario = phantomCoverageScenario();
    expect(scenario.id).toBe("phantom-coverage");
    expect(scenario.input.chartResults).toHaveLength(0);
    expect(scenario.input.markResults).toHaveLength(0);
    expect(scenario.expectedFindingCategories).toContain("methodology");
  });

  test("perfectScoreScenario has all RAIDs with controlsHeld=true", () => {
    const scenario = perfectScoreScenario();
    expect(scenario.id).toBe("perfect-score");
    for (const raid of scenario.input.raidResults) {
      expect(raid.controlsHeld).toBe(true);
      expect(raid.success).toBe(false);
    }
  });

  test("selectiveTestingScenario has RECON targets not covered by RAID", () => {
    const scenario = selectiveTestingScenario();
    expect(scenario.id).toBe("selective-testing");
    expect(scenario.input.raidResults.length).toBeGreaterThanOrEqual(2);
    expect(scenario.expectedFindingCategories).toContain("raid_plunder_correlation");
  });

  test("trivialISCScenario has trivially satisfiable criteria", () => {
    const scenario = trivialISCScenario();
    expect(scenario.id).toBe("trivial-isc");
    expect(scenario.input.iscCriteria!.length).toBeGreaterThanOrEqual(1);
    expect(scenario.expectedFindingCategories).toContain("methodology");
  });

  test("getAllScenarios returns 8 scenarios", () => {
    const scenarios = getAllScenarios();
    expect(scenarios).toHaveLength(8);
  });

  test("Each scenario has valid expectedFindings and expectedScores", () => {
    const scenarios = getAllScenarios();
    for (const scenario of scenarios) {
      expect(scenario.expectedMinFindings).toBeGreaterThanOrEqual(1);
      expect(scenario.expectedMaxScore).toBeGreaterThanOrEqual(0);
      expect(scenario.expectedMaxScore).toBeLessThanOrEqual(100);
    }
  });

  test("Each scenario has valid expectedTrustTier (none should be auditor-verified)", () => {
    const scenarios = getAllScenarios();
    for (const scenario of scenarios) {
      expect(scenario.expectedTrustTier).not.toBe("auditor-verified");
      expect(["self-assessed", "ai-verified"]).toContain(scenario.expectedTrustTier);
    }
  });

  test("Scenario inputs are valid AdmiralInput objects", () => {
    const scenarios = getAllScenarios();
    for (const scenario of scenarios) {
      expect(scenario.input.evidencePaths).toBeInstanceOf(Array);
      expect(scenario.input.markResults).toBeInstanceOf(Array);
      expect(scenario.input.raidResults).toBeInstanceOf(Array);
      expect(scenario.input.chartResults).toBeInstanceOf(Array);
      expect(scenario.input.scope).toBeDefined();
      expect(scenario.input.scope.providers).toBeInstanceOf(Array);
      expect(typeof scenario.input.scope.resourceCount).toBe("number");
    }
  });
});
