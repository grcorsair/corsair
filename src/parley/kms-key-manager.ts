/**
 * KMS Key Manager — Cloud KMS-backed Ed25519 key management.
 *
 * Implements the KeyManager interface with keys stored in AWS KMS.
 * The private key NEVER leaves KMS — all signing happens server-side.
 *
 * Requires `@aws-sdk/client-kms` to be installed (optional dependency).
 * Only activated when KMS_KEY_ARN environment variable is set.
 *
 * Usage:
 *   KMS_KEY_ARN=arn:aws:kms:us-east-1:123456789012:key/abc-123 bun run corsair.ts ...
 */

import * as crypto from "crypto";
import type { KeyManager } from "./marque-key-manager";
import type { DIDDocument, VerificationMethod } from "./did-resolver";

export interface KMSKeyManagerConfig {
  /** KMS key ARN or alias */
  keyId: string;
  /** AWS region (default: us-east-1) */
  region?: string;
}

/**
 * KMS-backed key manager.
 *
 * All signing operations are delegated to AWS KMS.
 * The private key never leaves the HSM boundary.
 */
export class KMSKeyManager implements KeyManager {
  private keyId: string;
  private region: string;
  private kmsClient: unknown | null = null;

  constructor(config: KMSKeyManagerConfig) {
    this.keyId = config.keyId;
    this.region = config.region || "us-east-1";
  }

  /**
   * Lazy-load the AWS KMS client.
   * Throws a helpful error if @aws-sdk/client-kms is not installed.
   */
  private async getClient(): Promise<unknown> {
    if (this.kmsClient) return this.kmsClient;

    try {
      const { KMSClient } = await import("@aws-sdk/client-kms");
      this.kmsClient = new KMSClient({ region: this.region });
      return this.kmsClient;
    } catch {
      throw new Error(
        "KMS key manager requires @aws-sdk/client-kms. " +
        "Install with: bun add @aws-sdk/client-kms"
      );
    }
  }

  /**
   * Not supported — KMS keys are created via AWS Console/CLI.
   * Returns the public key from KMS GetPublicKey API.
   */
  async generateKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer }> {
    const publicKey = await this.getPublicKeyFromKMS();
    // Private key sentinel — actual key never leaves KMS
    const sentinel = Buffer.from("KMS-MANAGED-KEY");
    return { publicKey, privateKey: sentinel };
  }

  /**
   * Load the keypair. Public key fetched from KMS, private key is a sentinel.
   */
  async loadKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer } | null> {
    try {
      const publicKey = await this.getPublicKeyFromKMS();
      const sentinel = Buffer.from("KMS-MANAGED-KEY");
      return { publicKey, privateKey: sentinel };
    } catch {
      return null;
    }
  }

  /**
   * Sign data using KMS Sign API.
   * The privateKey parameter is ignored — signing happens in KMS.
   */
  sign(data: string, _privateKey?: Buffer): string {
    // KMS signing is async, but KeyManager.sign() is sync.
    // This is a limitation — callers should use signAsync() instead.
    throw new Error(
      "KMS signing is async. Use signAsync() or the MarqueGenerator pipeline " +
      "which handles async key operations."
    );
  }

  /**
   * Async sign via KMS Sign API.
   */
  async signAsync(data: string): Promise<string> {
    const client = await this.getClient() as { send(cmd: unknown): Promise<{ Signature: Uint8Array }> };
    const { SignCommand } = await import("@aws-sdk/client-kms");

    const message = Buffer.from(data);
    const command = new SignCommand({
      KeyId: this.keyId,
      Message: message,
      MessageType: "RAW",
      SigningAlgorithm: "ECDSA_SHA_256", // KMS doesn't support Ed25519 directly yet
    });

    const response = await client.send(command);
    if (!response.Signature) {
      throw new Error("KMS Sign returned no signature");
    }

    return Buffer.from(response.Signature).toString("base64");
  }

  /**
   * Verify a signature against data and public key.
   * Uses local crypto — no KMS call needed for verification.
   */
  verify(data: string, signature: string, publicKey: Buffer): boolean {
    try {
      return crypto.verify(
        null,
        Buffer.from(data),
        { key: publicKey.toString(), format: "pem", type: "spki" },
        Buffer.from(signature, "base64"),
      );
    } catch {
      return false;
    }
  }

  /**
   * Key rotation is managed via KMS key policies, not application code.
   */
  async rotateKey(): Promise<{ newPublicKey: Buffer; retiredPublicKey: Buffer }> {
    throw new Error(
      "KMS key rotation is managed via AWS KMS key policies. " +
      "Use `aws kms enable-key-rotation` or create a new key alias."
    );
  }

  /**
   * KMS doesn't support retired keys in the same way as file-based.
   * Returns an empty array — retired key management is via KMS key policies.
   */
  getRetiredKeys(): Buffer[] {
    return [];
  }

  /**
   * Export the KMS public key as JWK.
   */
  async exportJWK(publicKey?: Buffer): Promise<JsonWebKey> {
    const { importSPKI, exportJWK: joseExportJWK } = await import("jose");
    const pem = publicKey
      ? publicKey.toString()
      : (await this.getPublicKeyFromKMS()).toString();

    const key = await importSPKI(pem, "EdDSA");
    return joseExportJWK(key);
  }

  /**
   * Import a JWK and return as PEM buffer.
   */
  async importJWK(jwk: JsonWebKey): Promise<Buffer> {
    const { importJWK: joseImportJWK, exportSPKI } = await import("jose");
    const key = await joseImportJWK(jwk, "EdDSA");
    const pem = await exportSPKI(key as crypto.KeyObject);
    return Buffer.from(pem);
  }

  /**
   * Generate a DID Document using the KMS public key.
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

  /**
   * Fetch the public key from KMS via GetPublicKey API.
   */
  private async getPublicKeyFromKMS(): Promise<Buffer> {
    const client = await this.getClient() as { send(cmd: unknown): Promise<{ PublicKey: Uint8Array }> };
    const { GetPublicKeyCommand } = await import("@aws-sdk/client-kms");

    const command = new GetPublicKeyCommand({ KeyId: this.keyId });
    const response = await client.send(command);

    if (!response.PublicKey) {
      throw new Error("KMS GetPublicKey returned no key");
    }

    // KMS returns DER-encoded public key, convert to PEM
    const derKey = Buffer.from(response.PublicKey);
    const pem = `-----BEGIN PUBLIC KEY-----\n${derKey.toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;
    return Buffer.from(pem);
  }

  /**
   * Key attestation metadata for process receipts.
   */
  getKeyAttestation(): { type: string; provider: string; nonExportable: boolean } {
    return {
      type: "cloud-kms",
      provider: "aws-kms",
      nonExportable: true,
    };
  }
}
