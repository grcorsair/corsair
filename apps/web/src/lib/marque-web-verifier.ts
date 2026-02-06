/**
 * Marque Verifier — Client-side Ed25519 verification via Web Crypto API.
 * Zero server calls. No data leaves the browser.
 */

export interface MarqueVerificationResult {
  valid: boolean;
  reason: string;
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
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

function pemToBuffer(pem: string): ArrayBuffer {
  const lines = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
  return base64ToBuffer(lines);
}

export async function verifyMarqueInBrowser(
  marqueJson: string,
  publicKeyPem: string
): Promise<MarqueVerificationResult> {
  try {
    const marque = JSON.parse(marqueJson);

    // Validate structure
    if (!marque.signature || !marque.marque) {
      return { valid: false, reason: "Invalid Marque format: missing 'signature' or 'marque' field" };
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
      return { valid: false, reason: "Invalid public key format. Expected PEM-encoded Ed25519 SPKI key." };
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
      return { valid: false, reason: "Signature verification failed. The document may have been tampered with." };
    }

    // Check expiry
    const expiresAt = new Date(marque.marque.expiresAt);
    if (expiresAt < new Date()) {
      return {
        valid: false,
        reason: `Marque expired on ${expiresAt.toISOString()}`,
        document: marque.marque,
      };
    }

    return {
      valid: true,
      reason: "Signature valid. Document integrity verified. Not expired.",
      document: marque.marque,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, reason: `Verification error: ${message}` };
  }
}

/** Sample Marque for the "Try it" button */
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
  "This is a demo Marque. The signature is not cryptographically valid — it demonstrates the verification UI. Real Marques are signed with Ed25519 keys generated by the Corsair CLI.";
