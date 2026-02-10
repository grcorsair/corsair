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
import type {
  CPOEAssurance,
  CPOEProvenance,
  AssuranceDimensions,
  EvidenceType,
  ObservationPeriod,
  AntiGamingSafeguardResult,
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

// =============================================================================
// SEVEN-DIMENSION ASSURANCE MODEL (FAIR-CAM + GRADE + COSO)
// =============================================================================

/**
 * Calculate all 7 assurance dimensions from available data.
 *
 * Uses existing control data, source type, metadata, and optional
 * Quartermaster scores. All dimensions are 0-100.
 */
export function calculateAssuranceDimensions(
  controls: IngestedControl[],
  source: DocumentSource,
  metadata: DocumentMetadata,
  quartermasterScores?: { methodology: number; bias: number },
): AssuranceDimensions {
  const freshness = metadata.date ? assessFreshness(metadata.date) : { status: "stale" as const, ageDays: -1 };

  return {
    capability: scoreCapability(controls),
    coverage: scoreCoverage(controls, metadata),
    reliability: scoreReliability(controls, freshness),
    methodology: scoreMethodology(source, quartermasterScores?.methodology),
    freshness: scoreFreshness(metadata.date),
    independence: scoreIndependence(source),
    consistency: scoreConsistency(controls, quartermasterScores?.bias),
  };
}

/**
 * D1: Capability — "How strong is this control as designed?"
 * Sources: FAIR-CAM Capability, COSO Design Effectiveness, CC EAL depth.
 * Scores based on pass rate and evidence depth.
 */
export function scoreCapability(controls: IngestedControl[]): number {
  if (controls.length === 0) return 0;
  const effective = controls.filter(c => c.status === "effective").length;
  const withEvidence = controls.filter(c => c.status === "effective" && c.evidence && c.evidence.trim().length > 0).length;

  // Base score from pass rate (0-70), bonus for evidence depth (0-30)
  const passRate = effective / controls.length;
  const evidenceRate = controls.length > 0 ? withEvidence / controls.length : 0;
  return Math.round(passRate * 70 + evidenceRate * 30);
}

/**
 * D2: Coverage — "What % of in-scope assets does it protect?"
 * Sources: FAIR-CAM Coverage, COBIT Coverage, NIST 53A Coverage attribute.
 * FAIR-CAM proves this is MULTIPLICATIVE — 90% capability at 50% coverage = ~45% effective.
 */
export function scoreCoverage(controls: IngestedControl[], metadata: DocumentMetadata): number {
  if (controls.length === 0) return 0;

  // Coverage is primarily about whether controls cover the full scope.
  // With document-level assessment, all extracted controls are in-scope.
  const tested = controls.filter(c => c.status !== "not-tested").length;
  const testedRate = tested / controls.length;

  // Bonus for framework references (indicates mapped, not ad-hoc)
  const withFrameworkRefs = controls.filter(c => c.frameworkRefs && c.frameworkRefs.length > 0).length;
  const mappedRate = controls.length > 0 ? withFrameworkRefs / controls.length : 0;

  return Math.round(testedRate * 70 + mappedRate * 30);
}

/**
 * D3: Reliability — "How consistently does it operate?"
 * Sources: FAIR-CAM Reliability, COBIT Control, COSO Operating Effectiveness.
 * COSO distinction: Design Effectiveness (L1) vs Operating Effectiveness (L2+).
 */
export function scoreReliability(controls: IngestedControl[], freshness: FreshnessAssessment): number {
  if (controls.length === 0) return 0;

  // Base: effective controls ratio
  const effective = controls.filter(c => c.status === "effective").length;
  const baseScore = (effective / controls.length) * 60;

  // Freshness modifier: fresh evidence suggests recent operational check
  let freshnessBonus: number;
  switch (freshness.status) {
    case "fresh": freshnessBonus = 40; break;
    case "aging": freshnessBonus = 20; break;
    case "stale": freshnessBonus = 0; break;
  }

  return Math.round(baseScore + freshnessBonus);
}

/**
 * D4: Evidence Methodology — "How rigorous was the assessment?"
 * Sources: GRADE Risk of Bias, NIST 53A Depth, SOC 2 test methods.
 * SOC 2 hierarchy: Inquiry < Observation < Inspection < Reperformance < CAAT.
 * When Quartermaster score is available, it takes priority (already calibrated).
 */
export function scoreMethodology(source: DocumentSource, qmScore?: number): number {
  // If Quartermaster has already scored methodology, use it (scaled to 0-100)
  if (qmScore !== undefined) {
    return Math.round(Math.min(100, Math.max(0, qmScore * 100)));
  }

  // Fall back to source-based scoring
  switch (source) {
    case "pentest": return 75;        // Active testing = NIST Test-Focused
    case "prowler":
    case "securityhub": return 60;    // Automated scan = NIST Examine-Focused
    case "soc2":
    case "iso27001": return 50;       // Audit report = NIST Examine-Basic + Interview
    case "manual": return 15;         // Self-reported = minimal
    default: return 10;
  }
}

/**
 * D5: Evidence Freshness — "How recent is the evidence?"
 * Sources: GRADE Imprecision (sample recency), ISO 27004 timing requirement.
 * ISO 27001 Clause 9.1: "when to measure" and "when to analyze" are mandatory.
 */
export function scoreFreshness(dateString?: string): number {
  if (!dateString) return 0;
  const assessment = assessFreshness(dateString);
  if (assessment.ageDays < 0) return 0;  // Invalid date

  // Linear decay: 100 at 0 days, 0 at 365+ days
  if (assessment.ageDays >= 365) return 0;
  return Math.round(100 * (1 - assessment.ageDays / 365));
}

/**
 * D6: Evidence Independence — "How separated is the assessor from the assessed?"
 * Sources: Three Lines Model, GRADE Publication Bias, CC evaluator independence.
 * Three Lines: Self (1st) < Oversight (2nd) < Internal Audit (3rd) < External (4th).
 */
export function scoreIndependence(source: DocumentSource): number {
  switch (source) {
    case "soc2":
    case "iso27001": return 85;       // External auditor (4th line)
    case "pentest": return 75;        // External tester (3rd-4th line)
    case "prowler":
    case "securityhub": return 50;    // Automated tool (2nd line equivalent)
    case "manual": return 15;         // Self-assessment (1st line)
    default: return 10;
  }
}

/**
 * D7: Evidence Consistency — "Do multiple sources agree?"
 * Sources: GRADE Inconsistency, IEC 62443 SL-T/SL-C/SL-A alignment.
 * When Quartermaster bias score is available, it takes priority.
 */
export function scoreConsistency(controls: IngestedControl[], qmBiasScore?: number): number {
  // If Quartermaster has bias detection score, invert it (low bias = high consistency)
  if (qmBiasScore !== undefined) {
    return Math.round(Math.min(100, Math.max(0, qmBiasScore * 100)));
  }

  if (controls.length === 0) return 0;

  // Without QM, score based on status uniformity and evidence presence
  const statuses = controls.map(c => c.status);
  const withEvidence = controls.filter(c => c.evidence && c.evidence.trim().length > 0).length;
  const evidenceRate = withEvidence / controls.length;

  // Mixed results (some pass, some fail) is actually MORE consistent/honest
  // than everything passing — GRADE rewards transparent reporting
  const hasFailures = statuses.some(s => s === "ineffective");
  const hasSuccesses = statuses.some(s => s === "effective");
  const transparencyBonus = hasFailures && hasSuccesses ? 15 : 0;

  return Math.round(evidenceRate * 60 + transparencyBonus + 25);
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
      // SOC 2 reports typically include interview + inspection evidence
      types.add("interview");
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
// OBSERVATION PERIOD (COSO Design vs Operating + SOC 2 Type II)
// =============================================================================

/**
 * Derive observation period from document metadata.
 * Maps to COSO's Design Effectiveness vs Operating Effectiveness.
 *
 * Returns undefined if date metadata is insufficient.
 */
export function deriveObservationPeriod(
  metadata: DocumentMetadata,
): ObservationPeriod | undefined {
  if (!metadata.date) return undefined;

  const endDate = new Date(metadata.date);
  if (isNaN(endDate.getTime())) return undefined;

  // Infer start date from report type
  let durationDays: number;
  const reportType = (metadata.reportType ?? "").toLowerCase();

  if (reportType.includes("type ii") || reportType.includes("type 2")) {
    // SOC 2 Type II typically covers 6-12 months
    durationDays = reportType.includes("12") ? 365 : 180;
  } else if (reportType.includes("type i") || reportType.includes("type 1")) {
    // SOC 2 Type I is point-in-time
    durationDays = 1;
  } else if (reportType.includes("prowler") || reportType.includes("securityhub")) {
    // Automated scans are point-in-time
    durationDays = 1;
  } else {
    // Default: assume quarterly assessment period
    durationDays = 90;
  }

  const startDate = new Date(endDate.getTime() - durationDays * 24 * 60 * 60 * 1000);
  const sufficient = durationDays >= 90;

  // COSO classification
  const cosoClassification: ObservationPeriod["cosoClassification"] =
    durationDays >= 90 ? "operating" : "design-only";

  // SOC 2 equivalent
  let soc2Equivalent: ObservationPeriod["soc2Equivalent"];
  if (durationDays <= 1) soc2Equivalent = "Type I";
  else if (durationDays < 90) soc2Equivalent = "Pre-engagement";
  else if (durationDays < 180) soc2Equivalent = "Type II (3mo)";
  else if (durationDays < 365) soc2Equivalent = "Type II (6mo)";
  else soc2Equivalent = "Type II (12mo)";

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    durationDays,
    sufficient,
    cosoClassification,
    soc2Equivalent,
  };
}

// =============================================================================
// ANTI-GAMING SAFEGUARDS (Plan 2.4.5)
// =============================================================================

/**
 * Apply anti-gaming safeguards to a declared assurance level.
 *
 * Three safeguards that cap the effective level:
 * 1. Sampling Opacity — zero/no-evidence controls → cap based on evidence coverage
 * 2. Freshness Decay — stale evidence (>180 days) → cap at L1
 * 3. Independence Check — self provenance → cap at L2
 *
 * Safeguards are cumulative: the effective level is the min of all caps.
 */
export function applyAntiGamingSafeguards(
  declared: AssuranceLevel,
  controls: IngestedControl[],
  source: DocumentSource,
  metadata: DocumentMetadata,
): AntiGamingSafeguardResult {
  let effectiveLevel: AssuranceLevel = declared;
  const appliedSafeguards: AntiGamingSafeguardResult["appliedSafeguards"] = [];
  const explanations: string[] = [];

  // 1. Sampling Opacity: zero controls or high no-evidence rate
  if (controls.length === 0) {
    effectiveLevel = Math.min(effectiveLevel, 0) as AssuranceLevel;
    appliedSafeguards.push("sampling-opacity");
    explanations.push("No controls present — capped at L0");
  } else {
    const withEvidence = controls.filter(c => c.evidence && c.evidence.trim().length > 0).length;
    const evidenceRate = withEvidence / controls.length;
    if (evidenceRate < 0.5) {
      effectiveLevel = Math.min(effectiveLevel, 1) as AssuranceLevel;
      appliedSafeguards.push("sampling-opacity");
      explanations.push(`Only ${Math.round(evidenceRate * 100)}% of controls have evidence — capped at L1`);
    }
  }

  // 2. Freshness Decay: evidence older than 180 days
  if (metadata.date) {
    const freshness = assessFreshness(metadata.date);
    if (freshness.ageDays > 180 || freshness.status === "stale") {
      effectiveLevel = Math.min(effectiveLevel, 1) as AssuranceLevel;
      appliedSafeguards.push("freshness-decay");
      explanations.push(`Evidence is ${freshness.ageDays} days old — capped at L1`);
    }
  }

  // 3. Independence Check: self provenance caps at L2
  const provenanceType = sourceToProvenanceType(source);
  if (provenanceType === "self" && declared > 2) {
    effectiveLevel = Math.min(effectiveLevel, 2) as AssuranceLevel;
    appliedSafeguards.push("independence-check");
    explanations.push("Self-assessed provenance — capped at L2");
  }

  return { effectiveLevel, appliedSafeguards, explanations };
}

// =============================================================================
// RULE TRACE (Plan 2.4.4)
// =============================================================================

/**
 * Generate a machine-readable rule trace explaining how the assurance level
 * was determined. Each entry describes a rule check and its outcome.
 */
export function generateRuleTrace(
  controls: (IngestedControl & { assuranceLevel?: AssuranceLevel })[],
  source: DocumentSource,
  metadata: DocumentMetadata,
): string[] {
  const trace: string[] = [];

  // Control count check
  if (controls.length === 0) {
    trace.push("RULE: no controls present — declared L0");
    return trace;
  }

  trace.push(`RULE: ${controls.length} controls checked`);

  // Source ceiling
  const ceiling = getSourceCeiling(source);
  trace.push(`RULE: source "${source}" ceiling = L${ceiling}`);

  // Per-level breakdown
  const breakdown: Record<string, number> = {};
  for (const ctrl of controls) {
    const lvl = ctrl.assuranceLevel ?? 0;
    const key = String(lvl);
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }
  trace.push(`RULE: breakdown = ${JSON.stringify(breakdown)}`);

  // Min level (SSL model)
  const levels = controls.map(c => c.assuranceLevel ?? 0);
  const minLevel = Math.min(...levels);
  trace.push(`RULE: min of in-scope controls = L${minLevel} — satisfied`);

  // Freshness
  if (metadata.date) {
    const freshness = assessFreshness(metadata.date);
    trace.push(`RULE: freshness checked — ${freshness.status} (${freshness.ageDays} days)`);
  } else {
    trace.push("RULE: freshness checked — no date provided");
  }

  return trace;
}

// =============================================================================
// EVIDENCE TYPE DISTRIBUTION (Plan 2.5)
// =============================================================================

/**
 * Derive the distribution of evidence types as percentages.
 * Returns a record mapping evidence type names to their proportion (0-1).
 *
 * Uses the same evidence type derivation logic but produces proportional
 * weights based on source type and control characteristics.
 */
export function deriveEvidenceTypeDistribution(
  controls: IngestedControl[],
  source: DocumentSource,
): Record<string, number> {
  // Get the evidence types present
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
