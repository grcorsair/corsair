import { describe, test, expect } from "bun:test";
import { withSecurityHeaders } from "../../src/middleware/security-headers";

describe("withSecurityHeaders middleware", () => {
  const echoHandler = (_req: Request) =>
    Response.json({ ok: true }, { status: 200 });

  test("adds X-Content-Type-Options: nosniff", async () => {
    const handler = withSecurityHeaders(echoHandler);
    const req = new Request("http://localhost/test");
    const res = await handler(req);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  test("adds X-Frame-Options: DENY", async () => {
    const handler = withSecurityHeaders(echoHandler);
    const req = new Request("http://localhost/test");
    const res = await handler(req);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  test("adds Strict-Transport-Security header", async () => {
    const handler = withSecurityHeaders(echoHandler);
    const req = new Request("http://localhost/test");
    const res = await handler(req);
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });

  test("adds X-XSS-Protection: 0", async () => {
    const handler = withSecurityHeaders(echoHandler);
    const req = new Request("http://localhost/test");
    const res = await handler(req);
    expect(res.headers.get("X-XSS-Protection")).toBe("0");
  });

  test("preserves original response status", async () => {
    const notFoundHandler = (_req: Request) =>
      Response.json({ error: "not found" }, { status: 404 });
    const handler = withSecurityHeaders(notFoundHandler);
    const req = new Request("http://localhost/test");
    const res = await handler(req);
    expect(res.status).toBe(404);
  });

  test("preserves original response body", async () => {
    const handler = withSecurityHeaders(echoHandler);
    const req = new Request("http://localhost/test");
    const res = await handler(req);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  test("preserves existing headers from handler", async () => {
    const customHandler = (_req: Request) =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json", "x-custom": "value" },
      });
    const handler = withSecurityHeaders(customHandler);
    const req = new Request("http://localhost/test");
    const res = await handler(req);
    expect(res.headers.get("x-custom")).toBe("value");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
