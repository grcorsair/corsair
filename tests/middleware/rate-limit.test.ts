import { describe, test, expect, beforeEach } from "bun:test";
import { rateLimit, resetRateLimitStore } from "../../src/middleware/rate-limit";

const echoHandler = (_req: Request) =>
  Response.json({ ok: true }, { status: 200 });

describe("rateLimit middleware", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  test("allows requests under the limit", async () => {
    const handler = rateLimit(5)(echoHandler);
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    for (let i = 0; i < 5; i++) {
      const res = await handler(req);
      expect(res.status).toBe(200);
    }
  });

  test("returns 429 when limit exceeded", async () => {
    const handler = rateLimit(3)(echoHandler);
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    // First 3 pass
    for (let i = 0; i < 3; i++) {
      const res = await handler(req);
      expect(res.status).toBe(200);
    }

    // 4th fails
    const res = await handler(req);
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("Too many requests");
  });

  test("includes Retry-After header on 429", async () => {
    const handler = rateLimit(1)(echoHandler);
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    await handler(req); // first OK
    const res = await handler(req); // second -> 429
    expect(res.status).toBe(429);
    const retryAfter = res.headers.get("retry-after");
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  test("tracks different IPs separately", async () => {
    const handler = rateLimit(1)(echoHandler);

    const req1 = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    const req2 = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "2.2.2.2" },
    });

    const res1 = await handler(req1);
    expect(res1.status).toBe(200);

    const res2 = await handler(req2);
    expect(res2.status).toBe(200);

    // Both exhausted
    const res3 = await handler(req1);
    expect(res3.status).toBe(429);
    const res4 = await handler(req2);
    expect(res4.status).toBe(429);
  });

  test("resets after window expires", async () => {
    const handler = rateLimit(1, 50)(echoHandler); // 50ms window
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    const res1 = await handler(req);
    expect(res1.status).toBe(200);

    const res2 = await handler(req);
    expect(res2.status).toBe(429);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));

    const res3 = await handler(req);
    expect(res3.status).toBe(200);
  });

  test("uses 'unknown' for requests without x-forwarded-for", async () => {
    const handler = rateLimit(1)(echoHandler);
    const req = new Request("http://localhost/test");

    const res1 = await handler(req);
    expect(res1.status).toBe(200);

    const res2 = await handler(req);
    expect(res2.status).toBe(429);
  });

  test("composes with other wrappers", async () => {
    const handler = rateLimit(5)(echoHandler);
    const req = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  test("uses override rate limit key when provided", async () => {
    const handler = rateLimit(1)(echoHandler);

    const req1 = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    (req1 as Request & { corsairRateLimitKey?: string }).corsairRateLimitKey = "oidc:user-1";

    const req2 = new Request("http://localhost/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    (req2 as Request & { corsairRateLimitKey?: string }).corsairRateLimitKey = "oidc:user-2";

    const res1 = await handler(req1);
    expect(res1.status).toBe(200);
    const res2 = await handler(req2);
    expect(res2.status).toBe(200);

    const res3 = await handler(req1);
    expect(res3.status).toBe(429);
    const res4 = await handler(req2);
    expect(res4.status).toBe(429);
  });
});
