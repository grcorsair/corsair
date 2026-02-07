/**
 * Postgres Key Manager Tests — Live Postgres Integration
 *
 * Tests PgKeyManager: encryption roundtrip, key generation, rotation,
 * loading, signing/verification, and JWK/DID export against Railway Postgres.
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { SQL } from "bun";
import * as crypto from "crypto";
import {
  PgKeyManager,
  encryptPrivateKey,
  decryptPrivateKey,
} from "../../src/parley/pg-key-manager";
import type { KeyManager } from "../../src/parley/marque-key-manager";

// 32-byte encryption secret for AES-256-GCM
const encryptionSecret = crypto.createHash("sha256").update("test-encryption-secret").digest();

describe("PgKeyManager", () => {
  // ===========================================================================
  // ENCRYPTION HELPERS (no DB needed)
  // ===========================================================================

  describe("encryption helpers", () => {
    test("encryptPrivateKey returns a Buffer", () => {
      const plaintext = Buffer.from("test-private-key-data");
      const encrypted = encryptPrivateKey(plaintext, encryptionSecret);
      expect(Buffer.isBuffer(encrypted)).toBe(true);
      // IV (12) + authTag (16) + ciphertext (at least 1 byte)
      expect(encrypted.length).toBeGreaterThan(28);
    });

    test("decryptPrivateKey recovers original plaintext", () => {
      const plaintext = Buffer.from(
        "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEH\n-----END PRIVATE KEY-----",
      );
      const encrypted = encryptPrivateKey(plaintext, encryptionSecret);
      const decrypted = decryptPrivateKey(encrypted, encryptionSecret);
      expect(decrypted.toString()).toBe(plaintext.toString());
    });

    test("encryption with different secrets produces different ciphertext", () => {
      const plaintext = Buffer.from("secret-key-material");
      const secret1 = crypto.randomBytes(32);
      const secret2 = crypto.randomBytes(32);
      const encrypted1 = encryptPrivateKey(plaintext, secret1);
      const encrypted2 = encryptPrivateKey(plaintext, secret2);
      expect(encrypted1.equals(encrypted2)).toBe(false);
    });

    test("decryption with wrong secret throws", () => {
      const plaintext = Buffer.from("secret-key-material");
      const encrypted = encryptPrivateKey(plaintext, encryptionSecret);
      const wrongSecret = crypto.randomBytes(32);
      expect(() => decryptPrivateKey(encrypted, wrongSecret)).toThrow();
    });

    test("each encryption produces unique output (random IV)", () => {
      const plaintext = Buffer.from("same-data-each-time");
      const enc1 = encryptPrivateKey(plaintext, encryptionSecret);
      const enc2 = encryptPrivateKey(plaintext, encryptionSecret);
      expect(enc1.equals(enc2)).toBe(false);
    });
  });

  // ===========================================================================
  // KEY OPERATIONS AGAINST LIVE POSTGRES
  // ===========================================================================

  describe("key operations (live Postgres)", () => {
    let db: InstanceType<typeof SQL>;
    let km: PgKeyManager;

    beforeEach(async () => {
      db = new SQL({ url: process.env.DATABASE_URL });
      km = new PgKeyManager(db as never, encryptionSecret);

      // Clean signing_keys table
      await db`DELETE FROM signing_keys`;
    });

    afterEach(async () => {
      try {
        await db`DELETE FROM signing_keys`;
      } catch {}
      if (db) db.close();
    });

    test("PgKeyManager implements KeyManager interface", () => {
      expect(typeof km.generateKeypair).toBe("function");
      expect(typeof km.loadKeypair).toBe("function");
      expect(typeof km.sign).toBe("function");
      expect(typeof km.verify).toBe("function");
      expect(typeof km.rotateKey).toBe("function");
      expect(typeof km.getRetiredKeys).toBe("function");
      expect(typeof km.exportJWK).toBe("function");
      expect(typeof km.importJWK).toBe("function");
      expect(typeof km.generateDIDDocument).toBe("function");
    });

    test("generateKeypair stores encrypted key in Postgres", async () => {
      const result = await km.generateKeypair();

      expect(result.publicKey).toBeInstanceOf(Buffer);
      expect(result.privateKey).toBeInstanceOf(Buffer);
      expect(result.publicKey.toString()).toContain("BEGIN PUBLIC KEY");
      expect(result.privateKey.toString()).toContain("BEGIN PRIVATE KEY");

      // Verify key was persisted in Postgres
      const rows = await db`SELECT key_id, status, algorithm, private_key_encrypted FROM signing_keys`;
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe("active");
      expect(rows[0].algorithm).toBe("Ed25519");

      // Verify the stored private key is encrypted (BYTEA, not plaintext)
      const storedPrivate = Buffer.from(rows[0].private_key_encrypted);
      expect(storedPrivate.toString().includes("BEGIN PRIVATE KEY")).toBe(false);

      // Verify we can decrypt the stored key
      const decrypted = decryptPrivateKey(storedPrivate, encryptionSecret);
      expect(decrypted.toString()).toContain("BEGIN PRIVATE KEY");
    });

    test("loadKeypair returns the active key, decrypted", async () => {
      const generated = await km.generateKeypair();

      const loaded = await km.loadKeypair();
      expect(loaded).not.toBeNull();
      expect(loaded!.publicKey.toString()).toBe(generated.publicKey.toString());
      expect(loaded!.privateKey.toString()).toBe(generated.privateKey.toString());
    });

    test("loadKeypair returns null when no active key", async () => {
      const loaded = await km.loadKeypair();
      expect(loaded).toBeNull();
    });

    test("sign and verify roundtrip works with Postgres-stored keys", async () => {
      const { publicKey, privateKey } = await km.generateKeypair();

      const data = "test-data-for-signing-via-postgres";
      const signature = km.sign(data, privateKey);

      expect(typeof signature).toBe("string");
      expect(signature.length).toBeGreaterThan(0);

      const valid = km.verify(data, signature, publicKey);
      expect(valid).toBe(true);

      const invalid = km.verify("wrong-data", signature, publicKey);
      expect(invalid).toBe(false);
    });

    test("rotateKey retires old key and generates new one in Postgres", async () => {
      const original = await km.generateKeypair();
      const rotated = await km.rotateKey();

      expect(rotated.retiredPublicKey.toString()).toBe(original.publicKey.toString());
      expect(rotated.newPublicKey.toString()).not.toBe(original.publicKey.toString());
      expect(rotated.newPublicKey.toString()).toContain("BEGIN PUBLIC KEY");

      // Verify in Postgres: should have 2 keys (1 retired, 1 active)
      const rows = await db`SELECT key_id, status FROM signing_keys ORDER BY created_at`;
      expect(rows.length).toBe(2);
      const statuses = (rows as Array<{ status: string }>).map((r) => r.status).sort();
      expect(statuses).toEqual(["active", "retired"]);
    });

    test("rotateKey throws when no active key exists", async () => {
      await expect(km.rotateKey()).rejects.toThrow();
    });

    test("getRetiredKeys returns retired public keys from Postgres", async () => {
      await km.generateKeypair();
      await km.rotateKey();

      const retired = await km.getRetiredKeys();
      expect(retired.length).toBe(1);
      expect(retired[0].toString()).toContain("BEGIN PUBLIC KEY");
    });

    test("exportJWK returns a valid Ed25519 JWK", async () => {
      const { publicKey } = await km.generateKeypair();
      const jwk = await km.exportJWK(publicKey);

      expect(jwk.kty).toBe("OKP");
      expect(jwk.crv).toBe("Ed25519");
      expect(jwk.x).toBeDefined();
    });

    test("importJWK roundtrips with exportJWK", async () => {
      const { publicKey } = await km.generateKeypair();
      const jwk = await km.exportJWK(publicKey);
      const imported = await km.importJWK(jwk);

      const reExported = await km.exportJWK(imported);
      expect(reExported.x).toBe(jwk.x);
    });

    test("generateDIDDocument returns valid DID document from Postgres key", async () => {
      await km.generateKeypair();
      const didDoc = await km.generateDIDDocument("grcorsair.com");

      expect(didDoc.id).toBe("did:web:grcorsair.com");
      expect(didDoc["@context"]).toContain("https://www.w3.org/ns/did/v1");
      expect(didDoc.verificationMethod.length).toBe(1);
      expect(didDoc.verificationMethod[0].type).toBe("JsonWebKey2020");
      expect(didDoc.authentication).toContain("did:web:grcorsair.com#key-1");
    });

    test("unique active key constraint prevents two active keys", async () => {
      await km.generateKeypair();

      // Trying to insert a second active key should fail due to idx_one_active_key
      await expect(km.generateKeypair()).rejects.toThrow();
    });
  });
});
