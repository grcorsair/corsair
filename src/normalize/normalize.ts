/**
 * Normalization Engine — Layer 2 Intelligence Foundation
 *
 * Transforms any IngestedDocument (8 parser formats) into canonical
 * CanonicalControlEvidence format for the scoring engine.
 *
 * Design: deterministic, zero dependencies, zero AI.
 * Maps status, severity, framework refs, evidence type, and provenance.
 */

import { createHash } from "crypto";
import type {
  IngestedDocument,
  IngestedControl,
  DocumentSource,
  AssuranceLevel,
} from "../ingestion/types";
import type {
  CanonicalControlEvidence,
  CanonicalStatus,
  CanonicalSeverity,
  EvidenceType,
  ProvenanceSource,
  NormalizedEvidence,
  NormalizedMetadata,
} from "./types";

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Normalize an IngestedDocument into canonical format.
 *
 * This is the single entry point for the normalization engine.
 * It handles all 8 parser output formats uniformly.
 */
export function normalizeDocument(doc: IngestedDocument): NormalizedEvidence {
  const controls = doc.controls.map((ctrl) =>
    normalizeControl(ctrl, doc),
  );

  const metadata = buildMetadata(doc, controls);

  return { controls, metadata };
}

// =============================================================================
// CONTROL NORMALIZATION
// =============================================================================

function normalizeControl(
  ctrl: IngestedControl,
  doc: IngestedDocument,
): CanonicalControlEvidence {
  const status = mapStatus(ctrl.status);
  const severity = mapSeverity(ctrl.severity);
  const frameworks = deduplicateFrameworks(ctrl.frameworkRefs || []);
  const evidenceType = inferEvidenceType(doc.source, doc.toolAssuranceLevel);
  const provenance = inferProvenance(doc.source, doc.toolAssuranceLevel);
  const tool = inferToolName(doc.source, doc.metadata.issuer);

  return {
    controlId: ctrl.id,
    title: ctrl.description,
    description: ctrl.evidence || ctrl.description,
    status,
    severity,
    source: {
      tool,
      rawId: ctrl.id,
      rawStatus: ctrl.status,
      timestamp: doc.metadata.date,
    },
    frameworks,
    evidence: {
      type: evidenceType,
      summary: ctrl.evidence || ctrl.description,
      hash: ctrl.evidence
        ? createHash("sha256").update(ctrl.evidence).digest("hex")
        : undefined,
    },
    assurance: {
      level: ctrl.assuranceLevel ?? doc.toolAssuranceLevel,
      provenance,
    },
  };
}

// =============================================================================
// STATUS MAPPING
// =============================================================================

/**
 * Map IngestedControl status to canonical status.
 *
 * effective   → pass
 * ineffective → fail
 * not-tested  → skip
 */
function mapStatus(status: IngestedControl["status"]): CanonicalStatus {
  switch (status) {
    case "effective":
      return "pass";
    case "ineffective":
      return "fail";
    case "not-tested":
      return "skip";
    default:
      return "skip";
  }
}

// =============================================================================
// SEVERITY MAPPING
// =============================================================================

/**
 * Map tool-specific severity (uppercase Severity type) to canonical severity (lowercase).
 *
 * CRITICAL → critical
 * HIGH     → high
 * MEDIUM   → medium
 * LOW      → low
 * undefined → info
 */
function mapSeverity(severity: IngestedControl["severity"]): CanonicalSeverity {
  if (!severity) return "info";

  switch (severity) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "low";
    default:
      return "info";
  }
}

// =============================================================================
// FRAMEWORK DEDUPLICATION
// =============================================================================

/**
 * Deduplicate framework references by framework+controlId composite key.
 */
function deduplicateFrameworks(
  refs: Array<{ framework: string; controlId: string; controlName?: string }>,
): Array<{ framework: string; controlId: string; controlName?: string }> {
  const seen = new Set<string>();
  const result: Array<{ framework: string; controlId: string; controlName?: string }> = [];

  for (const ref of refs) {
    const key = `${ref.framework}:${ref.controlId}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        framework: ref.framework,
        controlId: ref.controlId,
        controlName: ref.controlName,
      });
    }
  }

  return result;
}

// =============================================================================
// EVIDENCE TYPE INFERENCE
// =============================================================================

/**
 * Infer evidence type from document source and assurance level.
 *
 * Mapping:
 *   prowler/securityhub → scan (automated config scanning)
 *   inspec              → scan (compliance-as-code scanning)
 *   trivy               → scan (vulnerability scanning)
 *   gitlab              → scan (SAST scanning)
 *   ciso-assistant L2+  → attestation (assessed with evidence)
 *   ciso-assistant L1   → scan (configured check)
 *   soc2/iso27001       → attestation (auditor report)
 *   pentest             → test (penetration testing)
 *   manual/json L0      → document (self-assessed)
 *   json L1+            → config (tool-generated)
 */
function inferEvidenceType(source: DocumentSource, assuranceLevel: AssuranceLevel): EvidenceType {
  switch (source) {
    case "prowler":
    case "securityhub":
      return "scan";
    case "ciso-assistant":
      return assuranceLevel >= 2 ? "attestation" : "scan";
    case "soc2":
    case "iso27001":
      return "attestation";
    case "pentest":
      return "test";
    case "manual":
      return "document";
    case "json":
      return assuranceLevel >= 1 ? "config" : "document";
    default:
      return "document";
  }
}

// =============================================================================
// PROVENANCE INFERENCE
// =============================================================================

/**
 * Infer provenance from document source and assurance level.
 *
 * L0 / manual / generic json → self (organization self-reports)
 * L1+ tool sources           → tool (automated scanning tools)
 * soc2 / iso27001            → auditor (independent third party)
 */
function inferProvenance(source: DocumentSource, assuranceLevel: AssuranceLevel): ProvenanceSource {
  // Auditor sources
  if (source === "soc2" || source === "iso27001") return "auditor";

  // Self-assessed
  if (assuranceLevel === 0) return "self";
  if (source === "manual") return "self";

  // Everything else is tool
  return "tool";
}

// =============================================================================
// TOOL NAME INFERENCE
// =============================================================================

/**
 * Infer a canonical tool name from document source and issuer.
 */
function inferToolName(source: DocumentSource, issuer: string): string {
  switch (source) {
    case "prowler":
      return "prowler";
    case "securityhub":
      return "securityhub";
    case "ciso-assistant":
      return "ciso-assistant";
    case "soc2":
      return "soc2";
    case "iso27001":
      return "iso27001";
    case "pentest":
      return "pentest";
    case "manual":
      return "manual";
    case "json": {
      // Try to infer from issuer
      const lower = issuer.toLowerCase();
      if (lower.includes("inspec")) return "inspec";
      if (lower.includes("trivy")) return "trivy";
      if (lower.includes("prowler")) return "prowler";
      if (lower.includes("gitlab") || lower.includes("semgrep")) return "gitlab";
      return "generic";
    }
    default:
      return "generic";
  }
}

// =============================================================================
// METADATA BUILDER
// =============================================================================

function buildMetadata(
  doc: IngestedDocument,
  controls: CanonicalControlEvidence[],
): NormalizedMetadata {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let errors = 0;

  for (const ctrl of controls) {
    switch (ctrl.status) {
      case "pass":
        passed++;
        break;
      case "fail":
        failed++;
        break;
      case "skip":
        skipped++;
        break;
      case "error":
        errors++;
        break;
    }
  }

  return {
    sourceFormat: inferSourceFormat(doc),
    title: doc.metadata.title,
    issuer: doc.metadata.issuer,
    date: doc.metadata.date,
    scope: doc.metadata.scope,
    documentHash: doc.metadata.rawTextHash,
    toolAssuranceLevel: doc.toolAssuranceLevel,
    stats: {
      total: controls.length,
      passed,
      failed,
      skipped,
      errors,
    },
  };
}

/**
 * Infer a canonical source format name from the document.
 */
function inferSourceFormat(doc: IngestedDocument): string {
  // Use document source directly for known types
  if (doc.source === "prowler") return "prowler";
  if (doc.source === "securityhub") return "securityhub";
  if (doc.source === "ciso-assistant") return "ciso-assistant";
  if (doc.source === "soc2") return "soc2";
  if (doc.source === "iso27001") return "iso27001";
  if (doc.source === "pentest") return "pentest";
  if (doc.source === "manual") return "manual";

  // For "json" source, infer from metadata
  const reportType = doc.metadata.reportType?.toLowerCase() || "";
  if (reportType.includes("inspec")) return "inspec";
  if (reportType.includes("trivy")) return "trivy";
  if (reportType.includes("gitlab")) return "gitlab";
  if (reportType.includes("prowler")) return "prowler";
  if (reportType.includes("securityhub")) return "securityhub";

  return "generic";
}
