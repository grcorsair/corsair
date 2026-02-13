/**
 * MARQUE Generator Test Contract
 *
 * Validates that MarqueGenerator produces valid, signed, sanitized MARQUE documents
 * from Corsair assessment results (MarkResult, RaidResult, ChartResult, PlunderResult).
 *
 * TDD Phase: RED — these tests must fail before implementation.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { MarqueGenerator, sortKeysDeep } from "../../src/parley/marque-generator";
import type { MarqueGeneratorInput } from "../../src/parley/marque-generator";
import type { MarqueQuartermasterAttestation } from "../../src/parley/marque-types";
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
    `corsair-marque-gen-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

describe("MARQUE Generator - Document Generation", () => {
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
    generator: MarqueGenerator;
    keyManager: MarqueKeyManager;
    publicKey: Buffer;
    keyDir: string;
  }> {
    const keyDir = trackDir(createTestDir());
    const keyManager = new MarqueKeyManager(keyDir);
    await keyManager.generateKeypair();
    const keypair = (await keyManager.loadKeypair())!;
    const generator = new MarqueGenerator(keyManager, options);
    return { generator, keyManager, publicKey: keypair.publicKey, keyDir };
  }

  async function buildInput(keyDir: string): Promise<MarqueGeneratorInput> {
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

  test("generate produces valid MarqueDocument with all required fields", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.parley).toBe("1.0");
    expect(doc.marque.id).toBeDefined();
    expect(doc.marque.version).toBe("1.0.0");
    expect(doc.marque.issuer).toBeDefined();
    expect(doc.marque.generatedAt).toBeDefined();
    expect(doc.marque.expiresAt).toBeDefined();
    expect(doc.marque.scope).toBeDefined();
    expect(doc.marque.summary).toBeDefined();
    expect(doc.marque.evidenceChain).toBeDefined();
    expect(doc.marque.frameworks).toBeDefined();
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
    const marquePayload = JSON.stringify(sortKeysDeep(doc.marque));
    const isValid = keyManager.verify(marquePayload, doc.signature, publicKey);
    expect(isValid).toBe(true);
  });

  test("generated MARQUE has correct issuer info", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.marque.issuer.id).toBe("corsair-test");
    expect(doc.marque.issuer.name).toBe("Corsair Test Engine");
  });

  test("generated MARQUE scope reflects input providers", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.marque.scope.providers).toContain("aws-cognito");
    expect(doc.marque.scope.providers).toHaveLength(1);
    expect(doc.marque.scope.frameworksCovered.length).toBeGreaterThan(0);
    expect(doc.marque.scope.resourceCount).toBeGreaterThan(0);
  });

  test("generated MARQUE summary has correct control counts", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    // From mockChartResult: NIST-800-53 has 3 controls (2 passed, 1 failed),
    // SOC2 has 2 controls (1 passed, 1 failed) = 5 total, 3 passed, 2 failed
    expect(doc.marque.summary.controlsTested).toBe(5);
    expect(doc.marque.summary.controlsPassed).toBe(3);
    expect(doc.marque.summary.controlsFailed).toBe(2);
    expect(doc.marque.summary.overallScore).toBe(60); // 3/5 = 60%
  });

  test("generated MARQUE frameworks section has per-framework breakdowns", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.marque.frameworks["NIST-800-53"]).toBeDefined();
    expect(doc.marque.frameworks["SOC2"]).toBeDefined();

    const nist = doc.marque.frameworks["NIST-800-53"];
    expect(nist.controlsMapped).toBe(3);
    expect(nist.passed).toBe(2);
    expect(nist.failed).toBe(1);
    expect(nist.controls).toHaveLength(3);

    const soc2 = doc.marque.frameworks["SOC2"];
    expect(soc2.controlsMapped).toBe(2);
    expect(soc2.passed).toBe(1);
    expect(soc2.failed).toBe(1);
    expect(soc2.controls).toHaveLength(2);
  });

  test("generated MARQUE evidence chain references hash chain root", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    expect(doc.marque.evidenceChain.hashChainRoot).toBeDefined();
    expect(doc.marque.evidenceChain.hashChainRoot.length).toBeGreaterThan(0);
    expect(doc.marque.evidenceChain.recordCount).toBeGreaterThan(0);
    expect(doc.marque.evidenceChain.chainVerified).toBe(true);
  });

  test("generated MARQUE threat model summary reflects input when provided", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);
    input.threatModel = mockThreatModel();

    const doc = await generator.generate(input);

    expect(doc.marque.threatModel).toBeDefined();
    expect(doc.marque.threatModel!.methodology).toBe("STRIDE-automated");
    expect(doc.marque.threatModel!.providersAnalyzed).toContain("aws-cognito");
    expect(doc.marque.threatModel!.totalThreats).toBe(1);
    expect(doc.marque.threatModel!.riskDistribution).toBeDefined();
  });

  test("generated MARQUE expiresAt is 90 days after generatedAt (default)", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    const generatedAt = new Date(doc.marque.generatedAt).getTime();
    const expiresAt = new Date(doc.marque.expiresAt).getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    // Allow 1 second tolerance for test execution time
    expect(Math.abs(expiresAt - generatedAt - ninetyDaysMs)).toBeLessThan(1000);
  });

  test("custom expiry duration is respected", async () => {
    const { generator, keyDir } = await setupGenerator({ expiryDays: 30 });
    const input = await buildInput(keyDir);

    const doc = await generator.generate(input);

    const generatedAt = new Date(doc.marque.generatedAt).getTime();
    const expiresAt = new Date(doc.marque.expiresAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(Math.abs(expiresAt - generatedAt - thirtyDaysMs)).toBeLessThan(1000);
  });

  test("quartermaster attestation embedded when provided", async () => {
    const { generator, keyDir } = await setupGenerator();
    const input = await buildInput(keyDir);
    input.quartermasterAttestation = {
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

    expect(doc.marque.quartermasterAttestation).toBeDefined();
    expect(doc.marque.quartermasterAttestation!.confidenceScore).toBe(0.92);
    expect(doc.marque.quartermasterAttestation!.dimensions).toHaveLength(2);
    expect(doc.marque.quartermasterAttestation!.trustTier).toBe("ai-verified");
  });
});
