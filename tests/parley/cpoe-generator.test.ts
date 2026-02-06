/**
 * CPOE Generator Test Contract
 *
 * Validates that CPOEGenerator produces valid, signed, sanitized CPOE documents
 * from Corsair assessment results (MarkResult, RaidResult, ChartResult, PlunderResult).
 *
 * TDD Phase: RED — these tests must fail before implementation.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { CPOEKeyManager } from "../../src/parley/cpoe-key-manager";
import { CPOEGenerator, sortKeysDeep } from "../../src/parley/cpoe-generator";
import type { CPOEGeneratorInput } from "../../src/parley/cpoe-generator";
import type { CPOEAdmiralAttestation } from "../../src/parley/cpoe-types";
import type {
  MarkResult,
  RaidResult,
  ChartResult,
  ThreatModelResult,
} from "../../src/types";
import { EvidenceEngine } from "../../src/evidence";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-cpoe-gen-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

function mockMarkResult(): MarkResult {
  return {
    findings: [
      {
        id: "drift-001",
        field: "mfaConfiguration",
        expected: "ON",
        actual: "OFF",
        drift: true,
        severity: "CRITICAL",
        description: "MFA is disabled",
        timestamp: new Date().toISOString(),
      },
      {
        id: "drift-002",
        field: "passwordPolicy.minimumLength",
        expected: 12,
        actual: 8,
        drift: true,
        severity: "HIGH",
        description: "Password minimum length below standard",
        timestamp: new Date().toISOString(),
      },
    ],
    driftDetected: true,
    durationMs: 42,
  };
}

function mockRaidResult(): RaidResult {
  return {
    raidId: "raid-001",
    target: "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_TestPool",
    vector: "mfa-bypass",
    success: true,
    controlsHeld: false,
    findings: [
      "MFA bypass successful via token manipulation at 192.168.1.100",
      "API key sk-test-12345 exposed in response headers",
    ],
    timeline: [
      {
        timestamp: new Date().toISOString(),
        action: "initiate_mfa_bypass",
        result: "bypassed",
        data: { userPoolId: "us-east-1_TestPool" },
      },
    ],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    serialized: true,
    durationMs: 150,
  };
}

function mockChartResult(): ChartResult {
  return {
    mitre: {
      technique: "T1556",
      name: "Modify Authentication Process",
      tactic: "Credential Access",
      description: "Adversary modifies authentication process",
    },
    nist: {
      function: "Protect",
      category: "Access Control",
      controls: ["AC-2", "AC-3", "IA-5"],
    },
    soc2: {
      principle: "Security",
      criteria: ["CC6.1", "CC6.6"],
      description: "Logical access security",
    },
    frameworks: {
      "NIST-800-53": {
        controls: [
          { controlId: "AC-2", controlName: "Account Management", status: "passed" },
          { controlId: "AC-3", controlName: "Access Enforcement", status: "passed" },
          { controlId: "IA-5", controlName: "Authenticator Management", status: "failed" },
        ],
      },
      SOC2: {
        controls: [
          { controlId: "CC6.1", controlName: "Logical Access", status: "passed" },
          { controlId: "CC6.6", controlName: "System Boundaries", status: "failed" },
        ],
      },
    },
  };
}

function mockThreatModel(): ThreatModelResult {
  return {
    threats: [
      {
        id: "threat-001",
        stride: "Spoofing",
        description: "Authentication bypass via MFA manipulation",
        mitreTechnique: "T1556",
        mitreName: "Modify Authentication Process",
        affectedField: "mfaConfiguration",
        severity: "CRITICAL",
        attackVectors: ["mfa-bypass"],
      },
    ],
    methodology: "STRIDE-automated",
    provider: "aws-cognito",
    analyzedAt: new Date().toISOString(),
    threatCount: 1,
    riskDistribution: { CRITICAL: 1, HIGH: 0, MEDIUM: 0, LOW: 0 },
  };
}

async function createEvidenceFile(dir: string): Promise<string> {
  const evidencePath = path.join(dir, "evidence.jsonl");
  const engine = new EvidenceEngine(evidencePath);
  await engine.plunder(mockRaidResult(), evidencePath);
  return evidencePath;
}

// =============================================================================
// TESTS
// =============================================================================

describe("CPOE Generator - Document Generation", () => {
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

  async function setupGenerator(
    options?: { expiryDays?: number },
  ): Promise<{
    generator: CPOEGenerator;
    keyManager: CPOEKeyManager;
    publicKey: Buffer;
    keyDir: string;
  }> {
    const keyDir = trackDir(createTestDir());
    const keyManager = new CPOEKeyManager(keyDir);
    await keyManager.generateKeypair();
    const keypair = (await keyManager.loadKeypair())!;
    const generator = new CPOEGenerator(keyManager, options);
    return { generator, keyManager, publicKey: keypair.publicKey, keyDir };
  }

  async function buildInput(keyDir: string): Promise<CPOEGeneratorInput> {
    const evidencePath = await createEvidenceFile(keyDir);
    return {
      markResults: [mockMarkResult()],
      raidResults: [mockRaidResult()],
      chartResults: [mockChartResult()],
      evidencePaths: [evidencePath],
      issuer: { id: "corsair-test", name: "Corsair Test Engine" },
      providers: ["aws-cognito"],
    };
  }

  test("generate produces valid CPOEDocument with all required fields", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.parley).toBe("1.0");
    expect(doc.cpoe.id).toBeDefined();
    expect(doc.cpoe.version).toBe("1.0.0");
    expect(doc.cpoe.issuer).toBeDefined();
    expect(doc.cpoe.generatedAt).toBeDefined();
    expect(doc.cpoe.expiresAt).toBeDefined();
    expect(doc.cpoe.scope).toBeDefined();
    expect(doc.cpoe.summary).toBeDefined();
    expect(doc.cpoe.evidenceChain).toBeDefined();
    expect(doc.cpoe.frameworks).toBeDefined();
    expect(doc.signature).toBeDefined();
    expect(doc.signature.length).toBeGreaterThan(0);
  });

  test("generate signs document with Ed25519 (signature field populated)", async () => {
    const { generator, keyManager, publicKey, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    // Signature should be a non-empty base64 string
    expect(doc.signature).toBeDefined();
    expect(doc.signature.length).toBeGreaterThan(0);

    // Verify the signature is valid with the public key
    const cpoePayload = JSON.stringify(sortKeysDeep(doc.cpoe));
    const isValid = keyManager.verify(cpoePayload, doc.signature, publicKey);
    expect(isValid).toBe(true);
  });

  test("generated CPOE has correct issuer info", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.cpoe.issuer.id).toBe("corsair-test");
    expect(doc.cpoe.issuer.name).toBe("Corsair Test Engine");
  });

  test("generated CPOE scope reflects input providers", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.cpoe.scope.providers).toContain("aws-cognito");
    expect(doc.cpoe.scope.providers).toHaveLength(1);
    expect(doc.cpoe.scope.frameworksCovered.length).toBeGreaterThan(0);
    expect(doc.cpoe.scope.resourceCount).toBeGreaterThan(0);
  });

  test("generated CPOE summary has correct control counts", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    // From mockChartResult: NIST-800-53 has 3 controls (2 passed, 1 failed),
    // SOC2 has 2 controls (1 passed, 1 failed) = 5 total, 3 passed, 2 failed
    expect(doc.cpoe.summary.controlsTested).toBe(5);
    expect(doc.cpoe.summary.controlsPassed).toBe(3);
    expect(doc.cpoe.summary.controlsFailed).toBe(2);
    expect(doc.cpoe.summary.overallScore).toBe(60); // 3/5 = 60%
  });

  test("generated CPOE frameworks section has per-framework breakdowns", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.cpoe.frameworks["NIST-800-53"]).toBeDefined();
    expect(doc.cpoe.frameworks["SOC2"]).toBeDefined();

    const nist = doc.cpoe.frameworks["NIST-800-53"];
    expect(nist.controlsMapped).toBe(3);
    expect(nist.passed).toBe(2);
    expect(nist.failed).toBe(1);
    expect(nist.controls).toHaveLength(3);

    const soc2 = doc.cpoe.frameworks["SOC2"];
    expect(soc2.controlsMapped).toBe(2);
    expect(soc2.passed).toBe(1);
    expect(soc2.failed).toBe(1);
    expect(soc2.controls).toHaveLength(2);
  });

  test("generated CPOE evidence chain references hash chain root", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.cpoe.evidenceChain.hashChainRoot).toBeDefined();
    expect(doc.cpoe.evidenceChain.hashChainRoot.length).toBeGreaterThan(0);
    expect(doc.cpoe.evidenceChain.recordCount).toBeGreaterThan(0);
    expect(doc.cpoe.evidenceChain.chainVerified).toBe(true);
  });

  test("generated CPOE threat model summary reflects input when provided", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);
    input.threatModel = mockThreatModel();

    const doc = await generator.generate(input);

    expect(doc.cpoe.threatModel).toBeDefined();
    expect(doc.cpoe.threatModel!.methodology).toBe("STRIDE-automated");
    expect(doc.cpoe.threatModel!.providersAnalyzed).toContain("aws-cognito");
    expect(doc.cpoe.threatModel!.totalThreats).toBe(1);
    expect(doc.cpoe.threatModel!.riskDistribution).toBeDefined();
  });

  test("generated CPOE expiresAt is 7 days after generatedAt (default)", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    const generatedAt = new Date(doc.cpoe.generatedAt).getTime();
    const expiresAt = new Date(doc.cpoe.expiresAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // Allow 1 second tolerance for test execution time
    expect(Math.abs(expiresAt - generatedAt - sevenDaysMs)).toBeLessThan(1000);
  });

  test("custom expiry duration is respected", async () => {
    const { generator, keyDir } = await setupGenerator({ expiryDays: 30 });
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    const generatedAt = new Date(doc.cpoe.generatedAt).getTime();
    const expiresAt = new Date(doc.cpoe.expiresAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(Math.abs(expiresAt - generatedAt - thirtyDaysMs)).toBeLessThan(1000);
  });

  test("admiral attestation embedded when provided", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);
    input.admiralAttestation = {
      confidenceScore: 0.92,
      dimensions: [
        { dimension: "evidence-quality", score: 0.95 },
        { dimension: "coverage-breadth", score: 0.89 },
      ],
      trustTier: "ai-verified",
      evaluatedAt: new Date().toISOString(),
      reportHash: "sha256-test-hash",
    };

    const doc = await generator.generate(input);

    expect(doc.cpoe.admiralAttestation).toBeDefined();
    expect(doc.cpoe.admiralAttestation!.confidenceScore).toBe(0.92);
    expect(doc.cpoe.admiralAttestation!.dimensions).toHaveLength(2);
    expect(doc.cpoe.admiralAttestation!.trustTier).toBe("ai-verified");
  });
});
