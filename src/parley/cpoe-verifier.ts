/**
 * CPOE Verifier - Standalone Document Verification
 *
 * Verifies CPOE document integrity: schema, freshness, Ed25519 signature,
 * and evidence chain consistency.
 *
 * Designed to work standalone with just a public key -- no Corsair installation required.
 * Uses Node.js built-in crypto module only.
 */

import * as crypto from "crypto";
import { readFileSync } from "fs";

import type { CPOEDocument } from "./cpoe-types";
import { sortKeysDeep } from "./cpoe-generator";

// =============================================================================
// VERIFICATION RESULT
// =============================================================================

export interface CPOEVerificationResult {
  valid: boolean;
  reason?: "signature_invalid" | "expired" | "schema_invalid" | "evidence_mismatch";
  signedBy?: string;
  generatedAt?: string;
  expiresAt?: string;
}

// =============================================================================
// REQUIRED CPOE FIELDS
// =============================================================================

const REQUIRED_CPOE_FIELDS = [
  "id",
  "version",
  "issuer",
  "generatedAt",
  "expiresAt",
  "scope",
  "summary",
  "evidenceChain",
  "frameworks",
] as const;

// =============================================================================
// VERIFIER
// =============================================================================

export class CPOEVerifier {
  private trustedPublicKeys: Buffer[];

  /**
   * Create a verifier with one or more trusted public keys.
   * Include retired keys to verify documents signed before key rotation.
   */
  constructor(trustedPublicKeys: Buffer[]) {
    this.trustedPublicKeys = trustedPublicKeys;
  }

  /**
   * Verify a CPOE document.
   *
   * Checks (in order):
   * 1. Schema validation (all required fields present)
   * 2. Evidence chain integrity (chainVerified must be true)
   * 3. Freshness (expiresAt > now)
   * 4. Signature (Ed25519 verify against trusted keys)
   */
  verify(cpoe: CPOEDocument): CPOEVerificationResult {
    // Step 1: Schema validation
    if (!this.validateSchema(cpoe)) {
      return { valid: false, reason: "schema_invalid" };
    }

    // Step 2: Evidence chain integrity
    if (!cpoe.cpoe.evidenceChain.chainVerified) {
      return {
        valid: false,
        reason: "evidence_mismatch",
        signedBy: cpoe.cpoe.issuer?.name,
        generatedAt: cpoe.cpoe.generatedAt,
        expiresAt: cpoe.cpoe.expiresAt,
      };
    }

    // Step 3: Freshness check
    const now = new Date();
    const expiresAt = new Date(cpoe.cpoe.expiresAt);
    if (expiresAt <= now) {
      return {
        valid: false,
        reason: "expired",
        signedBy: cpoe.cpoe.issuer?.name,
        generatedAt: cpoe.cpoe.generatedAt,
        expiresAt: cpoe.cpoe.expiresAt,
      };
    }

    // Step 4: Signature verification
    const canonical = this.canonicalize(cpoe.cpoe);
    const signatureValid = this.verifySignature(canonical, cpoe.signature);

    if (!signatureValid) {
      return {
        valid: false,
        reason: "signature_invalid",
        signedBy: cpoe.cpoe.issuer?.name,
        generatedAt: cpoe.cpoe.generatedAt,
        expiresAt: cpoe.cpoe.expiresAt,
      };
    }

    return {
      valid: true,
      signedBy: cpoe.cpoe.issuer?.name,
      generatedAt: cpoe.cpoe.generatedAt,
      expiresAt: cpoe.cpoe.expiresAt,
    };
  }

  /**
   * Read a CPOE document from disk and verify it.
   */
  verifyFromFile(filePath: string): CPOEVerificationResult {
    const content = readFileSync(filePath, "utf-8");
    const doc: CPOEDocument = JSON.parse(content);
    return this.verify(doc);
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  /**
   * Validate that all required CPOE fields are present.
   */
  private validateSchema(doc: CPOEDocument): boolean {
    if (!doc || !doc.parley || !doc.cpoe || !doc.signature) {
      return false;
    }

    const cpoe = doc.cpoe;

    for (const field of REQUIRED_CPOE_FIELDS) {
      if (cpoe[field] === undefined || cpoe[field] === null) {
        return false;
      }
    }

    // Validate nested required structures
    if (!cpoe.issuer?.id || !cpoe.issuer?.name) {
      return false;
    }

    if (!cpoe.scope?.providers || !cpoe.scope?.frameworksCovered) {
      return false;
    }

    if (
      cpoe.summary?.controlsTested === undefined ||
      cpoe.summary?.controlsPassed === undefined ||
      cpoe.summary?.controlsFailed === undefined ||
      cpoe.summary?.overallScore === undefined
    ) {
      return false;
    }

    if (
      !cpoe.evidenceChain?.hashChainRoot ||
      cpoe.evidenceChain?.recordCount === undefined ||
      cpoe.evidenceChain?.chainVerified === undefined
    ) {
      return false;
    }

    return true;
  }

  /**
   * Canonicalize cpoe payload for signature verification.
   * Must match the generator's canonicalization.
   */
  private canonicalize(cpoe: CPOEDocument["cpoe"]): string {
    return JSON.stringify(sortKeysDeep(cpoe));
  }

  /**
   * Verify signature against all trusted public keys.
   * Returns true if any key validates the signature.
   */
  private verifySignature(data: string, signature: string): boolean {
    for (const publicKey of this.trustedPublicKeys) {
      try {
        const isValid = crypto.verify(
          null,
          Buffer.from(data),
          {
            key: publicKey.toString(),
            format: "pem",
            type: "spki",
          },
          Buffer.from(signature, "base64"),
        );
        if (isValid) {
          return true;
        }
      } catch {
        // Try next key
        continue;
      }
    }
    return false;
  }
}
