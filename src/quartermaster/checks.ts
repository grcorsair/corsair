/**
 * Quartermaster Governance Checks — Deterministic Evidence Analysis
 *
 * Pure logic checks that run WITHOUT any LLM involvement.
 * Each check returns GovernanceFinding[] for specific governance issues.
 *
 * Checks:
 *   1. Evidence gaps — passing controls with empty/missing evidence
 *   2. Severity mismatch — critical controls with weak evidence type
 *   3. Framework coverage — controls missing framework references
 *   4. Consistency — same control with conflicting statuses across sources
 *   5. Boilerplate — identical evidence summaries across multiple controls
 *   6. Recency — evidence older than configurable threshold
 */

import type { CanonicalControlEvidence } from "../normalize/types";
import type { GovernanceFinding } from "./types";

// =============================================================================
// 1. EVIDENCE GAP CHECK
// =============================================================================

/**
 * Detect passing controls with empty or missing evidence summaries.
 * A control that "passes" without evidence is a governance red flag.
 */
export function checkEvidenceGaps(controls: CanonicalControlEvidence[]): GovernanceFinding[] {
  const gapIds: string[] = [];

  for (const ctrl of controls) {
    if (ctrl.status !== "pass") continue;
    if (!ctrl.evidence.summary || ctrl.evidence.summary.length === 0) {
      gapIds.push(ctrl.controlId);
    }
  }

  if (gapIds.length === 0) return [];

  return [{
    id: "qm-evidence-gap",
    severity: "critical",
    category: "evidence_quality",
    description: `${gapIds.length} control(s) marked as passing but have no evidence summary`,
    remediation: "Provide evidence for each passing control — scans, test results, or configuration exports",
    controlIds: gapIds,
  }];
}

// =============================================================================
// 2. SEVERITY MISMATCH CHECK
// =============================================================================

/** Weak evidence types that are insufficient for critical/high controls */
const WEAK_EVIDENCE_TYPES = new Set(["document", "attestation"]);

/** Severities that require strong evidence */
const HIGH_SEVERITY = new Set(["critical", "high"]);

/**
 * Detect critical/high controls that pass with only weak evidence types.
 * A critical control should have scan/test/config evidence, not just a document.
 */
export function checkSeverityMismatch(controls: CanonicalControlEvidence[]): GovernanceFinding[] {
  const mismatchIds: string[] = [];

  for (const ctrl of controls) {
    if (ctrl.status !== "pass") continue;
    if (!HIGH_SEVERITY.has(ctrl.severity)) continue;
    if (WEAK_EVIDENCE_TYPES.has(ctrl.evidence.type)) {
      mismatchIds.push(ctrl.controlId);
    }
  }

  if (mismatchIds.length === 0) return [];

  return [{
    id: "qm-severity-mismatch",
    severity: "warning",
    category: "methodology",
    description: `${mismatchIds.length} critical/high severity control(s) pass with only document/attestation evidence`,
    remediation: "Provide scan, test, or configuration evidence for critical and high severity controls",
    controlIds: mismatchIds,
  }];
}

// =============================================================================
// 3. FRAMEWORK COVERAGE CHECK
// =============================================================================

/**
 * Detect controls that have no framework references.
 * Not a blocker, but reduces traceability.
 */
export function checkFrameworkCoverage(controls: CanonicalControlEvidence[]): GovernanceFinding[] {
  const unmappedIds: string[] = [];

  for (const ctrl of controls) {
    if (!ctrl.frameworks || ctrl.frameworks.length === 0) {
      unmappedIds.push(ctrl.controlId);
    }
  }

  if (unmappedIds.length === 0) return [];

  return [{
    id: "qm-framework-coverage",
    severity: "info",
    category: "completeness",
    description: `${unmappedIds.length} control(s) have no framework references`,
    remediation: "Map controls to compliance frameworks (SOC 2, NIST 800-53, ISO 27001) for traceability",
    controlIds: unmappedIds,
  }];
}

// =============================================================================
// 4. CONSISTENCY CHECK
// =============================================================================

/**
 * Detect controls with conflicting statuses across different source tools.
 * If Prowler says "pass" and InSpec says "fail" for the same control, that's a finding.
 */
export function checkConsistency(controls: CanonicalControlEvidence[]): GovernanceFinding[] {
  // Group by controlId
  const byControlId = new Map<string, CanonicalControlEvidence[]>();
  for (const ctrl of controls) {
    const existing = byControlId.get(ctrl.controlId) ?? [];
    existing.push(ctrl);
    byControlId.set(ctrl.controlId, existing);
  }

  const findings: GovernanceFinding[] = [];

  for (const [controlId, group] of byControlId) {
    // Only check multi-source controls (different tools)
    const tools = new Set(group.map(c => c.source.tool));
    if (tools.size <= 1) continue;

    // Check if statuses disagree
    const statuses = new Set(group.map(c => c.status));
    if (statuses.size > 1) {
      const toolList = Array.from(tools).join(", ");
      const statusList = Array.from(statuses).join(", ");
      findings.push({
        id: `qm-consistency-${controlId}`,
        severity: "critical",
        category: "consistency",
        description: `Control ${controlId} has conflicting statuses (${statusList}) across sources (${toolList})`,
        remediation: "Investigate and reconcile the conflicting assessments for this control",
        controlIds: [controlId],
      });
    }
  }

  return findings;
}

// =============================================================================
// 5. BOILERPLATE DETECTION CHECK
// =============================================================================

/** Minimum number of controls sharing a summary to trigger boilerplate detection */
const BOILERPLATE_THRESHOLD = 3;

/**
 * Detect identical evidence summaries across multiple controls.
 * Copy-pasted evidence is a sign of low-effort assessment.
 */
export function checkBoilerplate(controls: CanonicalControlEvidence[]): GovernanceFinding[] {
  // Group controls by their evidence summary
  const bySummary = new Map<string, string[]>();

  for (const ctrl of controls) {
    const summary = ctrl.evidence.summary;
    // Skip empty summaries (handled by evidence gap check)
    if (!summary || summary.length === 0) continue;

    const existing = bySummary.get(summary) ?? [];
    existing.push(ctrl.controlId);
    bySummary.set(summary, existing);
  }

  const findings: GovernanceFinding[] = [];
  let groupIndex = 0;

  for (const [summary, controlIds] of bySummary) {
    if (controlIds.length >= BOILERPLATE_THRESHOLD) {
      groupIndex++;
      const preview = summary.length > 50 ? summary.slice(0, 50) + "..." : summary;
      findings.push({
        id: `qm-boilerplate-${groupIndex}`,
        severity: "warning",
        category: "bias",
        description: `${controlIds.length} controls share identical evidence: "${preview}"`,
        remediation: "Provide control-specific evidence rather than copy-pasting the same summary",
        controlIds,
      });
    }
  }

  return findings;
}

// =============================================================================
// 6. RECENCY CHECK
// =============================================================================

/** Default recency threshold in days */
const DEFAULT_RECENCY_THRESHOLD_DAYS = 180;

/**
 * Detect evidence older than a configurable threshold.
 * Stale evidence weakens the assessment.
 */
export function checkRecency(
  controls: CanonicalControlEvidence[],
  thresholdDays: number = DEFAULT_RECENCY_THRESHOLD_DAYS,
): GovernanceFinding[] {
  const now = Date.now();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  const staleIds: string[] = [];

  for (const ctrl of controls) {
    const ts = Date.parse(ctrl.source.timestamp);
    if (isNaN(ts) || (now - ts) > thresholdMs) {
      staleIds.push(ctrl.controlId);
    }
  }

  if (staleIds.length === 0) return [];

  return [{
    id: "qm-recency",
    severity: "warning",
    category: "methodology",
    description: `${staleIds.length} control(s) have evidence older than ${thresholdDays} days or invalid timestamps`,
    remediation: `Re-assess controls with evidence older than ${thresholdDays} days to maintain assessment validity`,
    controlIds: staleIds,
  }];
}

// =============================================================================
// RUN ALL CHECKS
// =============================================================================

/**
 * Run all deterministic governance checks on the given controls.
 * Returns a combined list of findings from all checks.
 */
export function runAllChecks(controls: CanonicalControlEvidence[]): GovernanceFinding[] {
  if (controls.length === 0) return [];

  return [
    ...checkEvidenceGaps(controls),
    ...checkSeverityMismatch(controls),
    ...checkFrameworkCoverage(controls),
    ...checkConsistency(controls),
    ...checkBoilerplate(controls),
    ...checkRecency(controls),
  ];
}
