/**
 * Benchmark Runner — Scoring Calibration System
 *
 * Generates synthetic evidence data spanning grades A through F,
 * runs each case through the scoring engine pipeline, and
 * compares actual vs. expected outcomes.
 *
 * Pipeline per case: generate evidence -> parseJSON -> normalizeDocument -> scoreEvidence -> compare
 */

import { parseJSON } from "../ingestion/json-parser";
import { normalizeDocument } from "../normalize/normalize";
import { scoreEvidence } from "../scoring/scoring-engine";
import type { BenchmarkCase, BenchmarkSuite, BenchmarkResult } from "./types";

// =============================================================================
// SUITE VERSION
// =============================================================================

const SUITE_NAME = "Standard Evidence Quality v1.0";
const SUITE_VERSION = "1.0.0";

// =============================================================================
// GENERATE BENCHMARK SUITE
// =============================================================================

/**
 * Generate a benchmark suite of ~15 synthetic evidence cases spanning grades A through F.
 *
 * 3 cases per grade: A (excellent), B (good), C (adequate), D (poor), F (failing)
 */
export function generateBenchmarkSuite(): BenchmarkSuite {
  const cases: BenchmarkCase[] = [
    // A-grade cases (excellent: all pass, tool provenance, multiple frameworks)
    ...generateACases(),
    // B-grade cases (good: mostly pass, minor gaps)
    ...generateBCases(),
    // C-grade cases (adequate: some failures, limited evidence)
    ...generateCCases(),
    // D-grade cases (poor: many failures, weak evidence)
    ...generateDCases(),
    // F-grade cases (failing: critical failures, no evidence, self-assessed)
    ...generateFCases(),
  ];

  return {
    name: SUITE_NAME,
    version: SUITE_VERSION,
    cases,
    createdAt: new Date().toISOString(),
  };
}

// =============================================================================
// RUN BENCHMARK
// =============================================================================

/**
 * Run all cases in a benchmark suite through the scoring pipeline.
 *
 * For each case: parseJSON -> normalizeDocument -> scoreEvidence -> compare
 */
export async function runBenchmark(suite: BenchmarkSuite): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const benchCase of suite.cases) {
    const start = performance.now();

    // Parse evidence through the standard pipeline
    const ingestedDoc = parseJSON(benchCase.evidence, { format: "generic" });
    const normalized = normalizeDocument(ingestedDoc);
    const score = scoreEvidence(normalized.controls);

    const duration = performance.now() - start;

    const passed = score.grade === benchCase.expectedGrade;
    const scoreInRange =
      score.composite >= benchCase.expectedScoreRange[0] &&
      score.composite <= benchCase.expectedScoreRange[1];

    results.push({
      suiteId: suite.name,
      caseId: benchCase.id,
      actualScore: score.composite,
      actualGrade: score.grade,
      expectedGrade: benchCase.expectedGrade,
      passed,
      scoreInRange,
      duration,
    });
  }

  return results;
}

// =============================================================================
// FORMAT REPORT
// =============================================================================

/**
 * Format benchmark results as a human-readable report.
 */
export function formatBenchmarkReport(
  results: BenchmarkResult[],
  suite: BenchmarkSuite,
): string {
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  const lines: string[] = [];
  lines.push("CORSAIR BENCHMARK REPORT");
  lines.push("=".repeat(50));
  lines.push(`Suite: ${suite.name}`);
  lines.push(`Cases: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  lines.push("");
  lines.push("RESULTS:");

  for (const r of results) {
    const benchCase = suite.cases.find((c) => c.id === r.caseId);
    const rangeStr = benchCase
      ? `[${benchCase.expectedScoreRange[0]}-${benchCase.expectedScoreRange[1]}]`
      : "";
    const marker = r.passed ? "+" : "x";
    const mismatchNote = r.passed ? "" : "  <- MISMATCH";
    const line = `  ${marker} ${r.caseId.padEnd(30)} ${r.actualGrade} (${r.actualScore.toFixed(0).padStart(3)}) expected ${r.expectedGrade} ${rangeStr}${mismatchNote}`;
    lines.push(line);
  }

  lines.push("");
  return lines.join("\n");
}

// =============================================================================
// CASE GENERATORS — GRADE A (Excellent)
// =============================================================================

function generateACases(): BenchmarkCase[] {
  const today = new Date().toISOString().split("T")[0];

  return [
    {
      id: "a-all-pass-tool",
      name: "All Controls Pass (Tool Source)",
      description: "10 controls all passing, tool provenance, multiple frameworks, recent timestamps",
      expectedGrade: "A",
      expectedScoreRange: [85, 100],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark A1: Excellent Tool Scan",
          issuer: "Prowler v3.1",
          date: today,
          scope: "AWS Production",
          reportType: "Prowler OCSF",
        },
        controls: makeControls(10, {
          passRate: 1.0,
          severityMix: ["HIGH", "HIGH", "CRITICAL", "MEDIUM", "HIGH", "HIGH", "CRITICAL", "MEDIUM", "HIGH", "HIGH"],
          withEvidence: true,
          withFrameworks: true,
        }),
      },
    },
    {
      id: "a-multi-framework",
      name: "Multi-Framework Coverage",
      description: "8 controls passing with SOC2 + NIST + ISO mappings, detailed evidence",
      expectedGrade: "A",
      expectedScoreRange: [85, 100],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark A2: Multi-Framework",
          issuer: "InSpec Compliance Scanner",
          date: today,
          scope: "Cloud Infrastructure",
          reportType: "InSpec",
        },
        controls: makeControls(8, {
          passRate: 1.0,
          severityMix: ["CRITICAL", "HIGH", "HIGH", "MEDIUM", "HIGH", "CRITICAL", "HIGH", "MEDIUM"],
          withEvidence: true,
          withFrameworks: true,
          multiFramework: true,
        }),
      },
    },
    {
      id: "a-high-volume",
      name: "High Volume All Pass",
      description: "20 controls all passing, comprehensive evidence, recent timestamps",
      expectedGrade: "A",
      expectedScoreRange: [85, 100],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark A3: High Volume",
          issuer: "SecurityHub ASFF Scanner",
          date: today,
          scope: "Full Environment Assessment",
          reportType: "SecurityHub ASFF",
        },
        controls: makeControls(20, {
          passRate: 1.0,
          severityMix: repeat(["HIGH", "CRITICAL", "MEDIUM", "HIGH"], 5),
          withEvidence: true,
          withFrameworks: true,
        }),
      },
    },
  ];
}

// =============================================================================
// CASE GENERATORS — GRADE B (Good)
// =============================================================================

function generateBCases(): BenchmarkCase[] {
  const today = new Date().toISOString().split("T")[0];

  return [
    {
      id: "b-minor-failures",
      name: "Minor Failures",
      description: "10 controls, 8 pass / 2 fail (low severity), good evidence",
      expectedGrade: "B",
      expectedScoreRange: [75, 89],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark B1: Minor Failures",
          issuer: "Prowler v3.1",
          date: today,
          scope: "AWS Staging",
          reportType: "Prowler OCSF",
        },
        controls: makeControls(10, {
          passRate: 0.8,
          severityMix: ["HIGH", "HIGH", "MEDIUM", "LOW", "HIGH", "MEDIUM", "LOW", "HIGH", "MEDIUM", "LOW"],
          withEvidence: true,
          withFrameworks: true,
        }),
      },
    },
    {
      id: "b-evidence-gaps",
      name: "Evidence Gaps",
      description: "10 controls all pass but 2 lack evidence (coverage hit)",
      expectedGrade: "B",
      expectedScoreRange: [75, 89],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark B2: Evidence Gaps",
          issuer: "InSpec Compliance Scanner",
          date: today,
          scope: "Kubernetes Cluster",
          reportType: "InSpec",
        },
        controls: makeControls(10, {
          passRate: 1.0,
          severityMix: repeat(["HIGH", "MEDIUM"], 5),
          withEvidence: true,
          withFrameworks: true,
          evidenceGapCount: 2,
        }),
      },
    },
    {
      id: "b-some-skipped",
      name: "Some Skipped Controls",
      description: "12 controls: 9 pass, 1 fail, 2 skipped",
      expectedGrade: "B",
      expectedScoreRange: [75, 89],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark B3: Skipped Controls",
          issuer: "Trivy Scanner",
          date: today,
          scope: "Container Security",
          reportType: "Trivy",
        },
        controls: makeControls(12, {
          passRate: 0.75,
          skipRate: 0.167,
          severityMix: repeat(["HIGH", "MEDIUM", "LOW"], 4),
          withEvidence: true,
          withFrameworks: false,
        }),
      },
    },
  ];
}

// =============================================================================
// CASE GENERATORS — GRADE C (Adequate)
// =============================================================================

function generateCCases(): BenchmarkCase[] {
  const today = new Date().toISOString().split("T")[0];
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return [
    {
      id: "c-moderate-failures",
      name: "Moderate Failures",
      description: "10 controls: 7 pass / 3 fail including 1 high severity",
      expectedGrade: "C",
      expectedScoreRange: [65, 79],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark C1: Moderate Failures",
          issuer: "Manual Assessment",
          date: today,
          scope: "Web Application",
          reportType: "JSON",
        },
        controls: makeControls(10, {
          passRate: 0.7,
          severityMix: ["HIGH", "CRITICAL", "MEDIUM", "LOW", "MEDIUM", "HIGH", "LOW", "MEDIUM", "HIGH", "LOW"],
          withEvidence: true,
          withFrameworks: false,
        }),
      },
    },
    {
      id: "c-stale-evidence",
      name: "Stale Evidence",
      description: "8 controls all pass but evidence is 6 months old (recency hit)",
      expectedGrade: "C",
      expectedScoreRange: [65, 79],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark C2: Stale Evidence",
          issuer: "Manual Assessment",
          date: sixMonthsAgo,
          scope: "Legacy System",
          reportType: "JSON",
        },
        controls: makeControls(8, {
          passRate: 1.0,
          severityMix: repeat(["MEDIUM", "LOW"], 4),
          withEvidence: true,
          withFrameworks: false,
        }),
      },
    },
    {
      id: "c-mixed-results",
      name: "Mixed Results",
      description: "10 controls: 6 pass, 2 fail, 2 skipped, limited evidence",
      expectedGrade: "C",
      expectedScoreRange: [65, 79],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark C3: Mixed Results",
          issuer: "Internal Team",
          date: today,
          scope: "Network Security",
          reportType: "JSON",
        },
        controls: makeControls(10, {
          passRate: 0.6,
          skipRate: 0.2,
          severityMix: repeat(["MEDIUM", "HIGH", "LOW", "MEDIUM", "LOW"], 2),
          withEvidence: true,
          withFrameworks: false,
          evidenceGapCount: 3,
        }),
      },
    },
  ];
}

// =============================================================================
// CASE GENERATORS — GRADE D (Poor)
// =============================================================================

function generateDCases(): BenchmarkCase[] {
  const today = new Date().toISOString().split("T")[0];
  const nineMonthsAgo = new Date(Date.now() - 270 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return [
    {
      id: "d-many-failures",
      name: "Many Failures",
      description: "10 controls: 5 pass / 5 fail including critical, weak evidence",
      expectedGrade: "D",
      expectedScoreRange: [50, 69],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark D1: Many Failures",
          issuer: "Unknown",
          date: today,
          scope: "Unknown System",
          reportType: "JSON",
        },
        controls: makeControls(10, {
          passRate: 0.5,
          severityMix: ["CRITICAL", "HIGH", "HIGH", "MEDIUM", "LOW", "CRITICAL", "HIGH", "MEDIUM", "LOW", "LOW"],
          withEvidence: false,
          withFrameworks: false,
        }),
      },
    },
    {
      id: "d-old-and-failing",
      name: "Old and Failing",
      description: "8 controls: 4 pass / 4 fail, evidence 9 months old",
      expectedGrade: "D",
      expectedScoreRange: [50, 69],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark D2: Old and Failing",
          issuer: "Unknown",
          date: nineMonthsAgo,
          scope: "Legacy Application",
          reportType: "JSON",
        },
        controls: makeControls(8, {
          passRate: 0.5,
          severityMix: repeat(["HIGH", "MEDIUM", "LOW", "CRITICAL"], 2),
          withEvidence: true,
          withFrameworks: false,
          evidenceGapCount: 4,
        }),
      },
    },
    {
      id: "d-mostly-skipped",
      name: "Mostly Skipped",
      description: "10 controls: 3 pass, 2 fail, 5 skipped (completeness hit)",
      expectedGrade: "D",
      expectedScoreRange: [50, 69],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark D3: Mostly Skipped",
          issuer: "Unknown",
          date: today,
          scope: "Partial Assessment",
          reportType: "JSON",
        },
        controls: makeControls(10, {
          passRate: 0.3,
          skipRate: 0.5,
          severityMix: repeat(["MEDIUM", "LOW", "HIGH", "MEDIUM", "LOW"], 2),
          withEvidence: false,
          withFrameworks: false,
        }),
      },
    },
  ];
}

// =============================================================================
// CASE GENERATORS — GRADE F (Failing)
// =============================================================================

function generateFCases(): BenchmarkCase[] {
  const today = new Date().toISOString().split("T")[0];
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return [
    {
      id: "f-all-fail",
      name: "All Controls Fail",
      description: "8 controls all failing, critical severity, no evidence",
      expectedGrade: "F",
      expectedScoreRange: [0, 59],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark F1: All Fail",
          issuer: "Unknown",
          date: today,
          scope: "Critical System",
          reportType: "JSON",
        },
        controls: makeControls(8, {
          passRate: 0.0,
          severityMix: repeat(["CRITICAL", "HIGH", "HIGH", "CRITICAL"], 2),
          withEvidence: false,
          withFrameworks: false,
        }),
      },
    },
    {
      id: "f-no-evidence",
      name: "No Evidence",
      description: "6 controls all skipped (not-tested), completely empty",
      expectedGrade: "F",
      expectedScoreRange: [0, 59],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark F2: No Evidence",
          issuer: "Unknown",
          date: yearAgo,
          scope: "Unknown",
          reportType: "JSON",
        },
        controls: makeControls(6, {
          passRate: 0.0,
          skipRate: 1.0,
          severityMix: repeat(["LOW", "MEDIUM", "LOW"], 2),
          withEvidence: false,
          withFrameworks: false,
        }),
      },
    },
    {
      id: "f-expired-self-assessed",
      name: "Expired Self-Assessed",
      description: "10 controls: 2 pass, 8 fail, year-old, no framework mapping, self-assessed",
      expectedGrade: "F",
      expectedScoreRange: [0, 59],
      format: "generic",
      evidence: {
        metadata: {
          title: "Benchmark F3: Expired Self-Assessed",
          issuer: "Unknown",
          date: yearAgo,
          scope: "Unknown System",
          reportType: "JSON",
        },
        controls: makeControls(10, {
          passRate: 0.2,
          severityMix: ["CRITICAL", "HIGH", "HIGH", "CRITICAL", "MEDIUM", "HIGH", "CRITICAL", "HIGH", "HIGH", "CRITICAL"],
          withEvidence: false,
          withFrameworks: false,
        }),
      },
    },
  ];
}

// =============================================================================
// CONTROL FACTORY HELPERS
// =============================================================================

interface ControlFactoryOptions {
  passRate: number;
  skipRate?: number;
  severityMix: string[];
  withEvidence: boolean;
  withFrameworks: boolean;
  multiFramework?: boolean;
  evidenceGapCount?: number;
}

/**
 * Generate an array of generic-format controls with the given characteristics.
 */
function makeControls(
  count: number,
  opts: ControlFactoryOptions,
): object[] {
  const controls: object[] = [];
  const skipRate = opts.skipRate ?? 0;
  const passCount = Math.round(count * opts.passRate);
  const skipCount = Math.round(count * skipRate);
  const failCount = count - passCount - skipCount;

  // Build status array: passes first, then fails, then skips
  const statuses: string[] = [];
  for (let i = 0; i < passCount; i++) statuses.push("pass");
  for (let i = 0; i < failCount; i++) statuses.push("fail");
  for (let i = 0; i < skipCount; i++) statuses.push("not-tested");
  // Pad if rounding leaves us short
  while (statuses.length < count) statuses.push("not-tested");

  let evidenceGapsApplied = 0;

  for (let i = 0; i < count; i++) {
    const controlId = `BM-CTRL-${String(i + 1).padStart(3, "0")}`;
    const severity = opts.severityMix[i % opts.severityMix.length];
    const status = statuses[i];

    // Evidence string — some cases intentionally leave evidence empty
    let evidence: string | undefined;
    if (opts.withEvidence && !(opts.evidenceGapCount && evidenceGapsApplied < opts.evidenceGapCount && status === "pass")) {
      evidence = `Automated scan result for ${controlId}. Configuration verified at ${new Date().toISOString()}. Tool output confirms ${status === "pass" ? "compliance" : "non-compliance"}.`;
    } else if (opts.evidenceGapCount && evidenceGapsApplied < opts.evidenceGapCount && status === "pass") {
      evidence = undefined; // Intentional gap
      evidenceGapsApplied++;
    }

    const control: Record<string, unknown> = {
      id: controlId,
      description: `Benchmark control ${controlId}: ${status === "pass" ? "Security configuration enforced" : status === "fail" ? "Security configuration deficiency" : "Control not assessed"}`,
      status,
      severity,
    };

    if (evidence) {
      control.evidence = evidence;
    }

    if (opts.withFrameworks) {
      if (opts.multiFramework) {
        control.frameworks = [
          { framework: "NIST-800-53", controlId: `AC-${i + 1}`, controlName: `Access Control ${i + 1}` },
          { framework: "SOC2", controlId: `CC6.${i + 1}`, controlName: `Common Criteria ${i + 1}` },
          { framework: "ISO27001", controlId: `A.${i + 1}.1`, controlName: `ISO Control ${i + 1}` },
        ];
      } else {
        control.framework = "NIST-800-53";
        control.controlId = `AC-${i + 1}`;
        control.controlName = `Access Control ${i + 1}`;
      }
    }

    controls.push(control);
  }

  return controls;
}

/**
 * Repeat an array to reach a target length.
 */
function repeat(arr: string[], times: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < times; i++) {
    result.push(...arr);
  }
  return result;
}
