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
  /** Assurance level (0-4) */
  assuranceLevel?: number;
  /** Human-readable assurance name */
  assuranceName?: string;
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
  /** Full assurance breakdown */
  assurance?: {
    declared: number;
    verified: boolean;
    method: string;
    breakdown: Record<string, number>;
    excluded?: Array<{
      controlId: string;
      reason: string;
      acceptedBy?: string;
    }>;
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
    quartermasterAttestation?: {
      confidenceScore: number;
      trustTier: string;
      dimensions: Record<string, number>;
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
  /** 7-dimension assurance scores (FAIR-CAM + GRADE + COSO) */
  dimensions?: {
    capability: number;
    coverage: number;
    reliability: number;
    methodology: number;
    freshness: number;
    independence: number;
    consistency: number;
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
  /** CRQ risk quantification data */
  riskQuantification?: {
    betaPert: { shapeParameter: number; confidenceWidth: string };
    fairMapping: { resistanceStrength: string; controlEffectiveness: number; controlFunction: string };
    provenanceModifier: number;
    freshnessDecay: number;
    dimensionConfidence: number;
  };
  /** Per-framework compliance results */
  frameworks?: Record<string, {
    controlsMapped: number;
    passed: number;
    failed: number;
    controls: Array<{ controlId: string; status: string }>;
  }>;
  /** Rule trace for deterministic calculation audit */
  ruleTrace?: string[];
  /** Calculation version (e.g., "l0-l4@2026-02-09") */
  calculationVersion?: string;
  /** Per-control classification with level, methodology, trace */
  controlClassifications?: Array<{
    controlId: string;
    level: number;
    methodology: string;
    trace: string;
    boilerplateFlags?: string[];
  }>;
  /** NIST 800-53A assessment depth */
  assessmentDepth?: {
    methods: string[];
    depth: string;
    rigorScore: number;
  };
  /** Provenance quality score (0-100) */
  provenanceQuality?: number;
  /** DORA evidence quality metrics */
  doraMetrics?: {
    freshness: number;
    specificity: number;
    independence: number;
    reproducibility: number;
    band: string;
    pairingFlags?: string[];
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
 * API provides: verified, issuerTier. Decoded payload provides: rich L0-L4 fields.
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
    assuranceLevel: apiData.assurance?.level ?? cpoeFields.assuranceLevel,
    assuranceName: apiData.assurance?.name ?? cpoeFields.assuranceName,
    assurance: cpoeFields.assurance,
    provenance: apiData.provenance
      ? { ...apiData.provenance, source: apiData.provenance.source as "self" | "tool" | "auditor" }
      : cpoeFields.provenance,
    scope: apiData.scope ?? cpoeFields.scope,
    summary: apiData.summary ?? cpoeFields.summary,
    dimensions: cpoeFields.dimensions,
    evidenceTypes: cpoeFields.evidenceTypes,
    observationPeriod: cpoeFields.observationPeriod,
    riskQuantification: cpoeFields.riskQuantification,
    frameworks: cpoeFields.frameworks,
    ruleTrace: cpoeFields.ruleTrace,
    calculationVersion: cpoeFields.calculationVersion,
    controlClassifications: cpoeFields.controlClassifications,
    assessmentDepth: cpoeFields.assessmentDepth,
    provenanceQuality: cpoeFields.provenanceQuality,
    doraMetrics: cpoeFields.doraMetrics,
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
  const qm = subject.quartermasterAttestation as Record<string, unknown> | undefined;

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
    quartermasterAttestation: qm
      ? {
          confidenceScore: (qm.confidenceScore as number) ?? 0,
          trustTier: (qm.trustTier as string) ?? "unknown",
          dimensions: Object.fromEntries(
            ((qm.dimensions as Array<{ dimension: string; score: number }>) ?? []).map(
              (d) => [d.dimension, d.score]
            )
          ),
        }
      : undefined,
  };
}

/** Human-readable assurance level names */
const ASSURANCE_NAMES: Record<number, string> = {
  0: "Documented",
  1: "Configured",
  2: "Demonstrated",
  3: "Observed",
  4: "Attested",
};

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
 * Extract CPOE-specific fields (assurance, provenance, scope, summary, issuer tier).
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

  const assuranceData = cs.assurance as {
    declared?: number;
    verified?: boolean;
    method?: string;
    breakdown?: Record<string, number>;
    excluded?: Array<{ controlId: string; reason: string; acceptedBy?: string }>;
  } | undefined;

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

  // Extract new framework-grounded fields
  const dimensionsData = cs.dimensions as {
    capability: number; coverage: number; reliability: number;
    methodology: number; freshness: number; independence: number; consistency: number;
  } | undefined;

  const evidenceTypesData = cs.evidenceTypes as string[] | undefined;

  const observationPeriodData = cs.observationPeriod as {
    startDate: string; endDate: string; durationDays: number;
    sufficient: boolean; cosoClassification: string; soc2Equivalent: string;
  } | undefined;

  const riskQuantificationData = cs.riskQuantification as {
    betaPert: { shapeParameter: number; confidenceWidth: string };
    fairMapping: { resistanceStrength: string; controlEffectiveness: number; controlFunction: string };
    provenanceModifier: number; freshnessDecay: number; dimensionConfidence: number;
  } | undefined;

  return {
    issuerTier: determineIssuerTier(payload),
    assuranceLevel: assuranceData?.declared,
    assuranceName: assuranceData?.declared !== undefined
      ? ASSURANCE_NAMES[assuranceData.declared] ?? `L${assuranceData.declared}`
      : undefined,
    assurance: assuranceData ? {
      declared: assuranceData.declared ?? 0,
      verified: assuranceData.verified ?? false,
      method: assuranceData.method ?? "self-assessed",
      breakdown: assuranceData.breakdown ?? {},
      excluded: assuranceData.excluded,
    } : undefined,
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
    dimensions: dimensionsData,
    evidenceTypes: evidenceTypesData,
    observationPeriod: observationPeriodData,
    riskQuantification: riskQuantificationData,
    frameworks: cs.frameworks as MarqueVerificationResult["frameworks"],
    ruleTrace: (cs.assurance as Record<string, unknown>)?.ruleTrace as string[] | undefined,
    calculationVersion: (cs.assurance as Record<string, unknown>)?.calculationVersion as string | undefined,
    controlClassifications: cs.controlClassifications as MarqueVerificationResult["controlClassifications"],
    assessmentDepth: cs.assessmentDepth as MarqueVerificationResult["assessmentDepth"],
    provenanceQuality: typeof cs.provenanceQuality === "number" ? cs.provenanceQuality : undefined,
    doraMetrics: cs.doraMetrics as MarqueVerificationResult["doraMetrics"],
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
export const SAMPLE_CPOE_JWT = "eyJhbGciOiJFZERTQSIsInR5cCI6InZjK2p3dCIsImtpZCI6ImRpZDp3ZWI6Z3Jjb3JzYWlyLmNvbSNrZXktMSJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL2dyY29yc2Fpci5jb20vY3JlZGVudGlhbHMvdjEiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkNvcnNhaXJDUE9FIl0sImlzc3VlciI6eyJpZCI6ImRpZDp3ZWI6Z3Jjb3JzYWlyLmNvbSIsIm5hbWUiOiJFeGFtcGxlIEF1ZGl0IEZpcm0gTExQIn0sInZhbGlkRnJvbSI6IjIwMjYtMDItMTFUMTA6MjI6NTUuOTc2WiIsInZhbGlkVW50aWwiOiIyMDI2LTA1LTEyVDEwOjIyOjU1Ljk3NloiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJ0eXBlIjoiQ29yc2FpckNQT0UiLCJzY29wZSI6IlNPQyAyIFR5cGUgSUkgLSBBY21lIENsb3VkIFBsYXRmb3JtIiwiYXNzdXJhbmNlIjp7ImRlY2xhcmVkIjoxLCJ2ZXJpZmllZCI6dHJ1ZSwibWV0aG9kIjoic2VsZi1hc3Nlc3NlZCIsImJyZWFrZG93biI6eyIxIjoxMn0sImNhbGN1bGF0aW9uVmVyc2lvbiI6ImwwLWw0QDIwMjYtMDItMDkiLCJydWxlVHJhY2UiOlsiUlVMRTogMTIgY29udHJvbHMgY2hlY2tlZCIsIlJVTEU6IHNvdXJjZSBcInNvYzJcIiBjZWlsaW5nID0gTDEiLCJSVUxFOiBicmVha2Rvd24gPSB7XCIxXCI6MTJ9IiwiUlVMRTogbWluIG9mIGluLXNjb3BlIGNvbnRyb2xzID0gTDEg4oCUIHNhdGlzZmllZCIsIlJVTEU6IGZyZXNobmVzcyBjaGVja2VkIOKAlCBmcmVzaCAoMjcgZGF5cykiLCJTQUZFR1VBUkQ6IEFsbCAxMiBjb250cm9scyBhcmUgZWZmZWN0aXZlIOKAlCBhbGwtcGFzcyBiaWFzIGZsYWcgYXBwbGllZCAoY29uc2lzdGVuY3kgZGltZW5zaW9uIHBlbmFsdHkpIl19LCJwcm92ZW5hbmNlIjp7InNvdXJjZSI6ImF1ZGl0b3IiLCJzb3VyY2VJZGVudGl0eSI6IkV4YW1wbGUgQXVkaXQgRmlybSBMTFAiLCJzb3VyY2VEYXRlIjoiMjAyNi0wMS0xNSIsImV2aWRlbmNlVHlwZURpc3RyaWJ1dGlvbiI6eyJkb2N1bWVudGVkLXJlY29yZCI6MC42LCJpbnRlcnZpZXciOjAuNH19LCJzdW1tYXJ5Ijp7ImNvbnRyb2xzVGVzdGVkIjowLCJjb250cm9sc1Bhc3NlZCI6MCwiY29udHJvbHNGYWlsZWQiOjAsIm92ZXJhbGxTY29yZSI6MH0sImRpbWVuc2lvbnMiOnsiY2FwYWJpbGl0eSI6MTAwLCJjb3ZlcmFnZSI6NzAsInJlbGlhYmlsaXR5IjoxMDAsIm1ldGhvZG9sb2d5Ijo1MCwiZnJlc2huZXNzIjo5MywiaW5kZXBlbmRlbmNlIjo4NSwiY29uc2lzdGVuY3kiOjg1fSwiZXZpZGVuY2VUeXBlcyI6WyJkb2N1bWVudGVkLXJlY29yZCIsImludGVydmlldyJdLCJvYnNlcnZhdGlvblBlcmlvZCI6eyJzdGFydERhdGUiOiIyMDI1LTEwLTE3IiwiZW5kRGF0ZSI6IjIwMjYtMDEtMTUiLCJkdXJhdGlvbkRheXMiOjkwLCJzdWZmaWNpZW50Ijp0cnVlLCJjb3NvQ2xhc3NpZmljYXRpb24iOiJvcGVyYXRpbmciLCJzb2MyRXF1aXZhbGVudCI6IlR5cGUgSUkgKDNtbykifSwiY29udHJvbENsYXNzaWZpY2F0aW9ucyI6W3siY29udHJvbElkIjoiQ0MxLjEiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiJ9LHsiY29udHJvbElkIjoiQ0MxLjIiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiIsImJvaWxlcnBsYXRlRmxhZ3MiOlsiZ2VuZXJpYy1ib2lsZXJwbGF0ZSJdfSx7ImNvbnRyb2xJZCI6IkNDMi4xIiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4iLCJib2lsZXJwbGF0ZUZsYWdzIjpbImdlbmVyaWMtYm9pbGVycGxhdGUiXX0seyJjb250cm9sSWQiOiJDQzMuMSIsImxldmVsIjoxLCJtZXRob2RvbG9neSI6InVua25vd24iLCJ0cmFjZSI6Ik5vIG1ldGhvZG9sb2d5IGtleXdvcmRzIGRldGVjdGVkLiBTb3VyY2UgY2VpbGluZzogTDEuIE1heCBsZXZlbDogTDEuIn0seyJjb250cm9sSWQiOiJDQzUuMSIsImxldmVsIjoxLCJtZXRob2RvbG9neSI6InVua25vd24iLCJ0cmFjZSI6Ik5vIG1ldGhvZG9sb2d5IGtleXdvcmRzIGRldGVjdGVkLiBTb3VyY2UgY2VpbGluZzogTDEuIE1heCBsZXZlbDogTDEuIiwiYm9pbGVycGxhdGVGbGFncyI6WyJnZW5lcmljLWJvaWxlcnBsYXRlIl19LHsiY29udHJvbElkIjoiQ0M2LjEiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiJ9LHsiY29udHJvbElkIjoiQ0M2LjMiLCJsZXZlbCI6MSwibWV0aG9kb2xvZ3kiOiJ1bmtub3duIiwidHJhY2UiOiJObyBtZXRob2RvbG9neSBrZXl3b3JkcyBkZXRlY3RlZC4gU291cmNlIGNlaWxpbmc6IEwxLiBNYXggbGV2ZWw6IEwxLiIsImJvaWxlcnBsYXRlRmxhZ3MiOlsiZ2VuZXJpYy1ib2lsZXJwbGF0ZSJdfSx7ImNvbnRyb2xJZCI6IkNDNi42IiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4ifSx7ImNvbnRyb2xJZCI6IkNDNy4xIiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4ifSx7ImNvbnRyb2xJZCI6IkNDNy4yIiwibGV2ZWwiOjEsIm1ldGhvZG9sb2d5IjoidW5rbm93biIsInRyYWNlIjoiTm8gbWV0aG9kb2xvZ3kga2V5d29yZHMgZGV0ZWN0ZWQuIFNvdXJjZSBjZWlsaW5nOiBMMS4gTWF4IGxldmVsOiBMMS4iLCJib2lsZXJwbGF0ZUZsYWdzIjpbImdlbmVyaWMtYm9pbGVycGxhdGUiXX0seyJjb250cm9sSWQiOiJDQzcuMyIsImxldmVsIjoxLCJtZXRob2RvbG9neSI6InVua25vd24iLCJ0cmFjZSI6Ik5vIG1ldGhvZG9sb2d5IGtleXdvcmRzIGRldGVjdGVkLiBTb3VyY2UgY2VpbGluZzogTDEuIE1heCBsZXZlbDogTDEuIn0seyJjb250cm9sSWQiOiJDQzguMSIsImxldmVsIjoxLCJtZXRob2RvbG9neSI6InVua25vd24iLCJ0cmFjZSI6Ik5vIG1ldGhvZG9sb2d5IGtleXdvcmRzIGRldGVjdGVkLiBTb3VyY2UgY2VpbGluZzogTDEuIE1heCBsZXZlbDogTDEuIn1dLCJhc3Nlc3NtZW50RGVwdGgiOnsibWV0aG9kcyI6WyJleGFtaW5lIiwidGVzdCJdLCJkZXB0aCI6ImJhc2ljIiwicmlnb3JTY29yZSI6MTV9LCJwcm92ZW5hbmNlUXVhbGl0eSI6NzAsImRvcmFNZXRyaWNzIjp7ImZyZXNobmVzcyI6OTMsInNwZWNpZmljaXR5Ijo1LCJpbmRlcGVuZGVuY2UiOjg1LCJyZXByb2R1Y2liaWxpdHkiOjExLCJiYW5kIjoibG93IiwicGFpcmluZ0ZsYWdzIjpbIkhpZ2ggZnJlc2huZXNzICsgbG93IHJlcHJvZHVjaWJpbGl0eTogZXZpZGVuY2UgcmVmcmVzaGVkIGJ1dCBjYW5ub3QgYmUgcmUtdmVyaWZpZWQiLCJMb3cgc3BlY2lmaWNpdHkgKyBoaWdoIGluZGVwZW5kZW5jZTogaW5kZXBlbmRlbnQgYnV0IHZhZ3VlIGFzc2Vzc21lbnQiXX19fSwicGFybGV5IjoiMi4xIiwiaWF0IjoxNzcwODA1Mzc1LCJpc3MiOiJkaWQ6d2ViOmdyY29yc2Fpci5jb20iLCJzdWIiOiJtYXJxdWUtNTMxZDg4NDItODE3OC00OWVhLWI1ZjQtM2I3MjM1ZTE1MDkzIiwianRpIjoibWFycXVlLTUzMWQ4ODQyLTgxNzgtNDllYS1iNWY0LTNiNzIzNWUxNTA5MyIsImV4cCI6MTc3ODU4MTM3NX0.ZuDZF4LBpjb0Zx3eTvncBuwRsc8oDdLTGeLu7B_23TrcGCmml1OqRgir4TRLH68R2dfuH9bKUhxvvphIZKJmCw";

/** @deprecated Use SAMPLE_CPOE_JWT instead */
export const SAMPLE_MARQUE = SAMPLE_CPOE_JWT;

export const SAMPLE_NOTE =
  "Real CPOE signed by did:web:grcorsair.com (Ed25519). Verified via DID:web resolution against the live API.";
