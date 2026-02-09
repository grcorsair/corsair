/**
 * Assurance Calculator — Multi-Dimensional Evidence Classification
 *
 * The 5-Level Assurance Ladder (L0-L4):
 *   L0 = Documented  (policy document says so)
 *   L1 = Configured  (settings show it's turned on)
 *   L2 = Demonstrated (test results prove it works)
 *   L3 = Observed    (continuous monitoring confirms it)
 *   L4 = Attested    (independent third party verified it)
 *
 * Five Dimensions of Document Assurance:
 *   1. Evidence Type  — what kind of proof (document type sets the ceiling)
 *   2. Authority      — who produced it (provenance, separate from crypto level)
 *   3. Internal Consistency — does the document hold together
 *   4. Scope          — what was covered
 *   5. Temporal Validity — how fresh is the assessment
 *
 * Hard Gates determine level eligibility. Soft signals enrich quality
 * within each level without changing the gate decision.
 *
 * Key principle: L0-L4 measures CRYPTOGRAPHIC VERIFIABILITY, not trust.
 * Provenance captures authority separately.
 */

import type { AssuranceLevel, DocumentSource, DocumentMetadata, IngestedControl } from "./types";
import type { CPOEAssurance, CPOEProvenance } from "../parley/vc-types";

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
// PER-CONTROL ASSURANCE (Dimension 1: Evidence Type)
// =============================================================================

/**
 * Calculate assurance level for a single control.
 *
 * Hard gates:
 *   - status !== "effective" → L0
 *   - no evidence → L0
 *   - source === "manual" → L0 ceiling
 *
 * Source ceiling (document type sets the ceiling):
 *   - manual → L0
 *   - soc2/iso27001/prowler/securityhub → L1
 *   - pentest → L2
 */
export function calculateAssuranceLevel(
  control: IngestedControl,
  source: DocumentSource,
  metadata: DocumentMetadata,
): AssuranceLevel {
  // Hard gate: ineffective or not-tested → L0
  if (control.status !== "effective") return 0;

  // Hard gate: no evidence → L0 (claimed)
  const hasEvidence = !!control.evidence && control.evidence.trim().length > 0;
  if (!hasEvidence) return 0;

  // Source ceiling
  return getSourceCeiling(source);
}

/**
 * Get assurance ceiling from document source type.
 * Document type sets the ceiling — other dimensions determine
 * whether you actually reach it.
 */
function getSourceCeiling(source: DocumentSource): AssuranceLevel {
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
      // Self-reported = documented (L0)
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

// =============================================================================
// DOCUMENT-LEVEL ROLLUP → CPOEAssurance + CPOEProvenance
// =============================================================================

/**
 * Calculate document-level assurance rollup.
 *
 * Implements the SSL certificate model: declared level = min of all in-scope
 * controls. One control below the declared level = rejected (unless explicitly
 * excluded with rationale).
 *
 * Returns both CPOEAssurance (what level, how verified) and CPOEProvenance
 * (who produced the evidence).
 */
export function calculateDocumentRollup(
  controls: (IngestedControl & { assuranceLevel: AssuranceLevel })[],
  source: DocumentSource,
  metadata: DocumentMetadata,
  excluded?: Array<{ controlId: string; reason: string; acceptedBy?: string }>,
): { assurance: CPOEAssurance; provenance: CPOEProvenance } {
  // Filter out excluded controls
  const excludedIds = new Set(excluded?.map(e => e.controlId) ?? []);
  const inScope = controls.filter(c => !excludedIds.has(c.id));

  // Build breakdown: count controls at each level
  const breakdown: Record<string, number> = {};
  for (const ctrl of inScope) {
    const key = String(ctrl.assuranceLevel);
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }

  // Declared = min of all in-scope controls (SSL model)
  const declared: AssuranceLevel = inScope.length > 0
    ? Math.min(...inScope.map(c => c.assuranceLevel)) as AssuranceLevel
    : 0;

  // Verified = all in-scope controls >= declared level
  const verified = inScope.length > 0
    ? inScope.every(c => c.assuranceLevel >= declared)
    : false;

  // Method from source type
  const method = sourceToMethod(source);

  const assurance: CPOEAssurance = {
    declared,
    verified,
    method,
    breakdown,
  };

  // Only include excluded array if non-empty
  if (excluded && excluded.length > 0) {
    assurance.excluded = excluded;
  }

  const provenance = deriveProvenance(source, metadata);

  return { assurance, provenance };
}

// =============================================================================
// DIMENSION 2: AUTHORITY (Provenance)
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
      return "tool";
    case "manual":
    default:
      return "self";
  }
}

// =============================================================================
// DIMENSION 5: TEMPORAL VALIDITY (Freshness)
// =============================================================================

/**
 * Assess the temporal validity of an assessment.
 *
 * Thresholds:
 *   - fresh: <= 90 days (within quarterly review window)
 *   - aging: 91-365 days (annual review needed)
 *   - stale: > 365 days (expired — should not be relied upon)
 *
 * These thresholds align with:
 *   - L3 re-validation: 90-day window (FLAGSHIP)
 *   - SOC 2 Type II: typically covers 6-12 month period
 *   - Annual certifications (ISO 27001, PCI DSS): 365-day cycle
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
// INTERNAL: Method mapping
// =============================================================================

/** Map DocumentSource to assurance method */
function sourceToMethod(source: DocumentSource): CPOEAssurance["method"] {
  switch (source) {
    case "soc2":
    case "iso27001":
    case "manual":
      return "self-assessed";
    case "prowler":
    case "securityhub":
      return "automated-config-check";
    case "pentest":
      return "ai-evidence-review";
    default:
      return "self-assessed";
  }
}
