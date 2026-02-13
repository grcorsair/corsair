/**
 * Certification Module -- Continuous Compliance Certification
 *
 * Manages ongoing compliance certifications: scheduling audits,
 * detecting drift, auto-renewing CPOEs, and triggering alerts.
 */

export {
  CertificationEngine,
  type CertificationCheckResult,
} from "./certification-engine";

export type {
  CertificationStatus,
  CertificationPolicy,
  Certification,
  DriftReport,
  CertificationConfig,
} from "./types";
