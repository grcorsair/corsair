/**
 * CPOE Verification Endpoint
 *
 * POST /verify — Free, public, no auth
 *
 * Accepts a JWT-VC CPOE and verifies:
 * 1. JWT structure and signature
 * 2. Expiration
 * 3. VC schema (W3C Verifiable Credential)
 * 4. CPOE fields (provenance, scope)
 *
 * Two verification modes:
 * - DID-based (default): Resolves issuer's did:web to fetch public key
 * - Trusted keys: Falls back to Corsair's own keys for Corsair-signed CPOEs
 *
 * This is the "Chrome padlock" — the adoption driver.
 */

import type { MarqueVerificationResult } from "../src/parley/marque-verifier";
import type { KeyManager } from "../src/parley/marque-key-manager";
import type { VerificationPolicy } from "../src/parley/verification-policy";

export interface VerifyRouterDeps {
  keyManager: KeyManager;
  extraTrustedKeys?: Buffer[];
}

const MAX_JWT_SIZE = 100_000; // 100KB

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
  const { keyManager, extraTrustedKeys } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return jsonError(405, "Method not allowed. Use POST.");
    }

    // Extract JWT from request body
    let rawCpoe: string;
    let policy: VerificationPolicy | undefined;
    let receipts: Array<import("../src/parley/process-receipt").ProcessReceipt> | undefined;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      let body: { cpoe?: string; policy?: VerificationPolicy; receipts?: unknown };
      try {
        body = await req.json();
      } catch {
        return jsonError(400, "Invalid JSON body");
      }

      if (!body.cpoe || typeof body.cpoe !== "string") {
        return jsonError(400, 'Missing required field: "cpoe" (JWT-VC string)');
      }
      rawCpoe = body.cpoe.trim();

      if (body.policy) {
        if (typeof body.policy !== "object") {
          return jsonError(400, "policy must be an object");
        }
        const candidate = body.policy as VerificationPolicy;
        if (candidate.requireIssuer && typeof candidate.requireIssuer !== "string") {
          return jsonError(400, "policy.requireIssuer must be a string");
        }
        if (candidate.requireFramework && !Array.isArray(candidate.requireFramework)) {
          return jsonError(400, "policy.requireFramework must be an array of strings");
        }
        if (Array.isArray(candidate.requireFramework) && candidate.requireFramework.some(f => typeof f !== "string")) {
          return jsonError(400, "policy.requireFramework must be an array of strings");
        }
        if (candidate.maxAgeDays !== undefined && typeof candidate.maxAgeDays !== "number") {
          return jsonError(400, "policy.maxAgeDays must be a number");
        }
        if (candidate.minScore !== undefined && typeof candidate.minScore !== "number") {
          return jsonError(400, "policy.minScore must be a number");
        }
        policy = candidate;
      }

      if (body.receipts !== undefined) {
        if (!Array.isArray(body.receipts)) {
          return jsonError(400, "receipts must be an array");
        }
        receipts = body.receipts as Array<import("../src/parley/process-receipt").ProcessReceipt>;
      }
    } else {
      // Accept raw JWT string
      rawCpoe = (await req.text()).trim();
    }

    if (!rawCpoe) {
      return jsonError(400, "Empty CPOE. Provide a JWT-VC string.");
    }

    // Reject oversized JWTs (typical CPOE is 2-5KB)
    if (Buffer.byteLength(rawCpoe) > MAX_JWT_SIZE) {
      return jsonError(400, `JWT exceeds maximum size (${MAX_JWT_SIZE} bytes)`);
    }

    // Support SD-JWT (JWT + disclosures)
    let jwtToVerify = rawCpoe;
    if (rawCpoe.includes("~")) {
      const { parseSDJWT } = await import("../src/parley/sd-jwt");
      const parsed = parseSDJWT(rawCpoe);
      jwtToVerify = parsed.jwt;
    }

    // Basic format check
    if (jwtToVerify.split(".").length !== 3) {
      return jsonError(400, "Invalid JWT format. Expected three base64url segments separated by dots.");
    }

    // Try DID-based verification first (zero-trust)
    const { verifyVCJWTViaDID } = await import("../src/parley/vc-verifier");
    let result: MarqueVerificationResult;

    try {
      result = await verifyVCJWTViaDID(jwtToVerify);
    } catch {
      // DID resolution failed — fall back to trusted keys
      result = await verifyWithTrustedKeys(jwtToVerify, keyManager, extraTrustedKeys);
    }

    // If DID verification failed, try trusted keys as fallback.
    // DID resolution may return wrong key (e.g., stale static DID doc) or fail entirely.
    if (!result.valid) {
      const trustedResult = await verifyWithTrustedKeys(jwtToVerify, keyManager, extraTrustedKeys);
      // Prefer the trusted-key result if it succeeds, or if it gives a more specific error
      if (trustedResult.valid || result.issuerTier === "unverifiable") {
        result = trustedResult;
      }
    }

    let payload: Record<string, unknown> | null = null;
    // Extract processProvenance + extensions from JWT payload
    let processProvenance: VerifyResponse["processProvenance"] = null;
    let extensions: VerifyResponse["extensions"] = null;
    try {
      const { decodeJwt } = await import("jose");
      payload = decodeJwt(jwtToVerify) as Record<string, unknown>;
      const vc = payload.vc as Record<string, unknown> | undefined;
      const cs = vc?.credentialSubject as Record<string, unknown> | undefined;
      const ext = cs?.extensions as Record<string, unknown> | undefined;
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
      if (ext) {
        extensions = ext;
      }
    } catch { /* decode-only, non-critical */ }

    let policyResult: { ok: boolean; errors: string[] } | null = null;
    if (policy) {
      if (!payload) {
        policyResult = { ok: false, errors: ["Policy checks require JWT-VC input"] };
      } else {
        const { evaluateVerificationPolicy } = await import("../src/parley/verification-policy");
        policyResult = evaluateVerificationPolicy(payload, policy);
      }
    }

    let processResult: VerifyResponse["process"] | null = null;
    if (receipts) {
      const { verifyProcessChain } = await import("../src/parley/receipt-verifier");
      const { resolveReceiptPublicKeyPem } = await import("../src/parley/receipt-key");
      const publicKeyPem = await resolveReceiptPublicKeyPem(jwtToVerify, keyManager, extraTrustedKeys);
      if (!publicKeyPem) {
        return jsonError(400, "Unable to verify receipts: no public key available");
      }
      const fullResult = verifyProcessChain(receipts, publicKeyPem);
      if (payload) {
        const cs = (payload.vc as Record<string, unknown> | undefined)?.credentialSubject as Record<string, unknown> | undefined;
        const chainDigest = cs?.processProvenance && (cs.processProvenance as { chainDigest?: string }).chainDigest;
        if (chainDigest && fullResult.chainDigest !== chainDigest) {
          fullResult.chainValid = false;
        }
      }
      processResult = {
        chainValid: fullResult.chainValid,
        receiptsVerified: fullResult.receiptsVerified,
        receiptsTotal: fullResult.receiptsTotal,
      };
    }

    // Build response
    const response: VerifyResponse = {
      verified: result.valid,
      issuer: result.signedBy || null,
      issuerTier: result.issuerTier || null,
      provenance: result.provenance || null,
      scope: result.scope || null,
      summary: result.summary || null,
      timestamps: {
        issuedAt: result.generatedAt || null,
        expiresAt: result.expiresAt || null,
      },
      processProvenance,
      policy: policyResult,
      process: processResult,
      extensions,
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
  extraTrustedKeys?: Buffer[],
): Promise<MarqueVerificationResult> {
  const { verifyVCJWT } = await import("../src/parley/vc-verifier");

  const trustedKeys: Buffer[] = [];
  if (extraTrustedKeys && extraTrustedKeys.length > 0) {
    trustedKeys.push(...extraTrustedKeys);
  }

  const keypair = await keyManager.loadKeypair();
  if (keypair) {
    trustedKeys.push(keypair.publicKey);
    const retired = await keyManager.getRetiredKeys();
    trustedKeys.push(...retired);
  }

  if (trustedKeys.length === 0) {
    return { valid: false, reason: "schema_invalid", issuerTier: "unverifiable" };
  }

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
  policy?: { ok: boolean; errors: string[] } | null;
  process?: { chainValid: boolean; receiptsVerified: number; receiptsTotal: number } | null;
  extensions?: Record<string, unknown> | null;
}
