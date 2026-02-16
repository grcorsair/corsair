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
import type { KeyManager } from "../parley/marque-key-manager";
import { deriveProvenance } from "../ingestion/assurance-calculator";
import { computeSummaryFromControls, computeSeverityDistribution } from "../ingestion/summary";

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

  /** CPOE validity in days (default: 90) */
  expiryDays?: number;

  /** Parse + classify but don't sign. Returns would-be credentialSubject */
  dryRun?: boolean;

  /** Enable SD-JWT selective disclosure */
  sdJwt?: boolean;

  /** Fields in credentialSubject to make disclosable (default: summary, frameworks) */
  sdFields?: string[];
}

export interface SignDocumentInput {
  /** Pre-parsed document (ingestion pipeline output) */
  document: IngestedDocument;

  /** Optional format hint (used for reporting) */
  format?: EvidenceFormat;

  /** Issuer DID (e.g., "did:web:acme.com") */
  did?: string;

  /** Override scope string */
  scope?: string;

  /** CPOE validity in days (default: 90) */
  expiryDays?: number;

  /** Parse + classify but don't sign. Returns would-be credentialSubject */
  dryRun?: boolean;

  /** Enable SD-JWT selective disclosure */
  sdJwt?: boolean;

  /** Fields in credentialSubject to make disclosable (default: summary, frameworks) */
  sdFields?: string[];
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

  /** SD-JWT disclosures (only present when sdJwt=true) */
  disclosures?: Array<{ claim: string; disclosure: string; digest: string }>;
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

  return signDocument(
    {
      document: doc,
      format: input.format,
      did: input.did,
      scope: input.scope,
      expiryDays: input.expiryDays,
      dryRun: input.dryRun,
      sdJwt: input.sdJwt,
      sdFields: input.sdFields,
    },
    keyManager,
  );
}

export async function signDocument(
  input: SignDocumentInput,
  keyManager: KeyManager,
): Promise<SignOutput> {
  const warnings: string[] = [];
  const doc = input.document;

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

  // Compute summary + severity distribution
  const baseSummary = computeSummaryFromControls(doc.controls);
  const severityDistribution = computeSeverityDistribution(doc.controls);
  const summary = {
    ...baseSummary,
    ...(severityDistribution ? { severityDistribution } : {}),
  };

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

  // Build provenance
  const prov = deriveProvenance(doc.source, doc.metadata);
  const provenance = {
    source: prov.source,
    sourceIdentity: prov.sourceIdentity,
    sourceDate: prov.sourceDate,
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
    expiryDays: input.expiryDays ?? 90,
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

  // 6. SD-JWT selective disclosure (optional)
  if (input.sdJwt) {
    const parts = jwt.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    // Default disclosable fields if not specified
    const disclosableFields = input.sdFields ?? ["summary", "frameworks"];

    const { createSDJWT } = await import("../parley/sd-jwt");
    const loadedKeypair = await keyManager.loadKeypair();
    const sdResult = await createSDJWT(payload, disclosableFields, {
      privateKeyPem: loadedKeypair!.privateKey.toString(),
      issuerDid: payload.iss,
    });

    return {
      jwt: sdResult.sdJwt,
      marqueId,
      detectedFormat,
      summary,
      provenance,
      warnings,
      document: doc,
      credentialSubject,
      disclosures: sdResult.disclosures,
    };
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
  if (source === "ciso-assistant" || reportType === "CISO Assistant") return "ciso-assistant-api";
  return "generic";
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
