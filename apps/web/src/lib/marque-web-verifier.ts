/**
 * Marque Verifier — Client-side Ed25519 verification via Web Crypto API.
 * Supports JWT-VC (standard) and JSON envelope formats.
 *
 * Primary flow: decode JWT client-side, verify via API.
 * Fallback: full client-side verification with user-provided PEM key.
 */

import type { APIVerifyResponse } from "./corsair-api";

export type MarqueFormat = "json" | "jwt";

/** Issuer trust tier for display */
export type IssuerTier = "corsair-verified" | "self-signed" | "unverifiable" | "invalid";

export interface MarqueVerificationResult {
  valid: boolean;
  reason: string;
  format?: MarqueFormat;
  /** Issuer trust tier (how trustworthy is the signer) */
  issuerTier?: IssuerTier;
  /** Evidence provenance */
  provenance?: {
    source: "self" | "tool" | "auditor";
    sourceIdentity?: string;
    sourceDate?: string;
  };
  /** CPOE scope (human-readable string) */
  scope?: string;
  /** Assessment summary */
  summary?: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
  /** Legacy document format (JSON envelope) */
  document?: {
    id: string;
    version: string;
    issuer: { name: string; organization?: string };
    generatedAt: string;
    expiresAt: string;
    scope: {
      providers: string[];
      frameworksCovered: string[];
      servicesAssessed: string[];
    };
    summary: {
      controlsTested: number;
      controlsPassed: number;
      controlsFailed: number;
      overallScore: number;
    };
    evidenceChain: {
      chainType: string;
      algorithm: string;
      canonicalization: string;
      recordCount: number;
      chainVerified: boolean;
      chainDigest: string;
      chainStartHash?: string;
      chainHeadHash?: string;
    };
    findings?: Array<{
      criterion: string;
      status: "SATISFIED" | "FAILED";
      severity?: string;
    }>;
  };
  vcMetadata?: {
    context: string[];
    credentialType: string[];
    issuerDID: string;
    parleyVersion: string;
    signedBy?: string;
    generatedAt?: string;
    expiresAt?: string;
  };
  /** Evidence types present (ISO 19011 hierarchy) */
  evidenceTypes?: string[];
  /** Observation period (COSO Design vs Operating) */
  observationPeriod?: {
    startDate: string;
    endDate: string;
    durationDays: number;
    sufficient: boolean;
    cosoClassification: string;
    soc2Equivalent: string;
  };
  /** Per-framework compliance results */
  frameworks?: Record<string, {
    controlsMapped: number;
    passed: number;
    failed: number;
    controls: Array<{ controlId: string; status: string }>;
  }>;
  /** Process provenance chain (in-toto/SLSA format) */
  processProvenance?: {
    chainDigest: string;
    receiptCount: number;
    chainVerified: boolean;
    format: string;
    reproducibleSteps: number;
    attestedSteps: number;
    toolAttestedSteps?: number;
    scittEntryIds?: string[];
  };
  /** Optional passthrough fields and mapping metadata */
  extensions?: Record<string, unknown>;
}

/**
 * Decode a JWT payload without signature verification.
 * Returns the full payload for instant UI display, or null on malformed input.
 */
export function decodeJWTPayload(jwt: string): Record<string, unknown> | null {
  const trimmed = jwt.trim();
  const jwtPart = trimmed.includes("~") ? trimmed.split("~")[0] : trimmed;
  const parts = jwtPart.split(".");
  if (parts.length !== 3) return null;

  try {
    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}

/**
 * Merge API verify response with client-side decoded JWT payload.
 * API provides: verified, issuerTier. Decoded payload provides: provenance + summary fields.
 */
export function mergeAPIResultWithDecoded(
  apiData: APIVerifyResponse,
  decodedPayload: Record<string, unknown> | null,
): MarqueVerificationResult {
  const cpoeFields = decodedPayload ? extractCPOEFields(decodedPayload) : {};
  const vcMetadata = decodedPayload ? extractVCMetadata(decodedPayload) : undefined;
  const document = decodedPayload ? mapVCToDocument(decodedPayload) : undefined;

  return {
    valid: apiData.verified,
    reason: apiData.verified
      ? "Signature verified via DID:web. Credential integrity confirmed."
      : apiData.reason || "Verification failed",
    format: "jwt",
    issuerTier: apiData.issuerTier || cpoeFields.issuerTier,
    provenance: apiData.provenance
      ? { ...apiData.provenance, source: apiData.provenance.source as "self" | "tool" | "auditor" }
      : cpoeFields.provenance,
    scope: apiData.scope ?? cpoeFields.scope,
    summary: apiData.summary ?? cpoeFields.summary,
    evidenceTypes: cpoeFields.evidenceTypes,
    observationPeriod: cpoeFields.observationPeriod,
    frameworks: cpoeFields.frameworks,
    processProvenance: apiData.processProvenance ?? cpoeFields.processProvenance ?? undefined,
    extensions: apiData.extensions ?? cpoeFields.extensions,
    vcMetadata: vcMetadata ? {
      ...vcMetadata,
      generatedAt: apiData.timestamps.issuedAt ?? vcMetadata.generatedAt,
      expiresAt: apiData.timestamps.expiresAt ?? vcMetadata.expiresAt,
    } : undefined,
    document,
  };
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return base64ToBuffer(base64);
}

function base64UrlDecode(base64url: string): string {
  const buffer = base64UrlToBuffer(base64url);
  return new TextDecoder().decode(buffer);
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
  return base64ToBuffer(lines);
}

/**
 * Detect whether input is a JWT string or JSON object.
 * JWT has exactly 3 base64url-encoded parts separated by dots.
 */
export function detectFormat(input: string): MarqueFormat {
  const trimmed = input.trim();
  const jwtPart = trimmed.includes("~") ? trimmed.split("~")[0] : trimmed;
  const parts = jwtPart.split(".");
  if (parts.length === 3 && parts.every((p) => p.length > 0)) {
    try {
      JSON.parse(base64UrlDecode(parts[0]));
      return "jwt";
    } catch {
      // Not valid base64url JSON header, fall through to JSON
    }
  }
  return "json";
}

/**
 * Verify a Marque document. Auto-detects format (JWT-VC or JSON envelope).
 */
export async function verifyMarqueInBrowser(
  marqueInput: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  const format = detectFormat(marqueInput);
  if (format === "jwt") {
    return verifyJWTVC(marqueInput.trim(), publicKeyPem);
  }
  return verifyJSON(marqueInput, publicKeyPem);
}

/**
 * JWT-VC verification path.
 * Split JWT, decode header+payload, verify Ed25519 signature via Web Crypto.
 */
async function verifyJWTVC(
  jwt: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  try {
    const jwtPart = jwt.includes("~") ? jwt.split("~")[0] : jwt;
    const parts = jwtPart.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid JWT format: expected 3 dot-separated parts", format: "jwt" };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    let header: { alg?: string; typ?: string; kid?: string };
    try {
      header = JSON.parse(base64UrlDecode(headerB64));
    } catch {
      return { valid: false, reason: "Invalid JWT header: failed to decode", format: "jwt" };
    }

    if (header.alg !== "EdDSA") {
      return { valid: false, reason: `Unsupported algorithm: ${header.alg}. Expected EdDSA.`, format: "jwt" };
    }

    // Decode payload
    let payload: {
      iss?: string;
      sub?: string;
      exp?: number;
      iat?: number;
      jti?: string;
      vc?: {
        "@context"?: string[];
        type?: string[];
        issuer?: string | { id: string; name?: string };
        validFrom?: string;
        validUntil?: string;
        credentialSubject?: Record<string, unknown>;
      };
      parley?: string;
    };
    try {
      payload = JSON.parse(base64UrlDecode(payloadB64));
    } catch {
      return { valid: false, reason: "Invalid JWT payload: failed to decode", format: "jwt" };
    }

    if (!payload.vc) {
      return { valid: false, reason: "Invalid JWT-VC: missing 'vc' claim in payload", format: "jwt" };
    }

    // Import public key via Web Crypto
    const keyBuffer = pemToBuffer(publicKeyPem);
    let publicKey: CryptoKey;
    try {
      publicKey = await crypto.subtle.importKey(
        "spki",
        keyBuffer,
        { name: "Ed25519" },
        false,
        ["verify"]
      );
    } catch {
      return { valid: false, reason: "Invalid public key format. Expected PEM-encoded Ed25519 SPKI key.", format: "jwt" };
    }

    // Verify signature over header.payload
    const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBuffer = base64UrlToBuffer(signatureB64);

    const signatureValid = await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      signatureBuffer,
      signedData
    );

    if (!signatureValid) {
      return { valid: false, reason: "JWT signature verification failed. The credential may have been tampered with.", format: "jwt" };
    }

    // Extract CPOE-specific fields from payload
    const vcMetadata = extractVCMetadata(payload);
    const cpoeFields = extractCPOEFields(payload);

    // Check expiry
    if (payload.exp) {
      const expiresAt = new Date(payload.exp * 1000);
      if (expiresAt < new Date()) {
        return {
          valid: false,
          reason: `Credential expired on ${expiresAt.toISOString()}`,
          format: "jwt",
          ...cpoeFields,
          document: mapVCToDocument(payload),
          vcMetadata,
        };
      }
    }

    return {
      valid: true,
      reason: "JWT-VC signature valid. Credential integrity verified. Not expired.",
      format: "jwt",
      ...cpoeFields,
      document: mapVCToDocument(payload),
      vcMetadata,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, reason: `JWT-VC verification error: ${message}`, format: "jwt" };
  }
}

/**
 * Map JWT-VC payload to the common document shape used by the UI.
 */
function mapVCToDocument(payload: {
  jti?: string;
  vc?: {
    issuer?: string | { id: string; name?: string };
    validFrom?: string;
    validUntil?: string;
    credentialSubject?: Record<string, unknown>;
  };
  parley?: string;
}): MarqueVerificationResult["document"] {
  const vc = payload.vc;
  if (!vc) return undefined;

  const subject = (vc.credentialSubject ?? {}) as Record<string, unknown>;
  const scope = (subject.scope ?? {}) as Record<string, unknown>;
  const summary = (subject.summary ?? {}) as Record<string, unknown>;
  const evidence = (subject.evidenceChain ?? {}) as Record<string, unknown>;

  const issuerName = typeof vc.issuer === "string"
    ? vc.issuer
    : vc.issuer?.name ?? vc.issuer?.id ?? "Unknown";
  const issuerOrg = typeof vc.issuer === "object" && vc.issuer?.name
    ? undefined
    : undefined;

  return {
    id: payload.jti ?? "unknown",
    version: payload.parley ?? "2.0",
    issuer: { name: issuerName, organization: issuerOrg },
    generatedAt: vc.validFrom ?? new Date().toISOString(),
    expiresAt: vc.validUntil ?? "",
    scope: {
      providers: (scope.providers as string[]) ?? [],
      frameworksCovered: (scope.frameworksCovered as string[]) ?? [],
      servicesAssessed: [],
    },
    summary: {
      controlsTested: (summary.controlsTested as number) ?? 0,
      controlsPassed: (summary.controlsPassed as number) ?? 0,
      controlsFailed: (summary.controlsFailed as number) ?? 0,
      overallScore: (summary.overallScore as number) ?? 0,
    },
    evidenceChain: {
      chainType: (evidence.chainType as string) ?? "hash-linked",
      algorithm: (evidence.algorithm as string) ?? "sha256",
      canonicalization: (evidence.canonicalization as string) ?? "sorted-json-v1",
      recordCount: (evidence.recordCount as number) ?? 0,
      chainVerified: (evidence.chainVerified as boolean) ?? false,
      chainDigest: (evidence.chainDigest as string) ?? "",
      chainStartHash: evidence.chainStartHash as string | undefined,
      chainHeadHash: evidence.chainHeadHash as string | undefined,
    },
  };
}

/**
 * Determine issuer trust tier from payload.
 */
function determineIssuerTier(payload: { iss?: string }): IssuerTier {
  const iss = payload.iss;
  if (!iss) return "unverifiable";
  if (iss.startsWith("did:web:grcorsair.com")) return "corsair-verified";
  if (iss.startsWith("did:web:")) return "self-signed";
  return "unverifiable";
}

/**
 * Extract CPOE-specific fields (provenance, scope, summary, issuer tier).
 */
function extractCPOEFields(payload: {
  iss?: string;
  iat?: number;
  exp?: number;
  vc?: {
    issuer?: string | { id: string; name?: string };
    validFrom?: string;
    validUntil?: string;
    credentialSubject?: Record<string, unknown>;
  };
}): Partial<MarqueVerificationResult> {
  const cs = payload.vc?.credentialSubject;
  if (!cs) return {};

  const provenanceData = cs.provenance as {
    source?: "self" | "tool" | "auditor";
    sourceIdentity?: string;
    sourceDate?: string;
  } | undefined;

  const summaryData = cs.summary as {
    controlsTested?: number;
    controlsPassed?: number;
    controlsFailed?: number;
    overallScore?: number;
  } | undefined;

  const evidenceTypesData = cs.evidenceTypes as string[] | undefined;
  const extensionsData = cs.extensions as Record<string, unknown> | undefined;

  const observationPeriodData = cs.observationPeriod as {
    startDate: string; endDate: string; durationDays: number;
    sufficient: boolean; cosoClassification: string; soc2Equivalent: string;
  } | undefined;

  return {
    issuerTier: determineIssuerTier(payload),
    provenance: provenanceData ? {
      source: provenanceData.source ?? "self",
      sourceIdentity: provenanceData.sourceIdentity,
      sourceDate: provenanceData.sourceDate,
    } : undefined,
    scope: typeof cs.scope === "string" ? cs.scope : undefined,
    summary: summaryData ? {
      controlsTested: summaryData.controlsTested ?? 0,
      controlsPassed: summaryData.controlsPassed ?? 0,
      controlsFailed: summaryData.controlsFailed ?? 0,
      overallScore: summaryData.overallScore ?? 0,
    } : undefined,
    evidenceTypes: evidenceTypesData,
    observationPeriod: observationPeriodData,
    frameworks: cs.frameworks as MarqueVerificationResult["frameworks"],
    processProvenance: cs.processProvenance as MarqueVerificationResult["processProvenance"],
    extensions: extensionsData,
  };
}

/**
 * Extract VC-specific metadata for display.
 */
function extractVCMetadata(payload: {
  iss?: string;
  iat?: number;
  exp?: number;
  vc?: {
    "@context"?: string[];
    type?: string[];
    issuer?: string | { id: string; name?: string };
    validFrom?: string;
    validUntil?: string;
  };
  parley?: string;
}): MarqueVerificationResult["vcMetadata"] {
  const issuer = payload.vc?.issuer;
  const signedBy = typeof issuer === "string"
    ? issuer
    : typeof issuer === "object" && issuer !== null
      ? issuer.name ?? issuer.id
      : payload.iss ?? "";

  return {
    context: payload.vc?.["@context"] ?? [],
    credentialType: payload.vc?.type ?? [],
    issuerDID: payload.iss ?? "",
    parleyVersion: payload.parley ?? "2.0",
    signedBy,
    generatedAt: payload.vc?.validFrom,
    expiresAt: payload.vc?.validUntil,
  };
}

/**
 * JSON envelope verification path.
 */
async function verifyJSON(
  marqueJson: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  try {
    const marque = JSON.parse(marqueJson);

    // Validate structure
    if (!marque.signature || !marque.marque) {
      return { valid: false, reason: "Invalid Marque format: missing 'signature' or 'marque' field", format: "json" };
    }

    // Import public key via Web Crypto
    const keyBuffer = pemToBuffer(publicKeyPem);
    let publicKey: CryptoKey;
    try {
      publicKey = await crypto.subtle.importKey(
        "spki",
        keyBuffer,
        { name: "Ed25519" },
        false,
        ["verify"]
      );
    } catch {
      return { valid: false, reason: "Invalid public key format. Expected PEM-encoded Ed25519 SPKI key.", format: "json" };
    }

    // Extract signature and signed content
    const signatureBuffer = base64ToBuffer(marque.signature);
    const signedContent = JSON.stringify(marque.marque);
    const dataBuffer = new TextEncoder().encode(signedContent);

    // Verify Ed25519 signature
    const signatureValid = await crypto.subtle.verify(
      "Ed25519",
      publicKey,
      signatureBuffer,
      dataBuffer
    );

    if (!signatureValid) {
      return { valid: false, reason: "Signature verification failed. The document may have been tampered with.", format: "json" };
    }

    // Check expiry
    const expiresAt = new Date(marque.marque.expiresAt);
    if (expiresAt < new Date()) {
      return {
        valid: false,
        reason: `Marque expired on ${expiresAt.toISOString()}`,
        format: "json",
        document: marque.marque,
      };
    }

    return {
      valid: true,
      reason: "Signature valid. Document integrity verified. Not expired.",
      format: "json",
      document: marque.marque,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, reason: `Verification error: ${message}`, format: "json" };
  }
}

const SAMPLE_CPOE_HEADER = { alg: "none", typ: "vc+jwt" };
const SAMPLE_CPOE_PAYLOAD = {
  vc: {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://grcorsair.com/credentials/v1",
    ],
    type: ["VerifiableCredential", "CorsairCPOE"],
    issuer: { id: "did:web:grcorsair.com", name: "Example Audit Firm LLP" },
    validFrom: "2026-02-16T00:00:00Z",
    validUntil: "2026-05-16T00:00:00Z",
    credentialSubject: {
      type: "CorsairCPOE",
      scope: "SOC 2 Type II — Example Cloud Platform",
      provenance: { source: "tool", sourceIdentity: "Prowler" },
      summary: {
        controlsTested: 24,
        controlsPassed: 23,
        controlsFailed: 1,
        overallScore: 96,
      },
    },
  },
  parley: "2.1",
  iss: "did:web:grcorsair.com",
  sub: "marque-sample",
  iat: 1771200000,
  exp: 1778841600,
};

/** Sample CPOE payload for UI previews (unsigned). */
export const SAMPLE_CPOE_JWT = `${base64UrlEncode(JSON.stringify(SAMPLE_CPOE_HEADER))}.${base64UrlEncode(JSON.stringify(SAMPLE_CPOE_PAYLOAD))}.signature`;

/** @deprecated Use SAMPLE_CPOE_JWT instead */
export const SAMPLE_MARQUE = SAMPLE_CPOE_JWT;

export const SAMPLE_NOTE =
  "Sample payload loaded for preview. Paste your own CPOE to verify a real signature.";
