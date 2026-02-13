/**
 * Webhook Dispatch Hooks Tests
 *
 * Tests the integration layer that wires webhook dispatch into the
 * CPOE lifecycle. Covers singleton management, event dispatch helpers,
 * no-endpoint safety, and event routing.
 *
 * HTTP calls are mocked via globalThis.fetch override -- no real network.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  getWebhookManager,
  dispatchCPOEEvent,
  onCPOESigned,
  onScoreChanged,
  onDriftDetected,
  onCPOEExpired,
} from "../../src/webhooks/dispatch-hooks";

// =============================================================================
// FETCH MOCK
// =============================================================================

const originalFetch = globalThis.fetch;
let fetchCalls: Array<{ url: string; body: string }> = [];
let fetchResponse: { status: number; body?: string } = { status: 200 };

function mockFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
  fetchCalls.push({ url: urlStr, body: (init?.body as string) ?? "" });
  return Promise.resolve(
    new Response(fetchResponse.body ?? "", { status: fetchResponse.status }),
  );
}

beforeEach(() => {
  fetchCalls = [];
  fetchResponse = { status: 200 };
  globalThis.fetch = mockFetch as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// =============================================================================
// SINGLETON
// =============================================================================

describe("Dispatch Hooks -- Singleton", () => {
  test("getWebhookManager returns a WebhookManager instance", () => {
    const manager = getWebhookManager();
    expect(manager).toBeDefined();
    expect(typeof manager.dispatch).toBe("function");
    expect(typeof manager.registerEndpoint).toBe("function");
    expect(typeof manager.listEndpoints).toBe("function");
  });

  test("getWebhookManager returns the same instance on repeated calls", () => {
    const manager1 = getWebhookManager();
    const manager2 = getWebhookManager();
    expect(manager1).toBe(manager2);
  });
});

// =============================================================================
// DISPATCH WITH NO ENDPOINTS
// =============================================================================

describe("Dispatch Hooks -- No Endpoints Safety", () => {
  test("dispatchCPOEEvent with no endpoints does not crash", async () => {
    // Should complete without throwing
    await dispatchCPOEEvent("cpoe.signed", { cpoeId: "test-123" });
    // No fetch calls should have been made
    expect(fetchCalls.length).toBe(0);
  });

  test("onCPOESigned with no endpoints does not crash", async () => {
    await onCPOESigned("cpoe-1", "did:web:test.com", "SOC 2");
    expect(fetchCalls.length).toBe(0);
  });

  test("onScoreChanged with no endpoints does not crash", async () => {
    await onScoreChanged("cpoe-1", 80, 90);
    expect(fetchCalls.length).toBe(0);
  });

  test("onDriftDetected with no endpoints does not crash", async () => {
    await onDriftDetected("cert-1", -5, "Review compliance posture");
    expect(fetchCalls.length).toBe(0);
  });

  test("onCPOEExpired with no endpoints does not crash", async () => {
    await onCPOEExpired("cpoe-1", "2026-02-01T00:00:00Z");
    expect(fetchCalls.length).toBe(0);
  });
});

// =============================================================================
// EVENT DISPATCH WITH ENDPOINTS
// =============================================================================

describe("Dispatch Hooks -- Event Routing", () => {
  test("onCPOESigned dispatches cpoe.signed event to registered endpoint", async () => {
    const manager = getWebhookManager();
    manager.registerEndpoint("https://hooks.example.com/cpoe", ["cpoe.signed"]);

    await onCPOESigned("cpoe-abc", "did:web:grcorsair.com", "SOC 2 Type II");

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe("https://hooks.example.com/cpoe");

    const payload = JSON.parse(fetchCalls[0].body);
    expect(payload.type).toBe("cpoe.signed");
    expect(payload.data.cpoeId).toBe("cpoe-abc");
    expect(payload.data.issuer).toBe("did:web:grcorsair.com");
    expect(payload.data.scope).toBe("SOC 2 Type II");
    expect(payload.data.signedAt).toBeDefined();
  });

  test("onScoreChanged dispatches score.changed with old and new scores", async () => {
    const manager = getWebhookManager();
    manager.registerEndpoint("https://hooks.example.com/score", ["score.changed"]);

    await onScoreChanged("cpoe-def", 75, 85);

    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);

    // Find the score.changed call (there may be prior cpoe.signed endpoints)
    const scoreCalls = fetchCalls.filter(c => {
      const body = JSON.parse(c.body);
      return body.type === "score.changed";
    });
    expect(scoreCalls.length).toBe(1);

    const payload = JSON.parse(scoreCalls[0].body);
    expect(payload.data.oldScore).toBe(75);
    expect(payload.data.newScore).toBe(85);
    expect(payload.data.changedAt).toBeDefined();
  });

  test("onDriftDetected dispatches drift.detected with recommendation", async () => {
    const manager = getWebhookManager();
    manager.registerEndpoint("https://hooks.example.com/drift", ["drift.detected"]);

    await onDriftDetected("cert-xyz", -10, "Investigate control regression");

    const driftCalls = fetchCalls.filter(c => {
      const body = JSON.parse(c.body);
      return body.type === "drift.detected";
    });
    expect(driftCalls.length).toBe(1);

    const payload = JSON.parse(driftCalls[0].body);
    expect(payload.data.certId).toBe("cert-xyz");
    expect(payload.data.scoreDelta).toBe(-10);
    expect(payload.data.recommendation).toBe("Investigate control regression");
    expect(payload.data.detectedAt).toBeDefined();
  });

  test("onCPOEExpired dispatches cpoe.expired with expiredAt", async () => {
    const manager = getWebhookManager();
    manager.registerEndpoint("https://hooks.example.com/expired", ["cpoe.expired"]);

    await onCPOEExpired("cpoe-old", "2026-01-15T00:00:00Z");

    const expCalls = fetchCalls.filter(c => {
      const body = JSON.parse(c.body);
      return body.type === "cpoe.expired";
    });
    expect(expCalls.length).toBe(1);

    const payload = JSON.parse(expCalls[0].body);
    expect(payload.data.cpoeId).toBe("cpoe-old");
    expect(payload.data.expiredAt).toBe("2026-01-15T00:00:00Z");
  });

  test("events only route to endpoints subscribed to that event type", async () => {
    const manager = getWebhookManager();
    // Register an endpoint that only listens for key.rotated
    manager.registerEndpoint("https://hooks.example.com/keys-only", ["key.rotated"]);

    // Reset calls
    fetchCalls = [];

    // Dispatch a cpoe.signed event -- should NOT reach keys-only endpoint
    await dispatchCPOEEvent("cpoe.signed", { test: true });

    // Keys-only endpoint should not have been called for cpoe.signed
    // (it may be called if there are other endpoints from earlier tests that subscribed to cpoe.signed)
    const keysOnlyCalls = fetchCalls.filter(c => c.url === "https://hooks.example.com/keys-only");
    expect(keysOnlyCalls.length).toBe(0);
  });

  test("multiple events dispatch independently", async () => {
    const manager = getWebhookManager();
    // Register a catch-all endpoint for testing
    manager.registerEndpoint("https://hooks.example.com/all", [
      "cpoe.signed",
      "score.changed",
      "drift.detected",
      "cpoe.expired",
    ]);

    fetchCalls = [];

    await onCPOESigned("id1", "iss1", "scope1");
    await onScoreChanged("id2", 50, 60);

    // Should have calls for both events (at least)
    const bodies = fetchCalls.map(c => JSON.parse(c.body));
    const signedEvents = bodies.filter(b => b.type === "cpoe.signed");
    const changedEvents = bodies.filter(b => b.type === "score.changed");

    expect(signedEvents.length).toBeGreaterThanOrEqual(1);
    expect(changedEvents.length).toBeGreaterThanOrEqual(1);
  });

  test("manager state persists across calls", async () => {
    // The singleton should still have endpoints from previous tests
    const manager = getWebhookManager();
    const endpoints = manager.listEndpoints();
    expect(endpoints.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// PAYLOAD STRUCTURE
// =============================================================================

describe("Dispatch Hooks -- Payload Structure", () => {
  test("dispatched payload includes id, type, timestamp, data, apiVersion", async () => {
    const manager = getWebhookManager();
    // Reset fetch calls
    fetchCalls = [];

    // Use the catch-all endpoint registered in previous tests
    await onCPOESigned("verify-payload", "did:web:test.com", "Test");

    const signedCalls = fetchCalls.filter(c => {
      const body = JSON.parse(c.body);
      return body.type === "cpoe.signed" && body.data?.cpoeId === "verify-payload";
    });
    expect(signedCalls.length).toBeGreaterThanOrEqual(1);

    const payload = JSON.parse(signedCalls[0].body);
    expect(payload).toHaveProperty("id");
    expect(payload).toHaveProperty("type");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("data");
    expect(payload).toHaveProperty("apiVersion");
  });
});
