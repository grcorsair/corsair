/**
 * CPOE Sanitization Test Contract
 *
 * Validates that the CPOEGenerator sanitizes all sensitive information from
 * generated CPOE documents. No ARNs, account IDs, IP addresses, file paths,
 * API keys, or verbatim attack details should appear in the output.
 *
 * TDD Phase: RED -- these tests must fail before implementation.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { CPOEKeyManager } from "../../src/parley/cpoe-key-manager";
import { CPOEGenerator } from "../../src/parley/cpoe-generator";
import type { CPOEGeneratorInput } from "../../src/parley/cpoe-generator";
import type {
  MarkResult,
  RaidResult,
  ChartResult,
} from "../../src/types";
import { EvidenceEngine } from "../../src/evidence";

// =============================================================================
// TEST FIXTURES WITH SENSITIVE DATA
// =============================================================================

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-cpoe-san-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

function sensitiveMarkResult(): MarkResult {
  return {
    findings: [
      {
        id: "drift-001",
        field: "mfaConfiguration",
        expected: "ON",
        actual: "OFF",
        drift: true,
        severity: "CRITICAL",
        description: "MFA disabled on arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_SensitivePool",
        timestamp: new Date().toISOString(),
      },
    ],
    driftDetected: true,
    durationMs: 42,
  };
}

function sensitiveRaidResult(): RaidResult {
  return {
    raidId: "raid-001",
    target: "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_SensitivePool",
    vector: "mfa-bypass",
    success: true,
    controlsHeld: false,
    findings: [
      "MFA bypass successful at IP 192.168.1.100 using token sk-test-secret-key-12345",
      "Account 123456789012 vulnerable via /Users/developer/exploit/payload.ts",
    ],
    timeline: [
      {
        timestamp: new Date().toISOString(),
        action: "POST /api/v1/auth/mfa-bypass with API key AKIA1234567890ABCDEF",
        result: "bypassed at C:\\Users\\admin\\corsair\\output",
        data: { userPoolId: "us-east-1_SensitivePool", ip: "10.0.0.1" },
      },
    ],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    serialized: true,
    durationMs: 150,
  };
}

function sensitiveChartResult(): ChartResult {
  return {
    mitre: {
      technique: "T1556",
      name: "Modify Authentication Process",
      tactic: "Credential Access",
      description: "Adversary modifies auth at 192.168.1.100",
    },
    nist: {
      function: "Protect",
      category: "Access Control",
      controls: ["AC-2"],
    },
    soc2: {
      principle: "Security",
      criteria: ["CC6.1"],
      description: "Logical access security",
    },
    frameworks: {
      "NIST-800-53": {
        controls: [
          { controlId: "AC-2", controlName: "Account Management", status: "passed" },
        ],
      },
    },
  };
}

async function createEvidenceFile(dir: string): Promise<string> {
  const evidencePath = path.join(dir, "evidence.jsonl");
  const engine = new EvidenceEngine(evidencePath);
  await engine.plunder(sensitiveRaidResult(), evidencePath);
  return evidencePath;
}

// =============================================================================
// TESTS
// =============================================================================

describe("CPOE Sanitization - Sensitive Data Removal", () => {
  const testDirs: string[] = [];

  function trackDir(dir: string): string {
    testDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const dir of testDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  async function generateSensitiveCPOE(): Promise<string> {
    const keyDir = trackDir(createTestDir());
    const keyManager = new CPOEKeyManager(keyDir);
    await keyManager.generateKeypair();
    const generator = new CPOEGenerator(keyManager);

    const evidencePath = await createEvidenceFile(keyDir);

    const input: CPOEGeneratorInput = {
      markResults: [sensitiveMarkResult()],
      raidResults: [sensitiveRaidResult()],
      chartResults: [sensitiveChartResult()],
      evidencePaths: [evidencePath],
      issuer: { id: "corsair-test", name: "Corsair Test Engine" },
      providers: ["aws-cognito"],
    };

    const doc = await generator.generate(input);
    return JSON.stringify(doc);
  }

  test("no AWS ARNs appear in generated CPOE", async () => {
    const json = await generateSensitiveCPOE();
    expect(json).not.toMatch(/arn:aws:/);
  });

  test("no AWS account IDs appear (12-digit sequences)", async () => {
    const json = await generateSensitiveCPOE();
    // Check specifically for the 12-digit account ID pattern
    // Exclude fields that are legitimately numeric (like scores, counts)
    // The test targets account-id-like patterns in string values
    expect(json).not.toMatch(/123456789012/);
  });

  test("no IP addresses appear", async () => {
    const json = await generateSensitiveCPOE();
    // Should not contain any IPv4 addresses from our test data
    expect(json).not.toMatch(/192\.168\.1\.100/);
    expect(json).not.toMatch(/10\.0\.0\.1/);
  });

  test("no internal file paths appear", async () => {
    const json = await generateSensitiveCPOE();
    expect(json).not.toMatch(/\/Users\//);
    expect(json).not.toMatch(/\/home\//);
    expect(json).not.toMatch(/C:\\/);
  });

  test("no API keys or tokens appear", async () => {
    const json = await generateSensitiveCPOE();
    expect(json).not.toMatch(/sk-test-/);
    expect(json).not.toMatch(/AKIA/);
    expect(json).not.toMatch(/secret-key/);
  });

  test("resource IDs are hashed or anonymized", async () => {
    const json = await generateSensitiveCPOE();
    // The original userPoolId should not appear
    expect(json).not.toMatch(/us-east-1_SensitivePool/);
  });

  test("attack details are summarized, not included verbatim", async () => {
    const json = await generateSensitiveCPOE();
    // Verbatim finding strings should not appear
    expect(json).not.toMatch(/MFA bypass successful at IP/);
    expect(json).not.toMatch(/POST \/api\/v1\/auth\/mfa-bypass/);
  });

  test("timeline entries sanitized to timestamps and categories only", async () => {
    const json = await generateSensitiveCPOE();
    // Raw action strings with sensitive details should not appear
    expect(json).not.toMatch(/POST \/api\/v1\/auth/);
    expect(json).not.toMatch(/bypassed at C:/);
  });

  test("sanitization of Cognito snapshot removes userPoolId format", async () => {
    const json = await generateSensitiveCPOE();
    // User pool IDs follow the pattern: region_identifier
    expect(json).not.toMatch(/us-east-1_/);
  });

  test("sanitization of S3 snapshot removes bucket name", async () => {
    // Create a CPOE with S3-related data
    const keyDir = trackDir(createTestDir());
    const keyManager = new CPOEKeyManager(keyDir);
    await keyManager.generateKeypair();
    const generator = new CPOEGenerator(keyManager);

    const raidWithBucket: RaidResult = {
      raidId: "raid-s3",
      target: "my-sensitive-bucket-name",
      vector: "public-access-test",
      success: true,
      controlsHeld: true,
      findings: ["Bucket my-sensitive-bucket-name has public access blocked"],
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: "check-public-access",
          result: "blocked",
        },
      ],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      serialized: true,
      durationMs: 50,
    };

    const evidencePath = path.join(keyDir, "evidence.jsonl");
    const engine = new EvidenceEngine(evidencePath);
    await engine.plunder(raidWithBucket, evidencePath);

    const input: CPOEGeneratorInput = {
      markResults: [],
      raidResults: [raidWithBucket],
      chartResults: [sensitiveChartResult()],
      evidencePaths: [evidencePath],
      issuer: { id: "corsair-test", name: "Corsair Test Engine" },
      providers: ["aws-s3"],
    };

    const doc = await generator.generate(input);
    const json = JSON.stringify(doc);
    expect(json).not.toMatch(/my-sensitive-bucket-name/);
  });
});
