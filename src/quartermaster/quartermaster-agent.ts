/**
 * Quartermaster Agent — Governance Verification Layer
 *
 * The Quartermaster is an adversarial evaluator that reviews Corsair assessment
 * results for integrity, completeness, methodology, and bias.
 *
 * Architecture:
 *   Phase 1 (deterministic): Hash chain verification, timestamp checks,
 *     RAID-PLUNDER correlation — no LLM needed.
 *   Phase 2 (LLM): Methodology review, completeness analysis, bias detection
 *     — separate Claude API call to prevent self-validation.
 *   Phase 3: Weighted score computation → trust tier assignment.
 *
 * Dimension weights (sum to 1.0):
 *   methodology=0.30, evidence_integrity=0.25, completeness=0.25, bias_detection=0.20
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";

import type {
  QuartermasterConfig,
  QuartermasterInput,
  QuartermasterDocumentInput,
  QuartermasterGovernanceReport,
  QuartermasterDimensionScore,
  QuartermasterFinding,
} from "./quartermaster-types";

import {
  classifyEvidenceContent,
  detectBoilerplate,
} from "../ingestion/assurance-calculator";

// =============================================================================
// LLM ANALYSIS RESULT (internal)
// =============================================================================

export interface LLMAnalysisResult {
  methodology_adjustment: number;
  completeness_adjustment: number;
  bias_adjustment: number;
  findings: Array<{
    severity: "critical" | "warning" | "info";
    category: string;
    description: string;
    remediation: string;
  }>;
  narrative: string;
}

// =============================================================================
// DIMENSION CHECK RESULT (internal)
// =============================================================================

export interface DimensionCheckResult {
  score: number;
  findings: QuartermasterFinding[];
}

// =============================================================================
// DEFAULT WEIGHTS
// =============================================================================

const DEFAULT_WEIGHTS: Record<string, number> = {
  methodology: 0.3,
  evidence_integrity: 0.25,
  completeness: 0.25,
  bias_detection: 0.2,
};

const DEFAULT_TRUST_THRESHOLDS = {
  aiVerified: 70,
  auditorVerified: 90,
};

// =============================================================================
// ADMIRAL AGENT
// =============================================================================

export class QuartermasterAgent {
  private config: QuartermasterConfig;
  private weights: Record<string, number>;
  private trustThresholds: { aiVerified: number; auditorVerified: number };

  constructor(config: QuartermasterConfig) {
    this.config = config;
    this.weights = { ...DEFAULT_WEIGHTS, ...config.weights };
    this.trustThresholds = {
      aiVerified: config.trustThresholds?.aiVerified ?? DEFAULT_TRUST_THRESHOLDS.aiVerified,
      auditorVerified: config.trustThresholds?.auditorVerified ?? DEFAULT_TRUST_THRESHOLDS.auditorVerified,
    };
  }

  // ===========================================================================
  // PUBLIC: Full evaluation (deterministic baseline + optional LLM enhancement)
  // ===========================================================================

  async evaluate(input: QuartermasterInput): Promise<QuartermasterGovernanceReport> {
    const startTime = Date.now();
    const modelId = this.config.model || "deterministic";
    const useLLM = modelId !== "deterministic" && modelId.startsWith("claude");

    // Phase 1: Deterministic checks
    const evidenceResult = this.checkEvidenceIntegrity(input);
    const timestampResult = this.checkTimestampConsistency(input);
    const correlationResult = this.checkRaidPlunderCorrelation(input);

    // Phase 2: Methodology and completeness (deterministic approximation)
    const methodologyResult = this.checkMethodology(input);
    const biasResult = this.checkBias(input);

    // Phase 2.5: LLM enhancement (if model is a Claude model ID)
    let llmResult: LLMAnalysisResult | null = null;
    if (useLLM) {
      llmResult = await this.evaluateWithLLM(input);
    }

    // Phase 3: Build dimensions (apply LLM adjustments if available)
    const methodologyScore = this.applyAdjustment(
      methodologyResult.score,
      llmResult?.methodology_adjustment
    );
    const completenessBaseScore = this.computeCompletenessScore(timestampResult, correlationResult);
    const completenessScore = this.applyAdjustment(
      completenessBaseScore,
      llmResult?.completeness_adjustment
    );
    const biasScore = this.applyAdjustment(
      biasResult.score,
      llmResult?.bias_adjustment
    );

    // Merge LLM findings into dimension findings
    const llmMethodologyFindings = this.extractLLMFindings(llmResult, "methodology");
    const llmCompletenessFindings = this.extractLLMFindings(llmResult, "completeness");
    const llmBiasFindings = this.extractLLMFindings(llmResult, "bias_detection");

    const dimensions: QuartermasterDimensionScore[] = [
      {
        dimension: "methodology",
        score: methodologyScore,
        weight: this.weights.methodology,
        rationale: this.buildRationale("methodology", { score: methodologyScore, findings: [...methodologyResult.findings, ...llmMethodologyFindings] }),
        findings: [...methodologyResult.findings, ...llmMethodologyFindings],
      },
      {
        dimension: "evidence_integrity",
        score: evidenceResult.score,
        weight: this.weights.evidence_integrity,
        rationale: this.buildRationale("evidence_integrity", evidenceResult),
        findings: evidenceResult.findings,
      },
      {
        dimension: "completeness",
        score: completenessScore,
        weight: this.weights.completeness,
        rationale: this.buildRationale("completeness", {
          score: completenessScore,
          findings: [...timestampResult.findings, ...correlationResult.findings, ...llmCompletenessFindings],
        }),
        findings: [...timestampResult.findings, ...correlationResult.findings, ...llmCompletenessFindings],
      },
      {
        dimension: "bias_detection",
        score: biasScore,
        weight: this.weights.bias_detection,
        rationale: this.buildRationale("bias_detection", { score: biasScore, findings: [...biasResult.findings, ...llmBiasFindings] }),
        findings: [...biasResult.findings, ...llmBiasFindings],
      },
    ];

    // Phase 4: Compute weighted confidence score
    const confidenceScore = this.computeWeightedScore(dimensions);

    // Phase 5: Trust tier
    const trustTier = this.computeTrustTier(confidenceScore);

    // Collect all findings
    const allFindings = dimensions.flatMap((d) => d.findings);
    const findingsBySeverity = {
      critical: allFindings.filter((f) => f.severity === "critical").length,
      warning: allFindings.filter((f) => f.severity === "warning").length,
      info: allFindings.filter((f) => f.severity === "info").length,
    };

    const durationMs = Date.now() - startTime;

    // Build executive summary (append LLM narrative if available)
    let executiveSummary = this.buildExecutiveSummary(confidenceScore, trustTier, findingsBySeverity);
    if (llmResult?.narrative) {
      executiveSummary += ` Quartermaster analysis: ${llmResult.narrative}`;
    }

    // Build report
    const report: Omit<QuartermasterGovernanceReport, "reportHash"> = {
      reportId: `quartermaster-${Date.now()}`,
      confidenceScore,
      dimensions,
      trustTier,
      totalFindings: allFindings.length,
      findingsBySeverity,
      executiveSummary,
      evaluatedAt: new Date().toISOString(),
      durationMs,
      model: modelId,
      reportHash: "",
    };

    // Compute report hash
    const reportHash = createHash("sha256")
      .update(JSON.stringify(report))
      .digest("hex");

    return { ...report, reportHash };
  }

  // ===========================================================================
  // PUBLIC: Document-specific evaluation (Phase 5 — Probo checks)
  // ===========================================================================

  /**
   * Evaluate an ingested document for governance quality.
   * Deterministic-only — no LLM call. Scores across four dimensions:
   *   methodology (0.30): Evidence quality + assessor notes + structural completeness
   *   evidence_integrity (0.25): Boilerplate + text length distribution + tech stack refs
   *   completeness (0.25): Evidence coverage + gap acknowledgment + scope
   *   bias_detection (0.20): Severity distribution + pass/fail ratio + all-pass bias
   *
   * Also runs Probo checks: auditor legitimacy (1), system description (4), AICPA structure (6).
   */
  evaluateDocument(input: QuartermasterDocumentInput): QuartermasterGovernanceReport {
    const startTime = Date.now();

    // Run Phase 1 classifiers on controls
    const boilerplateResults = detectBoilerplate(input.controls);
    const boilerplateMap = new Map(boilerplateResults.map(b => [b.controlId, b]));

    const classifications = input.controls.map(ctrl =>
      classifyEvidenceContent(ctrl, input.source)
    );

    // ---- Dimension 1: Methodology (weight 0.30) ----
    const methodologyResult = this.checkDocMethodology(input, classifications, boilerplateMap);

    // ---- Dimension 2: Evidence Integrity (weight 0.25) ----
    const integrityResult = this.checkDocEvidenceIntegrity(input, boilerplateMap);

    // ---- Dimension 3: Completeness (weight 0.25) ----
    const completenessResult = this.checkDocCompleteness(input);

    // ---- Dimension 4: Bias Detection (weight 0.20) ----
    const biasResult = this.checkDocBias(input);

    // ---- Probo Checks (findings go into relevant dimensions) ----
    const auditorFindings = this.checkAuditorLegitimacy(input);
    const systemFindings = this.checkSystemDescription(input);
    const structuralFindings = this.checkStructuralCompleteness(input);

    // Merge Probo findings into dimensions
    // Auditor legitimacy affects methodology
    for (const f of auditorFindings) {
      methodologyResult.findings.push(f);
      if (f.severity === "warning") methodologyResult.score -= 15;
      else if (f.severity === "info") methodologyResult.score += 5;
    }

    // System description affects methodology and integrity
    for (const f of systemFindings) {
      if (f.description.includes("disconnected")) {
        integrityResult.findings.push(f);
        integrityResult.score -= 10;
      } else {
        methodologyResult.findings.push(f);
        if (f.severity === "warning") methodologyResult.score -= 10;
        else if (f.severity === "info") methodologyResult.score += 5;
      }
    }

    // Structural completeness affects methodology
    for (const f of structuralFindings) {
      methodologyResult.findings.push(f);
      methodologyResult.score -= 5;
    }

    // Clamp scores
    methodologyResult.score = Math.max(0, Math.min(100, methodologyResult.score));
    integrityResult.score = Math.max(0, Math.min(100, integrityResult.score));
    completenessResult.score = Math.max(0, Math.min(100, completenessResult.score));
    biasResult.score = Math.max(0, Math.min(100, biasResult.score));

    // Build dimensions
    const dimensions: QuartermasterDimensionScore[] = [
      {
        dimension: "methodology",
        score: methodologyResult.score,
        weight: this.weights.methodology,
        rationale: this.buildRationale("methodology", methodologyResult),
        findings: methodologyResult.findings,
      },
      {
        dimension: "evidence_integrity",
        score: integrityResult.score,
        weight: this.weights.evidence_integrity,
        rationale: this.buildRationale("evidence_integrity", integrityResult),
        findings: integrityResult.findings,
      },
      {
        dimension: "completeness",
        score: completenessResult.score,
        weight: this.weights.completeness,
        rationale: this.buildRationale("completeness", completenessResult),
        findings: completenessResult.findings,
      },
      {
        dimension: "bias_detection",
        score: biasResult.score,
        weight: this.weights.bias_detection,
        rationale: this.buildRationale("bias_detection", biasResult),
        findings: biasResult.findings,
      },
    ];

    const confidenceScore = this.computeWeightedScore(dimensions);
    const trustTier = this.computeTrustTier(confidenceScore);

    const allFindings = dimensions.flatMap(d => d.findings);
    const findingsBySeverity = {
      critical: allFindings.filter(f => f.severity === "critical").length,
      warning: allFindings.filter(f => f.severity === "warning").length,
      info: allFindings.filter(f => f.severity === "info").length,
    };

    const durationMs = Date.now() - startTime;
    const executiveSummary = this.buildExecutiveSummary(confidenceScore, trustTier, findingsBySeverity);

    const report: Omit<QuartermasterGovernanceReport, "reportHash"> = {
      reportId: `qm-doc-${Date.now()}`,
      confidenceScore,
      dimensions,
      trustTier,
      totalFindings: allFindings.length,
      findingsBySeverity,
      executiveSummary,
      evaluatedAt: new Date().toISOString(),
      durationMs,
      model: "deterministic",
      reportHash: "",
    };

    const reportHash = createHash("sha256")
      .update(JSON.stringify(report))
      .digest("hex");

    return { ...report, reportHash };
  }

  // ===========================================================================
  // PRIVATE: Document dimension checks
  // ===========================================================================

  /**
   * Methodology dimension for documents.
   * Scores evidence methodology quality using Phase 1 classifications.
   * Consumes assessor notes for enrichment.
   */
  private checkDocMethodology(
    input: QuartermasterDocumentInput,
    classifications: Array<{ methodology: string; maxLevel: number; trace: string }>,
    boilerplateMap: Map<string, { flags: string[] }>,
  ): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];
    let score = 50; // Base score

    // Score based on methodology tiers found
    const tierScores: Record<string, number> = {
      reperformance: 25,
      caat: 25,
      inspection: 15,
      observation: 10,
      inquiry: 0,
      unknown: 0,
      none: -10,
    };

    let methodologyBonus = 0;
    let inquiryCount = 0;
    for (const cls of classifications) {
      methodologyBonus += (tierScores[cls.methodology] ?? 0);
      if (cls.methodology === "inquiry") inquiryCount++;
    }

    // Average bonus across controls
    if (classifications.length > 0) {
      score += Math.round(methodologyBonus / classifications.length);
    }

    // If majority inquiry-only, cap at 40
    if (classifications.length > 0 && inquiryCount / classifications.length > 0.5) {
      score = Math.min(score, 40);
      findings.push({
        id: `QM-DOC-MT-${Date.now()}-inquiry`,
        severity: "warning",
        category: "methodology",
        description: `Majority of controls (${inquiryCount}/${classifications.length}) have inquiry-only evidence`,
        evidence: [],
        remediation: "Include inspection, observation, or reperformance evidence for higher assurance",
      });
    }

    // Assessor notes enrichment
    if (input.assessmentContext?.assessorNotes) {
      const notes = input.assessmentContext.assessorNotes.toLowerCase();
      const methodKeywords = ["reperform", "sample", "population", "walkthrough", "observed", "inspect", "examined"];
      const matchCount = methodKeywords.filter(kw => notes.includes(kw)).length;
      score += matchCount * 3; // Up to +21 for all 7 keywords
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  /**
   * Evidence integrity dimension for documents.
   * Checks evidence non-emptiness, text length distribution, boilerplate flags,
   * and tech stack cross-references.
   */
  private checkDocEvidenceIntegrity(
    input: QuartermasterDocumentInput,
    boilerplateMap: Map<string, { flags: string[] }>,
  ): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];
    let score = 70; // Base: controls have evidence

    // All controls with non-empty evidence
    const withEvidence = input.controls.filter(c => c.evidence && c.evidence.trim().length > 0);
    if (withEvidence.length === input.controls.length) {
      score += 15;
    } else {
      const missing = input.controls.length - withEvidence.length;
      score -= missing * 5;
      findings.push({
        id: `QM-DOC-EI-${Date.now()}-missing`,
        severity: "warning",
        category: "evidence_integrity",
        description: `${missing} of ${input.controls.length} controls have no evidence`,
        evidence: [],
        remediation: "Ensure all in-scope controls have supporting evidence",
      });
    }

    // Text length distribution — flag if all evidence is very short
    const lengths = input.controls.map(c => (c.evidence || "").length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
    if (avgLength < 30 && input.controls.length > 0) {
      score -= 15;
      findings.push({
        id: `QM-DOC-EI-${Date.now()}-short`,
        severity: "warning",
        category: "evidence_integrity",
        description: `Average evidence length is ${Math.round(avgLength)} characters — very thin`,
        evidence: [],
        remediation: "Evidence should describe test procedures and results in detail",
      });
    }

    // Boilerplate penalty from Phase 1
    let boilerplateCount = 0;
    for (const [, bp] of boilerplateMap) {
      if (bp.flags.length > 0) boilerplateCount++;
    }
    const bpPenalty = Math.min(30, boilerplateCount * 10);
    if (bpPenalty > 0) {
      score -= bpPenalty;
      findings.push({
        id: `QM-DOC-EI-${Date.now()}-boilerplate`,
        severity: "warning",
        category: "evidence_integrity",
        description: `${boilerplateCount} controls flagged for boilerplate/template evidence`,
        evidence: [],
        remediation: "Replace template evidence with specific test procedures and results",
      });
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  /**
   * Completeness dimension for documents.
   * Checks evidence coverage, gap acknowledgment, scope.
   */
  private checkDocCompleteness(input: QuartermasterDocumentInput): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];
    let score = 60; // Base

    // All controls with evidence
    const withEvidence = input.controls.filter(c => c.evidence && c.evidence.trim().length > 0);
    if (withEvidence.length === input.controls.length) {
      score += 25;
    } else {
      score += Math.round((withEvidence.length / input.controls.length) * 20);
    }

    // Gaps acknowledged with rationale
    if (input.assessmentContext?.gaps && input.assessmentContext.gaps.length > 0) {
      // Acknowledging gaps is GOOD (transparency), but many gaps is concerning
      const gapCount = input.assessmentContext.gaps.length;
      if (gapCount <= 3) {
        score += 10; // Transparent about limitations
      } else {
        score -= (gapCount - 3) * 3; // Excessive gaps reduce completeness
        findings.push({
          id: `QM-DOC-CO-${Date.now()}-gaps`,
          severity: "info",
          category: "completeness",
          description: `${gapCount} scope gaps identified — significant exclusions`,
          evidence: [],
          remediation: "Review whether excluded areas represent material risk",
        });
      }
    }

    // Scope coverage from metadata
    if (input.metadata.scope && input.metadata.scope.length > 20) {
      score += 5; // Detailed scope description
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  /**
   * Bias detection dimension for documents.
   * Checks pass/fail distribution, severity distribution, all-pass bias.
   */
  private checkDocBias(input: QuartermasterDocumentInput): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];
    let score = 90; // Start high, deduct for bias indicators

    const effective = input.controls.filter(c => c.status === "effective").length;
    const total = input.controls.length;

    // All-pass bias: 100% effective with 10+ controls
    if (total >= 10 && effective === total) {
      score -= 15;
      findings.push({
        id: `QM-DOC-BD-${Date.now()}-allpass`,
        severity: "warning",
        category: "bias_detection",
        description: `All ${total} controls are effective — 100% pass rate with 10+ controls is statistically unusual`,
        evidence: [],
        remediation: "Verify testing rigor was sufficient to detect failures",
      });
    }

    // Severity distribution check
    const severities = input.controls
      .filter(c => c.severity)
      .map(c => c.severity);
    const uniqueSeverities = new Set(severities);
    if (severities.length >= 5 && uniqueSeverities.size === 1) {
      score -= 5;
      findings.push({
        id: `QM-DOC-BD-${Date.now()}-monosev`,
        severity: "info",
        category: "bias_detection",
        description: `All ${severities.length} controls have the same severity (${severities[0]}) — may indicate mechanical classification`,
        evidence: [],
        remediation: "Verify severity was assigned based on actual risk, not template",
      });
    }

    // Ineffective controls without evidence is suspicious
    const ineffectiveNoEvidence = input.controls.filter(
      c => c.status === "ineffective" && (!c.evidence || c.evidence.trim().length === 0)
    );
    if (ineffectiveNoEvidence.length > 0) {
      score -= 10;
      findings.push({
        id: `QM-DOC-BD-${Date.now()}-noevfail`,
        severity: "warning",
        category: "bias_detection",
        description: `${ineffectiveNoEvidence.length} ineffective controls have no evidence — failure not documented`,
        evidence: [],
        remediation: "All findings should include evidence of the deficiency",
      });
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  // ===========================================================================
  // PRIVATE: Probo Checks (document-specific)
  // ===========================================================================

  /**
   * Probo Check 1: Auditor Legitimacy.
   * Extract and validate auditor identity from metadata.
   */
  private checkAuditorLegitimacy(input: QuartermasterDocumentInput): QuartermasterFinding[] {
    const findings: QuartermasterFinding[] = [];
    const auditor = input.metadata.auditor;

    if (!auditor || auditor.trim().length === 0) {
      findings.push({
        id: `QM-DOC-AL-${Date.now()}-missing`,
        severity: "warning",
        category: "auditor_legitimacy",
        description: "Auditor name missing from report metadata",
        evidence: [],
        remediation: "Verify the report includes the name of the CPA firm that performed the audit",
      });
      return findings;
    }

    // Generic auditor name patterns
    const genericPatterns = [
      /^the auditor$/i,
      /^audit firm$/i,
      /^auditor$/i,
      /^external auditor$/i,
      /^independent auditor$/i,
    ];

    const isGeneric = genericPatterns.some(p => p.test(auditor.trim()));
    if (isGeneric) {
      findings.push({
        id: `QM-DOC-AL-${Date.now()}-generic`,
        severity: "warning",
        category: "auditor_legitimacy",
        description: `Auditor name "${auditor}" appears generic — expected a specific firm name`,
        evidence: [],
        remediation: "Report should identify the specific CPA firm (e.g., 'Deloitte & Touche LLP')",
      });
      return findings;
    }

    // CPA firm pattern check: contains "LLP", "LLC", "&", "Associates", "Consulting", "Partners"
    const cpaPatterns = /\b(LLP|LLC|&|Associates|Consulting|Partners|Group|Advisory|P\.?C\.?)\b/i;
    if (cpaPatterns.test(auditor)) {
      // Good — looks like a real firm name (info-level positive finding)
      findings.push({
        id: `QM-DOC-AL-${Date.now()}-cpa`,
        severity: "info",
        category: "auditor_legitimacy",
        description: `Auditor "${auditor}" matches CPA firm naming pattern`,
        evidence: [],
        remediation: "No action needed",
      });
    }

    return findings;
  }

  /**
   * Probo Check 4: System Description Specificity.
   * Validate tech stack presence and cross-reference with evidence.
   */
  private checkSystemDescription(input: QuartermasterDocumentInput): QuartermasterFinding[] {
    const findings: QuartermasterFinding[] = [];
    const techStack = input.assessmentContext?.techStack;

    if (!techStack || techStack.length === 0) {
      findings.push({
        id: `QM-DOC-SD-${Date.now()}-empty`,
        severity: "warning",
        category: "system_description",
        description: "No system description — cannot verify scope coverage",
        evidence: [],
        remediation: "Include technology stack details (e.g., 'Okta for IdP', 'AWS for cloud')",
      });
      return findings;
    }

    // Cross-reference: do tech stack names appear in evidence text?
    const allEvidence = input.controls
      .map(c => c.evidence || "")
      .join(" ")
      .toLowerCase();

    let referencedCount = 0;
    for (const entry of techStack) {
      const techName = entry.technology.toLowerCase();
      if (allEvidence.includes(techName)) {
        referencedCount++;
      }
    }

    if (referencedCount === 0) {
      findings.push({
        id: `QM-DOC-SD-${Date.now()}-disconnect`,
        severity: "warning",
        category: "system_description",
        description: `System description disconnected from evidence — none of ${techStack.length} tech stack entries appear in control evidence`,
        evidence: [],
        remediation: "Evidence should reference the specific systems being assessed",
      });
    }

    // Check for generic-only system names
    const genericTerms = ["cloud provider", "identity system", "database", "monitoring", "server", "system"];
    const allGeneric = techStack.every(entry => {
      const tech = entry.technology.toLowerCase();
      return genericTerms.some(g => tech === g);
    });

    if (allGeneric) {
      findings.push({
        id: `QM-DOC-SD-${Date.now()}-generic`,
        severity: "info",
        category: "system_description",
        description: "Tech stack contains only generic terms, no specific product names",
        evidence: [],
        remediation: "Use specific product names (e.g., 'Okta' not 'identity system')",
      });
    }

    return findings;
  }

  /**
   * Probo Check 6: AICPA Structural Completeness.
   * For SOC 2 documents only — verify expected structural sections were present.
   */
  private checkStructuralCompleteness(input: QuartermasterDocumentInput): QuartermasterFinding[] {
    const findings: QuartermasterFinding[] = [];

    // Only applies to SOC 2 documents
    if (input.source !== "soc2") return findings;

    const sections = input.metadata.structuralSections;
    if (!sections) return findings; // No section data available

    const sectionNames: Record<string, string> = {
      auditorReport: "Independent Auditor's Report",
      managementAssertion: "Management's Assertion",
      systemDescription: "System Description",
      controlMatrix: "Trust Services Criteria & Controls",
      testResults: "Tests of Controls & Results",
    };

    for (const [key, label] of Object.entries(sectionNames)) {
      if (!sections[key as keyof typeof sections]) {
        findings.push({
          id: `QM-DOC-SC-${Date.now()}-${key}`,
          severity: "warning",
          category: "structural_completeness",
          description: `Missing SOC 2 section: ${label}`,
          evidence: [],
          remediation: `Verify the SOC 2 report includes the ${label} section`,
        });
      }
    }

    return findings;
  }

  // ===========================================================================
  // PUBLIC: Individual deterministic checks (exposed for testing)
  // ===========================================================================

  /**
   * Check evidence hash chain integrity across all evidence files.
   */
  checkEvidenceIntegrity(input: QuartermasterInput): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];

    if (input.evidencePaths.length === 0) {
      findings.push({
        id: `ADM-EI-${Date.now()}`,
        severity: "critical",
        category: "evidence_integrity",
        description: "No evidence paths provided",
        evidence: [],
        remediation: "Ensure PLUNDER phase produces evidence files",
      });
      return { score: 0, findings };
    }

    let allValid = true;
    let totalRecords = 0;

    for (const path of input.evidencePaths) {
      if (!existsSync(path)) {
        findings.push({
          id: `ADM-EI-${Date.now()}-${path}`,
          severity: "critical",
          category: "evidence_integrity",
          description: `Evidence file not found: ${path}`,
          evidence: [path],
          remediation: "Re-run PLUNDER phase to generate evidence",
        });
        allValid = false;
        continue;
      }

      const verification = this.verifyHashChain(path);
      totalRecords += verification.recordCount;

      if (!verification.valid) {
        findings.push({
          id: `ADM-EI-${Date.now()}-broken`,
          severity: "critical",
          category: "evidence_integrity",
          description: `Hash chain broken at record ${verification.brokenAt} in ${path}`,
          evidence: [path],
          remediation: "Evidence may have been tampered with. Re-collect evidence.",
        });
        allValid = false;
      }
    }

    const score = allValid ? 100 : Math.max(0, 100 - findings.length * 30);
    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  /**
   * Check timestamp consistency across evidence records.
   */
  checkTimestampConsistency(input: QuartermasterInput): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];
    let score = 100;

    for (const path of input.evidencePaths) {
      if (!existsSync(path)) continue;

      const records = this.readEvidenceRecords(path);
      if (records.length < 2) continue;

      let prevTimestamp: Date | null = null;
      let firstTimestamp: Date | null = null;
      let lastTimestamp: Date | null = null;

      for (let i = 0; i < records.length; i++) {
        const ts = new Date(records[i].timestamp);

        if (i === 0) firstTimestamp = ts;
        lastTimestamp = ts;

        if (prevTimestamp && ts < prevTimestamp) {
          findings.push({
            id: `ADM-TS-${Date.now()}-${i}`,
            severity: "warning",
            category: "timestamp_consistency",
            description: `Out-of-order timestamp at record ${i + 1}: ${records[i].timestamp} is before ${records[i - 1].timestamp}`,
            evidence: [path],
            remediation: "Investigate clock drift or evidence manipulation",
          });
          score -= 15;
        }

        prevTimestamp = ts;
      }

      // Check for large gaps (>24h)
      if (firstTimestamp && lastTimestamp) {
        const gapMs = lastTimestamp.getTime() - firstTimestamp.getTime();
        const gapHours = gapMs / (1000 * 60 * 60);

        if (gapHours > 24) {
          findings.push({
            id: `ADM-TS-${Date.now()}-gap`,
            severity: "info",
            category: "timestamp_consistency",
            description: `Large time gap (${gapHours.toFixed(1)}h) between first and last evidence records`,
            evidence: [path],
            remediation: "Consider running assessments in shorter time windows",
          });
          score -= 5;
        }
      }
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  /**
   * Check that every RAID result has corresponding PLUNDER evidence.
   */
  checkRaidPlunderCorrelation(input: QuartermasterInput): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];

    if (input.raidResults.length === 0) {
      return { score: 100, findings };
    }

    // Collect all raid IDs from evidence
    const evidenceRaidIds = new Set<string>();
    for (const path of input.evidencePaths) {
      if (!existsSync(path)) continue;
      const records = this.readEvidenceRecords(path);
      for (const record of records) {
        if (record.data?.raidId) {
          evidenceRaidIds.add(record.data.raidId);
        }
      }
    }

    let matchedCount = 0;
    for (const raid of input.raidResults) {
      if (evidenceRaidIds.has(raid.raidId)) {
        matchedCount++;
      } else {
        findings.push({
          id: `ADM-RP-${Date.now()}-${raid.raidId}`,
          severity: "warning",
          category: "raid_plunder_correlation",
          description: `RAID ${raid.raidId} has no corresponding PLUNDER evidence`,
          evidence: [],
          remediation: "Ensure all RAID results are captured by PLUNDER",
        });
      }
    }

    const correlationRate = input.raidResults.length > 0
      ? (matchedCount / input.raidResults.length) * 100
      : 100;

    return { score: Math.max(0, Math.min(100, correlationRate)), findings };
  }

  // ===========================================================================
  // PRIVATE: Additional deterministic checks
  // ===========================================================================

  private checkMethodology(input: QuartermasterInput): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];
    let score = 100;

    // Check: Were MARK results produced?
    if (input.markResults.length === 0) {
      findings.push({
        id: `ADM-MT-${Date.now()}-nomark`,
        severity: "warning",
        category: "methodology",
        description: "No MARK (drift detection) results found",
        evidence: [],
        remediation: "Include MARK phase in assessment pipeline",
      });
      score -= 20;
    }

    // Check: Were RAID results produced?
    if (input.raidResults.length === 0) {
      findings.push({
        id: `ADM-MT-${Date.now()}-noraid`,
        severity: "warning",
        category: "methodology",
        description: "No RAID (attack simulation) results found",
        evidence: [],
        remediation: "Include RAID phase in assessment pipeline",
      });
      score -= 20;
    }

    // Check: Were CHART results produced?
    if (input.chartResults.length === 0) {
      findings.push({
        id: `ADM-MT-${Date.now()}-nochart`,
        severity: "warning",
        category: "methodology",
        description: "No CHART (compliance mapping) results found",
        evidence: [],
        remediation: "Include CHART phase in assessment pipeline",
      });
      score -= 15;
    }

    // Check: Threat model present?
    if (!input.threatModel) {
      findings.push({
        id: `ADM-MT-${Date.now()}-nothreat`,
        severity: "info",
        category: "methodology",
        description: "No threat model used to drive assessment",
        evidence: [],
        remediation: "Use STRIDE threat modeling to systematically identify attack vectors",
      });
      score -= 10;
    }

    // Check: ISC criteria present?
    if (!input.iscCriteria || input.iscCriteria.length === 0) {
      findings.push({
        id: `ADM-MT-${Date.now()}-noisc`,
        severity: "info",
        category: "methodology",
        description: "No ISC (Ideal State Criteria) defined",
        evidence: [],
        remediation: "Define binary testable criteria for each control",
      });
      score -= 10;
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  private checkBias(input: QuartermasterInput): DimensionCheckResult {
    const findings: QuartermasterFinding[] = [];
    let score = 100;

    // Check: Are all RAID results successful (too good to be true)?
    if (input.raidResults.length >= 3) {
      const allBlocked = input.raidResults.every((r) => !r.success);
      if (allBlocked) {
        findings.push({
          id: `ADM-BD-${Date.now()}-allblocked`,
          severity: "info",
          category: "bias_detection",
          description: "All attacks were blocked — verify testing intensity was adequate",
          evidence: [],
          remediation: "Consider increasing attack intensity or adding more vectors",
        });
        score -= 10;
      }

      const allSucceeded = input.raidResults.every((r) => r.success);
      if (allSucceeded) {
        findings.push({
          id: `ADM-BD-${Date.now()}-allfailed`,
          severity: "warning",
          category: "bias_detection",
          description: "All attacks succeeded — verify controls were actually tested",
          evidence: [],
          remediation: "Review if controls exist but were bypassed or if testing was superficial",
        });
        score -= 20;
      }
    }

    // Check: Severity distribution in MARK results
    if (input.markResults.length > 0) {
      const allFindings = input.markResults.flatMap((m) => m.findings);
      if (allFindings.length > 0) {
        const severities = allFindings.map((f) => f.severity);
        const uniqueSeverities = new Set(severities);

        if (uniqueSeverities.size === 1 && allFindings.length >= 3) {
          findings.push({
            id: `ADM-BD-${Date.now()}-monoseverity`,
            severity: "info",
            category: "bias_detection",
            description: `All ${allFindings.length} findings have same severity (${severities[0]})`,
            evidence: [],
            remediation: "Review if severity classification is appropriate",
          });
          score -= 5;
        }
      }
    }

    return { score: Math.max(0, Math.min(100, score)), findings };
  }

  // ===========================================================================
  // PRIVATE: LLM Phase — Separate Claude API call for governance review
  // ===========================================================================

  /**
   * Evaluate assessment artifacts with Claude for deeper governance analysis.
   * Returns LLM analysis result or null if the API call fails (graceful fallback).
   */
  private async evaluateWithLLM(input: QuartermasterInput): Promise<LLMAnalysisResult | null> {
    try {
      const result = await this.callClaudeAPI(input);
      if (!result || typeof result !== "object") {
        return null;
      }
      return result;
    } catch {
      // Graceful fallback — deterministic-only when LLM fails
      return null;
    }
  }

  /**
   * Call Claude API with the governance review prompt.
   * This is a SEPARATE API call from the Corsair agent to prevent self-validation.
   */
  private async callClaudeAPI(input: QuartermasterInput): Promise<LLMAnalysisResult> {
    const anthropic = new Anthropic({ apiKey: this.config.apiKey });
    const prompt = this.buildGovernancePrompt(input);

    const response = await anthropic.messages.create({
      model: this.config.model!,
      max_tokens: this.config.maxTokens ?? 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in Claude response");
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonText = textBlock.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    return JSON.parse(jsonText) as LLMAnalysisResult;
  }

  /**
   * Build the governance review prompt with all assessment artifact summaries.
   */
  private buildGovernancePrompt(input: QuartermasterInput): string {
    const providers = input.scope.providers.join(", ");

    // MARK summary
    const markCount = input.markResults.flatMap((m) => m.findings).length;
    const markResultCount = input.markResults.length;

    // RAID summary
    const raidCount = input.raidResults.length;
    const successCount = input.raidResults.filter((r) => r.success).length;
    const failedCount = input.raidResults.filter((r) => !r.success).length;

    // Evidence summary
    const evidenceCount = input.evidencePaths.length;
    let totalRecords = 0;
    for (const ePath of input.evidencePaths) {
      if (existsSync(ePath)) {
        const content = readFileSync(ePath, "utf-8").trim();
        if (content) {
          totalRecords += content.split("\n").filter((l) => l.trim()).length;
        }
      }
    }

    // Threat model summary
    const threatSummary = input.threatModel
      ? `STRIDE-automated analysis: ${input.threatModel.threatCount} threats identified across ${input.threatModel.provider}`
      : "No threat model provided";

    // ISC summary
    const iscSummary = input.iscCriteria && input.iscCriteria.length > 0
      ? `${input.iscCriteria.length} ISC criteria defined`
      : "No ISC criteria defined";

    return `You are the Quartermaster — an adversarial governance reviewer for a GRC chaos engineering assessment.

Review the following assessment artifacts and identify issues with:
1. METHODOLOGY: Is the approach systematic? Were appropriate attack vectors tested?
2. COMPLETENESS: Were all in-scope resources tested? Any gaps?
3. BIAS: Are findings balanced? Is severity appropriate? Any cherry-picking?

Assessment Summary:
- Providers tested: ${providers}
- Resources in scope: ${input.scope.resourceCount}
- MARK results: ${markCount} drift findings across ${markResultCount} checks
- RAID results: ${raidCount} attack simulations (${successCount} succeeded, ${failedCount} blocked)
- Evidence files: ${evidenceCount} with ${totalRecords} records
- Threat model: ${threatSummary}
- ISC criteria: ${iscSummary}

Respond in JSON (no markdown, no explanation outside JSON):
{
  "methodology_adjustment": number (-20 to +10),
  "completeness_adjustment": number (-20 to +10),
  "bias_adjustment": number (-20 to +10),
  "findings": [{"severity": "critical"|"warning"|"info", "category": string, "description": string, "remediation": string}],
  "narrative": string (2-3 sentence executive summary)
}`;
  }

  /**
   * Clamp an LLM score adjustment to the allowed range [-20, +10].
   */
  private clampAdjustment(value: number): number {
    return Math.max(-20, Math.min(10, value));
  }

  /**
   * Apply a clamped LLM adjustment to a deterministic score.
   * Result is clamped to [0, 100].
   */
  private applyAdjustment(baseScore: number, adjustment?: number): number {
    if (adjustment === undefined || adjustment === null) {
      return baseScore;
    }
    const clamped = this.clampAdjustment(adjustment);
    return Math.max(0, Math.min(100, baseScore + clamped));
  }

  /**
   * Extract LLM findings for a given dimension category, tagging them with QM-LLM- prefix.
   * Maps category names to dimension names for routing.
   */
  private extractLLMFindings(
    llmResult: LLMAnalysisResult | null,
    dimension: string
  ): QuartermasterFinding[] {
    if (!llmResult?.findings || !Array.isArray(llmResult.findings)) {
      return [];
    }

    // Map LLM category names to dimension names
    const categoryToDimension: Record<string, string> = {
      methodology: "methodology",
      completeness: "completeness",
      bias_detection: "bias_detection",
      bias: "bias_detection",
    };

    return llmResult.findings
      .filter((f) => {
        const mappedDimension = categoryToDimension[f.category] || f.category;
        return mappedDimension === dimension;
      })
      .map((f, i) => ({
        id: `QM-LLM-${dimension}-${Date.now()}-${i}`,
        severity: f.severity,
        category: f.category,
        description: f.description,
        evidence: [],
        remediation: f.remediation,
      }));
  }

  // ===========================================================================
  // PRIVATE: Helpers
  // ===========================================================================

  private verifyHashChain(path: string): { valid: boolean; recordCount: number; brokenAt: number | null } {
    if (!existsSync(path)) {
      return { valid: false, recordCount: 0, brokenAt: null };
    }

    const content = readFileSync(path, "utf-8").trim();
    if (!content) {
      return { valid: true, recordCount: 0, brokenAt: null };
    }

    const lines = content.split("\n").filter((l) => l.trim());
    let previousHash: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const record = JSON.parse(lines[i]);

      if (record.previousHash !== previousHash) {
        return { valid: false, recordCount: lines.length, brokenAt: i + 1 };
      }

      const expectedHash = this.calculateHash({
        sequence: record.sequence,
        timestamp: record.timestamp,
        operation: record.operation,
        data: record.data,
        previousHash: record.previousHash,
      });

      if (record.hash !== expectedHash) {
        return { valid: false, recordCount: lines.length, brokenAt: i + 1 };
      }

      previousHash = record.hash;
    }

    return { valid: true, recordCount: lines.length, brokenAt: null };
  }

  private calculateHash(record: Record<string, unknown>): string {
    return createHash("sha256").update(JSON.stringify(record)).digest("hex");
  }

  private readEvidenceRecords(path: string): Array<{ timestamp: string; data: Record<string, unknown> }> {
    if (!existsSync(path)) return [];
    const content = readFileSync(path, "utf-8").trim();
    if (!content) return [];
    return content
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  }

  private computeCompletenessScore(
    timestampResult: DimensionCheckResult,
    correlationResult: DimensionCheckResult
  ): number {
    return Math.round((timestampResult.score + correlationResult.score) / 2);
  }

  private computeWeightedScore(dimensions: QuartermasterDimensionScore[]): number {
    let weighted = 0;
    for (const dim of dimensions) {
      weighted += dim.score * dim.weight;
    }
    return Math.round(weighted);
  }

  private computeTrustTier(score: number): "self-assessed" | "ai-verified" | "auditor-verified" {
    if (score >= this.trustThresholds.auditorVerified) return "auditor-verified";
    if (score >= this.trustThresholds.aiVerified) return "ai-verified";
    return "self-assessed";
  }

  private buildRationale(dimension: string, result: DimensionCheckResult): string {
    const criticals = result.findings.filter((f) => f.severity === "critical").length;
    const warnings = result.findings.filter((f) => f.severity === "warning").length;

    if (criticals > 0) {
      return `${dimension}: ${criticals} critical issue(s) detected. Score: ${result.score}/100.`;
    }
    if (warnings > 0) {
      return `${dimension}: ${warnings} warning(s) noted. Score: ${result.score}/100.`;
    }
    if (result.score >= 90) {
      return `${dimension}: Excellent — no significant issues. Score: ${result.score}/100.`;
    }
    return `${dimension}: Adequate with minor observations. Score: ${result.score}/100.`;
  }

  private buildExecutiveSummary(
    score: number,
    tier: string,
    counts: { critical: number; warning: number; info: number }
  ): string {
    const tierLabel = tier.replace("-", " ");
    if (counts.critical > 0) {
      return `Assessment achieved ${score}/100 (${tierLabel}). ${counts.critical} critical finding(s) require immediate attention.`;
    }
    if (counts.warning > 0) {
      return `Assessment achieved ${score}/100 (${tierLabel}). ${counts.warning} warning(s) identified for review.`;
    }
    return `Assessment achieved ${score}/100 (${tierLabel}). No significant issues detected.`;
  }
}
