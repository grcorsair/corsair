/**
 * Sign Core Tests — TDD
 *
 * Tests for the shared signEvidence() engine.
 * Covers: generic format, mapping registry, dry-run, format override, warnings, error handling.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { signEvidence, SignError } from "../../src/sign/sign-core";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { resetMappingRegistry } from "../../src/ingestion/mapping-registry";

const tmpDir = join(import.meta.dir, ".tmp-sign-core");
let keyManager: MarqueKeyManager;

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// SAMPLE DATA
// =============================================================================

const genericEvidence = {
  metadata: {
    title: "Q1 2026 Security Assessment",
    issuer: "Acme Corp",
    date: "2026-01-15",
    scope: "AWS Production",
  },
  controls: [
    { id: "MFA-001", description: "MFA enabled", status: "pass", evidence: "Okta config", framework: "NIST-800-53", controlId: "IA-2" },
    { id: "ENC-001", description: "Encryption at rest", status: "pass", evidence: "S3 config" },
    { id: "LOG-001", description: "Audit logging", status: "fail", severity: "HIGH", evidence: "CloudTrail disabled" },
  ],
};

// =============================================================================
// CORE SIGNING — GENERIC + MAPPING
// =============================================================================

describe("signEvidence — generic", () => {
  test("signs generic JSON evidence", async () => {
    const result = await signEvidence({ evidence: genericEvidence }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("generic");
    expect(result.summary.controlsTested).toBe(3);
    expect(result.summary.controlsPassed).toBe(2);
    expect(result.summary.controlsFailed).toBe(1);
    expect(result.provenance.source).toBe("tool");
    expect(result.warnings).toHaveLength(0);
  });

  test("accepts JSON string input", async () => {
    const result = await signEvidence({ evidence: JSON.stringify(genericEvidence) }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
  });

  test("respects source override for provenance", async () => {
    const result = await signEvidence({ evidence: genericEvidence, source: "manual" }, keyManager);
    expect(result.provenance.source).toBe("self");
  });

  test("attaches OIDC delegation metadata when provided", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      authContext: {
        oidc: {
          issuer: "https://issuer.example.com",
          subject: "agent-123",
          subjectHash: "hash-subject",
          audience: ["corsair-sign"],
          tokenHash: "hash-token",
          verifiedAt: "2026-02-22T00:00:00Z",
          identity: { email: "agent@example.com", name: "Agent 123" },
        },
      },
    }, keyManager);
    const ext = result.extensions as Record<string, unknown>;
    expect(ext).toBeDefined();
    const oidc = ext["ext.oidc"] as Record<string, unknown>;
    expect(oidc).toBeDefined();
    expect(oidc.issuer).toBe("https://issuer.example.com");
    expect(oidc.subjectHash).toBe("hash-subject");
    expect(oidc.tokenHash).toBe("hash-token");
    expect(oidc.identity).toEqual({ email: "agent@example.com", name: "Agent 123" });
  });
});

describe("signEvidence — mapping registry", () => {
  test("uses mapping registry for tool-specific inputs", async () => {
    const mappingDir = join(tmpDir, "mappings");
    mkdirSync(mappingDir, { recursive: true });
    const mapping = {
      id: "toolx-basic",
      match: { allOf: ["$.tool", "$.findings"] },
      metadata: {
        title: "Tool X Findings",
        issuer: "Tool X",
        reportType: "Tool X",
      },
      controls: {
        path: "$.findings[*]",
        idPath: "@.id",
        descriptionPath: "@.title",
        statusPath: "@.status",
        statusMap: { pass: "effective", fail: "ineffective" },
        severityPath: "@.severity",
        severityMap: { high: "HIGH", low: "LOW" },
      },
    };
    writeFileSync(join(mappingDir, "toolx.json"), JSON.stringify(mapping, null, 2));
    process.env.CORSAIR_MAPPING_DIR = mappingDir;
    resetMappingRegistry();

    const input = {
      tool: "toolx",
      findings: [
        { id: "X-1", title: "MFA enabled", status: "pass", severity: "high" },
        { id: "X-2", title: "Logging", status: "fail", severity: "low" },
      ],
    };

    const result = await signEvidence({ evidence: input }, keyManager);
    expect(result.summary.controlsTested).toBe(2);
    expect(result.detectedFormat).toBe("mapping-pack");

    delete process.env.CORSAIR_MAPPING_DIR;
    resetMappingRegistry();
  });

  test("warns when evidence-only mapping is used", async () => {
    const mappingDir = join(tmpDir, "mappings");
    mkdirSync(mappingDir, { recursive: true });
    const mapping = {
      id: "evidence-only",
      match: { allOf: ["$.evidenceOnly"] },
      metadata: {
        titlePath: "$.meta.title",
        issuer: "Tool X",
        datePath: "$.meta.date",
        scopePath: "$.meta.scope",
        reportType: "Tool X Evidence",
      },
      passthrough: {
        paths: {
          summary: "$.summary",
        },
      },
    };
    writeFileSync(join(mappingDir, "evidence-only.json"), JSON.stringify(mapping, null, 2));
    process.env.CORSAIR_MAPPING_DIR = mappingDir;
    resetMappingRegistry();

    const input = {
      evidenceOnly: true,
      meta: { title: "Tool X Export", date: "2026-01-10", scope: "Prod" },
      summary: { passed: 12, failed: 2 },
    };

    const result = await signEvidence({ evidence: input }, keyManager);
    expect(result.warnings.some((w) => w.includes("Evidence-only mapping"))).toBe(true);

    delete process.env.CORSAIR_MAPPING_DIR;
    resetMappingRegistry();
  });
});

// =============================================================================
// FORMAT OVERRIDE
// =============================================================================

describe("signEvidence — format override", () => {
  test("forces generic format on structured data", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      format: "generic",
    }, keyManager);
    expect(result.detectedFormat).toBe("generic");
  });
});

// =============================================================================
// DRY-RUN
// =============================================================================

describe("signEvidence — dry-run", () => {
  test("dry-run returns empty JWT string", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      dryRun: true,
    }, keyManager);
    expect(result.jwt).toBe("");
    expect(result.summary.controlsTested).toBe(3);
    expect(result.document.controls).toHaveLength(3);
  });

  test("dry-run returns detected format", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      dryRun: true,
    }, keyManager);
    expect(result.detectedFormat).toBe("generic");
  });
});

// =============================================================================
// OPTIONS
// =============================================================================

describe("signEvidence — options", () => {
  test("applies DID override", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      did: "did:web:acme.com",
    }, keyManager);

    const parts = result.jwt.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.iss).toBe("did:web:acme.com");
  });

  test("applies scope override", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      scope: "Custom Scope",
    }, keyManager);

    expect(result.credentialSubject?.scope).toBe("Custom Scope");
  });

  test("applies custom expiry days", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      expiryDays: 30,
    }, keyManager);

    const parts = result.jwt.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const expiryMs = payload.exp * 1000;
    const issuedMs = payload.iat * 1000;
    const daysDiff = Math.round((expiryMs - issuedMs) / (24 * 60 * 60 * 1000));
    expect(daysDiff).toBe(30);
  });
});

// =============================================================================
// SUMMARY CONSISTENCY
// =============================================================================

describe("signEvidence — summary consistency", () => {
  test("output summary matches VC credentialSubject summary", async () => {
    const result = await signEvidence({ evidence: genericEvidence }, keyManager);
    const parts = result.jwt.split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const summary = payload.vc?.credentialSubject?.summary;

    expect(summary).toEqual({
      controlsTested: result.summary.controlsTested,
      controlsPassed: result.summary.controlsPassed,
      controlsFailed: result.summary.controlsFailed,
      overallScore: result.summary.overallScore,
    });
  });
});

// =============================================================================
// SEVERITY DISTRIBUTION
// =============================================================================

describe("signEvidence — severity distribution", () => {
  test("computes severity distribution when controls have severity", async () => {
    const result = await signEvidence({ evidence: genericEvidence }, keyManager);
    expect(result.summary.severityDistribution).toBeDefined();
    expect(result.summary.severityDistribution!["HIGH"]).toBeGreaterThanOrEqual(1);
  });

  test("omits severity distribution when controls lack severity", async () => {
    const noSeverity = {
      metadata: { title: "Test", scope: "Test" },
      controls: [
        { id: "c1", description: "test", status: "pass" },
      ],
    };
    const result = await signEvidence({ evidence: noSeverity }, keyManager);
    expect(result.summary.severityDistribution).toBeUndefined();
  });
});

// =============================================================================
// WARNINGS
// =============================================================================

describe("signEvidence — warnings", () => {
  test("warns on zero controls", async () => {
    const empty = { metadata: { title: "Empty" }, controls: [] };
    const result = await signEvidence({ evidence: empty }, keyManager);
    expect(result.warnings).toContain("No controls found in evidence. CPOE will have empty summary.");
    expect(result.warnings.join(" ")).toContain("Missing issuer");
    expect(result.warnings.join(" ")).toContain("Missing scope");
  });

  test("warns on invalid assessment date", async () => {
    const invalidDate = {
      metadata: { title: "Bad Date", issuer: "Acme", date: "not-a-date", scope: "Test Scope" },
      controls: [{ id: "c1", description: "test", status: "pass" }],
    };
    const result = await signEvidence({ evidence: invalidDate }, keyManager);
    expect(result.warnings.join(" ")).toContain("Missing or invalid assessment date");
  });
});

// =============================================================================
// MARQUE ID
// =============================================================================

describe("signEvidence — marque ID", () => {
  test("generates unique marque IDs", async () => {
    const r1 = await signEvidence({ evidence: genericEvidence }, keyManager);
    const r2 = await signEvidence({ evidence: genericEvidence }, keyManager);
    expect(r1.marqueId).toMatch(/^marque-/);
    expect(r2.marqueId).toMatch(/^marque-/);
    expect(r1.marqueId).not.toBe(r2.marqueId);
  });
});
