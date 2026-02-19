/**
 * SD-JWT Selective Disclosure Tests
 *
 * Tests for IETF draft-ietf-oauth-selective-disclosure-jwt implementation.
 * Allows CPOE holders to prove specific compliance claims without revealing
 * the full assessment.
 *
 * TDD: RED phase — tests written before implementation.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import * as crypto from "crypto";
import { SignJWT, importPKCS8, importSPKI, jwtVerify, exportJWK } from "jose";
import {
  createSDJWT,
  presentSDJWT,
  verifySDJWT,
  parseSDJWT,
  createDisclosure,
  hashDisclosure,
  type SDJWTResult,
  type SDJWTVerificationResult,
} from "../../src/parley/sd-jwt";

// =============================================================================
// TEST FIXTURES
// =============================================================================

let privateKeyPem: string;
let publicKeyPem: string;
let publicKeyJwk: JsonWebKey;

beforeAll(async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  privateKeyPem = privateKey;
  publicKeyPem = publicKey;

  const spkiKey = await importSPKI(publicKeyPem, "EdDSA");
  publicKeyJwk = await exportJWK(spkiKey);
});

/** Build a representative CPOE payload for testing */
function buildTestPayload() {
  return {
    iss: "did:web:grcorsair.com",
    sub: "marque-test-001",
    jti: "marque-test-001",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    parley: "2.1" as const,
    vc: {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://grcorsair.com/credentials/v1",
      ],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: "did:web:grcorsair.com", name: "Corsair" },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
      credentialSubject: {
        type: "CorsairCPOE" as const,
        scope: "SOC 2 Type II - Cloud Infrastructure Controls",
        provenance: {
          source: "tool",
          sourceIdentity: "Scanner v1.2",
          sourceDate: "2026-01-15T00:00:00Z",
        },
        summary: {
          controlsTested: 22,
          controlsPassed: 20,
          controlsFailed: 2,
          overallScore: 91,
        },
        frameworks: {
          "SOC2": {
            controlsMapped: 14,
            passed: 12,
            failed: 2,
            controls: [
              { controlId: "CC6.1", status: "passed" },
              { controlId: "CC6.2", status: "passed" },
              { controlId: "CC6.3", status: "failed" },
            ],
          },
          "NIST-800-53": {
            controlsMapped: 8,
            passed: 8,
            failed: 0,
            controls: [
              { controlId: "AC-2", status: "passed" },
              { controlId: "AC-3", status: "passed" },
            ],
          },
        },
      },
    },
  };
}

// =============================================================================
// DISCLOSURE PRIMITIVES
// =============================================================================

describe("SD-JWT Disclosure Primitives", () => {
  test("should create a disclosure with salt, claim name, and value", () => {
    const disclosure = createDisclosure("summary", { controlsTested: 22 });
    // Disclosure is base64url encoded
    const decoded = JSON.parse(
      Buffer.from(disclosure, "base64url").toString("utf-8"),
    );
    expect(decoded).toHaveLength(3);
    expect(typeof decoded[0]).toBe("string"); // salt
    expect(decoded[0].length).toBeGreaterThanOrEqual(16); // salt has sufficient entropy
    expect(decoded[1]).toBe("summary");
    expect(decoded[2]).toEqual({ controlsTested: 22 });
  });

  test("should generate unique salt for each disclosure", () => {
    const d1 = createDisclosure("claim", "value1");
    const d2 = createDisclosure("claim", "value2");
    const parsed1 = JSON.parse(Buffer.from(d1, "base64url").toString("utf-8"));
    const parsed2 = JSON.parse(Buffer.from(d2, "base64url").toString("utf-8"));
    expect(parsed1[0]).not.toBe(parsed2[0]); // Different salts
  });

  test("should hash a disclosure using SHA-256", () => {
    const disclosure = createDisclosure("test", "value");
    const digest = hashDisclosure(disclosure);
    // SHA-256 base64url is 43 chars (32 bytes -> 43 base64url chars)
    expect(digest.length).toBe(43);
    // Deterministic: same disclosure -> same hash
    expect(hashDisclosure(disclosure)).toBe(digest);
  });

  test("should produce different hashes for different disclosures", () => {
    const d1 = createDisclosure("claim1", "value1");
    const d2 = createDisclosure("claim2", "value2");
    expect(hashDisclosure(d1)).not.toBe(hashDisclosure(d2));
  });
});

// =============================================================================
// SD-JWT ISSUANCE
// =============================================================================

describe("SD-JWT Issuance", () => {
  test("should create an SD-JWT with disclosable claims", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary", "frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    expect(result.sdJwt).toBeTruthy();
    expect(result.disclosures).toHaveLength(2);
    expect(result.sdJwt).toContain("~"); // SD-JWT separator
  });

  test("should include _sd array in JWT payload with digests", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    // Parse the JWT part (before first ~)
    const jwtPart = result.sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    // The vc.credentialSubject should contain _sd array
    expect(decodedPayload.vc.credentialSubject._sd).toBeDefined();
    expect(Array.isArray(decodedPayload.vc.credentialSubject._sd)).toBe(true);
    expect(decodedPayload.vc.credentialSubject._sd.length).toBe(1);
  });

  test("should remove disclosable claims from JWT payload", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary", "frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const jwtPart = result.sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    // Disclosable claims should NOT be in the JWT payload
    expect(decodedPayload.vc.credentialSubject.summary).toBeUndefined();
    expect(decodedPayload.vc.credentialSubject.frameworks).toBeUndefined();

    // Non-disclosable claims should remain
    expect(decodedPayload.vc.credentialSubject.type).toBe("CorsairCPOE");
    expect(decodedPayload.vc.credentialSubject.scope).toBeDefined();
    expect(decodedPayload.vc.credentialSubject.provenance).toBeDefined();
  });

  test("should produce disclosures that match _sd digests", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const jwtPart = result.sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    const sdDigests = decodedPayload.vc.credentialSubject._sd as string[];
    const disclosureDigest = hashDisclosure(result.disclosures[0].disclosure);

    expect(sdDigests).toContain(disclosureDigest);
  });

  test("should include all disclosures appended with ~ separator", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(
      payload,
      ["summary", "frameworks", "provenance"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    const parts = result.sdJwt.split("~");
    // JWT + 3 disclosures + trailing empty (spec requires trailing ~)
    expect(parts.length).toBeGreaterThanOrEqual(4);
    expect(result.disclosures).toHaveLength(3);
  });

  test("should produce a valid Ed25519 JWT signature", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const jwtPart = result.sdJwt.split("~")[0];
    const spkiKey = await importSPKI(publicKeyPem, "EdDSA");
    const { payload: verified } = await jwtVerify(jwtPart, spkiKey);
    expect(verified.iss).toBe("did:web:grcorsair.com");
  });

  test("should set _sd_alg to sha-256 in JWT payload", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const jwtPart = result.sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    expect(decodedPayload.vc.credentialSubject._sd_alg).toBe("sha-256");
  });

  test("should record claim name in each disclosure metadata", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary", "frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const claimNames = result.disclosures.map((d) => d.claim);
    expect(claimNames).toContain("summary");
    expect(claimNames).toContain("frameworks");
  });

  test("should handle zero disclosable fields as normal JWT", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, [], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    // No disclosures, no ~ separator
    expect(result.disclosures).toHaveLength(0);
    expect(result.sdJwt).not.toContain("~");

    // JWT should contain all claims normally
    const [, payloadB64] = result.sdJwt.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );
    expect(decodedPayload.vc.credentialSubject.summary).toBeDefined();
    expect(decodedPayload.vc.credentialSubject._sd).toBeUndefined();
  });

  test("should handle all credentialSubject fields as disclosable", async () => {
    const payload = buildTestPayload();
    const allFields = [
      "scope",
      "provenance",
      "summary",
      "frameworks",
    ];
    const result = await createSDJWT(payload, allFields, {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    expect(result.disclosures).toHaveLength(4);

    const jwtPart = result.sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    // Only type and _sd/_sd_alg should remain
    expect(decodedPayload.vc.credentialSubject.type).toBe("CorsairCPOE");
    expect(decodedPayload.vc.credentialSubject._sd).toHaveLength(4);
    expect(decodedPayload.vc.credentialSubject.scope).toBeUndefined();
  });

  test("should ignore disclosable fields that do not exist in payload", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(
      payload,
      ["summary", "nonExistentField"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    // Only 'summary' should be disclosed (nonExistentField ignored)
    expect(result.disclosures).toHaveLength(1);
    expect(result.disclosures[0].claim).toBe("summary");
  });
});

// =============================================================================
// SD-JWT PARSING
// =============================================================================

describe("SD-JWT Parsing", () => {
  test("should parse SD-JWT into jwt and disclosures", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary", "frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const parsed = parseSDJWT(result.sdJwt);
    expect(parsed.jwt).toBeTruthy();
    expect(parsed.jwt.split(".")).toHaveLength(3); // Valid JWT
    expect(parsed.disclosures).toHaveLength(2);
  });

  test("should parse a plain JWT (no disclosures)", () => {
    const plainJwt = "eyJhbGciOiJFZERTQSJ9.eyJpc3MiOiJ0ZXN0In0.signature";
    const parsed = parseSDJWT(plainJwt);
    expect(parsed.jwt).toBe(plainJwt);
    expect(parsed.disclosures).toHaveLength(0);
  });

  test("should handle trailing ~ separator", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    // SD-JWT spec says trailing ~ is valid
    const withTrailing = result.sdJwt.endsWith("~")
      ? result.sdJwt
      : result.sdJwt + "~";
    const parsed = parseSDJWT(withTrailing);
    expect(parsed.jwt).toBeTruthy();
    expect(parsed.disclosures.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// SD-JWT PRESENTATION
// =============================================================================

describe("SD-JWT Presentation", () => {
  test("should present with selected disclosures only", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(
      payload,
      ["summary", "frameworks", "provenance"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    // Only disclose "summary"
    const presentation = presentSDJWT(result.sdJwt, result.disclosures, [
      "summary",
    ]);

    const parsed = parseSDJWT(presentation);
    expect(parsed.disclosures).toHaveLength(1);

    // The disclosed disclosure should be the summary one
    const decoded = JSON.parse(
      Buffer.from(parsed.disclosures[0], "base64url").toString("utf-8"),
    );
    expect(decoded[1]).toBe("summary");
  });

  test("should present with no disclosures (hide everything)", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary", "frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const presentation = presentSDJWT(result.sdJwt, result.disclosures, []);
    const parsed = parseSDJWT(presentation);
    expect(parsed.disclosures).toHaveLength(0);
    // JWT should still be valid
    expect(parsed.jwt.split(".")).toHaveLength(3);
  });

  test("should present with all disclosures", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary", "frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const presentation = presentSDJWT(result.sdJwt, result.disclosures, [
      "summary",
      "frameworks",
    ]);
    const parsed = parseSDJWT(presentation);
    expect(parsed.disclosures).toHaveLength(2);
  });

  test("should preserve JWT signature when presenting", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const presentation = presentSDJWT(result.sdJwt, result.disclosures, [
      "summary",
    ]);
    const originalJwt = result.sdJwt.split("~")[0];
    const presentedJwt = parseSDJWT(presentation).jwt;
    expect(presentedJwt).toBe(originalJwt);
  });

  test("should ignore unknown claim names in disclose list", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const presentation = presentSDJWT(result.sdJwt, result.disclosures, [
      "summary",
      "nonExistent",
    ]);
    const parsed = parseSDJWT(presentation);
    // Only "summary" should be included
    expect(parsed.disclosures).toHaveLength(1);
  });
});

// =============================================================================
// SD-JWT VERIFICATION
// =============================================================================

describe("SD-JWT Verification", () => {
  test("should verify a valid SD-JWT with all disclosures", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary", "frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const verification = await verifySDJWT(result.sdJwt, publicKeyJwk);
    expect(verification.valid).toBe(true);
    expect(verification.disclosedClaims).toHaveProperty("summary");
    expect(verification.disclosedClaims).toHaveProperty("frameworks");
    expect(verification.undisclosedDigests).toHaveLength(0);
  });

  test("should verify with partial disclosures and report undisclosed", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(
      payload,
      ["summary", "frameworks", "provenance"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    // Present only "summary"
    const presentation = presentSDJWT(result.sdJwt, result.disclosures, [
      "summary",
    ]);
    const verification = await verifySDJWT(presentation, publicKeyJwk);

    expect(verification.valid).toBe(true);
    expect(verification.disclosedClaims).toHaveProperty("summary");
    expect(verification.disclosedClaims).not.toHaveProperty("frameworks");
    expect(verification.disclosedClaims).not.toHaveProperty("provenance");
    expect(verification.undisclosedDigests).toHaveLength(2);
  });

  test("should reject a tampered disclosure", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    // Tamper with the disclosure
    const tamperedDisclosure = Buffer.from(
      JSON.stringify(["fake-salt", "summary", { controlsTested: 999 }]),
    ).toString("base64url");

    const parts = result.sdJwt.split("~");
    const tamperedSdJwt = parts[0] + "~" + tamperedDisclosure + "~";

    const verification = await verifySDJWT(tamperedSdJwt, publicKeyJwk);
    expect(verification.valid).toBe(false);
    expect(verification.error).toContain("digest");
  });

  test("should reject an SD-JWT with a wrong signing key", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    // Generate a different keypair
    const { publicKey: otherPub } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const otherKey = await importSPKI(otherPub, "EdDSA");
    const otherJwk = await exportJWK(otherKey);

    const verification = await verifySDJWT(result.sdJwt, otherJwk);
    expect(verification.valid).toBe(false);
    expect(verification.error).toBeDefined();
  });

  test("should verify a plain JWT (no disclosures) as valid", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, [], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const verification = await verifySDJWT(result.sdJwt, publicKeyJwk);
    expect(verification.valid).toBe(true);
    expect(verification.disclosedClaims).toEqual({});
    expect(verification.undisclosedDigests).toHaveLength(0);
  });

  test("should report all non-sd claims in the payload", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const verification = await verifySDJWT(result.sdJwt, publicKeyJwk);
    expect(verification.valid).toBe(true);
    // The non-disclosable claims should be in the payload
    expect(verification.payload).toBeDefined();
    expect(verification.payload?.vc.credentialSubject.type).toBe(
      "CorsairCPOE",
    );
    expect(verification.payload?.vc.credentialSubject.scope).toBeDefined();
  });

  test("should reject malformed JWT in SD-JWT", async () => {
    const verification = await verifySDJWT(
      "not-a-jwt~disclosure~",
      publicKeyJwk,
    );
    expect(verification.valid).toBe(false);
    expect(verification.error).toBeDefined();
  });

  test("should reject expired JWT in SD-JWT", async () => {
    const payload = buildTestPayload();
    // Expired 1 hour ago
    payload.exp = Math.floor(Date.now() / 1000) - 3600;
    payload.iat = Math.floor(Date.now() / 1000) - 7200;

    const result = await createSDJWT(payload, ["summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const verification = await verifySDJWT(result.sdJwt, publicKeyJwk);
    expect(verification.valid).toBe(false);
  });
});

// =============================================================================
// FULL INTEGRATION: ISSUE → PRESENT → VERIFY
// =============================================================================

describe("SD-JWT Full Integration Flow", () => {
  test("issue → present summary only → verify: buyer sees score, not internals", async () => {
    const payload = buildTestPayload();

    // 1. Issuer signs with selective disclosure on all major fields
    const issued = await createSDJWT(
      payload,
      ["summary", "frameworks", "provenance"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    // 2. Holder presents only summary to the buyer
    const presentation = presentSDJWT(issued.sdJwt, issued.disclosures, [
      "summary",
    ]);

    // 3. Buyer verifies
    const verification = await verifySDJWT(presentation, publicKeyJwk);

    expect(verification.valid).toBe(true);

    // Buyer can see: summary (91% score)
    expect(verification.disclosedClaims.summary).toEqual({
      controlsTested: 22,
      controlsPassed: 20,
      controlsFailed: 2,
      overallScore: 91,
    });

    // Buyer cannot see: frameworks, provenance
    expect(verification.disclosedClaims.frameworks).toBeUndefined();
    expect(verification.disclosedClaims.provenance).toBeUndefined();

    // But buyer knows 3 claims are undisclosed (the hashes are visible)
    expect(verification.undisclosedDigests).toHaveLength(2);
  });

  test("issue → present frameworks → verify: buyer sees SOC2 results", async () => {
    const payload = buildTestPayload();

    const issued = await createSDJWT(
      payload,
      ["summary", "frameworks", "provenance"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    // Holder reveals frameworks but hides summary and provenance
    const presentation = presentSDJWT(issued.sdJwt, issued.disclosures, [
      "frameworks",
    ]);

    const verification = await verifySDJWT(presentation, publicKeyJwk);
    expect(verification.valid).toBe(true);
    expect(verification.disclosedClaims.frameworks).toBeDefined();
    expect(
      (verification.disclosedClaims.frameworks as Record<string, unknown>)[
        "SOC2"
      ],
    ).toBeDefined();
    expect(verification.undisclosedDigests).toHaveLength(2);
  });

  test("issue → present all → verify: full transparency", async () => {
    const payload = buildTestPayload();

    const issued = await createSDJWT(
      payload,
      ["summary", "frameworks", "provenance"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    // Full disclosure
    const presentation = presentSDJWT(issued.sdJwt, issued.disclosures, [
      "summary",
      "frameworks",
      "provenance",
    ]);

    const verification = await verifySDJWT(presentation, publicKeyJwk);
    expect(verification.valid).toBe(true);
    expect(verification.disclosedClaims.summary).toBeDefined();
    expect(verification.disclosedClaims.frameworks).toBeDefined();
    expect(verification.disclosedClaims.provenance).toBeDefined();
    expect(verification.undisclosedDigests).toHaveLength(0);
  });

  test("issue → present none → verify: buyer sees nothing but valid signature", async () => {
    const payload = buildTestPayload();

    const issued = await createSDJWT(
      payload,
      ["summary", "frameworks", "provenance"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    const presentation = presentSDJWT(issued.sdJwt, issued.disclosures, []);

    const verification = await verifySDJWT(presentation, publicKeyJwk);
    expect(verification.valid).toBe(true);
    expect(Object.keys(verification.disclosedClaims)).toHaveLength(0);
    expect(verification.undisclosedDigests).toHaveLength(3);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("SD-JWT Edge Cases", () => {
  test("should handle nested object values in disclosures", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["frameworks"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const verification = await verifySDJWT(result.sdJwt, publicKeyJwk);
    expect(verification.valid).toBe(true);
    expect(verification.disclosedClaims.frameworks).toEqual(
      payload.vc.credentialSubject.frameworks,
    );
  });

  test("should handle string values in disclosures", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(payload, ["scope"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const verification = await verifySDJWT(result.sdJwt, publicKeyJwk);
    expect(verification.valid).toBe(true);
    expect(verification.disclosedClaims.scope).toBe(
      "SOC 2 Type II - Cloud Infrastructure Controls",
    );
  });

  test("should never make 'type' field disclosable", async () => {
    const payload = buildTestPayload();
    // Even if requested, 'type' should be kept in the JWT (it's a discriminator)
    const result = await createSDJWT(payload, ["type", "summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    const jwtPart = result.sdJwt.split("~")[0];
    const [, payloadB64] = jwtPart.split(".");
    const decodedPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );

    // 'type' must always be present in the JWT
    expect(decodedPayload.vc.credentialSubject.type).toBe("CorsairCPOE");
    // Only 'summary' should have been made disclosable
    expect(result.disclosures).toHaveLength(1);
    expect(result.disclosures[0].claim).toBe("summary");
  });

  test("should handle duplicate claim names in disclosable list", async () => {
    const payload = buildTestPayload();
    const result = await createSDJWT(
      payload,
      ["summary", "summary", "frameworks"],
      {
        privateKeyPem,
        issuerDid: "did:web:grcorsair.com",
      },
    );

    // Should deduplicate
    expect(result.disclosures).toHaveLength(2);
  });

  test("should produce deterministic output for same input and salt", () => {
    // Disclosures with explicit salt for testing determinism
    const d1 = createDisclosure("claim", "value", "fixed-salt-for-test");
    const d2 = createDisclosure("claim", "value", "fixed-salt-for-test");
    expect(d1).toBe(d2);
    expect(hashDisclosure(d1)).toBe(hashDisclosure(d2));
  });

  test("should handle empty credentialSubject gracefully", async () => {
    const payload = buildTestPayload();
    // Remove optional fields
    delete (payload.vc.credentialSubject as Record<string, unknown>).frameworks;

    const result = await createSDJWT(payload, ["frameworks", "summary"], {
      privateKeyPem,
      issuerDid: "did:web:grcorsair.com",
    });

    // Only summary should be disclosable (frameworks doesn't exist)
    expect(result.disclosures).toHaveLength(1);
    expect(result.disclosures[0].claim).toBe("summary");
  });
});
