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
import { verifyVCJWT, verifyVCJWTViaDID } from "../../src/parley/vc-verifier";
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

  test("verifyVCJWT returns enriched result with provenance (assurance optional)", async () => {
    const { keyManager, input, publicKey } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const result = await verifyVCJWT(jwt, [publicKey]);

    expect(result.valid).toBe(true);
    // Provenance-first model: assurance is optional (not included by default)
    expect(result.assuranceLevel).toBeUndefined();
    // Provenance is always populated
    expect(result.provenance).toBeDefined();
    expect(result.provenance!.source).toBeDefined();
    // Scope is a string
    expect(result.scope).toBeDefined();
    expect(typeof result.scope).toBe("string");
    // Summary is populated
    expect(result.summary).toBeDefined();
    expect(result.summary!.controlsTested).toBeDefined();
    // Issuer tier
    expect(result.issuerTier).toBe("corsair-verified");
  });

  test("verifyVCJWT returns assurance when enrich=true was used for signing", async () => {
    const { keyManager, input, publicKey } = await setup();
    const jwt = await generateVCJWT(input, keyManager, { enrich: true });

    const result = await verifyVCJWT(jwt, [publicKey]);

    expect(result.valid).toBe(true);
    expect(result.assuranceLevel).toBeDefined();
    expect(typeof result.assuranceLevel).toBe("number");
    expect(result.assuranceName).toBeDefined();
  });
});

describe("VC Verifier - verifyVCJWTViaDID", () => {
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

  test("verifyVCJWTViaDID returns schema_invalid for non-JWT string", async () => {
    const result = await verifyVCJWTViaDID("not-a-jwt");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("schema_invalid");
    expect(result.issuerTier).toBe("unverifiable");
  });

  test("verifyVCJWTViaDID returns schema_invalid for JWT without did:web kid", async () => {
    // Create a JWT with a non-DID kid
    const { privateKey } = await jose.generateKeyPair("EdDSA");
    const jwt = await new jose.SignJWT({ vc: {}, parley: "2.0" })
      .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid: "not-a-did" })
      .setIssuedAt()
      .setIssuer("test")
      .setExpirationTime("1h")
      .sign(privateKey);

    const result = await verifyVCJWTViaDID(jwt);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("schema_invalid");
  });

  test("verifyVCJWTViaDID resolves DID document and verifies signature with mock fetch", async () => {
    // Generate a real keypair and JWT
    const keyDir = trackDir(path.join(
      os.tmpdir(),
      `corsair-vc-did-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ));
    const keyManager = new MarqueKeyManager(keyDir);
    await keyManager.generateKeypair();

    const evidencePath = path.join(keyDir, "evidence.jsonl");
    const engine = new EvidenceEngine(evidencePath);
    await engine.plunder({
      raidId: "raid-001", target: "test", vector: "mfa-bypass",
      success: true, controlsHeld: false, findings: ["test"],
      timeline: [{ timestamp: new Date().toISOString(), action: "test", result: "done" }],
      startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
      serialized: true, durationMs: 100,
    }, evidencePath);

    const input: MarqueGeneratorInput = {
      markResults: [{ findings: [], driftDetected: false, durationMs: 0 }],
      raidResults: [],
      chartResults: [{ mitre: { technique: "T1556", name: "MFA", tactic: "CA", description: "" }, nist: { function: "P", category: "AC", controls: [] }, soc2: { principle: "S", criteria: [], description: "" }, frameworks: {} }],
      evidencePaths: [evidencePath],
      issuer: { id: "corsair-test", name: "Test Engine", did: "did:web:test.example.com" },
      providers: ["test"],
    };

    const jwt = await generateVCJWT(input, keyManager);

    // Export the public key as JWK for the mock DID document
    const keypair = (await keyManager.loadKeypair())!;
    const jwk = await keyManager.exportJWK();

    // Mock fetch that returns a DID document with the correct public key
    const mockFetchFn = async (url: string | URL | Request): Promise<Response> => {
      const didDocument = {
        "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/jws-2020/v1"],
        id: "did:web:test.example.com",
        verificationMethod: [{
          id: "did:web:test.example.com#key-1",
          type: "JsonWebKey2020",
          controller: "did:web:test.example.com",
          publicKeyJwk: jwk,
        }],
        authentication: ["did:web:test.example.com#key-1"],
        assertionMethod: ["did:web:test.example.com#key-1"],
      };

      return new Response(JSON.stringify(didDocument), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await verifyVCJWTViaDID(jwt, mockFetchFn);

    expect(result.valid).toBe(true);
    expect(result.signedBy).toBeDefined();
    expect(result.generatedAt).toBeDefined();
    expect(result.expiresAt).toBeDefined();
    // Provenance-first: assurance is optional, scope is always present
    expect(result.scope).toBeDefined();
  });

  test("verifyVCJWTViaDID returns schema_invalid when DID resolution fails", async () => {
    // Create a valid JWT with a did:web kid
    const { privateKey } = await jose.generateKeyPair("EdDSA");
    const jwt = await new jose.SignJWT({
      vc: {
        "@context": [VC_CONTEXT],
        type: ["VerifiableCredential"],
        credentialSubject: {},
      },
      parley: "2.0",
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid: "did:web:unreachable.example.com#key-1" })
      .setIssuedAt()
      .setIssuer("did:web:unreachable.example.com")
      .setExpirationTime("1h")
      .sign(privateKey);

    // Mock fetch that returns 404
    const mockFetchFn = async (): Promise<Response> => {
      return new Response("Not Found", { status: 404, statusText: "Not Found" });
    };

    const result = await verifyVCJWTViaDID(jwt, mockFetchFn);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("schema_invalid");
    expect(result.issuerTier).toBe("unverifiable");
  });
});
