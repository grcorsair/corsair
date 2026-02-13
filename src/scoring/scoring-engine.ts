/**
 * Scoring Engine — 7-Dimension Evidence Quality Assessment
 *
 * The "FICO score for compliance" — deterministic, explainable,
 * computed from CanonicalControlEvidence[].
 *
 * Dimensions:
 *   1. Source Independence (0.20) — deterministic
 *   2. Recency (0.15) — deterministic
 *   3. Coverage (0.15) — deterministic
 *   4. Reproducibility (0.15) — deterministic
 *   5. Consistency (0.10) — deterministic
 *   6. Evidence Quality (0.15) — model-assisted (deterministic baseline)
 *   7. Completeness (0.10) — model-assisted (deterministic baseline)
 */

import type { CanonicalControlEvidence } from "../normalize/types";
import type { EvidenceQualityScore, LetterGrade, ScoredDimension } from "./types";
import {
  DIMENSION_WEIGHTS,
  PROVENANCE_SCORES,
  REPRODUCIBILITY_SCORES,
  EVIDENCE_QUALITY_SCORES,
  REPRODUCIBILITY_RECEIPT_BONUS,
  SCORING_ENGINE_VERSION,
} from "./types";

// =============================================================================
// OPTIONS
// =============================================================================

export interface ScoreOptions {
  /** Whether process provenance receipts are present (+10 reproducibility bonus) */
  hasProcessProvenance?: boolean;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Score an array of canonical control evidence across 7 dimensions.
 *
 * Returns a composite 0-100 score, letter grade, and per-dimension breakdown.
 */
export function scoreEvidence(
  controls: CanonicalControlEvidence[],
  options: ScoreOptions = {},
): EvidenceQualityScore {
  if (controls.length === 0) {
    return emptyScore();
  }

  const dimensions: ScoredDimension[] = [
    scoreSourceIndependence(controls),
    scoreRecency(controls),
    scoreCoverage(controls),
    scoreReproducibility(controls, options),
    scoreConsistency(controls),
    scoreEvidenceQuality(controls),
    scoreCompleteness(controls),
  ];

  const composite = round(dimensions.reduce((sum, d) => sum + d.weighted, 0));

  return {
    composite,
    grade: computeGrade(composite),
    dimensions,
    controlsScored: controls.length,
    scoredAt: new Date().toISOString(),
    engineVersion: SCORING_ENGINE_VERSION,
  };
}

// =============================================================================
// DIMENSION 1: SOURCE INDEPENDENCE (weight: 0.20)
// =============================================================================

function scoreSourceIndependence(controls: CanonicalControlEvidence[]): ScoredDimension {
  const weight = DIMENSION_WEIGHTS.sourceIndependence;
  let total = 0;

  for (const ctrl of controls) {
    const provenance = ctrl.assurance.provenance;
    total += PROVENANCE_SCORES[provenance] ?? PROVENANCE_SCORES.self;
  }

  const score = round(total / controls.length);
  const provenanceCounts = countBy(controls, c => c.assurance.provenance);
  const parts = Object.entries(provenanceCounts)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return {
    name: "sourceIndependence",
    score,
    weight,
    weighted: round(score * weight),
    method: "deterministic",
    detail: `Weighted average of provenance scores (${parts})`,
  };
}

// =============================================================================
// DIMENSION 2: RECENCY (weight: 0.15)
// =============================================================================

function scoreRecency(controls: CanonicalControlEvidence[]): ScoredDimension {
  const weight = DIMENSION_WEIGHTS.recency;
  const now = Date.now();
  let total = 0;

  for (const ctrl of controls) {
    const ts = Date.parse(ctrl.source.timestamp);
    if (isNaN(ts)) {
      total += 0;
      continue;
    }
    const daysSince = (now - ts) / (24 * 60 * 60 * 1000);
    const recencyScore = 100 * Math.max(0, 1 - daysSince / 365);
    total += recencyScore;
  }

  const score = round(total / controls.length);

  return {
    name: "recency",
    score,
    weight,
    weighted: round(score * weight),
    method: "deterministic",
    detail: `Average recency across ${controls.length} controls (100 = today, 0 = 365+ days)`,
  };
}

// =============================================================================
// DIMENSION 3: COVERAGE (weight: 0.15)
// =============================================================================

function scoreCoverage(controls: CanonicalControlEvidence[]): ScoredDimension {
  const weight = DIMENSION_WEIGHTS.coverage;
  let covered = 0;

  for (const ctrl of controls) {
    const hasEvidence = ctrl.evidence.summary !== undefined && ctrl.evidence.summary.length > 0;
    if (hasEvidence) {
      covered++;
    }
  }

  const score = round((covered / controls.length) * 100);

  return {
    name: "coverage",
    score,
    weight,
    weighted: round(score * weight),
    method: "deterministic",
    detail: `${covered}/${controls.length} controls have evidence`,
  };
}

// =============================================================================
// DIMENSION 4: REPRODUCIBILITY (weight: 0.15)
// =============================================================================

function scoreReproducibility(
  controls: CanonicalControlEvidence[],
  options: ScoreOptions,
): ScoredDimension {
  const weight = DIMENSION_WEIGHTS.reproducibility;
  let total = 0;

  for (const ctrl of controls) {
    const evidenceType = ctrl.evidence.type;
    total += REPRODUCIBILITY_SCORES[evidenceType] ?? 40;
  }

  let score = round(total / controls.length);

  if (options.hasProcessProvenance) {
    score = Math.min(100, score + REPRODUCIBILITY_RECEIPT_BONUS);
  }

  return {
    name: "reproducibility",
    score,
    weight,
    weighted: round(score * weight),
    method: "deterministic",
    detail: `Average reproducibility by evidence type${options.hasProcessProvenance ? " (+10 provenance bonus)" : ""}`,
  };
}

// =============================================================================
// DIMENSION 5: CONSISTENCY (weight: 0.10)
// =============================================================================

function scoreConsistency(controls: CanonicalControlEvidence[]): ScoredDimension {
  const weight = DIMENSION_WEIGHTS.consistency;

  // Group controls by controlId to find multi-source assessments
  const byControlId = new Map<string, CanonicalControlEvidence[]>();
  for (const ctrl of controls) {
    const existing = byControlId.get(ctrl.controlId) ?? [];
    existing.push(ctrl);
    byControlId.set(ctrl.controlId, existing);
  }

  // Check how many controls have multiple sources
  let multiSourceCount = 0;
  let agreementCount = 0;
  let disagreementCount = 0;

  for (const [, group] of byControlId) {
    // Find distinct tools assessing the same control
    const tools = new Set(group.map(c => c.source.tool));
    if (tools.size <= 1) continue;

    multiSourceCount++;

    // Check if all statuses agree
    const statuses = new Set(group.map(c => c.status));
    if (statuses.size === 1) {
      agreementCount++;
    } else {
      disagreementCount++;
    }
  }

  let score: number;
  if (multiSourceCount === 0) {
    // Single source — neutral score
    score = 70;
  } else {
    // Base: 90 for agreement, penalize for disagreement
    const agreementRatio = agreementCount / multiSourceCount;
    score = round(90 * agreementRatio + 30 * (1 - agreementRatio));
  }

  return {
    name: "consistency",
    score,
    weight,
    weighted: round(score * weight),
    method: "deterministic",
    detail: multiSourceCount === 0
      ? "Single source — neutral (70)"
      : `${agreementCount}/${multiSourceCount} multi-source controls agree`,
  };
}

// =============================================================================
// DIMENSION 6: EVIDENCE QUALITY (weight: 0.15, model-assisted baseline)
// =============================================================================

function scoreEvidenceQuality(controls: CanonicalControlEvidence[]): ScoredDimension {
  const weight = DIMENSION_WEIGHTS.evidenceQuality;
  let total = 0;

  for (const ctrl of controls) {
    const evidenceType = ctrl.evidence.type;
    total += EVIDENCE_QUALITY_SCORES[evidenceType] ?? 40;
  }

  const score = round(total / controls.length);

  return {
    name: "evidenceQuality",
    score,
    weight,
    weighted: round(score * weight),
    method: "model-assisted",
    detail: `Deterministic baseline by evidence type (model enhancement not yet active)`,
  };
}

// =============================================================================
// DIMENSION 7: COMPLETENESS (weight: 0.10, model-assisted baseline)
// =============================================================================

function scoreCompleteness(controls: CanonicalControlEvidence[]): ScoredDimension {
  const weight = DIMENSION_WEIGHTS.completeness;
  let nonSkip = 0;

  for (const ctrl of controls) {
    if (ctrl.status !== "skip") {
      nonSkip++;
    }
  }

  const score = round((nonSkip / controls.length) * 100);

  return {
    name: "completeness",
    score,
    weight,
    weighted: round(score * weight),
    method: "model-assisted",
    detail: `${nonSkip}/${controls.length} controls assessed (non-skip)`,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function computeGrade(composite: number): LetterGrade {
  if (composite >= 90) return "A";
  if (composite >= 80) return "B";
  if (composite >= 70) return "C";
  if (composite >= 60) return "D";
  return "F";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyScore(): EvidenceQualityScore {
  const names = Object.keys(DIMENSION_WEIGHTS) as (keyof typeof DIMENSION_WEIGHTS)[];
  const methods: Record<string, "deterministic" | "model-assisted"> = {
    sourceIndependence: "deterministic",
    recency: "deterministic",
    coverage: "deterministic",
    reproducibility: "deterministic",
    consistency: "deterministic",
    evidenceQuality: "model-assisted",
    completeness: "model-assisted",
  };

  return {
    composite: 0,
    grade: "F",
    dimensions: names.map(name => ({
      name,
      score: 0,
      weight: DIMENSION_WEIGHTS[name],
      weighted: 0,
      method: methods[name],
      detail: "No controls to score",
    })),
    controlsScored: 0,
    scoredAt: new Date().toISOString(),
    engineVersion: SCORING_ENGINE_VERSION,
  };
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
