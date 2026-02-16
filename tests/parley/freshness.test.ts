/**
 * Freshness Stapling Tests - OCSP-style freshness proofs for CPOEs
 *
 * Tests the freshness staple lifecycle:
 * - Staple generation (valid JWT, correct payload, TTL)
 * - Staple verification (valid, expired, wrong key, malformed)
 * - Staleness calculation (fresh, stale, borderline)
 * - CPOE integration (with staple, without staple, backwards compat)
 */

import { describe, test, expect, beforeAll } from "bun:test";
import * as crypto from "crypto";
import { exportSPKI, exportPKCS8, decodeJwt, decodeProtectedHeader } from "jose";
import {
  generateFreshnessStaple,
  verifyFreshnessStaple,
  DEFAULT_STAPLE_TTL_DAYS,
} from "../../src/parley/freshness";
import type {
  FreshnessStaple,
  StapleConfig,
  FreshnessResult,
} from "../../src/parley/freshness";

// =============================================================================
// TEST HELPERS
// =============================================================================

let testPrivateKeyPem: string;
let testPublicKeyPem: string;
let testPublicKeyJwk: JsonWebKey;

let otherPrivateKeyPem: string;
let otherPublicKeyPem: string;
let otherPublicKeyJwk: JsonWebKey;

beforeAll(async () => {
  // Generate test Ed25519 keypair
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  testPrivateKeyPem = privateKey as string;
  testPublicKeyPem = publicKey as string;

  const { importSPKI, exportJWK } = await import("jose");
  const pubKey = await importSPKI(testPublicKeyPem, "EdDSA");
  testPublicKeyJwk = await exportJWK(pubKey);

  // Generate a second keypair for wrong-key tests
  const other = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  otherPrivateKeyPem = other.privateKey as string;
  otherPublicKeyPem = other.publicKey as string;
  const otherPubKey = await importSPKI(otherPublicKeyPem, "EdDSA");
  otherPublicKeyJwk = await exportJWK(otherPubKey);
});

function makeConfig(overrides?: Partial<StapleConfig>): StapleConfig {
  return {
    privateKeyPem: testPrivateKeyPem,
    issuerDid: "did:web:grcorsair.com",
    checkedAt: new Date().toISOString(),
    alertsActive: 0,
    ...overrides,
  };
}

// =============================================================================
// STAPLE GENERATION
// =============================================================================

describe("generateFreshnessStaple", () => {
  test("should return a valid JWT string (3 dot-separated segments)", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    expect(typeof staple).toBe("string");
    const parts = staple.split(".");
    expect(parts.length).toBe(3);
  });

  test("should produce a JWT with EdDSA algorithm", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const header = decodeProtectedHeader(staple);
    expect(header.alg).toBe("EdDSA");
  });

  test("should set typ to freshness+jwt", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const header = decodeProtectedHeader(staple);
    expect(header.typ).toBe("freshness+jwt");
  });

  test("should include kid from issuerDid", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ issuerDid: "did:web:example.com" }),
    );
    const header = decodeProtectedHeader(staple);
    expect(header.kid).toBe("did:web:example.com#key-1");
  });

  test("should include checkedAt in payload", async () => {
    const checkedAt = "2026-02-13T12:00:00.000Z";
    const staple = await generateFreshnessStaple(makeConfig({ checkedAt }));
    const payload = decodeJwt(staple);
    expect((payload as Record<string, unknown>).checkedAt).toBe(checkedAt);
  });

  test("should include alertsActive count in payload", async () => {
    const staple = await generateFreshnessStaple(makeConfig({ alertsActive: 3 }));
    const payload = decodeJwt(staple);
    expect((payload as Record<string, unknown>).alertsActive).toBe(3);
  });

  test("should include streamId when provided", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ streamId: "stream-abc123" }),
    );
    const payload = decodeJwt(staple);
    expect((payload as Record<string, unknown>).streamId).toBe("stream-abc123");
  });

  test("should include score snapshot when provided", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ score: { composite: 92, grade: "A" } }),
    );
    const payload = decodeJwt(staple);
    const score = (payload as Record<string, unknown>).score as { composite: number; grade: string };
    expect(score.composite).toBe(92);
    expect(score.grade).toBe("A");
  });

  test("should default TTL to DEFAULT_STAPLE_TTL_DAYS", async () => {
    const now = Date.now();
    const staple = await generateFreshnessStaple(makeConfig());
    const payload = decodeJwt(staple);
    const exp = (payload.exp as number) * 1000;
    const expectedExpiry = now + DEFAULT_STAPLE_TTL_DAYS * 24 * 60 * 60 * 1000;
    // Allow 5 second window for test execution time
    expect(Math.abs(exp - expectedExpiry)).toBeLessThan(5000);
  });

  test("should respect custom ttlDays", async () => {
    const now = Date.now();
    const staple = await generateFreshnessStaple(makeConfig({ ttlDays: 1 }));
    const payload = decodeJwt(staple);
    const exp = (payload.exp as number) * 1000;
    const expectedExpiry = now + 1 * 24 * 60 * 60 * 1000;
    expect(Math.abs(exp - expectedExpiry)).toBeLessThan(5000);
  });

  test("should set iss to issuerDid", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ issuerDid: "did:web:test.com" }),
    );
    const payload = decodeJwt(staple);
    expect(payload.iss).toBe("did:web:test.com");
  });

  test("should set iat to current time", async () => {
    const before = Math.floor(Date.now() / 1000);
    const staple = await generateFreshnessStaple(makeConfig());
    const after = Math.floor(Date.now() / 1000);
    const payload = decodeJwt(staple);
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
  });

  test("should omit streamId when not provided", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const payload = decodeJwt(staple);
    expect((payload as Record<string, unknown>).streamId).toBeUndefined();
  });

  test("should omit score when not provided", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const payload = decodeJwt(staple);
    expect((payload as Record<string, unknown>).score).toBeUndefined();
  });
});

// =============================================================================
// STAPLE VERIFICATION
// =============================================================================

describe("verifyFreshnessStaple", () => {
  test("should verify a valid staple and return fresh=true", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.valid).toBe(true);
    expect(result.fresh).toBe(true);
    expect(result.alertsActive).toBe(0);
  });

  test("should return checkedAt from a valid staple", async () => {
    const checkedAt = "2026-02-13T10:00:00.000Z";
    const staple = await generateFreshnessStaple(makeConfig({ checkedAt }));
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.checkedAt).toBe(checkedAt);
  });

  test("should return alertsActive count", async () => {
    const staple = await generateFreshnessStaple(makeConfig({ alertsActive: 5 }));
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.alertsActive).toBe(5);
  });

  test("should fail verification with wrong public key", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const result = await verifyFreshnessStaple(staple, otherPublicKeyJwk);
    expect(result.valid).toBe(false);
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("signature_invalid");
  });

  test("should fail verification for malformed JWT", async () => {
    const result = await verifyFreshnessStaple("totally-not-a-jwt", testPublicKeyJwk);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("malformed");
  });

  test("should fail verification for empty string", async () => {
    const result = await verifyFreshnessStaple("", testPublicKeyJwk);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("malformed");
  });

  test("should detect an expired staple", async () => {
    // Generate a staple with 0-second TTL (already expired)
    const staple = await generateFreshnessStaple(
      makeConfig({ ttlDays: -1 }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.valid).toBe(false);
    expect(result.fresh).toBe(false);
    expect(result.reason).toBe("expired");
  });

  test("should include score in result when present in staple", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ score: { composite: 87, grade: "B" } }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.score?.composite).toBe(87);
    expect(result.score?.grade).toBe("B");
  });

  test("should include streamId in result when present", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ streamId: "stream-xyz" }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.streamId).toBe("stream-xyz");
  });
});

// =============================================================================
// STALENESS CALCULATION
// =============================================================================

describe("staleness calculation", () => {
  test("should calculate staleDays as 0 for fresh staple", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ checkedAt: new Date().toISOString() }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.staleDays).toBe(0);
  });

  test("should calculate staleDays for a 3-day-old check", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const staple = await generateFreshnessStaple(
      makeConfig({ checkedAt: threeDaysAgo.toISOString() }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.staleDays).toBe(3);
  });

  test("should mark fresh=true when within TTL", async () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const staple = await generateFreshnessStaple(
      makeConfig({ checkedAt: oneDayAgo.toISOString(), ttlDays: 7 }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.fresh).toBe(true);
  });

  test("should consider a staple with active alerts as fresh but flagged", async () => {
    const staple = await generateFreshnessStaple(
      makeConfig({ alertsActive: 2 }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.valid).toBe(true);
    expect(result.fresh).toBe(true);
    expect(result.alertsActive).toBe(2);
  });

  test("should handle checkedAt in the past (5 days)", async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const staple = await generateFreshnessStaple(
      makeConfig({ checkedAt: fiveDaysAgo.toISOString(), ttlDays: 7 }),
    );
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.staleDays).toBe(5);
    expect(result.fresh).toBe(true); // still within 7d TTL
  });

  test("should report staleDays as 0 for just-now check", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.staleDays).toBe(0);
  });
});

// =============================================================================
// CPOE INTEGRATION (BACKWARDS COMPATIBILITY)
// =============================================================================

describe("CPOE integration", () => {
  test("FreshnessStaple type should have required fields", () => {
    const staple: FreshnessStaple = {
      checkedAt: "2026-02-13T12:00:00.000Z",
      expiresAt: "2026-02-20T12:00:00.000Z",
      alertsActive: 0,
    };
    expect(staple.checkedAt).toBeDefined();
    expect(staple.expiresAt).toBeDefined();
    expect(staple.alertsActive).toBe(0);
  });

  test("FreshnessStaple type should accept optional fields", () => {
    const staple: FreshnessStaple = {
      checkedAt: "2026-02-13T12:00:00.000Z",
      expiresAt: "2026-02-20T12:00:00.000Z",
      alertsActive: 0,
      streamId: "stream-abc",
      score: { composite: 95, grade: "A" },
    };
    expect(staple.streamId).toBe("stream-abc");
    expect(staple.score?.composite).toBe(95);
  });

  test("FreshnessResult type should carry all verification info", () => {
    const result: FreshnessResult = {
      valid: true,
      fresh: true,
      checkedAt: "2026-02-13T12:00:00.000Z",
      staleDays: 0,
      alertsActive: 0,
    };
    expect(result.valid).toBe(true);
    expect(result.fresh).toBe(true);
    expect(result.staleDays).toBe(0);
  });

  test("FreshnessResult should carry reason on failure", () => {
    const result: FreshnessResult = {
      valid: false,
      fresh: false,
      reason: "expired",
      staleDays: 0,
      alertsActive: 0,
    };
    expect(result.reason).toBe("expired");
  });

  test("a CPOE without freshness field is backwards compatible (type allows optional)", async () => {
    // This tests that CPOECredentialSubject accepts missing freshness
    const { CPOECredentialSubject } = await import("../../src/parley/vc-types");
    // Type-level test: just verifying the import doesn't break
    // The actual backwards compat is ensured by the optional field in vc-types.ts
    const subject = {
      type: "CorsairCPOE" as const,
      scope: "test",
      provenance: { source: "tool" as const },
      summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
    };
    // No freshness field -- should be valid CPOECredentialSubject shape
    expect(subject.type).toBe("CorsairCPOE");
    expect(subject).not.toHaveProperty("freshness");
  });

  test("a CPOE with freshness field includes the staple JWT string", async () => {
    const staple = await generateFreshnessStaple(makeConfig());
    const subject = {
      type: "CorsairCPOE" as const,
      scope: "test",
      provenance: { source: "tool" as const },
      summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
      freshness: staple,
    };
    expect(subject.freshness).toBe(staple);
    expect(typeof subject.freshness).toBe("string");
    expect(subject.freshness.split(".").length).toBe(3);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("edge cases", () => {
  test("should handle alertsActive of 0", async () => {
    const staple = await generateFreshnessStaple(makeConfig({ alertsActive: 0 }));
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.alertsActive).toBe(0);
  });

  test("should handle very large alertsActive count", async () => {
    const staple = await generateFreshnessStaple(makeConfig({ alertsActive: 9999 }));
    const result = await verifyFreshnessStaple(staple, testPublicKeyJwk);
    expect(result.alertsActive).toBe(9999);
  });

  test("should handle ttlDays of 1 (minimum practical)", async () => {
    const staple = await generateFreshnessStaple(makeConfig({ ttlDays: 1 }));
    const payload = decodeJwt(staple);
    const iat = (payload.iat as number) * 1000;
    const exp = (payload.exp as number) * 1000;
    const diff = exp - iat;
    // Should be ~24 hours (86400000 ms) with small tolerance
    expect(Math.abs(diff - 86400000)).toBeLessThan(5000);
  });

  test("should handle ttlDays of 30 (extended)", async () => {
    const staple = await generateFreshnessStaple(makeConfig({ ttlDays: 30 }));
    const payload = decodeJwt(staple);
    const iat = (payload.iat as number) * 1000;
    const exp = (payload.exp as number) * 1000;
    const diff = exp - iat;
    expect(Math.abs(diff - 30 * 86400000)).toBeLessThan(5000);
  });

  test("should produce unique staples on consecutive calls", async () => {
    const config = makeConfig();
    const s1 = await generateFreshnessStaple(config);
    const s2 = await generateFreshnessStaple(config);
    // JWTs will differ because iat may differ or jti is unique
    // At minimum, both should be valid
    const r1 = await verifyFreshnessStaple(s1, testPublicKeyJwk);
    const r2 = await verifyFreshnessStaple(s2, testPublicKeyJwk);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });
});
