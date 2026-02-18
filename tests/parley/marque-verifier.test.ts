/**
 * MARQUE Verifier Test Contract
 *
 * Validates that MarqueVerifier correctly verifies MARQUE document signatures,
 * freshness, schema validity, and evidence chain integrity.
 *
 * TDD Phase: RED -- these tests must fail before implementation.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { MarqueGenerator } from "../../src/parley/marque-generator";
import { MarqueVerifier } from "../../src/parley/marque-verifier";
import type { MarqueGeneratorInput } from "../../src/parley/marque-generator";
import type { MarqueDocument } from "../../src/parley/marque-types";
import type { RaidResult, ChartResult, MarkResult } from "../../src/types";
import { EvidenceEngine } from "../../src/evidence";

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-marque-ver-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    ],
    driftDetected: true,
    durationMs: 42,
  };
}

function mockRaidResult(): RaidResult {
  return {
    raidId: "raid-001",
    target: "test-resource",
    vector: "mfa-bypass",
    success: true,
    controlsHeld: false,
    findings: ["MFA bypass successful"],
    timeline: [
      {
        timestamp: new Date().toISOString(),
        action: "initiate_mfa_bypass",
        result: "bypassed",
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
      description: "Adversary modifies auth",
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

async function generateValidMARQUE(keyDir: string): Promise<{
  doc: MarqueDocument;
  publicKey: Buffer;
  keyManager: MarqueKeyManager;
}> {
  const keyManager = new MarqueKeyManager(keyDir);
  await keyManager.generateKeypair();
  const keypair = (await keyManager.loadKeypair())!;
  const generator = new MarqueGenerator(keyManager);

  const evidencePath = path.join(keyDir, "evidence.jsonl");
  const engine = new EvidenceEngine(evidencePath);
  await engine.plunder(mockRaidResult(), evidencePath);

  const input: MarqueGeneratorInput = {
    markResults: [mockMarkResult()],
    raidResults: [mockRaidResult()],
    chartResults: [mockChartResult()],
    evidencePaths: [evidencePath],
    issuer: { id: "corsair-test", name: "Corsair Test Engine" },
    providers: ["aws-cognito"],
  };

  const doc = await generator.generate(input);
  return { doc, publicKey: keypair.publicKey, keyManager };
}

// =============================================================================
// TESTS
// =============================================================================

describe("MARQUE Verifier - Document Verification", () => {
  const testDirs: string[] = [];

  function trackDir(): string {
    const dir = createTestDir();
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

  test("verify valid MARQUE returns { valid: true }", async () => {
    const keyDir = trackDir();
    const { doc, publicKey } = await generateValidMARQUE(keyDir);

    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verify(doc);

    expect(result.valid).toBe(true);
    expect(result.signedBy).toBeDefined();
    expect(result.generatedAt).toBeDefined();
    expect(result.expiresAt).toBeDefined();
  });

  test("verify tampered MARQUE returns { valid: false, reason: signature_invalid }", async () => {
    const keyDir = trackDir();
    const { doc, publicKey } = await generateValidMARQUE(keyDir);

    // Tamper with the document (change score to something different)
    const tampered = structuredClone(doc);
    tampered.marque.summary.overallScore = 42;

    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verify(tampered);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("signature_invalid");
  });

  test("verify expired MARQUE returns { valid: false, reason: expired }", async () => {
    const keyDir = trackDir();
    const { doc, publicKey } = await generateValidMARQUE(keyDir);

    // Forge an expired document by modifying expiresAt and re-signing
    // Since we can't re-sign, we create a doc with expired time directly
    const keyManager = new MarqueKeyManager(keyDir);
    const keypair = (await keyManager.loadKeypair())!;
    const generator = new MarqueGenerator(keyManager, { expiryDays: -1 });

    const evidencePath = path.join(keyDir, "evidence2.jsonl");
    const engine = new EvidenceEngine(evidencePath);
    await engine.plunder(mockRaidResult(), evidencePath);

    const input: MarqueGeneratorInput = {
      markResults: [mockMarkResult()],
      raidResults: [mockRaidResult()],
      chartResults: [mockChartResult()],
      evidencePaths: [evidencePath],
      issuer: { id: "corsair-test", name: "Corsair Test Engine" },
      providers: ["aws-cognito"],
    };

    const expiredDoc = await generator.generate(input);

    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verify(expiredDoc);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  test("verify MARQUE with invalid schema returns { valid: false, reason: schema_invalid }", async () => {
    const keyDir = trackDir();
    const { publicKey } = await generateValidMARQUE(keyDir);

    // Create a document missing required fields
    const invalidDoc = {
      parley: "1.0",
      marque: {
        id: "marque-invalid",
        // Missing: version, issuer, generatedAt, expiresAt, scope, summary, evidenceChain, frameworks
      },
      signature: "invalid-sig",
    } as unknown as MarqueDocument;

    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verify(invalidDoc);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("schema_invalid");
  });

  test("verify MARQUE signed with retired key returns { valid: true } when retired keys provided", async () => {
    const keyDir = trackDir();

    // Generate initial keypair and sign a document
    const keyManager = new MarqueKeyManager(keyDir);
    const originalKeypair = await keyManager.generateKeypair();
    const generator = new MarqueGenerator(keyManager);

    const evidencePath = path.join(keyDir, "evidence.jsonl");
    const engine = new EvidenceEngine(evidencePath);
    await engine.plunder(mockRaidResult(), evidencePath);

    const input: MarqueGeneratorInput = {
      markResults: [mockMarkResult()],
      raidResults: [mockRaidResult()],
      chartResults: [mockChartResult()],
      evidencePaths: [evidencePath],
      issuer: { id: "corsair-test", name: "Corsair Test Engine" },
      providers: ["aws-cognito"],
    };

    const doc = await generator.generate(input);

    // Rotate key -- old key is now retired
    const rotation = await keyManager.rotateKey();
    const newKeypair = (await keyManager.loadKeypair())!;

    // Verify with new key + retired keys
    const retiredKeys = keyManager.getRetiredKeys();
    const allKeys = [newKeypair.publicKey, ...retiredKeys];
    const verifier = new MarqueVerifier(allKeys);
    const result = await verifier.verify(doc);

    expect(result.valid).toBe(true);
  });

  test("verify MARQUE with broken evidence chain reference returns { valid: false }", async () => {
    const keyDir = trackDir();
    const { doc, publicKey } = await generateValidMARQUE(keyDir);

    // Tamper evidence chain metadata and re-sign to make signature valid
    // but evidence chain integrity check should still catch it
    const keyManager = new MarqueKeyManager(keyDir);
    const keypair = (await keyManager.loadKeypair())!;

    // Create a clone with bad evidence chain
    const badDoc = structuredClone(doc);
    badDoc.marque.evidenceChain.chainVerified = false;

    // Re-sign the tampered content so signature passes
    const { sortKeysDeep } = await import("../../src/parley/marque-generator");
    const marquePayload = JSON.stringify(sortKeysDeep(badDoc.marque));
    badDoc.signature = keyManager.sign(marquePayload, keypair.privateKey);

    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verify(badDoc);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("evidence_mismatch");
  });

  test("standalone verifier works without Corsair installed (just needs public key)", async () => {
    const keyDir = trackDir();
    const { doc, publicKey } = await generateValidMARQUE(keyDir);

    // Simulate standalone verification: only a public key buffer, no key manager
    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verify(doc);

    expect(result.valid).toBe(true);
    // The verifier should work with just the public key -- no Corsair dependency
    expect(result.generatedAt).toBe(doc.marque.generatedAt);
    expect(result.expiresAt).toBe(doc.marque.expiresAt);
  });

  test("verifyFromFile reads MARQUE from disk and verifies", async () => {
    const keyDir = trackDir();
    const { doc, publicKey } = await generateValidMARQUE(keyDir);

    // Write MARQUE to disk
    const marquePath = path.join(keyDir, "test-marque.json");
    fs.writeFileSync(marquePath, JSON.stringify(doc, null, 2));

    const verifier = new MarqueVerifier([publicKey]);
    const result = await verifier.verifyFromFile(marquePath);

    expect(result.valid).toBe(true);
    expect(result.signedBy).toBeDefined();
  });
});
