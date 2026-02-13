/**
 * Playground Examples — Pre-loaded evidence samples for all 8 supported formats.
 * Each example is realistic, self-documenting, and includes a mix of passing/failing controls.
 */

export interface PlaygroundExample {
  name: string;
  format: string;
  description: string;
  data: unknown;
}

export const PLAYGROUND_EXAMPLES: PlaygroundExample[] = [
  {
    name: "Generic Evidence",
    format: "generic",
    description: "Simple JSON with metadata + controls array. Works with any assessment.",
    data: {
      metadata: {
        title: "Acme Corp Cloud Security Assessment",
        issuer: "Acme Security Team",
        date: "2026-02-01",
        scope: "AWS production (us-east-1)",
      },
      controls: [
        { id: "MFA-001", description: "MFA enforced for all users", status: "pass", evidence: "Okta MFA policy active for 142 users" },
        { id: "ENC-001", description: "Encryption at rest enabled", status: "pass", evidence: "RDS encrypted with KMS CMK" },
        { id: "LOG-001", description: "Centralized logging active", status: "pass", evidence: "CloudTrail + VPC Flow Logs to Datadog" },
        { id: "IR-001", description: "Incident response plan tested", status: "fail", evidence: "Tabletop exercise overdue by 2 months" },
        { id: "BCP-001", description: "DR failover tested", status: "fail", evidence: "DR failover never tested" },
      ],
    },
  },
  {
    name: "Prowler Findings",
    format: "prowler",
    description: "AWS Prowler OCSF-format findings from cloud security scanning.",
    data: [
      { StatusCode: "PASS", FindingInfo: { Uid: "prowler-iam-root-mfa", Title: "Root account has MFA enabled" }, Resources: [{ Uid: "arn:aws:iam::root" }] },
      { StatusCode: "PASS", FindingInfo: { Uid: "prowler-s3-encryption", Title: "S3 buckets have default encryption" }, Resources: [{ Uid: "arn:aws:s3:::data-bucket" }] },
      { StatusCode: "FAIL", FindingInfo: { Uid: "prowler-s3-public", Title: "S3 bucket allows public access" }, Resources: [{ Uid: "arn:aws:s3:::marketing-assets" }] },
      { StatusCode: "PASS", FindingInfo: { Uid: "prowler-cloudtrail", Title: "CloudTrail is enabled in all regions" }, Resources: [{ Uid: "arn:aws:cloudtrail:us-east-1" }] },
      { StatusCode: "PASS", FindingInfo: { Uid: "prowler-vpc-flow", Title: "VPC Flow Logs enabled" }, Resources: [{ Uid: "vpc-0abc123" }] },
      { StatusCode: "FAIL", FindingInfo: { Uid: "prowler-rds-public", Title: "RDS instance is publicly accessible" }, Resources: [{ Uid: "arn:aws:rds:staging-db" }] },
    ],
  },
  {
    name: "SecurityHub Findings",
    format: "securityhub",
    description: "AWS SecurityHub ASFF-format findings.",
    data: {
      Findings: [
        { Id: "sh-001", Title: "IAM root user access key active", Compliance: { Status: "FAILED" }, Severity: { Label: "CRITICAL" } },
        { Id: "sh-002", Title: "CloudTrail enabled", Compliance: { Status: "PASSED" }, Severity: { Label: "HIGH" } },
        { Id: "sh-003", Title: "S3 bucket versioning enabled", Compliance: { Status: "PASSED" }, Severity: { Label: "MEDIUM" } },
        { Id: "sh-004", Title: "EBS default encryption enabled", Compliance: { Status: "PASSED" }, Severity: { Label: "MEDIUM" } },
        { Id: "sh-005", Title: "GuardDuty enabled", Compliance: { Status: "PASSED" }, Severity: { Label: "HIGH" } },
      ],
    },
  },
  {
    name: "InSpec Report",
    format: "inspec",
    description: "Chef InSpec JSON report from compliance profile execution.",
    data: {
      profiles: [
        {
          name: "aws-cis-benchmark",
          controls: [
            { id: "cis-1.1", title: "Avoid root account usage", results: [{ status: "passed" }] },
            { id: "cis-1.4", title: "Ensure MFA is enabled for root", results: [{ status: "passed" }] },
            { id: "cis-2.1", title: "Ensure CloudTrail is enabled", results: [{ status: "passed" }] },
            { id: "cis-2.6", title: "Ensure S3 access logging", results: [{ status: "failed" }] },
            { id: "cis-3.1", title: "Ensure VPC Flow Logs", results: [{ status: "passed" }] },
          ],
        },
      ],
    },
  },
  {
    name: "Trivy Report",
    format: "trivy",
    description: "Aqua Trivy container vulnerability scan results.",
    data: {
      Results: [
        {
          Target: "alpine:3.18",
          Vulnerabilities: [
            { VulnerabilityID: "CVE-2024-0001", Severity: "CRITICAL", Title: "OpenSSL buffer overflow", PkgName: "openssl" },
            { VulnerabilityID: "CVE-2024-0002", Severity: "HIGH", Title: "libcurl header injection", PkgName: "curl" },
            { VulnerabilityID: "CVE-2024-0003", Severity: "LOW", Title: "zlib compression issue", PkgName: "zlib" },
          ],
        },
        {
          Target: "node:20-slim",
          Vulnerabilities: [
            { VulnerabilityID: "CVE-2024-0004", Severity: "MEDIUM", Title: "Node.js HTTP smuggling", PkgName: "nodejs" },
          ],
        },
      ],
    },
  },
  {
    name: "GitLab SAST",
    format: "gitlab",
    description: "GitLab SAST JSON report from CI/CD pipeline.",
    data: {
      version: "15.0.0",
      vulnerabilities: [
        { id: "gl-001", name: "SQL Injection in login", severity: "Critical", location: { file: "src/auth.ts", start_line: 42 } },
        { id: "gl-002", name: "XSS in user profile", severity: "High", location: { file: "src/profile.ts", start_line: 78 } },
        { id: "gl-003", name: "Insecure random number", severity: "Medium", location: { file: "src/token.ts", start_line: 15 } },
      ],
    },
  },
  {
    name: "CISO Assistant API",
    format: "ciso-assistant-api",
    description: "CISO Assistant compliance assessment via API response.",
    data: {
      results: [
        { id: 1, name: "Information Security Policy", result: "compliant", description: "Policies documented and reviewed annually", score: 90 },
        { id: 2, name: "Access Control", result: "compliant", description: "RBAC implemented across all systems", score: 85 },
        { id: 3, name: "Personnel Screening", result: "non_compliant", description: "Background checks not implemented for contractors", score: 40 },
        { id: 4, name: "Endpoint Protection", result: "compliant", description: "EDR deployed on 100% of managed devices", score: 95 },
        { id: 5, name: "Configuration Management", result: "partially_compliant", description: "3 legacy servers not covered by IaC", score: 55 },
      ],
    },
  },
  {
    name: "CISO Assistant Export",
    format: "ciso-assistant-export",
    description: "CISO Assistant domain export with requirement assessments.",
    data: {
      meta: {
        media_version: "1.0",
        exported_at: "2026-02-10T09:30:00Z",
        exporter: "CISO Assistant v2.4.0",
        scope: "ISO 27001:2022 Certification Readiness",
      },
      requirement_assessments: [
        { id: "ra-001", requirement: "A.5.1", result: "compliant", observation: "Info security policies documented and approved", score: 91 },
        { id: "ra-002", requirement: "A.8.1", result: "compliant", observation: "Endpoint devices managed via Jamf/Intune", score: 93 },
        { id: "ra-003", requirement: "A.6.1", result: "non_compliant", observation: "Background checks missing for 38 contractors", score: 45 },
        { id: "ra-004", requirement: "A.8.24", result: "compliant", observation: "Encryption at rest for all databases", score: 96 },
      ],
    },
  },
];
