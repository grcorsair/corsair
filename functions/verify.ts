/**
 * CPOE Verification Endpoint
 *
 * POST /verify — Free, public, no auth
 *
 * Accepts a JWT-VC CPOE and verifies:
 * 1. JWT structure and signature
 * 2. Expiration
 * 3. VC schema (W3C Verifiable Credential)
 * 4. CPOE fields (assurance, provenance, scope)
 *
 * Two verification modes:
 * - DID-based (default): Resolves issuer's did:web to fetch public key
 * - Trusted keys: Falls back to Corsair's own keys for Corsair-signed CPOEs
 *
 * This is the "Chrome padlock" — the adoption driver.
 */

import type { MarqueVerificationResult } from "../src/parley/marque-verifier";
import type { KeyManager } from "../src/parley/marque-key-manager";

export interface VerifyRouterDeps {
  keyManager: KeyManager;
}

function jsonError(status: number, message: string): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    },
  );
}

function jsonOk(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

/**
 * Create the verify router.
 *
 * Accepts:
 *   { "cpoe": "eyJ..." }   — JWT-VC string in JSON body
 *   Raw JWT string body     — Content-Type: text/plain
 */
export function createVerifyRouter(
  deps: VerifyRouterDeps,
): (req: Request) => Promise<Response> {
  const { keyManager } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return jsonError(405, "Method not allowed. Use POST.");
    }

    // Extract JWT from request body
    let jwt: string;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      let body: { cpoe?: string };
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body");
      }

      if (!body.cpoe || typeof body.cpoe !== "string") {
        return jsonError(400, 'Missing required field: "cpoe" (JWT-VC string)');
      }
      jwt = body.cpoe.trim();
    } else {
      // Accept raw JWT string
      jwt = (await req.text()).trim();
    }

    if (!jwt) {
      return jsonError(400, "Empty CPOE. Provide a JWT-VC string.");
    }

    // Basic format check
    if (jwt.split(".").length !== 3) {
      return jsonError(400, "Invalid JWT format. Expected three base64url segments separated by dots.");
    }

    // Try DID-based verification first (zero-trust)
    const { verifyVCJWTViaDID } = await import("../src/parley/vc-verifier");
    let result: MarqueVerificationResult;

    try {
      result = await verifyVCJWTViaDID(jwt);
    } catch {
      // DID resolution failed — fall back to trusted keys
      result = await verifyWithTrustedKeys(jwt, keyManager);
    }

    // If DID verification failed, try trusted keys as fallback.
    // DID resolution may return wrong key (e.g., stale static DID doc) or fail entirely.
    if (!result.valid) {
      const trustedResult = await verifyWithTrustedKeys(jwt, keyManager);
      // Prefer the trusted-key result if it succeeds, or if it gives a more specific error
      if (trustedResult.valid || result.issuerTier === "unverifiable") {
        result = trustedResult;
      }
    }

    // Extract processProvenance from JWT payload
    let processProvenance: VerifyResponse["processProvenance"] = null;
    try {
      const { decodeJwt } = await import("jose");
      const payload = decodeJwt(jwt) as Record<string, unknown>;
      const vc = payload.vc as Record<string, unknown> | undefined;
      const cs = vc?.credentialSubject as Record<string, unknown> | undefined;
      const pp = cs?.processProvenance as {
        chainDigest: string; receiptCount: number; chainVerified: boolean;
        reproducibleSteps: number; attestedSteps: number;
      } | undefined;
      if (pp) {
        processProvenance = {
          chainDigest: pp.chainDigest,
          receiptCount: pp.receiptCount,
          chainVerified: pp.chainVerified,
          reproducibleSteps: pp.reproducibleSteps,
          attestedSteps: pp.attestedSteps,
        };
      }
    } catch { /* decode-only, non-critical */ }

    // Build response
    const response: VerifyResponse = {
      verified: result.valid,
      issuer: result.signedBy || null,
      issuerTier: result.issuerTier || null,
      assurance: result.assuranceLevel !== undefined
        ? { level: result.assuranceLevel, name: result.assuranceName || null }
        : null,
      provenance: result.provenance || null,
      scope: result.scope || null,
      summary: result.summary || null,
      timestamps: {
        issuedAt: result.generatedAt || null,
        expiresAt: result.expiresAt || null,
      },
      processProvenance,
    };

    if (!result.valid) {
      (response as Record<string, unknown>).reason = result.reason;
    }

    return jsonOk(response);
  };
}

/** Verify against Corsair's trusted keys (active + retired) */
async function verifyWithTrustedKeys(
  jwt: string,
  keyManager: KeyManager,
): Promise<MarqueVerificationResult> {
  const { verifyVCJWT } = await import("../src/parley/vc-verifier");

  const keypair = await keyManager.loadKeypair();
  if (!keypair) {
    return { valid: false, reason: "schema_invalid", issuerTier: "unverifiable" };
  }

  const trustedKeys = [keypair.publicKey];
  const retired = await keyManager.getRetiredKeys();
  trustedKeys.push(...retired);

  return verifyVCJWT(jwt, trustedKeys);
}

// =============================================================================
// RESPONSE TYPE
// =============================================================================

export interface VerifyResponse {
  verified: boolean;
  reason?: string;
  issuer: string | null;
  issuerTier: string | null;
  assurance: { level: number; name: string | null } | null;
  provenance: { source: string; sourceIdentity?: string; sourceDate?: string } | null;
  scope: string | null;
  summary: { controlsTested: number; controlsPassed: number; controlsFailed: number; overallScore: number } | null;
  timestamps: { issuedAt: string | null; expiresAt: string | null };
  processProvenance?: {
    chainDigest: string;
    receiptCount: number;
    chainVerified: boolean;
    reproducibleSteps: number;
    attestedSteps: number;
  } | null;
}
