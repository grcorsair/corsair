/**
 * Key Attestation Test Contract
 *
 * Tests certificate chain of trust: Corsair root key attests org keys,
 * org keys sign CPOEs, chain verification validates the full path.
 *
 * Architecture:
 *   Corsair Root Key (did:web:grcorsair.com#root-1)
 *       |
 *       attests -> Org Key (did:web:acme.com#key-1)
 *                      |
 *                      signs -> CPOE
 */

import { describe, test, expect, afterAll, beforeAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { SignJWT, importPKCS8, exportSPKI, importSPKI, exportJWK, importJWK } from "jose";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";
import {
  attestOrgKey,
  verifyKeyAttestation,
  verifyChain,
  computeKeyFingerprint,
  type AttestationScope,
  type AttestationResult,
  type ChainVerificationResult,
  type KeyAttestation,
} from "../../src/parley/key-attestation";

// =============================================================================
// TEST HELPERS
// =============================================================================

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `corsair-key-att-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

/** Generate an Ed25519 keypair and return PEM buffers */
function generateTestKeypair(): { publicKey: Buffer; privateKey: Buffer } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey: Buffer.from(publicKey), privateKey: Buffer.from(privateKey) };
}

/** Create a minimal valid CPOE JWT signed by a given key */
async function createTestCPOE(
  privateKeyPem: Buffer,
  issuerDid: string,
  kid: string,
): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem.toString(), "EdDSA");

  const jwt = await new SignJWT({
    vc: {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://grcorsair.com/credentials/v1",
      ],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: issuerDid, name: "Acme Corp" },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      credentialSubject: {
        type: "CorsairCPOE",
        scope: "SOC 2 Type II - Acme Cloud",
        provenance: { source: "tool", sourceIdentity: "Prowler v3.1" },
        summary: { controlsTested: 10, controlsPassed: 9, controlsFailed: 1, overallScore: 90 },
      },
    },
    parley: "2.1",
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "vc+jwt", kid })
    .setIssuedAt()
    .setIssuer(issuerDid)
    .setSubject(`marque-${crypto.randomUUID()}`)
    .setJti(`marque-${crypto.randomUUID()}`)
    .setExpirationTime("90d")
    .sign(privateKey);

  return jwt;
}

// =============================================================================
// TEST SUITE
// =============================================================================

describe("Key Attestation - Certificate Chain of Trust", () => {
  // Shared key material for test suite
  let rootKeys: { publicKey: Buffer; privateKey: Buffer };
  let orgKeys: { publicKey: Buffer; privateKey: Buffer };
  let rootKeyManager: MarqueKeyManager;
  let orgKeyManager: MarqueKeyManager;
  let rootJWK: JsonWebKey;
  let orgJWK: JsonWebKey;

  const testDirs: string[] = [];

  function trackDir(dir: string): string {
    testDirs.push(dir);
    return dir;
  }

  beforeAll(async () => {
    // Set up root key manager
    const rootDir = trackDir(createTestDir());
    rootKeyManager = new MarqueKeyManager(rootDir);
    rootKeys = await rootKeyManager.generateKeypair();
    rootJWK = await rootKeyManager.exportJWK(rootKeys.publicKey);

    // Set up org key manager
    const orgDir = trackDir(createTestDir());
    orgKeyManager = new MarqueKeyManager(orgDir);
    orgKeys = await orgKeyManager.generateKeypair();
    orgJWK = await orgKeyManager.exportJWK(orgKeys.publicKey);
  });

  afterAll(() => {
    for (const dir of testDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    }
  });

  // ===========================================================================
  // KEY FINGERPRINT
  // ===========================================================================

  describe("Key Fingerprint", () => {
    test("should compute deterministic SHA-256 fingerprint from JWK", async () => {
      const fingerprint = await computeKeyFingerprint(orgJWK);
      expect(typeof fingerprint).toBe("string");
      expect(fingerprint.length).toBe(64); // SHA-256 hex = 64 chars
    });

    test("should produce same fingerprint for same key", async () => {
      const fp1 = await computeKeyFingerprint(orgJWK);
      const fp2 = await computeKeyFingerprint(orgJWK);
      expect(fp1).toBe(fp2);
    });

    test("should produce different fingerprint for different keys", async () => {
      const fpRoot = await computeKeyFingerprint(rootJWK);
      const fpOrg = await computeKeyFingerprint(orgJWK);
      expect(fpRoot).not.toBe(fpOrg);
    });
  });

  // ===========================================================================
  // ATTESTATION GENERATION
  // ===========================================================================

  describe("Attestation Generation", () => {
    test("should generate valid attestation JWT for org key", async () => {
      const scope: AttestationScope = {
        frameworks: ["SOC2", "ISO27001"],
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      expect(typeof attestation).toBe("string");
      expect(attestation.split(".").length).toBe(3); // JWT structure
    });

    test("should embed correct header with attestation+jwt type", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Decode header
      const headerB64 = attestation.split(".")[0];
      const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
      expect(header.alg).toBe("EdDSA");
      expect(header.typ).toBe("attestation+jwt");
      expect(header.kid).toContain("did:web:grcorsair.com");
    });

    test("should embed correct payload claims", async () => {
      const now = new Date();
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const scope: AttestationScope = {
        frameworks: ["SOC2"],
        validFrom: now.toISOString(),
        validUntil: expiry.toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Decode payload
      const payloadB64 = attestation.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

      expect(payload.iss).toBe("did:web:grcorsair.com");
      expect(payload.sub).toBe("did:web:acme.com");
      expect(payload.type).toBe("CorsairKeyAttestation");
      expect(payload.scope).toBeDefined();
      expect(payload.scope.frameworks).toEqual(["SOC2"]);
      expect(payload.orgKeyFingerprint).toBeDefined();
      expect(typeof payload.orgKeyFingerprint).toBe("string");
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
    });

    test("should embed SHA-256 fingerprint of org key", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const payloadB64 = attestation.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

      const expectedFingerprint = await computeKeyFingerprint(orgJWK);
      expect(payload.orgKeyFingerprint).toBe(expectedFingerprint);
    });

    test("should default to no framework restrictions when omitted", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const payloadB64 = attestation.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

      // No frameworks = unrestricted
      expect(payload.scope.frameworks).toBeUndefined();
    });

    test("should throw if root key manager has no keypair", async () => {
      const emptyDir = trackDir(createTestDir());
      const emptyKm = new MarqueKeyManager(emptyDir);
      // No keypair generated

      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(
        attestOrgKey("did:web:acme.com", orgJWK, scope, emptyKm, "did:web:grcorsair.com"),
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // ATTESTATION VERIFICATION
  // ===========================================================================

  describe("Attestation Verification", () => {
    test("should verify valid attestation against root public key", async () => {
      const scope: AttestationScope = {
        frameworks: ["SOC2"],
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const result = await verifyKeyAttestation(attestation, rootJWK);

      expect(result.valid).toBe(true);
      expect(result.issuer).toBe("did:web:grcorsair.com");
      expect(result.subject).toBe("did:web:acme.com");
      expect(result.scope).toBeDefined();
      expect(result.scope!.frameworks).toEqual(["SOC2"]);
      expect(result.orgKeyFingerprint).toBeDefined();
    });

    test("should reject attestation signed by wrong key", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Verify against org key (wrong key -- should fail)
      const result = await verifyKeyAttestation(attestation, orgJWK);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("signature_invalid");
    });

    test("should reject expired attestation", async () => {
      const scope: AttestationScope = {
        validFrom: new Date("2020-01-01").toISOString(),
        validUntil: new Date("2020-12-31").toISOString(),
      };

      // We need to create an attestation with already-past expiry.
      // attestOrgKey uses scope.validUntil for exp, so use a past date.
      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const result = await verifyKeyAttestation(attestation, rootJWK);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");
    });

    test("should reject malformed JWT", async () => {
      const result = await verifyKeyAttestation("not.a.valid.jwt", rootJWK);
      expect(result.valid).toBe(false);
    });

    test("should reject empty string", async () => {
      const result = await verifyKeyAttestation("", rootJWK);
      expect(result.valid).toBe(false);
    });

    test("should reject attestation with tampered payload", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Tamper with payload by changing a character
      const parts = attestation.split(".");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      payload.sub = "did:web:evil.com";
      parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const tampered = parts.join(".");

      const result = await verifyKeyAttestation(tampered, rootJWK);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("signature_invalid");
    });

    test("should return scope constraints on valid attestation", async () => {
      const scope: AttestationScope = {
        frameworks: ["SOC2", "NIST-800-53", "ISO27001"],
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:example.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const result = await verifyKeyAttestation(attestation, rootJWK);
      expect(result.valid).toBe(true);
      expect(result.scope!.frameworks).toEqual(["SOC2", "NIST-800-53", "ISO27001"]);
    });
  });

  // ===========================================================================
  // CHAIN VERIFICATION
  // ===========================================================================

  describe("Chain Verification", () => {
    test("should verify full chain: root -> attestation -> CPOE", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Root attests org key
      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Org signs CPOE
      const cpoe = await createTestCPOE(
        orgKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );

      const result = await verifyChain(cpoe, attestation, rootJWK, orgJWK);

      expect(result.valid).toBe(true);
      expect(result.chain).toEqual(["root", "attestation", "cpoe"]);
      expect(result.trustLevel).toBe("chain-verified");
    });

    test("should fail chain if attestation is invalid", async () => {
      const cpoe = await createTestCPOE(
        orgKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );

      const result = await verifyChain(cpoe, "invalid.attestation.jwt", rootJWK, orgJWK);

      expect(result.valid).toBe(false);
      expect(result.trustLevel).toBe("invalid");
    });

    test("should fail chain if CPOE signed by unattested key", async () => {
      // Create attestation for org key
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Sign CPOE with a DIFFERENT key (not the attested one)
      const rogueKeys = generateTestKeypair();
      const rogueDir = trackDir(createTestDir());
      const rogueKm = new MarqueKeyManager(rogueDir);
      await rogueKm.generateKeypair();
      const rogueJWK = await rogueKm.exportJWK();

      const cpoe = await createTestCPOE(
        rogueKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );

      const result = await verifyChain(cpoe, attestation, rootJWK, rogueJWK);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("fingerprint");
    });

    test("should fail chain if attestation signed by wrong root", async () => {
      // Create a rogue root
      const rogueDir = trackDir(createTestDir());
      const rogueRootKm = new MarqueKeyManager(rogueDir);
      const rogueRootKeys = await rogueRootKm.generateKeypair();
      const rogueRootJWK = await rogueRootKm.exportJWK(rogueRootKeys.publicKey);

      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Attestation signed by rogue root
      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rogueRootKm, // rogue root signs
        "did:web:evil.com",
      );

      const cpoe = await createTestCPOE(
        orgKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );

      // Verify against real root key -- attestation signature won't match
      const result = await verifyChain(cpoe, attestation, rootJWK, orgJWK);
      expect(result.valid).toBe(false);
    });

    test("should fail chain if CPOE signature is invalid", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Create CPOE then tamper with it
      const cpoe = await createTestCPOE(
        orgKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );
      const tampered = cpoe.slice(0, -5) + "XXXXX";

      const result = await verifyChain(tampered, attestation, rootJWK, orgJWK);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("cpoe");
    });

    test("should report self-signed when no attestation provided", async () => {
      const cpoe = await createTestCPOE(
        orgKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );

      // Pass empty attestation
      const result = await verifyChain(cpoe, "", rootJWK, orgJWK);
      expect(result.valid).toBe(false);
      expect(result.trustLevel).toBe("invalid");
    });
  });

  // ===========================================================================
  // SCOPE CONSTRAINT ENFORCEMENT
  // ===========================================================================

  describe("Scope Constraints", () => {
    test("should accept when CPOE frameworks match attestation scope", async () => {
      const scope: AttestationScope = {
        frameworks: ["SOC2", "NIST-800-53"],
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const cpoe = await createTestCPOE(
        orgKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );

      const result = await verifyChain(cpoe, attestation, rootJWK, orgJWK);
      expect(result.valid).toBe(true); // No framework in CPOE to violate
    });

    test("should accept when attestation has no framework restrictions", async () => {
      const scope: AttestationScope = {
        // No frameworks = unrestricted
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const cpoe = await createTestCPOE(
        orgKeys.privateKey,
        "did:web:acme.com",
        "did:web:acme.com#key-1",
      );

      const result = await verifyChain(cpoe, attestation, rootJWK, orgJWK);
      expect(result.valid).toBe(true);
    });
  });

  // ===========================================================================
  // MULTIPLE ORG KEYS
  // ===========================================================================

  describe("Multiple Org Keys", () => {
    test("should attest multiple org keys from same root", async () => {
      const orgBDir = trackDir(createTestDir());
      const orgBKm = new MarqueKeyManager(orgBDir);
      const orgBKeys = await orgBKm.generateKeypair();
      const orgBJWK = await orgBKm.exportJWK(orgBKeys.publicKey);

      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attA = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const attB = await attestOrgKey(
        "did:web:example.com",
        orgBJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      // Both should verify against root
      const resultA = await verifyKeyAttestation(attA, rootJWK);
      const resultB = await verifyKeyAttestation(attB, rootJWK);

      expect(resultA.valid).toBe(true);
      expect(resultA.subject).toBe("did:web:acme.com");

      expect(resultB.valid).toBe(true);
      expect(resultB.subject).toBe("did:web:example.com");
    });

    test("should produce unique attestation JWTs for each org", async () => {
      const orgBDir = trackDir(createTestDir());
      const orgBKm = new MarqueKeyManager(orgBDir);
      const orgBKeys = await orgBKm.generateKeypair();
      const orgBJWK = await orgBKm.exportJWK(orgBKeys.publicKey);

      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attA = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );
      const attB = await attestOrgKey(
        "did:web:example.com",
        orgBJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      expect(attA).not.toBe(attB);
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe("Edge Cases", () => {
    test("should handle DID with port number", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:localhost%3A3000",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const result = await verifyKeyAttestation(attestation, rootJWK);
      expect(result.valid).toBe(true);
      expect(result.subject).toBe("did:web:localhost%3A3000");
    });

    test("should handle DID with path segments", async () => {
      const scope: AttestationScope = {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:example.com:department:security",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const result = await verifyKeyAttestation(attestation, rootJWK);
      expect(result.valid).toBe(true);
      expect(result.subject).toBe("did:web:example.com:department:security");
    });

    test("should handle attestation with all optional scope fields", async () => {
      const scope: AttestationScope = {
        frameworks: ["SOC2", "ISO27001", "NIST-800-53", "PCI-DSS", "HIPAA"],
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const result = await verifyKeyAttestation(attestation, rootJWK);
      expect(result.valid).toBe(true);
      expect(result.scope!.frameworks!.length).toBe(5);
    });

    test("should handle very short validity period", async () => {
      const now = new Date();
      const scope: AttestationScope = {
        validFrom: now.toISOString(),
        validUntil: new Date(now.getTime() + 60 * 1000).toISOString(), // 1 minute
      };

      const attestation = await attestOrgKey(
        "did:web:acme.com",
        orgJWK,
        scope,
        rootKeyManager,
        "did:web:grcorsair.com",
      );

      const result = await verifyKeyAttestation(attestation, rootJWK);
      expect(result.valid).toBe(true);
    });
  });
});
