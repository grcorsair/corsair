/**
 * JSON Parser — Generic Evidence Ingestion
 *
 * Accepts any JSON payload and normalizes it into IngestedDocument format.
 * Auto-detects tool output formats from JSON structure:
 *   - Prowler OCSF (array with StatusCode + FindingInfo)
 *   - SecurityHub ASFF (object with Findings[])
 *   - InSpec (object with profiles[].controls[])
 *   - Trivy (object with SchemaVersion + Results[])
 * Falls back to a generic { metadata, controls } format.
 *
 * This is the evidence-agnostic ingestion entry point: any tool, scanner,
 * or agent that outputs JSON can feed into the full Corsair pipeline
 * (framework mapping, governance, signing).
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

  /** Force a specific parser format (bypasses auto-detection) */
  format?:
    | "generic"
    | "prowler"
    | "securityhub"
    | "inspec"
    | "trivy"
    | "gitlab"
    | "ciso-assistant-api"
    | "ciso-assistant-export";
}

/**
 * Parse any JSON payload into an IngestedDocument.
 *
 * Accepts:
 *   - A JSON string
 *   - A parsed object with { metadata?, controls[] }
 *   - A Prowler OCSF array (auto-detected)
 *   - A SecurityHub ASFF object with { Findings[] } (auto-detected)
 *   - A GitLab security report with { version, vulnerabilities[], scan } (auto-detected)
 *   - An InSpec report with { profiles[].controls[] } (auto-detected)
 *   - A Trivy report with { SchemaVersion, Results[] } (auto-detected)
 */
export function parseJSON(
  input: string | object,
  options?: ParseJSONOptions,
): IngestedDocument {
  const parsed = resolveInput(input);
  const rawHash = computeHash(parsed);

  // Format override — bypass auto-detection when explicitly set
  if (options?.format) {
    return parseByFormat(parsed, rawHash, options.format, options.source);
  }

  // Auto-detect format (order matters — most specific first)
  if (isCISOAssistantAPI(parsed)) {
    return parseCISOAssistant(
      (parsed as CISOAssistantAPIResponse).results,
      rawHash,
      options?.source,
    );
  }

  if (isCISOAssistantExport(parsed)) {
    return parseCISOAssistant(
      (parsed as CISOAssistantDomainExport).requirement_assessments,
      rawHash,
      options?.source,
    );
  }

  if (isProwlerOCSF(parsed)) {
    return parseProwler(parsed as ProwlerFinding[], rawHash, options?.source);
  }

  if (isGitLabSecurityReport(parsed)) {
    return parseGitLab(parsed as GitLabSecurityReport, rawHash, options?.source);
  }

  if (isInSpec(parsed)) {
    return parseInSpec(parsed as InSpecReport, rawHash, options?.source);
  }

  if (isTrivy(parsed)) {
    return parseTrivy(parsed as TrivyReport, rawHash, options?.source);
  }

  if (isSecurityHubASFF(parsed)) {
    return parseSecurityHub(parsed as SecurityHubOutput, rawHash, options?.source);
  }

  // Generic format: { metadata?, controls[], assessmentContext? }
  return parseGeneric(parsed as GenericInput, rawHash, options?.source);
}

// =============================================================================
// FORMAT OVERRIDE
// =============================================================================

function parseByFormat(
  parsed: unknown,
  rawHash: string,
  format: NonNullable<ParseJSONOptions["format"]>,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  switch (format) {
    case "prowler":
      // Prowler expects an array of findings
      if (!Array.isArray(parsed)) {
        throw new Error(`Format "prowler" expects an array of findings, got ${typeof parsed}`);
      }
      return parseProwler(parsed as ProwlerFinding[], rawHash, sourceOverride);
    case "securityhub":
      return parseSecurityHub(parsed as SecurityHubOutput, rawHash, sourceOverride);
    case "inspec":
      return parseInSpec(parsed as InSpecReport, rawHash, sourceOverride);
    case "trivy":
      return parseTrivy(parsed as TrivyReport, rawHash, sourceOverride);
    case "gitlab":
      return parseGitLab(parsed as GitLabSecurityReport, rawHash, sourceOverride);
    case "ciso-assistant-api":
      return parseCISOAssistant(
        (parsed as CISOAssistantAPIResponse).results,
        rawHash,
        sourceOverride,
      );
    case "ciso-assistant-export":
      return parseCISOAssistant(
        (parsed as CISOAssistantDomainExport).requirement_assessments,
        rawHash,
        sourceOverride,
      );
    case "generic":
    default:
      return parseGeneric(parsed as GenericInput, rawHash, sourceOverride);
  }
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

interface InSpecReport {
  platform?: { name?: string; release?: string };
  profiles: InSpecProfile[];
  statistics?: { duration?: number };
  version?: string;
}

interface InSpecProfile {
  name?: string;
  title?: string;
  controls: InSpecControl[];
}

interface InSpecControl {
  id: string;
  title?: string;
  desc?: string;
  impact?: number;
  tags?: Record<string, unknown>;
  results?: InSpecResult[];
}

interface InSpecResult {
  status: string;
  code_desc?: string;
  run_time?: number;
  message?: string;
}

interface TrivyReport {
  SchemaVersion: number;
  ArtifactName?: string;
  Results: TrivyResult[];
}

interface TrivyResult {
  Target?: string;
  Class?: string;
  Misconfigurations?: TrivyMisconfiguration[];
  Vulnerabilities?: TrivyVulnerability[];
}

interface TrivyMisconfiguration {
  Type?: string;
  ID: string;
  AVDID?: string;
  Title: string;
  Description?: string;
  Severity: string;
  Status: string;
  Resolution?: string;
}

interface TrivyVulnerability {
  VulnerabilityID: string;
  PkgName?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Severity: string;
  Title?: string;
  Description?: string;
}

interface GitLabSecurityReport {
  version: string;
  scan: {
    analyzer?: { id: string; name: string; version?: string; vendor?: { name: string } };
    scanner?: { id: string; name: string; version?: string; vendor?: { name: string } };
    type: string;
    start_time?: string;
    end_time?: string;
    status?: string;
  };
  vulnerabilities: GitLabVulnerability[];
  remediations?: Array<{ fixes: Array<{ id: string }>; summary: string; diff?: string }>;
}

interface GitLabVulnerability {
  id: string;
  category?: string;
  name?: string;
  message?: string;
  description?: string;
  severity?: string;
  confidence?: string;
  scanner?: { id: string; name: string };
  location?: Record<string, unknown>;
  identifiers?: Array<{ type: string; name: string; value: string; url?: string }>;
  solution?: string;
  links?: Array<{ url: string; name?: string }>;
}

// =============================================================================
// CISO ASSISTANT FORMAT TYPES
// =============================================================================

interface CISOAssistantRequirementAssessment {
  id: string;
  requirement: string;  // "urn:intuitem:risk:req_node:soc2-2017:CC1.1"
  compliance_assessment?: string;
  result: string;  // "compliant" | "non_compliant" | "partially_compliant" | "not_assessed" | "not_applicable"
  observation?: string;
  score?: number;
  evidences?: string[];
  applied_controls?: string[];
  folder?: string;
  status?: string;
}

interface CISOAssistantAPIResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CISOAssistantRequirementAssessment[];
}

interface CISOAssistantDomainExport {
  meta: { media_version: string; exported_at?: string };
  requirement_assessments: CISOAssistantRequirementAssessment[];
}

function isGitLabSecurityReport(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj.version === "string" &&
    Array.isArray(obj.vulnerabilities) &&
    typeof obj.scan === "object" &&
    obj.scan !== null &&
    "type" in (obj.scan as Record<string, unknown>)
  );
}

function isInSpec(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    Array.isArray(obj.profiles) &&
    obj.profiles.length > 0 &&
    typeof obj.profiles[0] === "object" &&
    obj.profiles[0] !== null &&
    "controls" in (obj.profiles[0] as Record<string, unknown>)
  );
}

function isTrivy(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj.SchemaVersion === "number" &&
    Array.isArray(obj.Results)
  );
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

/**
 * Detect CISO Assistant API response: DRF paginated envelope
 * Shape: { count: number, next, previous, results: RequirementAssessment[] }
 */
function isCISOAssistantAPI(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj.count === "number" &&
    Array.isArray(obj.results) &&
    obj.results.length > 0 &&
    typeof obj.results[0] === "object" &&
    obj.results[0] !== null &&
    "requirement" in (obj.results[0] as Record<string, unknown>) &&
    "result" in (obj.results[0] as Record<string, unknown>) &&
    typeof (obj.results[0] as Record<string, unknown>).requirement === "string" &&
    ((obj.results[0] as Record<string, unknown>).requirement as string).startsWith("urn:intuitem:")
  );
}

/**
 * Detect CISO Assistant domain export: Django serialized format
 * Shape: { meta: { media_version }, requirement_assessments: [] }
 */
function isCISOAssistantExport(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj.meta === "object" &&
    obj.meta !== null &&
    "media_version" in (obj.meta as Record<string, unknown>) &&
    Array.isArray(obj.requirement_assessments)
  );
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
// GITLAB SECURITY REPORT PARSER
// =============================================================================

function parseGitLab(
  report: GitLabSecurityReport,
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const controls: IngestedControl[] = report.vulnerabilities.map((vuln) => {
    const frameworkRefs = extractGitLabFrameworkRefs(vuln.identifiers);
    const evidence = buildGitLabEvidence(vuln);
    const severity = vuln.severity ? normalizeGitLabSeverity(vuln.severity) : undefined;

    return {
      id: vuln.id,
      description: vuln.name || vuln.message || vuln.id,
      status: "ineffective" as const, // Vulnerabilities are findings = ineffective
      severity,
      evidence,
      frameworkRefs: frameworkRefs.length > 0 ? frameworkRefs : undefined,
    };
  });

  const scanType = report.scan.type;
  const scanTypeDisplay = scanType.toUpperCase().replace(/_/g, " ");
  const scannerName = report.scan.scanner?.name || report.scan.analyzer?.name || "Unknown";

  return {
    source: sourceOverride || "json",
    metadata: {
      title: `GitLab ${scanTypeDisplay} — ${scannerName} (${report.vulnerabilities.length} findings)`,
      issuer: scannerName,
      date: report.scan.end_time
        ? report.scan.end_time.split("T")[0]
        : new Date().toISOString().split("T")[0],
      scope: `GitLab ${scanType} scan`,
      reportType: "GitLab Security Report",
      rawTextHash: rawHash,
    },
    controls,
  };
}

/** Extract CWE/CVE framework refs from GitLab identifiers */
function extractGitLabFrameworkRefs(
  identifiers?: Array<{ type: string; name: string; value: string }>,
): FrameworkRef[] {
  if (!identifiers) return [];
  const refs: FrameworkRef[] = [];

  for (const id of identifiers) {
    const type = id.type.toLowerCase();
    if (type === "cwe") {
      refs.push({ framework: "CWE", controlId: id.value, controlName: id.name });
    } else if (type === "cve") {
      refs.push({ framework: "CVE", controlId: id.value, controlName: id.name });
    } else if (type === "owasp") {
      refs.push({ framework: "OWASP", controlId: id.value, controlName: id.name });
    }
  }

  return refs;
}

/** Build evidence string from GL vulnerability fields */
function buildGitLabEvidence(vuln: GitLabVulnerability): string {
  const parts: string[] = [];
  if (vuln.description) parts.push(vuln.description);
  if (vuln.solution) parts.push(`Solution: ${vuln.solution}`);
  if (vuln.location) {
    const loc = vuln.location;
    if (loc.file) parts.push(`File: ${loc.file}:${loc.start_line || "?"}`);
    if (loc.dependency && typeof loc.dependency === "object") {
      const dep = loc.dependency as Record<string, unknown>;
      const pkg = dep.package as Record<string, unknown> | undefined;
      if (pkg?.name) parts.push(`Package: ${pkg.name}@${dep.version || "?"}`);
    }
  }
  return parts.join(". ") || vuln.name || "";
}

/** Map GitLab severity (Critical/High/Medium/Low/Info/Unknown) to Corsair severity */
function normalizeGitLabSeverity(severity: string): Severity {
  switch (severity) {
    case "Critical": return "CRITICAL";
    case "High": return "HIGH";
    case "Medium": return "MEDIUM";
    case "Low": return "LOW";
    case "Info": return "LOW";
    case "Unknown": return "LOW";
    default: return normalizeSeverity(severity);
  }
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
// INSPEC PARSER
// =============================================================================

function parseInSpec(
  report: InSpecReport,
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const controls: IngestedControl[] = [];

  for (const profile of report.profiles) {
    for (const ctrl of profile.controls) {
      const results = ctrl.results || [];
      const status = resolveInSpecStatus(results);
      const evidence = results.map(r => r.code_desc || r.message || "").filter(Boolean).join("; ");
      const frameworkRefs = extractInSpecFrameworkRefs(ctrl.tags);
      const severity = inspecImpactToSeverity(ctrl.impact);

      controls.push({
        id: ctrl.id,
        description: ctrl.title || ctrl.desc || ctrl.id,
        status,
        severity,
        evidence: evidence || ctrl.desc || "",
        frameworkRefs: frameworkRefs.length > 0 ? frameworkRefs : undefined,
      });
    }
  }

  const profileNames = report.profiles.map(p => p.title || p.name || "unknown").join(", ");

  return {
    source: sourceOverride || "json",
    metadata: {
      title: `InSpec Report — ${profileNames}`,
      issuer: "InSpec",
      date: new Date().toISOString().split("T")[0],
      scope: report.platform?.name || "Unknown Platform",
      reportType: "InSpec",
      rawTextHash: rawHash,
    },
    controls,
  };
}

/** Resolve InSpec control status from results (worst-case wins) */
function resolveInSpecStatus(results: InSpecResult[]): "effective" | "ineffective" | "not-tested" {
  if (results.length === 0) return "not-tested";

  let hasPassed = false;
  for (const r of results) {
    const s = normalizeStatus(r.status);
    if (s === "ineffective") return "ineffective"; // One failure = failed
    if (s === "effective") hasPassed = true;
  }

  return hasPassed ? "effective" : "not-tested";
}

/** Extract NIST framework refs from InSpec tags.nist */
function extractInSpecFrameworkRefs(tags?: Record<string, unknown>): FrameworkRef[] {
  if (!tags) return [];
  const refs: FrameworkRef[] = [];

  // tags.nist = ["IA-2", "AC-3", ...]
  if (Array.isArray(tags.nist)) {
    for (const nistId of tags.nist) {
      if (typeof nistId === "string") {
        refs.push({ framework: "NIST-800-53", controlId: nistId });
      }
    }
  }

  // tags.cis_controls = [{ id: "1.1" }, ...]
  if (Array.isArray(tags.cis_controls)) {
    for (const cis of tags.cis_controls) {
      if (typeof cis === "object" && cis !== null && "id" in cis) {
        refs.push({ framework: "CIS", controlId: String((cis as Record<string, unknown>).id) });
      }
    }
  }

  return refs;
}

/** Map InSpec impact score (0.0-1.0) to severity */
function inspecImpactToSeverity(impact?: number): Severity | undefined {
  if (impact === undefined || impact === null) return undefined;
  if (impact >= 0.9) return "CRITICAL";
  if (impact >= 0.7) return "HIGH";
  if (impact >= 0.4) return "MEDIUM";
  if (impact > 0) return "LOW";
  return "LOW"; // impact 0.0 = informational
}

// =============================================================================
// TRIVY PARSER
// =============================================================================

function parseTrivy(
  report: TrivyReport,
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const controls: IngestedControl[] = [];

  for (const result of report.Results) {
    // Parse misconfigurations
    if (Array.isArray(result.Misconfigurations)) {
      for (const m of result.Misconfigurations) {
        controls.push({
          id: m.ID,
          description: m.Title,
          status: normalizeStatus(m.Status),
          severity: normalizeSeverity(m.Severity),
          evidence: [m.Description, m.Resolution].filter(Boolean).join(". "),
        });
      }
    }

    // Parse vulnerabilities (always ineffective — they are findings)
    if (Array.isArray(result.Vulnerabilities)) {
      for (const v of result.Vulnerabilities) {
        const evidenceParts = [v.Description];
        if (v.PkgName) evidenceParts.push(`Package: ${v.PkgName}`);
        if (v.InstalledVersion) evidenceParts.push(`Installed: ${v.InstalledVersion}`);
        if (v.FixedVersion) evidenceParts.push(`Fixed in: ${v.FixedVersion}`);

        controls.push({
          id: v.VulnerabilityID,
          description: v.Title || v.VulnerabilityID,
          status: "ineffective", // Vulnerabilities are findings = ineffective
          severity: normalizeSeverity(v.Severity),
          evidence: evidenceParts.filter(Boolean).join(". "),
        });
      }
    }
  }

  return {
    source: sourceOverride || "json",
    metadata: {
      title: `Trivy Scan — ${report.ArtifactName || "unknown artifact"}`,
      issuer: "Trivy",
      date: new Date().toISOString().split("T")[0],
      scope: report.ArtifactName || "Unknown",
      reportType: "Trivy",
      rawTextHash: rawHash,
    },
    controls,
  };
}

// =============================================================================
// CISO ASSISTANT PARSER
// =============================================================================

function parseCISOAssistant(
  assessments: CISOAssistantRequirementAssessment[],
  rawHash: string,
  sourceOverride?: DocumentSource,
): IngestedDocument {
  const controls: IngestedControl[] = assessments.map((a) => {
    const { framework, controlId } = parseCISOAssistantURN(a.requirement);
    const frameworkRefs: FrameworkRef[] = framework
      ? [{ framework, controlId }]
      : [];

    // Build evidence from observation + score + evidence/control counts
    const evidenceParts: string[] = [];
    if (a.observation) evidenceParts.push(a.observation);
    if (a.score !== undefined && a.score !== null) evidenceParts.push(`Score: ${a.score}`);
    if (a.evidences && a.evidences.length > 0) {
      evidenceParts.push(`${a.evidences.length} evidence artifact${a.evidences.length > 1 ? "s" : ""}`);
    }
    if (a.applied_controls && a.applied_controls.length > 0) {
      evidenceParts.push(`${a.applied_controls.length} applied control${a.applied_controls.length > 1 ? "s" : ""}`);
    }

    return {
      id: controlId || a.id,
      description: a.observation || `Assessment: ${controlId || a.id}`,
      status: normalizeCISOAssistantResult(a.result),
      evidence: evidenceParts.join(". ") || undefined,
      frameworkRefs: frameworkRefs.length > 0 ? frameworkRefs : undefined,
    };
  });

  return {
    source: sourceOverride || "ciso-assistant",
    metadata: {
      title: `CISO Assistant — ${assessments.length} requirement assessments`,
      issuer: "CISO Assistant",
      date: new Date().toISOString().split("T")[0],
      scope: "CISO Assistant Compliance Assessment",
      reportType: "CISO Assistant",
      rawTextHash: rawHash,
    },
    controls,
  };
}

/**
 * Parse CISO Assistant URN into framework + control ID.
 *
 * Format: urn:intuitem:risk:req_node:<framework-slug>:<control-id>
 * Examples:
 *   urn:intuitem:risk:req_node:soc2-2017:CC1.1 → { SOC2, CC1.1 }
 *   urn:intuitem:risk:req_node:nist-800-53-rev5:AC-2 → { NIST-800-53, AC-2 }
 *   urn:intuitem:risk:req_node:iso-27001-2022:A.5.1 → { ISO27001, A.5.1 }
 */
function parseCISOAssistantURN(urn: string): { framework: string; controlId: string } {
  // Split on colons: urn:intuitem:risk:req_node:<slug>:<controlId>
  const parts = urn.split(":");
  if (parts.length < 6 || parts[0] !== "urn" || parts[1] !== "intuitem") {
    return { framework: "", controlId: urn };
  }

  const slug = parts[4];
  const controlId = parts.slice(5).join(":");  // Rejoin in case controlId has colons

  return {
    framework: mapCISOAssistantFrameworkSlug(slug),
    controlId,
  };
}

/**
 * Map CISO Assistant framework slug to Corsair framework name.
 * Falls through to raw slug for unknown frameworks.
 */
function mapCISOAssistantFrameworkSlug(slug: string): string {
  // Normalize: remove version suffixes and map to canonical names
  const lower = slug.toLowerCase();

  if (lower.startsWith("soc2")) return "SOC2";
  if (lower.startsWith("nist-800-53")) return "NIST-800-53";
  if (lower.startsWith("nist-800-171")) return "NIST-800-171";
  if (lower.startsWith("iso-27001")) return "ISO27001";
  if (lower.startsWith("iso-27002")) return "ISO27002";
  if (lower.startsWith("cis-controls")) return "CIS";
  if (lower.startsWith("pci-dss")) return "PCI-DSS";
  if (lower.startsWith("hipaa")) return "HIPAA";
  if (lower.startsWith("gdpr")) return "GDPR";
  if (lower.startsWith("cmmc")) return "CMMC";
  if (lower.startsWith("fedramp")) return "FedRAMP";

  // Unknown framework — pass through the slug as-is
  return slug;
}

/**
 * Map CISO Assistant result enum to Corsair control status.
 *
 * CISO Assistant uses:
 *   compliant → effective
 *   non_compliant → ineffective
 *   partially_compliant → ineffective (partial = not meeting bar)
 *   not_assessed → not-tested
 *   not_applicable → not-tested
 */
function normalizeCISOAssistantResult(result: string): "effective" | "ineffective" | "not-tested" {
  switch (result) {
    case "compliant":
      return "effective";
    case "non_compliant":
    case "partially_compliant":
      return "ineffective";
    case "not_assessed":
    case "not_applicable":
    default:
      return "not-tested";
  }
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
