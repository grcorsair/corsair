/**
 * Pre-computed anatomy page data for the Integration Ladder showcase.
 * All data is static — no live API calls on this page.
 *
 * Three evidence tiers:
 *   Tier 1: LOOKOUT  — Telemetry from source systems (CloudTrail, Azure Monitor, etc.)
 *   Tier 2: SPYGLASS — Output from security tools (InSpec, Prowler, Trivy, etc.)
 *   Tier 3: QUARTERMASTER — Results from GRC platforms (Vanta, Drata, CISO Assistant, etc.)
 */

export interface AnatomyControl {
  id: string;
  name: string;
  status: "effective" | "ineffective" | "not-tested";
  evidence: string;
  provenanceType: "self" | "tool" | "auditor";
  methodology: string;
}

/** Integration tier source info shown on the page */
export interface IntegrationTier {
  tier: number;
  pirateName: string;
  title: string;
  subtitle: string;
  description: string;
  sources: string[];
  evidenceType: string;
  provenanceType: string;
  cliExample: string;
  cliLabel: string;
}

export const INTEGRATION_TIERS: IntegrationTier[] = [
  {
    tier: 1,
    pirateName: "LOOKOUT",
    title: "Telemetry from Source Systems",
    subtitle: "Raw signal from the crow's nest",
    description:
      "Direct integration pulling raw telemetry from cloud providers and observability platforms. Event logs, API calls, configuration state, and audit trails — the ground truth of what your infrastructure is actually doing.",
    sources: [
      "AWS CloudTrail",
      "Azure Monitor",
      "GCP Audit Logs",
      "Datadog",
      "Splunk",
      "Elasticsearch",
    ],
    evidenceType: "Raw logs, API calls, config state, event streams",
    provenanceType: "tool (telemetry)",
    cliExample: "corsair sign --format cloudtrail --input trail.json",
    cliLabel: "Sign CloudTrail evidence as L1 CPOE",
  },
  {
    tier: 2,
    pirateName: "SPYGLASS",
    title: "Output from Security Tools",
    subtitle: "Focused assessment of what the lookout spotted",
    description:
      "Security scanners and compliance tools that actively test your infrastructure. Vulnerability scans, policy checks, configuration audits — tools that go beyond observation and produce structured compliance findings.",
    sources: [
      "InSpec",
      "Prowler",
      "Trivy",
      "ComplianceAsCode",
      "Wiz",
      "Snyk",
    ],
    evidenceType: "Scan results, compliance checks, vulnerability reports",
    provenanceType: "tool (scanner)",
    cliExample: "prowler aws --output json | corsair sign --format prowler",
    cliLabel: "Pipe Prowler output directly into corsair sign",
  },
  {
    tier: 3,
    pirateName: "QUARTERMASTER",
    title: "Results from GRC Platforms",
    subtitle: "Governed, reviewed, and continuously validated",
    description:
      "GRC platforms that aggregate evidence, manage control lifecycles, and provide continuous monitoring. Structured compliance data with governance context — the richest evidence source, producing the highest assurance levels.",
    sources: [
      "Vanta",
      "Drata",
      "CISO Assistant",
      "Eramba",
      "OneTrust",
      "Conveyor",
    ],
    evidenceType: "Control assessments, continuous monitoring, audit results",
    provenanceType: "tool (platform)",
    cliExample:
      "corsair sign --format ciso-assistant --input controls-export.json",
    cliLabel: "Sign GRC platform export as L2+ CPOE",
  },
];

/** Sample controls from a Prowler scan (Tier 2 example) */
export const ANATOMY_CONTROLS: AnatomyControl[] = [
  {
    id: "prowler-iam-1",
    name: "MFA Enabled for Root Account",
    status: "effective",
    evidence:
      "Prowler check: iam_root_hardware_mfa_enabled — PASS. Hardware MFA device attached to root account.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "prowler-iam-4",
    name: "IAM Password Policy Enforced",
    status: "effective",
    evidence:
      "Prowler check: iam_password_policy_minimum_length_14 — PASS. Minimum 14 chars, complexity enabled.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "prowler-s3-1",
    name: "S3 Bucket Encryption at Rest",
    status: "effective",
    evidence:
      "Prowler check: s3_bucket_default_encryption — PASS. AES-256 (SSE-S3) enabled on all 12 buckets.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "prowler-vpc-1",
    name: "VPC Flow Logs Enabled",
    status: "effective",
    evidence:
      "Prowler check: vpc_flow_logs_enabled — PASS. Flow logs active on all 3 VPCs.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "trivy-vuln-1",
    name: "Container Image Vulnerability Scan",
    status: "effective",
    evidence:
      "Trivy scan: 0 critical, 0 high vulnerabilities in production images. Full scan of 8 images.",
    provenanceType: "tool",
    methodology: "automated-vulnerability-scan",
  },
  {
    id: "inspec-cis-1",
    name: "CIS Benchmark: SSH Configuration",
    status: "effective",
    evidence:
      "InSpec profile: cis-aws-foundations-baseline — 42/42 controls passed. SSH hardened per CIS L1.",
    provenanceType: "tool",
    methodology: "compliance-benchmark-test",
  },
  {
    id: "prowler-ct-1",
    name: "CloudTrail Logging Enabled",
    status: "effective",
    evidence:
      "Prowler check: cloudtrail_multi_region_enabled — PASS. Multi-region trail active with S3 delivery.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "prowler-guard-1",
    name: "GuardDuty Threat Detection Active",
    status: "effective",
    evidence:
      "Prowler check: guardduty_is_enabled — PASS. GuardDuty active in all 3 regions.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "prowler-ec2-1",
    name: "EC2 IMDSv2 Enforced",
    status: "ineffective",
    evidence:
      "Prowler check: ec2_imdsv2_only — FAIL. 2 of 14 instances still allow IMDSv1.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "prowler-kms-1",
    name: "KMS Key Rotation Enabled",
    status: "ineffective",
    evidence:
      "Prowler check: kms_cmk_rotation_enabled — FAIL. 1 of 5 CMKs missing automatic rotation.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
];

export const ANATOMY_FRAMEWORKS = [
  { name: "SOC 2", controlsMapped: 24, passed: 22, failed: 2 },
  { name: "NIST 800-53", controlsMapped: 22, passed: 20, failed: 2 },
  { name: "ISO 27001", controlsMapped: 18, passed: 16, failed: 2 },
  { name: "HIPAA", controlsMapped: 14, passed: 13, failed: 1 },
  { name: "PCI-DSS", controlsMapped: 12, passed: 11, failed: 1 },
  { name: "CIS Controls", controlsMapped: 16, passed: 15, failed: 1 },
  { name: "MITRE ATT&CK", controlsMapped: 8, passed: 7, failed: 1 },
];

export const PROVENANCE_LABELS: Record<
  string,
  { name: string; color: string; bgColor: string }
> = {
  self: {
    name: "Self-Assessed",
    color: "text-corsair-text-dim",
    bgColor: "bg-corsair-text-dim/20",
  },
  tool: {
    name: "Tool-Generated",
    color: "text-corsair-green",
    bgColor: "bg-corsair-green/20",
  },
  auditor: {
    name: "Auditor-Verified",
    color: "text-corsair-gold",
    bgColor: "bg-corsair-gold/20",
  },
};
