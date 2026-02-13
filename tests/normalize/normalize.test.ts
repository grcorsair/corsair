/**
 * Normalization Engine Tests — TDD Red Phase
 *
 * Tests the transformation of 8 parser output formats (IngestedDocument)
 * into canonical CanonicalControlEvidence format.
 *
 * At least 3 tests per format = 24+ tests minimum.
 */

import { describe, test, expect } from "bun:test";
import { normalizeDocument } from "../../src/normalize/normalize";
import { parseJSON } from "../../src/ingestion/json-parser";
import type { IngestedDocument } from "../../src/ingestion/types";
import type { CanonicalStatus, CanonicalSeverity, NormalizedEvidence } from "../../src/normalize/types";

// =============================================================================
// HELPERS
// =============================================================================

/** Load and parse an example file through the ingestion parser */
function loadExample(filename: string, format?: string): IngestedDocument {
  const path = `${import.meta.dir}/../../examples/${filename}`;
  const raw = Bun.file(path);
  // Read synchronously — bun:test supports top-level await but let's keep it simple
  const text = require("fs").readFileSync(path, "utf-8");
  return parseJSON(text, format ? { format: format as any } : undefined);
}

// =============================================================================
// PROWLER FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — Prowler", () => {
  const doc = loadExample("prowler-findings.json", "prowler");
  const result = normalizeDocument(doc);

  test("normalizes all 15 Prowler findings to canonical controls", () => {
    expect(result.controls.length).toBe(15);
    expect(result.metadata.stats.total).toBe(15);
  });

  test("maps Prowler PASS/FAIL to canonical pass/fail", () => {
    // First finding: PASS
    const mfa = result.controls.find(c => c.source.rawId === "prowler-aws-iam-root-mfa-enabled");
    expect(mfa).toBeDefined();
    expect(mfa!.status).toBe("pass");
    expect(mfa!.source.rawStatus).toBe("effective");

    // S3 public access: FAIL
    const s3 = result.controls.find(c => c.source.rawId === "prowler-aws-s3-bucket-public-access");
    expect(s3).toBeDefined();
    expect(s3!.status).toBe("fail");
  });

  test("maps Prowler severity to canonical severity (lowercase)", () => {
    const critical = result.controls.find(c => c.source.rawId === "prowler-aws-s3-bucket-public-access");
    expect(critical!.severity).toBe("critical");

    const high = result.controls.find(c => c.source.rawId === "prowler-aws-iam-root-mfa-enabled");
    expect(high!.severity).toBe("high");

    const medium = result.controls.find(c => c.source.rawId === "prowler-aws-iam-password-policy-uppercase");
    expect(medium!.severity).toBe("medium");
  });

  test("preserves Prowler framework references", () => {
    const mfa = result.controls.find(c => c.source.rawId === "prowler-aws-iam-root-mfa-enabled");
    expect(mfa!.frameworks.length).toBeGreaterThanOrEqual(2);
    const nist = mfa!.frameworks.find(f => f.framework === "NIST-800-53");
    expect(nist).toBeDefined();
    expect(nist!.controlId).toBe("IA-2");
  });

  test("sets source tool to prowler with L1 assurance", () => {
    const ctrl = result.controls[0];
    expect(ctrl.source.tool).toBe("prowler");
    expect(ctrl.assurance.level).toBe(1);
    expect(ctrl.assurance.provenance).toBe("tool");
  });

  test("sets evidence type to scan for Prowler output", () => {
    const ctrl = result.controls[0];
    expect(ctrl.evidence.type).toBe("scan");
  });

  test("metadata captures Prowler stats correctly", () => {
    expect(result.metadata.sourceFormat).toBe("prowler");
    expect(result.metadata.toolAssuranceLevel).toBe(1);
    // 15 findings: 10 PASS, 5 FAIL
    expect(result.metadata.stats.passed).toBe(10);
    expect(result.metadata.stats.failed).toBe(5);
  });
});

// =============================================================================
// SECURITYHUB FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — SecurityHub", () => {
  const doc = loadExample("securityhub-findings.json", "securityhub");
  const result = normalizeDocument(doc);

  test("normalizes all 12 SecurityHub findings to canonical controls", () => {
    expect(result.controls.length).toBe(12);
  });

  test("maps SecurityHub PASSED/FAILED to canonical pass/fail", () => {
    // First finding: PASSED (MFA)
    const first = result.controls[0];
    expect(first.status).toBe("pass");

    // 2.6 S3 access logging: FAILED
    const s3log = result.controls[2];
    expect(s3log.status).toBe("fail");
  });

  test("maps SecurityHub severity labels to canonical severity", () => {
    const critical = result.controls.find(c => c.severity === "critical");
    expect(critical).toBeDefined();

    const high = result.controls.find(c => c.severity === "high");
    expect(high).toBeDefined();

    const medium = result.controls.find(c => c.severity === "medium");
    expect(medium).toBeDefined();
  });

  test("sets source tool to securityhub with L1 assurance", () => {
    expect(result.controls[0].source.tool).toBe("securityhub");
    expect(result.controls[0].assurance.level).toBe(1);
    expect(result.controls[0].assurance.provenance).toBe("tool");
  });

  test("metadata stats are correct for SecurityHub", () => {
    expect(result.metadata.sourceFormat).toBe("securityhub");
    // 12 findings: 8 PASSED, 4 FAILED
    expect(result.metadata.stats.passed).toBe(8);
    expect(result.metadata.stats.failed).toBe(4);
  });
});

// =============================================================================
// INSPEC FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — InSpec", () => {
  const doc = loadExample("inspec-report.json", "inspec");
  const result = normalizeDocument(doc);

  test("normalizes all 10 InSpec controls to canonical controls", () => {
    expect(result.controls.length).toBe(10);
  });

  test("maps InSpec passed/failed to canonical pass/fail", () => {
    const mfa = result.controls.find(c => c.source.rawId === "cis-aws-1.5");
    expect(mfa).toBeDefined();
    expect(mfa!.status).toBe("pass");

    const creds = result.controls.find(c => c.source.rawId === "cis-aws-1.12");
    expect(creds).toBeDefined();
    expect(creds!.status).toBe("fail");
  });

  test("maps InSpec impact to canonical severity", () => {
    // impact 0.9 → critical
    const highImpact = result.controls.find(c => c.source.rawId === "cis-aws-1.5");
    expect(highImpact!.severity).toBe("critical");

    // impact 0.5 → medium
    const medImpact = result.controls.find(c => c.source.rawId === "cis-aws-1.8");
    expect(medImpact!.severity).toBe("medium");

    // impact 0.7 → high
    const hiImpact = result.controls.find(c => c.source.rawId === "cis-aws-2.1.1");
    expect(hiImpact!.severity).toBe("high");
  });

  test("preserves InSpec NIST framework references from tags", () => {
    const mfa = result.controls.find(c => c.source.rawId === "cis-aws-1.5");
    const nistRefs = mfa!.frameworks.filter(f => f.framework === "NIST-800-53");
    expect(nistRefs.length).toBeGreaterThanOrEqual(1);
    expect(nistRefs.some(r => r.controlId === "IA-2")).toBe(true);
  });

  test("sets source tool to inspec with L1 assurance", () => {
    expect(result.controls[0].source.tool).toBe("inspec");
    expect(result.controls[0].assurance.level).toBe(1);
  });

  test("metadata stats are correct for InSpec", () => {
    expect(result.metadata.sourceFormat).toBe("inspec");
    // 10 controls: 7 passed, 3 failed
    expect(result.metadata.stats.passed).toBe(7);
    expect(result.metadata.stats.failed).toBe(3);
  });
});

// =============================================================================
// TRIVY FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — Trivy", () => {
  const doc = loadExample("trivy-report.json", "trivy");
  const result = normalizeDocument(doc);

  test("normalizes all Trivy findings (misconfigs + vulns) to canonical controls", () => {
    // 4 Dockerfile misconfigs + 4 vulns + 4 terraform misconfigs = 12
    expect(result.controls.length).toBe(12);
  });

  test("maps Trivy PASS/FAIL status for misconfigurations", () => {
    const ds002 = result.controls.find(c => c.source.rawId === "DS002");
    expect(ds002).toBeDefined();
    expect(ds002!.status).toBe("pass");

    const ds001 = result.controls.find(c => c.source.rawId === "DS001");
    expect(ds001).toBeDefined();
    expect(ds001!.status).toBe("fail");
  });

  test("maps vulnerabilities as always fail", () => {
    const cve = result.controls.find(c => c.source.rawId === "CVE-2024-48949");
    expect(cve).toBeDefined();
    expect(cve!.status).toBe("fail");
    expect(cve!.severity).toBe("critical");
  });

  test("maps Trivy severity to canonical severity", () => {
    const critical = result.controls.find(c => c.source.rawId === "AVD-AWS-0132");
    expect(critical).toBeDefined();
    expect(critical!.severity).toBe("critical");

    const high = result.controls.find(c => c.source.rawId === "DS002");
    expect(high!.severity).toBe("high");

    const low = result.controls.find(c => c.source.rawId === "DS005");
    expect(low!.severity).toBe("low");
  });

  test("sets source tool to trivy with L1 assurance", () => {
    expect(result.controls[0].source.tool).toBe("trivy");
    expect(result.controls[0].assurance.level).toBe(1);
    expect(result.controls[0].assurance.provenance).toBe("tool");
  });

  test("metadata stats count pass/fail correctly", () => {
    expect(result.metadata.sourceFormat).toBe("trivy");
    // 4 Dockerfile: 1 pass + 3 fail, 4 vulns: all fail, 4 terraform: 2 pass + 2 fail
    // Total: 3 pass, 9 fail
    expect(result.metadata.stats.passed).toBe(3);
    expect(result.metadata.stats.failed).toBe(9);
  });
});

// =============================================================================
// GITLAB FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — GitLab", () => {
  const doc = loadExample("gl-sast-report.json", "gitlab");
  const result = normalizeDocument(doc);

  test("normalizes all 6 GitLab vulnerabilities to canonical controls", () => {
    expect(result.controls.length).toBe(6);
  });

  test("maps all GitLab vulnerabilities as fail (findings are always ineffective)", () => {
    for (const ctrl of result.controls) {
      expect(ctrl.status).toBe("fail");
    }
  });

  test("maps GitLab severity to canonical severity", () => {
    const sqli = result.controls.find(c => c.source.rawId === "gl-sast-001");
    expect(sqli!.severity).toBe("critical");

    const xss = result.controls.find(c => c.source.rawId === "gl-sast-002");
    expect(xss!.severity).toBe("high");

    const insecureRng = result.controls.find(c => c.source.rawId === "gl-sast-004");
    expect(insecureRng!.severity).toBe("medium");

    const redirect = result.controls.find(c => c.source.rawId === "gl-sast-006");
    expect(redirect!.severity).toBe("low");
  });

  test("extracts CWE/OWASP framework refs from GitLab identifiers", () => {
    const sqli = result.controls.find(c => c.source.rawId === "gl-sast-001");
    expect(sqli!.frameworks.length).toBeGreaterThanOrEqual(1);
    const cwe = sqli!.frameworks.find(f => f.framework === "CWE");
    expect(cwe).toBeDefined();
    expect(cwe!.controlId).toBe("89");

    const owasp = sqli!.frameworks.find(f => f.framework === "OWASP");
    expect(owasp).toBeDefined();
  });

  test("sets source tool to gitlab with L1 assurance", () => {
    expect(result.controls[0].source.tool).toBe("gitlab");
    expect(result.controls[0].assurance.level).toBe(1);
    expect(result.controls[0].assurance.provenance).toBe("tool");
  });
});

// =============================================================================
// CISO ASSISTANT API FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — CISO Assistant API", () => {
  const doc = loadExample("ciso-assistant-api.json", "ciso-assistant-api");
  const result = normalizeDocument(doc);

  test("normalizes all 10 CISO Assistant API assessments to canonical controls", () => {
    expect(result.controls.length).toBe(10);
  });

  test("maps CISO Assistant result to canonical status", () => {
    // compliant → pass
    const cc11 = result.controls.find(c => c.source.rawId === "CC1.1");
    expect(cc11).toBeDefined();
    expect(cc11!.status).toBe("pass");

    // non_compliant → fail
    const cc52 = result.controls.find(c => c.source.rawId === "CC5.2");
    expect(cc52).toBeDefined();
    expect(cc52!.status).toBe("fail");

    // partially_compliant → fail
    const cc66 = result.controls.find(c => c.source.rawId === "CC6.6");
    expect(cc66).toBeDefined();
    expect(cc66!.status).toBe("fail");

    // not_assessed → skip
    const cc31 = result.controls.find(c => c.source.rawId === "CC3.1");
    expect(cc31).toBeDefined();
    expect(cc31!.status).toBe("skip");
  });

  test("extracts SOC2 framework refs from CISO Assistant URN", () => {
    const cc11 = result.controls.find(c => c.source.rawId === "CC1.1");
    const soc2 = cc11!.frameworks.find(f => f.framework === "SOC2");
    expect(soc2).toBeDefined();
    expect(soc2!.controlId).toBe("CC1.1");
  });

  test("sets assurance level based on linked evidence (L2 if evidence present)", () => {
    // CISO Assistant API data has linked evidences → L2
    expect(result.controls[0].assurance.level).toBe(2);
    expect(result.controls[0].assurance.provenance).toBe("tool");
  });

  test("sets source tool to ciso-assistant", () => {
    expect(result.controls[0].source.tool).toBe("ciso-assistant");
  });

  test("metadata stats count correctly", () => {
    // 10 assessments: 6 compliant, 2 non_compliant, 1 partially_compliant, 1 not_assessed
    expect(result.metadata.stats.passed).toBe(6);
    expect(result.metadata.stats.failed).toBe(3); // 2 non_compliant + 1 partially_compliant
    expect(result.metadata.stats.skipped).toBe(1); // 1 not_assessed
  });
});

// =============================================================================
// CISO ASSISTANT EXPORT FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — CISO Assistant Export", () => {
  const doc = loadExample("ciso-assistant-export.json", "ciso-assistant-export");
  const result = normalizeDocument(doc);

  test("normalizes all 8 CISO Assistant export assessments to canonical controls", () => {
    expect(result.controls.length).toBe(8);
  });

  test("maps CISO Assistant export result to canonical status", () => {
    // compliant → pass
    const a51 = result.controls.find(c => c.source.rawId === "A.5.1");
    expect(a51).toBeDefined();
    expect(a51!.status).toBe("pass");

    // non_compliant → fail
    const a61 = result.controls.find(c => c.source.rawId === "A.6.1");
    expect(a61).toBeDefined();
    expect(a61!.status).toBe("fail");
  });

  test("extracts ISO27001 framework refs from CISO Assistant export URN", () => {
    const a51 = result.controls.find(c => c.source.rawId === "A.5.1");
    const iso = a51!.frameworks.find(f => f.framework === "ISO27001");
    expect(iso).toBeDefined();
    expect(iso!.controlId).toBe("A.5.1");
  });

  test("sets source tool to ciso-assistant for export format", () => {
    expect(result.controls[0].source.tool).toBe("ciso-assistant");
    expect(result.metadata.sourceFormat).toBe("ciso-assistant");
  });
});

// =============================================================================
// GENERIC FORMAT (3+ tests)
// =============================================================================

describe("normalizeDocument — Generic", () => {
  const doc = loadExample("generic-evidence.json", "generic");
  const result = normalizeDocument(doc);

  test("normalizes all 10 generic controls to canonical controls", () => {
    expect(result.controls.length).toBe(10);
  });

  test("maps generic pass/fail to canonical pass/fail", () => {
    const iam001 = result.controls.find(c => c.source.rawId === "ACME-IAM-001");
    expect(iam001).toBeDefined();
    expect(iam001!.status).toBe("pass");

    const iam003 = result.controls.find(c => c.source.rawId === "ACME-IAM-003");
    expect(iam003).toBeDefined();
    expect(iam003!.status).toBe("fail");
  });

  test("maps generic severity to canonical severity", () => {
    const high = result.controls.find(c => c.source.rawId === "ACME-IAM-001");
    expect(high!.severity).toBe("high");

    const medium = result.controls.find(c => c.source.rawId === "ACME-IAM-003");
    expect(medium!.severity).toBe("medium");
  });

  test("preserves single and array framework references", () => {
    // Single framework ref
    const iam001 = result.controls.find(c => c.source.rawId === "ACME-IAM-001");
    expect(iam001!.frameworks.length).toBeGreaterThanOrEqual(1);
    const nist = iam001!.frameworks.find(f => f.framework === "NIST-800-53");
    expect(nist).toBeDefined();
    expect(nist!.controlId).toBe("IA-2");

    // Array of framework refs
    const net001 = result.controls.find(c => c.source.rawId === "ACME-NET-001");
    expect(net001!.frameworks.length).toBeGreaterThanOrEqual(3);
  });

  test("sets assurance level to L0 for generic (self-assessed)", () => {
    expect(result.controls[0].assurance.level).toBe(0);
    expect(result.controls[0].assurance.provenance).toBe("self");
  });

  test("sets evidence type to document for generic format", () => {
    expect(result.controls[0].evidence.type).toBe("document");
  });

  test("metadata stats count correctly for generic", () => {
    expect(result.metadata.sourceFormat).toBe("generic");
    // 10 controls: 7 pass, 3 fail
    expect(result.metadata.stats.passed).toBe(7);
    expect(result.metadata.stats.failed).toBe(3);
  });
});

// =============================================================================
// CROSS-FORMAT TESTS (normalization consistency)
// =============================================================================

describe("normalizeDocument — Cross-format consistency", () => {
  test("status mapping is consistent: effective→pass, ineffective→fail, not-tested→skip", () => {
    const doc: IngestedDocument = {
      source: "json",
      metadata: { title: "Test", issuer: "Test", date: "2026-01-01", scope: "Test" },
      controls: [
        { id: "c1", description: "effective ctrl", status: "effective" },
        { id: "c2", description: "ineffective ctrl", status: "ineffective" },
        { id: "c3", description: "not-tested ctrl", status: "not-tested" },
      ],
      toolAssuranceLevel: 0,
    };
    const result = normalizeDocument(doc);
    expect(result.controls[0].status).toBe("pass");
    expect(result.controls[1].status).toBe("fail");
    expect(result.controls[2].status).toBe("skip");
  });

  test("severity normalization maps CRITICAL→critical, HIGH→high, MEDIUM→medium, LOW→low", () => {
    const doc: IngestedDocument = {
      source: "json",
      metadata: { title: "Test", issuer: "Test", date: "2026-01-01", scope: "Test" },
      controls: [
        { id: "c1", description: "crit", status: "effective", severity: "CRITICAL" },
        { id: "c2", description: "high", status: "effective", severity: "HIGH" },
        { id: "c3", description: "med", status: "effective", severity: "MEDIUM" },
        { id: "c4", description: "low", status: "effective", severity: "LOW" },
      ],
      toolAssuranceLevel: 1,
    };
    const result = normalizeDocument(doc);
    expect(result.controls[0].severity).toBe("critical");
    expect(result.controls[1].severity).toBe("high");
    expect(result.controls[2].severity).toBe("medium");
    expect(result.controls[3].severity).toBe("low");
  });

  test("framework refs are deduplicated", () => {
    const doc: IngestedDocument = {
      source: "json",
      metadata: { title: "Test", issuer: "Test", date: "2026-01-01", scope: "Test" },
      controls: [
        {
          id: "c1",
          description: "dupe refs",
          status: "effective",
          frameworkRefs: [
            { framework: "SOC2", controlId: "CC6.1" },
            { framework: "SOC2", controlId: "CC6.1" },
            { framework: "NIST-800-53", controlId: "AC-2" },
          ],
        },
      ],
      toolAssuranceLevel: 1,
    };
    const result = normalizeDocument(doc);
    expect(result.controls[0].frameworks.length).toBe(2); // deduplicated
  });

  test("controls with no severity default to info", () => {
    const doc: IngestedDocument = {
      source: "json",
      metadata: { title: "Test", issuer: "Test", date: "2026-01-01", scope: "Test" },
      controls: [
        { id: "c1", description: "no severity", status: "effective" },
      ],
      toolAssuranceLevel: 0,
    };
    const result = normalizeDocument(doc);
    expect(result.controls[0].severity).toBe("info");
  });

  test("empty controls array produces empty result with zero stats", () => {
    const doc: IngestedDocument = {
      source: "json",
      metadata: { title: "Empty", issuer: "Test", date: "2026-01-01", scope: "Test" },
      controls: [],
      toolAssuranceLevel: 0,
    };
    const result = normalizeDocument(doc);
    expect(result.controls.length).toBe(0);
    expect(result.metadata.stats.total).toBe(0);
    expect(result.metadata.stats.passed).toBe(0);
    expect(result.metadata.stats.failed).toBe(0);
  });

  test("provenance is derived from source and assurance level", () => {
    // L0 generic → self
    const selfDoc: IngestedDocument = {
      source: "json",
      metadata: { title: "Test", issuer: "Test", date: "2026-01-01", scope: "Test" },
      controls: [{ id: "c1", description: "test", status: "effective" }],
      toolAssuranceLevel: 0,
    };
    expect(normalizeDocument(selfDoc).controls[0].assurance.provenance).toBe("self");

    // L1 prowler → tool
    const toolDoc: IngestedDocument = {
      source: "prowler",
      metadata: { title: "Test", issuer: "Prowler", date: "2026-01-01", scope: "AWS" },
      controls: [{ id: "c1", description: "test", status: "effective" }],
      toolAssuranceLevel: 1,
    };
    expect(normalizeDocument(toolDoc).controls[0].assurance.provenance).toBe("tool");
  });
});

// =============================================================================
// EVIDENCE TYPE INFERENCE
// =============================================================================

describe("normalizeDocument — Evidence type inference", () => {
  test("prowler/securityhub → scan", () => {
    const doc: IngestedDocument = {
      source: "prowler",
      metadata: { title: "Test", issuer: "Prowler", date: "2026-01-01", scope: "AWS" },
      controls: [{ id: "c1", description: "test", status: "effective" }],
      toolAssuranceLevel: 1,
    };
    expect(normalizeDocument(doc).controls[0].evidence.type).toBe("scan");
  });

  test("generic/manual → document", () => {
    const doc: IngestedDocument = {
      source: "json",
      metadata: { title: "Test", issuer: "Manual", date: "2026-01-01", scope: "Internal" },
      controls: [{ id: "c1", description: "test", status: "effective" }],
      toolAssuranceLevel: 0,
    };
    expect(normalizeDocument(doc).controls[0].evidence.type).toBe("document");
  });

  test("ciso-assistant → attestation when L2+", () => {
    const doc: IngestedDocument = {
      source: "ciso-assistant",
      metadata: { title: "Test", issuer: "CISO Assistant", date: "2026-01-01", scope: "SOC2" },
      controls: [{ id: "c1", description: "test", status: "effective" }],
      toolAssuranceLevel: 2,
    };
    expect(normalizeDocument(doc).controls[0].evidence.type).toBe("attestation");
  });
});
