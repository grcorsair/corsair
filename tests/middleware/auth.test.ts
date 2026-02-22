/**
 * Auth Middleware Tests
 *
 * Tests Bearer token authentication wrapper for protected endpoints.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { requireAuth, invalidateApiKeyCache } from "../../src/middleware/auth";
import { resetOIDCCacheForTests } from "../../src/middleware/oidc";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

// Simple passthrough handler for testing
const echoHandler = (req: Request) =>
  Response.json({ ok: true, method: req.method }, { status: 200 });

describe("requireAuth middleware", () => {
  const originalEnv = process.env.CORSAIR_API_KEYS;
  const originalOidc = process.env.CORSAIR_OIDC_CONFIG;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.CORSAIR_API_KEYS = "test-key-123,test-key-456";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CORSAIR_API_KEYS = originalEnv;
    } else {
      delete process.env.CORSAIR_API_KEYS;
    }
    invalidateApiKeyCache();
    resetOIDCCacheForTests();
    if (originalOidc !== undefined) {
      process.env.CORSAIR_OIDC_CONFIG = originalOidc;
    } else {
      delete process.env.CORSAIR_OIDC_CONFIG;
    }
    globalThis.fetch = originalFetch;
  });

  test("passes request through with valid Bearer token", async () => {
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer test-key-123" },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  test("accepts second valid key from comma-separated list", async () => {
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer test-key-456" },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  test("returns 401 for missing Authorization header", async () => {
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", { method: "POST" });

    const res = await handler(req);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("Authorization");
  });

  test("returns 401 for non-Bearer auth scheme", async () => {
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });

    const res = await handler(req);
    expect(res.status).toBe(401);
  });

  test("returns 403 for invalid token", async () => {
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
    });

    const res = await handler(req);
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("Invalid API key");
  });

  test("returns 401 for empty Bearer value", async () => {
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer " },
    });

    const res = await handler(req);
    // Header value gets trimmed to "Bearer" by Request constructor,
    // which doesn't match "Bearer " prefix → 401
    expect(res.status).toBe(401);
  });

  test("passes OPTIONS (CORS preflight) through without auth", async () => {
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", { method: "OPTIONS" });

    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  test("returns 401/403 for all requests when no API keys configured", async () => {
    process.env.CORSAIR_API_KEYS = "";
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer any-key" },
    });

    const res = await handler(req);
    expect(res.status).toBe(403);
  });

  test("trims whitespace from API keys", async () => {
    process.env.CORSAIR_API_KEYS = " spaced-key , another-key ";
    const handler = requireAuth(echoHandler);
    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer spaced-key" },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  test("caches API keys across calls", async () => {
    process.env.CORSAIR_API_KEYS = "cached-key";
    invalidateApiKeyCache();
    const handler = requireAuth(echoHandler);

    const req1 = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer cached-key" },
    });
    const res1 = await handler(req1);
    expect(res1.status).toBe(200);

    // Change env — but cache should still use old value
    process.env.CORSAIR_API_KEYS = "new-key";
    const req2 = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer cached-key" },
    });
    const res2 = await handler(req2);
    expect(res2.status).toBe(200); // Still valid from cache

    // Invalidate cache to pick up new keys
    invalidateApiKeyCache();
    const req3 = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: "Bearer cached-key" },
    });
    const res3 = await handler(req3);
    expect(res3.status).toBe(403); // Now rejected
  });

  test("accepts valid OIDC token when configured", async () => {
    const issuer = "https://issuer.example.com";
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
    const jwksUrl = `${issuer}/jwks.json`;

    process.env.CORSAIR_OIDC_CONFIG = JSON.stringify({
      providers: [{
        issuer,
        discoveryUrl,
        audiences: ["corsair-sign"],
      }],
    });

    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test-kid";

    const token = await new SignJWT({ role: "agent" })
      .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
      .setIssuer(issuer)
      .setAudience("corsair-sign")
      .setSubject("agent-123")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(privateKey);

    globalThis.fetch = (async (url: string) => {
      if (url === discoveryUrl) {
        return new Response(JSON.stringify({ jwks_uri: jwksUrl }), {
          status: 200,
          headers: { "cache-control": "max-age=60" },
        });
      }
      if (url === jwksUrl) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "cache-control": "max-age=60" },
        });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const handler = requireAuth((req: Request) =>
      Response.json({
        ok: true,
        auth: (req as Request & { corsairAuth?: unknown }).corsairAuth,
      }, { status: 200 }));

    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { auth?: { type?: string } };
    expect(body.auth?.type).toBe("oidc");
  });
});
