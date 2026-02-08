/**
 * Assurance Calculator — Classify evidence into L0-L4
 *
 * The 5-Level Assurance Ladder:
 *   L0 = Claimed    (policy document says so)
 *   L1 = Configured (settings show it's turned on)
 *   L2 = Demonstrated (test results prove it works)
 *   L3 = Observed   (continuous monitoring confirms it)
 *   L4 = Attested   (independent third party verified it)
 */

import type { AssuranceLevel, DocumentSource, DocumentMetadata, IngestedControl } from "./types";

/**
 * Calculate assurance level for a single control.
 */
export function calculateAssuranceLevel(
  control: IngestedControl,
  source: DocumentSource,
  metadata: DocumentMetadata,
): AssuranceLevel {
  // Ineffective or not-tested controls are always L0
  if (control.status !== "effective") return 0;

  // No evidence → at most L0 (claimed)
  const hasEvidence = !!control.evidence && control.evidence.trim().length > 0;
  if (!hasEvidence) return 0;

  // Base level by source type
  return getBaseLevel(source, metadata);
}

/**
 * Get base assurance level from document source and metadata.
 */
function getBaseLevel(source: DocumentSource, metadata: DocumentMetadata): AssuranceLevel {
  switch (source) {
    case "pentest":
      // Penetration test = demonstrated (L2) — adversarial testing proves controls work
      return 2;

    case "prowler":
    case "securityhub":
      // Automated config scan = configured (L1) — settings verified by tooling
      return 1;

    case "soc2":
    case "iso27001":
      // Audit report with evidence = configured (L1)
      return 1;

    case "manual":
    default:
      // Self-reported = claimed (L0)
      return 0;
  }
}

/**
 * Calculate assurance levels for all controls in a document.
 * Returns controls with assuranceLevel populated.
 */
export function calculateDocumentAssurance(
  controls: IngestedControl[],
  source: DocumentSource,
  metadata: DocumentMetadata,
): (IngestedControl & { assuranceLevel: AssuranceLevel })[] {
  return controls.map(control => ({
    ...control,
    assuranceLevel: calculateAssuranceLevel(control, source, metadata),
  }));
}
