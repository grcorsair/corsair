/**
 * Marque Verifier — Client-side Ed25519 verification via Web Crypto API.
 * Supports both v1 (JSON envelope) and v2 (JWT-VC) formats.
 * Zero server calls. No data leaves the browser.
 */

export type MarqueFormat = "v1" | "v2-jwt-vc";

export interface MarqueVerificationResult {
  valid: boolean;
  reason: string;
  format?: MarqueFormat;
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
 * Detect whether input is a JWT string (v2) or JSON object (v1).
 * JWT has exactly 3 base64url-encoded parts separated by dots.
 */
export function detectFormat(input: string): MarqueFormat {
  const trimmed = input.trim();
  const parts = trimmed.split(".");
  if (parts.length === 3 && parts.every((p) => p.length > 0)) {
    try {
      JSON.parse(base64UrlDecode(parts[0]));
      return "v2-jwt-vc";
    } catch {
      // Not valid base64url JSON header, fall through to v1
    }
  }
  return "v1";
}

/**
 * Verify a Marque document. Auto-detects format (v1 JSON or v2 JWT-VC).
 */
export async function verifyMarqueInBrowser(
  marqueInput: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  const format = detectFormat(marqueInput);
  if (format === "v2-jwt-vc") {
    return verifyJWTVC(marqueInput.trim(), publicKeyPem);
  }
  return verifyV1(marqueInput, publicKeyPem);
}

/**
 * v2 JWT-VC verification path.
 * Split JWT, decode header+payload, verify Ed25519 signature via Web Crypto.
 */
async function verifyJWTVC(
  jwt: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid JWT format: expected 3 dot-separated parts", format: "v2-jwt-vc" };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    let header: { alg?: string; typ?: string; kid?: string };
    try {
      header = JSON.parse(base64UrlDecode(headerB64));
    } catch {
      return { valid: false, reason: "Invalid JWT header: failed to decode", format: "v2-jwt-vc" };
    }

    if (header.alg !== "EdDSA") {
      return { valid: false, reason: `Unsupported algorithm: ${header.alg}. Expected EdDSA.`, format: "v2-jwt-vc" };
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
      return { valid: false, reason: "Invalid JWT payload: failed to decode", format: "v2-jwt-vc" };
    }

    if (!payload.vc) {
      return { valid: false, reason: "Invalid JWT-VC: missing 'vc' claim in payload", format: "v2-jwt-vc" };
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
      return { valid: false, reason: "Invalid public key format. Expected PEM-encoded Ed25519 SPKI key.", format: "v2-jwt-vc" };
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
      return { valid: false, reason: "JWT signature verification failed. The credential may have been tampered with.", format: "v2-jwt-vc" };
    }

    // Check expiry
    if (payload.exp) {
      const expiresAt = new Date(payload.exp * 1000);
      if (expiresAt < new Date()) {
        return {
          valid: false,
          reason: `Credential expired on ${expiresAt.toISOString()}`,
          format: "v2-jwt-vc",
          document: mapVCToDocument(payload),
          vcMetadata: extractVCMetadata(payload),
        };
      }
    }

    return {
      valid: true,
      reason: "JWT-VC signature valid. Credential integrity verified. Not expired.",
      format: "v2-jwt-vc",
      document: mapVCToDocument(payload),
      vcMetadata: extractVCMetadata(payload),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, reason: `JWT-VC verification error: ${message}`, format: "v2-jwt-vc" };
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

/**
 * Extract VC-specific metadata for display.
 */
function extractVCMetadata(payload: {
  iss?: string;
  vc?: {
    "@context"?: string[];
    type?: string[];
  };
  parley?: string;
}): MarqueVerificationResult["vcMetadata"] {
  return {
    context: payload.vc?.["@context"] ?? [],
    credentialType: payload.vc?.type ?? [],
    issuerDID: payload.iss ?? "",
    parleyVersion: payload.parley ?? "2.0",
  };
}

/**
 * v1 (legacy) verification — existing JSON envelope format.
 */
async function verifyV1(
  marqueJson: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  try {
    const marque = JSON.parse(marqueJson);

    // Validate structure
    if (!marque.signature || !marque.marque) {
      return { valid: false, reason: "Invalid Marque format: missing 'signature' or 'marque' field", format: "v1" };
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
      return { valid: false, reason: "Invalid public key format. Expected PEM-encoded Ed25519 SPKI key.", format: "v1" };
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
      return { valid: false, reason: "Signature verification failed. The document may have been tampered with.", format: "v1" };
    }

    // Check expiry
    const expiresAt = new Date(marque.marque.expiresAt);
    if (expiresAt < new Date()) {
      return {
        valid: false,
        reason: `Marque expired on ${expiresAt.toISOString()}`,
        format: "v1",
        document: marque.marque,
      };
    }

    return {
      valid: true,
      reason: "Signature valid. Document integrity verified. Not expired.",
      format: "v1",
      document: marque.marque,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, reason: `Verification error: ${message}`, format: "v1" };
  }
}

/** Sample Marque for the "Try it" button (v1 format) */
export const SAMPLE_MARQUE = JSON.stringify(
  {
    marque: {
      id: "mrq_2026-02-06_demo_abc123",
      version: "1.0.0",
      issuer: {
        name: "Security Engineering",
        organization: "Corsair Demo",
      },
      generatedAt: "2026-02-06T10:30:00Z",
      expiresAt: "2027-02-06T10:30:00Z",
      scope: {
        providers: ["aws-cognito"],
        frameworksCovered: ["NIST 800-53", "SOC2", "ISO 27001"],
        servicesAssessed: ["cognito:us-west-2_ABC123"],
      },
      summary: {
        controlsTested: 24,
        controlsPassed: 18,
        controlsFailed: 6,
        overallScore: 75,
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
  "This is a demo Marque (v1 format). The signature is not cryptographically valid — it demonstrates the verification UI. Real Marques are signed with Ed25519 keys generated by the Corsair CLI.";
