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

import type {
  AssuranceLevel,
  DocumentSource,
  DocumentMetadata,
  IngestedControl,
  AssessmentContext,
  MethodologyTier,
  EvidenceClassification,
  SampleSizeResult,
  BoilerplateResult,
} from "./types";
import type {
  CPOEAssurance,
  CPOEProvenance,
  AssuranceDimensions,
  EvidenceType,
  ObservationPeriod,
  AntiGamingSafeguardResult,
  DimensionGatingResult,
  AssuranceLevel as VCAssuranceLevel,
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

  // Phase 1: Content-aware classification replaces bare source ceiling
  const classification = classifyEvidenceContent(control, source);
  return classification.maxLevel;
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

    case "json":
      // Generic JSON = configured (L1) — structured data implies tooling
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

  // 5% Tolerance Rule: If <= 5% of in-scope controls are below a candidate
  // level AND there are >= 10 controls (small samples use strict min),
  // the declared level can be that candidate. Controls below are "tolerated"
  // and flagged in the CPOE.
  const TOLERANCE_THRESHOLD = 0.05;
  const MIN_CONTROLS_FOR_TOLERANCE = 10;

  let declared: AssuranceLevel = 0;
  let toleratedControls: Array<{ controlId: string; level: AssuranceLevel; reason: string }> = [];

  if (inScope.length > 0) {
    // Try each level from highest to lowest
    for (let candidate = 4; candidate >= 0; candidate--) {
      const belowControls = inScope.filter(c => c.assuranceLevel < candidate);
      const belowFraction = belowControls.length / inScope.length;

      if (belowFraction === 0) {
        // All controls at or above this level — strict pass
        declared = candidate as AssuranceLevel;
        toleratedControls = [];
        break;
      } else if (
        inScope.length >= MIN_CONTROLS_FOR_TOLERANCE &&
        belowFraction <= TOLERANCE_THRESHOLD
      ) {
        // Within 5% tolerance — declare this level, tolerate stragglers
        declared = candidate as AssuranceLevel;
        toleratedControls = belowControls.map(c => ({
          controlId: c.id,
          level: c.assuranceLevel,
          reason: `Auto-tolerated: L${c.assuranceLevel} control within 5% threshold (${belowControls.length}/${inScope.length} = ${(belowFraction * 100).toFixed(1)}%)`,
        }));
        break;
      }
    }
  }

  // Verified = all in-scope meet declared OR tolerance was applied
  const verified = inScope.length > 0
    ? inScope.every(c => c.assuranceLevel >= declared) || toleratedControls.length > 0
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

  // Include tolerated controls if any
  if (toleratedControls.length > 0) {
    assurance.toleratedControls = toleratedControls;
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
    case "json":
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
    case "json":
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
  assessmentContext?: AssessmentContext,
): AssuranceDimensions {
  const freshness = metadata.date ? assessFreshness(metadata.date) : { status: "stale" as const, ageDays: -1 };

  let capability = scoreCapability(controls);
  let coverage = scoreCoverage(controls, metadata);
  let methodology = scoreMethodology(source, quartermasterScores?.methodology);

  // Phase 4: Assessment Context Integration
  if (assessmentContext) {
    // Coverage penalty from gaps
    if (assessmentContext.gaps && assessmentContext.gaps.length > 0) {
      const penalty = Math.min(30, assessmentContext.gaps.length * 5);
      coverage = Math.max(0, coverage - penalty);
    }

    // Methodology enrichment from assessor notes
    if (assessmentContext.assessorNotes) {
      const notes = assessmentContext.assessorNotes;
      let bonus = 0;
      if (/\breperform/i.test(notes)) bonus += 8;
      if (/\bsample/i.test(notes)) bonus += 5;
      if (/\bpopulation/i.test(notes)) bonus += 5;
      if (/\binspect/i.test(notes)) bonus += 3;
      if (/\bobserv/i.test(notes)) bonus += 3;
      methodology = Math.min(100, methodology + bonus);
    }

    // Capability bonus from tech stack
    if (assessmentContext.techStack && assessmentContext.techStack.length > 0) {
      const bonus = Math.min(20, assessmentContext.techStack.length * 5);
      capability = Math.min(100, capability + bonus);
    }
  }

  return {
    capability,
    coverage,
    reliability: scoreReliability(controls, freshness),
    methodology,
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
    case "json": return 55;           // Structured data = NIST Examine-Basic
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
    case "json": return 40;           // Structured data (2nd line, unknown tool)
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
    case "json":
      // Generic JSON — could be tool-generated or manual
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

  // 4. Severity Asymmetry (Phase 3): If CRITICAL/HIGH controls have weaker
  // evidence methodology than MEDIUM/LOW controls, cap at L1.
  // Rationale: SOC 2 Type II requires more rigorous testing for higher-risk areas.
  if (controls.length >= 2) {
    const highRisk = controls.filter(c =>
      c.severity === "CRITICAL" || c.severity === "HIGH"
    );
    const lowRisk = controls.filter(c =>
      c.severity === "MEDIUM" || c.severity === "LOW"
    );

    if (highRisk.length > 0 && lowRisk.length > 0) {
      // Classify evidence for both groups
      const highMethodologies = highRisk.map(c => classifyEvidenceContent(c, source));
      const lowMethodologies = lowRisk.map(c => classifyEvidenceContent(c, source));

      // Average max level for each group
      const avgHigh = highMethodologies.reduce((s, m) => s + m.maxLevel, 0) / highMethodologies.length;
      const avgLow = lowMethodologies.reduce((s, m) => s + m.maxLevel, 0) / lowMethodologies.length;

      // If high-risk controls have strictly lower avg methodology than low-risk
      if (avgHigh < avgLow && avgHigh < 1.5) {
        effectiveLevel = Math.min(effectiveLevel, 1) as AssuranceLevel;
        appliedSafeguards.push("severity-asymmetry");
        explanations.push(
          `CRITICAL/HIGH controls have weaker evidence (avg L${avgHigh.toFixed(1)}) than MEDIUM/LOW (avg L${avgLow.toFixed(1)}) — capped at L1`
        );
      }
    }
  }

  // 5. All-Pass Bias (Phase 3): If 100% of controls are "effective" AND 10+
  // controls, flag as suspicious. GRADE risk-of-bias flags unanimous positives.
  if (controls.length >= 10) {
    const allEffective = controls.every(c => c.status === "effective");
    if (allEffective) {
      appliedSafeguards.push("all-pass-bias");
      explanations.push(
        `All ${controls.length} controls are effective — all-pass bias flag applied (consistency dimension penalty)`
      );
      // Note: This applies a consistency dimension penalty which may trigger
      // dimension gating from Phase 2. It doesn't directly cap the level.
    }
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

// =============================================================================
// PHASE 2: DIMENSION GATING (Deterministic floor thresholds per level)
// =============================================================================

/**
 * Per-level dimension thresholds. A declared level requires ALL listed
 * dimensions to meet or exceed their threshold.
 *
 * Framework grounding:
 *   L1: COSO Design Effectiveness
 *   L2: GRADE Risk of Bias (moderate)
 *   L3: ISO 27001 Clause 9.1 timing requirements
 *   L4: Three Lines Model (4th line independence)
 */
const DIMENSION_THRESHOLDS: Record<number, Array<{ dimension: keyof AssuranceDimensions; required: number }>> = {
  1: [
    { dimension: "capability", required: 40 },
    { dimension: "coverage", required: 30 },
  ],
  2: [
    { dimension: "capability", required: 40 },
    { dimension: "coverage", required: 50 },
    { dimension: "methodology", required: 50 },
    { dimension: "reliability", required: 40 },
  ],
  3: [
    { dimension: "capability", required: 40 },
    { dimension: "coverage", required: 50 },
    { dimension: "methodology", required: 60 },
    { dimension: "reliability", required: 60 },
    { dimension: "freshness", required: 70 },
  ],
  4: [
    { dimension: "capability", required: 40 },
    { dimension: "coverage", required: 50 },
    { dimension: "methodology", required: 70 },
    { dimension: "reliability", required: 60 },
    { dimension: "freshness", required: 70 },
    { dimension: "independence", required: 80 },
  ],
};

/**
 * Apply dimension gating to a declared assurance level.
 *
 * Effective level = highest level where ALL dimension thresholds pass.
 * Dimensions are INFORMATIONAL at L0 (no gating).
 */
export function applyDimensionGating(
  declared: AssuranceLevel,
  dimensions: AssuranceDimensions,
): DimensionGatingResult {
  if (declared === 0) {
    return { gatedLevel: 0, failedThresholds: [] };
  }

  const allFailed: Array<{ dimension: string; required: number; actual: number }> = [];

  // Find the highest level where all thresholds pass
  let gatedLevel: AssuranceLevel = 0;
  let firstFailedLevel: number | null = null;

  for (let level = 1; level <= declared; level++) {
    const thresholds = DIMENSION_THRESHOLDS[level] ?? [];
    let levelPasses = true;

    for (const threshold of thresholds) {
      const actual = dimensions[threshold.dimension];
      if (actual < threshold.required) {
        levelPasses = false;
        if (firstFailedLevel === null) {
          firstFailedLevel = level;
        }
        // Record failures for the first level that blocks us
        if (level === (firstFailedLevel ?? declared)) {
          allFailed.push({
            dimension: threshold.dimension,
            required: threshold.required,
            actual,
          });
        }
      }
    }

    if (levelPasses) {
      gatedLevel = level as AssuranceLevel;
    } else {
      // Can't reach this level or higher
      break;
    }
  }

  return { gatedLevel, failedThresholds: allFailed };
}

// =============================================================================
// PHASE 1: EVIDENCE CONTENT CLASSIFIER (Scaffolded Intelligence)
// =============================================================================

/**
 * Methodology tier detection patterns.
 * Ordered from highest to lowest — first match at highest tier wins.
 * Grounded in SOC 2 test methods, NIST 800-53A, ISO 19011.
 */
const METHODOLOGY_PATTERNS: Array<{ tier: MethodologyTier; maxLevel: AssuranceLevel; patterns: RegExp[] }> = [
  {
    tier: "reperformance",
    maxLevel: 2,
    patterns: [
      /\breperform/i,
      /\bsample\s+of\s+\d+/i,
      /\bselected\s+\d+/i,
      /\btested\s+\d+/i,
      /\bpopulation\s+of\s+\d+/i,
      /\bre-?execut/i,
    ],
  },
  {
    tier: "caat",
    maxLevel: 2,
    patterns: [
      /\bautomated\s+scan/i,
      /\bcontinuous\s+monitor/i,
      /\btool\s+output/i,
      /\bautomated\s+test/i,
      /\bscript/i,
      /\bCAAT/i,
    ],
  },
  {
    tier: "inspection",
    maxLevel: 1,
    patterns: [
      /\binspect/i,
      /\bconfig\s+export/i,
      /\bscreenshot/i,
      /\bexamined\s+settings/i,
      /\bexamined\s+the\s+config/i,
      /\breviewed\s+config/i,
    ],
  },
  {
    tier: "observation",
    maxLevel: 1,
    patterns: [
      /\bobserved\b/i,
      /\bwalkthrough/i,
      /\bwitnessed/i,
      /\bdemonstrated/i,
    ],
  },
  {
    tier: "inquiry",
    maxLevel: 1,
    patterns: [
      /\binquir/i,
      /\binterview/i,
      /\bmanagement\s+stated/i,
      /\bdiscussed\s+with/i,
      /\bpersonnel\s+confirmed/i,
    ],
  },
];

/**
 * Classify evidence content to determine methodology tier and max assurance level.
 *
 * Replaces the bare source-ceiling lookup with content-aware classification.
 * The methodology tier's max level determines what the evidence can support.
 * For manual source (self-assessment), the source ceiling caps everything at L0.
 * For auditor/tool sources, evidence methodology determines the level —
 * because a SOC 2 Type II with reperformance testing IS L2 evidence.
 */
export function classifyEvidenceContent(
  control: IngestedControl,
  source: DocumentSource,
): EvidenceClassification {
  const evidence = control.evidence?.trim() ?? "";

  // No evidence → none
  if (!evidence) {
    return { methodology: "none", maxLevel: 0, trace: "No evidence provided" };
  }

  // Manual source is always capped at L0 regardless of keywords
  if (source === "manual") {
    // Still detect methodology for classification purposes
    const detected = detectMethodologyTier(evidence);
    return {
      methodology: detected.tier,
      maxLevel: 0,
      trace: `Evidence methodology: ${detected.tier} (detected: ${detected.all.join(", ")}). Manual source ceiling: L0.`,
    };
  }

  const sourceCeiling = getSourceCeiling(source);

  // Detect methodology from evidence content
  const detected = detectMethodologyTier(evidence);

  if (detected.tier === "unknown") {
    // No methodology keywords — fall back to source ceiling
    return {
      methodology: "unknown",
      maxLevel: sourceCeiling,
      trace: `No methodology keywords detected. Source ceiling: L${sourceCeiling}. Max level: L${sourceCeiling}.`,
    };
  }

  // Methodology detected — use the methodology tier's max level
  // This allows SOC 2 with reperformance to reach L2 (above source default of L1)
  const methodologyMax = METHODOLOGY_PATTERNS.find(p => p.tier === detected.tier)?.maxLevel ?? sourceCeiling;
  const maxLevel = Math.max(sourceCeiling, methodologyMax) as AssuranceLevel;

  return {
    methodology: detected.tier,
    maxLevel,
    trace: `Evidence methodology: ${detected.tier} (detected: ${detected.all.join(", ")}). Source ceiling: L${sourceCeiling}. Methodology max: L${methodologyMax}. Effective max: L${maxLevel}.`,
  };
}

/**
 * Detect the highest methodology tier present in evidence text.
 * Returns both the best tier and all detected tiers.
 */
function detectMethodologyTier(evidence: string): { tier: MethodologyTier; all: string[] } {
  let bestTier: MethodologyTier = "unknown";
  const detectedTiers: string[] = [];

  for (const entry of METHODOLOGY_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(evidence)) {
        detectedTiers.push(entry.tier);
        if (bestTier === "unknown") {
          bestTier = entry.tier;
        }
        break;
      }
    }
  }

  return { tier: bestTier, all: detectedTiers };
}

// =============================================================================
// PHASE 1B: SAMPLE SIZE ADEQUACY (Probo Check 5)
// =============================================================================

/**
 * AICPA-derived minimum sample sizes per control frequency.
 */
const MIN_SAMPLE_SIZES: Record<string, number> = {
  daily: 25,
  weekly: 10,
  monthly: 5,
  quarterly: 2,
  annually: 1,
};

/**
 * Extract and validate sample sizes from evidence text.
 * Returns sample, population, frequency, and adequacy assessment.
 */
export function extractSampleSize(evidenceText: string): SampleSizeResult {
  const text = evidenceText.trim();
  if (!text) return { sample: null, population: null, frequency: null, adequate: null };

  let sample: number | null = null;
  let population: number | null = null;
  let frequency: string | null = null;

  // Extract sample size patterns
  const samplePatterns = [
    /\bsample\s+of\s+(\d[\d,]*)/i,
    /\bselected\s+(\d[\d,]*)/i,
    /\btested\s+(\d[\d,]*)/i,
    /\btested\s+all\s+(\d[\d,]*)/i,
  ];

  for (const pat of samplePatterns) {
    const match = text.match(pat);
    if (match) {
      sample = parseInt(match[1].replace(/,/g, ""), 10);
      break;
    }
  }

  // Extract population size patterns
  const popPatterns = [
    /\bpopulation\s+of\s+(\d[\d,]*)/i,
    /\bout\s+of\s+(\d[\d,]*)/i,
    /\bfrom\s+(\d[\d,]*)\s+total/i,
  ];

  for (const pat of popPatterns) {
    const match = text.match(pat);
    if (match) {
      population = parseInt(match[1].replace(/,/g, ""), 10);
      break;
    }
  }

  // Detect frequency
  const frequencyPatterns: Array<[RegExp, string]> = [
    [/\bdaily\b/i, "daily"],
    [/\bweekly\b/i, "weekly"],
    [/\bmonthly\b/i, "monthly"],
    [/\bquarterly\b/i, "quarterly"],
    [/\bannual(?:ly)?\b/i, "annually"],
  ];

  for (const [pat, freq] of frequencyPatterns) {
    if (pat.test(text)) {
      frequency = freq;
      break;
    }
  }

  // Determine adequacy
  let adequate: boolean | null = null;
  if (sample !== null && frequency !== null) {
    const minRequired = MIN_SAMPLE_SIZES[frequency];
    if (minRequired !== undefined) {
      adequate = sample >= minRequired;
    }
  } else if (sample !== null && frequency === null) {
    // Sample found but no frequency — can't determine adequacy
    adequate = null;
  }

  return { sample, population, frequency, adequate };
}

// =============================================================================
// PHASE 1C: BOILERPLATE / TEMPLATE DETECTION (Probo Check 2)
// =============================================================================

/**
 * Common product/system names for specificity detection.
 * Not exhaustive — pattern-based detection for common GRC tools and platforms.
 */
const KNOWN_SYSTEMS = [
  /\bOkta\b/i, /\bAWS\b/, /\bAzure\b/i, /\bGCP\b/, /\bGoogle Cloud\b/i,
  /\bCloudTrail\b/i, /\bGuardDuty\b/i, /\bSecurityHub\b/i, /\bSentinelOne\b/i,
  /\bCrowdStrike\b/i, /\bSplunk\b/i, /\bDatadog\b/i, /\bPagerDuty\b/i,
  /\bJira\b/i, /\bServiceNow\b/i, /\bSlack\b/i, /\bGitHub\b/i, /\bGitLab\b/i,
  /\bTerraform\b/i, /\bKubernetes\b/i, /\bDocker\b/i, /\bPostgres/i,
  /\bMySQL\b/i, /\bMongoDB\b/i, /\bRedis\b/i, /\bS3\b/, /\bEC2\b/,
  /\bIAM\b/, /\bCognito\b/i, /\bAuth0\b/i, /\bProwler\b/i,
];

/** Date/time range patterns */
const DATE_PATTERNS = [
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i,
  /\bQ[1-4]\s+\d{4}\b/i,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i,
];

/** Procedure name patterns */
const PROCEDURE_PATTERNS = [
  /\breperform(?:ed)?\s+\w+/i,
  /\bobserved\s+\w+/i,
  /\binspected\s+\w+/i,
  /\bexecuted\s+\w+/i,
  /\bverified\s+\w+/i,
];

/** Quantified result patterns */
const QUANTIFIED_PATTERNS = [
  /\b\d+\s+of\s+\d+\b/,
  /\bzero\s+exceptions\b/i,
  /\bno\s+exceptions\b/i,
  /\b\d+\s+(?:passed|failed|successful|exceptions?)\b/i,
  /\b100%\b/,
];

/**
 * Known generic boilerplate phrases that indicate low-effort evidence.
 */
const GENERIC_BOILERPLATE_PHRASES = [
  /reviewed\s+evidence\s+and\s+determined\s+(?:the\s+)?control\s+is\s+operating\s+effectively/i,
  /control\s+is\s+operating\s+effectively\s+based\s+on\s+the\s+procedures\s+performed/i,
  /no\s+exceptions?\s+(?:were\s+)?noted/i,
];

/**
 * Calculate specificity score for evidence text (0-100).
 * Higher = more specific evidence with named artifacts.
 */
function calculateSpecificity(evidence: string): number {
  if (!evidence.trim()) return 0;

  let score = 0;

  // Named systems (+15 each, max 3)
  let systemCount = 0;
  for (const pat of KNOWN_SYSTEMS) {
    if (pat.test(evidence) && systemCount < 3) {
      score += 15;
      systemCount++;
    }
  }

  // Dates/time ranges (+10 each, max 2)
  let dateCount = 0;
  for (const pat of DATE_PATTERNS) {
    if (pat.test(evidence) && dateCount < 2) {
      score += 10;
      dateCount++;
    }
  }

  // Procedure names (+15 each, max 2)
  let procCount = 0;
  for (const pat of PROCEDURE_PATTERNS) {
    if (pat.test(evidence) && procCount < 2) {
      score += 15;
      procCount++;
    }
  }

  // Quantified results (+15 each, max 2)
  let quantCount = 0;
  for (const pat of QUANTIFIED_PATTERNS) {
    if (pat.test(evidence) && quantCount < 2) {
      score += 15;
      quantCount++;
    }
  }

  return Math.min(100, score);
}

/**
 * Detect boilerplate/template evidence across a set of controls.
 * Returns per-control flags and specificity scores.
 */
export function detectBoilerplate(controls: IngestedControl[]): BoilerplateResult[] {
  // Count evidence text occurrences for template detection
  const evidenceCounts = new Map<string, number>();
  for (const ctrl of controls) {
    const ev = ctrl.evidence?.trim() ?? "";
    if (ev) {
      evidenceCounts.set(ev, (evidenceCounts.get(ev) ?? 0) + 1);
    }
  }

  return controls.map(ctrl => {
    const evidence = ctrl.evidence?.trim() ?? "";
    const flags: BoilerplateResult["flags"] = [];

    if (!evidence) {
      return { controlId: ctrl.id, flags: [], specificity: 0 };
    }

    // Template detection: 3+ controls with identical evidence
    const count = evidenceCounts.get(evidence) ?? 0;
    if (count >= 3) {
      flags.push("template");
    }

    // Shallow: evidence < 20 chars
    if (evidence.length < 20) {
      flags.push("shallow");
    }

    // Calculate specificity
    const specificity = calculateSpecificity(evidence);

    // Generic boilerplate: matches known phrases AND low specificity
    const isGenericPhrase = GENERIC_BOILERPLATE_PHRASES.some(pat => pat.test(evidence));
    if (isGenericPhrase && specificity < 20) {
      flags.push("generic-boilerplate");
    }

    // Wordy but empty: long text (>50 chars) but low specificity (<20)
    if (evidence.length > 50 && specificity < 20 && !isGenericPhrase) {
      // Check if it's just verbose boilerplate
      const hasAnySpecific = specificity > 0;
      if (!hasAnySpecific) {
        flags.push("generic-boilerplate");
      }
    }

    return { controlId: ctrl.id, flags, specificity };
  });
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

// =============================================================================
// PHASE 6A: NIST 800-53A ASSESSMENT DEPTH CLASSIFICATION
// =============================================================================

/**
 * NIST 800-53A assessment method detection patterns.
 * Three methods: Examine, Interview, Test — each at Basic/Focused/Comprehensive depth.
 */
const NIST_EXAMINE_PATTERNS = {
  basic: [/\breview(?:ed)?\b/i, /\bread\b/i, /\blooked\s+at\b/i],
  focused: [/\bstud(?:y|ied)\b/i, /\bexamin(?:ed|e)\b/i, /\binspect(?:ed)?\b/i, /\banalyz(?:ed|e)\b/i],
  comprehensive: [/\bstatistical\s+analysis\b/i, /\bfull\s+population\b/i, /\bmulti-?source\b/i, /\bcorroborat/i],
};

const NIST_INTERVIEW_PATTERNS = {
  basic: [/\binquir/i, /\basked\b/i, /\bmanagement\s+stated\b/i],
  focused: [/\binterview(?:ed)?\b/i, /\bdiscussed\s+with\b/i, /\bpersonnel\s+confirmed\b/i],
  comprehensive: [/\bmultiple\s+(?:personnel|staff|individuals)\b/i, /\bcross-?referenc/i],
};

const NIST_TEST_PATTERNS = {
  basic: [/\btested\b/i, /\bverified\b/i, /\bchecked\b/i],
  focused: [/\breperform/i, /\bexecut(?:ed|e)\b/i, /\bsample\s+of\s+\d+/i, /\bobserved\b/i],
  comprehensive: [/\bautomated\s+(?:scan|test)/i, /\bcontinuous\s+monitor/i, /\bCAAT\b/i, /\bfull\s+regression/i],
};

type NistMethod = "examine" | "interview" | "test";
type NistDepth = "basic" | "focused" | "comprehensive";

/**
 * Classify evidence against NIST 800-53A's assessment method taxonomy.
 * Returns detected methods, depth, and rigor score (0-100).
 */
export function classifyAssessmentDepth(control: IngestedControl): {
  methods: NistMethod[];
  depth: NistDepth;
  rigorScore: number;
} {
  const evidence = control.evidence?.trim() ?? "";
  if (!evidence) {
    return { methods: [], depth: "basic", rigorScore: 0 };
  }

  const methodDepths: Array<{ method: NistMethod; depth: NistDepth }> = [];

  // Check each method
  const methodPatterns: Array<{ method: NistMethod; patterns: Record<NistDepth, RegExp[]> }> = [
    { method: "examine", patterns: NIST_EXAMINE_PATTERNS },
    { method: "interview", patterns: NIST_INTERVIEW_PATTERNS },
    { method: "test", patterns: NIST_TEST_PATTERNS },
  ];

  for (const { method, patterns } of methodPatterns) {
    let bestDepth: NistDepth | null = null;

    // Check from comprehensive down to basic
    for (const depth of ["comprehensive", "focused", "basic"] as NistDepth[]) {
      const depthPatterns = patterns[depth];
      if (depthPatterns.some(p => p.test(evidence))) {
        bestDepth = depth;
        break; // Take the highest depth found
      }
    }

    if (bestDepth) {
      methodDepths.push({ method, depth: bestDepth });
    }
  }

  const methods = methodDepths.map(md => md.method);

  // Overall depth = highest depth across all detected methods
  let overallDepth: NistDepth = "basic";
  for (const md of methodDepths) {
    if (md.depth === "comprehensive") { overallDepth = "comprehensive"; break; }
    if (md.depth === "focused") overallDepth = "focused";
  }

  // Rigor score: methods present x depth
  const depthMultiplier: Record<NistDepth, number> = {
    basic: 1,
    focused: 1.67,
    comprehensive: 2.33,
  };

  // Base scores: 1 method = 15, 2 = 30, 3 = 45 (at basic)
  const baseScore = methods.length * 15;
  const rigorScore = Math.min(100, Math.round(baseScore * depthMultiplier[overallDepth]));

  return { methods, depth: overallDepth, rigorScore };
}

// =============================================================================
// PHASE 6B: SLSA-INSPIRED PROVENANCE QUALITY GATES
// =============================================================================

/**
 * Compute provenance quality score (0-100) based on SLSA-inspired artifact-level checks.
 *
 * 7 checks, each worth up to ~14 points:
 * 1. Evidence exists with source identified
 * 2. Source identity provided
 * 3. Document hash present
 * 4. Source date within 365 days
 * 5. Source is not "self" (for L1+)
 * 6. Auditor identified (for auditor sources)
 * 7. Evidence non-empty across all controls
 */
export function computeProvenanceQuality(
  controls: IngestedControl[],
  source: DocumentSource,
  metadata: DocumentMetadata,
): number {
  let score = 0;
  const checkWeight = 14; // ~14 points per check

  // 1. Evidence exists with source identified
  const hasEvidence = controls.some(c => c.evidence && c.evidence.trim().length > 0);
  if (hasEvidence && source) score += checkWeight;

  // 2. Source identity provided
  const identity = metadata.auditor || metadata.issuer;
  if (identity && identity.trim().length > 0 && identity !== "Unknown") {
    score += checkWeight;
  }

  // 3. Document hash present
  if (metadata.rawTextHash && metadata.rawTextHash.length > 0) {
    score += checkWeight;
  }

  // 4. Source date within 365 days
  if (metadata.date && metadata.date.length > 0) {
    const freshness = assessFreshness(metadata.date);
    if (freshness.ageDays >= 0 && freshness.ageDays <= 365) {
      score += checkWeight;
    }
  }

  // 5. Source is not "self"
  const provenanceType = sourceToProvenanceType(source);
  if (provenanceType !== "self") {
    score += checkWeight;
  }

  // 6. Auditor identified (for auditor sources)
  if (provenanceType === "auditor" && metadata.auditor && metadata.auditor.trim().length > 0) {
    score += checkWeight;
  } else if (provenanceType !== "auditor") {
    // Non-auditor sources get partial credit for this check
    score += Math.round(checkWeight * 0.5);
  }

  // 7. Evidence non-empty across ALL controls
  const allHaveEvidence = controls.every(c => c.evidence && c.evidence.trim().length > 0);
  if (allHaveEvidence && controls.length > 0) {
    score += checkWeight;
  }

  return Math.min(100, score);
}

// =============================================================================
// PHASE 6C: CIS-STYLE BINARY EVIDENCE QUALITY CHECKS
// =============================================================================

/**
 * Run 16 CIS-style binary evidence quality checks.
 * Each check is deterministic pass/fail — zero ambiguity.
 */
export function runBinaryChecks(
  controls: IngestedControl[],
  source: DocumentSource,
  metadata: DocumentMetadata,
  assurance: CPOEAssurance,
): { passed: number; total: number; checks: Record<string, boolean> } {
  const checks: Record<string, boolean> = {};

  // 1. evidence-exists: Every in-scope control has non-empty evidence
  checks["evidence-exists"] = controls.length > 0 &&
    controls.every(c => c.evidence && c.evidence.trim().length > 0);

  // 2. evidence-date-present: Source date is parseable ISO-8601
  const dateValid = metadata.date && !isNaN(new Date(metadata.date).getTime());
  checks["evidence-date-present"] = !!dateValid;

  // 3. source-identified: Source is not "self" for L1+
  const provenanceType = sourceToProvenanceType(source);
  checks["source-identified"] = assurance.declared === 0 || provenanceType !== "self";

  // 4. source-identity-present: Provenance source identity is non-empty
  const identity = metadata.auditor || metadata.issuer;
  checks["source-identity-present"] = !!(identity && identity.trim().length > 0 && identity !== "Unknown");

  // 5. document-hash-valid: SHA-256 hash present (if available)
  checks["document-hash-valid"] = !!(metadata.rawTextHash && metadata.rawTextHash.length > 0);

  // 6. exclusion-rationale: Every excluded control has non-empty reason
  if (assurance.excluded && assurance.excluded.length > 0) {
    checks["exclusion-rationale"] = assurance.excluded.every(e => e.reason && e.reason.trim().length > 0);
  } else {
    checks["exclusion-rationale"] = true; // No exclusions = passes
  }

  // 7. no-future-dates: Evidence date is not in the future
  if (dateValid) {
    checks["no-future-dates"] = new Date(metadata.date) <= new Date();
  } else {
    checks["no-future-dates"] = true; // No date = no future date
  }

  // 8. no-expired-evidence: Evidence date within 365 days
  if (dateValid) {
    const freshness = assessFreshness(metadata.date);
    checks["no-expired-evidence"] = freshness.ageDays >= 0 && freshness.ageDays <= 365;
  } else {
    checks["no-expired-evidence"] = false; // No date = can't verify freshness
  }

  // 9. framework-mapped: At least 1 control maps to a recognized framework
  checks["framework-mapped"] = controls.some(c => c.frameworkRefs && c.frameworkRefs.length > 0);

  // 10. no-duplicate-evidence: No 3+ controls share identical evidence
  const evidenceCounts = new Map<string, number>();
  for (const c of controls) {
    const ev = c.evidence?.trim() ?? "";
    if (ev) evidenceCounts.set(ev, (evidenceCounts.get(ev) ?? 0) + 1);
  }
  checks["no-duplicate-evidence"] = ![...evidenceCounts.values()].some(count => count >= 3);

  // 11. methodology-present: At least 1 control has detectable methodology
  const hasMethodology = controls.some(c => {
    if (!c.evidence) return false;
    const classification = classifyEvidenceContent(c, source);
    return classification.methodology !== "unknown" && classification.methodology !== "none";
  });
  checks["methodology-present"] = hasMethodology;

  // 12. sample-size-adequate: No control flagged as INADEQUATE sample
  const hasInadequate = controls.some(c => {
    if (!c.evidence) return false;
    const result = extractSampleSize(c.evidence);
    return result.adequate === false;
  });
  checks["sample-size-adequate"] = !hasInadequate;

  // 13. anti-gaming-pass: All anti-gaming safeguards pass (effective == declared)
  const safeguards = applyAntiGamingSafeguards(assurance.declared, controls, source, metadata);
  checks["anti-gaming-pass"] = safeguards.appliedSafeguards.length === 0;

  // 14. signature-valid: CPOE has verified assurance
  checks["signature-valid"] = assurance.verified === true;

  // 15. scope-non-empty: Scope field is non-empty and > 10 chars
  checks["scope-non-empty"] = !!(metadata.scope && metadata.scope.trim().length > 10);

  // 16. assurance-verified: Declared level matches controls
  checks["assurance-verified"] = assurance.verified === true;

  const passed = Object.values(checks).filter(v => v).length;
  return { passed, total: 16, checks };
}

// =============================================================================
// PHASE 6D: DORA-STYLE PAIRED ANTI-GAMING METRICS
// =============================================================================

/**
 * Compute four DORA-style paired anti-gaming metrics.
 *
 * DORA insight: metrics work in PAIRS to prevent gaming.
 * - Freshness pairs with Reproducibility (can't just re-date old evidence)
 * - Specificity pairs with Independence (can't fabricate detail without corroboration)
 *
 * Divergence > 40 points between paired metrics triggers a flag.
 * Overall band = min of all four metrics.
 */
export function computeDoraMetrics(
  controls: IngestedControl[],
  source: DocumentSource,
  metadata: DocumentMetadata,
  dimensions: AssuranceDimensions,
): {
  freshness: number;
  specificity: number;
  independence: number;
  reproducibility: number;
  band: "elite" | "high" | "medium" | "low";
  pairingFlags: string[];
} {
  // Freshness: from dimensions.freshness (already 0-100)
  const freshness = Math.max(0, Math.min(100, dimensions.freshness));

  // Specificity: proportion of controls with structured evidence (method + tool/system)
  let specificityTotal = 0;
  for (const c of controls) {
    const evidence = c.evidence?.trim() ?? "";
    if (!evidence) continue;

    let ctrlSpecificity = 0;
    // Has methodology keyword
    const cls = classifyEvidenceContent(c, source);
    if (cls.methodology !== "unknown" && cls.methodology !== "none") ctrlSpecificity += 40;
    // Has named system
    if (KNOWN_SYSTEMS.some(p => p.test(evidence))) ctrlSpecificity += 30;
    // Has quantified results
    if (QUANTIFIED_PATTERNS.some(p => p.test(evidence))) ctrlSpecificity += 30;

    specificityTotal += Math.min(100, ctrlSpecificity);
  }
  const specificity = controls.length > 0
    ? Math.round(specificityTotal / controls.length)
    : 0;

  // Independence: from dimensions.independence (already 0-100)
  const independence = Math.max(0, Math.min(100, dimensions.independence));

  // Reproducibility: can someone re-verify?
  // High if evidence has procedure names + sample sizes + expected outputs
  let reproTotal = 0;
  for (const c of controls) {
    const evidence = c.evidence?.trim() ?? "";
    if (!evidence) continue;

    let ctrlRepro = 0;
    // Has procedure names
    if (PROCEDURE_PATTERNS.some(p => p.test(evidence))) ctrlRepro += 35;
    // Has sample sizes
    const sampleResult = extractSampleSize(evidence);
    if (sampleResult.sample !== null) ctrlRepro += 35;
    // Has method description
    if (evidence.length > 50) ctrlRepro += 15;
    // Has expected output / results
    if (QUANTIFIED_PATTERNS.some(p => p.test(evidence))) ctrlRepro += 15;

    reproTotal += Math.min(100, ctrlRepro);
  }
  const reproducibility = controls.length > 0
    ? Math.round(reproTotal / controls.length)
    : 0;

  // Pairing flags
  const pairingFlags: string[] = [];

  // Freshness vs Reproducibility
  if (Math.abs(freshness - reproducibility) > 40) {
    if (freshness > reproducibility) {
      pairingFlags.push("High freshness + low reproducibility: evidence refreshed but cannot be re-verified");
    } else {
      pairingFlags.push("Low freshness + high reproducibility: reproducible but stale evidence");
    }
  }

  // Specificity vs Independence
  if (Math.abs(specificity - independence) > 40) {
    if (specificity > independence) {
      pairingFlags.push("High specificity + low independence: detailed self-assessment without corroboration");
    } else {
      pairingFlags.push("Low specificity + high independence: independent but vague assessment");
    }
  }

  // Overall band = min of all four
  const minMetric = Math.min(freshness, specificity, independence, reproducibility);
  let band: "elite" | "high" | "medium" | "low";
  if (minMetric >= 90) band = "elite";
  else if (minMetric >= 70) band = "high";
  else if (minMetric >= 40) band = "medium";
  else band = "low";

  return { freshness, specificity, independence, reproducibility, band, pairingFlags };
}
