/**
 * Benchmark Module — Scoring Calibration System
 *
 * Generates synthetic evidence data for scoring engine calibration.
 * Runs benchmark cases through the full pipeline and compares results.
 */

export { generateBenchmarkSuite, runBenchmark, formatBenchmarkReport } from "./benchmark-runner";
export type { BenchmarkCase, BenchmarkSuite, BenchmarkResult } from "./types";
