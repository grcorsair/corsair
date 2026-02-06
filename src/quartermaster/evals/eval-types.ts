/**
 * Quartermaster Eval Types
 *
 * Type definitions for adversarial evaluation scenarios that test
 * whether the Quartermaster correctly detects corruption, bias, and gaps.
 */

import type { QuartermasterInput, QuartermasterGovernanceReport, QuartermasterFinding } from "../quartermaster-types";

/**
 * An adversarial scenario designed to test the Quartermaster's detection capabilities.
 */
export interface QuartermasterEvalScenario {
  /** Unique scenario identifier */
  id: string;

  /** Human-readable scenario name */
  name: string;

  /** Description of what this scenario tests */
  description: string;

  /** The corrupted/biased input to feed to the Quartermaster */
  input: QuartermasterInput;

  /** Finding categories the Quartermaster should detect */
  expectedFindingCategories: string[];

  /** Minimum number of findings expected */
  expectedMinFindings: number;

  /** Expected trust tier (none should be auditor-verified for adversarial scenarios) */
  expectedTrustTier: "self-assessed" | "ai-verified";

  /** Maximum acceptable confidence score */
  expectedMaxScore: number;
}

/**
 * Result of running a single adversarial scenario.
 */
export interface QuartermasterEvalResult {
  /** The scenario that was tested */
  scenarioId: string;

  /** Whether the Quartermaster detected the expected issues */
  passed: boolean;

  /** The Quartermaster's actual report */
  report: QuartermasterGovernanceReport;

  /** Which expected categories were detected */
  detectedCategories: string[];

  /** Which expected categories were missed */
  missedCategories: string[];

  /** Detailed comparison */
  comparison: {
    expectedMinFindings: number;
    actualFindings: number;
    expectedMaxScore: number;
    actualScore: number;
    expectedTrustTier: string;
    actualTrustTier: string;
  };
}

/**
 * Aggregate benchmark result across all scenarios.
 */
export interface QuartermasterBenchmarkResult {
  /** Total scenarios run */
  totalScenarios: number;

  /** Scenarios where Quartermaster correctly detected issues */
  passedScenarios: number;

  /** Pass rate as percentage (0-100) */
  passRate: number;

  /** Detection rates per finding category */
  detectionRatesByCategory: Record<string, { detected: number; total: number; rate: number }>;

  /** Individual scenario results */
  results: QuartermasterEvalResult[];

  /** Benchmark run timestamp */
  runAt: string;

  /** Total duration in milliseconds */
  durationMs: number;
}
