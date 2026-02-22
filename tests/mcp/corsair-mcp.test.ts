/**
 * Corsair MCP Server Tests
 *
 * Tests for the MCP tool handlers.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { TOOL_DEFINITIONS, handleToolCall } from "../../src/mcp/corsair-mcp-server";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

const tmpDir = join(import.meta.dir, ".tmp-mcp-test");
let keyManager: MarqueKeyManager;
let originalFetch: typeof fetch | undefined;

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });
  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();
  originalFetch = globalThis.fetch;
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

afterEach(() => {
  if (originalFetch) globalThis.fetch = originalFetch;
});

const deps = { get keyManager() { return keyManager; } };

const genericEvidence = {
  metadata: { title: "MCP Test", issuer: "Test", scope: "Test" },
  controls: [
    { id: "c1", description: "MFA", status: "pass", evidence: "OK" },
    { id: "c2", description: "Encryption", status: "fail", evidence: "Not enabled" },
  ],
};

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

describe("MCP tool definitions", () => {
  test("exports 4 tool definitions", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(4);
    const names = TOOL_DEFINITIONS.map(t => t.name);
    expect(names).toContain("corsair_sign");
    expect(names).toContain("corsair_verify");
    expect(names).toContain("corsair_diff");
    expect(names).toContain("corsair_formats");
  });

  test("each tool has name, description, and inputSchema", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe("object");
    }
  });
});

// =============================================================================
// CORSAIR_SIGN
// =============================================================================

describe("corsair_sign tool", () => {
  test("signs generic evidence", async () => {
    const result = await handleToolCall("corsair_sign", { evidence: genericEvidence }, deps);
    expect(result.isError).toBeUndefined();
    const output = JSON.parse(result.content[0].text);
    expect(output.cpoe).toMatch(/^eyJ/);
    expect(output.detectedFormat).toBe("generic");
    expect(output.summary.controlsTested).toBe(2);
  });

  test("supports dry-run", async () => {
    const result = await handleToolCall("corsair_sign", { evidence: genericEvidence, dryRun: true }, deps);
    const output = JSON.parse(result.content[0].text);
    expect(output.cpoe).toContain("dry-run");
  });

  test("supports format override", async () => {
    const result = await handleToolCall("corsair_sign", { evidence: genericEvidence, format: "generic" }, deps);
    const output = JSON.parse(result.content[0].text);
    expect(output.detectedFormat).toBe("generic");
  });

  test("reports errors gracefully", async () => {
    const result = await handleToolCall("corsair_sign", { evidence: "not json {" }, deps);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("error");
  });

  test("supports keyless signing via oidc_token + endpoint", async () => {
    let capturedAuth = "";
    let capturedUrl = "";
    let capturedBody = "";

    globalThis.fetch = async (url: string | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedAuth = String((init?.headers as Record<string, string>)?.Authorization || "");
      capturedBody = String(init?.body || "");
      return new Response(JSON.stringify({ cpoe: "eyJ.test.jwt", detectedFormat: "generic" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await handleToolCall(
      "corsair_sign",
      {
        evidence: genericEvidence,
        oidc_token: "oidc-token-123",
        endpoint: "https://api.example.com",
      },
      deps,
    );

    expect(result.isError).toBeUndefined();
    expect(capturedUrl).toBe("https://api.example.com/sign");
    expect(capturedAuth).toBe("Bearer oidc-token-123");
    expect(capturedBody).toContain("\"evidence\"");
  });
});

// =============================================================================
// CORSAIR_VERIFY
// =============================================================================

describe("corsair_verify tool", () => {
  test("decodes a valid JWT", async () => {
    // First sign something to get a valid JWT
    const signResult = await handleToolCall("corsair_sign", { evidence: genericEvidence }, deps);
    const { cpoe } = JSON.parse(signResult.content[0].text);

    const result = await handleToolCall("corsair_verify", { cpoe }, deps);
    expect(result.isError).toBeUndefined();
    const output = JSON.parse(result.content[0].text);
    expect(output.decoded).toBe(true);
    expect(output.algorithm).toBe("EdDSA");
    expect(output.credentialSubject).toBeDefined();
  });

  test("rejects missing cpoe argument", async () => {
    const result = await handleToolCall("corsair_verify", {}, deps);
    expect(result.isError).toBe(true);
  });

  test("rejects invalid JWT format", async () => {
    const result = await handleToolCall("corsair_verify", { cpoe: "not-a-jwt" }, deps);
    expect(result.isError).toBe(true);
  });
});

// =============================================================================
// CORSAIR_DIFF
// =============================================================================

describe("corsair_diff tool", () => {
  test("compares two CPOEs", async () => {
    const r1 = await handleToolCall("corsair_sign", { evidence: genericEvidence }, deps);
    const jwt1 = JSON.parse(r1.content[0].text).cpoe;

    const r2 = await handleToolCall("corsair_sign", { evidence: genericEvidence }, deps);
    const jwt2 = JSON.parse(r2.content[0].text).cpoe;

    const result = await handleToolCall("corsair_diff", { current: jwt2, previous: jwt1 }, deps);
    expect(result.isError).toBeUndefined();
    const output = JSON.parse(result.content[0].text);
    expect(output.scoreChange).toBeDefined();
    expect(output.hasRegression).toBe(false);
  });

  test("rejects missing arguments", async () => {
    const result = await handleToolCall("corsair_diff", { current: "eyJ..." }, deps);
    expect(result.isError).toBe(true);
  });
});

// =============================================================================
// CORSAIR_FORMATS
// =============================================================================

describe("corsair_formats tool", () => {
  test("lists mapping + generic formats", async () => {
    const result = await handleToolCall("corsair_formats", {}, deps);
    expect(result.isError).toBeUndefined();
    const output = JSON.parse(result.content[0].text);
    expect(output.count).toBe(2);
    expect(output.formats).toHaveLength(2);
    const names = output.formats.map((f: { name: string }) => f.name);
    expect(names).toContain("mapping-pack");
    expect(names).toContain("generic");
  });
});

// =============================================================================
// UNKNOWN TOOL
// =============================================================================

describe("unknown tool", () => {
  test("returns error for unknown tool", async () => {
    const result = await handleToolCall("unknown_tool", {}, deps);
    expect(result.isError).toBe(true);
  });
});
