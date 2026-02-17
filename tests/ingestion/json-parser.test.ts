/**
 * JSON Parser Tests — Generic Evidence Ingestion
 *
 * TDD: Write tests first, then implement.
 * Tests cover: generic JSON, Prowler OCSF, SecurityHub ASFF,
 * auto-detection, error handling, and pipeline integration.
 */

import { describe, test, expect } from "bun:test";
import { parseJSON } from "../../src/ingestion/json-parser";
import { deriveProvenance } from "../../src/ingestion/provenance-utils";
import { mapToMarqueInput } from "../../src/ingestion/mapper";

// =============================================================================
// GENERIC JSON FORMAT
// =============================================================================

describe("parseJSON — generic format", () => {
  test("should parse a minimal generic JSON with controls array", () => {
    const input = {
      metadata: {
        title: "Q1 2026 Security Assessment",
        issuer: "Acme Corp",
        date: "2026-01-15",
        scope: "AWS Production Environment",
      },
      controls: [
        {
          id: "MFA-001",
          description: "Multi-factor authentication enabled for all users",
          status: "pass",
          evidence: "Okta MFA policy enforced for all user groups",
        },
        {
          id: "ENC-001",
          description: "Data at rest encrypted with AES-256",
          status: "pass",
          evidence: "S3 default encryption verified via AWS Config",
        },
        {
          id: "LOG-001",
          description: "Audit logging enabled for all services",
          status: "fail",
          severity: "HIGH",
          evidence: "CloudTrail disabled in us-west-2 region",
        },
      ],
    };

    const result = parseJSON(input);

    expect(result.source).toBe("json");
    expect(result.metadata.title).toBe("Q1 2026 Security Assessment");
    expect(result.metadata.issuer).toBe("Acme Corp");
    expect(result.metadata.date).toBe("2026-01-15");
    expect(result.metadata.scope).toBe("AWS Production Environment");
    expect(result.controls).toHaveLength(3);

    // Status normalization: "pass" → "effective", "fail" → "ineffective"
    expect(result.controls[0].status).toBe("effective");
    expect(result.controls[0].id).toBe("MFA-001");
    expect(result.controls[0].evidence).toBe(
      "Okta MFA policy enforced for all user groups"
    );

    expect(result.controls[1].status).toBe("effective");
    expect(result.controls[2].status).toBe("ineffective");
    expect(result.controls[2].severity).toBe("HIGH");
  });

  test("should handle string input (parse JSON string)", () => {
    const input = JSON.stringify({
      metadata: {
        title: "Test",
        issuer: "Test Corp",
        date: "2026-01-01",
        scope: "Test scope",
      },
      controls: [
        { id: "C1", description: "Control 1", status: "pass" },
      ],
    });

    const result = parseJSON(input);

    expect(result.source).toBe("json");
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0].status).toBe("effective");
  });

  test("should normalize various status strings", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [
        { id: "C1", description: "D", status: "PASS" },
        { id: "C2", description: "D", status: "FAIL" },
        { id: "C3", description: "D", status: "pass" },
        { id: "C4", description: "D", status: "fail" },
        { id: "C5", description: "D", status: "effective" },
        { id: "C6", description: "D", status: "ineffective" },
        { id: "C7", description: "D", status: "not-tested" },
        { id: "C8", description: "D", status: "skip" },
        { id: "C9", description: "D", status: "SKIP" },
        { id: "C10", description: "D", status: "INFO" },
        { id: "C11", description: "D", status: "error" },
      ],
    };

    const result = parseJSON(input);

    expect(result.controls[0].status).toBe("effective");      // PASS
    expect(result.controls[1].status).toBe("ineffective");    // FAIL
    expect(result.controls[2].status).toBe("effective");      // pass
    expect(result.controls[3].status).toBe("ineffective");    // fail
    expect(result.controls[4].status).toBe("effective");      // effective
    expect(result.controls[5].status).toBe("ineffective");    // ineffective
    expect(result.controls[6].status).toBe("not-tested");     // not-tested
    expect(result.controls[7].status).toBe("not-tested");     // skip
    expect(result.controls[8].status).toBe("not-tested");     // SKIP
    expect(result.controls[9].status).toBe("not-tested");     // INFO
    expect(result.controls[10].status).toBe("ineffective");   // error
  });

  test("should normalize severity strings", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [
        { id: "C1", description: "D", status: "fail", severity: "critical" },
        { id: "C2", description: "D", status: "fail", severity: "high" },
        { id: "C3", description: "D", status: "fail", severity: "medium" },
        { id: "C4", description: "D", status: "fail", severity: "low" },
        { id: "C5", description: "D", status: "fail", severity: "CRITICAL" },
        { id: "C6", description: "D", status: "fail", severity: "informational" },
      ],
    };

    const result = parseJSON(input);

    expect(result.controls[0].severity).toBe("CRITICAL");
    expect(result.controls[1].severity).toBe("HIGH");
    expect(result.controls[2].severity).toBe("MEDIUM");
    expect(result.controls[3].severity).toBe("LOW");
    expect(result.controls[4].severity).toBe("CRITICAL");
    expect(result.controls[5].severity).toBe("LOW");  // informational → LOW
  });

  test("should extract framework references", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [
        {
          id: "C1",
          description: "MFA control",
          status: "pass",
          framework: "NIST-800-53",
          controlId: "IA-2",
        },
        {
          id: "C2",
          description: "Encryption",
          status: "pass",
          frameworks: [
            { framework: "SOC2", controlId: "CC6.1" },
            { framework: "ISO27001", controlId: "A.10.1" },
          ],
        },
      ],
    };

    const result = parseJSON(input);

    expect(result.controls[0].frameworkRefs).toHaveLength(1);
    expect(result.controls[0].frameworkRefs![0]).toEqual({
      framework: "NIST-800-53",
      controlId: "IA-2",
    });

    expect(result.controls[1].frameworkRefs).toHaveLength(2);
    expect(result.controls[1].frameworkRefs![0].framework).toBe("SOC2");
    expect(result.controls[1].frameworkRefs![1].framework).toBe("ISO27001");
  });

  test("should handle empty controls array", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [],
    };

    const result = parseJSON(input);
    expect(result.controls).toHaveLength(0);
  });

  test("should compute rawTextHash for provenance", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [{ id: "C1", description: "D", status: "pass" }],
    };

    const result = parseJSON(input);
    expect(result.metadata.rawTextHash).toBeDefined();
    expect(result.metadata.rawTextHash!.length).toBe(64); // SHA-256 hex
  });

  test("computes deterministic rawTextHash regardless of key order", () => {
    const inputA = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [{ id: "C1", description: "D", status: "pass" }],
    };
    const inputB = {
      controls: [{ status: "pass", description: "D", id: "C1" }],
      metadata: { scope: "S", date: "2026-01-01", issuer: "I", title: "T" },
    };

    const resultA = parseJSON(inputA);
    const resultB = parseJSON(inputB);

    expect(resultA.metadata.rawTextHash).toBe(resultB.metadata.rawTextHash);
  });
});

// =============================================================================
// SOURCE OVERRIDE
// =============================================================================

describe("parseJSON — source override", () => {
  test("should allow explicit source override to prowler", () => {
    const input = {
      metadata: { title: "Prowler Scan", issuer: "Prowler", date: "2026-01-01", scope: "AWS" },
      controls: [{ id: "C1", description: "D", status: "pass", evidence: "Config check" }],
    };

    const result = parseJSON(input, { source: "prowler" });
    expect(result.source).toBe("prowler");
  });

  test("should allow explicit source override to securityhub", () => {
    const input = {
      metadata: { title: "SecurityHub", issuer: "AWS", date: "2026-01-01", scope: "AWS" },
      controls: [{ id: "C1", description: "D", status: "pass" }],
    };

    const result = parseJSON(input, { source: "securityhub" });
    expect(result.source).toBe("securityhub");
  });

  test("should allow explicit source override to pentest", () => {
    const input = {
      metadata: { title: "Pentest", issuer: "HackerOne", date: "2026-01-01", scope: "App" },
      controls: [{ id: "C1", description: "D", status: "pass", evidence: "Tested 25 of 25 endpoints" }],
    };

    const result = parseJSON(input, { source: "pentest" });
    expect(result.source).toBe("pentest");
  });
});

// =============================================================================
// MAPPING REGISTRY (BUILT-IN)
// =============================================================================

describe("parseJSON — built-in mapping registry", () => {
  test("maps Semgrep JSON findings via mapping registry", () => {
    const input = {
      results: [
        {
          check_id: "semgrep.security.injection.sql",
          path: "app/db.ts",
          extra: { message: "Possible SQL injection", severity: "HIGH" },
        },
      ],
    };

    const result = parseJSON(input);
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0].id).toBe("semgrep.security.injection.sql");
    expect(result.controls[0].status).toBe("ineffective");
  });
});

// =============================================================================
// PROWLER OCSF FORMAT
// =============================================================================

describe("parseJSON — Prowler OCSF auto-detection", () => {
  test("should auto-detect Prowler OCSF format from array of findings", () => {
    const prowlerOutput = [
      {
        StatusCode: "PASS",
        Severity: "HIGH",
        FindingInfo: {
          Uid: "prowler-aws-iam-mfa-enabled",
          Title: "Ensure MFA is enabled for all IAM users",
        },
        Remediation: {
          Recommendation: "Enable MFA for all IAM users in the AWS Console",
        },
        Resources: [
          { Uid: "arn:aws:iam::123456789012:user/admin" },
        ],
        Compliance: {
          Requirements: ["CIS-1.10", "NIST-800-53-IA-2"],
        },
      },
      {
        StatusCode: "FAIL",
        Severity: "CRITICAL",
        FindingInfo: {
          Uid: "prowler-aws-s3-bucket-public",
          Title: "Ensure S3 buckets are not publicly accessible",
        },
        Remediation: {
          Recommendation: "Block public access on all S3 buckets",
        },
        Resources: [
          { Uid: "arn:aws:s3:::my-public-bucket" },
        ],
        Compliance: {
          Requirements: ["CIS-2.1.5", "NIST-800-53-AC-3"],
        },
      },
    ];

    const result = parseJSON(prowlerOutput);

    expect(result.source).toBe("prowler");
    expect(result.metadata.title).toContain("Prowler");
    expect(result.controls).toHaveLength(2);

    expect(result.controls[0].id).toBe("prowler-aws-iam-mfa-enabled");
    expect(result.controls[0].status).toBe("effective");
    expect(result.controls[0].evidence).toContain("Enable MFA");

    expect(result.controls[1].id).toBe("prowler-aws-s3-bucket-public");
    expect(result.controls[1].status).toBe("ineffective");
    expect(result.controls[1].severity).toBe("CRITICAL");
  });

  test("should extract Prowler framework references from Compliance.Requirements", () => {
    const prowlerOutput = [
      {
        StatusCode: "PASS",
        Severity: "MEDIUM",
        FindingInfo: { Uid: "check-1", Title: "Test check" },
        Remediation: { Recommendation: "Fix it" },
        Resources: [{ Uid: "arn:aws:ec2::123456789012:instance/i-abc" }],
        Compliance: {
          Requirements: ["CIS-1.1", "NIST-800-53-AC-2", "SOC2-CC6.1"],
        },
      },
    ];

    const result = parseJSON(prowlerOutput);
    const refs = result.controls[0].frameworkRefs!;

    expect(refs.length).toBeGreaterThanOrEqual(1);
    // Should have framework refs parsed from compliance requirements
    const frameworks = refs.map(r => r.framework);
    expect(frameworks).toContain("CIS");
  });
});

// =============================================================================
// SECURITYHUB ASFF FORMAT
// =============================================================================

describe("parseJSON — SecurityHub ASFF auto-detection", () => {
  test("should auto-detect SecurityHub ASFF format", () => {
    const asffOutput = {
      Findings: [
        {
          Id: "arn:aws:securityhub:us-east-1:123456789012:finding/abc",
          Title: "S3 bucket public access enabled",
          Description: "S3 bucket my-bucket has public access enabled",
          Severity: { Label: "HIGH" },
          Compliance: { Status: "FAILED" },
          Remediation: {
            Recommendation: { Text: "Disable public access on the bucket" },
          },
          Resources: [
            { Type: "AwsS3Bucket", Id: "arn:aws:s3:::my-bucket" },
          ],
        },
        {
          Id: "arn:aws:securityhub:us-east-1:123456789012:finding/def",
          Title: "CloudTrail enabled in all regions",
          Description: "CloudTrail is enabled across all AWS regions",
          Severity: { Label: "MEDIUM" },
          Compliance: { Status: "PASSED" },
          Remediation: {
            Recommendation: { Text: "No action needed" },
          },
          Resources: [
            { Type: "AwsCloudTrailTrail", Id: "arn:aws:cloudtrail:us-east-1:123456789012:trail/main" },
          ],
        },
      ],
    };

    const result = parseJSON(asffOutput);

    expect(result.source).toBe("securityhub");
    expect(result.metadata.title).toContain("SecurityHub");
    expect(result.controls).toHaveLength(2);

    expect(result.controls[0].status).toBe("ineffective");
    expect(result.controls[0].severity).toBe("HIGH");
    expect(result.controls[0].description).toContain("S3 bucket");

    expect(result.controls[1].status).toBe("effective");
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

describe("parseJSON — error handling", () => {
  test("should throw on invalid JSON string", () => {
    expect(() => parseJSON("not valid json")).toThrow();
  });

  test("should throw on null input", () => {
    expect(() => parseJSON(null as unknown as string)).toThrow();
  });

  test("should throw on number input", () => {
    expect(() => parseJSON(42 as unknown as string)).toThrow();
  });

  test("should handle missing metadata with defaults", () => {
    const input = {
      controls: [{ id: "C1", description: "D", status: "pass" }],
    };

    const result = parseJSON(input);
    expect(result.metadata.title).toBeDefined();
    expect(result.metadata.issuer).toBeDefined();
    expect(result.metadata.date).toBeDefined();
    expect(result.metadata.scope).toBeDefined();
  });

  test("should handle controls with missing fields", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [
        { id: "C1" },  // missing description, status
        { description: "D", status: "pass" },  // missing id
      ],
    };

    const result = parseJSON(input);
    expect(result.controls).toHaveLength(2);
    // Missing description gets a default
    expect(result.controls[0].description).toBeDefined();
    // Missing status defaults to not-tested
    expect(result.controls[0].status).toBe("not-tested");
    // Missing id gets auto-generated
    expect(result.controls[1].id).toBeDefined();
  });
});

// =============================================================================
// PIPELINE INTEGRATION
// =============================================================================

describe("parseJSON — pipeline integration", () => {
  test("should produce output compatible with provenance derivation", () => {
    const input = {
      metadata: {
        title: "Security Scan",
        issuer: "Acme",
        date: new Date().toISOString().split("T")[0],
        scope: "AWS Production",
      },
      controls: [
        { id: "C1", description: "MFA enabled", status: "pass", evidence: "Okta config export shows MFA enforced" },
        { id: "C2", description: "Encryption at rest", status: "pass", evidence: "S3 default encryption via AWS Config" },
        { id: "C3", description: "Logging enabled", status: "fail", severity: "HIGH", evidence: "CloudTrail disabled" },
      ],
    };

    const doc = parseJSON(input);
    const provenance = deriveProvenance(doc.source, doc.metadata);

    expect(provenance.source).toBe("tool"); // json source = tool provenance
    expect(provenance.sourceIdentity).toBe("Acme");
    expect(doc.metadata.scope).toBe("AWS Production");
  });

  test("should produce output with provenance", () => {
    const input = {
      metadata: {
        title: "Scan",
        issuer: "Tool",
        date: new Date().toISOString().split("T")[0],
        scope: "Prod",
      },
      controls: [
        { id: "C1", description: "D", status: "pass", evidence: "Config verified" },
        { id: "C2", description: "D", status: "pass", evidence: "Settings checked" },
      ],
    };

    const doc = parseJSON(input);
    const provenance = deriveProvenance(doc.source, doc.metadata);

    expect(provenance.source).toBe("tool");
    expect(provenance.sourceIdentity).toBe("Tool");
  });

  test("should produce output compatible with mapper", () => {
    const input = {
      metadata: {
        title: "Assessment",
        issuer: "Acme",
        date: "2026-01-15",
        scope: "AWS",
      },
      controls: [
        {
          id: "C1",
          description: "MFA",
          status: "pass",
          evidence: "Enabled",
          framework: "NIST-800-53",
          controlId: "IA-2",
        },
      ],
    };

    const doc = parseJSON(input);
    const marqueInput = mapToMarqueInput(doc, { did: "did:web:acme.com" });

    expect(marqueInput.issuer).toBeDefined();
    expect(marqueInput.chartResults).toBeDefined();
    expect(marqueInput.document).toBeDefined();
  });

  test("prowler source should get tool provenance", () => {
    const prowlerOutput = [
      {
        StatusCode: "PASS",
        Severity: "HIGH",
        FindingInfo: { Uid: "check-1", Title: "MFA check" },
        Remediation: { Recommendation: "Enable MFA" },
        Resources: [{ Uid: "arn:aws:iam::123:user/admin" }],
        Compliance: { Requirements: ["CIS-1.10"] },
      },
    ];

    const doc = parseJSON(prowlerOutput);
    const provenance = deriveProvenance(doc.source, doc.metadata);

    expect(provenance.source).toBe("tool");
    expect(doc.metadata.reportType).toBe("Prowler OCSF");
  });
});

// =============================================================================
// INSPEC FORMAT
// =============================================================================

describe("parseJSON — InSpec auto-detection", () => {
  test("should auto-detect InSpec format from profiles/controls structure", () => {
    const inspecOutput = {
      platform: { name: "aws", release: "aws-sdk-v3" },
      profiles: [
        {
          name: "aws-cis-level1",
          title: "CIS AWS Foundations Benchmark Level 1",
          controls: [
            {
              id: "cis-aws-1.1",
              title: "Avoid the use of the root account",
              desc: "The root account has unrestricted access.",
              impact: 1.0,
              tags: { nist: ["IA-2"], cis_controls: [{ id: "1.1" }] },
              results: [{ status: "passed", code_desc: "Root account has no access keys", run_time: 0.5 }],
            },
            {
              id: "cis-aws-1.4",
              title: "Ensure MFA is enabled for root",
              desc: "Enable MFA on root.",
              impact: 1.0,
              tags: { nist: ["IA-2(1)"] },
              results: [{ status: "passed", code_desc: "Root MFA is active", run_time: 0.3 }],
            },
            {
              id: "cis-aws-2.1",
              title: "Ensure CloudTrail is enabled",
              desc: "CloudTrail should be enabled.",
              impact: 0.7,
              tags: { nist: ["AU-2"] },
              results: [{ status: "failed", code_desc: "CloudTrail not enabled in eu-west-1", run_time: 0.4 }],
            },
          ],
        },
      ],
      statistics: { duration: 12.5 },
      version: "5.22.36",
    };

    const result = parseJSON(inspecOutput);

    expect(result.source).toBe("json");
    expect(result.metadata.title).toContain("InSpec");
    expect(result.controls).toHaveLength(3);

    expect(result.controls[0].id).toBe("cis-aws-1.1");
    expect(result.controls[0].status).toBe("effective");
    expect(result.controls[0].description).toBe("Avoid the use of the root account");
    expect(result.controls[0].evidence).toContain("Root account has no access keys");

    expect(result.controls[2].id).toBe("cis-aws-2.1");
    expect(result.controls[2].status).toBe("ineffective");
    expect(result.controls[2].evidence).toContain("CloudTrail not enabled");
  });

  test("should extract NIST framework refs from InSpec tags", () => {
    const inspecOutput = {
      platform: { name: "aws" },
      profiles: [
        {
          name: "test",
          controls: [
            {
              id: "test-1",
              title: "Test control",
              desc: "Desc",
              impact: 0.7,
              tags: { nist: ["IA-2", "AC-3"] },
              results: [{ status: "passed", code_desc: "OK", run_time: 0.1 }],
            },
          ],
        },
      ],
      statistics: { duration: 1.0 },
      version: "5.0.0",
    };

    const result = parseJSON(inspecOutput);
    expect(result.controls[0].frameworkRefs).toBeDefined();
    expect(result.controls[0].frameworkRefs!.length).toBeGreaterThanOrEqual(1);
    const frameworks = result.controls[0].frameworkRefs!.map(r => r.framework);
    expect(frameworks).toContain("NIST-800-53");
  });

  test("should handle InSpec control with multiple results (worst-case wins)", () => {
    const inspecOutput = {
      platform: { name: "os" },
      profiles: [
        {
          name: "test",
          controls: [
            {
              id: "multi-result",
              title: "Control with mixed results",
              desc: "Desc",
              impact: 0.5,
              tags: {},
              results: [
                { status: "passed", code_desc: "Check 1 OK", run_time: 0.1 },
                { status: "failed", code_desc: "Check 2 failed", run_time: 0.1 },
                { status: "passed", code_desc: "Check 3 OK", run_time: 0.1 },
              ],
            },
          ],
        },
      ],
      statistics: { duration: 0.5 },
      version: "5.0.0",
    };

    const result = parseJSON(inspecOutput);
    // One failed result means the control is ineffective
    expect(result.controls[0].status).toBe("ineffective");
    // Evidence should include all code_desc entries
    expect(result.controls[0].evidence).toContain("Check 1 OK");
    expect(result.controls[0].evidence).toContain("Check 2 failed");
  });

  test("should handle InSpec control with skipped results", () => {
    const inspecOutput = {
      platform: { name: "os" },
      profiles: [
        {
          name: "test",
          controls: [
            {
              id: "skipped-ctrl",
              title: "Skipped control",
              desc: "Desc",
              impact: 0.0,
              tags: {},
              results: [{ status: "skipped", code_desc: "N/A for this platform", run_time: 0.0 }],
            },
          ],
        },
      ],
      statistics: { duration: 0.2 },
      version: "5.0.0",
    };

    const result = parseJSON(inspecOutput);
    expect(result.controls[0].status).toBe("not-tested");
  });

  test("should flatten controls from multiple InSpec profiles", () => {
    const inspecOutput = {
      platform: { name: "aws" },
      profiles: [
        {
          name: "profile-1",
          controls: [
            { id: "p1-c1", title: "Profile 1 Control 1", desc: "D", impact: 0.5, tags: {}, results: [{ status: "passed", code_desc: "OK", run_time: 0.1 }] },
          ],
        },
        {
          name: "profile-2",
          controls: [
            { id: "p2-c1", title: "Profile 2 Control 1", desc: "D", impact: 0.5, tags: {}, results: [{ status: "passed", code_desc: "OK", run_time: 0.1 }] },
          ],
        },
      ],
      statistics: { duration: 1.0 },
      version: "5.0.0",
    };

    const result = parseJSON(inspecOutput);
    expect(result.controls).toHaveLength(2);
    expect(result.controls[0].id).toBe("p1-c1");
    expect(result.controls[1].id).toBe("p2-c1");
  });
});

// =============================================================================
// TRIVY FORMAT
// =============================================================================

describe("parseJSON — Trivy auto-detection", () => {
  test("should auto-detect Trivy format from SchemaVersion + Results", () => {
    const trivyOutput = {
      SchemaVersion: 2,
      ArtifactName: "myapp:latest",
      Results: [
        {
          Target: "Dockerfile",
          Class: "config",
          Misconfigurations: [
            {
              Type: "dockerfile",
              ID: "DS001",
              AVDID: "AVD-DS-0001",
              Title: "Running as root user",
              Description: "Running containers as root increases attack surface.",
              Severity: "HIGH",
              Status: "FAIL",
              Resolution: "Use USER instruction to set non-root user",
            },
            {
              Type: "dockerfile",
              ID: "DS005",
              AVDID: "AVD-DS-0005",
              Title: "COPY uses ADD",
              Description: "ADD has extra functionality.",
              Severity: "LOW",
              Status: "PASS",
              Resolution: "Use COPY instead of ADD",
            },
          ],
        },
      ],
    };

    const result = parseJSON(trivyOutput);

    expect(result.source).toBe("json");
    expect(result.metadata.title).toContain("Trivy");
    expect(result.controls).toHaveLength(2);

    expect(result.controls[0].id).toBe("DS001");
    expect(result.controls[0].status).toBe("ineffective");
    expect(result.controls[0].severity).toBe("HIGH");
    expect(result.controls[0].description).toBe("Running as root user");
    expect(result.controls[0].evidence).toContain("Running containers as root");

    expect(result.controls[1].id).toBe("DS005");
    expect(result.controls[1].status).toBe("effective");
  });

  test("should handle Trivy vulnerability results", () => {
    const trivyOutput = {
      SchemaVersion: 2,
      ArtifactName: "myapp:latest",
      Results: [
        {
          Target: "package-lock.json",
          Class: "lang-pkgs",
          Vulnerabilities: [
            {
              VulnerabilityID: "CVE-2023-1234",
              PkgName: "lodash",
              InstalledVersion: "4.17.20",
              FixedVersion: "4.17.21",
              Severity: "CRITICAL",
              Title: "Prototype pollution in lodash",
              Description: "Lodash before 4.17.21 has prototype pollution.",
            },
            {
              VulnerabilityID: "CVE-2023-5678",
              PkgName: "express",
              InstalledVersion: "4.18.0",
              FixedVersion: "4.18.2",
              Severity: "MEDIUM",
              Title: "Open redirect in express",
              Description: "Express before 4.18.2 has open redirect.",
            },
          ],
        },
      ],
    };

    const result = parseJSON(trivyOutput);

    expect(result.controls).toHaveLength(2);
    expect(result.controls[0].id).toBe("CVE-2023-1234");
    expect(result.controls[0].status).toBe("ineffective"); // Vulns are always ineffective
    expect(result.controls[0].severity).toBe("CRITICAL");
    expect(result.controls[0].evidence).toContain("lodash");

    expect(result.controls[1].id).toBe("CVE-2023-5678");
    expect(result.controls[1].status).toBe("ineffective");
  });

  test("should handle Trivy mixed results (misconfigs + vulns)", () => {
    const trivyOutput = {
      SchemaVersion: 2,
      ArtifactName: "myapp:latest",
      Results: [
        {
          Target: "Dockerfile",
          Class: "config",
          Misconfigurations: [
            { Type: "dockerfile", ID: "DS001", Title: "Root user", Description: "Bad", Severity: "HIGH", Status: "FAIL", Resolution: "Fix" },
          ],
        },
        {
          Target: "package.json",
          Class: "lang-pkgs",
          Vulnerabilities: [
            { VulnerabilityID: "CVE-2023-9999", PkgName: "pkg", InstalledVersion: "1.0", Severity: "LOW", Title: "Minor issue", Description: "Desc" },
          ],
        },
      ],
    };

    const result = parseJSON(trivyOutput);
    expect(result.controls).toHaveLength(2);
    expect(result.controls[0].id).toBe("DS001");
    expect(result.controls[1].id).toBe("CVE-2023-9999");
  });

  test("should handle empty Trivy results", () => {
    const trivyOutput = {
      SchemaVersion: 2,
      ArtifactName: "clean-image:latest",
      Results: [],
    };

    const result = parseJSON(trivyOutput);
    expect(result.controls).toHaveLength(0);
  });
});

// =============================================================================
// GITLAB SECURITY REPORT FORMAT
// =============================================================================

describe("parseJSON — GitLab security report auto-detection", () => {
  test("should auto-detect GitLab SAST report format", () => {
    const glReport = {
      version: "15.0.7",
      scan: {
        analyzer: { id: "semgrep", name: "Semgrep", version: "1.0.0", vendor: { name: "GitLab" } },
        scanner: { id: "semgrep", name: "Semgrep", version: "1.0.0", vendor: { name: "GitLab" } },
        type: "sast",
        start_time: "2026-02-12T08:00:00Z",
        end_time: "2026-02-12T08:01:00Z",
        status: "success",
      },
      vulnerabilities: [
        {
          id: "vuln-001",
          category: "sast",
          name: "SQL Injection in login handler",
          description: "User input passed directly to SQL query without sanitization",
          severity: "Critical",
          scanner: { id: "semgrep", name: "Semgrep" },
          location: { file: "src/auth/login.ts", start_line: 42 },
          identifiers: [
            { type: "cwe", name: "CWE-89", value: "89", url: "https://cwe.mitre.org/data/definitions/89.html" },
          ],
        },
        {
          id: "vuln-002",
          category: "sast",
          name: "Hardcoded secret in config",
          description: "API key hardcoded in configuration file",
          severity: "High",
          scanner: { id: "semgrep", name: "Semgrep" },
          location: { file: "src/config.ts", start_line: 15 },
          identifiers: [
            { type: "cwe", name: "CWE-798", value: "798" },
          ],
        },
        {
          id: "vuln-003",
          category: "sast",
          name: "Unused variable",
          description: "Variable declared but never used",
          severity: "Info",
          scanner: { id: "semgrep", name: "Semgrep" },
          location: { file: "src/utils.ts", start_line: 3 },
          identifiers: [
            { type: "cwe", name: "CWE-561", value: "561" },
          ],
        },
      ],
    };

    const result = parseJSON(glReport);

    expect(result.source).toBe("json");
    expect(result.metadata.title).toContain("GitLab");
    expect(result.metadata.title).toContain("SAST");
    expect(result.controls).toHaveLength(3);

    // SQL Injection — Critical severity
    expect(result.controls[0].id).toBe("vuln-001");
    expect(result.controls[0].description).toBe("SQL Injection in login handler");
    expect(result.controls[0].status).toBe("ineffective"); // Vulnerabilities = findings
    expect(result.controls[0].severity).toBe("CRITICAL");
    expect(result.controls[0].evidence).toContain("SQL query");

    // Hardcoded secret
    expect(result.controls[1].severity).toBe("HIGH");

    // Info-level finding
    expect(result.controls[2].severity).toBe("LOW"); // Info maps to LOW
  });

  test("should extract CWE framework refs from identifiers", () => {
    const glReport = {
      version: "15.0.7",
      scan: {
        analyzer: { id: "a", name: "A", version: "1", vendor: { name: "GL" } },
        scanner: { id: "s", name: "S", version: "1", vendor: { name: "GL" } },
        type: "sast",
        start_time: "2026-01-01T00:00:00Z",
        end_time: "2026-01-01T00:01:00Z",
        status: "success",
      },
      vulnerabilities: [
        {
          id: "v1",
          name: "Test vuln",
          severity: "Medium",
          location: { file: "test.ts", start_line: 1 },
          identifiers: [
            { type: "cwe", name: "CWE-89", value: "89" },
            { type: "cve", name: "CVE-2026-1234", value: "CVE-2026-1234" },
          ],
        },
      ],
    };

    const result = parseJSON(glReport);
    const refs = result.controls[0].frameworkRefs!;
    expect(refs).toBeDefined();
    expect(refs.length).toBeGreaterThanOrEqual(1);

    const cweRef = refs.find(r => r.framework === "CWE");
    expect(cweRef).toBeDefined();
    expect(cweRef!.controlId).toBe("89");
  });

  test("should handle GitLab dependency scanning report", () => {
    const glReport = {
      version: "15.0.7",
      scan: {
        analyzer: { id: "gemnasium", name: "Gemnasium", version: "4.0", vendor: { name: "GitLab" } },
        scanner: { id: "gemnasium", name: "Gemnasium", version: "4.0", vendor: { name: "GitLab" } },
        type: "dependency_scanning",
        start_time: "2026-02-12T08:00:00Z",
        end_time: "2026-02-12T08:02:00Z",
        status: "success",
      },
      vulnerabilities: [
        {
          id: "dep-001",
          name: "Prototype pollution in lodash",
          description: "lodash before 4.17.21 has prototype pollution",
          severity: "High",
          location: {
            file: "package-lock.json",
            dependency: { package: { name: "lodash" }, version: "4.17.20" },
          },
          identifiers: [
            { type: "cve", name: "CVE-2021-23337", value: "CVE-2021-23337" },
          ],
        },
      ],
    };

    const result = parseJSON(glReport);

    expect(result.metadata.title).toContain("DEPENDENCY SCANNING");
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0].id).toBe("dep-001");
    expect(result.controls[0].status).toBe("ineffective");
    expect(result.controls[0].evidence).toContain("lodash");
  });

  test("should handle clean GitLab scan with zero vulnerabilities", () => {
    const glReport = {
      version: "15.0.7",
      scan: {
        analyzer: { id: "semgrep", name: "Semgrep", version: "1.0", vendor: { name: "GitLab" } },
        scanner: { id: "semgrep", name: "Semgrep", version: "1.0", vendor: { name: "GitLab" } },
        type: "sast",
        start_time: "2026-02-12T08:00:00Z",
        end_time: "2026-02-12T08:00:30Z",
        status: "success",
      },
      vulnerabilities: [],
    };

    const result = parseJSON(glReport);
    expect(result.controls).toHaveLength(0);
    expect(result.metadata.title).toContain("GitLab");
  });

  test("should map GitLab severity Unknown correctly", () => {
    const glReport = {
      version: "15.0.7",
      scan: {
        analyzer: { id: "a", name: "A", version: "1", vendor: { name: "GL" } },
        scanner: { id: "s", name: "S", version: "1", vendor: { name: "GL" } },
        type: "sast",
        start_time: "2026-01-01T00:00:00Z",
        end_time: "2026-01-01T00:01:00Z",
        status: "success",
      },
      vulnerabilities: [
        {
          id: "v1",
          name: "Unknown severity vuln",
          severity: "Unknown",
          location: { file: "test.ts", start_line: 1 },
          identifiers: [{ type: "cwe", name: "CWE-1", value: "1" }],
        },
      ],
    };

    const result = parseJSON(glReport);
    expect(result.controls[0].severity).toBe("LOW"); // Unknown → LOW
  });

  test("should produce output compatible with provenance derivation and mapper", () => {
    const glReport = {
      version: "15.0.7",
      scan: {
        analyzer: { id: "semgrep", name: "Semgrep", version: "1.0", vendor: { name: "GitLab" } },
        scanner: { id: "semgrep", name: "Semgrep", version: "1.0", vendor: { name: "GitLab" } },
        type: "sast",
        start_time: "2026-02-12T08:00:00Z",
        end_time: "2026-02-12T08:01:00Z",
        status: "success",
      },
      vulnerabilities: [
        {
          id: "v1",
          name: "XSS in template",
          description: "Cross-site scripting via unescaped output",
          severity: "High",
          location: { file: "src/views/index.html", start_line: 10 },
          identifiers: [{ type: "cwe", name: "CWE-79", value: "79" }],
        },
      ],
    };

    const doc = parseJSON(glReport);
    const provenance = deriveProvenance(doc.source, doc.metadata);
    expect(provenance.source).toBe("tool");
    expect(doc.metadata.reportType).toBe("GitLab Security Report");

    const marqueInput = mapToMarqueInput(doc);
    expect(marqueInput.document).toBeDefined();
  });
});

// =============================================================================
// CISO ASSISTANT FORMAT
// =============================================================================

describe("parseJSON — CISO Assistant auto-detection", () => {
  test("should auto-detect CISO Assistant API response (DRF paginated)", () => {
    const cisoOutput = {
      count: 3,
      next: null,
      previous: null,
      results: [
        {
          id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1",
          compliance_assessment: "ca-uuid-1",
          result: "compliant",
          observation: "MFA enforced via Okta for all user groups",
          score: 95,
          evidences: ["ev-uuid-1", "ev-uuid-2"],
          applied_controls: ["ac-uuid-1"],
          folder: "folder-uuid-1",
          status: "done",
        },
        {
          id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC6.1",
          compliance_assessment: "ca-uuid-1",
          result: "non_compliant",
          observation: "S3 bucket public access not restricted",
          score: 20,
          evidences: [],
          applied_controls: ["ac-uuid-2"],
          folder: "folder-uuid-1",
          status: "done",
        },
        {
          id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
          requirement: "urn:intuitem:risk:req_node:nist-800-53-rev5:AC-2",
          compliance_assessment: "ca-uuid-1",
          result: "not_assessed",
          observation: "",
          score: 0,
          evidences: [],
          applied_controls: [],
          folder: "folder-uuid-1",
          status: "to_do",
        },
      ],
    };

    const result = parseJSON(cisoOutput);

    expect(result.source).toBe("ciso-assistant");
    expect(result.metadata.title).toContain("CISO Assistant");
    expect(result.metadata.issuer).toBe("CISO Assistant");
    expect(result.controls).toHaveLength(3);

    // compliant → effective
    expect(result.controls[0].id).toBe("CC1.1");
    expect(result.controls[0].status).toBe("effective");
    expect(result.controls[0].evidence).toContain("MFA enforced via Okta");
    expect(result.controls[0].evidence).toContain("Score: 95");

    // non_compliant → ineffective
    expect(result.controls[1].id).toBe("CC6.1");
    expect(result.controls[1].status).toBe("ineffective");

    // not_assessed → not-tested
    expect(result.controls[2].id).toBe("AC-2");
    expect(result.controls[2].status).toBe("not-tested");
  });

  test("should extract framework refs from CISO Assistant URNs", () => {
    const cisoOutput = {
      count: 3,
      next: null,
      previous: null,
      results: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1",
          result: "compliant",
          observation: "Test",
          score: 90,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
        {
          id: "uuid-2",
          requirement: "urn:intuitem:risk:req_node:nist-800-53-rev5:AC-2",
          result: "compliant",
          observation: "Test",
          score: 85,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
        {
          id: "uuid-3",
          requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.5.1",
          result: "compliant",
          observation: "Test",
          score: 80,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const result = parseJSON(cisoOutput);

    // SOC2 URN
    expect(result.controls[0].frameworkRefs).toBeDefined();
    expect(result.controls[0].frameworkRefs![0].framework).toBe("SOC2");
    expect(result.controls[0].frameworkRefs![0].controlId).toBe("CC1.1");

    // NIST URN
    expect(result.controls[1].frameworkRefs![0].framework).toBe("NIST-800-53");
    expect(result.controls[1].frameworkRefs![0].controlId).toBe("AC-2");

    // ISO 27001 URN
    expect(result.controls[2].frameworkRefs![0].framework).toBe("ISO27001");
    expect(result.controls[2].frameworkRefs![0].controlId).toBe("A.5.1");
  });

  test("should map partially_compliant to ineffective", () => {
    const cisoOutput = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC2.1",
          result: "partially_compliant",
          observation: "Partially implemented — missing backup region",
          score: 50,
          evidences: ["ev-1"],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const result = parseJSON(cisoOutput);
    expect(result.controls[0].status).toBe("ineffective");
    expect(result.controls[0].evidence).toContain("Partially implemented");
  });

  test("should map not_applicable to not-tested", () => {
    const cisoOutput = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC7.3",
          result: "not_applicable",
          observation: "No on-premise infrastructure",
          score: 0,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const result = parseJSON(cisoOutput);
    expect(result.controls[0].status).toBe("not-tested");
  });

  test("should build evidence from observation + score + evidence/control counts", () => {
    const cisoOutput = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1",
          result: "compliant",
          observation: "Verified MFA policy in Okta admin console",
          score: 88,
          evidences: ["ev-1", "ev-2", "ev-3"],
          applied_controls: ["ac-1", "ac-2"],
          folder: "f",
          status: "done",
        },
      ],
    };

    const result = parseJSON(cisoOutput);
    const evidence = result.controls[0].evidence!;
    expect(evidence).toContain("Verified MFA policy");
    expect(evidence).toContain("Score: 88");
    expect(evidence).toContain("3 evidence");
    expect(evidence).toContain("2 applied controls");
  });

  test("should handle CISO Assistant domain export format", () => {
    const cisoExport = {
      meta: {
        media_version: "0.6",
        exported_at: "2026-02-12T10:00:00Z",
      },
      requirement_assessments: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1",
          result: "compliant",
          observation: "Control is effective",
          score: 90,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const result = parseJSON(cisoExport);

    expect(result.source).toBe("ciso-assistant");
    expect(result.metadata.title).toContain("CISO Assistant");
    expect(result.controls).toHaveLength(1);
    expect(result.controls[0].status).toBe("effective");
  });

  test("should produce output compatible with provenance derivation", () => {
    const cisoOutput = {
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1",
          result: "compliant",
          observation: "Config verified via Okta admin panel",
          score: 90,
          evidences: ["ev-1"],
          applied_controls: ["ac-1"],
          folder: "f",
          status: "done",
        },
        {
          id: "uuid-2",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC6.1",
          result: "non_compliant",
          observation: "Public access not restricted",
          score: 10,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const doc = parseJSON(cisoOutput);
    const provenance = deriveProvenance(doc.source, doc.metadata);

    expect(provenance.source).toBe("tool");
    // CISO Assistant should still be parsed with metadata and controls
    expect(doc.controls.length).toBeGreaterThan(0);
  });

  test("should produce correct provenance for ciso-assistant source", () => {
    const cisoOutput = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1",
          result: "compliant",
          observation: "OK",
          score: 90,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const doc = parseJSON(cisoOutput);
    const provenance = deriveProvenance(doc.source, doc.metadata);

    expect(provenance.source).toBe("tool");
    expect(provenance.sourceIdentity).toBe("CISO Assistant");
  });

  test("should handle unknown URN framework slug gracefully", () => {
    const cisoOutput = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "uuid-1",
          requirement: "urn:intuitem:risk:req_node:custom-framework-v1:CTRL-42",
          result: "compliant",
          observation: "OK",
          score: 90,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const result = parseJSON(cisoOutput);
    expect(result.controls[0].frameworkRefs).toBeDefined();
    expect(result.controls[0].frameworkRefs![0].framework).toBe("custom-framework-v1");
    expect(result.controls[0].frameworkRefs![0].controlId).toBe("CTRL-42");
  });

  test("should use requirement URN control ID as control id (not UUID)", () => {
    const cisoOutput = {
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: "a1b2c3d4-long-uuid-that-is-not-useful",
          requirement: "urn:intuitem:risk:req_node:pci-dss-4.0:1.2.3",
          result: "compliant",
          observation: "Firewall rules verified",
          score: 85,
          evidences: [],
          applied_controls: [],
          folder: "f",
          status: "done",
        },
      ],
    };

    const result = parseJSON(cisoOutput);
    expect(result.controls[0].id).toBe("1.2.3");
    expect(result.controls[0].frameworkRefs![0].framework).toBe("PCI-DSS");
  });
});

// =============================================================================
// ASSESSMENT CONTEXT
// =============================================================================

describe("parseJSON — assessment context", () => {
  test("should pass through assessment context when provided", () => {
    const input = {
      metadata: { title: "T", issuer: "I", date: "2026-01-01", scope: "S" },
      controls: [{ id: "C1", description: "D", status: "pass" }],
      assessmentContext: {
        techStack: [
          { component: "IdP", technology: "Okta", scope: "All employees" },
        ],
        gaps: ["Physical security not assessed"],
        assessorNotes: "Automated scan of AWS environment",
      },
    };

    const result = parseJSON(input);
    expect(result.assessmentContext).toBeDefined();
    expect(result.assessmentContext!.techStack).toHaveLength(1);
    expect(result.assessmentContext!.gaps).toHaveLength(1);
    expect(result.assessmentContext!.assessorNotes).toBe("Automated scan of AWS environment");
  });
});
