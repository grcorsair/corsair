/**
 * Quartermaster v2 — Governance Review Engine
 *
 * Enhances the scoring engine's output with governance findings
 * and adjusts dimension scores based on finding severity.
 *
 * Flow:
 *   1. Run scoring engine (get baseline score)
 *   2. Run deterministic governance checks (get findings)
 *   3. If model !== "deterministic", enhance via LLM (placeholder — not implemented)
 *   4. Adjust dimension scores based on findings
 *   5. Recompute composite and grade
 *   6. Return GovernanceReport
 */

import type { CanonicalControlEvidence } from "../normalize/types";
import type { EvidenceQualityScore, LetterGrade, ScoredDimension } from "../scoring/types";
import { scoreEvidence } from "../scoring/scoring-engine";
import { runAllChecks } from "./checks";
import type { GovernanceReport, GovernanceFinding, QuartermasterConfig } from "./types";
import { CATEGORY_TO_DIMENSION, SEVERITY_PENALTY } from "./types";

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: QuartermasterConfig = {
  model: "deterministic",
};

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

/**
 * Review an array of canonical control evidence.
 *
 * Returns a GovernanceReport with:
 * - Enhanced score (scoring engine + finding adjustments)
 * - Governance findings (deterministic checks)
 * - Model metadata
 */
export async function reviewEvidence(
  controls: CanonicalControlEvidence[],
  config: QuartermasterConfig = DEFAULT_CONFIG,
): Promise<GovernanceReport> {
  // Step 1: Run scoring engine for baseline
  const baselineScore = scoreEvidence(controls);

  // Step 2: Run deterministic governance checks
  const findings = controls.length > 0 ? runAllChecks(controls) : [];

  // Step 3: Model enhancement (placeholder — deterministic fallback)
  const modelEnhanced = false;
  // When config.model !== "deterministic", model enhancement would run here.
  // Currently always falls back to deterministic mode.

  // Step 4: Adjust dimension scores based on findings
  const adjustedScore = adjustScores(baselineScore, findings);

  // Step 5: Return report
  return {
    score: adjustedScore,
    findings,
    model: "deterministic",
    reviewedAt: new Date().toISOString(),
    modelEnhanced,
  };
}

// =============================================================================
// SCORE ADJUSTMENT
// =============================================================================

/**
 * Adjust dimension scores based on governance findings.
 *
 * - Each critical finding reduces the relevant dimension score by 10
 * - Each warning reduces by 5
 * - Info findings have no score impact
 * - Dimension scores floor at 0
 * - Composite is recomputed after adjustments
 */
function adjustScores(
  baselineScore: EvidenceQualityScore,
  findings: GovernanceFinding[],
): EvidenceQualityScore {
  // Clone dimensions for modification
  const dimensions: ScoredDimension[] = baselineScore.dimensions.map(d => ({ ...d }));

  // Build penalty map: dimension name -> total penalty
  const penalties = new Map<string, number>();

  for (const finding of findings) {
    const penalty = SEVERITY_PENALTY[finding.severity];
    if (penalty === 0) continue;

    const dimensionName = CATEGORY_TO_DIMENSION[finding.category];
    if (!dimensionName) continue;

    const current = penalties.get(dimensionName) ?? 0;
    penalties.set(dimensionName, current + penalty);
  }

  // Apply penalties to dimensions
  for (const dim of dimensions) {
    const penalty = penalties.get(dim.name);
    if (penalty === undefined) continue;

    dim.score = Math.max(0, dim.score - penalty);
    dim.weighted = round(dim.score * dim.weight);
  }

  // Recompute composite
  const composite = round(dimensions.reduce((sum, d) => sum + d.weighted, 0));

  return {
    ...baselineScore,
    composite,
    grade: computeGrade(composite),
    dimensions,
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
