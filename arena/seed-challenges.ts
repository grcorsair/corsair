#!/usr/bin/env bun
/**
 * Arena Challenge Seed Generator
 *
 * Generates 50 seed challenges from existing example files.
 * Run: bun run arena/seed-challenges.ts
 *
 * Distribution:
 *   - evidence-parsing: 16 challenges (8 formats x 2 difficulties)
 *   - control-mapping: 12 challenges
 *   - cpoe-generation: 10 challenges
 *   - drift-detection: 8 challenges
 *   - gap-analysis: 4 challenges
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const ARENA_DIR = join(import.meta.dir, "challenges");

interface ChallengeFiles {
  challenge: Record<string, unknown>;
  input: unknown;
  expected: unknown;
}

function writeChallenge(category: string, id: string, files: ChallengeFiles): void {
  const dir = join(ARENA_DIR, category, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "challenge.json"), JSON.stringify(files.challenge, null, 2));
  writeFileSync(join(dir, "input.json"), JSON.stringify(files.input, null, 2));
  writeFileSync(join(dir, "expected.json"), JSON.stringify(files.expected, null, 2));
}

// =============================================================================
// EVIDENCE PARSING — 16 challenges
// =============================================================================

// EP-001: Prowler basic extraction
writeChallenge("evidence-parsing", "ep-001-prowler-basic", {
  challenge: {
    id: "ep-001",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse Prowler OCSF output and extract control summary counts",
    input: "arena/challenges/evidence-parsing/ep-001-prowler-basic/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-001-prowler-basic/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["prowler", "aws", "ocsf", "basic"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "prowler",
    data: [
      { StatusCode: "PASS", Severity: "HIGH", FindingInfo: { Uid: "check-1", Title: "MFA enabled for root" }, Compliance: { Requirements: ["CIS-1.5"] } },
      { StatusCode: "PASS", Severity: "HIGH", FindingInfo: { Uid: "check-2", Title: "No root access keys" }, Compliance: { Requirements: ["CIS-1.4"] } },
      { StatusCode: "FAIL", Severity: "CRITICAL", FindingInfo: { Uid: "check-3", Title: "S3 public access" }, Compliance: { Requirements: ["CIS-2.1.1"] } },
      { StatusCode: "PASS", Severity: "MEDIUM", FindingInfo: { Uid: "check-4", Title: "CloudTrail enabled" }, Compliance: { Requirements: ["CIS-3.1"] } },
      { StatusCode: "FAIL", Severity: "HIGH", FindingInfo: { Uid: "check-5", Title: "Default SG restricts traffic" }, Compliance: { Requirements: ["CIS-5.4"] } },
    ],
  },
  expected: {
    summary: { controlsTested: 5, controlsPassed: 3, controlsFailed: 2, overallScore: 60 },
  },
});

// EP-002: Prowler edge cases (all pass)
writeChallenge("evidence-parsing", "ep-002-prowler-all-pass", {
  challenge: {
    id: "ep-002",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse Prowler output where all findings pass",
    input: "arena/challenges/evidence-parsing/ep-002-prowler-all-pass/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-002-prowler-all-pass/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["prowler", "aws", "edge-case"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "prowler",
    data: [
      { StatusCode: "PASS", Severity: "HIGH", FindingInfo: { Uid: "p-1", Title: "Check 1" } },
      { StatusCode: "PASS", Severity: "MEDIUM", FindingInfo: { Uid: "p-2", Title: "Check 2" } },
      { StatusCode: "PASS", Severity: "LOW", FindingInfo: { Uid: "p-3", Title: "Check 3" } },
    ],
  },
  expected: {
    summary: { controlsTested: 3, controlsPassed: 3, controlsFailed: 0, overallScore: 100 },
  },
});

// EP-003: SecurityHub basic extraction
writeChallenge("evidence-parsing", "ep-003-securityhub-basic", {
  challenge: {
    id: "ep-003",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse AWS SecurityHub ASFF output and extract finding counts",
    input: "arena/challenges/evidence-parsing/ep-003-securityhub-basic/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-003-securityhub-basic/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["securityhub", "aws", "asff"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "securityhub",
    data: {
      Findings: [
        { Id: "f-1", Title: "Root MFA", Severity: { Label: "CRITICAL" }, Compliance: { Status: "PASSED" } },
        { Id: "f-2", Title: "CloudTrail", Severity: { Label: "HIGH" }, Compliance: { Status: "PASSED" } },
        { Id: "f-3", Title: "S3 logging", Severity: { Label: "MEDIUM" }, Compliance: { Status: "FAILED" } },
        { Id: "f-4", Title: "SSH restricted", Severity: { Label: "HIGH" }, Compliance: { Status: "PASSED" } },
        { Id: "f-5", Title: "RDP restricted", Severity: { Label: "HIGH" }, Compliance: { Status: "PASSED" } },
        { Id: "f-6", Title: "S3 block public", Severity: { Label: "CRITICAL" }, Compliance: { Status: "FAILED" } },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 6, controlsPassed: 4, controlsFailed: 2, overallScore: 67 },
  },
});

// EP-004: SecurityHub mixed statuses
writeChallenge("evidence-parsing", "ep-004-securityhub-mixed", {
  challenge: {
    id: "ep-004",
    category: "evidence-parsing",
    difficulty: "medium",
    description: "Parse SecurityHub with mixed PASSED/FAILED/NOT_AVAILABLE statuses",
    input: "arena/challenges/evidence-parsing/ep-004-securityhub-mixed/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-004-securityhub-mixed/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["securityhub", "aws", "edge-case"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "securityhub",
    data: {
      Findings: [
        { Id: "f-1", Title: "Check 1", Compliance: { Status: "PASSED" } },
        { Id: "f-2", Title: "Check 2", Compliance: { Status: "FAILED" } },
        { Id: "f-3", Title: "Check 3", Compliance: { Status: "NOT_AVAILABLE" } },
        { Id: "f-4", Title: "Check 4", Compliance: { Status: "PASSED" } },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 4, controlsPassed: 2, controlsFailed: 1 },
  },
});

// EP-005: InSpec basic extraction
writeChallenge("evidence-parsing", "ep-005-inspec-basic", {
  challenge: {
    id: "ep-005",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse InSpec report and extract control pass/fail counts",
    input: "arena/challenges/evidence-parsing/ep-005-inspec-basic/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-005-inspec-basic/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["inspec", "cis", "compliance-as-code"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "inspec",
    data: {
      profiles: [{
        name: "test-profile",
        title: "Test Profile",
        controls: [
          { id: "ctrl-1", title: "Check 1", results: [{ status: "passed", code_desc: "OK" }] },
          { id: "ctrl-2", title: "Check 2", results: [{ status: "passed", code_desc: "OK" }] },
          { id: "ctrl-3", title: "Check 3", results: [{ status: "failed", code_desc: "FAIL" }] },
          { id: "ctrl-4", title: "Check 4", results: [{ status: "passed", code_desc: "OK" }] },
        ],
      }],
    },
  },
  expected: {
    summary: { controlsTested: 4, controlsPassed: 3, controlsFailed: 1 },
  },
});

// EP-006: InSpec with multiple profiles
writeChallenge("evidence-parsing", "ep-006-inspec-multi-profile", {
  challenge: {
    id: "ep-006",
    category: "evidence-parsing",
    difficulty: "medium",
    description: "Parse InSpec report with multiple profiles and aggregate results",
    input: "arena/challenges/evidence-parsing/ep-006-inspec-multi-profile/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-006-inspec-multi-profile/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["inspec", "multi-profile", "aggregation"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "inspec",
    data: {
      profiles: [
        {
          name: "iam-profile",
          controls: [
            { id: "iam-1", title: "MFA", results: [{ status: "passed" }] },
            { id: "iam-2", title: "Passwords", results: [{ status: "passed" }] },
          ],
        },
        {
          name: "network-profile",
          controls: [
            { id: "net-1", title: "Firewall", results: [{ status: "failed" }] },
            { id: "net-2", title: "VPN", results: [{ status: "passed" }] },
            { id: "net-3", title: "Segmentation", results: [{ status: "failed" }] },
          ],
        },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 5, controlsPassed: 3, controlsFailed: 2, overallScore: 60 },
  },
});

// EP-007: Trivy basic extraction
writeChallenge("evidence-parsing", "ep-007-trivy-basic", {
  challenge: {
    id: "ep-007",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse Trivy scan report and count vulnerabilities and misconfigurations",
    input: "arena/challenges/evidence-parsing/ep-007-trivy-basic/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-007-trivy-basic/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["trivy", "container", "vulnerability"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "trivy",
    data: {
      SchemaVersion: 2,
      ArtifactName: "app:latest",
      Results: [{
        Target: "Dockerfile",
        Misconfigurations: [
          { ID: "DS001", Title: "Latest tag", Severity: "MEDIUM", Status: "FAIL" },
          { ID: "DS002", Title: "Root user", Severity: "HIGH", Status: "PASS" },
        ],
      }, {
        Target: "package.json",
        Vulnerabilities: [
          { VulnerabilityID: "CVE-2024-001", PkgName: "lodash", Severity: "HIGH", Title: "Prototype pollution" },
          { VulnerabilityID: "CVE-2024-002", PkgName: "express", Severity: "CRITICAL", Title: "RCE" },
        ],
      }],
    },
  },
  expected: {
    summary: { controlsTested: 4, controlsPassed: 1, controlsFailed: 3 },
  },
});

// EP-008: Trivy misconfigurations only
writeChallenge("evidence-parsing", "ep-008-trivy-misconfig", {
  challenge: {
    id: "ep-008",
    category: "evidence-parsing",
    difficulty: "medium",
    description: "Parse Trivy Terraform misconfigurations with mixed PASS/FAIL statuses",
    input: "arena/challenges/evidence-parsing/ep-008-trivy-misconfig/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-008-trivy-misconfig/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["trivy", "terraform", "misconfiguration"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "trivy",
    data: {
      SchemaVersion: 2,
      ArtifactName: "infrastructure/terraform",
      Results: [{
        Target: "main.tf",
        Class: "config",
        Misconfigurations: [
          { ID: "AVD-AWS-0086", Title: "S3 encryption", Severity: "HIGH", Status: "PASS" },
          { ID: "AVD-AWS-0089", Title: "S3 versioning", Severity: "MEDIUM", Status: "FAIL" },
          { ID: "AVD-AWS-0132", Title: "RDS public access", Severity: "CRITICAL", Status: "FAIL" },
          { ID: "AVD-AWS-0104", Title: "CW retention", Severity: "LOW", Status: "PASS" },
          { ID: "AVD-AWS-0099", Title: "EBS encryption", Severity: "HIGH", Status: "PASS" },
        ],
      }],
    },
  },
  expected: {
    summary: { controlsTested: 5, controlsPassed: 3, controlsFailed: 2, overallScore: 60 },
  },
});

// EP-009: GitLab SAST basic extraction
writeChallenge("evidence-parsing", "ep-009-gitlab-basic", {
  challenge: {
    id: "ep-009",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse GitLab SAST report and count vulnerability findings",
    input: "arena/challenges/evidence-parsing/ep-009-gitlab-basic/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-009-gitlab-basic/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["gitlab", "sast", "vulnerability"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "gitlab",
    data: {
      version: "15.0.7",
      scan: { type: "sast", scanner: { id: "semgrep", name: "Semgrep" } },
      vulnerabilities: [
        { id: "v-1", name: "SQL Injection", severity: "Critical" },
        { id: "v-2", name: "XSS", severity: "High" },
        { id: "v-3", name: "Hardcoded secret", severity: "High" },
        { id: "v-4", name: "Insecure random", severity: "Medium" },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 4, controlsFailed: 4 },
  },
});

// EP-010: GitLab with identifiers
writeChallenge("evidence-parsing", "ep-010-gitlab-identifiers", {
  challenge: {
    id: "ep-010",
    category: "evidence-parsing",
    difficulty: "medium",
    description: "Parse GitLab SAST with CWE/OWASP identifiers and extract framework references",
    input: "arena/challenges/evidence-parsing/ep-010-gitlab-identifiers/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-010-gitlab-identifiers/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsFailed", "frameworksFound"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["gitlab", "sast", "cwe", "owasp"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "gitlab",
    data: {
      version: "15.0.7",
      scan: { type: "sast", scanner: { id: "semgrep", name: "Semgrep" } },
      vulnerabilities: [
        { id: "v-1", name: "SQL Injection", severity: "Critical", identifiers: [{ type: "cwe", name: "CWE-89", value: "89" }, { type: "owasp", name: "A03:2021", value: "A03:2021" }] },
        { id: "v-2", name: "XSS", severity: "High", identifiers: [{ type: "cwe", name: "CWE-79", value: "79" }] },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 2, controlsFailed: 2 },
    frameworksFound: ["CWE", "OWASP"],
  },
});

// EP-011: Generic format basic
writeChallenge("evidence-parsing", "ep-011-generic-basic", {
  challenge: {
    id: "ep-011",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse generic JSON evidence format with metadata and controls",
    input: "arena/challenges/evidence-parsing/ep-011-generic-basic/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-011-generic-basic/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["generic", "basic"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "generic",
    data: {
      metadata: { title: "Security Assessment", issuer: "Acme", date: "2026-02-01", scope: "Production" },
      controls: [
        { id: "C-1", description: "MFA enforced", status: "pass", severity: "HIGH" },
        { id: "C-2", description: "Encryption at rest", status: "pass", severity: "HIGH" },
        { id: "C-3", description: "Access reviews", status: "fail", severity: "MEDIUM" },
        { id: "C-4", description: "DR testing", status: "fail", severity: "HIGH" },
        { id: "C-5", description: "Logging enabled", status: "pass", severity: "MEDIUM" },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 5, controlsPassed: 3, controlsFailed: 2, overallScore: 60 },
  },
});

// EP-012: Generic with framework references
writeChallenge("evidence-parsing", "ep-012-generic-frameworks", {
  challenge: {
    id: "ep-012",
    category: "evidence-parsing",
    difficulty: "medium",
    description: "Parse generic evidence with multi-framework control references",
    input: "arena/challenges/evidence-parsing/ep-012-generic-frameworks/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-012-generic-frameworks/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["generic", "multi-framework"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "generic",
    data: {
      metadata: { title: "Multi-Framework Assessment", issuer: "Auditor" },
      controls: [
        { id: "MFA-1", status: "pass", framework: "NIST-800-53", controlId: "IA-2" },
        { id: "NET-1", status: "pass", frameworks: [{ framework: "NIST-800-53", controlId: "SC-7" }, { framework: "SOC2", controlId: "CC6.6" }] },
        { id: "LOG-1", status: "fail", framework: "SOC2", controlId: "CC7.2" },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 3, controlsPassed: 2, controlsFailed: 1 },
  },
});

// EP-013: CISO Assistant API basic
writeChallenge("evidence-parsing", "ep-013-ciso-assistant-api", {
  challenge: {
    id: "ep-013",
    category: "evidence-parsing",
    difficulty: "easy",
    description: "Parse CISO Assistant API response and extract compliance assessment summary",
    input: "arena/challenges/evidence-parsing/ep-013-ciso-assistant-api/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-013-ciso-assistant-api/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["ciso-assistant", "api", "compliance"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "ciso-assistant-api",
    data: {
      count: 5,
      next: null,
      previous: null,
      results: [
        { id: "a-1", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1", result: "compliant", score: 92 },
        { id: "a-2", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC5.2", result: "non_compliant", score: 34 },
        { id: "a-3", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC6.1", result: "compliant", score: 95 },
        { id: "a-4", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC8.1", result: "non_compliant", score: 41 },
        { id: "a-5", requirement: "urn:intuitem:risk:req_node:soc2-2017:CC3.1", result: "not_assessed" },
      ],
    },
  },
  expected: {
    summary: { controlsTested: 5, controlsPassed: 2, controlsFailed: 2 },
  },
});

// EP-014: CISO Assistant export
writeChallenge("evidence-parsing", "ep-014-ciso-assistant-export", {
  challenge: {
    id: "ep-014",
    category: "evidence-parsing",
    difficulty: "medium",
    description: "Parse CISO Assistant domain export with ISO 27001 requirement assessments",
    input: "arena/challenges/evidence-parsing/ep-014-ciso-assistant-export/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-014-ciso-assistant-export/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["ciso-assistant", "export", "iso27001"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "ciso-assistant-export",
    data: {
      meta: { media_version: "1.0", exported_at: "2026-02-10T09:30:00Z" },
      requirement_assessments: [
        { id: "r-1", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.5.1", result: "compliant", score: 91 },
        { id: "r-2", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.6.1", result: "non_compliant", score: 45 },
        { id: "r-3", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.8.1", result: "compliant", score: 93 },
        { id: "r-4", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.8.9", result: "partially_compliant", score: 58 },
        { id: "r-5", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.8.24", result: "compliant", score: 96 },
        { id: "r-6", requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.5.23", result: "non_compliant", score: 38 },
      ],
    },
  },
  expected: {
    // compliant=3, non_compliant=2, partially_compliant=1 (→ ineffective)
    summary: { controlsTested: 6, controlsPassed: 3, controlsFailed: 3, overallScore: 50 },
  },
});

// EP-015: Large Prowler scan (15 findings)
writeChallenge("evidence-parsing", "ep-015-prowler-large", {
  challenge: {
    id: "ep-015",
    category: "evidence-parsing",
    difficulty: "hard",
    description: "Parse large Prowler scan with 15 findings across multiple severity levels",
    input: "arena/challenges/evidence-parsing/ep-015-prowler-large/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-015-prowler-large/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed", "summary.overallScore"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["prowler", "aws", "large", "15-findings"],
    timeLimitMinutes: 10,
  },
  input: {
    format: "prowler",
    data: Array.from({ length: 15 }, (_, i) => ({
      StatusCode: i < 10 ? "PASS" : "FAIL",
      Severity: i < 3 ? "CRITICAL" : i < 8 ? "HIGH" : "MEDIUM",
      FindingInfo: { Uid: `check-${i + 1}`, Title: `Finding ${i + 1}` },
      Compliance: { Requirements: [`CIS-${i + 1}.1`] },
    })),
  },
  expected: {
    summary: { controlsTested: 15, controlsPassed: 10, controlsFailed: 5, overallScore: 67 },
  },
});

// EP-016: Empty/minimal input
writeChallenge("evidence-parsing", "ep-016-generic-minimal", {
  challenge: {
    id: "ep-016",
    category: "evidence-parsing",
    difficulty: "hard",
    description: "Handle minimal generic input with no controls and extract correct empty summary",
    input: "arena/challenges/evidence-parsing/ep-016-generic-minimal/input.json",
    groundTruth: "arena/challenges/evidence-parsing/ep-016-generic-minimal/expected.json",
    scoring: {
      method: "json-field-match",
      fields: ["summary.controlsTested", "summary.controlsPassed", "summary.controlsFailed"],
      partialCredit: true,
      maxScore: 100,
    },
    tags: ["generic", "edge-case", "empty"],
    timeLimitMinutes: 5,
  },
  input: {
    format: "generic",
    data: { metadata: { title: "Empty Assessment" }, controls: [] },
  },
  expected: {
    summary: { controlsTested: 0, controlsPassed: 0, controlsFailed: 0 },
  },
});

// =============================================================================
// CONTROL MAPPING — 12 challenges
// =============================================================================

// CM-001: Prowler to SOC2
writeChallenge("control-mapping", "cm-001-prowler-soc2", {
  challenge: {
    id: "cm-001",
    category: "control-mapping",
    difficulty: "easy",
    description: "Map Prowler findings to SOC 2 control IDs",
    input: "arena/challenges/control-mapping/cm-001-prowler-soc2/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-001-prowler-soc2/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["prowler", "soc2", "mapping"],
    timeLimitMinutes: 10,
  },
  input: {
    findings: [
      { title: "MFA enabled for root", requirements: ["CIS-1.5", "NIST-800-53-IA-2", "SOC2-CC6.1"] },
      { title: "No root access keys", requirements: ["CIS-1.4", "NIST-800-53-AC-6", "SOC2-CC6.1"] },
      { title: "CloudTrail enabled", requirements: ["CIS-3.1", "NIST-800-53-AU-2", "SOC2-CC7.2"] },
      { title: "RDS encrypted", requirements: ["CIS-2.3.1", "NIST-800-53-SC-28", "SOC2-CC6.7"] },
    ],
    targetFramework: "SOC2",
  },
  expected: {
    controlIds: ["CC6.1", "CC7.2", "CC6.7"],
  },
});

// CM-002: Prowler to NIST
writeChallenge("control-mapping", "cm-002-prowler-nist", {
  challenge: {
    id: "cm-002",
    category: "control-mapping",
    difficulty: "easy",
    description: "Map Prowler findings to NIST 800-53 control IDs",
    input: "arena/challenges/control-mapping/cm-002-prowler-nist/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-002-prowler-nist/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["prowler", "nist", "mapping"],
    timeLimitMinutes: 10,
  },
  input: {
    findings: [
      { title: "MFA enabled", requirements: ["NIST-800-53-IA-2", "SOC2-CC6.1"] },
      { title: "Least privilege", requirements: ["NIST-800-53-AC-6"] },
      { title: "CloudTrail", requirements: ["NIST-800-53-AU-2", "CIS-3.1"] },
      { title: "Encryption at rest", requirements: ["NIST-800-53-SC-28"] },
      { title: "VPC flow logs", requirements: ["NIST-800-53-AU-12"] },
    ],
    targetFramework: "NIST-800-53",
  },
  expected: {
    controlIds: ["IA-2", "AC-6", "AU-2", "SC-28", "AU-12"],
  },
});

// CM-003: InSpec to NIST
writeChallenge("control-mapping", "cm-003-inspec-nist", {
  challenge: {
    id: "cm-003",
    category: "control-mapping",
    difficulty: "medium",
    description: "Map InSpec control tags to NIST 800-53 control families",
    input: "arena/challenges/control-mapping/cm-003-inspec-nist/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-003-inspec-nist/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["inspec", "nist", "tags"],
    timeLimitMinutes: 10,
  },
  input: {
    controls: [
      { id: "cis-aws-1.5", tags: { nist: ["IA-2", "IA-2(1)"] } },
      { id: "cis-aws-1.8", tags: { nist: ["IA-5", "IA-5(1)"] } },
      { id: "cis-aws-3.1", tags: { nist: ["AU-2", "AU-3", "AU-12"] } },
      { id: "cis-aws-4.1", tags: { nist: ["AC-4", "SC-7", "SC-7(5)"] } },
    ],
  },
  expected: {
    controlIds: ["IA-2", "IA-2(1)", "IA-5", "IA-5(1)", "AU-2", "AU-3", "AU-12", "AC-4", "SC-7", "SC-7(5)"],
  },
});

// CM-004: GitLab to CWE
writeChallenge("control-mapping", "cm-004-gitlab-cwe", {
  challenge: {
    id: "cm-004",
    category: "control-mapping",
    difficulty: "easy",
    description: "Map GitLab SAST vulnerabilities to CWE identifiers",
    input: "arena/challenges/control-mapping/cm-004-gitlab-cwe/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-004-gitlab-cwe/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["gitlab", "cwe", "sast"],
    timeLimitMinutes: 5,
  },
  input: {
    vulnerabilities: [
      { id: "v-1", name: "SQL Injection", identifiers: [{ type: "cwe", value: "89" }] },
      { id: "v-2", name: "XSS", identifiers: [{ type: "cwe", value: "79" }] },
      { id: "v-3", name: "Hardcoded key", identifiers: [{ type: "cwe", value: "798" }] },
      { id: "v-4", name: "Insecure random", identifiers: [{ type: "cwe", value: "330" }] },
      { id: "v-5", name: "CSRF", identifiers: [{ type: "cwe", value: "352" }] },
    ],
  },
  expected: {
    controlIds: ["89", "79", "798", "330", "352"],
  },
});

// CM-005: CISO Assistant to SOC2
writeChallenge("control-mapping", "cm-005-ciso-soc2", {
  challenge: {
    id: "cm-005",
    category: "control-mapping",
    difficulty: "medium",
    description: "Extract SOC 2 control IDs from CISO Assistant requirement URNs",
    input: "arena/challenges/control-mapping/cm-005-ciso-soc2/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-005-ciso-soc2/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["ciso-assistant", "soc2", "urn-parsing"],
    timeLimitMinutes: 10,
  },
  input: {
    assessments: [
      { requirement: "urn:intuitem:risk:req_node:soc2-2017:CC1.1" },
      { requirement: "urn:intuitem:risk:req_node:soc2-2017:CC5.2" },
      { requirement: "urn:intuitem:risk:req_node:soc2-2017:CC6.1" },
      { requirement: "urn:intuitem:risk:req_node:soc2-2017:CC7.2" },
      { requirement: "urn:intuitem:risk:req_node:soc2-2017:CC8.1" },
      { requirement: "urn:intuitem:risk:req_node:soc2-2017:CC9.1" },
    ],
  },
  expected: {
    controlIds: ["CC1.1", "CC5.2", "CC6.1", "CC7.2", "CC8.1", "CC9.1"],
  },
});

// CM-006: CISO Assistant to ISO 27001
writeChallenge("control-mapping", "cm-006-ciso-iso", {
  challenge: {
    id: "cm-006",
    category: "control-mapping",
    difficulty: "medium",
    description: "Extract ISO 27001 control IDs from CISO Assistant export URNs",
    input: "arena/challenges/control-mapping/cm-006-ciso-iso/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-006-ciso-iso/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["ciso-assistant", "iso27001", "urn-parsing"],
    timeLimitMinutes: 10,
  },
  input: {
    assessments: [
      { requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.5.1" },
      { requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.5.2" },
      { requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.6.1" },
      { requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.8.1" },
      { requirement: "urn:intuitem:risk:req_node:iso-27001-2022:A.8.24" },
    ],
  },
  expected: {
    controlIds: ["A.5.1", "A.5.2", "A.6.1", "A.8.1", "A.8.24"],
  },
});

// CM-007: Cross-framework mapping
writeChallenge("control-mapping", "cm-007-cross-framework", {
  challenge: {
    id: "cm-007",
    category: "control-mapping",
    difficulty: "hard",
    description: "Map generic controls with multi-framework references to all applicable framework IDs",
    input: "arena/challenges/control-mapping/cm-007-cross-framework/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-007-cross-framework/expected.json",
    scoring: { method: "precision-recall", threshold: 0.7, partialCredit: true, maxScore: 100 },
    tags: ["multi-framework", "cross-mapping", "complex"],
    timeLimitMinutes: 15,
  },
  input: {
    controls: [
      { id: "NET-1", frameworks: [{ framework: "NIST-800-53", controlId: "SC-7" }, { framework: "SOC2", controlId: "CC6.6" }, { framework: "CIS", controlId: "12.2" }] },
      { id: "ENC-1", frameworks: [{ framework: "NIST-800-53", controlId: "SC-28" }, { framework: "SOC2", controlId: "CC6.7" }, { framework: "ISO27001", controlId: "A.8.24" }] },
      { id: "LOG-1", frameworks: [{ framework: "NIST-800-53", controlId: "AU-2" }, { framework: "SOC2", controlId: "CC7.2" }] },
    ],
  },
  expected: {
    controlIds: ["SC-7", "CC6.6", "12.2", "SC-28", "CC6.7", "A.8.24", "AU-2", "CC7.2"],
  },
});

// CM-008: Prowler to CIS
writeChallenge("control-mapping", "cm-008-prowler-cis", {
  challenge: {
    id: "cm-008",
    category: "control-mapping",
    difficulty: "easy",
    description: "Map Prowler compliance requirements to CIS benchmark control IDs",
    input: "arena/challenges/control-mapping/cm-008-prowler-cis/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-008-prowler-cis/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["prowler", "cis", "benchmark"],
    timeLimitMinutes: 5,
  },
  input: {
    findings: [
      { title: "Root MFA", requirements: ["CIS-1.5", "NIST-800-53-IA-2"] },
      { title: "No root keys", requirements: ["CIS-1.4"] },
      { title: "Password policy", requirements: ["CIS-1.8"] },
      { title: "S3 HTTPS", requirements: ["CIS-2.1.1"] },
      { title: "CloudTrail", requirements: ["CIS-3.1"] },
      { title: "No open SSH", requirements: ["CIS-5.4"] },
    ],
    targetFramework: "CIS",
  },
  expected: {
    controlIds: ["1.5", "1.4", "1.8", "2.1.1", "3.1", "5.4"],
  },
});

// CM-009: Trivy misconfig mapping
writeChallenge("control-mapping", "cm-009-trivy-avd", {
  challenge: {
    id: "cm-009",
    category: "control-mapping",
    difficulty: "medium",
    description: "Extract AVD IDs from Trivy misconfiguration results",
    input: "arena/challenges/control-mapping/cm-009-trivy-avd/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-009-trivy-avd/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["trivy", "avd", "misconfig"],
    timeLimitMinutes: 10,
  },
  input: {
    results: [{
      Misconfigurations: [
        { ID: "DS001", AVDID: "AVD-DS-0001" },
        { ID: "DS002", AVDID: "AVD-DS-0002" },
        { ID: "AVD-AWS-0086", AVDID: "AVD-AWS-0086" },
        { ID: "AVD-AWS-0089", AVDID: "AVD-AWS-0089" },
      ],
    }],
  },
  expected: {
    controlIds: ["AVD-DS-0001", "AVD-DS-0002", "AVD-AWS-0086", "AVD-AWS-0089"],
  },
});

// CM-010: SecurityHub finding types
writeChallenge("control-mapping", "cm-010-securityhub-types", {
  challenge: {
    id: "cm-010",
    category: "control-mapping",
    difficulty: "medium",
    description: "Extract resource types from SecurityHub findings",
    input: "arena/challenges/control-mapping/cm-010-securityhub-types/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-010-securityhub-types/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["securityhub", "resource-types"],
    timeLimitMinutes: 10,
  },
  input: {
    Findings: [
      { Id: "f-1", Resources: [{ Type: "AwsAccount" }] },
      { Id: "f-2", Resources: [{ Type: "AwsCloudTrailTrail" }] },
      { Id: "f-3", Resources: [{ Type: "AwsS3Bucket" }] },
      { Id: "f-4", Resources: [{ Type: "AwsEc2SecurityGroup" }] },
      { Id: "f-5", Resources: [{ Type: "AwsRdsDbInstance" }] },
      { Id: "f-6", Resources: [{ Type: "AwsEc2SecurityGroup" }] },
    ],
  },
  expected: {
    controlIds: ["AwsAccount", "AwsCloudTrailTrail", "AwsS3Bucket", "AwsEc2SecurityGroup", "AwsRdsDbInstance"],
  },
});

// CM-011: Failed controls only
writeChallenge("control-mapping", "cm-011-failed-controls", {
  challenge: {
    id: "cm-011",
    category: "control-mapping",
    difficulty: "medium",
    description: "Identify only the FAILED control IDs from a mixed Prowler scan",
    input: "arena/challenges/control-mapping/cm-011-failed-controls/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-011-failed-controls/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["prowler", "failed-only", "filtering"],
    timeLimitMinutes: 10,
  },
  input: {
    findings: [
      { uid: "check-1", status: "PASS" },
      { uid: "check-2", status: "FAIL" },
      { uid: "check-3", status: "PASS" },
      { uid: "check-4", status: "FAIL" },
      { uid: "check-5", status: "FAIL" },
      { uid: "check-6", status: "PASS" },
    ],
  },
  expected: {
    controlIds: ["check-2", "check-4", "check-5"],
  },
});

// CM-012: Severity-based filtering
writeChallenge("control-mapping", "cm-012-critical-findings", {
  challenge: {
    id: "cm-012",
    category: "control-mapping",
    difficulty: "hard",
    description: "Identify CRITICAL and HIGH severity finding IDs from mixed Trivy output",
    input: "arena/challenges/control-mapping/cm-012-critical-findings/input.json",
    groundTruth: "arena/challenges/control-mapping/cm-012-critical-findings/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["trivy", "severity", "filtering", "critical"],
    timeLimitMinutes: 10,
  },
  input: {
    findings: [
      { id: "CVE-2024-001", severity: "CRITICAL" },
      { id: "CVE-2024-002", severity: "HIGH" },
      { id: "CVE-2024-003", severity: "MEDIUM" },
      { id: "CVE-2024-004", severity: "LOW" },
      { id: "CVE-2024-005", severity: "HIGH" },
      { id: "CVE-2024-006", severity: "CRITICAL" },
      { id: "CVE-2024-007", severity: "MEDIUM" },
    ],
  },
  expected: {
    controlIds: ["CVE-2024-001", "CVE-2024-002", "CVE-2024-005", "CVE-2024-006"],
  },
});

// =============================================================================
// CPOE GENERATION — 10 challenges
// =============================================================================

const fakeHeader = btoa(JSON.stringify({ alg: "EdDSA", typ: "vc+jwt", kid: "did:web:grcorsair.com#key-1" }))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
const fakeSig = "ZmFrZS1zaWduYXR1cmU"; // base64url

function makeJwt(subject: Record<string, unknown>): string {
  const payload = {
    iss: "did:web:grcorsair.com",
    sub: "cpoe-test",
    iat: 1739059200,
    exp: 1739664000,
    parley: "2.0",
    vc: {
      "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/v1"],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: "did:web:grcorsair.com", name: "Corsair" },
      credentialSubject: subject,
    },
  };
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${fakeHeader}.${encodedPayload}.${fakeSig}`;
}

for (let i = 1; i <= 10; i++) {
  const passed = Math.max(0, 10 - i);
  const failed = Math.min(i, 10);
  const tested = passed + failed;
  const score = Math.round((passed / tested) * 100);

  const subject = {
    type: "CorsairCPOE",
    scope: `Test Scope ${i}`,
    summary: { controlsTested: tested, controlsPassed: passed, controlsFailed: failed, overallScore: score },
    provenance: { source: "tool", sourceIdentity: `Tool ${i}` },
  };

  const difficulty = i <= 3 ? "easy" : i <= 7 ? "medium" : "hard";

  writeChallenge("cpoe-generation", `cg-${String(i).padStart(3, "0")}-sign-format-${i}`, {
    challenge: {
      id: `cg-${String(i).padStart(3, "0")}`,
      category: "cpoe-generation",
      difficulty,
      description: `Generate a valid CPOE JWT-VC for evidence with ${passed} passed / ${failed} failed controls`,
      input: `arena/challenges/cpoe-generation/cg-${String(i).padStart(3, "0")}-sign-format-${i}/input.json`,
      groundTruth: `arena/challenges/cpoe-generation/cg-${String(i).padStart(3, "0")}-sign-format-${i}/expected.json`,
      scoring: { method: "cpoe-verify", partialCredit: true, maxScore: 100 },
      tags: ["cpoe", "jwt-vc", "signing", difficulty],
      timeLimitMinutes: 10,
    },
    input: {
      evidence: {
        controls: Array.from({ length: tested }, (_, j) => ({
          id: `ctrl-${j + 1}`,
          status: j < passed ? "pass" : "fail",
          description: `Control ${j + 1}`,
        })),
      },
      format: "generic",
    },
    expected: {
      credentialSubject: subject,
    },
  });
}

// =============================================================================
// DRIFT DETECTION — 8 challenges
// =============================================================================

// DD-001: Simple regression
writeChallenge("drift-detection", "dd-001-simple-regression", {
  challenge: {
    id: "dd-001",
    category: "drift-detection",
    difficulty: "easy",
    description: "Detect a single control that regressed from pass to fail",
    input: "arena/challenges/drift-detection/dd-001-simple-regression/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-001-simple-regression/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "regression", "simple"],
    timeLimitMinutes: 5,
  },
  input: {
    previous: { controls: [{ id: "C-1", status: "pass" }, { id: "C-2", status: "pass" }, { id: "C-3", status: "fail" }] },
    current: { controls: [{ id: "C-1", status: "pass" }, { id: "C-2", status: "fail" }, { id: "C-3", status: "fail" }] },
  },
  expected: { regressions: ["C-2"] },
});

// DD-002: Multiple regressions
writeChallenge("drift-detection", "dd-002-multiple-regressions", {
  challenge: {
    id: "dd-002",
    category: "drift-detection",
    difficulty: "medium",
    description: "Detect multiple controls that regressed from pass to fail",
    input: "arena/challenges/drift-detection/dd-002-multiple-regressions/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-002-multiple-regressions/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "regression", "multiple"],
    timeLimitMinutes: 5,
  },
  input: {
    previous: {
      controls: [
        { id: "IAM-1", status: "pass" }, { id: "IAM-2", status: "pass" },
        { id: "NET-1", status: "pass" }, { id: "NET-2", status: "fail" },
        { id: "ENC-1", status: "pass" },
      ],
    },
    current: {
      controls: [
        { id: "IAM-1", status: "fail" }, { id: "IAM-2", status: "pass" },
        { id: "NET-1", status: "fail" }, { id: "NET-2", status: "fail" },
        { id: "ENC-1", status: "pass" },
      ],
    },
  },
  expected: { regressions: ["IAM-1", "NET-1"] },
});

// DD-003: No regressions (improvements only)
writeChallenge("drift-detection", "dd-003-no-regressions", {
  challenge: {
    id: "dd-003",
    category: "drift-detection",
    difficulty: "easy",
    description: "Correctly identify zero regressions when controls only improved",
    input: "arena/challenges/drift-detection/dd-003-no-regressions/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-003-no-regressions/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "no-regression", "improvement"],
    timeLimitMinutes: 5,
  },
  input: {
    previous: { controls: [{ id: "C-1", status: "fail" }, { id: "C-2", status: "fail" }] },
    current: { controls: [{ id: "C-1", status: "pass" }, { id: "C-2", status: "pass" }] },
  },
  expected: { regressions: [] },
});

// DD-004: New controls added
writeChallenge("drift-detection", "dd-004-new-controls", {
  challenge: {
    id: "dd-004",
    category: "drift-detection",
    difficulty: "medium",
    description: "Detect regressions when new controls appear in current scan",
    input: "arena/challenges/drift-detection/dd-004-new-controls/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-004-new-controls/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "new-controls"],
    timeLimitMinutes: 10,
  },
  input: {
    previous: { controls: [{ id: "C-1", status: "pass" }, { id: "C-2", status: "pass" }] },
    current: { controls: [{ id: "C-1", status: "fail" }, { id: "C-2", status: "pass" }, { id: "C-3", status: "fail" }] },
  },
  expected: { regressions: ["C-1"] },
});

// DD-005: Controls removed
writeChallenge("drift-detection", "dd-005-controls-removed", {
  challenge: {
    id: "dd-005",
    category: "drift-detection",
    difficulty: "hard",
    description: "Detect regressions when controls are removed from scope between scans",
    input: "arena/challenges/drift-detection/dd-005-controls-removed/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-005-controls-removed/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "removed-controls", "scope-change"],
    timeLimitMinutes: 10,
  },
  input: {
    previous: { controls: [{ id: "C-1", status: "pass" }, { id: "C-2", status: "pass" }, { id: "C-3", status: "pass" }] },
    current: { controls: [{ id: "C-1", status: "fail" }] },
  },
  expected: { regressions: ["C-1"] },
});

// DD-006: Large diff
writeChallenge("drift-detection", "dd-006-large-diff", {
  challenge: {
    id: "dd-006",
    category: "drift-detection",
    difficulty: "hard",
    description: "Detect regressions in a large scan with 20 controls",
    input: "arena/challenges/drift-detection/dd-006-large-diff/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-006-large-diff/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "large", "20-controls"],
    timeLimitMinutes: 15,
  },
  input: {
    previous: {
      controls: Array.from({ length: 20 }, (_, i) => ({ id: `C-${i + 1}`, status: "pass" })),
    },
    current: {
      controls: Array.from({ length: 20 }, (_, i) => ({
        id: `C-${i + 1}`,
        status: [2, 7, 11, 15].includes(i) ? "fail" : "pass",
      })),
    },
  },
  expected: { regressions: ["C-3", "C-8", "C-12", "C-16"] },
});

// DD-007: Status transition edge cases
writeChallenge("drift-detection", "dd-007-status-transitions", {
  challenge: {
    id: "dd-007",
    category: "drift-detection",
    difficulty: "hard",
    description: "Detect regressions with not-tested to fail, pass to not-tested transitions",
    input: "arena/challenges/drift-detection/dd-007-status-transitions/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-007-status-transitions/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "status-transitions", "edge-case"],
    timeLimitMinutes: 10,
  },
  input: {
    previous: {
      controls: [
        { id: "C-1", status: "pass" },
        { id: "C-2", status: "not-tested" },
        { id: "C-3", status: "pass" },
        { id: "C-4", status: "fail" },
      ],
    },
    current: {
      controls: [
        { id: "C-1", status: "not-tested" },
        { id: "C-2", status: "fail" },
        { id: "C-3", status: "fail" },
        { id: "C-4", status: "pass" },
      ],
    },
  },
  expected: { regressions: ["C-3"] },
});

// DD-008: Identical scans
writeChallenge("drift-detection", "dd-008-identical", {
  challenge: {
    id: "dd-008",
    category: "drift-detection",
    difficulty: "easy",
    description: "Correctly identify zero regressions when scans are identical",
    input: "arena/challenges/drift-detection/dd-008-identical/input.json",
    groundTruth: "arena/challenges/drift-detection/dd-008-identical/expected.json",
    scoring: { method: "diff-match", partialCredit: true, maxScore: 100 },
    tags: ["drift", "identical", "no-change"],
    timeLimitMinutes: 5,
  },
  input: {
    previous: { controls: [{ id: "C-1", status: "pass" }, { id: "C-2", status: "fail" }, { id: "C-3", status: "pass" }] },
    current: { controls: [{ id: "C-1", status: "pass" }, { id: "C-2", status: "fail" }, { id: "C-3", status: "pass" }] },
  },
  expected: { regressions: [] },
});

// =============================================================================
// GAP ANALYSIS — 4 challenges
// =============================================================================

// GA-001: SOC 2 gaps
writeChallenge("gap-analysis", "ga-001-soc2-gaps", {
  challenge: {
    id: "ga-001",
    category: "gap-analysis",
    difficulty: "easy",
    description: "Identify missing SOC 2 controls from a partial assessment",
    input: "arena/challenges/gap-analysis/ga-001-soc2-gaps/input.json",
    groundTruth: "arena/challenges/gap-analysis/ga-001-soc2-gaps/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["gap-analysis", "soc2", "missing-controls"],
    timeLimitMinutes: 10,
  },
  input: {
    targetFramework: "SOC2",
    requiredControls: ["CC1.1", "CC1.2", "CC5.2", "CC6.1", "CC6.6", "CC7.2", "CC7.3", "CC8.1", "CC9.1"],
    assessedControls: ["CC1.1", "CC6.1", "CC7.2", "CC7.3", "CC9.1"],
  },
  expected: {
    missingControls: ["CC1.2", "CC5.2", "CC6.6", "CC8.1"],
  },
});

// GA-002: NIST gaps
writeChallenge("gap-analysis", "ga-002-nist-gaps", {
  challenge: {
    id: "ga-002",
    category: "gap-analysis",
    difficulty: "medium",
    description: "Identify missing NIST 800-53 controls from InSpec scan results",
    input: "arena/challenges/gap-analysis/ga-002-nist-gaps/input.json",
    groundTruth: "arena/challenges/gap-analysis/ga-002-nist-gaps/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["gap-analysis", "nist", "inspec"],
    timeLimitMinutes: 10,
  },
  input: {
    targetFramework: "NIST-800-53",
    requiredControls: ["AC-2", "AC-6", "AU-2", "AU-12", "IA-2", "IA-5", "SC-7", "SC-8", "SC-28", "SI-4"],
    assessedControls: ["IA-2", "IA-5", "AU-2", "SC-7", "SC-28"],
  },
  expected: {
    missingControls: ["AC-2", "AC-6", "AU-12", "SC-8", "SI-4"],
  },
});

// GA-003: ISO 27001 gaps
writeChallenge("gap-analysis", "ga-003-iso-gaps", {
  challenge: {
    id: "ga-003",
    category: "gap-analysis",
    difficulty: "medium",
    description: "Identify missing ISO 27001 controls from CISO Assistant export",
    input: "arena/challenges/gap-analysis/ga-003-iso-gaps/input.json",
    groundTruth: "arena/challenges/gap-analysis/ga-003-iso-gaps/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["gap-analysis", "iso27001", "ciso-assistant"],
    timeLimitMinutes: 10,
  },
  input: {
    targetFramework: "ISO27001",
    requiredControls: ["A.5.1", "A.5.2", "A.5.23", "A.6.1", "A.8.1", "A.8.9", "A.8.16", "A.8.24", "A.8.25", "A.8.26"],
    assessedControls: ["A.5.1", "A.5.2", "A.6.1", "A.8.1", "A.8.9", "A.8.24", "A.8.16"],
  },
  expected: {
    missingControls: ["A.5.23", "A.8.25", "A.8.26"],
  },
});

// GA-004: Full coverage (no gaps)
writeChallenge("gap-analysis", "ga-004-full-coverage", {
  challenge: {
    id: "ga-004",
    category: "gap-analysis",
    difficulty: "easy",
    description: "Correctly identify zero gaps when all required controls are assessed",
    input: "arena/challenges/gap-analysis/ga-004-full-coverage/input.json",
    groundTruth: "arena/challenges/gap-analysis/ga-004-full-coverage/expected.json",
    scoring: { method: "precision-recall", threshold: 0.8, partialCredit: true, maxScore: 100 },
    tags: ["gap-analysis", "full-coverage", "no-gaps"],
    timeLimitMinutes: 5,
  },
  input: {
    targetFramework: "SOC2",
    requiredControls: ["CC6.1", "CC6.6", "CC7.2"],
    assessedControls: ["CC6.1", "CC6.6", "CC7.2"],
  },
  expected: {
    missingControls: [],
  },
});

// =============================================================================
// SUMMARY
// =============================================================================

console.log("Seed challenges generated successfully!");
console.log("");
console.log("Distribution:");
console.log("  evidence-parsing: 16 challenges");
console.log("  control-mapping:  12 challenges");
console.log("  cpoe-generation:  10 challenges");
console.log("  drift-detection:   8 challenges");
console.log("  gap-analysis:      4 challenges");
console.log("  TOTAL:            50 challenges");
