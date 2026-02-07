/**
 * MARQUE Key Manager Test Contract
 *
 * Validates Ed25519 key generation, storage, signing, verification,
 * and key rotation for MARQUE document signing.
 *
 * Uses os.tmpdir() for test isolation. Cleans up after tests.
 */

import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { MarqueKeyManager } from "../../src/parley/marque-key-manager";

describe("MARQUE Key Manager - Ed25519 Signing", () => {
  const testDirs: string[] = [];

  function createTestDir(): string {
    const dir = path.join(os.tmpdir(), `corsair-keys-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    testDirs.push(dir);
    return dir;
  }

  afterAll(() => {
    // Clean up all test directories
    for (const dir of testDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("generateKeypair creates Ed25519 keypair", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);

    const keypair = await manager.generateKeypair();

    expect(keypair.publicKey).toBeInstanceOf(Buffer);
    expect(keypair.privateKey).toBeInstanceOf(Buffer);
    // Ed25519 PEM keys contain identifiable markers
    expect(keypair.publicKey.toString()).toContain("PUBLIC KEY");
    expect(keypair.privateKey.toString()).toContain("PRIVATE KEY");
  });

  test("generateKeypair stores keys at specified directory", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);

    await manager.generateKeypair();

    expect(fs.existsSync(path.join(keyDir, "corsair-signing.key"))).toBe(true);
    expect(fs.existsSync(path.join(keyDir, "corsair-signing.pub"))).toBe(true);
  });

  test("loadKeypair reads existing keys", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);

    const original = await manager.generateKeypair();
    const loaded = await manager.loadKeypair();

    expect(loaded).not.toBeNull();
    expect(loaded!.publicKey.toString()).toBe(original.publicKey.toString());
    expect(loaded!.privateKey.toString()).toBe(original.privateKey.toString());
  });

  test("loadKeypair returns null when no keys exist", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);

    const loaded = await manager.loadKeypair();

    expect(loaded).toBeNull();
  });

  test("sign produces valid Ed25519 signature", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    const keypair = await manager.generateKeypair();

    const data = "test-marque-document-content";
    const signature = manager.sign(data, keypair.privateKey);

    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    // Base64 encoded signature should be non-empty
    expect(signature.length).toBeGreaterThan(0);
  });

  test("verify validates correct signature", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    const keypair = await manager.generateKeypair();

    const data = "test-marque-document-content";
    const signature = manager.sign(data, keypair.privateKey);
    const isValid = manager.verify(data, signature, keypair.publicKey);

    expect(isValid).toBe(true);
  });

  test("verify rejects tampered data", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    const keypair = await manager.generateKeypair();

    const data = "original-data";
    const signature = manager.sign(data, keypair.privateKey);
    const isValid = manager.verify("tampered-data", signature, keypair.publicKey);

    expect(isValid).toBe(false);
  });

  test("verify rejects wrong public key", async () => {
    const keyDir = createTestDir();
    const manager1 = new MarqueKeyManager(keyDir);
    const keypair1 = await manager1.generateKeypair();

    const keyDir2 = createTestDir();
    const manager2 = new MarqueKeyManager(keyDir2);
    const keypair2 = await manager2.generateKeypair();

    const data = "test-data";
    const signature = manager1.sign(data, keypair1.privateKey);
    const isValid = manager2.verify(data, signature, keypair2.publicKey);

    expect(isValid).toBe(false);
  });

  test("rotateKey generates new keypair and retires old", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    const original = await manager.generateKeypair();

    const rotation = await manager.rotateKey();

    expect(rotation.newPublicKey).toBeInstanceOf(Buffer);
    expect(rotation.retiredPublicKey).toBeInstanceOf(Buffer);
    // New key should differ from old
    expect(rotation.newPublicKey.toString()).not.toBe(rotation.retiredPublicKey.toString());
    // Retired key should match original
    expect(rotation.retiredPublicKey.toString()).toBe(original.publicKey.toString());
    // Retired directory should exist
    expect(fs.existsSync(path.join(keyDir, "retired"))).toBe(true);
  });

  test("getRetiredKeys returns list of previous public keys", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);

    await manager.generateKeypair();
    await manager.rotateKey();
    await manager.rotateKey();

    const retiredKeys = manager.getRetiredKeys();

    // Two rotations = two retired keys
    expect(retiredKeys).toHaveLength(2);
    expect(retiredKeys[0]).toBeInstanceOf(Buffer);
    expect(retiredKeys[1]).toBeInstanceOf(Buffer);
  });

  test("Retired keys can still verify old signatures", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    const original = await manager.generateKeypair();

    const data = "signed-before-rotation";
    const signature = manager.sign(data, original.privateKey);

    // Rotate key -- old key is now retired
    await manager.rotateKey();

    // The retired public key should still verify the old signature
    const retiredKeys = manager.getRetiredKeys();
    expect(retiredKeys).toHaveLength(1);

    const isValid = manager.verify(data, signature, retiredKeys[0]);
    expect(isValid).toBe(true);
  });

  test("exportJWK returns JWK with kty=OKP and crv=Ed25519", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    await manager.generateKeypair();

    const jwk = await manager.exportJWK();

    expect(jwk.kty).toBe("OKP");
    expect(jwk.crv).toBe("Ed25519");
    expect(jwk.x).toBeDefined();
    expect(typeof jwk.x).toBe("string");
  });

  test("importJWK roundtrips with exportJWK", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    const keypair = await manager.generateKeypair();

    const jwk = await manager.exportJWK(keypair.publicKey);
    const reimported = await manager.importJWK(jwk);

    expect(reimported).toBeInstanceOf(Buffer);
    expect(reimported.toString()).toContain("PUBLIC KEY");

    // Verify the reimported key can verify signatures
    const data = "roundtrip-test-data";
    const signature = manager.sign(data, keypair.privateKey);
    const isValid = manager.verify(data, signature, reimported);
    expect(isValid).toBe(true);
  });

  test("generateDIDDocument creates valid DID document for domain", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    await manager.generateKeypair();

    const didDoc = await manager.generateDIDDocument("grcorsair.com");

    expect(didDoc["@context"]).toContain("https://www.w3.org/ns/did/v1");
    expect(didDoc.id).toBe("did:web:grcorsair.com");
    expect(didDoc.verificationMethod).toHaveLength(1);
    expect(didDoc.verificationMethod[0].type).toBe("JsonWebKey2020");
    expect(didDoc.verificationMethod[0].id).toBe("did:web:grcorsair.com#key-1");
    expect(didDoc.verificationMethod[0].controller).toBe("did:web:grcorsair.com");
    expect(didDoc.verificationMethod[0].publicKeyJwk.kty).toBe("OKP");
    expect(didDoc.authentication).toContain("did:web:grcorsair.com#key-1");
    expect(didDoc.assertionMethod).toContain("did:web:grcorsair.com#key-1");
  });

  test("generateDIDDocument encodes port in DID", async () => {
    const keyDir = createTestDir();
    const manager = new MarqueKeyManager(keyDir);
    await manager.generateKeypair();

    const didDoc = await manager.generateDIDDocument("localhost:3000");

    expect(didDoc.id).toBe("did:web:localhost%3A3000");
    expect(didDoc.verificationMethod[0].id).toBe("did:web:localhost%3A3000#key-1");
  });
});
