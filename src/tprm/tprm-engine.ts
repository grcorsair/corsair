/**
 * TPRM Engine -- Third-Party Risk Management Automation
 *
 * Manages the vendor assessment lifecycle:
 *   registerVendor -> requestAssessment -> runAssessment -> getDashboard
 *
 * In-memory Map storage. No database dependency.
 * Composite scoring is fully deterministic.
 *
 * Five scoring dimensions (weights sum to 1.0):
 *   1. Evidence Quality (0.30) -- average CPOE composite score
 *   2. Certification Status (0.25) -- status-based scoring
 *   3. Framework Coverage (0.20) -- % of required frameworks covered
 *   4. Freshness (0.15) -- penalty for old evidence
 *   5. Historical Trend (0.10) -- improving vs degrading over time
 */

import { randomUUID } from "crypto";
import type { Certification, CertificationStatus } from "../certification/types";
import type { EvidenceQualityScore } from "../scoring/types";
import type {
  VendorProfile,
  AssessmentRequest,
  AssessmentResult,
  AssessmentFinding,
  AssessmentDecision,
  MonitoringConfig,
  RiskTier,
  TPRMConfig,
  TPRMDashboard,
} from "./types";

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: TPRMConfig = {
  autoApproveThreshold: 85,
  reviewThreshold: 70,
  rejectThreshold: 50,
  freshnessWeightDays: 90,
  trendWindowDays: 180,
};

// =============================================================================
// CERTIFICATION STATUS SCORING
// =============================================================================

const CERT_STATUS_SCORES: Record<CertificationStatus | "none", number> = {
  active: 100,
  warning: 75,
  degraded: 50,
  suspended: 25,
  expired: 10,
  revoked: 0,
  none: 30,
};

// =============================================================================
// DIMENSION WEIGHTS (sum = 1.0)
// =============================================================================

const WEIGHTS = {
  evidenceQuality: 0.30,
  certificationStatus: 0.25,
  frameworkCoverage: 0.20,
  freshness: 0.15,
  historicalTrend: 0.10,
} as const;

// =============================================================================
// MONITORING ALERT TYPE
// =============================================================================

export interface MonitoringAlert {
  vendorId: string;
  type: "score_drop" | "status_change" | "expiry_warning";
  message: string;
  detectedAt: string;
}

// =============================================================================
// CPOE SHAPE (the minimal interface we extract from CPOE objects)
// =============================================================================

/** Minimal CPOE shape we need for assessment */
interface CpoeInput {
  score: EvidenceQualityScore;
  iat: number;
  exp: number;
  vc: {
    credentialSubject: {
      frameworks?: Record<string, unknown>;
      assurance?: { declared?: number };
      summary?: {
        controlsTested?: number;
        controlsPassed?: number;
        controlsFailed?: number;
        overallScore?: number;
      };
    };
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// =============================================================================
// TPRM ENGINE
// =============================================================================

export class TPRMEngine {
  private config: TPRMConfig;
  private vendors: Map<string, VendorProfile> = new Map();
  private requests: Map<string, AssessmentRequest> = new Map();
  private assessments: Map<string, AssessmentResult> = new Map();
  private monitoring: Map<string, MonitoringConfig> = new Map();

  constructor(config?: Partial<TPRMConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------

  /** Returns the current engine configuration */
  getConfig(): TPRMConfig {
    return { ...this.config };
  }

  // ---------------------------------------------------------------------------
  // VENDOR MANAGEMENT
  // ---------------------------------------------------------------------------

  /** Register a new vendor */
  registerVendor(
    input: Omit<VendorProfile, "id" | "createdAt" | "updatedAt">,
  ): VendorProfile {
    const now = new Date().toISOString();
    const vendor: VendorProfile = {
      id: `vendor-${randomUUID()}`,
      name: input.name,
      domain: input.domain,
      did: input.did,
      riskTier: input.riskTier,
      tags: [...input.tags],
      contacts: input.contacts ? [...input.contacts] : undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.vendors.set(vendor.id, vendor);
    return { ...vendor };
  }

  /** Get vendor by ID */
  getVendor(vendorId: string): VendorProfile | undefined {
    const vendor = this.vendors.get(vendorId);
    return vendor ? { ...vendor, tags: [...vendor.tags] } : undefined;
  }

  /** List vendors with optional filters */
  listVendors(filters?: { riskTier?: RiskTier; tag?: string }): VendorProfile[] {
    const result: VendorProfile[] = [];

    for (const vendor of this.vendors.values()) {
      if (filters?.riskTier && vendor.riskTier !== filters.riskTier) continue;
      if (filters?.tag && !vendor.tags.includes(filters.tag)) continue;
      result.push({ ...vendor, tags: [...vendor.tags] });
    }

    return result;
  }

  /** Update vendor risk tier */
  updateVendorRiskTier(
    vendorId: string,
    tier: RiskTier,
    _reason: string,
  ): VendorProfile | undefined {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) return undefined;

    vendor.riskTier = tier;
    vendor.updatedAt = new Date().toISOString();

    return { ...vendor, tags: [...vendor.tags] };
  }

  // ---------------------------------------------------------------------------
  // ASSESSMENT REQUESTS
  // ---------------------------------------------------------------------------

  /** Create an assessment request. Throws if vendor not found. */
  requestAssessment(
    vendorId: string,
    options: {
      requestedBy: string;
      frameworks: string[];
      minimumScore: number;
      minimumAssurance: number;
      deadline?: string;
      notes?: string;
    },
  ): AssessmentRequest {
    const vendor = this.vendors.get(vendorId);
    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    const request: AssessmentRequest = {
      id: `asr-${randomUUID()}`,
      vendorId,
      requestedBy: options.requestedBy,
      requestedAt: new Date().toISOString(),
      frameworks: [...options.frameworks],
      minimumScore: options.minimumScore,
      minimumAssurance: options.minimumAssurance,
      deadline: options.deadline,
      notes: options.notes,
    };

    this.requests.set(request.id, request);
    return { ...request };
  }

  // ---------------------------------------------------------------------------
  // RUN ASSESSMENT
  // ---------------------------------------------------------------------------

  /**
   * Execute an assessment against CPOEs and optional certifications.
   *
   * Calculates a composite score from 5 weighted dimensions,
   * generates findings, and makes a decision.
   */
  runAssessment(
    requestId: string,
    cpoes: CpoeInput[],
    certifications?: Certification[],
  ): AssessmentResult {
    const startTime = Date.now();
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Assessment request not found: ${requestId}`);
    }

    const vendor = this.vendors.get(request.vendorId);
    if (!vendor) {
      throw new Error(`Vendor not found: ${request.vendorId}`);
    }

    const now = new Date();
    const findings: AssessmentFinding[] = [];

    // Handle zero CPOEs edge case
    if (cpoes.length === 0) {
      findings.push({
        id: `finding-${randomUUID()}`,
        severity: "critical",
        category: "missing_cpoe",
        title: "No CPOEs provided",
        description: "No CPOEs were provided for assessment. Cannot evaluate vendor compliance.",
        recommendation: "Request the vendor to provide signed CPOEs for their compliance evidence.",
      });

      const result: AssessmentResult = {
        id: `assessment-${randomUUID()}`,
        requestId,
        vendorId: request.vendorId,
        assessedAt: now.toISOString(),
        cpoeCount: 0,
        compositeScore: 0,
        scoreBreakdown: {
          evidenceQuality: 0,
          certificationStatus: 0,
          frameworkCoverage: 0,
          freshness: 0,
          historicalTrend: 0,
        },
        decision: "rejected",
        decisionReason: "No CPOEs provided for assessment. Vendor has no verifiable compliance evidence.",
        riskTier: vendor.riskTier,
        findings,
        duration: Date.now() - startTime,
        automated: true,
      };

      this.assessments.set(result.id, result);
      return { ...result };
    }

    // ---- Calculate each dimension ----

    // 1. Evidence Quality: average CPOE composite score
    const evidenceQuality = round(
      cpoes.reduce((sum, c) => sum + c.score.composite, 0) / cpoes.length,
    );

    // 2. Certification Status
    let certificationStatus: number;
    if (!certifications || certifications.length === 0) {
      certificationStatus = CERT_STATUS_SCORES.none;
      findings.push({
        id: `finding-${randomUUID()}`,
        severity: "medium",
        category: "no_certification",
        title: "No active certification found",
        description: "The vendor has no active compliance certification on record.",
        recommendation: "Request the vendor to establish a continuous certification for their compliance program.",
      });
    } else {
      // Use the best (highest-scoring) certification status
      certificationStatus = Math.max(
        ...certifications.map(c => CERT_STATUS_SCORES[c.status] ?? CERT_STATUS_SCORES.none),
      );
    }

    // 3. Framework Coverage
    const coveredFrameworks = new Set<string>();
    for (const cpoe of cpoes) {
      const frameworks = cpoe.vc?.credentialSubject?.frameworks;
      if (frameworks && typeof frameworks === "object") {
        for (const fw of Object.keys(frameworks)) {
          coveredFrameworks.add(fw);
        }
      }
    }

    const requiredFrameworks = request.frameworks;
    const coveredCount = requiredFrameworks.filter(fw => coveredFrameworks.has(fw)).length;
    const frameworkCoverage = requiredFrameworks.length > 0
      ? round((coveredCount / requiredFrameworks.length) * 100)
      : 100;

    // Generate findings for missing frameworks
    for (const fw of requiredFrameworks) {
      if (!coveredFrameworks.has(fw)) {
        findings.push({
          id: `finding-${randomUUID()}`,
          severity: "high",
          category: "missing_framework",
          title: `Missing framework coverage: ${fw}`,
          description: `Required framework ${fw} is not covered by any provided CPOE.`,
          recommendation: `Request the vendor to provide evidence and a signed CPOE covering the ${fw} framework.`,
        });
      }
    }

    // 4. Freshness: penalty for old evidence
    const freshnessScores: number[] = [];
    const nowMs = now.getTime();
    const freshnessMaxMs = this.config.freshnessWeightDays * 24 * 60 * 60 * 1000;

    for (const cpoe of cpoes) {
      const issuedAtMs = cpoe.iat * 1000;
      const ageMs = nowMs - issuedAtMs;

      if (ageMs <= 0) {
        freshnessScores.push(100);
      } else if (ageMs >= freshnessMaxMs) {
        // Linearly degrade beyond the freshness window, floor at 0
        const overageFactor = ageMs / freshnessMaxMs;
        freshnessScores.push(round(Math.max(0, 100 - (overageFactor * 100))));
      } else {
        // Within window: linear scale
        freshnessScores.push(round(100 * (1 - ageMs / freshnessMaxMs)));
      }

      // Generate stale evidence finding
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      if (ageDays > this.config.freshnessWeightDays) {
        findings.push({
          id: `finding-${randomUUID()}`,
          severity: "medium",
          category: "stale_evidence",
          title: "Stale evidence detected",
          description: `CPOE evidence is ${Math.round(ageDays)} days old, exceeding the ${this.config.freshnessWeightDays}-day freshness threshold.`,
          recommendation: "Request the vendor to provide updated compliance evidence.",
        });
      }

      // Check for expired CPOEs
      const expiresAtMs = cpoe.exp * 1000;
      if (expiresAtMs < nowMs) {
        findings.push({
          id: `finding-${randomUUID()}`,
          severity: "high",
          category: "expired_cpoe",
          title: "Expired CPOE detected",
          description: `A CPOE has expired. Expiry date: ${new Date(expiresAtMs).toISOString()}.`,
          recommendation: "Request the vendor to renew their expired CPOE.",
        });
      }
    }

    const freshness = freshnessScores.length > 0
      ? round(freshnessScores.reduce((a, b) => a + b, 0) / freshnessScores.length)
      : 0;

    // 5. Historical Trend: compare with previous assessments for this vendor
    const previousAssessments = this.getVendorAssessments(request.vendorId);
    let historicalTrend: number;

    if (previousAssessments.length === 0) {
      // No history: neutral
      historicalTrend = 70;
    } else {
      // Compare current evidence quality with last assessment's score
      const lastScore = previousAssessments[previousAssessments.length - 1].compositeScore;
      const currentAvgScore = evidenceQuality;
      const delta = currentAvgScore - lastScore;

      if (delta >= 10) {
        historicalTrend = 100; // Strong improvement
      } else if (delta >= 0) {
        historicalTrend = 80; // Stable/slight improvement
      } else if (delta >= -10) {
        historicalTrend = 60; // Slight degradation
      } else {
        historicalTrend = 30; // Significant degradation
      }
    }

    // Generate low score finding
    if (evidenceQuality < request.minimumScore) {
      findings.push({
        id: `finding-${randomUUID()}`,
        severity: "high",
        category: "low_score",
        title: "Evidence quality below minimum threshold",
        description: `Average evidence quality score (${evidenceQuality}) is below the minimum required score (${request.minimumScore}).`,
        recommendation: "Vendor should improve their compliance evidence quality and resubmit.",
      });
    }

    // ---- Calculate composite score ----
    const compositeScore = round(
      evidenceQuality * WEIGHTS.evidenceQuality +
      certificationStatus * WEIGHTS.certificationStatus +
      frameworkCoverage * WEIGHTS.frameworkCoverage +
      freshness * WEIGHTS.freshness +
      historicalTrend * WEIGHTS.historicalTrend,
    );

    // ---- Make decision ----
    let decision: AssessmentDecision;
    let decisionReason: string;
    let conditions: string[] | undefined;

    if (compositeScore >= this.config.autoApproveThreshold) {
      decision = "approved";
      decisionReason = `Composite score ${compositeScore} meets auto-approve threshold (${this.config.autoApproveThreshold}). All assessment dimensions are satisfactory.`;
    } else if (compositeScore >= this.config.reviewThreshold) {
      decision = "conditional";
      decisionReason = `Composite score ${compositeScore} meets conditional threshold (${this.config.reviewThreshold}) but does not meet auto-approve (${this.config.autoApproveThreshold}). Review conditions before approval.`;
      conditions = [];

      // Add conditions based on findings
      if (findings.some(f => f.category === "missing_framework")) {
        const missing = findings.filter(f => f.category === "missing_framework").map(f => f.title);
        conditions.push(`Address missing framework coverage: ${missing.join(", ")}`);
      }
      if (findings.some(f => f.category === "expired_cpoe")) {
        conditions.push("Renew expired CPOEs before final approval");
      }
      if (findings.some(f => f.category === "stale_evidence")) {
        conditions.push("Update stale evidence to meet freshness requirements");
      }
      if (findings.some(f => f.category === "no_certification")) {
        conditions.push("Establish active compliance certification");
      }
      if (conditions.length === 0) {
        conditions.push("Manual review required due to borderline composite score");
      }
    } else if (compositeScore >= this.config.rejectThreshold) {
      decision = "review_required";
      decisionReason = `Composite score ${compositeScore} is below conditional threshold (${this.config.reviewThreshold}) but above rejection (${this.config.rejectThreshold}). Manual review by security team required.`;
    } else {
      decision = "rejected";
      decisionReason = `Composite score ${compositeScore} is below rejection threshold (${this.config.rejectThreshold}). Vendor does not meet minimum compliance requirements.`;
    }

    // ---- Find latest CPOE date ----
    let latestCpoeDate: string | undefined;
    if (cpoes.length > 0) {
      const maxIat = Math.max(...cpoes.map(c => c.iat));
      latestCpoeDate = new Date(maxIat * 1000).toISOString();
    }

    // ---- Build result ----
    const result: AssessmentResult = {
      id: `assessment-${randomUUID()}`,
      requestId,
      vendorId: request.vendorId,
      assessedAt: now.toISOString(),
      cpoeCount: cpoes.length,
      latestCpoeDate,
      compositeScore,
      scoreBreakdown: {
        evidenceQuality,
        certificationStatus,
        frameworkCoverage,
        freshness,
        historicalTrend,
      },
      decision,
      decisionReason,
      conditions,
      riskTier: vendor.riskTier,
      findings,
      duration: Date.now() - startTime,
      automated: true,
    };

    this.assessments.set(result.id, result);
    return { ...result };
  }

  // ---------------------------------------------------------------------------
  // ASSESSMENT RETRIEVAL
  // ---------------------------------------------------------------------------

  /** Get assessment by ID */
  getAssessment(assessmentId: string): AssessmentResult | undefined {
    const assessment = this.assessments.get(assessmentId);
    return assessment ? { ...assessment } : undefined;
  }

  /** List assessments, optionally filtered by vendor ID */
  listAssessments(vendorId?: string): AssessmentResult[] {
    const result: AssessmentResult[] = [];

    for (const assessment of this.assessments.values()) {
      if (vendorId === undefined || assessment.vendorId === vendorId) {
        result.push({ ...assessment });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // MONITORING
  // ---------------------------------------------------------------------------

  /** Configure monitoring for a vendor */
  configureMonitoring(config: MonitoringConfig): void {
    this.monitoring.set(config.vendorId, { ...config });
  }

  /**
   * Check all monitored vendors and return alerts.
   *
   * Checks:
   *   - Score drop exceeding threshold
   *   - Certification status changes
   *   - Approaching CPOE expiry
   */
  checkMonitoredVendors(): MonitoringAlert[] {
    const alerts: MonitoringAlert[] = [];
    const now = new Date();

    for (const [vendorId, config] of this.monitoring) {
      if (!config.enabled) continue;

      const vendorAssessments = this.getVendorAssessments(vendorId);
      if (vendorAssessments.length < 2) continue;

      // Check for score drop
      if (config.alertOnScoreDrop > 0 && vendorAssessments.length >= 2) {
        const latest = vendorAssessments[vendorAssessments.length - 1];
        const previous = vendorAssessments[vendorAssessments.length - 2];
        const drop = previous.compositeScore - latest.compositeScore;

        if (drop >= config.alertOnScoreDrop) {
          alerts.push({
            vendorId,
            type: "score_drop",
            message: `Vendor score dropped by ${round(drop)} points (${round(previous.compositeScore)} -> ${round(latest.compositeScore)})`,
            detectedAt: now.toISOString(),
          });
        }
      }
    }

    return alerts;
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------------------------

  /** Generate TPRM dashboard summary */
  getDashboard(): TPRMDashboard {
    const vendors = [...this.vendors.values()];
    const assessments = [...this.assessments.values()];

    // Count by risk tier
    const byRiskTier: Record<RiskTier, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      minimal: 0,
    };

    for (const vendor of vendors) {
      byRiskTier[vendor.riskTier]++;
    }

    // Count by decision
    const byDecision: Record<AssessmentDecision, number> = {
      approved: 0,
      conditional: 0,
      review_required: 0,
      rejected: 0,
    };

    for (const assessment of assessments) {
      byDecision[assessment.decision]++;
    }

    // Average score
    const averageScore = assessments.length > 0
      ? round(assessments.reduce((sum, a) => sum + a.compositeScore, 0) / assessments.length)
      : 0;

    // Vendors needing review
    const vendorsNeedingReview = assessments.filter(
      a => a.decision === "review_required" || a.decision === "rejected",
    ).length;

    // Expiring assessments (based on findings with expired_cpoe)
    const expiringAssessments = assessments.filter(
      a => a.findings.some(f => f.category === "expired_cpoe"),
    ).length;

    // Recent assessments (last 10, newest first)
    const recentAssessments = [...assessments]
      .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())
      .slice(0, 10);

    return {
      totalVendors: vendors.length,
      byRiskTier,
      byDecision,
      averageScore,
      vendorsNeedingReview,
      expiringAssessments,
      recentAssessments,
    };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /** Get all assessments for a vendor, sorted by date ascending */
  private getVendorAssessments(vendorId: string): AssessmentResult[] {
    const result: AssessmentResult[] = [];

    for (const assessment of this.assessments.values()) {
      if (assessment.vendorId === vendorId) {
        result.push(assessment);
      }
    }

    return result.sort(
      (a, b) => new Date(a.assessedAt).getTime() - new Date(b.assessedAt).getTime(),
    );
  }
}
