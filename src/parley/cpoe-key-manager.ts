/**
 * CPOE Key Manager - Ed25519 Signing Infrastructure
 *
 * Manages Ed25519 keypairs for signing CPOE documents.
 * Supports key generation, storage, rotation, and retired key tracking.
 *
 * Uses Node.js built-in crypto module -- no external dependencies.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const PRIVATE_KEY_FILENAME = "corsair-signing.key";
const PUBLIC_KEY_FILENAME = "corsair-signing.pub";
const RETIRED_DIR = "retired";

export class CPOEKeyManager {
  private keyDir: string;

  constructor(keyDir?: string) {
    this.keyDir = keyDir || path.join(process.env.HOME || "~", ".corsair", "keys");
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

    fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
    fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });

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

    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      return null;
    }

    const privateKey = fs.readFileSync(privateKeyPath);
    const publicKey = fs.readFileSync(publicKeyPath);

    return {
      publicKey: Buffer.from(publicKey),
      privateKey: Buffer.from(privateKey),
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
    if (!fs.existsSync(publicKeyPath)) {
      throw new Error("No existing keypair to rotate. Generate a keypair first.");
    }

    const currentPublicKey = fs.readFileSync(publicKeyPath);

    // Ensure retired directory exists
    const retiredDir = path.join(this.keyDir, RETIRED_DIR);
    fs.mkdirSync(retiredDir, { recursive: true });

    // Move current public key to retired directory with unique identifier
    const timestamp = Date.now();
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const retiredKeyPath = path.join(retiredDir, `corsair-signing-${timestamp}-${uniqueId}.pub`);
    fs.writeFileSync(retiredKeyPath, currentPublicKey);

    // Generate new keypair (overwrites current files)
    const newKeypair = await this.generateKeypair();

    return {
      newPublicKey: newKeypair.publicKey,
      retiredPublicKey: Buffer.from(currentPublicKey),
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
}
