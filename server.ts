#!/usr/bin/env bun
/**
 * Corsair API Server — DigiCert-Model Parley Infrastructure
 *
 * Unified Bun HTTP server combining all endpoints:
 *
 * PRODUCT LAYER (customer-facing):
 *   POST /verify                        — Free CPOE verification (adoption driver)
 *   POST /issue                         — CPOE issuance (revenue)
 *
 * TRUST ANCHORS:
 *   GET /.well-known/did.json           — DID Document (Ed25519 public key)
 *   GET /.well-known/jwks.json          — JWKS (key discovery)
 *   GET /.well-known/ssf-configuration  — SSF transmitter metadata
 *
 * INFRASTRUCTURE LAYER (protocol):
 *   POST /scitt/entries                 — SCITT registration
 *   GET  /scitt/entries/:id             — SCITT entry metadata
 *   GET  /scitt/entries/:id/receipt     — COSE receipt
 *   POST /ssf/streams                   — SSF stream CRUD
 *   GET/PATCH/DELETE /ssf/streams/:id   — SSF stream management
 *
 * OPS:
 *   GET /health                         — Health check (with DB ping)
 *
 * All routes also available under /v1/ prefix (e.g. /v1/verify).
 * Runs migrations on startup (idempotent).
 * Reads DATABASE_URL, KEY_ENCRYPTION_SECRET, CORSAIR_DOMAIN from env.
 */

import { createHealthHandler } from "./functions/health";
import { createSSFConfigHandler } from "./functions/ssf-configuration";
import { createSSFStreamRouter } from "./functions/ssf-stream";
import { createSCITTRouter } from "./functions/scitt-register";
import { createVerifyRouter } from "./functions/verify";
import { createDIDJsonHandler } from "./functions/did-json";
import { createJWKSJsonHandler } from "./functions/jwks-json";
import { createIssueRouter } from "./functions/issue";
import { requireAuth } from "./src/middleware/auth";
import { rateLimit } from "./src/middleware/rate-limit";
import { withSecurityHeaders } from "./src/middleware/security-headers";
import { getDb, closeDb } from "./src/db/connection";
import { migrate } from "./src/db/migrate";
import { PgSSFStreamManager } from "./src/flagship/pg-ssf-stream";
import { PgSCITTRegistry } from "./src/parley/pg-scitt-registry";
import { PgKeyManager } from "./src/parley/pg-key-manager";
import { processDeliveryQueue } from "./functions/ssf-delivery-worker";

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(Bun.env.PORT || "3000");
const DOMAIN = Bun.env.CORSAIR_DOMAIN || "grcorsair.com";
const ALLOWED_ORIGINS = (Bun.env.CORSAIR_ALLOWED_ORIGINS || `https://${DOMAIN}`)
  .split(",")
  .map((o: string) => o.trim())
  .filter((o: string) => o.length > 0);

// =============================================================================
// DATABASE + MIGRATIONS
// =============================================================================

console.log("Corsair API starting...");
console.log(`  Domain: ${DOMAIN}`);
console.log(`  Port:   ${PORT}`);

const db = getDb();
// TODO: Add DB connection retry logic for transient startup failures

const migrationResult = await migrate(db);
if (migrationResult.applied > 0) {
  console.log(`  Migrations: Applied ${migrationResult.applied} (${migrationResult.files.join(", ")})`);
} else {
  console.log(`  Migrations: Up to date (${migrationResult.total} total)`);
}

// =============================================================================
// DEPENDENCY WIRING
// =============================================================================

// Key manager (AES-256-GCM encrypted keys in Postgres)
const keySecretHex = (Bun.env.KEY_ENCRYPTION_SECRET || "").trim();
if (!keySecretHex) {
  console.error("ERROR: KEY_ENCRYPTION_SECRET is required (64 hex chars = 32 bytes)");
  console.error("Generate with: bun -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}
if (!/^[0-9a-fA-F]{64}$/.test(keySecretHex)) {
  console.error(`ERROR: KEY_ENCRYPTION_SECRET must be exactly 64 hex characters (got ${keySecretHex.length} chars)`);
  console.error("Generate with: bun -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}
const keySecret = Buffer.from(keySecretHex, "hex");
const keyManager = new PgKeyManager(db as any, keySecret);

// Ensure a signing key exists
const existingKeypair = await keyManager.loadKeypair();
if (!existingKeypair) {
  console.log("  Keys: Generating initial Ed25519 keypair...");
  await keyManager.generateKeypair();
  console.log("  Keys: Generated and stored (AES-256-GCM encrypted)");
} else {
  console.log("  Keys: Active keypair loaded");
}

// Load private key PEM for SCITT signing
const keypair = (await keyManager.loadKeypair())!;
const signingKeyPem = keypair.privateKey.toString();

// SSF stream manager
const streamManager = new PgSSFStreamManager(db as any);

// SCITT registry
const registry = new PgSCITTRegistry(db as any, signingKeyPem);

// API key validation (#4 — fail hard in production if no keys)
const configuredApiKeys = (Bun.env.CORSAIR_API_KEYS || "").split(",").filter((k: string) => k.trim());
if (configuredApiKeys.length === 0) {
  if (Bun.env.RAILWAY_ENVIRONMENT === "production") {
    console.error("ERROR: CORSAIR_API_KEYS required in production");
    process.exit(1);
  }
  console.warn("  WARNING: No CORSAIR_API_KEYS set — protected endpoints will reject all requests");
}

// =============================================================================
// CORS HELPER
// =============================================================================

/** Public endpoints return *, protected endpoints check against allowed origins */
function getCorsOrigin(req: Request, isPublic: boolean): string | null {
  if (isPublic) return "*";
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

// =============================================================================
// ROUTERS (with rate limiting)
// =============================================================================

// Public routers (rate-limited, no auth)
const verifyRouter = rateLimit(100)(createVerifyRouter({ keyManager }));
const healthHandler = createHealthHandler({ db });
const didJsonHandler = createDIDJsonHandler({ keyManager, domain: DOMAIN });
const jwksJsonHandler = createJWKSJsonHandler({ keyManager, domain: DOMAIN });
const ssfConfigHandler = createSSFConfigHandler(DOMAIN);

// Protected routers (require API key + rate-limited)
const issueRouter = requireAuth(rateLimit(10)(createIssueRouter({ keyManager, domain: DOMAIN })));
const ssfRouter = requireAuth(rateLimit(30)(createSSFStreamRouter({ streamManager })));
const scittRouter = requireAuth(rateLimit(30)(createSCITTRouter({ registry })));

// =============================================================================
// SERVER
// =============================================================================

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: 10 * 1024 * 1024, // 10MB (#2)

  fetch: withSecurityHeaders(async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      // Determine if the path is public or protected for CORS
      const isPublic = path === "/verify" || path === "/v1/verify" ||
        path.startsWith("/.well-known/") || path === "/health";
      const corsOrigin = getCorsOrigin(req, isPublic);
      const headers: Record<string, string> = {
        "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "access-control-allow-headers": "Content-Type, Authorization",
        "access-control-max-age": "86400",
      };
      if (corsOrigin) headers["access-control-allow-origin"] = corsOrigin;
      return new Response(null, { status: 204, headers });
    }

    // =========================================================================
    // PRODUCT LAYER
    // =========================================================================

    // POST /verify — Free CPOE verification
    if (path === "/verify" || path === "/v1/verify") {
      return verifyRouter(req);
    }

    // POST /issue — CPOE issuance
    if (path === "/issue" || path === "/v1/issue") {
      return issueRouter(req);
    }

    // =========================================================================
    // TRUST ANCHORS
    // =========================================================================

    // GET /.well-known/did.json
    if (path === "/.well-known/did.json") {
      return didJsonHandler(req);
    }

    // GET /.well-known/jwks.json
    if (path === "/.well-known/jwks.json") {
      return jwksJsonHandler(req);
    }

    // GET /.well-known/ssf-configuration
    if (path === "/.well-known/ssf-configuration") {
      return ssfConfigHandler(req);
    }

    // =========================================================================
    // INFRASTRUCTURE LAYER
    // =========================================================================

    // SSF streams
    if (path.startsWith("/ssf/streams") || path.startsWith("/v1/ssf/streams")) {
      return ssfRouter(req);
    }

    // SCITT
    if (path.startsWith("/scitt/entries") || path.startsWith("/v1/scitt/entries")) {
      return scittRouter(req);
    }

    // =========================================================================
    // OPS
    // =========================================================================

    // TODO: Add /metrics endpoint for Prometheus-compatible observability

    if (path === "/health") {
      return healthHandler(req);
    }

    // =========================================================================
    // 404
    // =========================================================================

    return Response.json(
      {
        error: "Not found",
        endpoints: {
          product: ["POST /verify", "POST /issue"],
          trust: ["GET /.well-known/did.json", "GET /.well-known/jwks.json"],
          infrastructure: ["POST /scitt/entries", "POST /ssf/streams"],
          ops: ["GET /health"],
        },
      },
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }),
});

// =============================================================================
// GRACEFUL SHUTDOWN (#3)
// =============================================================================

function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  server.stop();
  closeDb();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// =============================================================================
// SSF DELIVERY WORKER (opt-in) (#15)
// =============================================================================

if (Bun.env.ENABLE_DELIVERY_WORKER === "true") {
  const interval = parseInt(Bun.env.DELIVERY_WORKER_INTERVAL || "30000");

  // Build worker deps from existing services
  const workerDeps = {
    fetchPendingEvents: async () => {
      const rows = await (db as any)`
        SELECT id, stream_id, set_token, jti, status, attempts, max_attempts, next_retry
        FROM ssf_event_queue
        WHERE status = 'pending' AND (next_retry IS NULL OR next_retry <= NOW())
        ORDER BY id ASC LIMIT 100
      `;
      return rows as any[];
    },
    getStreamConfig: async (streamId: string) => {
      const rows = await (db as any)`
        SELECT config FROM ssf_streams WHERE stream_id = ${streamId} AND status = 'active'
      `;
      if (rows.length === 0) return null;
      const config = typeof rows[0].config === "string" ? JSON.parse(rows[0].config) : rows[0].config;
      return config?.delivery?.endpoint_url ? { endpoint_url: config.delivery.endpoint_url } : null;
    },
    updateEvent: async (update: { id: number; status: string; attempts: number; next_retry?: string; delivered_at?: string }) => {
      await (db as any)`
        UPDATE ssf_event_queue
        SET status = ${update.status}, attempts = ${update.attempts},
            next_retry = ${update.next_retry || null}, delivered_at = ${update.delivered_at || null}
        WHERE id = ${update.id}
      `;
    },
    pushEvent: async (endpoint: string, setToken: string) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/secevent+jwt" },
        body: setToken,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Push failed: HTTP ${res.status}`);
      return { delivered: true };
    },
  };

  setInterval(async () => {
    try {
      const result = await processDeliveryQueue(workerDeps);
      if (result.processed > 0) {
        console.log(`Delivery worker: ${result.delivered}/${result.processed} delivered`);
      }
    } catch (err) {
      console.error("Delivery worker error:", err);
    }
  }, interval);
  console.log(`  Delivery worker: Enabled (${interval / 1000}s interval)`);
}

// =============================================================================
// STARTUP BANNER
// =============================================================================

console.log(`\nCorsair API running on :${PORT}`);
console.log(`  Verify:  POST http://localhost:${PORT}/verify`);
console.log(`  Issue:   POST http://localhost:${PORT}/issue`);
console.log(`  DID:     GET  http://localhost:${PORT}/.well-known/did.json`);
console.log(`  JWKS:    GET  http://localhost:${PORT}/.well-known/jwks.json`);
console.log(`  SCITT:   POST http://localhost:${PORT}/scitt/entries`);
console.log(`  SSF:     POST http://localhost:${PORT}/ssf/streams`);
console.log(`  Health:  GET  http://localhost:${PORT}/health`);
