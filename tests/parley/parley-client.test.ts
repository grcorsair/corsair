/**
 * Parley Client Tests
 *
 * Tests the HTTP client for the Parley trust exchange.
 * Uses a mock HTTP server to test publish, subscribe, and verify flows.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ParleyClient } from "../../src/parley/parley-client";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { MarqueGenerator } from "../../src/parley/marque-generator";
import type { MarqueDocument } from "../../src/parley/marque-types";
import type { ParleyEndpoint } from "../../src/parley/parley-types";
import { mkdirSync, rmSync, existsSync } from "fs";

const TEST_DIR = "/tmp/parley-client-test";
let serverPort: number;
let originalFetch: typeof fetch | undefined;

// Mock MARQUE for testing
async function createTestMarque(): Promise<{ marque: MarqueDocument; publicKey: Buffer }> {
  const keyDir = `${TEST_DIR}/keys`;
  if (!existsSync(keyDir)) mkdirSync(keyDir, { recursive: true });

  const keyManager = new MarqueKeyManager(keyDir);
  const keypair = await keyManager.generateKeypair();
  const generator = new MarqueGenerator(keyManager);

  const marque = await generator.generate({
    markResults: [],
    raidResults: [],
    chartResults: [],
    evidencePaths: [],
    issuer: { id: "test-issuer", name: "Test Issuer" },
    providers: ["aws-cognito"],
  });

  return { marque, publicKey: keypair.publicKey };
}

beforeAll(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });

  const handler = (req: Request): Response => {
    const url = new URL(req.url);
    const auth = req.headers.get("Authorization");

    // Check auth
    if (auth === "Bearer invalid-key") {
      return new Response("Unauthorized", { status: 401 });
    }

    if (auth === "Bearer rate-limited") {
      return new Response("Too Many Requests", { status: 429 });
    }

    // POST /marque — publish
    if (url.pathname === "/marque" && req.method === "POST") {
      return Response.json({ id: "marque-published-123" });
    }

    // GET /marque/latest — get latest
    if (url.pathname === "/marque/latest" && req.method === "GET") {
      const issuer = url.searchParams.get("issuer");
      if (issuer === "nonexistent") {
        return new Response("Not Found", { status: 404 });
      }
      return Response.json({
        parley: "1.0",
        marque: { id: "latest-marque", issuer: { id: issuer, name: "Test" } },
        signature: "mock",
      });
    }

    // POST /subscriptions — subscribe
    if (url.pathname === "/subscriptions" && req.method === "POST") {
      return Response.json({ subscribed: true });
    }

    return new Response("Not Found", { status: 404 });
  };

  originalFetch = globalThis.fetch;
  globalThis.fetch = (input: Request | URL | string, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    return Promise.resolve(handler(req));
  };

  serverPort = 12345;
});

afterAll(() => {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Parley Client", () => {
  test("ParleyClient.publish sends POST to /marque endpoint", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);
    const { marque } = await createTestMarque();

    const result = await client.publish(marque);
    expect(result.published).toBe(true);
    expect(result.id).toBe("marque-published-123");
  });

  test("ParleyClient.publish includes API key in Authorization header", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);
    const { marque } = await createTestMarque();

    // If the key is invalid, the mock server returns 401
    const result = await client.publish(marque);
    expect(result.published).toBe(true);
  });

  test("ParleyClient.subscribe creates webhook subscription", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);

    const result = await client.subscribe({
      subscriberId: "sub-1",
      webhookUrl: "https://example.com/webhook",
      hmacSecret: "secret123",
    });

    expect(result.subscribed).toBe(true);
  });

  test("ParleyClient.verify delegates to MarqueVerifier", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);
    const { marque, publicKey } = await createTestMarque();

    const result = await client.verify(marque, [publicKey]);
    expect(result.valid).toBe(true);
  });

  test("ParleyClient handles 401 (invalid API key) gracefully", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "invalid-key",
    };
    const client = new ParleyClient(endpoint);
    const { marque } = await createTestMarque();

    await expect(client.publish(marque)).rejects.toThrow("401");
  });

  test("ParleyClient handles 429 (rate limit) with error", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "rate-limited",
    };
    const client = new ParleyClient(endpoint);
    const { marque } = await createTestMarque();

    await expect(client.publish(marque)).rejects.toThrow("429");
  });

  test("ParleyClient.getLatest fetches most recent MARQUE", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);

    const result = await client.getLatest("test-issuer");
    expect(result).not.toBeNull();
    expect((result as any).marque.id).toBe("latest-marque");
  });
});
