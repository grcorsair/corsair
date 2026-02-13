/**
 * Benchmark Types — Scoring Calibration System
 *
 * Types for the synthetic evidence corpus generator and
 * scoring engine calibration benchmarks.
 */

// =============================================================================
// BENCHMARK CASE
// =============================================================================

/** A single benchmark test case with expected scoring outcome */
export interface BenchmarkCase {
  /** Unique case identifier (e.g., "a-excellent-all-pass") */
  id: string;

  /** Human-readable case name */
  name: string;

  /** Description of what this case tests */
  description: string;

  /** Expected letter grade: A, B, C, D, F */
  expectedGrade: string;

  /** Expected composite score range [min, max] */
  expectedScoreRange: [number, number];

  /** Generic evidence JSON (with metadata + controls) */
  evidence: object;

  /** Evidence format name (always "generic" for benchmark cases) */
  format: string;
}

// =============================================================================
// BENCHMARK SUITE
// =============================================================================

/** A collection of benchmark cases for scoring calibration */
export interface BenchmarkSuite {
  /** Suite name */
  name: string;

  /** Suite version (semver) */
  version: string;

  /** Benchmark cases */
  cases: BenchmarkCase[];

  /** When the suite was created (ISO 8601) */
  createdAt: string;
}

// =============================================================================
// BENCHMARK RESULT
// =============================================================================

/** Result of running a single benchmark case through the scoring engine */
export interface BenchmarkResult {
  /** Suite identifier (matches suite.name) */
  suiteId: string;

  /** Case identifier (matches case.id) */
  caseId: string;

  /** Actual composite score from the scoring engine */
  actualScore: number;

  /** Actual letter grade from the scoring engine */
  actualGrade: string;

  /** Expected letter grade from the benchmark case */
  expectedGrade: string;

  /** Whether actualGrade matches expectedGrade */
  passed: boolean;

  /** Whether actualScore falls within expectedScoreRange */
  scoreInRange: boolean;

  /** Time to process this case in milliseconds */
  duration: number;
}
