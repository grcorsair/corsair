/**
 * TPRM Types -- Third-Party Risk Management Automation
 *
 * Automated vendor assessment using CPOEs. The endgame feature:
 * register vendors, request assessments, calculate composite risk
 * scores from CPOE evidence, and make automated decisions.
 *
 * Consumes:
 *   - EvidenceQualityScore from scoring engine
 *   - Certification, CertificationStatus from certification engine
 */

import type { EvidenceQualityScore } from "../scoring/types";
import type { Certification, CertificationStatus } from "../certification/types";

// =============================================================================
// VENDOR CLASSIFICATION
// =============================================================================

/** Vendor risk tier */
export type RiskTier = "critical" | "high" | "medium" | "low" | "minimal";

/** Assessment decision */
export type AssessmentDecision = "approved" | "conditional" | "review_required" | "rejected";

// =============================================================================
// VENDOR PROFILE
// =============================================================================

/** Vendor profile */
export interface VendorProfile {
  id: string;
  name: string;
  domain: string;                    // did:web domain
  did: string;                       // Full DID
  riskTier: RiskTier;
  tags: string[];                    // ["cloud", "data-processor", "subprocessor"]
  contacts?: { name: string; email: string; role: string }[];
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// ASSESSMENT REQUEST
// =============================================================================

/** TPRM assessment request */
export interface AssessmentRequest {
  id: string;
  vendorId: string;
  requestedBy: string;
  requestedAt: string;
  frameworks: string[];              // Required frameworks
  minimumScore: number;              // Minimum acceptable score
  minimumAssurance: number;          // Minimum assurance level (0-4)
  deadline?: string;                 // Assessment deadline
  notes?: string;
}

// =============================================================================
// ASSESSMENT RESULT
// =============================================================================

/** TPRM assessment result */
export interface AssessmentResult {
  id: string;
  requestId: string;
  vendorId: string;
  assessedAt: string;

  // CPOE-based evidence
  cpoeCount: number;
  latestCpoeDate?: string;

  // Scoring
  compositeScore: number;            // 0-100 weighted score
  scoreBreakdown: {
    evidenceQuality: number;         // From scoring engine
    certificationStatus: number;     // From certification engine
    frameworkCoverage: number;       // % of required frameworks covered
    freshness: number;               // How recent is the evidence
    historicalTrend: number;         // Improving or degrading over time
  };

  // Decision
  decision: AssessmentDecision;
  decisionReason: string;
  conditions?: string[];             // For "conditional" decisions

  // Risk
  riskTier: RiskTier;
  findings: AssessmentFinding[];

  // Metadata
  duration: number;
  automated: boolean;
}

// =============================================================================
// ASSESSMENT FINDING
// =============================================================================

/** Assessment finding */
export interface AssessmentFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "missing_cpoe" | "expired_cpoe" | "low_score" | "missing_framework" | "drift_detected" | "no_certification" | "stale_evidence";
  title: string;
  description: string;
  recommendation: string;
}

// =============================================================================
// MONITORING
// =============================================================================

/** Vendor monitoring configuration */
export interface MonitoringConfig {
  vendorId: string;
  enabled: boolean;
  checkIntervalDays: number;         // Default 7
  alertOnScoreDrop: number;          // Alert if score drops by N points
  alertOnStatusChange: boolean;      // Alert on certification status change
  alertOnExpiry: boolean;            // Alert N days before CPOE expires
  expiryWarningDays: number;         // Default 30
}

// =============================================================================
// DASHBOARD
// =============================================================================

/** TPRM dashboard summary */
export interface TPRMDashboard {
  totalVendors: number;
  byRiskTier: Record<RiskTier, number>;
  byDecision: Record<AssessmentDecision, number>;
  averageScore: number;
  vendorsNeedingReview: number;
  expiringAssessments: number;
  recentAssessments: AssessmentResult[];
}

// =============================================================================
// ENGINE CONFIG
// =============================================================================

/** TPRM engine config */
export interface TPRMConfig {
  autoApproveThreshold: number;      // Score above this = auto-approve (default 85)
  reviewThreshold: number;           // Score above this = conditional (default 70)
  rejectThreshold: number;           // Score below this = reject (default 50)
  freshnessWeightDays: number;       // Evidence older than this gets freshness penalty (default 90)
  trendWindowDays: number;           // Look back this many days for trend (default 180)
}
