/**
 * Audit Engine — Full Compliance Audit Orchestration
 *
 * Barrel exports for the audit engine.
 * Orchestrates: ingest -> normalize -> score -> findings -> summary.
 */

export { runAudit, generateFindings, formatAuditSummary } from "./audit-engine";
export type {
  AuditScope,
  AuditFinding,
  AuditResult,
  AuditConfig,
} from "./types";
