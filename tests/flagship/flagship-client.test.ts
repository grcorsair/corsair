/**
 * FLAGSHIP Client Tests
 *
 * Tests the HTTP client for SET token delivery.
 * Uses a mock HTTP server (Bun.serve) to test push, poll, and acknowledge flows.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { FlagshipClient } from "../../src/flagship/flagship-client";

let mockServer: ReturnType<typeof Bun.serve> | null = null;
let serverPort: number;

// Pending events for the poll endpoint
const pendingEvents = new Map<string, string[]>();

beforeAll(() => {
  // Seed some pending events
  pendingEvents.set("stream-001", ["set-jwt-token-1", "set-jwt-token-2"]);

  mockServer = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const auth = req.headers.get("Authorization");

      // 401 Unauthorized
      if (auth === "Bearer invalid-key") {
        return new Response("Unauthorized", { status: 401 });
      }

      // 429 Rate Limited
      if (auth === "Bearer rate-limited") {
        return new Response("Too Many Requests", { status: 429 });
      }

      // POST to any endpoint (push delivery)
      if (req.method === "POST" && url.pathname.startsWith("/events")) {
        const contentType = req.headers.get("Content-Type");
        if (contentType !== "application/secevent+jwt") {
          return new Response("Bad Content-Type", { status: 400 });
        }
        return new Response("", { status: 202 });
      }

      // GET /streams/:streamId/events (poll delivery)
      if (req.method === "GET" && url.pathname.match(/\/streams\/[^/]+\/events/)) {
        const parts = url.pathname.split("/");
        const streamId = parts[2];
        const sets = pendingEvents.get(streamId) || [];
        return Response.json({ sets });
      }

      // POST /streams/:streamId/acknowledge (ack)
      if (req.method === "POST" && url.pathname.match(/\/streams\/[^/]+\/acknowledge/)) {
        return new Response("", { status: 202 });
      }

      // 500 Internal Server Error endpoint for error handling tests
      if (url.pathname === "/error-500") {
        return new Response("Internal Server Error", { status: 500 });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  serverPort = mockServer.port;
});

afterAll(() => {
  mockServer?.stop();
});

describe("FlagshipClient", () => {
  describe("pushEvent", () => {
    test("sends SET to receiver endpoint via POST", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "valid-key",
      );

      const result = await client.pushEvent(
        `http://localhost:${serverPort}/events`,
        "eyJhbGciOiJFZERTQSJ9.test.signature",
      );

      expect(result.delivered).toBe(true);
    });

    test("uses application/secevent+jwt content type", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "valid-key",
      );

      // The mock server checks Content-Type; if wrong, returns 400
      const result = await client.pushEvent(
        `http://localhost:${serverPort}/events`,
        "eyJhbGciOiJFZERTQSJ9.test.signature",
      );

      expect(result.delivered).toBe(true);
    });

    test("handles 401 unauthorized error", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "invalid-key",
      );

      await expect(
        client.pushEvent(
          `http://localhost:${serverPort}/events`,
          "eyJhbGciOiJFZERTQSJ9.test.signature",
        ),
      ).rejects.toThrow("401");
    });

    test("handles 429 rate limit error", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "rate-limited",
      );

      await expect(
        client.pushEvent(
          `http://localhost:${serverPort}/events`,
          "eyJhbGciOiJFZERTQSJ9.test.signature",
        ),
      ).rejects.toThrow("429");
    });

    test("handles 5xx server error", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "valid-key",
      );

      await expect(
        client.pushEvent(
          `http://localhost:${serverPort}/error-500`,
          "eyJhbGciOiJFZERTQSJ9.test.signature",
        ),
      ).rejects.toThrow("500");
    });
  });

  describe("pollEvents", () => {
    test("retrieves pending SET tokens for a stream", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "valid-key",
      );

      const result = await client.pollEvents("stream-001");

      expect(result.sets).toHaveLength(2);
      expect(result.sets[0]).toBe("set-jwt-token-1");
      expect(result.sets[1]).toBe("set-jwt-token-2");
    });

    test("returns empty array for stream with no pending events", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "valid-key",
      );

      const result = await client.pollEvents("stream-empty");
      expect(result.sets).toEqual([]);
    });
  });

  describe("acknowledgeEvent", () => {
    test("sends acknowledgment for a received SET", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "valid-key",
      );

      // Should not throw
      await client.acknowledgeEvent("stream-001", "set-jti-001");
    });

    test("handles 401 unauthorized on acknowledge", async () => {
      const client = new FlagshipClient(
        `http://localhost:${serverPort}`,
        "invalid-key",
      );

      await expect(
        client.acknowledgeEvent("stream-001", "set-jti-001"),
      ).rejects.toThrow("401");
    });
  });
});
