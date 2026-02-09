/**
 * CRQ Mapper — CPOE → Risk Quantification Output
 *
 * Maps CPOE assurance data to risk quantification models consumed by
 * CRQ platforms (SAFE, Balbix, etc.) and TPRM tools.
 *
 * Three mapping layers:
 *   1. BetaPERT: L0-L4 → shape parameter for Monte Carlo simulation
 *   2. FAIR-CAM: Assurance → resistance strength + control effectiveness
 *   3. Modifiers: Provenance (Three Lines Model) + freshness decay
 *
 * Key insight from FAIR-CAM: Controls are NOT binary. They have varying
 * degrees of effectiveness measured by Capability × Coverage × Reliability.
 * The CPOE assurance level and dimensions capture this directly.
 *
 * Corsair is FICO for compliance — standardized score consumed by all
 * CRQ/TPRM platforms, like FICO (300-850) consumed by all lenders.
 */

import type {
  CPOEAssurance,
  CPOEProvenance,
  AssuranceDimensions,
  CPOERiskQuantification,
} from "./vc-types";

// =============================================================================
// MAIN COMPUTATION
// =============================================================================

/**
 * Compute risk quantification output from CPOE data.
 *
 * @param assurance - CPOE assurance metadata (declared level, breakdown)
 * @param provenance - Who produced the evidence (self/tool/auditor)
 * @param summary - Control test results summary
 * @param issuedAt - ISO 8601 date when the CPOE was issued
 * @param dimensions - Optional 7-dimension scores for confidence calculation
 */
export function computeRiskQuantification(
  assurance: CPOEAssurance,
  provenance: CPOEProvenance,
  summary: { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number },
  issuedAt: string,
  dimensions?: AssuranceDimensions,
): CPOERiskQuantification {
  return {
    betaPert: computeBetaPert(assurance.declared),
    fairMapping: computeFairMapping(assurance, summary),
    provenanceModifier: computeProvenanceModifier(provenance.source),
    freshnessDecay: computeFreshnessDecay(issuedAt),
    dimensionConfidence: computeDimensionConfidence(dimensions),
  };
}

// =============================================================================
// BETAPERT MAPPING (L0-L4 → Shape Parameter)
// =============================================================================

/**
 * Map assurance level to BetaPERT distribution shape parameter.
 *
 * BetaPERT is the standard distribution for expert elicitation in risk
 * analysis (FAIR, SPERT, Crystal Ball). The shape parameter (γ) controls
 * how concentrated the distribution is around the most likely value:
 *
 *   L0 (γ=2): Very wide — minimal confidence, could be anything
 *   L1 (γ=4): Wide — some evidence narrows the range
 *   L2 (γ=6): Moderate — test results provide reasonable confidence
 *   L3 (γ=8): Narrow — continuous monitoring, high confidence
 *   L4 (γ=10): Very narrow — independently verified, maximum confidence
 *
 * The shape parameter feeds directly into Monte Carlo simulation:
 *   mean = (min + γ*mode + max) / (γ + 2)
 */
export function computeBetaPert(
  declared: number,
): CPOERiskQuantification["betaPert"] {
  const shapeMap: Record<number, number> = { 0: 2, 1: 4, 2: 6, 3: 8, 4: 10 };
  const widthMap: Record<number, CPOERiskQuantification["betaPert"]["confidenceWidth"]> = {
    0: "very-wide",
    1: "wide",
    2: "moderate",
    3: "narrow",
    4: "very-narrow",
  };

  return {
    shapeParameter: shapeMap[declared] ?? 2,
    confidenceWidth: widthMap[declared] ?? "very-wide",
  };
}

// =============================================================================
// FAIR-CAM MAPPING
// =============================================================================

/**
 * Map CPOE assurance to FAIR-CAM resistance strength and control effectiveness.
 *
 * FAIR-CAM (Control Analytics Model) defines three control functions:
 *   - Loss Event: Controls that prevent loss events from occurring
 *   - Variance Management: Controls that reduce the range of possible losses
 *   - Decision Support: Controls that improve risk decision quality
 *
 * Resistance strength maps from declared assurance level.
 * Control effectiveness maps from the pass rate (overallScore / 100).
 */
export function computeFairMapping(
  assurance: CPOEAssurance,
  summary: { overallScore: number },
): CPOERiskQuantification["fairMapping"] {
  const strengthMap: Record<number, CPOERiskQuantification["fairMapping"]["resistanceStrength"]> = {
    0: "very-low",
    1: "low",
    2: "moderate",
    3: "high",
    4: "very-high",
  };

  // Classify control function based on assurance method
  let controlFunction: CPOERiskQuantification["fairMapping"]["controlFunction"];
  switch (assurance.method) {
    case "continuous-observation":
      controlFunction = "variance-management"; // Reduces outcome variance
      break;
    case "third-party-attested":
      controlFunction = "decision-support"; // Improves confidence in decisions
      break;
    default:
      controlFunction = "loss-event"; // Prevents loss events (most common)
  }

  return {
    resistanceStrength: strengthMap[assurance.declared] ?? "very-low",
    controlEffectiveness: Math.min(1, Math.max(0, summary.overallScore / 100)),
    controlFunction,
  };
}

// =============================================================================
// PROVENANCE MODIFIER (Three Lines Model)
// =============================================================================

/**
 * Compute provenance modifier based on the Three Lines Model.
 *
 * The Three Lines Model (IIA, 2020) defines:
 *   1st Line: Management (self-assessment) → lowest independence
 *   2nd Line: Oversight functions (tools, internal review)
 *   3rd Line: Internal Audit
 *   External: External auditors → highest independence
 *
 * Modifier multiplied against CRQ confidence values:
 *   self   = 0.75 (25% discount for self-assessment bias)
 *   tool   = 1.00 (neutral — automated, no bias)
 *   auditor = 1.25 (25% premium for independent verification)
 */
export function computeProvenanceModifier(
  source: CPOEProvenance["source"],
): number {
  switch (source) {
    case "auditor": return 1.25;
    case "tool": return 1.0;
    case "self": return 0.75;
    default: return 0.75;
  }
}

// =============================================================================
// FRESHNESS DECAY
// =============================================================================

/**
 * Compute freshness decay factor.
 *
 * Evidence loses reliability over time. This factor decays linearly
 * from 1.0 (issued today) to 0.0 (365+ days old).
 *
 * Aligned with:
 *   - SOC 2 Type II: typically valid for 12 months
 *   - ISO 27001: annual surveillance audit cycle
 *   - L3 re-validation: 90-day FLAGSHIP window
 */
export function computeFreshnessDecay(issuedAt: string): number {
  const issued = new Date(issuedAt);
  if (isNaN(issued.getTime())) return 0;

  const now = new Date();
  const ageDays = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays <= 0) return 1.0;
  if (ageDays >= 365) return 0.0;

  return Math.round((1 - ageDays / 365) * 100) / 100;
}

// =============================================================================
// DIMENSION CONFIDENCE (Geometric Mean)
// =============================================================================

/**
 * Compute aggregate confidence from 7 assurance dimensions.
 *
 * Uses geometric mean (not arithmetic) because dimensions are multiplicative
 * per FAIR-CAM's model: one weak dimension drags the whole down.
 *
 * Returns 0-1 scale. Returns 0.5 (neutral) when dimensions are not available.
 */
export function computeDimensionConfidence(
  dimensions?: AssuranceDimensions,
): number {
  if (!dimensions) return 0.5; // Neutral when no dimension data

  const values = [
    dimensions.capability,
    dimensions.coverage,
    dimensions.reliability,
    dimensions.methodology,
    dimensions.freshness,
    dimensions.independence,
    dimensions.consistency,
  ];

  // Geometric mean: (∏ values)^(1/n), scaled from 0-100 to 0-1
  // Add 1 to avoid zero-product (log-safe)
  const product = values.reduce((acc, v) => acc * (v + 1), 1);
  const geoMean = Math.pow(product, 1 / values.length) - 1;

  return Math.round(Math.min(1, Math.max(0, geoMean / 100)) * 100) / 100;
}
