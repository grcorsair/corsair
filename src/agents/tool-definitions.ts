/**
 * CORSAIR Agent Tool Definitions
 *
 * Anthropic tool schemas for the 6 Corsair primitives.
 * These definitions enable Claude to understand and execute security operations.
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages.js";

/**
 * RECON - Observe provider state without modification (read-only reconnaissance)
 */
export const reconTool: Tool = {
  name: "recon",
  description: `Perform read-only reconnaissance on a target system to gather intelligence.

This primitive observes the current state of security controls without making any modifications.
Use this as your first step to understand what security configurations exist before launching attacks.

Supports multiple AWS services:
- **cognito**: User authentication (MFA settings, password policies, risk configurations)
- **s3**: Data storage (public access, encryption, versioning, logging)

Returns: Current snapshot of security configurations PLUS a snapshotId that you MUST use when calling MARK.
The snapshotId is the identifier you'll reference in subsequent operations (MARK, RAID, etc.).`,
  input_schema: {
    type: "object",
    properties: {
      targetId: {
        type: "string",
        description: "The target identifier (e.g., 'us-west-2_ABC123' for Cognito User Pool, 'my-bucket-name' for S3)"
      },
      service: {
        type: "string",
        enum: ["cognito", "s3"],
        description: "AWS service to target: 'cognito' for user auth, 's3' for data storage"
      },
      source: {
        type: "string",
        enum: ["fixture", "aws"],
        description: "Data source: 'fixture' for test data, 'aws' for real AWS API"
      }
    },
    required: ["targetId", "service", "source"]
  }
};

/**
 * MARK - Detect drift by comparing reality vs expectations
 */
export const markTool: Tool = {
  name: "mark",
  description: `Detect configuration drift by comparing actual state against expected security baselines.

This primitive identifies gaps between what SHOULD be configured and what ACTUALLY exists.
Use this after RECON to identify specific vulnerabilities or misconfigurations.

Returns: List of drift findings with severity ratings and descriptions.`,
  input_schema: {
    type: "object",
    properties: {
      snapshotId: {
        type: "string",
        description: "Reference to a snapshot from previous RECON operation"
      },
      expectations: {
        type: "array",
        description: "Array of security expectations to validate against",
        items: {
          type: "object",
          properties: {
            field: {
              type: "string",
              description: "Field to check (e.g., 'mfaConfiguration', 'passwordPolicy.minimumLength')"
            },
            operator: {
              type: "string",
              enum: ["eq", "neq", "gt", "gte", "lt", "lte", "exists", "contains"],
              description: "Comparison operator"
            },
            value: {
              description: "Expected value to compare against"
            }
          },
          required: ["field", "operator", "value"]
        }
      }
    },
    required: ["snapshotId", "expectations"]
  }
};

/**
 * RAID - Execute controlled chaos attack (main offensive primitive)
 */
export const raidTool: Tool = {
  name: "raid",
  description: `Execute a controlled chaos attack to test security control resilience.

This is the main offensive primitive. It simulates real-world attacks to validate whether
security controls actually work under adversarial conditions. Always use dryRun: true
unless explicitly authorized for destructive testing.

Attack vectors:
- mfa-bypass: Test MFA enforcement and bypass scenarios
- password-spray: Test password policy strength
- token-replay: Test token handling and replay protection
- session-hijack: Test session management controls

Returns: Attack results including success/failure, findings, and timeline of actions.`,
  input_schema: {
    type: "object",
    properties: {
      snapshotId: {
        type: "string",
        description: "Reference to a snapshot from previous RECON operation"
      },
      vector: {
        type: "string",
        enum: ["mfa-bypass", "password-spray", "token-replay", "session-hijack"],
        description: "Attack vector to execute"
      },
      intensity: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "Attack intensity (1=minimal, 10=maximum). Higher intensity assumes worst-case scenarios."
      },
      dryRun: {
        type: "boolean",
        description: "If true, simulate attack without making real changes. ALWAYS use true unless explicitly authorized."
      }
    },
    required: ["snapshotId", "vector", "intensity", "dryRun"]
  }
};

/**
 * PLUNDER - Extract cryptographic evidence from attacks
 */
export const plunderTool: Tool = {
  name: "plunder",
  description: `Extract cryptographic evidence from attack results for compliance and audit purposes.

This primitive takes raid results and generates tamper-proof evidence using SHA-256 hash chains.
The evidence is append-only JSONL format suitable for compliance frameworks.

**Evidence Output Control:**
You MUST specify the exact output path via the evidencePath parameter. This allows users to control
where evidence is stored (e.g., CI/CD pipelines, custom audit directories, enterprise workflows).

If the user provides a specific output path in the mission, use that exact path.
Otherwise, use a descriptive path like './evidence/[service]-[target]-[date].jsonl'

Use this after successful RAID operations to capture findings for audit trails.

Returns: Evidence file path, event count, and chain verification status.`,
  input_schema: {
    type: "object",
    properties: {
      raidId: {
        type: "string",
        description: "Reference to a raid result from previous RAID operation"
      },
      evidencePath: {
        type: "string",
        description: "File path where evidence JSONL should be written (e.g., './evidence/raid-001.jsonl')"
      }
    },
    required: ["raidId", "evidencePath"]
  }
};

/**
 * CHART - Map findings to compliance frameworks
 */
export const chartTool: Tool = {
  name: "chart",
  description: `Map security findings to compliance frameworks (MITRE ATT&CK, NIST-CSF, SOC2).

This primitive automatically translates technical attack results into compliance language.
It creates the connection between: Attack → MITRE Technique → NIST Control → SOC2 Criteria

Use this after MARK or RAID to understand compliance implications of findings.

Returns: Structured mappings to MITRE ATT&CK techniques, NIST controls, and SOC2 criteria.`,
  input_schema: {
    type: "object",
    properties: {
      findingsId: {
        type: "string",
        description: "Reference to findings from MARK operation or raid results"
      },
      frameworks: {
        type: "array",
        items: {
          type: "string",
          enum: ["MITRE", "NIST-CSF", "SOC2"]
        },
        description: "Which frameworks to map to (default: all three)"
      }
    },
    required: ["findingsId"]
  }
};

/**
 * ESCAPE - Rollback changes with scope guards (cleanup/restore)
 */
export const escapeTool: Tool = {
  name: "escape",
  description: `Rollback changes and restore original state using RAII-style scope guards.

This primitive ensures no leaked resources or persistent changes after testing.
It creates cleanup functions that automatically restore the system to pre-attack state.

Use this after RAID operations to ensure clean recovery, especially for non-dry-run attacks.

Returns: Rollback verification showing what was restored and final state validation.`,
  input_schema: {
    type: "object",
    properties: {
      raidId: {
        type: "string",
        description: "Reference to a raid result that needs cleanup"
      },
      verifyRestore: {
        type: "boolean",
        description: "If true, verify the state was actually restored correctly"
      }
    },
    required: ["raidId"]
  }
};

/**
 * All Corsair tools exported as array for easy registration with Anthropic
 */
export const corsairTools: Tool[] = [
  reconTool,
  markTool,
  raidTool,
  plunderTool,
  chartTool,
  escapeTool
];
