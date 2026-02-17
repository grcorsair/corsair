/**
 * Sign Core Tests — TDD
 *
 * Tests for the shared signEvidence() engine.
 * Covers: all 8 formats, dry-run, format override, warnings, error handling.
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

const prowlerFindings = [
  {
    StatusCode: "PASS",
    Severity: "HIGH",
    FindingInfo: { Uid: "prowler-iam-001", Title: "IAM root access keys" },
    Compliance: { Requirements: ["CIS-1.1", "NIST-800-53-IA-2"] },
  },
  {
    StatusCode: "FAIL",
    Severity: "CRITICAL",
    FindingInfo: { Uid: "prowler-s3-001", Title: "S3 bucket public access" },
    Remediation: { Recommendation: "Block public access" },
  },
];

const securityHubFindings = {
  Findings: [
    { Id: "sh-001", Title: "MFA Enabled", Compliance: { Status: "PASSED" }, Severity: { Label: "HIGH" } },
    { Id: "sh-002", Title: "Encryption", Compliance: { Status: "FAILED" }, Severity: { Label: "MEDIUM" } },
  ],
};

const inspecReport = {
  platform: { name: "aws", release: "sdk-v3" },
  profiles: [{
    name: "cis-level1",
    title: "CIS Level 1",
    controls: [
      { id: "cis-1.1", title: "No root keys", impact: 1.0, results: [{ status: "passed", code_desc: "OK" }] },
      { id: "cis-2.1", title: "CloudTrail enabled", impact: 0.7, results: [{ status: "failed", code_desc: "Not enabled" }] },
    ],
  }],
};

const trivyReport = {
  SchemaVersion: 2,
  ArtifactName: "myapp:latest",
  Results: [{
    Target: "Dockerfile",
    Misconfigurations: [
      { Type: "dockerfile", ID: "DS001", Title: "Running as root", Severity: "HIGH", Status: "FAIL", Description: "Bad" },
      { Type: "dockerfile", ID: "DS005", Title: "COPY vs ADD", Severity: "LOW", Status: "PASS", Description: "OK" },
    ],
  }],
};

const gitlabReport = {
  version: "15.0.0",
  scan: { type: "sast", scanner: { id: "semgrep", name: "Semgrep" }, status: "success" },
  vulnerabilities: [
    { id: "gl-001", name: "SQL Injection", severity: "Critical", identifiers: [{ type: "cwe", name: "CWE-89", value: "89" }] },
    { id: "gl-002", name: "XSS", severity: "High", identifiers: [{ type: "cwe", name: "CWE-79", value: "79" }] },
  ],
};

const cisoAssistantAPI = {
  count: 2,
  next: null,
  previous: null,
  results: [
    { id: "ca-001", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1", result: "compliant", observation: "Controls documented" },
    { id: "ca-002", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC6.1", result: "non_compliant", observation: "Access not enforced" },
  ],
};

const cisoAssistantExport = {
  meta: { media_version: "1.0", exported_at: "2026-01-15" },
  requirement_assessments: [
    { id: "exp-001", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.5.1", result: "compliant", observation: "Policy exists" },
    { id: "exp-002", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.8.1", result: "not_assessed" },
  ],
};

// =============================================================================
// CORE SIGNING — ALL 8 FORMATS
// =============================================================================

describe("signEvidence — all formats", () => {
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

  test("signs Prowler OCSF findings", async () => {
    const result = await signEvidence({ evidence: prowlerFindings }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("prowler");
    expect(result.summary.controlsTested).toBeGreaterThanOrEqual(2);
  });

  test("signs SecurityHub ASFF findings", async () => {
    const result = await signEvidence({ evidence: securityHubFindings }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("securityhub");
  });

  test("signs InSpec report", async () => {
    const result = await signEvidence({ evidence: inspecReport }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("inspec");
  });

  test("signs Trivy report", async () => {
    const result = await signEvidence({ evidence: trivyReport }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("trivy");
  });

  test("signs GitLab security report", async () => {
    const result = await signEvidence({ evidence: gitlabReport }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("gitlab");
  });

  test("signs CISO Assistant API response", async () => {
    const result = await signEvidence({ evidence: cisoAssistantAPI }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("ciso-assistant-api");
  });

  test("signs CISO Assistant domain export", async () => {
    const result = await signEvidence({ evidence: cisoAssistantExport }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
    expect(result.detectedFormat).toBe("ciso-assistant-api");
  });

  test("accepts JSON string input", async () => {
    const result = await signEvidence({ evidence: JSON.stringify(genericEvidence) }, keyManager);
    expect(result.jwt).toMatch(/^eyJ/);
  });

  test("respects source override for provenance", async () => {
    const result = await signEvidence({ evidence: genericEvidence, source: "manual" }, keyManager);
    expect(result.provenance.source).toBe("self");
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
  test("forces prowler format when specified", async () => {
    const result = await signEvidence({
      evidence: prowlerFindings,
      format: "prowler",
    }, keyManager);
    expect(result.detectedFormat).toBe("prowler");
  });

  test("forces securityhub format", async () => {
    const result = await signEvidence({
      evidence: securityHubFindings,
      format: "securityhub",
    }, keyManager);
    expect(result.detectedFormat).toBe("securityhub");
  });

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
      evidence: prowlerFindings,
      dryRun: true,
    }, keyManager);
    expect(result.detectedFormat).toBe("prowler");
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
    const result = await signEvidence({ evidence: trivyReport }, keyManager);
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
