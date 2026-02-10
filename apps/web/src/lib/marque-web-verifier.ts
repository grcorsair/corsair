/**
 * Marque Verifier — Client-side Ed25519 verification via Web Crypto API.
 * Supports JWT-VC (standard) and JSON envelope formats.
 * Zero server calls. No data leaves the browser.
 */

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

/** Sample CPOE in v0.3.0 format for the "Try it" button */
export const SAMPLE_MARQUE = JSON.stringify(
  {
    marque: {
      id: "mrq_2026-02-09_demo_abc123",
      version: "2.0.0",
      issuer: {
        name: "Security Engineering",
        organization: "Acme Cloud Platform",
      },
      generatedAt: "2026-02-09T10:30:00Z",
      expiresAt: "2027-02-09T10:30:00Z",
      scope: "SOC 2 Type II — Acme Cloud Platform",
      assurance: {
        declared: 1,
        verified: true,
        method: "self-assessed",
        breakdown: { "0": 2, "1": 22 },
      },
      provenance: {
        source: "auditor",
        sourceIdentity: "Example Audit Firm LLP",
        sourceDate: "2026-01-15",
      },
      summary: {
        controlsTested: 24,
        controlsPassed: 22,
        controlsFailed: 2,
        overallScore: 92,
      },
      evidenceChain: {
        hashChainRoot:
          "a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
        recordCount: 12,
        algorithm: "SHA-256",
      },
      quartermasterAttestation: {
        confidenceScore: 82,
        trustTier: "AI-VERIFIED",
        dimensions: {
          methodology: 0.85,
          evidence_integrity: 0.9,
          completeness: 0.78,
          bias: 0.75,
        },
      },
      findings: [
        { criterion: "Encryption at rest enabled for all storage", status: "SATISFIED" },
        { criterion: "Access logging configured and active", status: "SATISFIED" },
        { criterion: "Password policy meets 14-char minimum", status: "FAILED", severity: "HIGH" },
        { criterion: "MFA enforced for all user accounts", status: "FAILED", severity: "CRITICAL" },
        { criterion: "Session timeout under 30 minutes", status: "SATISFIED" },
        { criterion: "Account lockout after 5 failed attempts", status: "SATISFIED" },
        { criterion: "CloudTrail logging with integrity validation", status: "SATISFIED" },
        { criterion: "No public access to user pool", status: "SATISFIED" },
      ],
    },
    signature: "DEMO_SIGNATURE_NOT_CRYPTOGRAPHICALLY_VALID",
  },
  null,
  2
);

export const SAMPLE_NOTE =
  "This is a demo CPOE. The signature is not cryptographically valid — it demonstrates the verification UI. Real CPOEs are Ed25519-signed W3C Verifiable Credentials generated by the Corsair CLI.";
