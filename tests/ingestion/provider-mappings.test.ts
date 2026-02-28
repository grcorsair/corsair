import { describe, test, expect } from "bun:test";
import { parseJSON } from "../../src/ingestion/json-parser";

function mappingId(doc: ReturnType<typeof parseJSON>): string | undefined {
  const mapping = doc.extensions?.mapping as { id?: string } | undefined;
  return mapping?.id;
}

describe("provider mappings", () => {
  test("maps Prowler findings to controls", () => {
    const input = {
      findings: [
        {
          check_id: "prowler-iam-001",
          title: "MFA enabled for root account",
          status: "FAIL",
          severity: "high",
          resource_id: "arn:aws:iam::123456789012:root",
          provider: "aws",
          checked_at: "2026-02-27T12:34:56Z",
        },
      ],
    };

    const doc = parseJSON(input);
    expect(mappingId(doc)).toBe("prowler");
    expect(doc.metadata.issuer).toBe("Prowler");
    expect(doc.controls).toHaveLength(1);
    expect(doc.controls[0].id).toBe("prowler-iam-001");
    expect(doc.controls[0].status).toBe("ineffective");
    expect(doc.controls[0].severity).toBe("HIGH");
  });

  test("maps AWS Security Hub findings to controls", () => {
    const input = {
      Findings: [
        {
          Id: "arn:aws:securityhub:us-east-1:123456789012:subscription/aws-foundational-security-best-practices/v/1.0.0/IAM.1/finding/abc",
          Title: "IAM root user access key should not exist",
          Description: "The root user should not have access keys.",
          Compliance: { Status: "FAILED" },
          Severity: { Label: "CRITICAL" },
          AwsAccountId: "123456789012",
          UpdatedAt: "2026-02-27T10:00:00Z",
          Resources: [{ Id: "arn:aws:iam::123456789012:root", Type: "AwsIamUser" }],
        },
      ],
    };

    const doc = parseJSON(input);
    expect(mappingId(doc)).toBe("aws-security-hub");
    expect(doc.metadata.issuer).toBe("AWS Security Hub");
    expect(doc.controls).toHaveLength(1);
    expect(doc.controls[0].status).toBe("ineffective");
    expect(doc.controls[0].severity).toBe("CRITICAL");
  });

  test("maps GitHub SARIF findings to controls", () => {
    const input = {
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "CodeQL", semanticVersion: "2.19.3" } },
          invocations: [{ endTimeUtc: "2026-02-27T12:00:00Z" }],
          results: [
            {
              ruleId: "js/sql-injection",
              level: "error",
              message: { text: "Potential SQL injection vulnerability." },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: "src/routes/user.ts" },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const doc = parseJSON(input);
    expect(mappingId(doc)).toBe("github-sarif");
    expect(doc.metadata.issuer).toBe("CodeQL");
    expect(doc.controls).toHaveLength(1);
    expect(doc.controls[0].id).toBe("js/sql-injection");
    expect(doc.controls[0].status).toBe("ineffective");
    expect(doc.controls[0].severity).toBe("HIGH");
  });

  test("maps GitLab SAST findings to controls", () => {
    const input = {
      scan: {
        scanner: { name: "GitLab SAST" },
        start_time: "2026-02-27T08:00:00Z",
      },
      vulnerabilities: [
        {
          id: "5a8f5f9f-1111-2222-3333-8bfc93dcebaf",
          name: "Hardcoded credentials",
          description: "A hardcoded credential was detected.",
          severity: "High",
          state: "detected",
          location: { file: "app/config.py" },
        },
      ],
    };

    const doc = parseJSON(input);
    expect(mappingId(doc)).toBe("gitlab-sast");
    expect(doc.metadata.issuer).toBe("GitLab SAST");
    expect(doc.controls).toHaveLength(1);
    expect(doc.controls[0].status).toBe("ineffective");
    expect(doc.controls[0].severity).toBe("HIGH");
  });
});
