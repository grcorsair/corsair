/**
 * VC Generator Test Contract
 *
 * Tests JWT-VC generation from MarqueGeneratorInput using jose/EdDSA.
 * Validates JWT structure, headers, payload, sanitization, and signing.
 */

import { describe, test, expect, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as jose from "jose";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import { generateVCJWT } from "../../src/parley/vc-generator";
import type { MarqueGeneratorInput } from "../../src/parley/marque-generator";
import type { MarkResult, RaidResult, ChartResult } from "../../src/types";
import { VC_CONTEXT, CORSAIR_CONTEXT } from "../../src/parley/vc-types";
import { EvidenceEngine } from "../../src/evidence";

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-vc-gen-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
          { controlId: "IA-5", controlName: "Authenticator Management", status: "failed" },
        ],
      },
    },
  };
}

describe("VC Generator - JWT-VC Generation", () => {
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

  async function setup(options?: { expiryDays?: number }): Promise<{
    keyManager: MarqueKeyManager;
    input: MarqueGeneratorInput;
    keyDir: string;
  }> {
    const keyDir = trackDir(createTestDir());
    const keyManager = new MarqueKeyManager(keyDir);
    await keyManager.generateKeypair();

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

    return { keyManager, input, keyDir };
  }

  test("generateVCJWT returns a valid JWT string with 3 parts", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    expect(typeof jwt).toBe("string");
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
  });

  test("JWT header has alg=EdDSA, typ=vc+jwt", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const header = jose.decodeProtectedHeader(jwt);
    expect(header.alg).toBe("EdDSA");
    expect(header.typ).toBe("vc+jwt");
  });

  test("JWT header kid contains did:web", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const header = jose.decodeProtectedHeader(jwt);
    expect(header.kid).toContain("did:web:");
  });

  test("JWT payload contains vc claim with @context and type", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const payload = jose.decodeJwt(jwt);
    expect(payload.vc).toBeDefined();
    const vc = payload.vc as Record<string, unknown>;
    expect(vc["@context"]).toContain(VC_CONTEXT);
    expect(vc["@context"]).toContain(CORSAIR_CONTEXT);
    expect(vc["type"]).toContain("VerifiableCredential");
    expect(vc["type"]).toContain("CorsairCPOE");
  });

  test("JWT payload has standard registered claims (iss, sub, exp, iat, jti)", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const payload = jose.decodeJwt(jwt);
    expect(payload.iss).toBe("did:web:grcorsair.com");
    expect(payload.sub).toBeDefined();
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect(payload.jti).toBeDefined();
    expect(typeof payload.exp).toBe("number");
    expect(typeof payload.iat).toBe("number");
    expect((payload.exp as number) > (payload.iat as number)).toBe(true);
  });

  test("JWT payload contains parley version 2.0", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const payload = jose.decodeJwt(jwt);
    expect(payload.parley).toBe("2.0");
  });

  test("JWT vc.credentialSubject contains CPOE assessment data", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const payload = jose.decodeJwt(jwt);
    const vc = payload.vc as Record<string, unknown>;
    const subject = vc.credentialSubject as Record<string, unknown>;

    expect(subject.type).toBe("CorsairCPOE");
    expect(subject.scope).toBeDefined();
    expect(subject.summary).toBeDefined();
    expect(subject.frameworks).toBeDefined();
    expect(subject.evidenceChain).toBeDefined();
  });

  test("JWT signature verifies with public key via jose", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager);

    const keypair = (await keyManager.loadKeypair())!;
    const publicKeyObj = await jose.importSPKI(keypair.publicKey.toString(), "EdDSA");
    const { payload } = await jose.jwtVerify(jwt, publicKeyObj);

    expect(payload.iss).toBe("did:web:grcorsair.com");
    expect(payload.parley).toBe("2.0");
  });

  test("JWT respects custom expiry days", async () => {
    const { keyManager, input } = await setup();
    const jwt = await generateVCJWT(input, keyManager, { expiryDays: 30 });

    const payload = jose.decodeJwt(jwt);
    const iat = payload.iat as number;
    const exp = payload.exp as number;
    const thirtyDaysSec = 30 * 24 * 60 * 60;

    expect(Math.abs(exp - iat - thirtyDaysSec)).toBeLessThan(5);
  });

  test("JWT credentialSubject sanitizes sensitive data (ARNs, IPs)", async () => {
    const { keyManager, input } = await setup();
    // Inject sensitive data into raid results
    input.raidResults[0].target = "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_TestPool";
    input.raidResults[0].findings = [
      "Attack from 192.168.1.100 with key AKIAIOSFODNN7EXAMPLE",
    ];

    const jwt = await generateVCJWT(input, keyManager);
    const jwtString = JSON.stringify(jose.decodeJwt(jwt));

    expect(jwtString).not.toContain("123456789012");
    expect(jwtString).not.toContain("192.168.1.100");
    expect(jwtString).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  test("generateVCJWT uses issuer.id as fallback DID when did field not set", async () => {
    const { keyManager, input } = await setup();
    input.issuer = { id: "corsair-fallback", name: "Fallback Engine" };

    const jwt = await generateVCJWT(input, keyManager);
    const payload = jose.decodeJwt(jwt);

    expect(payload.iss).toBe("corsair-fallback");
  });
});
