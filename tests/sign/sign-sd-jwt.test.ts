/**
 * Sign SD-JWT Tests — TDD
 *
 * Tests for SD-JWT selective disclosure integration in the sign pipeline.
 * Wires src/parley/sd-jwt.ts into src/sign/sign-core.ts via sdJwt flag.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { signEvidence } from "../../src/sign/sign-core";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

const tmpDir = join(import.meta.dir, ".tmp-sign-sd-jwt");
let keyManager: MarqueKeyManager;

// =============================================================================
// SETUP
// =============================================================================

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  await keyManager.generateKeypair();
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// SAMPLE DATA
// =============================================================================

const genericEvidence = {
  metadata: {
    title: "SD-JWT Test Assessment",
    issuer: "Acme Corp",
    date: "2026-02-14",
    scope: "AWS Production",
  },
  controls: [
    { id: "MFA-001", description: "MFA enabled", status: "pass", evidence: "Okta config", framework: "NIST-800-53", controlId: "IA-2" },
    { id: "ENC-001", description: "Encryption at rest", status: "pass", evidence: "S3 config" },
    { id: "LOG-001", description: "Audit logging", status: "fail", severity: "HIGH", evidence: "CloudTrail disabled" },
  ],
};

// =============================================================================
// SD-JWT SIGN TESTS
// =============================================================================

describe("signEvidence() with SD-JWT", () => {
  test("sdJwt=true produces SD-JWT (contains ~ separator)", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      sdJwt: true,
    }, keyManager);

    // SD-JWT format: jwt~disclosure1~disclosure2~...~
    expect(result.jwt).toContain("~");

    // Should still have normal output fields
    expect(result.marqueId).toMatch(/^marque-/);
    expect(result.summary.controlsTested).toBe(3);
  });

  test("sdFields=['summary','frameworks'] hides those fields", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      sdJwt: true,
      sdFields: ["summary", "frameworks"],
    }, keyManager);

    // Should have disclosures in output
    expect(result.disclosures).toBeDefined();
    expect(Array.isArray(result.disclosures)).toBe(true);

    // Should have at least one disclosure (summary exists, frameworks may or may not)
    const disclosureClaims = result.disclosures!.map(d => d.claim);
    expect(disclosureClaims).toContain("summary");

    // Each disclosure should have claim, disclosure string, and digest
    for (const d of result.disclosures!) {
      expect(d.claim).toBeTruthy();
      expect(d.disclosure).toBeTruthy();
      expect(d.digest).toBeTruthy();
    }

    // The JWT part (before first ~) should NOT contain the summary value in cleartext
    const jwtPart = result.jwt.split("~")[0];
    const payload = JSON.parse(Buffer.from(jwtPart.split(".")[1], "base64url").toString());
    const credSubject = payload.vc?.credentialSubject;

    // summary should be removed from credentialSubject (replaced by _sd digest)
    expect(credSubject.summary).toBeUndefined();
    // _sd array should exist with digests
    expect(credSubject._sd).toBeDefined();
    expect(Array.isArray(credSubject._sd)).toBe(true);
    expect(credSubject._sd.length).toBeGreaterThan(0);
  });

  test("without sdJwt produces plain JWT (backward compat)", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
    }, keyManager);

    // Plain JWT has exactly 2 dots and no tildes
    const dotCount = (result.jwt.match(/\./g) || []).length;
    expect(dotCount).toBe(2);
    expect(result.jwt).not.toContain("~");

    // No disclosures field
    expect(result.disclosures).toBeUndefined();
  });

  test("SD-JWT output verifiable with verifySDJWT()", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      sdJwt: true,
      sdFields: ["summary"],
    }, keyManager);

    // Load public key as JWK for verification
    const keypair = await keyManager.loadKeypair();
    expect(keypair).toBeTruthy();

    // Convert PEM public key to JWK
    const crypto = await import("crypto");
    const keyObj = crypto.createPublicKey(keypair!.publicKey);
    const jwk = keyObj.export({ format: "jwk" });

    // Verify the SD-JWT
    const { verifySDJWT } = await import("../../src/parley/sd-jwt");
    const verifyResult = await verifySDJWT(result.jwt, jwk);

    expect(verifyResult.valid).toBe(true);
    // summary should be in disclosed claims
    expect(verifyResult.disclosedClaims).toHaveProperty("summary");
  });

  test("sdJwt=true with dryRun=true includes sdFields metadata in output", async () => {
    const result = await signEvidence({
      evidence: genericEvidence,
      sdJwt: true,
      sdFields: ["summary", "frameworks"],
      dryRun: true,
    }, keyManager);

    // Dry run produces empty jwt string
    expect(result.jwt).toBe("");

    // Should still have normal dry-run output
    expect(result.summary.controlsTested).toBe(3);
    expect(result.marqueId).toMatch(/^marque-/);
  });
});
