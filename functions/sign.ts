/**
 * CPOE Sign Endpoint
 *
 * POST /sign — Authenticated, rate-limited
 *
 * Accepts raw tool output (any of 8 formats), calls signEvidence(),
 * returns signed CPOE + metadata.
 *
 * Follows the same router factory pattern as functions/verify.ts.
 */

import type { KeyManager } from "../src/parley/marque-key-manager";
import type { EvidenceFormat, SignOutput } from "../src/sign/sign-core";

// =============================================================================
// TYPES
// =============================================================================

export interface SignRouterDeps {
  keyManager: KeyManager;
  domain: string;
}

export interface SignRequest {
  /** Raw evidence (any of 8 supported formats) */
  evidence: unknown;

  /** Force a specific parser format */
  format?: EvidenceFormat;

  /** Issuer DID override */
  did?: string;

  /** Scope override */
  scope?: string;

  /** CPOE validity in days */
  expiryDays?: number;

  /** Dry-run: parse + classify but don't sign */
  dryRun?: boolean;
}

export interface SignResponse {
  cpoe: string;
  marqueId: string;
  detectedFormat: string;
  summary: SignOutput["summary"];
  provenance: SignOutput["provenance"];
  warnings: string[];
  expiresAt?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

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

// =============================================================================
// IDEMPOTENCY CACHE
// =============================================================================

const idempotencyCache = new Map<string, { response: SignResponse; expiresAt: number }>();

function cleanIdempotencyCache(): void {
  const now = Date.now();
  for (const [key, entry] of idempotencyCache) {
    if (entry.expiresAt < now) {
      idempotencyCache.delete(key);
    }
  }
}

// Clean every 5 minutes
setInterval(cleanIdempotencyCache, 5 * 60 * 1000);

// =============================================================================
// ROUTER
// =============================================================================

/**
 * Create the sign router.
 *
 * Accepts:
 *   { "evidence": {...}, "format?": "prowler", "did?": "did:web:...", ... }
 */
export function createSignRouter(
  deps: SignRouterDeps,
): (req: Request) => Promise<Response> {
  const { keyManager } = deps;

  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return jsonError(405, "Method not allowed. Use POST.");
    }

    // Parse request body
    let body: SignRequest;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    if (!body.evidence) {
      return jsonError(400, 'Missing required field: "evidence"');
    }

    // Check idempotency
    const idempotencyKey = req.headers.get("x-idempotency-key");
    if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        return jsonOk(cached.response);
      }
    }

    // Reject oversized evidence (500KB)
    const evidenceStr = typeof body.evidence === "string"
      ? body.evidence
      : JSON.stringify(body.evidence);
    if (evidenceStr.length > 500_000) {
      return jsonError(400, "Evidence exceeds maximum size (500KB)");
    }

    // Call sign engine
    const { signEvidence, SignError } = await import("../src/sign/sign-core");

    try {
      const result = await signEvidence({
        evidence: body.evidence,
        format: body.format,
        did: body.did,
        scope: body.scope,
        expiryDays: body.expiryDays,
        dryRun: body.dryRun,
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

      const response: SignResponse = {
        cpoe: result.jwt,
        marqueId: result.marqueId,
        detectedFormat: result.detectedFormat,
        summary: result.summary,
        provenance: result.provenance,
        warnings: result.warnings,
        ...(expiresAt ? { expiresAt } : {}),
      };

      // Cache for idempotency (1 hour TTL)
      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          response,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
      }

      return jsonOk(response, result.jwt ? 200 : 200);
    } catch (err) {
      const { SignError: SE } = await import("../src/sign/sign-core");
      if (err instanceof SE) {
        return jsonError(400, err.message);
      }
      console.error("Sign error:", err);
      return jsonError(500, "Internal server error during signing");
    }
  };
}
