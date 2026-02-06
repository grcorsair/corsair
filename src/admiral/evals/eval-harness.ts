/**
 * Admiral Eval Harness
 *
 * Runs adversarial scenarios against the Admiral agent and evaluates
 * whether it correctly detects corruption, bias, and other integrity issues.
 */

import { AdmiralAgent } from "../admiral-agent";
import type { AdmiralGovernanceReport } from "../admiral-types";
import type {
  AdmiralEvalScenario,
  AdmiralEvalResult,
  AdmiralBenchmarkResult,
} from "./eval-types";

export class AdmiralEvalHarness {
  private admiral: AdmiralAgent;

  constructor(admiral: AdmiralAgent) {
    this.admiral = admiral;
  }

  /**
   * Run a single adversarial scenario and check results.
   */
  async runScenario(scenario: AdmiralEvalScenario): Promise<AdmiralEvalResult> {
    const report = await this.admiral.evaluate(scenario.input);

    const { detectedCategories, missedCategories } = this.checkFindings(
      report,
      scenario.expectedFindingCategories
    );

    const scoreOk = report.confidenceScore <= scenario.expectedMaxScore;
    const findingsOk = report.totalFindings >= scenario.expectedMinFindings;
    const categoriesOk = missedCategories.length === 0;

    const passed = scoreOk && findingsOk && categoriesOk;

    return {
      scenarioId: scenario.id,
      passed,
      report,
      detectedCategories,
      missedCategories,
      comparison: {
        expectedMinFindings: scenario.expectedMinFindings,
        actualFindings: report.totalFindings,
        expectedMaxScore: scenario.expectedMaxScore,
        actualScore: report.confidenceScore,
        expectedTrustTier: scenario.expectedTrustTier,
        actualTrustTier: report.trustTier,
      },
    };
  }

  /**
   * Run all scenarios and produce an aggregate benchmark.
   */
  async runBenchmark(scenarios: AdmiralEvalScenario[]): Promise<AdmiralBenchmarkResult> {
    const startTime = Date.now();
    const results: AdmiralEvalResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }

    const passedScenarios = results.filter((r) => r.passed).length;
    const passRate = scenarios.length > 0
      ? Math.round((passedScenarios / scenarios.length) * 100)
      : 0;

    // Aggregate detection rates by category
    const categoryStats: Record<string, { detected: number; total: number }> = {};

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      const result = results[i];

      for (const category of scenario.expectedFindingCategories) {
        if (!categoryStats[category]) {
          categoryStats[category] = { detected: 0, total: 0 };
        }
        categoryStats[category].total++;
        if (result.detectedCategories.includes(category)) {
          categoryStats[category].detected++;
        }
      }
    }

    const detectionRatesByCategory: Record<string, { detected: number; total: number; rate: number }> = {};
    for (const [category, stats] of Object.entries(categoryStats)) {
      detectionRatesByCategory[category] = {
        ...stats,
        rate: stats.total > 0 ? Math.round((stats.detected / stats.total) * 100) : 0,
      };
    }

    return {
      totalScenarios: scenarios.length,
      passedScenarios,
      passRate,
      detectionRatesByCategory,
      results,
      runAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Check which expected finding categories were detected vs missed.
   */
  private checkFindings(
    report: AdmiralGovernanceReport,
    expectedCategories: string[]
  ): { detectedCategories: string[]; missedCategories: string[] } {
    const allFindings = report.dimensions.flatMap((d) => d.findings);
    const actualCategories = new Set(allFindings.map((f) => f.category));

    const detectedCategories: string[] = [];
    const missedCategories: string[] = [];

    for (const expected of expectedCategories) {
      if (actualCategories.has(expected)) {
        detectedCategories.push(expected);
      } else {
        missedCategories.push(expected);
      }
    }

    return { detectedCategories, missedCategories };
  }
}
