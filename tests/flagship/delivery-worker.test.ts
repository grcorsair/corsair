/**
 * Delivery Worker + Enhanced FlagshipClient Tests
 *
 * Tests delivery queue processing, retry with exponential backoff,
 * max attempts expiration, and circuit breaker behavior.
 *
 * Uses mock fetch and in-memory event queue simulation.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { FlagshipClient } from "../../src/flagship/flagship-client";
import {
  processDeliveryQueue,
  type EventQueueRow,
  type DeliveryQueueDeps,
} from "../../functions/ssf-delivery-worker";

// =============================================================================
// HELPERS
// =============================================================================

/** Create a mock fetch that records calls and returns configured responses */
function createMockFetch(responses: Array<{ status: number; headers?: Record<string, string> }>) {
  let callIndex = 0;
  const calls: Array<{ url: string; init: RequestInit }> = [];

  const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    calls.push({ url: urlStr, init: init || {} });
    const responseConfig = responses[Math.min(callIndex++, responses.length - 1)];
    const headers = new Headers(responseConfig.headers || {});
    headers.set("content-type", "text/plain");
    return new Response("", { status: responseConfig.status, headers });
  };

  return { mockFetch: mockFetch as typeof globalThis.fetch, calls };
}

// =============================================================================
// FLAGSHIP CLIENT ENHANCEMENTS
// =============================================================================

describe("FlagshipClient - Retry and Circuit Breaker", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("successful push returns delivered=true without retry", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 202 }]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key");
    const result = await client.pushEvent("http://test/events", "set-token");

    expect(result.delivered).toBe(true);
    expect(calls).toHaveLength(1);
  });

  test("retries on 5xx with exponential backoff", async () => {
    const { mockFetch, calls } = createMockFetch([
      { status: 500 },
      { status: 500 },
      { status: 202 },
    ]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 3,
      baseDelayMs: 1, // 1ms for fast tests
    });
    const result = await client.pushEvent("http://test/events", "set-token");

    expect(result.delivered).toBe(true);
    expect(calls).toHaveLength(3); // 2 failures + 1 success
  });

  test("throws after exhausting all retries on 5xx", async () => {
    const { mockFetch, calls } = createMockFetch([
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
    ]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 3,
      baseDelayMs: 1,
    });

    await expect(
      client.pushEvent("http://test/events", "set-token"),
    ).rejects.toThrow();
    // Initial attempt + 3 retries = 4 total
    expect(calls).toHaveLength(4);
  });

  test("respects Retry-After header on 429", async () => {
    const { mockFetch, calls } = createMockFetch([
      { status: 429, headers: { "Retry-After": "1" } },
      { status: 202 },
    ]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 3,
      baseDelayMs: 1,
    });
    const result = await client.pushEvent("http://test/events", "set-token");

    expect(result.delivered).toBe(true);
    expect(calls).toHaveLength(2);
  });

  test("429 without Retry-After uses exponential backoff", async () => {
    const { mockFetch, calls } = createMockFetch([
      { status: 429 },
      { status: 202 },
    ]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 3,
      baseDelayMs: 1,
    });
    const result = await client.pushEvent("http://test/events", "set-token");

    expect(result.delivered).toBe(true);
    expect(calls).toHaveLength(2);
  });

  test("does not retry on 401 (non-transient)", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 401 }]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 3,
      baseDelayMs: 1,
    });

    await expect(
      client.pushEvent("http://test/events", "set-token"),
    ).rejects.toThrow("401");
    expect(calls).toHaveLength(1); // No retries
  });

  test("does not retry on 400 (non-transient)", async () => {
    const { mockFetch, calls } = createMockFetch([{ status: 400 }]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 3,
      baseDelayMs: 1,
    });

    await expect(
      client.pushEvent("http://test/events", "set-token"),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  test("circuit breaker pauses after consecutive failures", async () => {
    const { mockFetch } = createMockFetch([
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 500 },
    ]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 0, // No retries, just track failures
      baseDelayMs: 1,
      circuitBreakerThreshold: 3,
      circuitBreakerPauseMs: 60000,
    });

    // Fail 3 times to trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await client.pushEvent("http://test/events", `token-${i}`);
      } catch {
        // Expected failures
      }
    }

    // 4th attempt should be rejected by circuit breaker without making a request
    await expect(
      client.pushEvent("http://test/events", "token-blocked"),
    ).rejects.toThrow(/circuit breaker/i);
  });

  test("circuit breaker resets after pause period", async () => {
    const { mockFetch } = createMockFetch([
      { status: 500 },
      { status: 500 },
      { status: 500 },
      { status: 202 }, // This should succeed after breaker resets
    ]);
    globalThis.fetch = mockFetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 0,
      baseDelayMs: 1,
      circuitBreakerThreshold: 3,
      circuitBreakerPauseMs: 1, // 1ms pause for fast test
    });

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await client.pushEvent("http://test/events", `token-${i}`);
      } catch {
        // Expected
      }
    }

    // Wait for breaker to reset
    await new Promise((r) => setTimeout(r, 5));

    // Should work now
    const result = await client.pushEvent("http://test/events", "token-ok");
    expect(result.delivered).toBe(true);
  });

  test("uses AbortSignal timeout on requests", async () => {
    // Create a fetch that respects AbortSignal and hangs until aborted
    globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) {
            reject(signal.reason || new DOMException("Aborted", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () => {
            reject(signal.reason || new DOMException("Aborted", "AbortError"));
          });
        }
        // Never resolve — simulates a hanging server
      });
    }) as typeof globalThis.fetch;

    const client = new FlagshipClient("http://test", "key", {
      maxRetries: 0,
      baseDelayMs: 1,
      timeoutMs: 50, // 50ms timeout
    });

    await expect(
      client.pushEvent("http://test/events", "set-token"),
    ).rejects.toThrow();
  });
});

// =============================================================================
// DELIVERY WORKER
// =============================================================================

describe("Delivery Worker - processDeliveryQueue", () => {
  test("delivers pending events successfully", async () => {
    const events: EventQueueRow[] = [
      {
        id: 1,
        stream_id: "stream-1",
        set_token: "eyJ0est.token.sig",
        jti: "jti-001",
        status: "pending",
        attempts: 0,
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
    ];

    const streamConfigs = new Map<string, { endpoint_url: string }>();
    streamConfigs.set("stream-1", {
      endpoint_url: "https://receiver.example.com/events",
    });

    const updates: Array<{
      id: number;
      status: string;
      attempts: number;
      next_retry?: string;
      delivered_at?: string;
    }> = [];

    const deps: DeliveryQueueDeps = {
      fetchPendingEvents: async () => events,
      getStreamConfig: async (streamId: string) =>
        streamConfigs.get(streamId) || null,
      updateEvent: async (update) => {
        updates.push(update);
      },
      pushEvent: async (_endpoint: string, _setToken: string) => ({
        delivered: true,
      }),
    };

    const result = await processDeliveryQueue(deps);

    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("delivered");
    expect(updates[0].delivered_at).toBeDefined();
  });

  test("retries failed events with backoff", async () => {
    const events: EventQueueRow[] = [
      {
        id: 2,
        stream_id: "stream-2",
        set_token: "eyJ0est.token.sig",
        jti: "jti-002",
        status: "pending",
        attempts: 1,
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
    ];

    const streamConfigs = new Map<string, { endpoint_url: string }>();
    streamConfigs.set("stream-2", {
      endpoint_url: "https://receiver.example.com/events",
    });

    const updates: Array<{
      id: number;
      status: string;
      attempts: number;
      next_retry?: string;
    }> = [];

    const deps: DeliveryQueueDeps = {
      fetchPendingEvents: async () => events,
      getStreamConfig: async (streamId: string) =>
        streamConfigs.get(streamId) || null,
      updateEvent: async (update) => {
        updates.push(update);
      },
      pushEvent: async () => {
        throw new Error("Push failed: 500");
      },
    };

    const result = await processDeliveryQueue(deps);

    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("pending"); // Still pending for retry
    expect(updates[0].attempts).toBe(2); // Incremented
    expect(updates[0].next_retry).toBeDefined();

    // Verify exponential backoff: next_retry should be in the future
    const nextRetry = new Date(updates[0].next_retry!);
    expect(nextRetry.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  test("marks event as expired after max_attempts", async () => {
    const events: EventQueueRow[] = [
      {
        id: 3,
        stream_id: "stream-3",
        set_token: "eyJ0est.token.sig",
        jti: "jti-003",
        status: "pending",
        attempts: 4, // One away from max
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
    ];

    const streamConfigs = new Map<string, { endpoint_url: string }>();
    streamConfigs.set("stream-3", {
      endpoint_url: "https://receiver.example.com/events",
    });

    const updates: Array<{
      id: number;
      status: string;
      attempts: number;
    }> = [];

    const deps: DeliveryQueueDeps = {
      fetchPendingEvents: async () => events,
      getStreamConfig: async (streamId: string) =>
        streamConfigs.get(streamId) || null,
      updateEvent: async (update) => {
        updates.push(update);
      },
      pushEvent: async () => {
        throw new Error("Push failed: 500");
      },
    };

    const result = await processDeliveryQueue(deps);

    expect(result.processed).toBe(1);
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.expired).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe("expired");
    expect(updates[0].attempts).toBe(5);
  });

  test("skips events with unknown stream config", async () => {
    const events: EventQueueRow[] = [
      {
        id: 4,
        stream_id: "unknown-stream",
        set_token: "eyJ0est.token.sig",
        jti: "jti-004",
        status: "pending",
        attempts: 0,
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
    ];

    const updates: Array<{ id: number; status: string }> = [];

    const deps: DeliveryQueueDeps = {
      fetchPendingEvents: async () => events,
      getStreamConfig: async () => null, // Stream not found
      updateEvent: async (update) => {
        updates.push(update);
      },
      pushEvent: async () => ({ delivered: true }),
    };

    const result = await processDeliveryQueue(deps);

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.delivered).toBe(0);
  });

  test("processes multiple events in one batch", async () => {
    const events: EventQueueRow[] = [
      {
        id: 10,
        stream_id: "stream-a",
        set_token: "token-a",
        jti: "jti-a",
        status: "pending",
        attempts: 0,
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
      {
        id: 11,
        stream_id: "stream-a",
        set_token: "token-b",
        jti: "jti-b",
        status: "pending",
        attempts: 0,
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
      {
        id: 12,
        stream_id: "stream-a",
        set_token: "token-c",
        jti: "jti-c",
        status: "pending",
        attempts: 0,
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
    ];

    const streamConfigs = new Map<string, { endpoint_url: string }>();
    streamConfigs.set("stream-a", {
      endpoint_url: "https://receiver.example.com/events",
    });

    const updates: Array<{ id: number; status: string }> = [];

    const deps: DeliveryQueueDeps = {
      fetchPendingEvents: async () => events,
      getStreamConfig: async (streamId: string) =>
        streamConfigs.get(streamId) || null,
      updateEvent: async (update) => {
        updates.push(update);
      },
      pushEvent: async () => ({ delivered: true }),
    };

    const result = await processDeliveryQueue(deps);

    expect(result.processed).toBe(3);
    expect(result.delivered).toBe(3);
    expect(updates).toHaveLength(3);
  });

  test("handles empty queue gracefully", async () => {
    const deps: DeliveryQueueDeps = {
      fetchPendingEvents: async () => [],
      getStreamConfig: async () => null,
      updateEvent: async () => {},
      pushEvent: async () => ({ delivered: true }),
    };

    const result = await processDeliveryQueue(deps);

    expect(result.processed).toBe(0);
    expect(result.delivered).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.expired).toBe(0);
  });

  test("backoff formula produces correct delays", async () => {
    // attempts=0 → 2^0 * 1000 = 1s
    // attempts=1 → 2^1 * 1000 = 2s
    // attempts=2 → 2^2 * 1000 = 4s
    // attempts=3 → 2^3 * 1000 = 8s
    const events: EventQueueRow[] = [
      {
        id: 20,
        stream_id: "stream-x",
        set_token: "token",
        jti: "jti-x",
        status: "pending",
        attempts: 2, // Will become 3 after failure
        max_attempts: 5,
        next_retry: new Date().toISOString(),
      },
    ];

    const streamConfigs = new Map<string, { endpoint_url: string }>();
    streamConfigs.set("stream-x", {
      endpoint_url: "https://receiver.example.com/events",
    });

    const updates: Array<{ id: number; next_retry?: string }> = [];

    const deps: DeliveryQueueDeps = {
      fetchPendingEvents: async () => events,
      getStreamConfig: async (streamId: string) =>
        streamConfigs.get(streamId) || null,
      updateEvent: async (update) => {
        updates.push(update);
      },
      pushEvent: async () => {
        throw new Error("fail");
      },
    };

    const before = Date.now();
    await processDeliveryQueue(deps);
    const after = Date.now();

    expect(updates).toHaveLength(1);
    const nextRetry = new Date(updates[0].next_retry!).getTime();
    // 2^3 * 1000 = 8000ms backoff from "now"
    // Allow 2s of timing tolerance
    expect(nextRetry).toBeGreaterThanOrEqual(before + 7000);
    expect(nextRetry).toBeLessThanOrEqual(after + 10000);
  });
});
