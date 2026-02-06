/**
 * Quartermaster MARQUE Bridge
 *
 * Converts an QuartermasterGovernanceReport into a MarqueQuartermasterAttestation
 * for embedding in MARQUE documents.
 *
 * Key transformation: Quartermaster scores are 0-100 integers,
 * MARQUE attestation scores are 0.0-1.0 floats.
 */

import type { QuartermasterGovernanceReport } from "./quartermaster-types";
import type { MarqueQuartermasterAttestation, MARQUEAttestationDimension } from "../parley/marque-types";

/**
 * Convert an QuartermasterGovernanceReport to a MarqueQuartermasterAttestation.
 *
 * @param report - The full Quartermaster governance report
 * @returns MARQUE-compatible attestation with normalized scores
 */
export function quartermasterReportToAttestation(
  report: QuartermasterGovernanceReport
): MarqueQuartermasterAttestation {
  const dimensions: MARQUEAttestationDimension[] = report.dimensions.map((dim) => ({
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
