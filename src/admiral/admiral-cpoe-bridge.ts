/**
 * Admiral CPOE Bridge
 *
 * Converts an AdmiralGovernanceReport into a CPOEAdmiralAttestation
 * for embedding in CPOE documents.
 *
 * Key transformation: Admiral scores are 0-100 integers,
 * CPOE attestation scores are 0.0-1.0 floats.
 */

import type { AdmiralGovernanceReport } from "./admiral-types";
import type { CPOEAdmiralAttestation, CPOEAttestationDimension } from "../parley/cpoe-types";

/**
 * Convert an AdmiralGovernanceReport to a CPOEAdmiralAttestation.
 *
 * @param report - The full Admiral governance report
 * @returns CPOE-compatible attestation with normalized scores
 */
export function admiralReportToAttestation(
  report: AdmiralGovernanceReport
): CPOEAdmiralAttestation {
  const dimensions: CPOEAttestationDimension[] = report.dimensions.map((dim) => ({
    dimension: dim.dimension,
    score: dim.score / 100, // Normalize 0-100 → 0.0-1.0
  }));

  return {
    confidenceScore: report.confidenceScore / 100,
    dimensions,
    trustTier: report.trustTier,
    evaluatedAt: report.evaluatedAt,
    reportHash: report.reportHash,
  };
}
