/**
 * Admiral Eval Types
 *
 * Type definitions for adversarial evaluation scenarios that test
 * whether the Admiral correctly detects corruption, bias, and gaps.
 */

import type { AdmiralInput, AdmiralGovernanceReport, AdmiralFinding } from "../admiral-types";

/**
 * An adversarial scenario designed to test the Admiral's detection capabilities.
 */
export interface AdmiralEvalScenario {
  /** Unique scenario identifier */
  id: string;

  /** Human-readable scenario name */
  name: string;

  /** Description of what this scenario tests */
  description: string;

  /** The corrupted/biased input to feed to the Admiral */
  input: AdmiralInput;

  /** Finding categories the Admiral should detect */
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
export interface AdmiralEvalResult {
  /** The scenario that was tested */
  scenarioId: string;

  /** Whether the Admiral detected the expected issues */
  passed: boolean;

  /** The Admiral's actual report */
  report: AdmiralGovernanceReport;

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
export interface AdmiralBenchmarkResult {
  /** Total scenarios run */
  totalScenarios: number;

  /** Scenarios where Admiral correctly detected issues */
  passedScenarios: number;

  /** Pass rate as percentage (0-100) */
  passRate: number;

  /** Detection rates per finding category */
  detectionRatesByCategory: Record<string, { detected: number; total: number; rate: number }>;

  /** Individual scenario results */
  results: AdmiralEvalResult[];

  /** Benchmark run timestamp */
  runAt: string;

  /** Total duration in milliseconds */
  durationMs: number;
}
