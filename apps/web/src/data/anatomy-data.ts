/**
 * Pre-computed anatomy page data for the Integration Ladder showcase.
 * All data is static — no live API calls on this page.
 *
 * Three evidence tiers:
 *   Tier 1: LOOKOUT  — Telemetry from source systems (CloudTrail, Azure Monitor, etc.)
 *   Tier 2: SPYGLASS — Output from security tools (via mapping packs)
 *   Tier 3: QUARTERMASTER — Results from GRC platforms (via mapping packs)
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
      "AWS CloudTrail (coming soon)",
      "Azure Monitor (coming soon)",
      "GCP Audit Logs (coming soon)",
      "Datadog (coming soon)",
      "Splunk (coming soon)",
      "Elasticsearch (coming soon)",
    ],
    evidenceType: "Raw logs, API calls, config state, event streams",
    provenanceType: "tool (telemetry)",
    cliExample: "corsair sign --file trail.json --format generic",
    cliLabel: "Sign telemetry evidence as CPOE (generic format)",
  },
  {
    tier: 2,
    pirateName: "SPYGLASS",
    title: "Output from Security Tools",
    subtitle: "Focused assessment of what the lookout spotted",
    description:
      "Security scanners and compliance tools that actively test your infrastructure. Vulnerability scans, policy checks, configuration audits — tools that go beyond observation and produce structured compliance findings.",
    sources: [
      "CSPM scanners (via mapping pack)",
      "SAST outputs (via mapping pack)",
      "Vulnerability scanners (via mapping pack)",
      "Cloud posture exports (via mapping pack)",
      "Policy engines (via mapping pack)",
      "Custom tooling (via mapping pack)",
    ],
    evidenceType: "Scan results, compliance checks, vulnerability reports",
    provenanceType: "tool (scanner)",
    cliExample: "corsair sign --file tool-output.json --mapping ./mappings/toolx.json --output cpoe.jwt",
    cliLabel: "Apply a mapping pack to tool output",
  },
  {
    tier: 3,
    pirateName: "QUARTERMASTER",
    title: "Results from GRC Platforms",
    subtitle: "Governed, reviewed, and continuously validated",
    description:
      "GRC platforms that aggregate evidence, manage control lifecycles, and provide continuous monitoring. Structured compliance data with governance context — the richest evidence source.",
    sources: [
      "Open-source GRC exports (via mapping pack)",
      "GRC APIs (via mapping pack)",
      "Audit platforms (via mapping pack)",
      "Vendor questionnaires (via mapping pack)",
      "Assurance portals (via mapping pack)",
      "Custom evidence hubs (via mapping pack)",
    ],
    evidenceType: "Control assessments, continuous monitoring, audit results",
    provenanceType: "tool (platform)",
    cliExample:
      "corsair sign --file grc-export.json --mapping ./mappings/grc.json",
    cliLabel: "Sign GRC platform export as CPOE",
  },
];

/** Sample controls from a tool scan (Tier 2 example) */
export const ANATOMY_CONTROLS: AnatomyControl[] = [
  {
    id: "scan-iam-1",
    name: "MFA Enabled for Root Account",
    status: "effective",
    evidence:
      "Scanner check: iam_root_hardware_mfa_enabled — PASS. Hardware MFA device attached to root account.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "scan-iam-4",
    name: "IAM Password Policy Enforced",
    status: "effective",
    evidence:
      "Scanner check: iam_password_policy_minimum_length_14 — PASS. Minimum 14 chars, complexity enabled.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "scan-s3-1",
    name: "S3 Bucket Encryption at Rest",
    status: "effective",
    evidence:
      "Scanner check: s3_bucket_default_encryption — PASS. AES-256 (SSE-S3) enabled on all 12 buckets.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "scan-vpc-1",
    name: "VPC Flow Logs Enabled",
    status: "effective",
    evidence:
      "Scanner check: vpc_flow_logs_enabled — PASS. Flow logs active on all 3 VPCs.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "scan-vuln-1",
    name: "Container Image Vulnerability Scan",
    status: "effective",
    evidence:
      "Scanner scan: 0 critical, 0 high vulnerabilities in production images. Full scan of 8 images.",
    provenanceType: "tool",
    methodology: "automated-vulnerability-scan",
  },
  {
    id: "scan-cis-1",
    name: "CIS Benchmark: SSH Configuration",
    status: "effective",
    evidence:
      "Compliance profile: cis-aws-foundations-baseline — 42/42 controls passed. SSH hardened per CIS Level 1 baseline.",
    provenanceType: "tool",
    methodology: "compliance-benchmark-test",
  },
  {
    id: "scan-ct-1",
    name: "CloudTrail Logging Enabled",
    status: "effective",
    evidence:
      "Scanner check: cloudtrail_multi_region_enabled — PASS. Multi-region trail active with S3 delivery.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "scan-guard-1",
    name: "GuardDuty Threat Detection Active",
    status: "effective",
    evidence:
      "Scanner check: guardduty_is_enabled — PASS. GuardDuty active in all 3 regions.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "scan-ec2-1",
    name: "EC2 IMDSv2 Enforced",
    status: "ineffective",
    evidence:
      "Scanner check: ec2_imdsv2_only — FAIL. 2 of 14 instances still allow IMDSv1.",
    provenanceType: "tool",
    methodology: "automated-config-check",
  },
  {
    id: "scan-kms-1",
    name: "KMS Key Rotation Enabled",
    status: "ineffective",
    evidence:
      "Scanner check: kms_cmk_rotation_enabled — FAIL. 1 of 5 CMKs missing automatic rotation.",
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
