import { describe, test, expect } from "bun:test";
import {
  generateBenchmarkSuite,
  runBenchmark,
  formatBenchmarkReport,
} from "../../src/benchmark/benchmark-runner";
import type {
  BenchmarkCase,
  BenchmarkSuite,
  BenchmarkResult,
} from "../../src/benchmark/types";

/**
 * Benchmark Runner Tests
 *
 * Tests the synthetic evidence corpus generator and scoring calibration system.
 */

describe("Benchmark Suite Generator", () => {
  // =========================================================================
  // SUITE GENERATION
  // =========================================================================

  test("generateBenchmarkSuite returns a valid suite", () => {
    const suite = generateBenchmarkSuite();
    expect(suite).toBeDefined();
    expect(suite.name).toBeDefined();
    expect(suite.version).toBeDefined();
    expect(suite.createdAt).toBeDefined();
    expect(suite.cases).toBeInstanceOf(Array);
  });

  test("suite contains 15 cases", () => {
    const suite = generateBenchmarkSuite();
    expect(suite.cases.length).toBe(15);
  });

  test("suite has a valid ISO 8601 createdAt timestamp", () => {
    const suite = generateBenchmarkSuite();
    const parsed = Date.parse(suite.createdAt);
    expect(isNaN(parsed)).toBe(false);
  });

  test("suite has a non-empty name", () => {
    const suite = generateBenchmarkSuite();
    expect(suite.name.length).toBeGreaterThan(0);
  });

  test("suite has a version string", () => {
    const suite = generateBenchmarkSuite();
    expect(suite.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // =========================================================================
  // CASE STRUCTURE
  // =========================================================================

  test("each case has required fields", () => {
    const suite = generateBenchmarkSuite();
    for (const c of suite.cases) {
      expect(c.id).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.description).toBeDefined();
      expect(c.expectedGrade).toBeDefined();
      expect(c.expectedScoreRange).toBeDefined();
      expect(c.evidence).toBeDefined();
      expect(c.format).toBeDefined();
    }
  });

  test("each case has a unique id", () => {
    const suite = generateBenchmarkSuite();
    const ids = suite.cases.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("each case has a valid expectedGrade (A-F)", () => {
    const suite = generateBenchmarkSuite();
    const validGrades = new Set(["A", "B", "C", "D", "F"]);
    for (const c of suite.cases) {
      expect(validGrades.has(c.expectedGrade)).toBe(true);
    }
  });

  test("each case has a valid score range [min, max]", () => {
    const suite = generateBenchmarkSuite();
    for (const c of suite.cases) {
      expect(c.expectedScoreRange.length).toBe(2);
      expect(c.expectedScoreRange[0]).toBeLessThanOrEqual(c.expectedScoreRange[1]);
      expect(c.expectedScoreRange[0]).toBeGreaterThanOrEqual(0);
      expect(c.expectedScoreRange[1]).toBeLessThanOrEqual(100);
    }
  });

  test("each case has format set to 'generic'", () => {
    const suite = generateBenchmarkSuite();
    for (const c of suite.cases) {
      expect(c.format).toBe("generic");
    }
  });

  test("each case evidence has metadata and controls", () => {
    const suite = generateBenchmarkSuite();
    for (const c of suite.cases) {
      const ev = c.evidence as Record<string, unknown>;
      expect(ev.metadata).toBeDefined();
      expect(ev.controls).toBeDefined();
      expect(Array.isArray(ev.controls)).toBe(true);
    }
  });

  // =========================================================================
  // GRADE DISTRIBUTION
  // =========================================================================

  test("suite spans all 5 grades (A through F)", () => {
    const suite = generateBenchmarkSuite();
    const grades = new Set(suite.cases.map((c) => c.expectedGrade));
    expect(grades.has("A")).toBe(true);
    expect(grades.has("B")).toBe(true);
    expect(grades.has("C")).toBe(true);
    expect(grades.has("D")).toBe(true);
    expect(grades.has("F")).toBe(true);
  });

  test("suite has 3 A-grade cases", () => {
    const suite = generateBenchmarkSuite();
    const aCases = suite.cases.filter((c) => c.expectedGrade === "A");
    expect(aCases.length).toBe(3);
  });

  test("suite has 3 B-grade cases", () => {
    const suite = generateBenchmarkSuite();
    const bCases = suite.cases.filter((c) => c.expectedGrade === "B");
    expect(bCases.length).toBe(3);
  });

  test("suite has 3 C-grade cases", () => {
    const suite = generateBenchmarkSuite();
    const cCases = suite.cases.filter((c) => c.expectedGrade === "C");
    expect(cCases.length).toBe(3);
  });

  test("suite has 3 D-grade cases", () => {
    const suite = generateBenchmarkSuite();
    const dCases = suite.cases.filter((c) => c.expectedGrade === "D");
    expect(dCases.length).toBe(3);
  });

  test("suite has 3 F-grade cases", () => {
    const suite = generateBenchmarkSuite();
    const fCases = suite.cases.filter((c) => c.expectedGrade === "F");
    expect(fCases.length).toBe(3);
  });
});

describe("Benchmark Runner", () => {
  // =========================================================================
  // EXECUTION
  // =========================================================================

  test("runBenchmark processes all cases", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    expect(results.length).toBe(suite.cases.length);
  });

  test("each result has required fields", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    for (const r of results) {
      expect(r.suiteId).toBeDefined();
      expect(r.caseId).toBeDefined();
      expect(typeof r.actualScore).toBe("number");
      expect(typeof r.actualGrade).toBe("string");
      expect(typeof r.expectedGrade).toBe("string");
      expect(typeof r.passed).toBe("boolean");
      expect(typeof r.scoreInRange).toBe("boolean");
      expect(typeof r.duration).toBe("number");
    }
  });

  test("result suiteId matches the suite name", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    for (const r of results) {
      expect(r.suiteId).toBe(suite.name);
    }
  });

  test("result caseId matches a case in the suite", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const caseIds = new Set(suite.cases.map((c) => c.id));
    for (const r of results) {
      expect(caseIds.has(r.caseId)).toBe(true);
    }
  });

  test("actualScore is between 0 and 100", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    for (const r of results) {
      expect(r.actualScore).toBeGreaterThanOrEqual(0);
      expect(r.actualScore).toBeLessThanOrEqual(100);
    }
  });

  test("actualGrade is a valid letter grade", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const validGrades = new Set(["A", "B", "C", "D", "F"]);
    for (const r of results) {
      expect(validGrades.has(r.actualGrade)).toBe(true);
    }
  });

  test("passed flag correctly reflects grade match", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    for (const r of results) {
      expect(r.passed).toBe(r.actualGrade === r.expectedGrade);
    }
  });

  test("scoreInRange flag correctly reflects range check", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const caseMap = new Map(suite.cases.map((c) => [c.id, c]));
    for (const r of results) {
      const c = caseMap.get(r.caseId)!;
      const inRange =
        r.actualScore >= c.expectedScoreRange[0] &&
        r.actualScore <= c.expectedScoreRange[1];
      expect(r.scoreInRange).toBe(inRange);
    }
  });

  test("duration is non-negative for all results", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    for (const r of results) {
      expect(r.duration).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Benchmark Report Formatting", () => {
  // =========================================================================
  // REPORT OUTPUT
  // =========================================================================

  test("formatBenchmarkReport returns a non-empty string", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const report = formatBenchmarkReport(results, suite);
    expect(report.length).toBeGreaterThan(0);
  });

  test("report includes suite name", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const report = formatBenchmarkReport(results, suite);
    expect(report).toContain(suite.name);
  });

  test("report includes header", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const report = formatBenchmarkReport(results, suite);
    expect(report).toContain("CORSAIR BENCHMARK REPORT");
  });

  test("report includes case count", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const report = formatBenchmarkReport(results, suite);
    expect(report).toContain("Cases: 15");
  });

  test("report includes pass/fail summary", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const report = formatBenchmarkReport(results, suite);
    expect(report).toContain("Passed:");
  });

  test("report includes all case IDs", async () => {
    const suite = generateBenchmarkSuite();
    const results = await runBenchmark(suite);
    const report = formatBenchmarkReport(results, suite);
    for (const c of suite.cases) {
      expect(report).toContain(c.id);
    }
  });
});
