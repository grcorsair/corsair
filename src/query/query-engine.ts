/**
 * Query Engine — search, filter, aggregate, and sort over CanonicalControlEvidence.
 *
 * Filter chain: status → severity → framework → provenance → assurance → evidenceType → search
 * Aggregations are computed on the FILTERED set (not the full set).
 * Pagination (offset + limit) is applied AFTER sorting.
 */

import type {
  CanonicalControlEvidence,
  CanonicalSeverity,
  CanonicalStatus,
} from "../normalize/types";
import type { EvidenceQuery, QueryResult, QueryAggregations } from "./types";

// =============================================================================
// SEVERITY ORDINAL MAP
// =============================================================================

const SEVERITY_ORDINAL: Record<CanonicalSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

// =============================================================================
// HELPERS
// =============================================================================

/** Normalize a scalar-or-array filter value to an array */
function toArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

/** Build aggregations from a filtered set of controls */
function computeAggregations(controls: CanonicalControlEvidence[]): QueryAggregations {
  const byStatus: Record<CanonicalStatus, number> = { pass: 0, fail: 0, skip: 0, error: 0 };
  const bySeverity: Record<CanonicalSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byFramework: Record<string, number> = {};
  const byProvenance: Record<string, number> = { self: 0, tool: 0, auditor: 0 };
  const byAssurance: Record<string, number> = {};

  for (const c of controls) {
    byStatus[c.status]++;
    bySeverity[c.severity]++;
    byProvenance[c.assurance.provenance]++;

    const levelKey = String(c.assurance.level);
    byAssurance[levelKey] = (byAssurance[levelKey] ?? 0) + 1;

    for (const fm of c.frameworks) {
      byFramework[fm.framework] = (byFramework[fm.framework] ?? 0) + 1;
    }
  }

  return { byStatus, bySeverity, byFramework, byProvenance, byAssurance };
}

// =============================================================================
// COMPARATORS
// =============================================================================

type Comparator = (a: CanonicalControlEvidence, b: CanonicalControlEvidence) => number;

function compareBySeverity(a: CanonicalControlEvidence, b: CanonicalControlEvidence): number {
  return SEVERITY_ORDINAL[a.severity] - SEVERITY_ORDINAL[b.severity];
}

function compareByControlId(a: CanonicalControlEvidence, b: CanonicalControlEvidence): number {
  return a.controlId.localeCompare(b.controlId);
}

function compareByStatus(a: CanonicalControlEvidence, b: CanonicalControlEvidence): number {
  return a.status.localeCompare(b.status);
}

function compareByAssurance(a: CanonicalControlEvidence, b: CanonicalControlEvidence): number {
  return a.assurance.level - b.assurance.level;
}

const COMPARATORS: Record<string, Comparator> = {
  severity: compareBySeverity,
  controlId: compareByControlId,
  status: compareByStatus,
  assurance: compareByAssurance,
};

// =============================================================================
// QUERY ENGINE
// =============================================================================

/**
 * Query over a collection of normalized control evidence.
 *
 * Filter chain is applied in order: status → severity → framework → provenance → assurance → evidenceType → search.
 * Aggregations are computed on the filtered result set.
 * Sorting and pagination are applied last.
 */
export function queryEvidence(
  controls: CanonicalControlEvidence[],
  query: EvidenceQuery,
): QueryResult {
  let filtered = controls;

  // --- Status filter ---
  const statuses = toArray(query.status);
  if (statuses) {
    const set = new Set(statuses);
    filtered = filtered.filter((c) => set.has(c.status));
  }

  // --- Severity filter ---
  const severities = toArray(query.severity);
  if (severities) {
    const set = new Set(severities);
    filtered = filtered.filter((c) => set.has(c.severity));
  }

  // --- Framework filter (union) ---
  const frameworks = toArray(query.framework);
  if (frameworks) {
    const set = new Set(frameworks);
    filtered = filtered.filter((c) =>
      c.frameworks.some((fm) => set.has(fm.framework)),
    );
  }

  // --- Provenance filter ---
  const provenances = toArray(query.provenance);
  if (provenances) {
    const set = new Set(provenances);
    filtered = filtered.filter((c) => set.has(c.assurance.provenance));
  }

  // --- Assurance level filter (minimum inclusive) ---
  if (query.minAssurance !== undefined) {
    filtered = filtered.filter((c) => c.assurance.level >= query.minAssurance!);
  }

  // --- Evidence type filter ---
  const evidenceTypes = toArray(query.evidenceType);
  if (evidenceTypes) {
    const set = new Set(evidenceTypes);
    filtered = filtered.filter((c) => set.has(c.evidence.type));
  }

  // --- Text search (case-insensitive substring across controlId, title, description) ---
  if (query.search) {
    const needle = query.search.toLowerCase();
    filtered = filtered.filter((c) =>
      c.controlId.toLowerCase().includes(needle) ||
      c.title.toLowerCase().includes(needle) ||
      c.description.toLowerCase().includes(needle),
    );
  }

  // --- Aggregations (on filtered set, before pagination) ---
  const aggregations = computeAggregations(filtered);
  const total = filtered.length;

  // --- Sorting ---
  if (query.sortBy) {
    const comparator = COMPARATORS[query.sortBy];
    if (comparator) {
      const direction = query.sortDirection === "desc" ? -1 : 1;
      filtered = [...filtered].sort((a, b) => comparator(a, b) * direction);
    }
  }

  // --- Pagination ---
  const offset = query.offset ?? 0;
  if (query.limit !== undefined) {
    filtered = filtered.slice(offset, offset + query.limit);
  } else if (offset > 0) {
    filtered = filtered.slice(offset);
  }

  return { controls: filtered, total, aggregations };
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/** Find all controls with status=fail AND severity=critical */
export function findFailingCritical(
  controls: CanonicalControlEvidence[],
): CanonicalControlEvidence[] {
  return queryEvidence(controls, { status: "fail", severity: "critical" }).controls;
}

/** Find all controls mapped to a given framework */
export function findByFramework(
  controls: CanonicalControlEvidence[],
  framework: string,
): CanonicalControlEvidence[] {
  return queryEvidence(controls, { framework }).controls;
}

/** Produce a per-framework summary: { total, passed, failed } */
export function summarizeByFramework(
  controls: CanonicalControlEvidence[],
): Record<string, { total: number; passed: number; failed: number }> {
  const summary: Record<string, { total: number; passed: number; failed: number }> = {};

  for (const c of controls) {
    for (const fm of c.frameworks) {
      if (!summary[fm.framework]) {
        summary[fm.framework] = { total: 0, passed: 0, failed: 0 };
      }
      summary[fm.framework].total++;
      if (c.status === "pass") summary[fm.framework].passed++;
      if (c.status === "fail") summary[fm.framework].failed++;
    }
  }

  return summary;
}

/** Find controls that regressed (pass → fail) between two evidence sets */
export function findRegressions(
  current: CanonicalControlEvidence[],
  previous: CanonicalControlEvidence[],
): CanonicalControlEvidence[] {
  const previousMap = new Map<string, CanonicalControlEvidence>();
  for (const c of previous) {
    previousMap.set(c.controlId, c);
  }

  return current.filter((c) => {
    const prev = previousMap.get(c.controlId);
    return prev !== undefined && prev.status === "pass" && c.status === "fail";
  });
}
