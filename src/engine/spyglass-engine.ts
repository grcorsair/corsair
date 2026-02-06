/**
 * SPYGLASS Engine — Automated Threat Modeling
 *
 * Generates STRIDE threat models from RECON snapshots using
 * per-provider rule sets. Each rule maps a snapshot field condition
 * to a STRIDE category, MITRE ATT&CK technique, and severity.
 *
 * Usage:
 *   const engine = new SpyglassEngine();
 *   const result = engine.spyglassAnalyze(snapshot, "aws-cognito");
 *   const expectations = engine.threatToExpectations(result.threats);
 */

import type {
  STRIDECategory,
  ThreatFinding,
  ThreatModelResult,
  ThreatModelOptions,
  Severity,
  AttackVector,
  Expectation,
} from "../types";

// ===============================================================================
// SPYGLASS RULE DEFINITIONS
// ===============================================================================

interface SpyglassRule {
  field: string;
  condition: (value: unknown) => boolean;
  stride: STRIDECategory;
  technique: string;
  techniqueName: string;
  severity: Severity;
  description: string;
  attackVectors: AttackVector[];
}

interface ExpectationMapping {
  field: string;
  operator: Expectation["operator"];
  value: unknown;
}

/**
 * Per-provider SPYGLASS rules.
 * Each rule checks a snapshot field and produces a threat if the condition is true.
 */
const SPYGLASS_RULES: Record<string, SpyglassRule[]> = {
  "aws-cognito": [
    {
      field: "mfaConfiguration",
      condition: (v) => v === "OFF",
      stride: "Spoofing",
      technique: "T1556",
      techniqueName: "Modify Authentication Process",
      severity: "CRITICAL",
      description: "MFA disabled allows credential-only authentication, enabling identity spoofing",
      attackVectors: ["mfa-bypass"],
    },
    {
      field: "mfaConfiguration",
      condition: (v) => v === "OPTIONAL",
      stride: "Spoofing",
      technique: "T1556",
      techniqueName: "Modify Authentication Process",
      severity: "HIGH",
      description: "Optional MFA allows users to skip second factor, weakening identity verification",
      attackVectors: ["mfa-bypass"],
    },
    {
      field: "mfaConfiguration",
      condition: (v) => v === "OFF",
      stride: "ElevationOfPrivilege",
      technique: "T1548",
      techniqueName: "Abuse Elevation Control Mechanism",
      severity: "CRITICAL",
      description: "Without MFA, compromised credentials grant full account privileges",
      attackVectors: ["mfa-bypass", "session-hijack"],
    },
    {
      field: "passwordPolicy.minimumLength",
      condition: (v) => typeof v === "number" && v < 12,
      stride: "Spoofing",
      technique: "T1110",
      techniqueName: "Brute Force",
      severity: "HIGH",
      description: "Weak minimum password length increases brute force attack success probability",
      attackVectors: ["password-spray"],
    },
    {
      field: "passwordPolicy.requireSymbols",
      condition: (v) => v === false,
      stride: "Spoofing",
      technique: "T1110.001",
      techniqueName: "Password Guessing",
      severity: "MEDIUM",
      description: "Missing symbol requirement reduces password complexity",
      attackVectors: ["password-spray"],
    },
    {
      field: "riskConfiguration",
      condition: (v) => v === null || v === undefined,
      stride: "Repudiation",
      technique: "T1078",
      techniqueName: "Valid Accounts",
      severity: "HIGH",
      description: "No risk configuration means compromised credential usage goes undetected",
      attackVectors: ["token-replay"],
    },
    {
      field: "softwareTokenMfaEnabled",
      condition: (v) => v === false,
      stride: "Spoofing",
      technique: "T1556.006",
      techniqueName: "Multi-Factor Authentication Request Generation",
      severity: "MEDIUM",
      description: "Software token MFA not enabled reduces available authentication factors",
      attackVectors: ["mfa-bypass"],
    },
    {
      field: "deviceConfiguration.challengeRequiredOnNewDevice",
      condition: (v) => v === false,
      stride: "Spoofing",
      technique: "T1563",
      techniqueName: "Remote Service Session Hijacking",
      severity: "MEDIUM",
      description: "No device challenge allows session hijacking from unrecognized devices",
      attackVectors: ["session-hijack"],
    },
  ],

  "aws-s3": [
    {
      field: "publicAccessBlock",
      condition: (v) => v === false,
      stride: "InformationDisclosure",
      technique: "T1530",
      techniqueName: "Data from Cloud Storage",
      severity: "CRITICAL",
      description: "Public access block disabled exposes bucket contents to unauthorized access",
      attackVectors: ["public-access-test"],
    },
    {
      field: "encryption",
      condition: (v) => v === null || v === undefined,
      stride: "InformationDisclosure",
      technique: "T1530",
      techniqueName: "Data from Cloud Storage",
      severity: "HIGH",
      description: "No encryption at rest means stored data is readable if storage is compromised",
      attackVectors: ["encryption-test"],
    },
    {
      field: "versioning",
      condition: (v) => v === "Disabled",
      stride: "Tampering",
      technique: "T1485",
      techniqueName: "Data Destruction",
      severity: "MEDIUM",
      description: "Versioning disabled means tampered or deleted objects cannot be recovered",
      attackVectors: ["versioning-test"],
    },
    {
      field: "logging",
      condition: (v) => v === false,
      stride: "Repudiation",
      technique: "T1562",
      techniqueName: "Impair Defenses",
      severity: "HIGH",
      description: "Access logging disabled prevents audit trail of bucket operations",
      attackVectors: [],
    },
  ],

  "gitlab": [
    {
      field: "visibility",
      condition: (v) => v === "public",
      stride: "InformationDisclosure",
      technique: "T1530",
      techniqueName: "Data from Cloud Storage",
      severity: "CRITICAL",
      description: "Public repository visibility exposes source code and secrets to unauthorized access",
      attackVectors: ["secret-exposure"],
    },
    {
      field: "branchProtection.forcePushDisabled",
      condition: (v) => v === false,
      stride: "Tampering",
      technique: "T1195",
      techniqueName: "Supply Chain Compromise",
      severity: "HIGH",
      description: "Force push enabled allows history rewriting and supply chain tampering",
      attackVectors: ["unprotected-branch-push"],
    },
    {
      field: "branchProtection.requireApprovals",
      condition: (v) => v === false,
      stride: "Tampering",
      technique: "T1195",
      techniqueName: "Supply Chain Compromise",
      severity: "HIGH",
      description: "No merge request approvals allows unreviewed code to enter production",
      attackVectors: ["unprotected-branch-push"],
    },
    {
      field: "cicdSecurity.sastEnabled",
      condition: (v) => v === false,
      stride: "InformationDisclosure",
      technique: "T1588",
      techniqueName: "Obtain Capabilities",
      severity: "MEDIUM",
      description: "SAST not enabled means static code vulnerabilities go undetected",
      attackVectors: ["ci-pipeline-injection"],
    },
    {
      field: "cicdSecurity.secretDetectionEnabled",
      condition: (v) => v === false,
      stride: "InformationDisclosure",
      technique: "T1552",
      techniqueName: "Unsecured Credentials",
      severity: "HIGH",
      description: "Secret detection not enabled allows credentials to be committed to repositories",
      attackVectors: ["secret-exposure"],
    },
    {
      field: "accessControl.mfaEnforced",
      condition: (v) => v === false,
      stride: "Spoofing",
      technique: "T1556",
      techniqueName: "Modify Authentication Process",
      severity: "CRITICAL",
      description: "MFA not enforced allows credential-only authentication to GitLab",
      attackVectors: ["mfa-bypass"],
    },
    {
      field: "accessControl.guestAccessEnabled",
      condition: (v) => v === true,
      stride: "ElevationOfPrivilege",
      technique: "T1078",
      techniqueName: "Valid Accounts",
      severity: "HIGH",
      description: "Guest access enabled allows unauthorized users to view project resources",
      attackVectors: ["token-abuse"],
    },
    {
      field: "auditSettings.signedCommitsRequired",
      condition: (v) => v === false,
      stride: "Repudiation",
      technique: "T1565",
      techniqueName: "Data Manipulation",
      severity: "MEDIUM",
      description: "Unsigned commits allow code authorship to be spoofed",
      attackVectors: [],
    },
  ],

  "aws-iam": [
    {
      field: "mfaEnabled",
      condition: (v) => v === false,
      stride: "Spoofing",
      technique: "T1556",
      techniqueName: "Modify Authentication Process",
      severity: "CRITICAL",
      description: "IAM users without MFA can be impersonated with stolen credentials",
      attackVectors: ["missing-mfa"],
    },
    {
      field: "hasOverprivilegedPolicies",
      condition: (v) => v === true,
      stride: "ElevationOfPrivilege",
      technique: "T1078.004",
      techniqueName: "Cloud Accounts",
      severity: "CRITICAL",
      description: "Overprivileged IAM policies allow lateral movement and privilege escalation",
      attackVectors: ["overprivileged-role", "policy-escalation"],
    },
    {
      field: "unusedCredentialsExist",
      condition: (v) => v === true,
      stride: "Spoofing",
      technique: "T1078",
      techniqueName: "Valid Accounts",
      severity: "HIGH",
      description: "Unused credentials increase attack surface for credential theft",
      attackVectors: ["unused-credentials"],
    },
    {
      field: "accessKeysRotated",
      condition: (v) => v === false,
      stride: "Tampering",
      technique: "T1098",
      techniqueName: "Account Manipulation",
      severity: "HIGH",
      description: "Stale access keys are more likely to be compromised over time",
      attackVectors: ["unused-credentials"],
    },
    {
      field: "rootAccountMfaEnabled",
      condition: (v) => v === false,
      stride: "ElevationOfPrivilege",
      technique: "T1548",
      techniqueName: "Abuse Elevation Control Mechanism",
      severity: "CRITICAL",
      description: "Root account without MFA is the highest-impact compromise vector",
      attackVectors: ["missing-mfa"],
    },
  ],

  "aws-lambda": [
    {
      field: "environmentVariablesEncrypted",
      condition: (v) => v === false,
      stride: "InformationDisclosure",
      technique: "T1552.001",
      techniqueName: "Credentials In Files",
      severity: "CRITICAL",
      description: "Unencrypted environment variables may expose secrets and API keys",
      attackVectors: ["env-var-secrets"],
    },
    {
      field: "vpcConfigured",
      condition: (v) => v === false,
      stride: "InformationDisclosure",
      technique: "T1190",
      techniqueName: "Exploit Public-Facing Application",
      severity: "HIGH",
      description: "Lambda without VPC runs in shared AWS network, increasing attack surface",
      attackVectors: ["cold-start-injection"],
    },
    {
      field: "layerIntegrityVerified",
      condition: (v) => v === false,
      stride: "Tampering",
      technique: "T1195.002",
      techniqueName: "Compromise Software Supply Chain",
      severity: "HIGH",
      description: "Unverified Lambda layers could contain tampered code",
      attackVectors: ["layer-tampering"],
    },
    {
      field: "timeoutConfigured",
      condition: (v) => typeof v === "number" && v >= 900,
      stride: "DenialOfService",
      technique: "T1499",
      techniqueName: "Endpoint Denial of Service",
      severity: "MEDIUM",
      description: "Maximum timeout configuration enables resource exhaustion attacks",
      attackVectors: ["timeout-abuse"],
    },
  ],

  "aws-rds": [
    {
      field: "publiclyAccessible",
      condition: (v) => v === true,
      stride: "InformationDisclosure",
      technique: "T1190",
      techniqueName: "Exploit Public-Facing Application",
      severity: "CRITICAL",
      description: "Public RDS endpoint exposes database to internet-based attacks",
      attackVectors: ["public-endpoint"],
    },
    {
      field: "storageEncrypted",
      condition: (v) => v === false,
      stride: "InformationDisclosure",
      technique: "T1530",
      techniqueName: "Data from Cloud Storage",
      severity: "HIGH",
      description: "Unencrypted storage allows data extraction if physical access is obtained",
      attackVectors: ["unencrypted-storage"],
    },
    {
      field: "iamAuthEnabled",
      condition: (v) => v === false,
      stride: "Spoofing",
      technique: "T1110",
      techniqueName: "Brute Force",
      severity: "HIGH",
      description: "Password-only authentication enables brute force attacks against database",
      attackVectors: ["weak-auth"],
    },
    {
      field: "auditLogging",
      condition: (v) => v === false,
      stride: "Repudiation",
      technique: "T1562",
      techniqueName: "Impair Defenses",
      severity: "HIGH",
      description: "No audit logging prevents detection and investigation of database breaches",
      attackVectors: ["no-audit-logging"],
    },
  ],
};

// ===============================================================================
// EXPECTATION MAPPINGS — Convert threats back to MARK expectations
// ===============================================================================

const THREAT_TO_EXPECTATION: Record<string, ExpectationMapping[]> = {
  // Cognito fields
  "mfaConfiguration": [{ field: "mfaConfiguration", operator: "eq", value: "ON" }],
  "passwordPolicy.minimumLength": [{ field: "passwordPolicy.minimumLength", operator: "gte", value: 12 }],
  "passwordPolicy.requireSymbols": [{ field: "passwordPolicy.requireSymbols", operator: "eq", value: true }],
  "riskConfiguration": [{ field: "riskConfiguration", operator: "exists", value: true }],
  "softwareTokenMfaEnabled": [{ field: "softwareTokenMfaEnabled", operator: "eq", value: true }],
  "deviceConfiguration.challengeRequiredOnNewDevice": [{ field: "deviceConfiguration.challengeRequiredOnNewDevice", operator: "eq", value: true }],
  // S3 fields
  "publicAccessBlock": [{ field: "publicAccessBlock", operator: "eq", value: true }],
  "encryption": [{ field: "encryption", operator: "exists", value: true }],
  "versioning": [{ field: "versioning", operator: "eq", value: "Enabled" }],
  "logging": [{ field: "logging", operator: "eq", value: true }],
  // IAM fields
  "mfaEnabled": [{ field: "mfaEnabled", operator: "eq", value: true }],
  "hasOverprivilegedPolicies": [{ field: "hasOverprivilegedPolicies", operator: "eq", value: false }],
  "unusedCredentialsExist": [{ field: "unusedCredentialsExist", operator: "eq", value: false }],
  "accessKeysRotated": [{ field: "accessKeysRotated", operator: "eq", value: true }],
  "rootAccountMfaEnabled": [{ field: "rootAccountMfaEnabled", operator: "eq", value: true }],
  // Lambda fields
  "environmentVariablesEncrypted": [{ field: "environmentVariablesEncrypted", operator: "eq", value: true }],
  "vpcConfigured": [{ field: "vpcConfigured", operator: "eq", value: true }],
  "layerIntegrityVerified": [{ field: "layerIntegrityVerified", operator: "eq", value: true }],
  "timeoutConfigured": [{ field: "timeoutConfigured", operator: "lt", value: 900 }],
  // RDS fields
  "publiclyAccessible": [{ field: "publiclyAccessible", operator: "eq", value: false }],
  "storageEncrypted": [{ field: "storageEncrypted", operator: "eq", value: true }],
  "iamAuthEnabled": [{ field: "iamAuthEnabled", operator: "eq", value: true }],
  "auditLogging": [{ field: "auditLogging", operator: "eq", value: true }],
  // GitLab fields
  "visibility": [{ field: "visibility", operator: "eq", value: "private" }],
  "branchProtection.forcePushDisabled": [{ field: "branchProtection.forcePushDisabled", operator: "eq", value: true }],
  "branchProtection.requireApprovals": [{ field: "branchProtection.requireApprovals", operator: "eq", value: true }],
  "cicdSecurity.sastEnabled": [{ field: "cicdSecurity.sastEnabled", operator: "eq", value: true }],
  "cicdSecurity.secretDetectionEnabled": [{ field: "cicdSecurity.secretDetectionEnabled", operator: "eq", value: true }],
  "accessControl.mfaEnforced": [{ field: "accessControl.mfaEnforced", operator: "eq", value: true }],
  "accessControl.guestAccessEnabled": [{ field: "accessControl.guestAccessEnabled", operator: "eq", value: false }],
  "auditSettings.signedCommitsRequired": [{ field: "auditSettings.signedCommitsRequired", operator: "eq", value: true }],
};

// ===============================================================================
// SPYGLASS ENGINE
// ===============================================================================

export class SpyglassEngine {
  /**
   * Analyze a snapshot for STRIDE threats using provider-specific rules.
   *
   * @param snapshot - The provider snapshot (any shape)
   * @param provider - Provider ID (e.g., "aws-cognito", "aws-s3")
   * @param options - Optional configuration
   * @returns ThreatModelResult with all identified threats
   */
  spyglassAnalyze(
    snapshot: Record<string, unknown>,
    provider: string,
    options?: ThreatModelOptions
  ): ThreatModelResult {
    const rules = SPYGLASS_RULES[provider];
    if (!rules) {
      return {
        threats: [],
        methodology: "STRIDE-automated",
        provider,
        analyzedAt: new Date().toISOString(),
        threatCount: 0,
        riskDistribution: {},
      };
    }

    const threats: ThreatFinding[] = [];
    const seenIds = new Set<string>();
    let counter = 1;

    for (const rule of rules) {
      const value = this.getNestedValue(snapshot, rule.field);
      if (rule.condition(value)) {
        const id = `THREAT-${provider}-${counter++}`;
        // Deduplicate: same field + same stride + same technique = duplicate
        const dedupeKey = `${rule.field}:${rule.stride}:${rule.technique}`;
        if (seenIds.has(dedupeKey)) continue;
        seenIds.add(dedupeKey);

        threats.push({
          id,
          stride: rule.stride,
          description: rule.description,
          mitreTechnique: rule.technique,
          mitreName: rule.techniqueName,
          affectedField: rule.field,
          severity: rule.severity,
          attackVectors: rule.attackVectors,
        });
      }
    }

    // Compute risk distribution
    const riskDistribution: Record<string, number> = {};
    for (const threat of threats) {
      riskDistribution[threat.severity] = (riskDistribution[threat.severity] || 0) + 1;
    }

    return {
      threats,
      methodology: "STRIDE-automated",
      provider,
      analyzedAt: new Date().toISOString(),
      threatCount: threats.length,
      riskDistribution,
    };
  }

  /**
   * Convert STRIDE threats into MARK expectations.
   * Each threat's affected field maps to an expectation for the compliant state.
   *
   * @param threats - Array of ThreatFinding from spyglassAnalyze
   * @returns Deduplicated array of Expectations with optional threatRef
   */
  threatToExpectations(threats: ThreatFinding[]): (Expectation & { threatRef?: string })[] {
    if (!threats || threats.length === 0) return [];

    const expectations: (Expectation & { threatRef?: string })[] = [];
    const seenFields = new Set<string>();

    for (const threat of threats) {
      const mappings = THREAT_TO_EXPECTATION[threat.affectedField];
      if (!mappings) continue;

      for (const mapping of mappings) {
        if (seenFields.has(mapping.field)) continue;
        seenFields.add(mapping.field);

        expectations.push({
          field: mapping.field,
          operator: mapping.operator,
          value: mapping.value,
          threatRef: threat.id,
        });
      }
    }

    return expectations;
  }

  /**
   * Get the list of supported providers.
   */
  getSupportedProviders(): string[] {
    return Object.keys(SPYGLASS_RULES);
  }

  /**
   * Get nested value from object using dot notation.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}
