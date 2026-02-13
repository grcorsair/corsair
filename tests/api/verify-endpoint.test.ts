/**
 * Verify Endpoint Tests — TDD Red Phase
 *
 * Tests the hardened v1 verify endpoint in isolation:
 * valid CPOE, invalid JWT, expired CPOE, trust tier detection,
 * provenance extraction, processProvenance extraction.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { importPKCS8, SignJWT } from "jose";
import { createV1VerifyHandler } from "../../src/api/router";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import type { APIEnvelope, V1VerifyResponse } from "../../src/api/types";

// =============================================================================
// SETUP
// =============================================================================

const tmpDir = join(import.meta.dir, ".tmp-verify-endpoint");
let keyManager: MarqueKeyManager;
let handler: (req: Request) => Promise<Response>;
let testJWT: string;
let expiredJWT: string;

const TEST_DOMAIN = "test.grcorsair.com";

beforeAll(async () => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  keyManager = new MarqueKeyManager(join(tmpDir, "keys"));
  const keypair = await keyManager.generateKeypair();
  handler = createV1VerifyHandler({ keyManager });

  const privateKey = await importPKCS8(keypair.privateKey.toString(), "EdDSA");

  // Valid test JWT
  testJWT = await new SignJWT({
    vc: {
      "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/cpoe/v1"],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: `did:web:${TEST_DOMAIN}`, name: "Test Issuer" },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      credentialSubject: {
        type: "CorsairCPOE",
        scope: "SOC 2 Type II - Test Infrastructure",
        assurance: { declared: 1, verified: true, method: "automated-config-check", breakdown: { "1": 5 } },
        provenance: { source: "tool", sourceIdentity: "Prowler v3.1", sourceDate: "2026-02-10" },
        summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
        processProvenance: {
          chainDigest: "abc123",
          receiptCount: 3,
          chainVerified: true,
          reproducibleSteps: 2,
          attestedSteps: 1,
        },
      },
    },
    parley: "2.0",
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid: `did:web:${TEST_DOMAIN}#key-1` })
    .setIssuedAt()
    .setIssuer(`did:web:${TEST_DOMAIN}`)
    .setSubject("marque-test-verify")
    .setJti("marque-test-verify")
    .setExpirationTime(new Date(Date.now() + 7 * 86400000))
    .sign(privateKey);

  // Expired test JWT
  expiredJWT = await new SignJWT({
    vc: {
      "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/cpoe/v1"],
      type: ["VerifiableCredential", "CorsairCPOE"],
      credentialSubject: {
        type: "CorsairCPOE",
        scope: "Expired test",
        assurance: { declared: 0, verified: true, method: "self-assessed", breakdown: { "0": 1 } },
        provenance: { source: "self" },
        summary: { controlsTested: 1, controlsPassed: 1, controlsFailed: 0, overallScore: 100 },
      },
    },
    parley: "2.0",
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid: `did:web:${TEST_DOMAIN}#key-1` })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 86400)
    .setIssuer(`did:web:${TEST_DOMAIN}`)
    .setSubject("marque-expired")
    .setJti("marque-expired")
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(privateKey);
});

afterAll(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

// =============================================================================
// HELPERS
// =============================================================================

function postVerify(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/v1/verify", {
    method: "POST",
    headers: { "content-type": contentType },
    body: contentType.includes("json") ? JSON.stringify(body) : String(body),
  });
}

// =============================================================================
// VALID CPOE VERIFICATION
// =============================================================================

describe("V1 Verify — Valid CPOE", () => {
  test("returns valid=true for properly signed CPOE", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    expect(res.status).toBe(200);

    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data?.valid).toBe(true);
  });

  test("extracts issuer from CPOE", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.data?.issuer).toBeTruthy();
  });

  test("extracts trust tier", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    // Self-signed since it's not did:web:grcorsair.com
    expect(body.data?.trustTier).toBe("self-signed");
  });

  test("extracts scope", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.data?.scope).toBe("SOC 2 Type II - Test Infrastructure");
  });

  test("extracts summary fields", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.data?.summary).toBeTruthy();
    expect(body.data?.summary?.controlsTested).toBe(5);
    expect(body.data?.summary?.controlsPassed).toBe(5);
    expect(body.data?.summary?.controlsFailed).toBe(0);
    expect(body.data?.summary?.overallScore).toBe(100);
  });

  test("extracts provenance fields", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.data?.provenance).toBeTruthy();
    expect(body.data?.provenance?.source).toBe("tool");
    expect(body.data?.provenance?.sourceIdentity).toBe("Prowler v3.1");
  });

  test("extracts assurance level", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.data?.assurance).toBeTruthy();
    expect(body.data?.assurance?.level).toBe(1);
  });

  test("extracts timestamps", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.data?.timestamps.issuedAt).toBeTruthy();
    expect(body.data?.timestamps.expiresAt).toBeTruthy();
  });

  test("extracts processProvenance", async () => {
    const res = await handler(postVerify({ cpoe: testJWT }));
    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.data?.processProvenance).toBeTruthy();
    expect(body.data?.processProvenance?.chainDigest).toBe("abc123");
    expect(body.data?.processProvenance?.receiptCount).toBe(3);
    expect(body.data?.processProvenance?.chainVerified).toBe(true);
  });
});

// =============================================================================
// INVALID INPUT
// =============================================================================

describe("V1 Verify — Invalid Input", () => {
  test("rejects empty body", async () => {
    const res = await handler(postVerify({}));
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
  });

  test("rejects missing cpoe field", async () => {
    const res = await handler(postVerify({ token: "eyJ..." }));
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
    expect(body.error?.message).toContain("cpoe");
  });

  test("rejects non-string cpoe", async () => {
    const res = await handler(postVerify({ cpoe: 12345 }));
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
  });

  test("rejects empty string cpoe", async () => {
    const res = await handler(postVerify({ cpoe: "" }));
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
  });

  test("rejects malformed JWT (not 3 segments)", async () => {
    const res = await handler(postVerify({ cpoe: "only.two" }));
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("validation_error");
    expect(body.error?.message).toContain("three");
  });

  test("rejects oversized JWT (>20KB)", async () => {
    const bigJwt = "eyJ" + "a".repeat(25_000) + ".payload.sig";
    const res = await handler(postVerify({ cpoe: bigJwt }));
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("payload_too_large");
  });

  test("rejects invalid JSON body", async () => {
    const req = new Request("http://localhost/v1/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not valid json{{{",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("bad_request");
  });

  test("rejects GET method", async () => {
    const req = new Request("http://localhost/v1/verify", { method: "GET" });
    const res = await handler(req);
    expect(res.status).toBe(405);

    const body: APIEnvelope = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("method_not_allowed");
  });
});

// =============================================================================
// EXPIRED CPOE
// =============================================================================

describe("V1 Verify — Expired CPOE", () => {
  test("returns valid=false with reason=expired", async () => {
    const res = await handler(postVerify({ cpoe: expiredJWT }));
    expect(res.status).toBe(200);

    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data?.valid).toBe(false);
    expect(body.data?.reason).toBe("expired");
  });
});

// =============================================================================
// SIGNATURE MISMATCH
// =============================================================================

describe("V1 Verify — Signature Mismatch", () => {
  test("returns valid=false for JWT signed by unknown key", async () => {
    // Create a JWT signed by a different key
    const otherKeyManager = new MarqueKeyManager(join(tmpDir, "other-keys"));
    const otherKeypair = await otherKeyManager.generateKeypair();
    const otherPrivateKey = await importPKCS8(otherKeypair.privateKey.toString(), "EdDSA");

    const foreignJWT = await new SignJWT({
      vc: {
        "@context": ["https://www.w3.org/ns/credentials/v2", "https://grcorsair.com/credentials/cpoe/v1"],
        type: ["VerifiableCredential", "CorsairCPOE"],
        credentialSubject: {
          type: "CorsairCPOE",
          scope: "Foreign",
          provenance: { source: "self" },
          summary: { controlsTested: 1, controlsPassed: 1, controlsFailed: 0, overallScore: 100 },
        },
      },
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid: `did:web:other.com#key-1` })
      .setIssuedAt()
      .setIssuer("did:web:other.com")
      .setSubject("marque-foreign")
      .setJti("marque-foreign")
      .setExpirationTime(new Date(Date.now() + 86400000))
      .sign(otherPrivateKey);

    const res = await handler(postVerify({ cpoe: foreignJWT }));
    expect(res.status).toBe(200);

    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data?.valid).toBe(false);
  });
});

// =============================================================================
// RAW TEXT INPUT
// =============================================================================

describe("V1 Verify — Raw Text Input", () => {
  test("accepts raw JWT string with text/plain content-type", async () => {
    const req = new Request("http://localhost/v1/verify", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: testJWT,
    });
    const res = await handler(req);
    expect(res.status).toBe(200);

    const body: APIEnvelope<V1VerifyResponse> = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data?.valid).toBe(true);
  });

  test("rejects empty raw text", async () => {
    const req = new Request("http://localhost/v1/verify", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "  ",
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });
});
