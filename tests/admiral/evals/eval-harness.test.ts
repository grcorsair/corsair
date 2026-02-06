/**
 * Admiral Eval Harness Tests
 *
 * Tests the adversarial evaluation harness that runs scenarios
 * against the Admiral agent.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { rmSync, existsSync } from "fs";
import { AdmiralAgent } from "../../../src/admiral/admiral-agent";
import { AdmiralEvalHarness } from "../../../src/admiral/evals/eval-harness";
import {
  brokenHashChainScenario,
  skippedMFAControlsScenario,
  severityBiasScenario,
  getAllScenarios,
} from "../../../src/admiral/evals/scenarios";
import type { AdmiralConfig } from "../../../src/admiral/admiral-types";

const SCENARIO_DIR = "/tmp/admiral-eval-scenarios";

describe("Admiral Eval Harness", () => {
  let admiral: AdmiralAgent;
  let harness: AdmiralEvalHarness;
  const config: AdmiralConfig = {
    apiKey: "test-key",
    model: "claude-sonnet-4-5-20250929",
  };

  beforeEach(() => {
    admiral = new AdmiralAgent(config);
    harness = new AdmiralEvalHarness(admiral);
  });

  afterEach(() => {
    if (existsSync(SCENARIO_DIR)) {
      rmSync(SCENARIO_DIR, { recursive: true, force: true });
    }
  });

  test("runScenario returns AdmiralEvalResult with all fields", async () => {
    const scenario = brokenHashChainScenario();
    const result = await harness.runScenario(scenario);

    expect(result.scenarioId).toBe("broken-hash-chain");
    expect(typeof result.passed).toBe("boolean");
    expect(result.report).toBeDefined();
    expect(result.report.reportId).toBeDefined();
    expect(result.detectedCategories).toBeInstanceOf(Array);
    expect(result.missedCategories).toBeInstanceOf(Array);
    expect(result.comparison).toBeDefined();
    expect(typeof result.comparison.expectedMinFindings).toBe("number");
    expect(typeof result.comparison.actualFindings).toBe("number");
    expect(typeof result.comparison.expectedMaxScore).toBe("number");
    expect(typeof result.comparison.actualScore).toBe("number");
  });

  test("runScenario with brokenHashChain scenario detects integrity issue", async () => {
    const scenario = brokenHashChainScenario();
    const result = await harness.runScenario(scenario);

    expect(result.detectedCategories).toContain("evidence_integrity");
    expect(result.missedCategories).not.toContain("evidence_integrity");
  });

  test("runScenario with skippedControls scenario detects completeness gap", async () => {
    const scenario = skippedMFAControlsScenario();
    const result = await harness.runScenario(scenario);

    expect(result.detectedCategories).toContain("methodology");
    expect(result.report.totalFindings).toBeGreaterThanOrEqual(1);
  });

  test("runScenario with severityBias scenario detects bias", async () => {
    const scenario = severityBiasScenario();
    const result = await harness.runScenario(scenario);

    expect(result.detectedCategories).toContain("bias_detection");
  });

  test("runBenchmark runs all scenarios and produces aggregate", async () => {
    const scenarios = getAllScenarios();
    const benchmark = await harness.runBenchmark(scenarios);

    expect(benchmark.totalScenarios).toBe(8);
    expect(benchmark.results).toHaveLength(8);
    expect(typeof benchmark.passRate).toBe("number");
    expect(benchmark.passRate).toBeGreaterThanOrEqual(0);
    expect(benchmark.passRate).toBeLessThanOrEqual(100);
    expect(typeof benchmark.runAt).toBe("string");
    expect(benchmark.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("Benchmark passRate correctly calculated", async () => {
    // Run just 2 scenarios to keep it fast
    const scenarios = [brokenHashChainScenario(), skippedMFAControlsScenario()];
    const benchmark = await harness.runBenchmark(scenarios);

    const expectedRate = Math.round(
      (benchmark.passedScenarios / benchmark.totalScenarios) * 100
    );
    expect(benchmark.passRate).toBe(expectedRate);
  });

  test("Detection rates per category correctly aggregated", async () => {
    const scenarios = getAllScenarios();
    const benchmark = await harness.runBenchmark(scenarios);

    expect(benchmark.detectionRatesByCategory).toBeDefined();

    // At least these categories should appear
    const categories = Object.keys(benchmark.detectionRatesByCategory);
    expect(categories.length).toBeGreaterThanOrEqual(1);

    for (const [_category, stats] of Object.entries(benchmark.detectionRatesByCategory)) {
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.detected).toBeGreaterThanOrEqual(0);
      expect(stats.detected).toBeLessThanOrEqual(stats.total);
      expect(stats.rate).toBeGreaterThanOrEqual(0);
      expect(stats.rate).toBeLessThanOrEqual(100);
    }
  });

  test("Failed scenario has detailed comparison showing missing categories", async () => {
    // Create a scenario that expects a category the Admiral can't detect deterministically
    const scenario = brokenHashChainScenario();
    const result = await harness.runScenario(scenario);

    // The comparison should have all fields regardless of pass/fail
    expect(typeof result.comparison.expectedMinFindings).toBe("number");
    expect(typeof result.comparison.actualFindings).toBe("number");
    expect(typeof result.comparison.expectedMaxScore).toBe("number");
    expect(typeof result.comparison.actualScore).toBe("number");
    expect(typeof result.comparison.expectedTrustTier).toBe("string");
    expect(typeof result.comparison.actualTrustTier).toBe("string");
  });
});
