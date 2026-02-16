/**
 * EnvKeyManager — Ed25519 key manager backed by environment variables.
 *
 * Intended for demo signing where keys are injected via env.
 * Keys must be PEM-encoded (PKCS8 private, SPKI public).
 */

import * as crypto from "crypto";
import { exportSPKI, importSPKI, exportJWK as joseExportJWK, importJWK as joseImportJWK } from "jose";
import type { DIDDocument, VerificationMethod } from "./did-resolver";
import type { KeyManager } from "./marque-key-manager";

export interface EnvKeyManagerOptions {
  publicKeyPem: string;
  privateKeyPem: string;
}

export class EnvKeyManager implements KeyManager {
  private publicKeyPem: string;
  private privateKeyPem: string;

  constructor(options: EnvKeyManagerOptions) {
    this.publicKeyPem = options.publicKeyPem.trim();
    this.privateKeyPem = options.privateKeyPem.trim();
  }

  static fromEnv(
    publicKeyVar = "CORSAIR_DEMO_PUBLIC_KEY",
    privateKeyVar = "CORSAIR_DEMO_PRIVATE_KEY",
  ): EnvKeyManager | null {
    const publicKeyPem = (Bun.env[publicKeyVar] || "").trim();
    const privateKeyPem = (Bun.env[privateKeyVar] || "").trim();
    if (!publicKeyPem || !privateKeyPem) return null;
    return new EnvKeyManager({ publicKeyPem, privateKeyPem });
  }

  async generateKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer }> {
    throw new Error("EnvKeyManager cannot generate keypairs. Provide keys via env.");
  }

  async loadKeypair(): Promise<{ publicKey: Buffer; privateKey: Buffer } | null> {
    if (!this.publicKeyPem || !this.privateKeyPem) return null;
    return {
      publicKey: Buffer.from(this.publicKeyPem),
      privateKey: Buffer.from(this.privateKeyPem),
    };
  }

  sign(data: string, privateKey?: Buffer): string {
    const keyToUse = privateKey ? privateKey.toString() : this.privateKeyPem;
    const signature = crypto.sign(null, Buffer.from(data), {
      key: keyToUse,
      format: "pem",
      type: "pkcs8",
    });
    return signature.toString("base64");
  }

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

  async rotateKey(): Promise<{ newPublicKey: Buffer; retiredPublicKey: Buffer }> {
    throw new Error("EnvKeyManager cannot rotate keys. Provide new keys via env.");
  }

  getRetiredKeys(): Buffer[] {
    return [];
  }

  async exportJWK(publicKey?: Buffer): Promise<JsonWebKey> {
    const pemKey = publicKey ? publicKey.toString() : this.publicKeyPem;
    if (!pemKey) {
      throw new Error("No public key available. Provide CORSAIR_DEMO_PUBLIC_KEY.");
    }
    const key = await importSPKI(pemKey, "EdDSA");
    return joseExportJWK(key);
  }

  async importJWK(jwk: JsonWebKey): Promise<Buffer> {
    const key = await joseImportJWK(jwk, "EdDSA");
    const pem = await exportSPKI(key as crypto.KeyObject);
    return Buffer.from(pem);
  }

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
