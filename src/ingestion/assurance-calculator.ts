/**
 * Assurance Calculator — Provenance & Freshness Utilities
 *
 * Provenance-first model (v0.5.0): Records WHO produced evidence,
 * lets buyers decide what's sufficient. Tool adapters declare
 * assurance levels based on tool class, not content analysis.
 *
 * Retained functions:
 *   - deriveProvenance: Map source + metadata → CPOEProvenance
 *   - assessFreshness: Temporal validity assessment
 *   - deriveEvidenceTypes: ISO 19011 evidence type derivation
 *   - deriveEvidenceTypeDistribution: Proportional evidence type weights
 */

import type {
  DocumentSource,
  DocumentMetadata,
  IngestedControl,
} from "./types";
import type {
  CPOEProvenance,
  EvidenceType,
} from "../parley/vc-types";

// =============================================================================
// FRESHNESS TYPES
// =============================================================================

/** Temporal validity assessment result */
export interface FreshnessAssessment {
  /** Current status: fresh (<=90d), aging (91-365d), stale (>365d) */
  status: "fresh" | "aging" | "stale";

  /** Age in days since assessment date (-1 if date is invalid) */
  ageDays: number;
}

// =============================================================================
// PROVENANCE (Dimension 2: Authority)
// =============================================================================

/**
 * Derive evidence provenance from document source and metadata.
 *
 * Provenance captures WHO produced the evidence, independent of the
 * cryptographic assurance level. A SOC 2 from Deloitte is L0/L1 crypto
 * but "auditor" provenance — these are separate dimensions.
 */
export function deriveProvenance(
  source: DocumentSource,
  metadata: DocumentMetadata,
): CPOEProvenance {
  const provenance: CPOEProvenance = {
    source: sourceToProvenanceType(source),
  };

  // Prefer auditor field, fall back to issuer
  const identity = metadata.auditor || metadata.issuer;
  if (identity) provenance.sourceIdentity = identity;

  if (metadata.rawTextHash) provenance.sourceDocument = metadata.rawTextHash;
  if (metadata.date) provenance.sourceDate = metadata.date;

  return provenance;
}

/**
 * Map document source to provenance authority type.
 */
function sourceToProvenanceType(source: DocumentSource): CPOEProvenance["source"] {
  switch (source) {
    case "soc2":
    case "iso27001":
      return "auditor";
    case "prowler":
    case "securityhub":
    case "pentest":
    case "json":
    case "ciso-assistant":
      return "tool";
    case "manual":
    default:
      return "self";
  }
}

// =============================================================================
// FRESHNESS (Temporal Validity)
// =============================================================================

/**
 * Assess the temporal validity of an assessment.
 *
 * Thresholds:
 *   - fresh: <= 90 days (within quarterly review window)
 *   - aging: 91-365 days (annual review needed)
 *   - stale: > 365 days (expired — should not be relied upon)
 */
export function assessFreshness(dateString: string): FreshnessAssessment {
  const assessmentDate = new Date(dateString);
  if (isNaN(assessmentDate.getTime())) {
    return { status: "stale", ageDays: -1 };
  }

  const now = new Date();
  const diffMs = now.getTime() - assessmentDate.getTime();
  const ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (ageDays <= 90) return { status: "fresh", ageDays };
  if (ageDays <= 365) return { status: "aging", ageDays };
  return { status: "stale", ageDays };
}

// =============================================================================
// EVIDENCE TYPE DERIVATION (ISO 19011 + SOC 2 + NIST 800-53A)
// =============================================================================

/**
 * Derive the evidence types present in the assessment, ranked by the
 * ISO 19011 reliability hierarchy.
 */
export function deriveEvidenceTypes(
  controls: IngestedControl[],
  source: DocumentSource,
): EvidenceType[] {
  const types = new Set<EvidenceType>();

  // Source type determines the primary evidence method
  switch (source) {
    case "prowler":
    case "securityhub":
      types.add("automated-observation");
      types.add("system-generated-record");
      break;
    case "pentest":
      types.add("reperformance");
      types.add("system-generated-record");
      break;
    case "soc2":
    case "iso27001":
      types.add("documented-record");
      types.add("interview");
      break;
    case "ciso-assistant":
      types.add("system-generated-record");
      types.add("documented-record");
      break;
    case "json":
      types.add("system-generated-record");
      types.add("documented-record");
      break;
    case "manual":
      types.add("self-attestation");
      break;
  }

  // Controls with evidence text suggest at least documented-record
  const hasEvidence = controls.some(c => c.evidence && c.evidence.trim().length > 0);
  if (hasEvidence && !types.has("self-attestation")) {
    types.add("documented-record");
  }

  // Sort by reliability (highest first)
  const order: EvidenceType[] = [
    "automated-observation",
    "system-generated-record",
    "reperformance",
    "documented-record",
    "interview",
    "self-attestation",
  ];
  return order.filter(t => types.has(t));
}

// =============================================================================
// EVIDENCE TYPE DISTRIBUTION
// =============================================================================

/**
 * Derive the distribution of evidence types as percentages.
 * Returns a record mapping evidence type names to their proportion (0-1).
 */
export function deriveEvidenceTypeDistribution(
  controls: IngestedControl[],
  source: DocumentSource,
): Record<string, number> {
  const types = deriveEvidenceTypes(controls, source);

  if (types.length === 0) {
    return {};
  }

  // Weight by reliability rank (higher reliability = higher weight)
  const reliabilityWeights: Record<EvidenceType, number> = {
    "automated-observation": 6,
    "system-generated-record": 5,
    "reperformance": 4,
    "documented-record": 3,
    "interview": 2,
    "self-attestation": 1,
  };

  const presentWeights = types.map(t => reliabilityWeights[t]);
  const totalWeight = presentWeights.reduce((s, w) => s + w, 0);

  const distribution: Record<string, number> = {};
  for (let i = 0; i < types.length; i++) {
    distribution[types[i]] = Math.round((presentWeights[i] / totalWeight) * 100) / 100;
  }

  return distribution;
}
