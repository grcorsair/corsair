/**
 * CPOE Sign Endpoint
 *
 * POST /sign — Authenticated, rate-limited
 *
 * Accepts raw tool output (mapping packs or generic), calls signEvidence(),
 * returns signed CPOE + metadata.
 *
 * Follows the same router factory pattern as functions/verify.ts.
 */

import { createHash } from "crypto";
import type { KeyManager } from "../src/parley/marque-key-manager";
import type { EvidenceFormat, SignOutput } from "../src/sign/sign-core";

// =============================================================================
// TYPES
// =============================================================================

export interface SignRouterDeps {
  keyManager: KeyManager;
  domain: string;
  db?: SignIdempotencyDb;
}

export interface SignRequest {
  /** Raw evidence (mapping packs or generic JSON) */
  evidence: unknown;

  /** Force generic parsing (bypass mapping packs) */
  format?: EvidenceFormat;

  /** Issuer DID override */
  did?: string;

  /** Scope override (required if evidence.metadata.scope is missing) */
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
  extensions?: Record<string, unknown>;
  expiresAt?: string;
  demo?: boolean;
}

const MAX_JWT_SIZE = 100_000; // 100KB

// =============================================================================
// HELPERS
// =============================================================================

type SignIdempotencyDb = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

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

function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function computeIdempotencyHash(
  evidenceHash: string,
  body: SignRequest,
): string {
  const payload = {
    evidenceHash,
    format: body.format || null,
    did: body.did || null,
    scope: body.scope || null,
    expiryDays: body.expiryDays || null,
    dryRun: body.dryRun === true,
  };
  return hashString(JSON.stringify(payload));
}

function extractScopeFromEvidence(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const metadata = (evidence as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const scope = (metadata as { scope?: unknown }).scope;
  if (typeof scope !== "string") return null;
  const trimmed = scope.trim();
  return trimmed ? trimmed : null;
}

// =============================================================================
// ROUTER
// =============================================================================

/**
 * Create the sign router.
 *
 * Accepts:
 *   { "evidence": {...}, "format?": "generic", "did?": "did:web:...", ... }
 */
export function createSignRouter(
  deps: SignRouterDeps,
): (req: Request) => Promise<Response> {
  const { keyManager, db, domain } = deps;

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

    const evidenceStr = typeof body.evidence === "string"
      ? body.evidence
      : JSON.stringify(body.evidence);
    const evidenceHash = hashString(evidenceStr);

    const scopeOverride = typeof body.scope === "string" ? body.scope.trim() : "";
    let evidenceScope: string | null = null;
    if (!scopeOverride) {
      if (typeof body.evidence === "string") {
        try {
          evidenceScope = extractScopeFromEvidence(JSON.parse(body.evidence));
        } catch {
          evidenceScope = null;
        }
      } else {
        evidenceScope = extractScopeFromEvidence(body.evidence);
      }
    }
    if (!scopeOverride && !evidenceScope) {
      return jsonError(400, 'Missing required scope. Provide "scope" or "evidence.metadata.scope".');
    }

    const effectiveDid = body.did || `did:web:${domain}`;

    // Check idempotency
    const idempotencyKey = req.headers.get("x-idempotency-key");
    const requestHash = idempotencyKey ? computeIdempotencyHash(evidenceHash, body) : null;
    if (idempotencyKey && db) {
      try {
        const inserted = await db`
          INSERT INTO idempotency_keys (key, route, request_hash, expires_at)
          VALUES (${idempotencyKey}, ${"/sign"}, ${requestHash}, NOW() + INTERVAL '1 hour')
          ON CONFLICT (key) DO NOTHING
          RETURNING key
        `;

        if ((inserted as Array<{ key: string }>).length === 0) {
          const rows = await db`
            SELECT request_hash, status, response, expires_at
            FROM idempotency_keys
            WHERE key = ${idempotencyKey}
          `;
          const existing = (rows as Array<{ request_hash: string; status: number | null; response: unknown | null; expires_at: string }>)[0];
          if (existing) {
            if (existing.request_hash !== requestHash) {
              return jsonError(409, "Idempotency key reuse with different payload");
            }
            if (existing.response) {
              const cached = typeof existing.response === "string"
                ? JSON.parse(existing.response)
                : existing.response;
              return jsonOk(cached, existing.status || 200);
            }
            return jsonError(202, "Request in progress. Retry shortly.");
          }
        }
      } catch {
        // Fail open: fall back to in-memory cache
        const cached = idempotencyCache.get(idempotencyKey);
        if (cached && cached.expiresAt > Date.now()) {
          return jsonOk(cached.response);
        }
      }
    } else if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiresAt > Date.now()) {
        return jsonOk(cached.response);
      }
    }

    // Reject oversized evidence (500KB)
    if (evidenceStr.length > 500_000) {
      return jsonError(400, "Evidence exceeds maximum size (500KB)");
    }

    if (body.format && body.format !== "generic") {
      return jsonError(400, `Unsupported format: ${body.format}. Only "generic" is allowed.`);
    }

    // Call sign engine
    const { signEvidence, SignError } = await import("../src/sign/sign-core");

    try {
      const result = await signEvidence({
        evidence: body.evidence,
        format: body.format,
        did: effectiveDid,
        scope: scopeOverride || undefined,
        expiryDays: body.expiryDays,
        dryRun: body.dryRun,
      }, keyManager);

      if (result.jwt && Buffer.byteLength(result.jwt) > MAX_JWT_SIZE) {
        const message = `CPOE exceeds maximum size (${MAX_JWT_SIZE} bytes). Reduce evidence or extensions.`;
        if (idempotencyKey && db && requestHash) {
          try {
            await db`
              UPDATE idempotency_keys
              SET status = ${400}, response = ${JSON.stringify({ error: message })}
              WHERE key = ${idempotencyKey} AND request_hash = ${requestHash}
            `;
          } catch { /* ignore */ }
        }
        return jsonError(400, message);
      }

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
        extensions: result.extensions,
        ...(expiresAt ? { expiresAt } : {}),
      };

      // Cache for idempotency (1 hour TTL)
      if (idempotencyKey && db && requestHash) {
        try {
          await db`
            UPDATE idempotency_keys
            SET status = ${200}, response = ${JSON.stringify(response)}
            WHERE key = ${idempotencyKey} AND request_hash = ${requestHash}
          `;
        } catch {
          // Fall back to in-memory cache
          idempotencyCache.set(idempotencyKey, {
            response,
            expiresAt: Date.now() + 60 * 60 * 1000,
          });
        }
      } else if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          response,
          expiresAt: Date.now() + 60 * 60 * 1000,
        });
      }

      return jsonOk(response, result.jwt ? 200 : 200);
    } catch (err) {
      const { SignError: SE } = await import("../src/sign/sign-core");
      if (idempotencyKey && db && requestHash) {
        const errorPayload = { error: err instanceof Error ? err.message : "Internal error" };
        try {
          await db`
            UPDATE idempotency_keys
            SET status = ${err instanceof SE ? 400 : 500}, response = ${JSON.stringify(errorPayload)}
            WHERE key = ${idempotencyKey} AND request_hash = ${requestHash}
          `;
        } catch { /* ignore */ }
      }
      if (err instanceof SE) {
        return jsonError(400, err.message);
      }
      console.error("Sign error:", err);
      return jsonError(500, "Internal server error during signing");
    }
  };
}
