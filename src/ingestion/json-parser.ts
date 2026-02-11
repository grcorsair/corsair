/**
 * JSON Parser — Generic Evidence Ingestion
 *
 * Accepts any JSON payload and normalizes it into IngestedDocument format.
 * Auto-detects Prowler OCSF and SecurityHub ASFF formats from structure.
 * Falls back to a generic { metadata, controls } format.
 *
 * This is the evidence-agnostic ingestion entry point: any tool, scanner,
 * or agent that outputs JSON can feed into the full Corsair pipeline
 * (assurance classification, framework mapping, governance, signing).
 */

import { createHash } from "crypto";
import type {
  IngestedDocument,
  IngestedControl,
  DocumentMetadata,
  DocumentSource,
  FrameworkRef,
  AssessmentContext,
} from "./types";
import type { Severity } from "../types";

// =============================================================================
// PUBLIC API
// =============================================================================

export interface ParseJSONOptions {
  /** Override the detected source type */
  source?: DocumentSource;
}

/**
 * Parse any JSON payload into an IngestedDocument.
 *
 * Accepts:
 *   - A JSON string
 *   - A parsed object with { metadata?, controls[] }
 *   - A Prowler OCSF array (auto-detected)
 *   - A SecurityHub ASFF object with { Findings[] } (auto-detected)
 */
export function parseJSON(
  input: string | object,
  options?: ParseJSONOptions,
): IngestedDocument {
  const parsed = resolveInput(input);
  const rawHash = computeHash(parsed);

  // Auto-detect format
  if (isProwlerOCSF(parsed)) {
    return parseProwler(parsed as ProwlerFinding[], rawHash, options?.source);
  }

  if (isSecurityHubASFF(parsed)) {
    return parseSecurityHub(parsed as SecurityHubOutput, rawHash, options?.source);
  }

  // Generic format: { metadata?, controls[], assessmentContext? }
  return parseGeneric(parsed as GenericInput, rawHash, options?.source);
}

// =============================================================================
// INPUT RESOLUTION
// =============================================================================

function resolveInput(input: string | object): unknown {
  if (input === null || input === undefined) {
    throw new Error("parseJSON: input must be a string or object, got null/undefined");
  }

  if (typeof input === "number" || typeof input === "boolean") {
    throw new Error(`parseJSON: input must be a string or object, got ${typeof input}`);
  }

  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      throw new Error("parseJSON: invalid JSON string");
    }
  }

  return input;
}

function computeHash(parsed: unknown): string {
  const canonical = JSON.stringify(parsed);
  return createHash("sha256").update(canonical).digest("hex");
}

// =============================================================================
// FORMAT DETECTION
// =============================================================================

interface ProwlerFinding {
  StatusCode: string;
  Severity?: string;
  FindingInfo: { Uid: string; Title: string };
  Remediation?: { Recommendation?: string };
  Resources?: Array<{ Uid?: string }>;
  Compliance?: { Requirements?: string[] };
}

interface SecurityHubOutput {
  Findings: SecurityHubFinding[];
}

interface SecurityHubFinding {
  Id: string;
  Title: string;
  Description?: string;
  Severity?: { Label?: string };
  Compliance?: { Status?: string };
  Remediation?: { Recommendation?: { Text?: string } };
  Resources?: Array<{ Type?: string; Id?: string }>;
}

interface GenericInput {
  metadata?: Partial<DocumentMetadata>;
  controls?: GenericControl[];
  assessmentContext?: AssessmentContext;
}

interface GenericControl {
  id?: string;
  description?: string;
  status?: string;
  severity?: string;
  evidence?: string;
  framework?: string;
  controlId?: string;
  controlName?: string;
  frameworks?: Array<{ framework: string; controlId: string; controlName?: string }>;
}

function isProwlerOCSF(parsed: unknown): boolean {
  if (!Array.isArray(parsed) || parsed.length === 0) return false;
  const first = parsed[0];
  return (
    typeof first === "object" &&
    first !== null &&
    "StatusCode" in first &&
    "FindingInfo" in first
  );
}

function isSecurityHubASFF(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return Array.isArray(obj.Findings) && obj.Findings.length > 0;
}

// =============================================================================
// PROWLER OCSF PARSER
// =============================================================================

function parseProwler(
  findings: ProwlerFinding[],
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const controls: IngestedControl[] = findings.map((f) => {
    const frameworkRefs = parseProwlerCompliance(f.Compliance?.Requirements);
    return {
      id: f.FindingInfo.Uid,
      description: f.FindingInfo.Title,
      status: normalizeStatus(f.StatusCode),
      severity: f.Severity ? normalizeSeverity(f.Severity) : undefined,
      evidence: f.Remediation?.Recommendation || "",
      frameworkRefs: frameworkRefs.length > 0 ? frameworkRefs : undefined,
    };
  });

  return {
    source: sourceOverride || "prowler",
    metadata: {
      title: `Prowler Scan — ${findings.length} findings`,
      issuer: "Prowler",
      date: new Date().toISOString().split("T")[0],
      scope: "AWS Environment",
      reportType: "Prowler OCSF",
      rawTextHash: rawHash,
    },
    controls,
  };
}

function parseProwlerCompliance(requirements?: string[]): FrameworkRef[] {
  if (!requirements || requirements.length === 0) return [];

  return requirements.map((req) => {
    // Parse "CIS-1.10" → { framework: "CIS", controlId: "1.10" }
    // Parse "NIST-800-53-AC-2" → { framework: "NIST-800-53", controlId: "AC-2" }
    // Parse "SOC2-CC6.1" → { framework: "SOC2", controlId: "CC6.1" }
    const dashIdx = req.indexOf("-");
    if (dashIdx === -1) {
      return { framework: req, controlId: req };
    }

    // Try known prefixes first
    const knownPrefixes = ["NIST-800-53", "NIST-800-171", "CIS", "SOC2", "ISO27001", "PCI-DSS"];
    for (const prefix of knownPrefixes) {
      if (req.startsWith(prefix + "-")) {
        return {
          framework: prefix,
          controlId: req.slice(prefix.length + 1),
        };
      }
    }

    // Fallback: split on first dash
    return {
      framework: req.slice(0, dashIdx),
      controlId: req.slice(dashIdx + 1),
    };
  });
}

// =============================================================================
// SECURITYHUB ASFF PARSER
// =============================================================================

function parseSecurityHub(
  output: SecurityHubOutput,
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const controls: IngestedControl[] = output.Findings.map((f) => ({
    id: f.Id,
    description: f.Description || f.Title,
    status: normalizeStatus(f.Compliance?.Status || "NOT_AVAILABLE"),
    severity: f.Severity?.Label ? normalizeSeverity(f.Severity.Label) : undefined,
    evidence: f.Remediation?.Recommendation?.Text || "",
  }));

  return {
    source: sourceOverride || "securityhub",
    metadata: {
      title: `SecurityHub — ${output.Findings.length} findings`,
      issuer: "AWS SecurityHub",
      date: new Date().toISOString().split("T")[0],
      scope: "AWS Environment",
      reportType: "SecurityHub ASFF",
      rawTextHash: rawHash,
    },
    controls,
  };
}

// =============================================================================
// GENERIC FORMAT PARSER
// =============================================================================

function parseGeneric(
  input: GenericInput,
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const metadata: DocumentMetadata = {
    title: input.metadata?.title || "JSON Evidence Import",
    issuer: input.metadata?.issuer || "Unknown",
    date: input.metadata?.date || new Date().toISOString().split("T")[0],
    scope: input.metadata?.scope || "Unknown",
    auditor: input.metadata?.auditor,
    reportType: input.metadata?.reportType || "JSON",
    rawTextHash: rawHash,
  };

  const rawControls = input.controls || [];
  let autoIndex = 0;
  const controls: IngestedControl[] = rawControls.map((c) => {
    const frameworkRefs = extractFrameworkRefs(c);
    autoIndex++;
    return {
      id: c.id || `auto-${autoIndex}`,
      description: c.description || `Control ${c.id || autoIndex}`,
      status: normalizeStatus(c.status || "not-tested"),
      severity: c.severity ? normalizeSeverity(c.severity) : undefined,
      evidence: c.evidence,
      frameworkRefs: frameworkRefs.length > 0 ? frameworkRefs : undefined,
    };
  });

  return {
    source: sourceOverride || "json",
    metadata,
    controls,
    assessmentContext: input.assessmentContext,
  };
}

function extractFrameworkRefs(control: GenericControl): FrameworkRef[] {
  const refs: FrameworkRef[] = [];

  // Single framework reference: { framework, controlId }
  if (control.framework && control.controlId) {
    refs.push({
      framework: control.framework,
      controlId: control.controlId,
      controlName: control.controlName,
    });
  }

  // Array of framework references: { frameworks: [{ framework, controlId }] }
  if (Array.isArray(control.frameworks)) {
    for (const f of control.frameworks) {
      refs.push({
        framework: f.framework,
        controlId: f.controlId,
        controlName: f.controlName,
      });
    }
  }

  return refs;
}

// =============================================================================
// NORMALIZATION
// =============================================================================

function normalizeStatus(raw: string): "effective" | "ineffective" | "not-tested" {
  const lower = raw.toLowerCase().trim();
  switch (lower) {
    case "pass":
    case "passed":
    case "effective":
    case "compliant":
    case "success":
      return "effective";

    case "fail":
    case "failed":
    case "ineffective":
    case "non-compliant":
    case "error":
      return "ineffective";

    case "skip":
    case "skipped":
    case "not-tested":
    case "not_tested":
    case "not_available":
    case "info":
    case "informational":
    case "manual":
    case "unknown":
      return "not-tested";

    default:
      return "not-tested";
  }
}

function normalizeSeverity(raw: string): Severity {
  const lower = raw.toLowerCase().trim();
  switch (lower) {
    case "critical":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "medium":
      return "MEDIUM";
    case "low":
      return "LOW";
    case "informational":
    case "info":
      return "LOW";
    default:
      return raw.toUpperCase() as Severity;
  }
}
