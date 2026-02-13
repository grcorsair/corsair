/**
 * Webhook Manager Tests
 *
 * Tests the webhook delivery system for platform consumers.
 * Covers endpoint registration, HMAC signing, dispatch routing,
 * delivery tracking, retry logic, and config enforcement.
 *
 * HTTP calls are mocked via globalThis.fetch override — no real network.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { WebhookManager } from "../../src/webhooks/webhook-manager";
import type {
  WebhookEventType,
  WebhookEndpoint,
  WebhookPayload,
  WebhookDelivery,
  WebhookConfig,
} from "../../src/webhooks/types";
import { createHmac } from "crypto";

// =============================================================================
// TEST HELPERS
// =============================================================================

let manager: WebhookManager;
const originalFetch = globalThis.fetch;

/** Mock fetch that records calls and returns configurable responses */
let fetchCalls: Array<{ url: string; init: RequestInit }> = [];
let fetchResponse: { status: number; body?: string } = { status: 200 };

function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
  fetchCalls.push({ url: urlStr, init: init ?? {} });
  return Promise.resolve(
    new Response(fetchResponse.body ?? "", { status: fetchResponse.status }),
  );
}

beforeEach(() => {
  manager = new WebhookManager();
  fetchCalls = [];
  fetchResponse = { status: 200 };
  globalThis.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// =============================================================================
// ENDPOINT REGISTRATION
// =============================================================================

describe("WebhookManager", () => {
  describe("registerEndpoint", () => {
    test("registers a valid endpoint with URL and events", () => {
      const ep = manager.registerEndpoint(
        "https://example.com/webhooks",
        ["cpoe.signed", "cpoe.expired"],
      );

      expect(ep.url).toBe("https://example.com/webhooks");
      expect(ep.events).toEqual(["cpoe.signed", "cpoe.expired"]);
      expect(ep.active).toBe(true);
    });

    test("generates a unique ID for each endpoint", () => {
      const ep1 = manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      const ep2 = manager.registerEndpoint("https://b.com/hook", ["cpoe.signed"]);

      expect(ep1.id).toBeTruthy();
      expect(ep2.id).toBeTruthy();
      expect(ep1.id).not.toBe(ep2.id);
    });

    test("auto-generates HMAC secret when not provided", () => {
      const ep = manager.registerEndpoint("https://example.com/hook", ["cpoe.signed"]);

      expect(ep.secret).toBeTruthy();
      expect(typeof ep.secret).toBe("string");
      expect(ep.secret.length).toBeGreaterThanOrEqual(32);
    });

    test("uses provided secret when given", () => {
      const ep = manager.registerEndpoint(
        "https://example.com/hook",
        ["cpoe.signed"],
        "my-custom-secret",
      );

      expect(ep.secret).toBe("my-custom-secret");
    });

    test("sets createdAt to ISO timestamp", () => {
      const before = new Date().toISOString();
      const ep = manager.registerEndpoint("https://example.com/hook", ["cpoe.signed"]);
      const after = new Date().toISOString();

      expect(ep.createdAt).toBeTruthy();
      expect(ep.createdAt >= before).toBe(true);
      expect(ep.createdAt <= after).toBe(true);
    });

    test("supports metadata on registration", () => {
      const ep = manager.registerEndpoint(
        "https://example.com/hook",
        ["cpoe.signed"],
        undefined,
        { orgId: "org-123", env: "production" },
      );

      expect(ep.metadata).toEqual({ orgId: "org-123", env: "production" });
    });

    test("enforces max endpoints limit", () => {
      const mgr = new WebhookManager({ maxEndpoints: 3 });

      mgr.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      mgr.registerEndpoint("https://b.com/hook", ["cpoe.signed"]);
      mgr.registerEndpoint("https://c.com/hook", ["cpoe.signed"]);

      expect(() => {
        mgr.registerEndpoint("https://d.com/hook", ["cpoe.signed"]);
      }).toThrow(/max.*endpoint/i);
    });

    test("allows registration up to but not exceeding max endpoints", () => {
      const mgr = new WebhookManager({ maxEndpoints: 2 });

      mgr.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      const ep2 = mgr.registerEndpoint("https://b.com/hook", ["cpoe.signed"]);

      expect(ep2.active).toBe(true);
    });
  });

  // =============================================================================
  // ENDPOINT REMOVAL
  // =============================================================================

  describe("removeEndpoint", () => {
    test("marks endpoint as inactive", () => {
      const ep = manager.registerEndpoint("https://example.com/hook", ["cpoe.signed"]);
      const removed = manager.removeEndpoint(ep.id);

      expect(removed).toBe(true);
    });

    test("inactive endpoint no longer appears in active list", () => {
      const ep = manager.registerEndpoint("https://example.com/hook", ["cpoe.signed"]);
      manager.removeEndpoint(ep.id);

      const active = manager.listEndpoints();
      expect(active).toHaveLength(0);
    });

    test("returns false for non-existent endpoint ID", () => {
      const result = manager.removeEndpoint("non-existent-id");
      expect(result).toBe(false);
    });

    test("removing already-inactive endpoint returns false", () => {
      const ep = manager.registerEndpoint("https://example.com/hook", ["cpoe.signed"]);
      manager.removeEndpoint(ep.id);

      const secondRemoval = manager.removeEndpoint(ep.id);
      expect(secondRemoval).toBe(false);
    });
  });

  // =============================================================================
  // LIST ENDPOINTS
  // =============================================================================

  describe("listEndpoints", () => {
    test("returns only active endpoints", () => {
      const ep1 = manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      manager.registerEndpoint("https://b.com/hook", ["cpoe.expired"]);
      manager.removeEndpoint(ep1.id);

      const active = manager.listEndpoints();
      expect(active).toHaveLength(1);
      expect(active[0].url).toBe("https://b.com/hook");
    });

    test("returns empty array when no endpoints registered", () => {
      const active = manager.listEndpoints();
      expect(active).toEqual([]);
    });

    test("returns all endpoints when none are removed", () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      manager.registerEndpoint("https://b.com/hook", ["cpoe.expired"]);
      manager.registerEndpoint("https://c.com/hook", ["drift.detected"]);

      const active = manager.listEndpoints();
      expect(active).toHaveLength(3);
    });
  });

  // =============================================================================
  // PAYLOAD SIGNING (HMAC-SHA256)
  // =============================================================================

  describe("signPayload", () => {
    test("produces deterministic HMAC-SHA256 hex digest", () => {
      const payload: WebhookPayload = {
        id: "del-001",
        type: "cpoe.signed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: { cpoeId: "marque-abc" },
        apiVersion: "2026-02-13",
      };
      const secret = "test-secret-key";

      const sig1 = manager.signPayload(payload, secret);
      const sig2 = manager.signPayload(payload, secret);

      expect(sig1).toBe(sig2);
      expect(typeof sig1).toBe("string");
      // HMAC-SHA256 hex is 64 chars
      expect(sig1.length).toBe(64);
    });

    test("matches manual HMAC-SHA256 computation", () => {
      const payload: WebhookPayload = {
        id: "del-002",
        type: "cpoe.expired",
        timestamp: "2026-02-13T12:00:00.000Z",
        data: { cpoeId: "marque-xyz" },
        apiVersion: "2026-02-13",
      };
      const secret = "verification-secret";

      const sig = manager.signPayload(payload, secret);

      // Compute expected using Node.js crypto directly
      const expected = createHmac("sha256", secret)
        .update(JSON.stringify(payload))
        .digest("hex");

      expect(sig).toBe(expected);
    });

    test("different secrets produce different signatures", () => {
      const payload: WebhookPayload = {
        id: "del-003",
        type: "cpoe.signed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: {},
        apiVersion: "2026-02-13",
      };

      const sig1 = manager.signPayload(payload, "secret-a");
      const sig2 = manager.signPayload(payload, "secret-b");

      expect(sig1).not.toBe(sig2);
    });

    test("different payloads produce different signatures", () => {
      const secret = "same-secret";
      const payload1: WebhookPayload = {
        id: "del-004a",
        type: "cpoe.signed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: { a: 1 },
        apiVersion: "2026-02-13",
      };
      const payload2: WebhookPayload = {
        id: "del-004b",
        type: "cpoe.expired",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: { b: 2 },
        apiVersion: "2026-02-13",
      };

      const sig1 = manager.signPayload(payload1, secret);
      const sig2 = manager.signPayload(payload2, secret);

      expect(sig1).not.toBe(sig2);
    });
  });

  // =============================================================================
  // SIGNATURE VERIFICATION
  // =============================================================================

  describe("verifySignature", () => {
    test("returns true for valid signature", () => {
      const payload: WebhookPayload = {
        id: "del-005",
        type: "score.changed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: { newScore: 95 },
        apiVersion: "2026-02-13",
      };
      const secret = "verify-test-secret";
      const sig = manager.signPayload(payload, secret);

      expect(manager.verifySignature(payload, sig, secret)).toBe(true);
    });

    test("returns false for invalid signature", () => {
      const payload: WebhookPayload = {
        id: "del-006",
        type: "score.changed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: {},
        apiVersion: "2026-02-13",
      };
      const secret = "verify-test-secret";

      expect(manager.verifySignature(payload, "deadbeef", secret)).toBe(false);
    });

    test("returns false when secret mismatches", () => {
      const payload: WebhookPayload = {
        id: "del-007",
        type: "drift.detected",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: {},
        apiVersion: "2026-02-13",
      };
      const sig = manager.signPayload(payload, "secret-a");

      expect(manager.verifySignature(payload, sig, "secret-b")).toBe(false);
    });

    test("returns false for tampered payload", () => {
      const original: WebhookPayload = {
        id: "del-008",
        type: "cpoe.signed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: { score: 90 },
        apiVersion: "2026-02-13",
      };
      const secret = "tamper-test";
      const sig = manager.signPayload(original, secret);

      const tampered: WebhookPayload = {
        ...original,
        data: { score: 100 },
      };

      expect(manager.verifySignature(tampered, sig, secret)).toBe(false);
    });
  });

  // =============================================================================
  // DISPATCH
  // =============================================================================

  describe("dispatch", () => {
    test("routes event to subscribed endpoints only", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      manager.registerEndpoint("https://b.com/hook", ["cpoe.expired"]);
      manager.registerEndpoint("https://c.com/hook", ["cpoe.signed", "cpoe.expired"]);

      const deliveries = await manager.dispatch("cpoe.signed", { cpoeId: "marque-001" });

      // a.com and c.com subscribe to cpoe.signed, b.com does not
      expect(deliveries).toHaveLength(2);
      const urls = fetchCalls.map((c) => c.url);
      expect(urls).toContain("https://a.com/hook");
      expect(urls).toContain("https://c.com/hook");
      expect(urls).not.toContain("https://b.com/hook");
    });

    test("skips inactive endpoints", async () => {
      const ep1 = manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      manager.registerEndpoint("https://b.com/hook", ["cpoe.signed"]);
      manager.removeEndpoint(ep1.id);

      const deliveries = await manager.dispatch("cpoe.signed", { cpoeId: "marque-002" });

      expect(deliveries).toHaveLength(1);
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].url).toBe("https://b.com/hook");
    });

    test("returns empty array when no endpoints match event", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.expired"]);

      const deliveries = await manager.dispatch("cpoe.signed", { cpoeId: "marque-003" });

      expect(deliveries).toHaveLength(0);
      expect(fetchCalls).toHaveLength(0);
    });

    test("returns empty array with no registered endpoints", async () => {
      const deliveries = await manager.dispatch("cpoe.signed", {});

      expect(deliveries).toEqual([]);
    });

    test("creates delivery records with correct status on success", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      const deliveries = await manager.dispatch("cpoe.signed", { cpoeId: "marque-004" });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].status).toBe("success");
      expect(deliveries[0].attempts).toBe(1);
      expect(deliveries[0].responseStatus).toBe(200);
    });

    test("creates delivery records with failed status on HTTP error", async () => {
      fetchResponse = { status: 500, body: "Internal Server Error" };
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      const deliveries = await manager.dispatch("cpoe.signed", { cpoeId: "marque-005" });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].status).toBe("failed");
      expect(deliveries[0].responseStatus).toBe(500);
      expect(deliveries[0].error).toBeTruthy();
    });

    test("multiple endpoints for same event all receive delivery", async () => {
      manager.registerEndpoint("https://a.com/hook", ["score.changed"]);
      manager.registerEndpoint("https://b.com/hook", ["score.changed"]);
      manager.registerEndpoint("https://c.com/hook", ["score.changed"]);

      const deliveries = await manager.dispatch("score.changed", { newScore: 85 });

      expect(deliveries).toHaveLength(3);
      expect(fetchCalls).toHaveLength(3);
    });

    test("delivery payload has correct structure", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      await manager.dispatch("cpoe.signed", { cpoeId: "marque-006" });

      expect(fetchCalls).toHaveLength(1);
      const body = JSON.parse(fetchCalls[0].init.body as string);
      expect(body.type).toBe("cpoe.signed");
      expect(body.data).toEqual({ cpoeId: "marque-006" });
      expect(body.id).toBeTruthy();
      expect(body.timestamp).toBeTruthy();
      expect(body.apiVersion).toBe("2026-02-13");
    });

    test("delivery includes X-Corsair-Signature header", async () => {
      const ep = manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      await manager.dispatch("cpoe.signed", { cpoeId: "marque-007" });

      expect(fetchCalls).toHaveLength(1);
      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers["X-Corsair-Signature"]).toBeTruthy();

      // Verify the signature is valid
      const body = JSON.parse(fetchCalls[0].init.body as string) as WebhookPayload;
      const sig = headers["X-Corsair-Signature"];
      expect(manager.verifySignature(body, sig, ep.secret)).toBe(true);
    });

    test("delivery includes Content-Type application/json header", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      await manager.dispatch("cpoe.signed", { cpoeId: "marque-008" });

      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    test("dispatch handles fetch network error gracefully", async () => {
      globalThis.fetch = (() => Promise.reject(new Error("Network unreachable"))) as typeof fetch;
      manager.registerEndpoint("https://unreachable.com/hook", ["cpoe.signed"]);

      const deliveries = await manager.dispatch("cpoe.signed", { cpoeId: "marque-009" });

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].status).toBe("failed");
      expect(deliveries[0].error).toContain("Network unreachable");
    });
  });

  // =============================================================================
  // DELIVER (single endpoint)
  // =============================================================================

  describe("deliver", () => {
    test("sends HTTP POST with correct payload and headers", async () => {
      const ep = manager.registerEndpoint("https://target.com/hook", ["cpoe.signed"]);
      const payload: WebhookPayload = {
        id: "del-010",
        type: "cpoe.signed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: { cpoeId: "marque-abc" },
        apiVersion: "2026-02-13",
      };

      const delivery = await manager.deliver(ep, payload);

      expect(delivery.status).toBe("success");
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].init.method).toBe("POST");
    });

    test("returns failed delivery on non-2xx response", async () => {
      fetchResponse = { status: 404, body: "Not Found" };
      const ep = manager.registerEndpoint("https://target.com/hook", ["cpoe.signed"]);
      const payload: WebhookPayload = {
        id: "del-011",
        type: "cpoe.signed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: {},
        apiVersion: "2026-02-13",
      };

      const delivery = await manager.deliver(ep, payload);

      expect(delivery.status).toBe("failed");
      expect(delivery.responseStatus).toBe(404);
    });

    test("captures response body in delivery record", async () => {
      fetchResponse = { status: 400, body: "Bad Request: invalid format" };
      const ep = manager.registerEndpoint("https://target.com/hook", ["cpoe.signed"]);
      const payload: WebhookPayload = {
        id: "del-012",
        type: "cpoe.signed",
        timestamp: "2026-02-13T00:00:00.000Z",
        data: {},
        apiVersion: "2026-02-13",
      };

      const delivery = await manager.deliver(ep, payload);

      expect(delivery.responseBody).toBe("Bad Request: invalid format");
    });
  });

  // =============================================================================
  // RETRY LOGIC
  // =============================================================================

  describe("retryFailed", () => {
    test("retries a failed delivery", async () => {
      // First dispatch fails
      fetchResponse = { status: 500, body: "Server Error" };
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      const deliveries = await manager.dispatch("cpoe.signed", {});
      const failedId = deliveries[0].id;

      // Retry succeeds
      fetchResponse = { status: 200 };
      const retried = await manager.retryFailed(failedId);

      expect(retried).not.toBeNull();
      expect(retried!.status).toBe("success");
      expect(retried!.attempts).toBe(2);
    });

    test("returns null for non-existent delivery ID", async () => {
      const result = await manager.retryFailed("non-existent-id");
      expect(result).toBeNull();
    });

    test("marks delivery as exhausted after max retries", async () => {
      fetchResponse = { status: 500, body: "Server Error" };
      const mgr = new WebhookManager({ maxRetries: 2 });
      globalThis.fetch = mockFetch as typeof fetch;
      mgr.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      // Initial attempt (1)
      const deliveries = await mgr.dispatch("cpoe.signed", {});
      const failedId = deliveries[0].id;

      // Retry 1 (attempt 2 = maxRetries, exhausted)
      const retry1 = await mgr.retryFailed(failedId);
      expect(retry1!.status).toBe("exhausted");
      expect(retry1!.attempts).toBe(2);
    });

    test("calculates exponential backoff for nextRetryAt", async () => {
      fetchResponse = { status: 500, body: "Server Error" };
      const mgr = new WebhookManager({ maxRetries: 5, retryBackoffMs: 1000 });
      globalThis.fetch = mockFetch as typeof fetch;
      mgr.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      const deliveries = await mgr.dispatch("cpoe.signed", {});
      const delivery = deliveries[0];

      // After first failure (attempt 1), nextRetryAt should be ~1s from now
      expect(delivery.nextRetryAt).toBeTruthy();
      const nextRetry = new Date(delivery.nextRetryAt!).getTime();
      const now = Date.now();
      // backoff = 1000 * 2^0 = 1000ms (with some tolerance)
      expect(nextRetry - now).toBeGreaterThan(500);
      expect(nextRetry - now).toBeLessThan(2000);
    });

    test("does not retry a successful delivery", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      const deliveries = await manager.dispatch("cpoe.signed", {});
      const successId = deliveries[0].id;

      const result = await manager.retryFailed(successId);
      expect(result).toBeNull();
    });

    test("does not retry an exhausted delivery", async () => {
      fetchResponse = { status: 500, body: "Server Error" };
      const mgr = new WebhookManager({ maxRetries: 1 });
      globalThis.fetch = mockFetch as typeof fetch;
      mgr.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      const deliveries = await mgr.dispatch("cpoe.signed", {});
      const failedId = deliveries[0].id;

      // Exhaust retries
      await mgr.retryFailed(failedId);

      // Try again after exhausted
      const result = await mgr.retryFailed(failedId);
      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // CONFIG DEFAULTS
  // =============================================================================

  describe("config defaults", () => {
    test("maxRetries defaults to 5", () => {
      const config = manager.getConfig();
      expect(config.maxRetries).toBe(5);
    });

    test("retryBackoffMs defaults to 1000", () => {
      const config = manager.getConfig();
      expect(config.retryBackoffMs).toBe(1000);
    });

    test("timeoutMs defaults to 10000", () => {
      const config = manager.getConfig();
      expect(config.timeoutMs).toBe(10000);
    });

    test("maxEndpoints defaults to 20", () => {
      const config = manager.getConfig();
      expect(config.maxEndpoints).toBe(20);
    });

    test("signatureHeader defaults to X-Corsair-Signature", () => {
      const config = manager.getConfig();
      expect(config.signatureHeader).toBe("X-Corsair-Signature");
    });

    test("custom config overrides defaults", () => {
      const mgr = new WebhookManager({
        maxRetries: 10,
        retryBackoffMs: 2000,
        timeoutMs: 5000,
        maxEndpoints: 50,
        signatureHeader: "X-Custom-Sig",
      });

      const config = mgr.getConfig();
      expect(config.maxRetries).toBe(10);
      expect(config.retryBackoffMs).toBe(2000);
      expect(config.timeoutMs).toBe(5000);
      expect(config.maxEndpoints).toBe(50);
      expect(config.signatureHeader).toBe("X-Custom-Sig");
    });
  });

  // =============================================================================
  // CUSTOM SIGNATURE HEADER
  // =============================================================================

  describe("custom signature header", () => {
    test("uses custom signature header name in delivery", async () => {
      const mgr = new WebhookManager({ signatureHeader: "X-My-Webhook-Sig" });
      globalThis.fetch = mockFetch as typeof fetch;
      mgr.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      await mgr.dispatch("cpoe.signed", {});

      const headers = fetchCalls[0].init.headers as Record<string, string>;
      expect(headers["X-My-Webhook-Sig"]).toBeTruthy();
      expect(headers["X-Corsair-Signature"]).toBeUndefined();
    });
  });

  // =============================================================================
  // DELIVERY RECORDS TRACKING
  // =============================================================================

  describe("getDelivery", () => {
    test("retrieves stored delivery by ID", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);

      const deliveries = await manager.dispatch("cpoe.signed", { cpoeId: "marque-100" });
      const id = deliveries[0].id;

      const stored = manager.getDelivery(id);
      expect(stored).not.toBeNull();
      expect(stored!.id).toBe(id);
      expect(stored!.status).toBe("success");
    });

    test("returns null for non-existent delivery", () => {
      const result = manager.getDelivery("non-existent");
      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // EDGE CASES
  // =============================================================================

  describe("edge cases", () => {
    test("empty events list on endpoint does not crash dispatch", async () => {
      // Register with empty events
      manager.registerEndpoint("https://a.com/hook", []);

      const deliveries = await manager.dispatch("cpoe.signed", {});
      expect(deliveries).toHaveLength(0);
    });

    test("dispatch with all webhook event types works", async () => {
      const allEvents: WebhookEventType[] = [
        "cpoe.signed",
        "cpoe.verified",
        "cpoe.expired",
        "cpoe.revoked",
        "score.changed",
        "score.degraded",
        "drift.detected",
        "key.rotated",
      ];

      manager.registerEndpoint("https://a.com/hook", allEvents);

      for (const event of allEvents) {
        fetchCalls = [];
        const deliveries = await manager.dispatch(event, { event });
        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].status).toBe("success");
      }
    });

    test("removed endpoints do not count toward max endpoints limit", () => {
      const mgr = new WebhookManager({ maxEndpoints: 2 });
      globalThis.fetch = mockFetch as typeof fetch;

      const ep1 = mgr.registerEndpoint("https://a.com/hook", ["cpoe.signed"]);
      mgr.registerEndpoint("https://b.com/hook", ["cpoe.signed"]);
      mgr.removeEndpoint(ep1.id);

      // Should not throw — only 1 active endpoint, limit is 2
      const ep3 = mgr.registerEndpoint("https://c.com/hook", ["cpoe.signed"]);
      expect(ep3.active).toBe(true);
    });

    test("concurrent dispatches to same endpoint produce separate deliveries", async () => {
      manager.registerEndpoint("https://a.com/hook", ["cpoe.signed", "cpoe.expired"]);

      const [d1, d2] = await Promise.all([
        manager.dispatch("cpoe.signed", { id: 1 }),
        manager.dispatch("cpoe.expired", { id: 2 }),
      ]);

      expect(d1).toHaveLength(1);
      expect(d2).toHaveLength(1);
      expect(d1[0].id).not.toBe(d2[0].id);
    });
  });
});
