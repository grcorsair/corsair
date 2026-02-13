/**
 * TPRM Module -- Third-Party Risk Management Automation
 *
 * Automated vendor assessment using CPOEs. Register vendors,
 * request assessments, calculate composite risk scores,
 * and make automated approve/conditional/reject decisions.
 */

export { TPRMEngine } from "./tprm-engine";
export type { MonitoringAlert } from "./tprm-engine";

export type {
  RiskTier,
  AssessmentDecision,
  VendorProfile,
  AssessmentRequest,
  AssessmentResult,
  AssessmentFinding,
  MonitoringConfig,
  TPRMDashboard,
  TPRMConfig,
} from "./types";
