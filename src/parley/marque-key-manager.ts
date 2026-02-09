/**
 * MARQUE Key Manager - Ed25519 Signing Infrastructure
 *
 * Manages Ed25519 keypairs for signing MARQUE documents.
 * Supports key generation, storage, rotation, and retired key tracking.
 *
 * Uses Node.js built-in crypto module -- no external dependencies.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { exportSPKI, importSPKI, exportJWK as joseExportJWK, importJWK as joseImportJWK } from "jose";
import type { DIDDocument, VerificationMethod } from "./did-resolver";

/**
 * KeyManager Interface
 *
 * Abstraction for Ed25519 key management. Implementations may store keys
 * on disk (MarqueKeyManager) or in Postgres (PgKeyManager).
 */
export interface KeyManager {
  generateKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer }>;
  loadKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer } | null>;
  sign(data: string, privateKey?: Buffer): string;
  verify(data: string, signature: string, publicKey: Buffer): boolean;
  rotateKey(): Promise<{ newPublicKey: Buffer; retiredPublicKey: Buffer }>;
  getRetiredKeys(): Buffer[] | Promise<Buffer[]>;
  exportJWK(publicKey?: Buffer): Promise<JsonWebKey>;
  importJWK(jwk: JsonWebKey): Promise<Buffer>;
  generateDIDDocument(domain: string): Promise<DIDDocument>;
}

const PRIVATE_KEY_FILENAME = "corsair-signing.key";
const PUBLIC_KEY_FILENAME = "corsair-signing.pub";
const RETIRED_DIR = "retired";

export class MarqueKeyManager implements KeyManager {
  private keyDir: string;

  constructor(keyDir?: string) {
    this.keyDir = keyDir || path.join(Bun.env.HOME || "~", ".corsair", "keys");
  }

  /**
   * Generate a new Ed25519 keypair and store it on disk.
   * Creates the key directory if it does not exist.
   */
  async generateKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer }> {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    // Ensure directory exists
    fs.mkdirSync(this.keyDir, { recursive: true });

    // Write keys to files
    const privateKeyPath = path.join(this.keyDir, PRIVATE_KEY_FILENAME);
    const publicKeyPath = path.join(this.keyDir, PUBLIC_KEY_FILENAME);

    await Bun.write(privateKeyPath, privateKey);
    await Bun.write(publicKeyPath, publicKey);

    return {
      publicKey: Buffer.from(publicKey),
      privateKey: Buffer.from(privateKey),
    };
  }

  /**
   * Load an existing keypair from disk.
   * Returns null if the key files do not exist.
   */
  async loadKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer } | null> {
    const privateKeyPath = path.join(this.keyDir, PRIVATE_KEY_FILENAME);
    const publicKeyPath = path.join(this.keyDir, PUBLIC_KEY_FILENAME);

    if (!(await Bun.file(privateKeyPath).exists()) || !(await Bun.file(publicKeyPath).exists())) {
      return null;
    }

    const privateKeyArrayBuffer = await Bun.file(privateKeyPath).arrayBuffer();
    const publicKeyArrayBuffer = await Bun.file(publicKeyPath).arrayBuffer();

    return {
      publicKey: Buffer.from(publicKeyArrayBuffer),
      privateKey: Buffer.from(privateKeyArrayBuffer),
    };
  }

  /**
   * Sign data using Ed25519.
   * If no privateKey is provided, loads the stored private key from disk.
   * Returns a base64-encoded signature string.
   */
  sign(data: string, privateKey?: Buffer): string {
    let keyToUse: Buffer | string;

    if (privateKey) {
      keyToUse = privateKey;
    } else {
      const privateKeyPath = path.join(this.keyDir, PRIVATE_KEY_FILENAME);
      if (!fs.existsSync(privateKeyPath)) {
        throw new Error("No private key found. Generate a keypair first.");
      }
      keyToUse = fs.readFileSync(privateKeyPath);
    }

    const signature = crypto.sign(null, Buffer.from(data), {
      key: keyToUse.toString(),
      format: "pem",
      type: "pkcs8",
    });

    return signature.toString("base64");
  }

  /**
   * Verify an Ed25519 signature against data and a public key.
   * Returns true if the signature is valid, false otherwise.
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
   * Rotate the current keypair.
   * Moves the current public key to the retired directory,
   * then generates a new keypair.
   */
  async rotateKey(): Promise<{ newPublicKey: Buffer; retiredPublicKey: Buffer }> {
    // Read current public key before rotation
    const publicKeyPath = path.join(this.keyDir, PUBLIC_KEY_FILENAME);
    if (!(await Bun.file(publicKeyPath).exists())) {
      throw new Error("No existing keypair to rotate. Generate a keypair first.");
    }

    const currentPublicKeyArrayBuffer = await Bun.file(publicKeyPath).arrayBuffer();
    const currentPublicKey = Buffer.from(currentPublicKeyArrayBuffer);

    // Ensure retired directory exists
    const retiredDir = path.join(this.keyDir, RETIRED_DIR);
    fs.mkdirSync(retiredDir, { recursive: true });

    // Move current public key to retired directory with unique identifier
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const retiredKeyPath = path.join(retiredDir, `corsair-signing-${timestamp}-${uniqueId}.pub`);
    await Bun.write(retiredKeyPath, currentPublicKey);

    // Generate new keypair (overwrites current files)
    const newKeypair = await this.generateKeypair();

    return {
      newPublicKey: newKeypair.publicKey,
      retiredPublicKey: currentPublicKey,
    };
  }

  /**
   * Returns all retired public keys from the retired directory.
   * Keys are returned in filesystem order (typically chronological).
   */
  getRetiredKeys(): Buffer[] {
    const retiredDir = path.join(this.keyDir, RETIRED_DIR);

    if (!fs.existsSync(retiredDir)) {
      return [];
    }

    const files = fs.readdirSync(retiredDir)
      .filter((f) => f.endsWith(".pub"))
      .sort();

    return files.map((f) => Buffer.from(fs.readFileSync(path.join(retiredDir, f))));
  }

  /**
   * Export the Ed25519 public key as a JSON Web Key (JWK).
   * If no publicKey buffer is provided, loads from disk.
   */
  async exportJWK(publicKey?: Buffer): Promise<JsonWebKey> {
    let pemKey: string;
    if (publicKey) {
      pemKey = publicKey.toString();
    } else {
      const keypair = await this.loadKeypair();
      if (!keypair) {
        throw new Error("No public key found. Generate a keypair first.");
      }
      pemKey = keypair.publicKey.toString();
    }

    const key = await importSPKI(pemKey, "EdDSA");
    return joseExportJWK(key);
  }

  /**
   * Import a JWK and return it as a PEM-encoded public key buffer.
   */
  async importJWK(jwk: JsonWebKey): Promise<Buffer> {
    const key = await joseImportJWK(jwk, "EdDSA");
    const pem = await exportSPKI(key as crypto.KeyObject);
    return Buffer.from(pem);
  }

  /**
   * Generate a DID Document for a given domain using the current public key.
   * The DID Document contains the public key as a JsonWebKey2020 verification method.
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
