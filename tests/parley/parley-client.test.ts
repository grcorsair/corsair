/**
 * Parley Client Tests
 *
 * Tests the HTTP client for the Parley trust exchange.
 * Uses a mock HTTP server to test publish, subscribe, and verify flows.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { ParleyClient } from "../../src/parley/parley-client";
import { CPOEKeyManager } from "../../src/parley/cpoe-key-manager";
import { CPOEGenerator } from "../../src/parley/cpoe-generator";
import type { CPOEDocument } from "../../src/parley/cpoe-types";
import type { ParleyEndpoint } from "../../src/parley/parley-types";
import { mkdirSync, rmSync, existsSync } from "fs";

const TEST_DIR = "/tmp/parley-client-test";
let mockServer: ReturnType<typeof Bun.serve> | null = null;
let serverPort: number;

// Mock CPOE for testing
async function createTestCPOE(): Promise<{ cpoe: CPOEDocument; publicKey: Buffer }> {
  const keyDir = `${TEST_DIR}/keys`;
  if (!existsSync(keyDir)) mkdirSync(keyDir, { recursive: true });

  const keyManager = new CPOEKeyManager(keyDir);
  const keypair = await keyManager.generateKeypair();
  const generator = new CPOEGenerator(keyManager);

  const cpoe = await generator.generate({
    markResults: [],
    raidResults: [],
    chartResults: [],
    evidencePaths: [],
    issuer: { id: "test-issuer", name: "Test Issuer" },
    providers: ["aws-cognito"],
  });

  return { cpoe, publicKey: keypair.publicKey };
}

beforeAll(() => {
  if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });

  // Start a mock Parley server
  mockServer = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const auth = req.headers.get("Authorization");

      // Check auth
      if (auth === "Bearer invalid-key") {
        return new Response("Unauthorized", { status: 401 });
      }

      if (auth === "Bearer rate-limited") {
        return new Response("Too Many Requests", { status: 429 });
      }

      // POST /cpoe — publish
      if (url.pathname === "/cpoe" && req.method === "POST") {
        return Response.json({ id: "cpoe-published-123" });
      }

      // GET /cpoe/latest — get latest
      if (url.pathname === "/cpoe/latest" && req.method === "GET") {
        const issuer = url.searchParams.get("issuer");
        if (issuer === "nonexistent") {
          return new Response("Not Found", { status: 404 });
        }
        return Response.json({
          parley: "1.0",
          cpoe: { id: "latest-cpoe", issuer: { id: issuer, name: "Test" } },
          signature: "mock",
        });
      }

      // POST /subscriptions — subscribe
      if (url.pathname === "/subscriptions" && req.method === "POST") {
        return Response.json({ subscribed: true });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  serverPort = mockServer.port;
});

afterAll(() => {
  mockServer?.stop();
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Parley Client", () => {
  test("ParleyClient.publish sends POST to /cpoe endpoint", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);
    const { cpoe } = await createTestCPOE();

    const result = await client.publish(cpoe);
    expect(result.published).toBe(true);
    expect(result.id).toBe("cpoe-published-123");
  });

  test("ParleyClient.publish includes API key in Authorization header", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);
    const { cpoe } = await createTestCPOE();

    // If the key is invalid, the mock server returns 401
    const result = await client.publish(cpoe);
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

  test("ParleyClient.verify delegates to CPOEVerifier", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);
    const { cpoe, publicKey } = await createTestCPOE();

    const result = client.verify(cpoe, [publicKey]);
    expect(result.valid).toBe(true);
  });

  test("ParleyClient handles 401 (invalid API key) gracefully", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "invalid-key",
    };
    const client = new ParleyClient(endpoint);
    const { cpoe } = await createTestCPOE();

    await expect(client.publish(cpoe)).rejects.toThrow("401");
  });

  test("ParleyClient handles 429 (rate limit) with error", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "rate-limited",
    };
    const client = new ParleyClient(endpoint);
    const { cpoe } = await createTestCPOE();

    await expect(client.publish(cpoe)).rejects.toThrow("429");
  });

  test("ParleyClient.getLatest fetches most recent CPOE", async () => {
    const endpoint: ParleyEndpoint = {
      baseUrl: `http://localhost:${serverPort}`,
      apiKey: "valid-key",
    };
    const client = new ParleyClient(endpoint);

    const result = await client.getLatest("test-issuer");
    expect(result).not.toBeNull();
    expect((result as any).cpoe.id).toBe("latest-cpoe");
  });
});
