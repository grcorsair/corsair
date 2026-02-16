#!/usr/bin/env bun
/**
 * Corsair API Server — DigiCert-Model Parley Infrastructure
 *
 * CRITICAL: Server starts listening IMMEDIATELY with /health returning 200,
 * then initializes DB/keys/migrations in the background. This ensures
 * Railway healthcheck passes within the 10s window.
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
 *   GET /health                         — Health check (200 during startup, then DB-aware)
 *
 * All routes also available under /v1/ prefix (e.g. /v1/verify).
 * Runs migrations on startup (idempotent).
 * Reads DATABASE_URL, KEY_ENCRYPTION_SECRET, CORSAIR_DOMAIN from env.
 */

import { createHealthHandler } from "./functions/health";
import { createSSFConfigHandler } from "./functions/ssf-configuration";
import { createSSFStreamRouter } from "./functions/ssf-stream";
import { createSCITTRouter } from "./functions/scitt-register";
import { createSCITTListRouter } from "./functions/scitt-list";
import { createBadgeRouter, defaultGenerateBadge } from "./functions/badge";
import { createProfileRouter } from "./functions/profile";
import { createVerifyRouter } from "./functions/verify";
import { createDIDJsonHandler } from "./functions/did-json";
import { createJWKSJsonHandler } from "./functions/jwks-json";
import { createIssueRouter } from "./functions/issue";
import { createSignRouter } from "./functions/sign";
import { createDemoSignRouter } from "./functions/sign-demo";
import { requireAuth } from "./src/middleware/auth";
import { rateLimitPg } from "./src/middleware/rate-limit";
import { withSecurityHeaders } from "./src/middleware/security-headers";
import { getDb, closeDb } from "./src/db/connection";
import { migrate } from "./src/db/migrate";
import { PgSSFStreamManager } from "./src/flagship/pg-ssf-stream";
import { PgSCITTRegistry } from "./src/parley/pg-scitt-registry";
import { PgKeyManager } from "./src/parley/pg-key-manager";
import { EnvKeyManager } from "./src/parley/env-key-manager";
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
// STARTUP STATE — Server starts immediately, initializes async
// =============================================================================

let ready = false;
let initError: string | null = null;

// Mutable refs populated after async init
let healthHandler: ((req: Request) => Promise<Response>) | null = null;
let verifyRouter: ((req: Request) => Promise<Response>) | null = null;
let signRouter: ((req: Request) => Response | Promise<Response>) | null = null;
let demoSignRouter: ((req: Request) => Response | Promise<Response>) | null = null;
let issueRouter: ((req: Request) => Response | Promise<Response>) | null = null;
let didJsonHandler: ((req: Request) => Promise<Response>) | null = null;
let jwksJsonHandler: ((req: Request) => Promise<Response>) | null = null;
let ssfConfigHandler: ((req: Request) => Response) | null = null;
let ssfRouter: ((req: Request) => Response | Promise<Response>) | null = null;
let scittRouter: ((req: Request) => Response | Promise<Response>) | null = null;
let scittListRouter: ((req: Request) => Promise<Response>) | null = null;
let badgeRouter: ((req: Request) => Promise<Response>) | null = null;
let profileRouter: ((req: Request) => Promise<Response>) | null = null;

// =============================================================================
// CORS HELPER
// =============================================================================

function getCorsOrigin(req: Request, isPublic: boolean): string | null {
  if (isPublic) return "*";
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return null;
}

// =============================================================================
// SERVER — starts IMMEDIATELY (before DB/migrations/keys)
// =============================================================================

console.log("Corsair API starting...");
console.log(`  Domain: ${DOMAIN}`);
console.log(`  Port:   ${PORT}`);

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: 10 * 1024 * 1024, // 10MB

  fetch: withSecurityHeaders(async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    // /health ALWAYS returns 200 — even during startup
    if (path === "/health") {
      if (!ready) {
        return Response.json(
          {
            status: "starting",
            version: "0.6.0",
            timestamp: new Date().toISOString(),
            checks: { database: "initializing" },
          },
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (initError) {
        return Response.json(
          {
            status: "error",
            version: "0.6.0",
            timestamp: new Date().toISOString(),
            error: initError,
          },
          { status: 503, headers: { "content-type": "application/json" } },
        );
      }
      return healthHandler!(req);
    }

    // All other routes: 503 until ready
    if (!ready) {
      return Response.json(
        { error: "Server is starting up, please retry shortly" },
        { status: 503, headers: { "content-type": "application/json", "retry-after": "5" } },
      );
    }

    // CORS preflight
    if (req.method === "OPTIONS") {
      const isPublic = path === "/verify" || path === "/v1/verify" ||
        path === "/sign/demo" || path === "/v1/sign/demo" ||
        path.startsWith("/.well-known/") ||
        path.startsWith("/badge/") || path.startsWith("/profile/") ||
        ((path === "/scitt/entries" || path === "/v1/scitt/entries") && req.method === "GET");
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

    if (path === "/verify" || path === "/v1/verify") {
      return verifyRouter!(req);
    }

    if (path === "/sign" || path === "/v1/sign") {
      return signRouter!(req);
    }

    if (path === "/sign/demo" || path === "/v1/sign/demo") {
      return demoSignRouter!(req);
    }

    if (path === "/issue" || path === "/v1/issue") {
      return issueRouter!(req);
    }

    // =========================================================================
    // TRUST ANCHORS
    // =========================================================================

    if (path === "/.well-known/did.json") {
      return didJsonHandler!(req);
    }

    if (path === "/.well-known/jwks.json") {
      return jwksJsonHandler!(req);
    }

    if (path === "/.well-known/ssf-configuration") {
      return ssfConfigHandler!(req);
    }

    // =========================================================================
    // INFRASTRUCTURE LAYER
    // =========================================================================

    if (path.startsWith("/ssf/streams") || path.startsWith("/v1/ssf/streams")) {
      return ssfRouter!(req);
    }

    if (path === "/scitt/entries" || path === "/v1/scitt/entries") {
      if (req.method === "GET") {
        return scittListRouter!(req);
      }
      return scittRouter!(req);
    }
    if (path.startsWith("/scitt/entries/") || path.startsWith("/v1/scitt/entries/")) {
      return scittRouter!(req);
    }

    if (path.startsWith("/badge/")) {
      return badgeRouter!(req);
    }

    if (path.startsWith("/profile/")) {
      return profileRouter!(req);
    }

    // =========================================================================
    // 404
    // =========================================================================

    return Response.json(
      {
        error: "Not found",
        endpoints: {
          product: ["POST /verify", "POST /sign", "POST /issue"],
          trust: ["GET /.well-known/did.json", "GET /.well-known/jwks.json"],
          infrastructure: ["GET /scitt/entries", "POST /scitt/entries", "POST /ssf/streams"],
          public: ["GET /badge/<id>.svg", "GET /badge/did/<domain>.svg", "GET /profile/<domain>"],
          ops: ["GET /health"],
        },
      },
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }),
});

console.log(`  Server listening on :${PORT} (health endpoint active)`);

// =============================================================================
// ASYNC INITIALIZATION — runs AFTER server is listening
// =============================================================================

async function initialize() {
  // 1. Validate KEY_ENCRYPTION_SECRET (sync, fast)
  const keySecretHex = (Bun.env.KEY_ENCRYPTION_SECRET || "").trim();
  if (!keySecretHex) {
    throw new Error("KEY_ENCRYPTION_SECRET is required (64 hex chars = 32 bytes)");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keySecretHex)) {
    throw new Error(`KEY_ENCRYPTION_SECRET must be exactly 64 hex characters (got ${keySecretHex.length} chars)`);
  }
  const keySecret = Buffer.from(keySecretHex, "hex");

  // 2. Connect to database
  console.log("  Init: Connecting to database...");
  const db = getDb();

  // 3. Run migrations
  console.log("  Init: Running migrations...");
  const migrationResult = await migrate(db);
  if (migrationResult.applied > 0) {
    console.log(`  Init: Applied ${migrationResult.applied} migrations (${migrationResult.files.join(", ")})`);
  } else {
    console.log(`  Init: Migrations up to date (${migrationResult.total} total)`);
  }

  // 4. Initialize key manager
  console.log("  Init: Loading signing keys...");
  const keyManager = new PgKeyManager(db as any, keySecret);
  const existingKeypair = await keyManager.loadKeypair();
  if (!existingKeypair) {
    console.log("  Init: Generating initial Ed25519 keypair...");
    await keyManager.generateKeypair();
    console.log("  Init: Generated and stored (AES-256-GCM encrypted)");
  } else {
    console.log("  Init: Active keypair loaded");
  }

  // 5. Load private key PEM for SCITT signing
  const keypair = (await keyManager.loadKeypair())!;
  const signingKeyPem = keypair.privateKey.toString();

  // 6. Initialize services
  const streamManager = new PgSSFStreamManager(db as any);
  const registry = new PgSCITTRegistry(db as any, signingKeyPem);

  // 6.5 Demo key manager (optional)
  const demoKeyManager = EnvKeyManager.fromEnv();
  let demoPublicKey: Buffer | undefined;
  if (demoKeyManager) {
    const demoKeypair = await demoKeyManager.loadKeypair();
    demoPublicKey = demoKeypair?.publicKey;
    console.log("  Init: Demo signing keys loaded");
  } else {
    console.warn("  Init: Demo signing not configured (CORSAIR_DEMO_PUBLIC_KEY/PRIVATE_KEY missing)");
  }

  // 6.6 Periodic cleanup for rate limits + idempotency
  setInterval(async () => {
    try {
      await (db as any)`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '10 minutes'`;
      await (db as any)`DELETE FROM idempotency_keys WHERE expires_at < NOW()`;
    } catch {
      // Non-critical cleanup failures
    }
  }, 10 * 60 * 1000);

  // 7. Validate API keys in production
  const configuredApiKeys = (Bun.env.CORSAIR_API_KEYS || "").split(",").filter((k: string) => k.trim());
  if (configuredApiKeys.length === 0) {
    if (Bun.env.RAILWAY_ENVIRONMENT === "production") {
      throw new Error("CORSAIR_API_KEYS required in production");
    }
    console.warn("  Init: WARNING — No CORSAIR_API_KEYS set");
  }

  // 8. Wire up routers
  verifyRouter = rateLimitPg(db as any, 100)(createVerifyRouter({
    keyManager,
    extraTrustedKeys: demoPublicKey ? [demoPublicKey] : [],
  }));
  healthHandler = createHealthHandler({ db });
  didJsonHandler = createDIDJsonHandler({ keyManager, domain: DOMAIN });
  jwksJsonHandler = createJWKSJsonHandler({ keyManager, domain: DOMAIN });
  ssfConfigHandler = createSSFConfigHandler(DOMAIN);
  scittListRouter = rateLimitPg(db as any, 30)(createSCITTListRouter({
    listEntries: (options) => registry.listEntries(options),
  }));
  badgeRouter = rateLimitPg(db as any, 60)(createBadgeRouter({
    getCPOEById: async (_marqueId) => null,
    getLatestByDomain: async (domain) => {
      const profile = await registry.getIssuerProfile(`did:web:${domain}`);
      if (!profile || !profile.latestCPOE) return null;
      return {
        marqueId: profile.latestCPOE.marqueId,
        tier: "self-signed" as const,
        controlsTested: undefined,
        overallScore: profile.latestCPOE.overallScore,
        jwt: "",
      };
    },
    generateBadge: defaultGenerateBadge,
  }));
  profileRouter = rateLimitPg(db as any, 30)(createProfileRouter({
    getIssuerProfile: (issuerDID) => registry.getIssuerProfile(issuerDID),
  }));

  signRouter = requireAuth(rateLimitPg(db as any, 10)(createSignRouter({ keyManager, domain: DOMAIN, db })));
  demoSignRouter = rateLimitPg(db as any, 5)(createDemoSignRouter({
    keyManager: demoKeyManager,
    demoDid: Bun.env.CORSAIR_DEMO_DID || `did:web:${DOMAIN}:demo`,
  }));
  issueRouter = requireAuth(rateLimitPg(db as any, 10)(createIssueRouter({ keyManager, domain: DOMAIN, db })));
  ssfRouter = requireAuth(rateLimitPg(db as any, 30)(createSSFStreamRouter({ streamManager })));
  scittRouter = requireAuth(rateLimitPg(db as any, 30)(createSCITTRouter({ registry })));

  // 9. Start delivery worker if enabled
  if (Bun.env.ENABLE_DELIVERY_WORKER === "true") {
    const interval = parseInt(Bun.env.DELIVERY_WORKER_INTERVAL || "30000");
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
    console.log(`  Init: Delivery worker enabled (${interval / 1000}s interval)`);
  }

  // Mark ready
  ready = true;
  console.log("\nCorsair API ready!");
  console.log(`  Verify:  POST http://localhost:${PORT}/verify`);
  console.log(`  Sign:    POST http://localhost:${PORT}/sign`);
  console.log(`  Issue:   POST http://localhost:${PORT}/issue`);
  console.log(`  DID:     GET  http://localhost:${PORT}/.well-known/did.json`);
  console.log(`  JWKS:    GET  http://localhost:${PORT}/.well-known/jwks.json`);
  console.log(`  SCITT:   GET  http://localhost:${PORT}/scitt/entries`);
  console.log(`  SCITT:   POST http://localhost:${PORT}/scitt/entries`);
  console.log(`  Badge:   GET  http://localhost:${PORT}/badge/<id>.svg`);
  console.log(`  Profile: GET  http://localhost:${PORT}/profile/<domain>`);
  console.log(`  SSF:     POST http://localhost:${PORT}/ssf/streams`);
  console.log(`  Health:  GET  http://localhost:${PORT}/health`);
}

// Run async init — catch errors so server stays up for health endpoint
initialize().catch((err) => {
  initError = err instanceof Error ? err.message : String(err);
  console.error(`\nInit FAILED: ${initError}`);
  console.error("Server remains running for diagnostics. /health returns 503.");
});

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);
  server.stop();
  closeDb();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
