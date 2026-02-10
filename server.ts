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
 *   GET /health                         — Health check
 *
 * Runs migrations on startup (idempotent).
 * Reads DATABASE_URL, KEY_ENCRYPTION_SECRET, CORSAIR_DOMAIN from env.
 */

import { handleHealth } from "./functions/health";
import { handleSSFConfiguration } from "./functions/ssf-configuration";
import { createSSFStreamRouter } from "./functions/ssf-stream";
import { createSCITTRouter } from "./functions/scitt-register";
import { createVerifyRouter } from "./functions/verify";
import { createDIDJsonHandler } from "./functions/did-json";
import { createJWKSJsonHandler } from "./functions/jwks-json";
import { createIssueRouter } from "./functions/issue";
import { getDb } from "./src/db/connection";
import { migrate } from "./src/db/migrate";
import { PgSSFStreamManager } from "./src/flagship/pg-ssf-stream";
import { PgSCITTRegistry } from "./src/parley/pg-scitt-registry";
import { PgKeyManager } from "./src/parley/pg-key-manager";

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = parseInt(Bun.env.PORT || "3000");
const DOMAIN = Bun.env.CORSAIR_DOMAIN || "grcorsair.com";

// =============================================================================
// DATABASE + MIGRATIONS
// =============================================================================

console.log("Corsair API starting...");
console.log(`  Domain: ${DOMAIN}`);
console.log(`  Port:   ${PORT}`);

const db = getDb();

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
const keySecretHex = Bun.env.KEY_ENCRYPTION_SECRET;
if (!keySecretHex) {
  console.error("ERROR: KEY_ENCRYPTION_SECRET is required (64 hex chars = 32 bytes)");
  console.error("Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
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

// =============================================================================
// ROUTERS
// =============================================================================

const verifyRouter = createVerifyRouter({ keyManager });
const didJsonHandler = createDIDJsonHandler({ keyManager, domain: DOMAIN });
const jwksJsonHandler = createJWKSJsonHandler({ keyManager, domain: DOMAIN });
const issueRouter = createIssueRouter({ keyManager, domain: DOMAIN });
const ssfRouter = createSSFStreamRouter({ streamManager });
const scittRouter = createSCITTRouter({ registry });

// =============================================================================
// SERVER
// =============================================================================

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization",
          "access-control-max-age": "86400",
        },
      });
    }

    // =========================================================================
    // PRODUCT LAYER
    // =========================================================================

    // POST /verify — Free CPOE verification
    if (path === "/verify") {
      return verifyRouter(req);
    }

    // POST /issue — CPOE issuance
    if (path === "/issue") {
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
      return handleSSFConfiguration(req);
    }

    // =========================================================================
    // INFRASTRUCTURE LAYER
    // =========================================================================

    // SSF streams
    if (path.startsWith("/ssf/streams")) {
      return ssfRouter(req);
    }

    // SCITT
    if (path.startsWith("/scitt/entries")) {
      return scittRouter(req);
    }

    // =========================================================================
    // OPS
    // =========================================================================

    if (path === "/health") {
      return handleHealth(req);
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
  },
});

console.log(`\nCorsair API running on :${PORT}`);
console.log(`  Verify:  POST http://localhost:${PORT}/verify`);
console.log(`  Issue:   POST http://localhost:${PORT}/issue`);
console.log(`  DID:     GET  http://localhost:${PORT}/.well-known/did.json`);
console.log(`  JWKS:    GET  http://localhost:${PORT}/.well-known/jwks.json`);
console.log(`  SCITT:   POST http://localhost:${PORT}/scitt/entries`);
console.log(`  SSF:     POST http://localhost:${PORT}/ssf/streams`);
console.log(`  Health:  GET  http://localhost:${PORT}/health`);
