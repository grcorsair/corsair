/**
 * V1 API Router — Versioned /v1/ Platform API
 *
 * Stripe-style API conventions:
 *   - Consistent JSON envelope: { ok, data?, error? }
 *   - X-Request-Id on every response
 *   - X-Corsair-Version on every response
 *   - CORS headers on all responses
 *   - OPTIONS preflight handling
 *
 * Routes:
 *   GET  /v1/health  — Health check
 *   POST /v1/sign    — Sign evidence as CPOE
 *   POST /v1/verify  — Verify a CPOE
 */

import type { KeyManager } from "../parley/marque-key-manager";
import type { APIEnvelope, APIErrorCode, V1VerifyResponse, V1HealthResponse } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface V1RouterDeps {
  keyManager: KeyManager;
  domain: string;
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

const CORSAIR_VERSION = "0.5.0";

function makeHeaders(requestId: string): Headers {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("access-control-allow-origin", "*");
  headers.set("x-request-id", requestId);
  headers.set("x-corsair-version", CORSAIR_VERSION);
  return headers;
}

function corsPreflightHeaders(requestId: string): Headers {
  const headers = makeHeaders(requestId);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type, Authorization, X-Request-Id, X-Idempotency-Key");
  headers.set("access-control-max-age", "86400");
  return headers;
}

function envelopeOk<T>(data: T, requestId: string, status = 200): Response {
  const body: APIEnvelope<T> = { ok: true, data };
  return new Response(JSON.stringify(body), { status, headers: makeHeaders(requestId) });
}

function envelopeError(code: APIErrorCode, message: string, requestId: string, status: number): Response {
  const body: APIEnvelope = { ok: false, error: { code, message } };
  return new Response(JSON.stringify(body), { status, headers: makeHeaders(requestId) });
}

function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") || crypto.randomUUID();
}

// =============================================================================
// HEALTH HANDLER
// =============================================================================

function handleHealth(requestId: string): Response {
  const data: V1HealthResponse = {
    status: "ok",
    version: CORSAIR_VERSION,
    timestamp: new Date().toISOString(),
  };
  return envelopeOk(data, requestId);
}

// =============================================================================
// VERIFY HANDLER (exported for standalone use)
// =============================================================================

export function createV1VerifyHandler(deps: { keyManager: KeyManager }): (req: Request) => Promise<Response> {
  const { keyManager } = deps;

  return async (req: Request): Promise<Response> => {
    const requestId = getRequestId(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsPreflightHeaders(requestId) });
    }

    if (req.method !== "POST") {
      return envelopeError("method_not_allowed", "Method not allowed. Use POST.", requestId, 405);
    }

    // Extract JWT from request body
    let jwt: string;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return envelopeError("bad_request", "Invalid JSON body", requestId, 400);
      }

      if (!body.cpoe || typeof body.cpoe !== "string") {
        return envelopeError("validation_error", 'Missing required field: "cpoe" (JWT-VC string)', requestId, 400);
      }
      jwt = (body.cpoe as string).trim();
    } else {
      // Accept raw JWT string
      jwt = (await req.text()).trim();
    }

    if (!jwt) {
      return envelopeError("validation_error", "Empty CPOE. Provide a JWT-VC string.", requestId, 400);
    }

    // Reject oversized JWTs (typical CPOE is 2-5KB)
    if (jwt.length > 20_000) {
      return envelopeError("payload_too_large", "JWT exceeds maximum size (20KB)", requestId, 400);
    }

    // Basic format check
    if (jwt.split(".").length !== 3) {
      return envelopeError("validation_error", "Invalid JWT format. Expected three base64url segments separated by dots.", requestId, 400);
    }

    // Run verification
    const { verifyVCJWTViaDID } = await import("../parley/vc-verifier");
    let result: import("../parley/marque-verifier").MarqueVerificationResult;

    try {
      result = await verifyVCJWTViaDID(jwt);
    } catch {
      result = await verifyWithTrustedKeys(jwt, keyManager);
    }

    // If DID verification failed, try trusted keys as fallback
    if (!result.valid) {
      const trustedResult = await verifyWithTrustedKeys(jwt, keyManager);
      if (trustedResult.valid || result.issuerTier === "unverifiable") {
        result = trustedResult;
      }
    }

    // Extract processProvenance + extensions from JWT payload
    let processProvenance: V1VerifyResponse["processProvenance"] = null;
    let extensions: V1VerifyResponse["extensions"] = null;
    try {
      const { decodeJwt } = await import("jose");
      const payload = decodeJwt(jwt) as Record<string, unknown>;
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

    // Build response
    const data: V1VerifyResponse = {
      valid: result.valid,
      issuer: result.signedBy || null,
      trustTier: result.issuerTier || null,
      scope: result.scope || null,
      summary: result.summary || null,
      provenance: result.provenance || null,
      timestamps: {
        issuedAt: result.generatedAt || null,
        expiresAt: result.expiresAt || null,
      },
      processProvenance,
      extensions,
    };

    if (!result.valid) {
      data.reason = result.reason;
    }

    return envelopeOk(data, requestId);
  };
}

/** Verify against Corsair's trusted keys (active + retired) */
async function verifyWithTrustedKeys(
  jwt: string,
  keyManager: KeyManager,
): Promise<import("../parley/marque-verifier").MarqueVerificationResult> {
  const { verifyVCJWT } = await import("../parley/vc-verifier");

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
// SIGN HANDLER
// =============================================================================

function createV1SignHandler(deps: V1RouterDeps): (req: Request) => Promise<Response> {
  const { keyManager } = deps;

  return async (req: Request): Promise<Response> => {
    const requestId = getRequestId(req);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsPreflightHeaders(requestId) });
    }

    if (req.method !== "POST") {
      return envelopeError("method_not_allowed", "Method not allowed. Use POST.", requestId, 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return envelopeError("bad_request", "Invalid JSON body", requestId, 400);
    }

    if (!body.evidence) {
      return envelopeError("validation_error", 'Missing required field: "evidence"', requestId, 400);
    }

    // Reject oversized evidence (500KB)
    const evidenceStr = typeof body.evidence === "string"
      ? body.evidence
      : JSON.stringify(body.evidence);
    if (evidenceStr.length > 500_000) {
      return envelopeError("payload_too_large", "Evidence exceeds maximum size (500KB)", requestId, 400);
    }

    const { signEvidence, SignError } = await import("../sign/sign-core");

    try {
      const result = await signEvidence({
        evidence: body.evidence,
        format: body.format as import("../sign/sign-core").EvidenceFormat | undefined,
        did: body.did as string | undefined,
        scope: body.scope as string | undefined,
        expiryDays: body.expiryDays as number | undefined,
        dryRun: body.dryRun as boolean | undefined,
      }, keyManager);

      // Compute expiry from JWT
      let expiresAt: string | undefined;
      if (result.jwt) {
        try {
          const parts = result.jwt.split(".");
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
          if (payload.exp) {
            expiresAt = new Date(payload.exp * 1000).toISOString();
          }
        } catch { /* non-critical */ }
      }

      const data = {
        cpoe: result.jwt,
        marqueId: result.marqueId,
        detectedFormat: result.detectedFormat,
        summary: result.summary,
        provenance: result.provenance,
        warnings: result.warnings,
        extensions: result.extensions,
        ...(expiresAt ? { expiresAt } : {}),
      };

      return envelopeOk(data, requestId);
    } catch (err) {
      if (err instanceof SignError) {
        return envelopeError("bad_request", err.message, requestId, 400);
      }
      console.error("Sign error:", err);
      return envelopeError("internal_error", "Internal server error during signing", requestId, 500);
    }
  };
}

// =============================================================================
// ROUTER
// =============================================================================

/**
 * Create the versioned /v1/ API router.
 *
 * Dispatches:
 *   GET  /v1/health  → health check
 *   POST /v1/sign    → sign evidence
 *   POST /v1/verify  → verify CPOE
 *   *    /v1/*       → 404
 */
export function createV1Router(deps: V1RouterDeps): (req: Request) => Promise<Response> {
  const verifyHandler = createV1VerifyHandler({ keyManager: deps.keyManager });
  const signHandler = createV1SignHandler(deps);

  return async (req: Request): Promise<Response> => {
    const requestId = getRequestId(req);
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight for any /v1/ path
    if (req.method === "OPTIONS" && path.startsWith("/v1/")) {
      return new Response(null, { status: 204, headers: corsPreflightHeaders(requestId) });
    }

    // Must be under /v1/
    if (!path.startsWith("/v1/")) {
      return envelopeError("not_found", `Route not found: ${path}`, requestId, 404);
    }

    // Strip /v1 prefix for matching
    const route = path.slice(3); // "/v1/health" → "/health"

    switch (route) {
      case "/health":
        return handleHealth(requestId);
      case "/verify":
        return verifyHandler(req);
      case "/sign":
        return signHandler(req);
      default:
        return envelopeError("not_found", `Route not found: ${path}`, requestId, 404);
    }
  };
}
