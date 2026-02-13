/**
 * Sign Core — Shared Sign Engine
 *
 * Every surface (CLI, API, Playground, Web UI, MCP) calls signEvidence().
 * This ensures identical CPOEs regardless of input method.
 *
 * Pipeline: parseJSON → mapToMarqueInput → ReceiptChain → generateVCJWT
 */

import { readFileSync } from "fs";
import type { IngestedDocument } from "../ingestion/types";
import type { MarqueGeneratorInput } from "../parley/marque-generator";
import type { KeyManager } from "../parley/marque-key-manager";

// =============================================================================
// TYPES
// =============================================================================

/** Supported evidence format identifiers */
export type EvidenceFormat =
  | "generic"
  | "prowler"
  | "securityhub"
  | "inspec"
  | "trivy"
  | "gitlab"
  | "ciso-assistant-api"
  | "ciso-assistant-export";

export interface SignInput {
  /** Raw JSON string or parsed object */
  evidence: string | object;

  /** Force a specific format (bypasses auto-detection) */
  format?: EvidenceFormat;

  /** Issuer DID (e.g., "did:web:acme.com") */
  did?: string;

  /** Override scope string */
  scope?: string;

  /** CPOE validity in days (default: 7) */
  expiryDays?: number;

  /** Parse + classify but don't sign. Returns would-be credentialSubject */
  dryRun?: boolean;
}

export interface SignOutput {
  /** Signed JWT-VC string (empty string if dryRun) */
  jwt: string;

  /** CPOE identifier (marque-UUID) */
  marqueId: string;

  /** Detected or forced evidence format */
  detectedFormat: string;

  /** Assessment summary */
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
    severityDistribution?: Record<string, number>;
  };

  /** Evidence provenance */
  provenance: {
    source: string;
    sourceIdentity?: string;
    sourceDate?: string;
  };

  /** Warnings generated during signing */
  warnings: string[];

  /** The parsed document (for dry-run inspection) */
  document: IngestedDocument;

  /** Would-be credentialSubject (always present, useful for dry-run) */
  credentialSubject?: Record<string, unknown>;
}

// =============================================================================
// SIGN ENGINE
// =============================================================================

/**
 * Sign evidence as a CPOE (JWT-VC).
 *
 * This is THE core function. Every surface calls this.
 */
export async function signEvidence(
  input: SignInput,
  keyManager: KeyManager,
): Promise<SignOutput> {
  const warnings: string[] = [];

  // 1. Parse evidence JSON
  const { parseJSON } = await import("../ingestion/json-parser");
  const doc = parseJSON(input.evidence, {
    source: undefined,
    format: input.format,
  });

  // Detect format name for output
  const detectedFormat = detectFormatName(doc, input.format);

  // Apply scope override
  if (input.scope) {
    doc.metadata.scope = input.scope;
  }

  // Warn on zero controls
  if (doc.controls.length === 0) {
    warnings.push("No controls found in evidence. CPOE will have empty summary.");
  }

  // Compute severity distribution
  const severityDistribution = computeSeverityDistribution(doc);

  // 2. Map to MarqueGeneratorInput
  const { mapToMarqueInput } = await import("../ingestion/mapper");
  const marqueInput = mapToMarqueInput(doc, { did: input.did });

  // 3. Build process receipt chain
  const { ReceiptChain } = await import("../parley/receipt-chain");
  const keypair = await keyManager.loadKeypair();
  if (!keypair) {
    throw new SignError("No keypair found. Generate keys with: corsair keygen");
  }

  const version = getVersion();
  const chain = new ReceiptChain(keypair.privateKey.toString());

  // Receipt 0: EVIDENCE (captures tool/platform provenance)
  await chain.captureStep({
    step: "evidence",
    inputData: { source: doc.source, fileHash: doc.metadata.rawTextHash },
    outputData: { controlCount: doc.controls.length },
    reproducible: doc.source !== "manual",
    codeVersion: `corsair-sign@${version}`,
    toolAttestation: {
      toolName: doc.source,
      toolVersion: "unknown",
      scanTimestamp: doc.metadata.date,
      scanTarget: doc.metadata.scope,
      outputFormat: doc.source,
    },
  });

  // Receipt 1: CLASSIFY (deterministic)
  await chain.captureStep({
    step: "classify",
    inputData: { controlCount: doc.controls.length, source: doc.source },
    outputData: { assurance: "calculated" },
    reproducible: true,
    codeVersion: "assurance-calculator@2026-02-09",
  });

  // Receipt 2: CHART (deterministic)
  await chain.captureStep({
    step: "chart",
    inputData: doc.controls.map((c) => c.frameworkRefs),
    outputData: marqueInput.chartResults,
    reproducible: true,
    codeVersion: "chart-engine@1.0",
  });

  marqueInput.processReceipts = chain.getReceipts();

  // Build summary from the marque input
  const summary = buildSummary(marqueInput, severityDistribution);

  // Build provenance
  const provenance = {
    source: doc.source,
    sourceIdentity: doc.metadata.issuer,
    sourceDate: doc.metadata.date,
  };

  // Generate marqueId
  const crypto = await import("crypto");
  const marqueId = `marque-${crypto.randomUUID()}`;

  // 4. Dry-run: skip signing, return would-be subject
  if (input.dryRun) {
    return {
      jwt: "",
      marqueId,
      detectedFormat,
      summary,
      provenance,
      warnings,
      document: doc,
    };
  }

  // 5. Generate JWT-VC
  const { generateVCJWT } = await import("../parley/vc-generator");
  const jwt = await generateVCJWT(marqueInput, keyManager as any, {
    expiryDays: input.expiryDays ?? 7,
  });

  // Decode the JWT to extract credentialSubject
  let credentialSubject: Record<string, unknown> | undefined;
  try {
    const parts = jwt.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    credentialSubject = payload.vc?.credentialSubject;
  } catch {
    // Non-critical — credentialSubject is optional in output
  }

  return {
    jwt,
    marqueId,
    detectedFormat,
    summary,
    provenance,
    warnings,
    document: doc,
    credentialSubject,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/** Detect human-friendly format name */
function detectFormatName(doc: IngestedDocument, forced?: EvidenceFormat): string {
  if (forced) return forced;

  const source = doc.source;
  const reportType = doc.metadata.reportType || "";

  if (source === "prowler" || reportType === "Prowler OCSF") return "prowler";
  if (source === "securityhub" || reportType === "SecurityHub ASFF") return "securityhub";
  if (reportType === "InSpec") return "inspec";
  if (reportType === "Trivy") return "trivy";
  if (reportType.startsWith("GitLab")) return "gitlab";
  if (source === "ciso-assistant" || reportType === "CISO Assistant") return "ciso-assistant";
  return "generic";
}

/** Compute severity distribution from controls */
function computeSeverityDistribution(doc: IngestedDocument): Record<string, number> | undefined {
  const dist: Record<string, number> = {};
  let hasSeverity = false;

  for (const ctrl of doc.controls) {
    if (ctrl.severity) {
      hasSeverity = true;
      dist[ctrl.severity] = (dist[ctrl.severity] || 0) + 1;
    }
  }

  return hasSeverity ? dist : undefined;
}

/** Build summary from document controls (source of truth) */
function buildSummary(
  input: MarqueGeneratorInput,
  severityDistribution?: Record<string, number>,
): SignOutput["summary"] {
  let totalTested = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  // Always count from document controls — they're the source of truth
  if (input.document) {
    for (const ctrl of input.document.controls) {
      totalTested++;
      if (ctrl.status === "effective") totalPassed++;
      else if (ctrl.status === "ineffective") totalFailed++;
      // "not-tested" counts as tested but neither passed nor failed
    }
  }

  const overallScore = totalTested > 0 ? Math.round((totalPassed / totalTested) * 100) : 0;

  return {
    controlsTested: totalTested,
    controlsPassed: totalPassed,
    controlsFailed: totalFailed,
    overallScore,
    ...(severityDistribution ? { severityDistribution } : {}),
  };
}

/** Get version from package.json */
function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
    return pkg.version || "0.5.0";
  } catch {
    return "0.5.0";
  }
}

// =============================================================================
// ERROR TYPE
// =============================================================================

export class SignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignError";
  }
}
