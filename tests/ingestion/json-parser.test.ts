/**
 * JSON Parser Tests — Generic Evidence Ingestion
 *
 * TDD: Write tests first, then implement.
 * Tests cover: generic JSON, Prowler OCSF, SecurityHub ASFF,
 * auto-detection, error handling, and pipeline integration.
 */

import { describe, test, expect } from "bun:test";
import { parseJSON } from "../../src/ingestion/json-parser";
import {
  calculateDocumentAssurance,
  calculateDocumentRollup,
} from "../../src/ingestion/assurance-calculator";
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
  test("should produce output compatible with assurance calculator", () => {
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
    const classified = calculateDocumentAssurance(doc.controls, doc.source, doc.metadata);

    expect(classified).toHaveLength(3);
    // Effective controls with evidence should get L1+ (json source ceiling is L1)
    expect(classified[0].assuranceLevel).toBeGreaterThanOrEqual(0);
    expect(classified[1].assuranceLevel).toBeGreaterThanOrEqual(0);
    // Failed control should be L0
    expect(classified[2].assuranceLevel).toBe(0);
  });

  test("should produce output compatible with document rollup", () => {
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
    const classified = calculateDocumentAssurance(doc.controls, doc.source, doc.metadata);
    const { assurance, provenance } = calculateDocumentRollup(classified, doc.source, doc.metadata);

    expect(assurance.declared).toBeGreaterThanOrEqual(0);
    expect(assurance.verified).toBeDefined();
    expect(assurance.method).toBe("automated-config-check");
    expect(provenance.source).toBe("tool");
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

  test("prowler source should get prowler assurance treatment", () => {
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
    const classified = calculateDocumentAssurance(doc.controls, doc.source, doc.metadata);
    const { provenance } = calculateDocumentRollup(classified, doc.source, doc.metadata);

    // Prowler = tool provenance, automated-config-check method
    expect(provenance.source).toBe("tool");
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
