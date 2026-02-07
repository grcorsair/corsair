/**
 * Postgres Key Manager — Ed25519 with AES-256-GCM Encrypted Storage
 *
 * Implements the KeyManager interface using Postgres (via Bun.sql) as
 * the backing store. Private keys are encrypted with AES-256-GCM before
 * storage, so the database never holds plaintext key material.
 *
 * Storage format for private_key_encrypted column:
 *   [IV: 12 bytes] [authTag: 16 bytes] [ciphertext: variable]
 *
 * Depends on:
 *   - Node.js crypto (Ed25519, AES-256-GCM)
 *   - jose (JWK import/export)
 *   - signing_keys table from 004_signing_keys.sql migration
 */
import * as crypto from "crypto";
import {
  exportSPKI,
  importSPKI,
  exportJWK as joseExportJWK,
  importJWK as joseImportJWK,
} from "jose";
import type { DIDDocument, VerificationMethod } from "./did-resolver";
import type { KeyManager } from "./marque-key-manager";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = "aes-256-gcm";

// =============================================================================
// ENCRYPTION HELPERS (exported for testing)
// =============================================================================

/**
 * Encrypt a private key buffer with AES-256-GCM.
 * Returns: [IV (12)] [authTag (16)] [ciphertext]
 */
export function encryptPrivateKey(
  plaintext: Buffer,
  secret: Buffer,
): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, secret, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt a private key buffer encrypted with AES-256-GCM.
 * Input format: [IV (12)] [authTag (16)] [ciphertext]
 */
export function decryptPrivateKey(
  encrypted: Buffer,
  secret: Buffer,
): Buffer {
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, secret, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// =============================================================================
// PG KEY MANAGER
// =============================================================================

export class PgKeyManager implements KeyManager {
  private db: DatabaseLike;
  private encryptionSecret: Buffer;

  constructor(db: DatabaseLike, encryptionSecret: Buffer) {
    if (encryptionSecret.length !== 32) {
      throw new Error(
        "Encryption secret must be exactly 32 bytes for AES-256-GCM",
      );
    }
    this.db = db;
    this.encryptionSecret = encryptionSecret;
  }

  /**
   * Generate a new Ed25519 keypair, encrypt the private key,
   * and store both in the signing_keys table.
   */
  async generateKeypair(): Promise<{
    publicKey: Buffer;
    privateKey: Buffer;
  }> {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const keyId = crypto.randomUUID();
    const publicKeyBuf = Buffer.from(publicKey);
    const privateKeyBuf = Buffer.from(privateKey);
    const encryptedPrivateKey = encryptPrivateKey(
      privateKeyBuf,
      this.encryptionSecret,
    );

    await this
      .db`INSERT INTO signing_keys (key_id, public_key, private_key_encrypted, algorithm) VALUES (${keyId}, ${publicKey}, ${encryptedPrivateKey}, ${"Ed25519"})`;

    return {
      publicKey: publicKeyBuf,
      privateKey: privateKeyBuf,
    };
  }

  /**
   * Load the active keypair from the database.
   * Decrypts the private key before returning.
   * Returns null if no active key exists.
   */
  async loadKeypair(): Promise<{
    publicKey: Buffer;
    privateKey: Buffer;
  } | null> {
    const rows = (await this
      .db`SELECT public_key, private_key_encrypted FROM signing_keys WHERE status = ${"active"} LIMIT 1`) as Array<{
      public_key: string;
      private_key_encrypted: Buffer;
    }>;

    if (rows.length === 0) return null;

    const row = rows[0];
    const privateKey = decryptPrivateKey(
      Buffer.from(row.private_key_encrypted),
      this.encryptionSecret,
    );

    return {
      publicKey: Buffer.from(row.public_key),
      privateKey,
    };
  }

  /**
   * Sign data using Ed25519.
   * If no privateKey is provided, loads the active key from DB.
   */
  sign(data: string, privateKey?: Buffer): string {
    if (!privateKey) {
      throw new Error(
        "PgKeyManager.sign() requires an explicit privateKey buffer. " +
          "Use loadKeypair() first to get the decrypted key.",
      );
    }

    const signature = crypto.sign(null, Buffer.from(data), {
      key: privateKey.toString(),
      format: "pem",
      type: "pkcs8",
    });

    return signature.toString("base64");
  }

  /**
   * Verify an Ed25519 signature.
   */
  verify(data: string, signature: string, publicKey: Buffer): boolean {
    try {
      return crypto.verify(
        null,
        Buffer.from(data),
        {
          key: publicKey.toString(),
          format: "pem",
          type: "spki",
        },
        Buffer.from(signature, "base64"),
      );
    } catch {
      return false;
    }
  }

  /**
   * Rotate the active key: retire current, generate new.
   */
  async rotateKey(): Promise<{
    newPublicKey: Buffer;
    retiredPublicKey: Buffer;
  }> {
    // Load current active key
    const current = await this.loadKeypair();
    if (!current) {
      throw new Error(
        "No active keypair to rotate. Generate a keypair first.",
      );
    }

    const retiredPublicKey = current.publicKey;

    // Retire the current active key
    await this
      .db`UPDATE signing_keys SET status = ${"retired"}, retired_at = ${new Date().toISOString()} WHERE status = ${"active"}`;

    // Generate new keypair
    const newKeypair = await this.generateKeypair();

    return {
      newPublicKey: newKeypair.publicKey,
      retiredPublicKey,
    };
  }

  /**
   * Get all retired public keys from the database.
   */
  async getRetiredKeys(): Promise<Buffer[]> {
    const rows = (await this
      .db`SELECT public_key FROM signing_keys WHERE status = ${"retired"} ORDER BY retired_at`) as Array<{
      public_key: string;
    }>;

    return rows.map((r) => Buffer.from(r.public_key));
  }

  /**
   * Export an Ed25519 public key as JWK.
   * If no publicKey provided, loads from DB.
   */
  async exportJWK(publicKey?: Buffer): Promise<JsonWebKey> {
    let pemKey: string;
    if (publicKey) {
      pemKey = publicKey.toString();
    } else {
      const keypair = await this.loadKeypair();
      if (!keypair) {
        throw new Error("No active key found. Generate a keypair first.");
      }
      pemKey = keypair.publicKey.toString();
    }

    const key = await importSPKI(pemKey, "EdDSA");
    return joseExportJWK(key);
  }

  /**
   * Import a JWK and return as PEM-encoded public key buffer.
   */
  async importJWK(jwk: JsonWebKey): Promise<Buffer> {
    const key = await joseImportJWK(jwk, "EdDSA");
    const pem = await exportSPKI(key as crypto.KeyObject);
    return Buffer.from(pem);
  }

  /**
   * Generate a DID Document for a given domain using the active public key.
   */
  async generateDIDDocument(domain: string): Promise<DIDDocument> {
    const jwk = await this.exportJWK();
    const did = `did:web:${domain.replace(/:/g, "%3A")}`;
    const keyId = `${did}#key-1`;

    const verificationMethod: VerificationMethod = {
      id: keyId,
      type: "JsonWebKey2020",
      controller: did,
      publicKeyJwk: jwk,
    };

    return {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/jws-2020/v1",
      ],
      id: did,
      verificationMethod: [verificationMethod],
      authentication: [keyId],
      assertionMethod: [keyId],
    };
  }
}

/**
 * Minimal DB interface for type safety and testability.
 */
interface DatabaseLike {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  begin?(fn: (tx: unknown) => Promise<void>): Promise<void>;
}
