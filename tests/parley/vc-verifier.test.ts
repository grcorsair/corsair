/**
 * VC Verifier Test Contract
 *
 * Tests JWT-VC verification: signature check, expiration, required claims,
 * and mapping to MarqueVerificationResult.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as jose from "jose";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { generateVCJWT } from "../../src/parley/vc-generator";
import { verifyVCJWT } from "../../src/parley/vc-verifier";
import type { MarqueGeneratorInput } from "../../src/parley/marque-generator";
import type { MarkResult, RaidResult, ChartResult } from "../../src/types";
import { VC_CONTEXT } from "../../src/parley/vc-types";
import { EvidenceEngine } from "../../src/evidence";

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-vc-ver-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

function mockMarkResult(): MarkResult {
  return {
    findings: [
      {
        id: "drift-001", field: "mfaConfiguration", expected: "ON",
        actual: "OFF", drift: true, severity: "CRITICAL",
        description: "MFA disabled", timestamp: new Date().toISOString(),
      },
    ],
    driftDetected: true,
    durationMs: 42,
  };
}

function mockRaidResult(): RaidResult {
  return {
    raidId: "raid-001", target: "test-resource", vector: "mfa-bypass",
    success: true, controlsHeld: false, findings: ["MFA bypass successful"],
    timeline: [{ timestamp: new Date().toISOString(), action: "test", result: "done" }],
    startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
    serialized: true, durationMs: 150,
  };
}

function mockChartResult(): ChartResult {
  return {
    mitre: { technique: "T1556", name: "MFA", tactic: "Credential Access", description: "Auth" },
    nist: { function: "Protect", category: "AC", controls: ["AC-2"] },
    soc2: { principle: "Security", criteria: ["CC6.1"], description: "Access" },
    frameworks: {
      "NIST-800-53": {
        controls: [
          { controlId: "AC-2", controlName: "Account Mgmt", status: "passed" },
        ],
      },
    },
  };
}

describe("VC Verifier - JWT-VC Verification", () => {
  const testDirs: string[] = [];

  function trackDir(dir: string): string {
    testDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    for (const dir of testDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    }
  });

  async function setup(): Promise<{
    keyManager: MarqueKeyManager;
    input: MarqueGeneratorInput;
    publicKey: Buffer;
  }> {
    const keyDir = trackDir(createTestDir());
    const keyManager = new MarqueKeyManager(keyDir);
    await keyManager.generateKeypair();
    const keypair = (await keyManager.loadKeypair())!;

    const evidencePath = path.join(keyDir, "evidence.jsonl");
    const engine = new EvidenceEngine(evidencePath);
    await engine.plunder(mockRaidResult(), evidencePath);

    const input: MarqueGeneratorInput = {
      markResults: [mockMarkResult()],
      raidResults: [mockRaidResult()],
      chartResults: [mockChartResult()],
      evidencePaths: [evidencePath],
      issuer: { id: "corsair-test", name: "Corsair Test Engine", did: "did:web:grcorsair.com" },
      providers: ["aws-cognito"],
    };

    return { keyManager, input, publicKey: keypair.publicKey };
  }

  test("verifyVCJWT returns valid=true for correctly signed JWT", async () => {
    const { keyManager, input, publicKey } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const result = await verifyVCJWT(jwt, [publicKey]);

    expect(result.valid).toBe(true);
    expect(result.signedBy).toBeDefined();
    expect(result.generatedAt).toBeDefined();
    expect(result.expiresAt).toBeDefined();
  });

  test("verifyVCJWT returns valid=false with reason=signature_invalid for tampered JWT", async () => {
    const { keyManager, input, publicKey } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    // Tamper with JWT payload
    const parts = jwt.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], "base64url").toString()), iss: "did:web:evil.com" })).toString("base64url");
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = await verifyVCJWT(tampered, [publicKey]);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("signature_invalid");
  });

  test("verifyVCJWT returns valid=false with reason=expired for expired JWT", async () => {
    const { keyManager, input, publicKey } = await setup();
    // Generate with -1 day expiry (already expired)
    const jwt = await generateVCJWT(input, keyManager, { expiryDays: -1 });

    const result = await verifyVCJWT(jwt, [publicKey]);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  test("verifyVCJWT returns valid=false with reason=signature_invalid for wrong key", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    // Create a different keypair
    const otherDir = trackDir(createTestDir());
    const otherManager = new MarqueKeyManager(otherDir);
    await otherManager.generateKeypair();
    const otherKeypair = (await otherManager.loadKeypair())!;

    const result = await verifyVCJWT(jwt, [otherKeypair.publicKey]);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("signature_invalid");
  });

  test("verifyVCJWT tries all trusted keys (retired key support)", async () => {
    const { keyManager, input, publicKey } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    // Create a second key to represent a "new" key
    const otherDir = trackDir(createTestDir());
    const otherManager = new MarqueKeyManager(otherDir);
    await otherManager.generateKeypair();
    const otherKeypair = (await otherManager.loadKeypair())!;

    // Pass both keys — the original should still verify
    const result = await verifyVCJWT(jwt, [otherKeypair.publicKey, publicKey]);

    expect(result.valid).toBe(true);
  });

  test("verifyVCJWT returns valid=false with reason=schema_invalid for non-JWT string", async () => {
    const { publicKey } = await setup();

    const result = await verifyVCJWT("not-a-jwt", [publicKey]);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("schema_invalid");
  });

  test("verifyVCJWT extracts issuer name from vc.issuer", async () => {
    const { keyManager, input, publicKey } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const result = await verifyVCJWT(jwt, [publicKey]);

    expect(result.valid).toBe(true);
    expect(result.signedBy).toBeDefined();
  });
});
