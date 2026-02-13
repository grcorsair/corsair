/**
 * Audit Engine — Full Compliance Audit Orchestration
 *
 * Orchestrates: ingest evidence -> normalize -> score -> generate findings -> sign results
 *
 * Pipeline:
 *   1. Read evidence files from scope.evidencePaths
 *   2. Parse each file using json-parser (with optional format override)
 *   3. Normalize parsed documents into canonical form
 *   4. Filter excluded controls
 *   5. Score combined evidence (if config.includeScore)
 *   6. Run governance checks (if config.includeGovernance)
 *   7. Generate findings from normalized evidence (if config.generateFindings)
 *   8. Compute summary statistics
 *   9. Return complete AuditResult
 */

import { randomUUID } from "crypto";
import { parseJSON } from "../ingestion/json-parser";
import type { ParseJSONOptions } from "../ingestion/json-parser";
import { normalizeDocument } from "../normalize/normalize";
import type { NormalizedEvidence, CanonicalControlEvidence } from "../normalize/types";
import { scoreEvidence } from "../scoring/scoring-engine";
import type { EvidenceQualityScore, LetterGrade } from "../scoring/types";
import { reviewEvidence } from "../quartermaster/quartermaster";
import type { GovernanceReport } from "../quartermaster/types";
import type {
  AuditScope,
  AuditResult,
  AuditConfig,
  AuditFinding,
} from "./types";

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: AuditConfig = {
  includeGovernance: false,
  includeScore: true,
  generateFindings: true,
  signResult: false,
  outputFormat: "json",
};

// =============================================================================
// SEVERITY ORDERING
// =============================================================================

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Run a full compliance audit.
 *
 * Orchestrates the complete pipeline: ingest -> normalize -> score -> findings.
 */
export async function runAudit(
  scope: AuditScope,
  config?: Partial<AuditConfig>,
): Promise<AuditResult> {
  const mergedConfig: AuditConfig = { ...DEFAULT_CONFIG, ...config };
  const startedAt = new Date();
  const auditId = `audit-${randomUUID()}`;

  // Step 1-4: Ingest, parse, normalize, filter
  const evidence = await ingestAndNormalize(scope);

  // Step 5: Score combined evidence
  const allControls = flattenControls(evidence);
  let score: EvidenceQualityScore;
  if (mergedConfig.includeScore && allControls.length > 0) {
    score = scoreEvidence(allControls);
  } else {
    score = emptyScore();
  }

  // Step 6: Governance checks
  let governance: GovernanceReport | undefined;
  if (mergedConfig.includeGovernance && allControls.length > 0) {
    governance = await reviewEvidence(allControls);
  }

  // Step 7: Generate findings
  let findings: AuditFinding[];
  if (mergedConfig.generateFindings && evidence.length > 0) {
    findings = generateFindings(evidence);
  } else {
    findings = [];
  }

  // Step 8: Compute summary
  const completedAt = new Date();
  const summary = computeSummary(evidence, findings);

  return {
    id: auditId,
    scope,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    duration: completedAt.getTime() - startedAt.getTime(),
    evidence,
    score,
    findings,
    governance,
    summary,
  };
}

// =============================================================================
// INGEST AND NORMALIZE
// =============================================================================

/**
 * Read, parse, normalize, and filter evidence files.
 */
async function ingestAndNormalize(scope: AuditScope): Promise<NormalizedEvidence[]> {
  if (scope.evidencePaths.length === 0) return [];

  const results: NormalizedEvidence[] = [];

  for (let i = 0; i < scope.evidencePaths.length; i++) {
    const filePath = scope.evidencePaths[i];
    const formatOverride = scope.formats?.[i];

    // Read file
    const file = Bun.file(filePath);
    const content = await file.text();

    // Parse with optional format override
    const parseOptions: ParseJSONOptions = {};
    if (formatOverride) {
      parseOptions.format = formatOverride as ParseJSONOptions["format"];
    }
    const ingestedDoc = parseJSON(content, parseOptions);

    // Normalize
    let normalized = normalizeDocument(ingestedDoc);

    // Filter excluded controls
    if (scope.excludeControls && scope.excludeControls.length > 0) {
      const excludeSet = new Set(scope.excludeControls);
      const filteredControls = normalized.controls.filter(
        (c) => !excludeSet.has(c.controlId),
      );

      // Recompute stats after filtering
      const stats = computeControlStats(filteredControls);
      normalized = {
        controls: filteredControls,
        metadata: {
          ...normalized.metadata,
          stats,
        },
      };
    }

    results.push(normalized);
  }

  return results;
}

// =============================================================================
// FINDING GENERATION
// =============================================================================

/**
 * Generate audit findings from normalized evidence.
 *
 * Categories:
 *   - failure: Failed controls (severity matches control severity)
 *   - gap: Controls with no evidence (skipped + empty summary)
 *   - weakness: L0-only controls (self-assessed document evidence)
 *   - strength: Passed critical controls (info severity)
 *   - observation: Inconsistencies or notable patterns
 *
 * Findings are sorted by severity: critical -> high -> medium -> low -> info
 */
export function generateFindings(evidence: NormalizedEvidence[]): AuditFinding[] {
  if (evidence.length === 0) return [];

  const findings: AuditFinding[] = [];
  const counters: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const allControls = flattenControls(evidence);

  for (const ctrl of allControls) {
    // Failure findings: failed controls
    if (ctrl.status === "fail") {
      const severity = ctrl.severity;
      counters[severity] = (counters[severity] || 0) + 1;
      const prefix = severity === "critical" ? "CRIT" : severity.toUpperCase();
      findings.push({
        id: `${prefix}-${String(counters[severity]).padStart(3, "0")}`,
        severity,
        category: "failure",
        controlId: ctrl.controlId,
        title: `${ctrl.title} failed`,
        description: `Control ${ctrl.controlId} (${ctrl.title}) has status "fail". ${ctrl.description}`,
        recommendation: `Investigate and remediate control ${ctrl.controlId}`,
        evidence: {
          source: ctrl.source.tool,
          controlStatus: ctrl.status,
        },
      });
    }

    // Gap findings: skipped controls with no evidence
    if (ctrl.status === "skip" && (!ctrl.evidence.summary || ctrl.evidence.summary.length === 0)) {
      counters["info"] = (counters["info"] || 0) + 1;
      findings.push({
        id: `GAP-${String(counters["info"]).padStart(3, "0")}`,
        severity: "medium",
        category: "gap",
        controlId: ctrl.controlId,
        title: `No evidence for ${ctrl.controlId}`,
        description: `Control ${ctrl.controlId} (${ctrl.title}) has no assessment evidence.`,
        recommendation: `Provide evidence for control ${ctrl.controlId} via scanning, testing, or documentation`,
        evidence: {
          source: ctrl.source.tool,
          controlStatus: ctrl.status,
        },
      });
    }

    // Weakness findings: L0-only controls (self-assessed, document evidence)
    if (
      ctrl.status === "pass" &&
      ctrl.assurance.level === 0 &&
      ctrl.assurance.provenance === "self"
    ) {
      findings.push({
        id: `WEAK-${ctrl.controlId}`,
        severity: "low",
        category: "weakness",
        controlId: ctrl.controlId,
        title: `${ctrl.controlId} relies on self-assessment only`,
        description: `Control ${ctrl.controlId} passes at L0 (self-assessed) with "${ctrl.evidence.type}" evidence. Consider automated scanning for higher assurance.`,
        recommendation: `Upgrade evidence for ${ctrl.controlId} from self-assessment to tool scanning (L1+)`,
        evidence: {
          source: ctrl.source.tool,
          controlStatus: ctrl.status,
        },
      });
    }

    // Strength findings: passed critical controls
    if (ctrl.status === "pass" && ctrl.severity === "critical") {
      findings.push({
        id: `STR-${ctrl.controlId}`,
        severity: "info",
        category: "strength",
        controlId: ctrl.controlId,
        title: `Critical control ${ctrl.controlId} passes`,
        description: `Control ${ctrl.controlId} (${ctrl.title}) is a critical control and passes successfully.`,
        evidence: {
          source: ctrl.source.tool,
          controlStatus: ctrl.status,
        },
      });
    }
  }

  // Sort by severity: critical first
  findings.sort((a, b) => {
    const aOrder = SEVERITY_ORDER[a.severity] ?? 4;
    const bOrder = SEVERITY_ORDER[b.severity] ?? 4;
    return aOrder - bOrder;
  });

  return findings;
}

// =============================================================================
// FORMAT SUMMARY
// =============================================================================

/**
 * Format an audit result as a human-readable summary string.
 */
export function formatAuditSummary(result: AuditResult): string {
  const lines: string[] = [];

  lines.push("CORSAIR AUDIT REPORT");
  lines.push("=".repeat(50));
  lines.push(`Scope: ${result.scope.name}`);
  lines.push(`Frameworks: ${result.scope.frameworks.join(", ") || "None"}`);
  lines.push(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
  lines.push("");
  lines.push(`SCORE: ${result.summary.score}/100 (${result.summary.grade})`);
  lines.push("");
  lines.push(
    `Controls: ${result.summary.totalControls} total, ` +
    `${result.summary.passed} passed, ` +
    `${result.summary.failed} failed, ` +
    `${result.summary.skipped} skipped`,
  );
  lines.push(
    `Findings: ${result.summary.criticalFindings} critical, ` +
    `${result.summary.highFindings} high, ` +
    `${result.findings.filter(f => f.severity === "medium").length} medium, ` +
    `${result.findings.filter(f => f.severity === "low").length} low`,
  );

  // Critical findings
  const criticalFindings = result.findings.filter(f => f.severity === "critical");
  if (criticalFindings.length > 0) {
    lines.push("");
    lines.push("CRITICAL FINDINGS:");
    for (const f of criticalFindings) {
      lines.push(`  [${f.id}] ${f.title} (${f.controlId})`);
    }
  }

  // High findings
  const highFindings = result.findings.filter(f => f.severity === "high");
  if (highFindings.length > 0) {
    lines.push("");
    lines.push("HIGH FINDINGS:");
    for (const f of highFindings) {
      lines.push(`  [${f.id}] ${f.title} (${f.controlId})`);
    }
  }

  return lines.join("\n");
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Flatten all controls from all normalized evidence documents into one array.
 */
function flattenControls(evidence: NormalizedEvidence[]): CanonicalControlEvidence[] {
  const controls: CanonicalControlEvidence[] = [];
  for (const ev of evidence) {
    controls.push(...ev.controls);
  }
  return controls;
}

/**
 * Compute control statistics from a list of canonical controls.
 */
function computeControlStats(controls: CanonicalControlEvidence[]) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let errors = 0;

  for (const ctrl of controls) {
    switch (ctrl.status) {
      case "pass": passed++; break;
      case "fail": failed++; break;
      case "skip": skipped++; break;
      case "error": errors++; break;
    }
  }

  return { total: controls.length, passed, failed, skipped, errors };
}

/**
 * Compute audit summary from evidence and findings.
 */
function computeSummary(
  evidence: NormalizedEvidence[],
  findings: AuditFinding[],
): AuditResult["summary"] {
  let totalControls = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const ev of evidence) {
    totalControls += ev.metadata.stats.total;
    passed += ev.metadata.stats.passed;
    failed += ev.metadata.stats.failed;
    skipped += ev.metadata.stats.skipped;
  }

  const score = totalControls > 0 ? Math.round((passed / totalControls) * 100) : 0;
  const grade = computeGrade(score);

  const criticalFindings = findings.filter(f => f.severity === "critical").length;
  const highFindings = findings.filter(f => f.severity === "high").length;

  return {
    totalControls,
    passed,
    failed,
    skipped,
    score,
    grade,
    criticalFindings,
    highFindings,
  };
}

/**
 * Compute letter grade from score percentage.
 */
function computeGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Return an empty score (when scoring is disabled or no controls).
 */
function emptyScore(): EvidenceQualityScore {
  return {
    composite: 0,
    grade: "F",
    dimensions: [],
    controlsScored: 0,
    scoredAt: new Date().toISOString(),
    engineVersion: "1.0.0",
  };
}
