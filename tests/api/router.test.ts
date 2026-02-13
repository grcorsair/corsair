/**
 * API Router Tests — TDD Red Phase
 *
 * Tests the versioned /v1/ router: routing, CORS, request IDs,
 * version header, OPTIONS preflight, 404 handling.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createV1Router } from "../../src/api/router";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import type { APIEnvelope } from "../../src/api/types";

// =============================================================================
// SETUP
// =============================================================================

const tmpDir = join(import.meta.dir, ".tmp-router-test");
let keyManager: MarqueKeyManager;
let router: (req: Request) => Promise<Response>;

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();

  router = createV1Router({
    keyManager,
    domain: "test.grcorsair.com",
  });
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELPERS
// =============================================================================

function makeRequest(method: string, path: string, body?: unknown, headers?: Record<string, string>): Request {
  const url = `http://localhost${path}`;
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    (init.headers as Record<string, string>)["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

// =============================================================================
// REQUEST ID
// =============================================================================

describe("V1 Router — Request ID", () => {
  test("generates X-Request-Id on every response", async () => {
    const req = makeRequest("GET", "/v1/health");
    const res = await router(req);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
    expect(typeof requestId).toBe("string");
    expect(requestId!.length).toBeGreaterThan(0);
  });

  test("echoes client-provided X-Request-Id", async () => {
    const clientId = "client-req-12345";
    const req = makeRequest("GET", "/v1/health", undefined, { "x-request-id": clientId });
    const res = await router(req);
    expect(res.headers.get("x-request-id")).toBe(clientId);
  });

  test("each request gets a unique ID when not provided", async () => {
    const res1 = await router(makeRequest("GET", "/v1/health"));
    const res2 = await router(makeRequest("GET", "/v1/health"));
    expect(res1.headers.get("x-request-id")).not.toBe(res2.headers.get("x-request-id"));
  });
});

// =============================================================================
// VERSION HEADER
// =============================================================================

describe("V1 Router — Version Header", () => {
  test("includes X-Corsair-Version on every response", async () => {
    const req = makeRequest("GET", "/v1/health");
    const res = await router(req);
    const version = res.headers.get("x-corsair-version");
    expect(version).toBeTruthy();
    expect(typeof version).toBe("string");
  });
});

// =============================================================================
// CORS
// =============================================================================

describe("V1 Router — CORS", () => {
  test("includes Access-Control-Allow-Origin on all responses", async () => {
    const req = makeRequest("GET", "/v1/health");
    const res = await router(req);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("OPTIONS preflight returns 204 with CORS headers", async () => {
    const req = makeRequest("OPTIONS", "/v1/verify");
    const res = await router(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBeTruthy();
    expect(res.headers.get("access-control-allow-headers")).toBeTruthy();
    expect(res.headers.get("access-control-max-age")).toBeTruthy();
  });

  test("OPTIONS preflight includes X-Request-Id", async () => {
    const req = makeRequest("OPTIONS", "/v1/health");
    const res = await router(req);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});

// =============================================================================
// ROUTING
// =============================================================================

describe("V1 Router — Route Dispatch", () => {
  test("GET /v1/health returns 200 ok", async () => {
    const req = makeRequest("GET", "/v1/health");
    const res = await router(req);
    expect(res.status).toBe(200);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
  });

  test("POST /v1/verify routes to verify handler", async () => {
    // Should return 400 for missing cpoe, not 404
    const req = makeRequest("POST", "/v1/verify", { wrong: "field" });
    const res = await router(req);
    // 400 means it reached the handler (not 404)
    expect(res.status).toBe(400);
    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
  });

  test("POST /v1/sign routes to sign handler", async () => {
    // Should return 400 for missing evidence, not 404
    const req = makeRequest("POST", "/v1/sign", { wrong: "field" });
    const res = await router(req);
    expect(res.status).toBe(400);
    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
  });

  test("unknown route returns 404 with envelope", async () => {
    const req = makeRequest("GET", "/v1/nonexistent");
    const res = await router(req);
    expect(res.status).toBe(404);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("not_found");
  });

  test("route without /v1/ prefix returns 404", async () => {
    const req = makeRequest("GET", "/health");
    const res = await router(req);
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// ENVELOPE FORMAT
// =============================================================================

describe("V1 Router — Envelope Format", () => {
  test("success responses use { ok: true, data: ... } envelope", async () => {
    const req = makeRequest("GET", "/v1/health");
    const res = await router(req);
    const body: APIEnvelope = await res.json();

    expect(body).toHaveProperty("ok");
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("data");
    expect(body.error).toBeUndefined();
  });

  test("error responses use { ok: false, error: { code, message } } envelope", async () => {
    const req = makeRequest("GET", "/v1/nonexistent");
    const res = await router(req);
    const body: APIEnvelope = await res.json();

    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();
    expect(body.error?.code).toBeTruthy();
    expect(body.error?.message).toBeTruthy();
    expect(body.data).toBeUndefined();
  });

  test("all responses have application/json content-type", async () => {
    const req = makeRequest("GET", "/v1/health");
    const res = await router(req);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

// =============================================================================
// SIGN VIA ROUTER
// =============================================================================

describe("V1 Router — Sign Integration", () => {
  const genericEvidence = {
    metadata: { title: "Router Test", issuer: "Test Corp", date: "2026-02-13", scope: "Production" },
    controls: [
      { id: "C-1", description: "MFA", status: "pass", evidence: "Config verified" },
    ],
  };

  test("POST /v1/sign returns signed CPOE in envelope", async () => {
    const req = makeRequest("POST", "/v1/sign", { evidence: genericEvidence });
    const res = await router(req);
    expect(res.status).toBe(200);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.cpoe).toBeTruthy();
    expect((data.cpoe as string).split(".").length).toBe(3);
    expect(data.marqueId).toBeTruthy();
  });

  test("GET /v1/sign returns 405 method not allowed", async () => {
    const req = makeRequest("GET", "/v1/sign");
    const res = await router(req);
    expect(res.status).toBe(405);
    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("method_not_allowed");
  });
});

// =============================================================================
// VERIFY VIA ROUTER
// =============================================================================

describe("V1 Router — Verify Integration", () => {
  test("POST /v1/verify with valid CPOE returns verification in envelope", async () => {
    // First, sign something
    const evidence = {
      metadata: { title: "Verify Test", issuer: "Test", date: "2026-02-13", scope: "Test" },
      controls: [{ id: "C-1", description: "Test", status: "pass", evidence: "OK" }],
    };
    const signRes = await router(makeRequest("POST", "/v1/sign", { evidence }));
    const signBody: APIEnvelope = await signRes.json();
    const cpoe = (signBody.data as Record<string, unknown>).cpoe as string;

    // Now verify it
    const verifyRes = await router(makeRequest("POST", "/v1/verify", { cpoe }));
    expect(verifyRes.status).toBe(200);

    const verifyBody: APIEnvelope = await verifyRes.json();
    expect(verifyBody.ok).toBe(true);
    const data = verifyBody.data as Record<string, unknown>;
    expect(data.valid).toBe(true);
    expect(data.issuer).toBeTruthy();
    expect(data.trustTier).toBeTruthy();
  });

  test("POST /v1/verify with empty body returns validation error", async () => {
    const req = makeRequest("POST", "/v1/verify", {});
    const res = await router(req);
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
  });

  test("POST /v1/verify with malformed JWT returns 400", async () => {
    const req = makeRequest("POST", "/v1/verify", { cpoe: "not.valid" });
    const res = await router(req);
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
  });

  test("GET /v1/verify returns 405", async () => {
    const req = makeRequest("GET", "/v1/verify");
    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("POST /v1/verify accepts raw JWT string via text/plain", async () => {
    // First sign
    const evidence = {
      metadata: { title: "Raw Test", issuer: "Test", date: "2026-02-13", scope: "Test" },
      controls: [{ id: "C-1", description: "Test", status: "pass", evidence: "OK" }],
    };
    const signRes = await router(makeRequest("POST", "/v1/sign", { evidence }));
    const signBody: APIEnvelope = await signRes.json();
    const cpoe = (signBody.data as Record<string, unknown>).cpoe as string;

    // Verify via raw text
    const req = new Request("http://localhost/v1/verify", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: cpoe,
    });
    const res = await router(req);
    expect(res.status).toBe(200);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(true);
  });

  test("POST /v1/verify rejects oversized JWT", async () => {
    const bigJwt = "eyJ" + "a".repeat(25_000) + ".payload.sig";
    const req = makeRequest("POST", "/v1/verify", { cpoe: bigJwt });
    const res = await router(req);
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("payload_too_large");
  });
});
