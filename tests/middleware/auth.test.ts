/**
 * Auth Middleware Tests
 *
 * Tests Bearer token authentication wrapper for protected endpoints.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { requireAuth } from "../../src/middleware/auth";

// Simple passthrough handler for testing
const echoHandler = (req: Request) =>
  Response.json({ ok: true, method: req.method }, { status: 200 });

describe("requireAuth middleware", () => {
  const originalEnv = process.env.CORSAIR_API_KEYS;

  beforeEach(() => {
    process.env.CORSAIR_API_KEYS = "test-key-123,test-key-456";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CORSAIR_API_KEYS = originalEnv;
    } else {
      delete process.env.CORSAIR_API_KEYS;
    }
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
});
