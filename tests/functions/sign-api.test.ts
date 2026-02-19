/**
 * Sign API Endpoint Tests — TDD
 *
 * Tests for POST /sign endpoint.
 * Covers: generic format, format hint validation, DID override, dry-run, error cases.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createSignRouter } from "../../functions/sign";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

const tmpDir = join(import.meta.dir, ".tmp-sign-api");
let keyManager: MarqueKeyManager;
let router: (req: Request) => Promise<Response>;

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();

  router = createSignRouter({ keyManager, domain: "test.grcorsair.com" });
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELPERS
// =============================================================================

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/sign", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// =============================================================================
// SAMPLE DATA
// =============================================================================

const genericEvidence = {
  metadata: { title: "API Test", issuer: "Test Corp", date: "2026-02-13", scope: "Production" },
  controls: [
    { id: "C-1", description: "MFA", status: "pass", evidence: "Config verified" },
    { id: "C-2", description: "Encryption", status: "fail", severity: "HIGH", evidence: "Not enabled" },
  ],
};

// =============================================================================
// FORMAT TESTS
// =============================================================================

describe("POST /sign — generic", () => {
  test("signs generic JSON", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cpoe).toMatch(/^eyJ/);
    expect(data.detectedFormat).toBe("generic");
    expect(data.summary.controlsTested).toBe(2);
    expect(data.marqueId).toMatch(/^marque-/);
  });
});

// =============================================================================
// OPTIONS
// =============================================================================

describe("POST /sign — options", () => {
  test("rejects non-generic format hint", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, format: "legacy" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test("accepts generic format hint", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, format: "generic" }));
    const data = await res.json();
    expect(data.detectedFormat).toBe("generic");
  });

  test("accepts DID override", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, did: "did:web:acme.com" }));
    const data = await res.json();
    const parts = data.cpoe.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.iss).toBe("did:web:acme.com");
  });

  test("defaults issuer DID to server domain", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence }));
    const data = await res.json();
    const parts = data.cpoe.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.iss).toBe("did:web:test.grcorsair.com");
  });

  test("accepts scope override", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, scope: "Custom Scope" }));
    const data = await res.json();
    const parts = data.cpoe.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.vc.credentialSubject.scope).toBe("Custom Scope");
  });

  test("accepts dry-run flag", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, dryRun: true }));
    const data = await res.json();
    expect(data.cpoe).toBe("");
    expect(data.summary.controlsTested).toBe(2);
  });

  test("returns expiresAt in response", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence }));
    const data = await res.json();
    expect(data.expiresAt).toBeDefined();
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe("POST /sign — error handling", () => {
  test("rejects non-POST", async () => {
    const req = new Request("http://localhost/sign", { method: "GET" });
    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("rejects empty body", async () => {
    const req = new Request("http://localhost/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects invalid JSON", async () => {
    const req = new Request("http://localhost/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{bad json",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects oversized evidence", async () => {
    const big = "x".repeat(600_000);
    const res = await router(makeRequest({ evidence: big }));
    expect(res.status).toBe(400);
  });

  test("rejects missing scope when no override provided", async () => {
    const evidenceWithoutScope = {
      metadata: { title: "No Scope", issuer: "Test Corp", date: "2026-02-13" },
      controls: [{ id: "C-1", description: "MFA", status: "pass", evidence: "OK" }],
    };
    const res = await router(makeRequest({ evidence: evidenceWithoutScope }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("scope");
  });
});
