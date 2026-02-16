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
      hashChainRoot: string;
      recordCount: number;
      algorithm: string;
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
    scittEntryIds?: string[];
  };
}

/**
 * Decode a JWT payload without signature verification.
 * Returns the full payload for instant UI display, or null on malformed input.
 */
export function decodeJWTPayload(jwt: string): Record<string, unknown> | null {
  const trimmed = jwt.trim();
  const parts = trimmed.split(".");
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
  const parts = trimmed.split(".");
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
    const parts = jwt.split(".");
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
      hashChainRoot: (evidence.hashChainRoot as string) ?? "",
      recordCount: (evidence.recordCount as number) ?? 0,
      algorithm: "SHA-256",
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

/** Real CPOE JWT-VC signed by did:web:grcorsair.com — issued via POST api.grcorsair.com/issue */
export const SAMPLE_CPOE_JWT = "eyJhbGciOiJFZERTQSIsInR5cCI6InZjK2p3dCIsImtpZCI6ImRpZDp3ZWI6Z3Jjb3JzYWlyLmNvbSNrZXktMSJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL2dyY29yc2Fpci5jb20vY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkNvcnNhaXJDUE9FIl0sImlzc3VlciI6eyJpZCI6ImRpZDp3ZWI6Z3Jjb3JzYWlyLmNvbSIsIm5hbWUiOiJFeGFtcGxlIEF1ZGl0IEZpcm0gTExQIn0sInZhbGlkRnJvbSI6IjIwMjYtMDItMTJUMDg6MDI6NDQuODA1WiIsInZhbGlkVW50aWwiOiIyMDI2LTA1LTEzVDA4OjAyOjQ0LjgwNVoiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJ0eXBlIjoiQ29yc2FpckNQT0UiLCJzY29wZSI6IlNPQyAyIFR5cGUgSUkg4oCUIEFjbWUgQ2xvdWQgUGxhdGZvcm0iLCJhc3N1cmFuY2UiOnsiZGVjbGFyZWQiOjEsInZlcmlmaWVkIjp0cnVlLCJtZXRob2QiOiJzZWxmLWFzc2Vzc2VkIiwiYnJlYWtkb3duIjp7IjEiOjExLCIyIjoxfSwiY2FsY3VsYXRpb25WZXJzaW9uIjoibDAtbDRAMjAyNi0wMi0wOSIsInJ1bGVUcmFjZSI6WyJSVUxFOiAxMiBjb250cm9scyBjaGVja2VkIiwiUlVMRTogc291cmNlIFwic29jMlwiIGNlaWxpbmcgPSBMMSIsIlJVTEU6IGJyZWFrZG93biA9IHtcIjFcIjoxMSxcIjJcIjoxfSIsIlJVTEU6IG1pbiBvZiBpbi1zY29wZSBjb250cm9scyA9IEwxIOKAlCBzYXRpc2ZpZWQiLCJSVUxFOiBmcmVzaG5lc3MgY2hlY2tlZCDigJQgZnJlc2ggKDI4IGRheXMpIiwiU0FGRUdVQVJEOiBBbGwgMTIgY29udHJvbHMgYXJlIGVmZmVjdGl2ZSDigJQgYWxsLXBhc3MgYmlhcyBmbGFnIGFwcGxpZWQgKGNvbnNpc3RlbmN5IGRpbWVuc2lvbiBwZW5hbHR5KSJdfSwicHJvdmVuYW5jZSI6eyJzb3VyY2UiOiJhdWRpdG9yIiwic291cmNlSWRlbnRpdHkiOiJFeGFtcGxlIEF1ZGl0IEZpcm0gTExQIiwic291cmNlRGF0ZSI6IjIwMjYtMDEtMTUiLCJldmlkZW5jZVR5cGVEaXN0cmlidXRpb24iOnsiZG9jdW1lbnRlZC1yZWNvcmQiOjAuNiwiaW50ZXJ2aWV3IjowLjR9fSwic3VtbWFyeSI6eyJjb250cm9sc1Rlc3RlZCI6MjQsImNvbnRyb2xzUGFzc2VkIjoyNCwiY29udHJvbHNGYWlsZWQiOjAsIm92ZXJhbGxTY29yZSI6MTAwfSwiZnJhbWV3b3JrcyI6eyJTT0MyIjp7ImNvbnRyb2xzTWFwcGVkIjoxMiwicGFzc2VkIjoxMiwiZmFpbGVkIjowLCJjb250cm9scyI6W3siY29udHJvbElkIjoiQ0MxLjEiLCJzdGF0dXMiOiJwYXNzZWQifSx7ImNvbnRyb2xJZCI6IkNDMS4yIiwic3RhdHVzIjoicGFzc2VkIn0seyJjb250cm9sSWQiOiJDQzIuMSIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiQ0MzLjEiLCJzdGF0dXMiOiJwYXNzZWQifSx7ImNvbnRyb2xJZCI6IkNDNS4xIiwic3RhdHVzIjoicGFzc2VkIn0seyJjb250cm9sSWQiOiJDQzYuMSIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiQ0M2LjMiLCJzdGF0dXMiOiJwYXNzZWQifSx7ImNvbnRyb2xJZCI6IkNDNi42Iiwic3RhdHVzIjoicGFzc2VkIn0seyJjb250cm9sSWQiOiJDQzcuMSIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiQ0M3LjIiLCJzdGF0dXMiOiJwYXNzZWQifSx7ImNvbnRyb2xJZCI6IkNDNy4zIiwic3RhdHVzIjoicGFzc2VkIn0seyJjb250cm9sSWQiOiJDQzguMSIsInN0YXR1cyI6InBhc3NlZCJ9XX0sIk5JU1QtODAwLTUzIjp7ImNvbnRyb2xzTWFwcGVkIjoxMiwicGFzc2VkIjoxMiwiZmFpbGVkIjowLCJjb250cm9scyI6W3siY29udHJvbElkIjoiUEwtNCIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiUE0tMSIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiQVQtMiIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiUkEtMyIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiUEwtMiIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiQUMtMiIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiQUMtNSIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiU0MtOCIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiU0ktNCIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiU0ktMiIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiSVItNiIsInN0YXR1cyI6InBhc3NlZCJ9LHsiY29udHJvbElkIjoiQ00tMyIsInN0YXR1cyI6InBhc3NlZCJ9XX19LCJkaW1lbnNpb25zIjp7ImNhcGFiaWxpdHkiOjEwMCwiY292ZXJhZ2UiOjEwMCwicmVsaWFiaWxpdHkiOjEwMCwibWV0aG9kb2xvZ3kiOjUwLCJmcmVzaG5lc3MiOjkyLCJpbmRlcGVuZGVuY2UiOjg1LCJjb25zaXN0ZW5jeSI6ODV9LCJldmlkZW5jZVR5cGVzIjpbImRvY3VtZW50ZWQtcmVjb3JkIiwiaW50ZXJ2aWV3Il0sIm9ic2VydmF0aW9uUGVyaW9kIjp7InN0YXJ0RGF0ZSI6IjIwMjUtMDctMTkiLCJlbmREYXRlIjoiMjAyNi0wMS0xNSIsImR1cmF0aW9uRGF5cyI6MTgwLCJzdWZmaWNpZW50Ijp0cnVlLCJjb3NvQ2xhc3NpZmljYXRpb24iOiJvcGVyYXRpbmciLCJzb2MyRXF1aXZhbGVudCI6IlR5cGUgSUkgKDZtbykifSwiY29udHJvbENsYXNzaWZpY2F0aW9ucyI6W3siY29udHJvbElkIjoiQ0MxLjEiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiIsImJvaWxlcnBsYXRlRmxhZ3MiOlsiZ2VuZXJpYy1ib2lsZXJwbGF0ZSJdfSx7ImNvbnRyb2xJZCI6IkNDMS4yIiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4iLCJib2lsZXJwbGF0ZUZsYWdzIjpbImdlbmVyaWMtYm9pbGVycGxhdGUiXX0seyJjb250cm9sSWQiOiJDQzIuMSIsImxldmVsIjoxLCJtZXRob2RvbG9neSI6InVua25vd24iLCJ0cmFjZSI6Ik5vIG1ldGhvZG9sb2d5IGtleXdvcmRzIGRldGVjdGVkLiBTb3VyY2UgY2VpbGluZzogTDEuIE1heCBsZXZlbDogTDEuIiwiYm9pbGVycGxhdGVGbGFncyI6WyJnZW5lcmljLWJvaWxlcnBsYXRlIl19LHsiY29udHJvbElkIjoiQ0MzLjEiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiIsImJvaWxlcnBsYXRlRmxhZ3MiOlsiZ2VuZXJpYy1ib2lsZXJwbGF0ZSJdfSx7ImNvbnRyb2xJZCI6IkNDNS4xIiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4iLCJib2lsZXJwbGF0ZUZsYWdzIjpbImdlbmVyaWMtYm9pbGVycGxhdGUiXX0seyJjb250cm9sSWQiOiJDQzYuMSIsImxldmVsIjoxLCJtZXRob2RvbG9neSI6InVua25vd24iLCJ0cmFjZSI6Ik5vIG1ldGhvZG9sb2d5IGtleXdvcmRzIGRldGVjdGVkLiBTb3VyY2UgY2VpbGluZzogTDEuIE1heCBsZXZlbDogTDEuIiwiYm9pbGVycGxhdGVGbGFncyI6WyJnZW5lcmljLWJvaWxlcnBsYXRlIl19LHsiY29udHJvbElkIjoiQ0M2LjMiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiIsImJvaWxlcnBsYXRlRmxhZ3MiOlsiZ2VuZXJpYy1ib2lsZXJwbGF0ZSJdfSx7ImNvbnRyb2xJZCI6IkNDNi42IiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4iLCJib2lsZXJwbGF0ZUZsYWdzIjpbImdlbmVyaWMtYm9pbGVycGxhdGUiXX0seyJjb250cm9sSWQiOiJDQzcuMSIsImxldmVsIjoxLCJtZXRob2RvbG9neSI6InVua25vd24iLCJ0cmFjZSI6Ik5vIG1ldGhvZG9sb2d5IGtleXdvcmRzIGRldGVjdGVkLiBTb3VyY2UgY2VpbGluZzogTDEuIE1heCBsZXZlbDogTDEuIiwiYm9pbGVycGxhdGVGbGFncyI6WyJnZW5lcmljLWJvaWxlcnBsYXRlIl19LHsiY29udHJvbElkIjoiQ0M3LjIiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiIsImJvaWxlcnBsYXRlRmxhZ3MiOlsiZ2VuZXJpYy1ib2lsZXJwbGF0ZSJdfSx7ImNvbnRyb2xJZCI6IkNDNy4zIiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4iLCJib2lsZXJwbGF0ZUZsYWdzIjpbImdlbmVyaWMtYm9pbGVycGxhdGUiXX0seyJjb250cm9sSWQiOiJDQzguMSIsImxldmVsIjoyLCJtZXRob2RvbG9neSI6ImNhYXQiLCJ0cmFjZSI6IkV2aWRlbmNlIG1ldGhvZG9sb2d5OiBjYWF0IChkZXRlY3RlZDogY2FhdCkuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWV0aG9kb2xvZ3kgbWF4OiBMMi4gRWZmZWN0aXZlIG1heDogTDIuIiwiYm9pbGVycGxhdGVGbGFncyI6WyJnZW5lcmljLWJvaWxlcnBsYXRlIl19XSwiYXNzZXNzbWVudERlcHRoIjp7Im1ldGhvZHMiOlsiZXhhbWluZSIsInRlc3QiXSwiZGVwdGgiOiJjb21wcmVoZW5zaXZlIiwicmlnb3JTY29yZSI6NzB9LCJwcm92ZW5hbmNlUXVhbGl0eSI6ODQsImRvcmFNZXRyaWNzIjp7ImZyZXNobmVzcyI6OTIsInNwZWNpZmljaXR5IjozLCJpbmRlcGVuZGVuY2UiOjg1LCJyZXByb2R1Y2liaWxpdHkiOjE1LCJiYW5kIjoibG93IiwicGFpcmluZ0ZsYWdzIjpbIkhpZ2ggZnJlc2huZXNzICsgbG93IHJlcHJvZHVjaWJpbGl0eTogZXZpZGVuY2UgcmVmcmVzaGVkIGJ1dCBjYW5ub3QgYmUgcmUtdmVyaWZpZWQiLCJMb3cgc3BlY2lmaWNpdHkgKyBoaWdoIGluZGVwZW5kZW5jZTogaW5kZXBlbmRlbnQgYnV0IHZhZ3VlIGFzc2Vzc21lbnQiXX0sInByb2Nlc3NQcm92ZW5hbmNlIjp7ImNoYWluRGlnZXN0IjoiZTM4YWYyNzUzNjZlZjEyZjUyMzgwODg0Y2U3YTQwODc3OGM1OGQwMzdhMDA3MmI2NThiZmIzODM2ZGM0ZDUwNiIsInJlY2VpcHRDb3VudCI6MiwiY2hhaW5WZXJpZmllZCI6dHJ1ZSwiZm9ybWF0IjoiaW4tdG90by92MStjb3NlLXNpZ24xIiwicmVwcm9kdWNpYmxlU3RlcHMiOjIsImF0dGVzdGVkU3RlcHMiOjB9fX0sInBhcmxleSI6IjIuMSIsImlhdCI6MTc3MDg4MzM2NCwiaXNzIjoiZGlkOndlYjpncmNvcnNhaXIuY29tIiwic3ViIjoibWFycXVlLWY3ZjY1ZDNlLWY1YzktNGJkYi04ODI1LTliZGZlNWMzNDY5NyIsImp0aSI6Im1hcnF1ZS1mN2Y2NWQzZS1mNWM5LTRiZGItODgyNS05YmRmZTVjMzQ2OTciLCJleHAiOjE3Nzg2NTkzNjR9.PhHrsqqOAU69J4yadq2VyuI6cmY4w82xkg5BwF03ywqJ_SZ_MY8OV0HlllcyNIDwQN0bYSrmcs3KPsU-GOJdBA";

/** @deprecated Use SAMPLE_CPOE_JWT instead */
export const SAMPLE_MARQUE = SAMPLE_CPOE_JWT;

export const SAMPLE_NOTE =
  "Real CPOE signed by did:web:grcorsair.com (Ed25519). Verified via DID:web resolution against the live API.";
