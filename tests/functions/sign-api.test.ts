/**
 * Sign API Endpoint Tests — TDD
 *
 * Tests for POST /sign endpoint.
 * Covers: all 8 formats, format hint, DID override, enrich, dry-run, error cases.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { createSignRouter } from "../../functions/sign";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

const tmpDir = join(import.meta.dir, ".tmp-sign-api");
let keyManager: MarqueKeyManager;
let router: (req: Request) => Promise<Response>;

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();

  router = createSignRouter({ keyManager, domain: "test.grcorsair.com" });
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELPERS
// =============================================================================

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request("http://localhost/sign", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// =============================================================================
// SAMPLE DATA
// =============================================================================

const genericEvidence = {
  metadata: { title: "API Test", issuer: "Test Corp", date: "2026-02-13", scope: "Production" },
  controls: [
    { id: "C-1", description: "MFA", status: "pass", evidence: "Config verified" },
    { id: "C-2", description: "Encryption", status: "fail", severity: "HIGH", evidence: "Not enabled" },
  ],
};

const prowlerFindings = [
  { StatusCode: "PASS", Severity: "HIGH", FindingInfo: { Uid: "p-001", Title: "Root keys" } },
  { StatusCode: "FAIL", Severity: "CRITICAL", FindingInfo: { Uid: "p-002", Title: "S3 public" } },
];

const securityHubFindings = {
  Findings: [
    { Id: "sh-1", Title: "MFA", Compliance: { Status: "PASSED" }, Severity: { Label: "HIGH" } },
  ],
};

const inspecReport = {
  platform: { name: "aws" },
  profiles: [{ name: "cis", title: "CIS", controls: [
    { id: "cis-1", title: "Root", impact: 1.0, results: [{ status: "passed", code_desc: "OK" }] },
  ] }],
};

const trivyReport = {
  SchemaVersion: 2,
  ArtifactName: "test:latest",
  Results: [{ Target: "Dockerfile", Misconfigurations: [
    { Type: "dockerfile", ID: "DS001", Title: "Root", Severity: "HIGH", Status: "FAIL", Description: "Bad" },
  ] }],
};

const gitlabReport = {
  version: "15.0.0",
  scan: { type: "sast", scanner: { id: "semgrep", name: "Semgrep" }, status: "success" },
  vulnerabilities: [{ id: "gl-1", name: "SQLi", severity: "Critical" }],
};

const cisoAssistantAPI = {
  count: 1, next: null, previous: null,
  results: [{ id: "ca-1", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1", result: "compliant", observation: "OK" }],
};

const cisoAssistantExport = {
  meta: { media_version: "1.0" },
  requirement_assessments: [{ id: "exp-1", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.5.1", result: "compliant" }],
};

// =============================================================================
// FORMAT TESTS
// =============================================================================

describe("POST /sign — all formats", () => {
  test("signs generic JSON", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cpoe).toMatch(/^eyJ/);
    expect(data.detectedFormat).toBe("generic");
    expect(data.summary.controlsTested).toBe(2);
    expect(data.marqueId).toMatch(/^marque-/);
  });

  test("signs Prowler OCSF", async () => {
    const res = await router(makeRequest({ evidence: prowlerFindings }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detectedFormat).toBe("prowler");
  });

  test("signs SecurityHub ASFF", async () => {
    const res = await router(makeRequest({ evidence: securityHubFindings }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detectedFormat).toBe("securityhub");
  });

  test("signs InSpec report", async () => {
    const res = await router(makeRequest({ evidence: inspecReport }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detectedFormat).toBe("inspec");
  });

  test("signs Trivy report", async () => {
    const res = await router(makeRequest({ evidence: trivyReport }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detectedFormat).toBe("trivy");
  });

  test("signs GitLab security report", async () => {
    const res = await router(makeRequest({ evidence: gitlabReport }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detectedFormat).toBe("gitlab");
  });

  test("signs CISO Assistant API", async () => {
    const res = await router(makeRequest({ evidence: cisoAssistantAPI }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detectedFormat).toBe("ciso-assistant");
  });

  test("signs CISO Assistant export", async () => {
    const res = await router(makeRequest({ evidence: cisoAssistantExport }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.detectedFormat).toBe("ciso-assistant");
  });
});

// =============================================================================
// OPTIONS
// =============================================================================

describe("POST /sign — options", () => {
  test("accepts format hint", async () => {
    const res = await router(makeRequest({ evidence: prowlerFindings, format: "prowler" }));
    const data = await res.json();
    expect(data.detectedFormat).toBe("prowler");
  });

  test("accepts DID override", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, did: "did:web:acme.com" }));
    const data = await res.json();
    const parts = data.cpoe.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.iss).toBe("did:web:acme.com");
  });

  test("accepts scope override", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, scope: "Custom Scope" }));
    const data = await res.json();
    const parts = data.cpoe.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.vc.credentialSubject.scope).toBe("Custom Scope");
  });

  test("accepts dry-run flag", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence, dryRun: true }));
    const data = await res.json();
    expect(data.cpoe).toBe("");
    expect(data.summary.controlsTested).toBe(2);
  });

  test("returns expiresAt in response", async () => {
    const res = await router(makeRequest({ evidence: genericEvidence }));
    const data = await res.json();
    expect(data.expiresAt).toBeDefined();
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe("POST /sign — error handling", () => {
  test("rejects non-POST", async () => {
    const req = new Request("http://localhost/sign", { method: "GET" });
    const res = await router(req);
    expect(res.status).toBe(405);
  });

  test("rejects empty body", async () => {
    const req = new Request("http://localhost/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("evidence");
  });

  test("rejects invalid JSON body", async () => {
    const req = new Request("http://localhost/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const res = await router(req);
    expect(res.status).toBe(400);
  });

  test("rejects oversized evidence", async () => {
    const bigEvidence = { data: "x".repeat(600_000) };
    const res = await router(makeRequest({ evidence: bigEvidence }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("size");
  });
});

// =============================================================================
// IDEMPOTENCY
// =============================================================================

describe("POST /sign — idempotency", () => {
  test("returns cached response for same idempotency key", async () => {
    const key = `test-idem-${Date.now()}`;
    const res1 = await router(makeRequest({ evidence: genericEvidence }, { "x-idempotency-key": key }));
    const data1 = await res1.json();

    const res2 = await router(makeRequest({ evidence: genericEvidence }, { "x-idempotency-key": key }));
    const data2 = await res2.json();

    expect(data1.marqueId).toBe(data2.marqueId);
    expect(data1.cpoe).toBe(data2.cpoe);
  });
});
