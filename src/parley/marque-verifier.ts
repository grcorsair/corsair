/**
 * MARQUE Verifier - Standalone Document Verification
 *
 * Verifies MARQUE document integrity: schema, freshness, Ed25519 signature,
 * and evidence chain consistency.
 *
 * Supports both JWT-VC string and MarqueDocument JSON formats.
 *
 * Designed to work standalone with just a public key -- no Corsair installation required.
 * Uses jose for JWT-VC, Node.js built-in crypto module for JSON envelope.
 */

import * as crypto from "crypto";
import { readFileSync } from "fs";

import type { MarqueDocument } from "./marque-types";
import { sortKeysDeep } from "./marque-generator";

// =============================================================================
// VERIFICATION RESULT
// =============================================================================

export interface MarqueVerificationResult {
  valid: boolean;
  reason?: "signature_invalid" | "expired" | "schema_invalid" | "evidence_mismatch";
  signedBy?: string;
  generatedAt?: string;
  expiresAt?: string;
}

// =============================================================================
// REQUIRED MARQUE FIELDS
// =============================================================================

const REQUIRED_MARQUE_FIELDS = [
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

export class MarqueVerifier {
  private trustedPublicKeys: Buffer[];

  /**
   * Create a verifier with one or more trusted public keys.
   * Include retired keys to verify documents signed before key rotation.
   */
  constructor(trustedPublicKeys: Buffer[]) {
    this.trustedPublicKeys = trustedPublicKeys;
  }

  /**
   * Verify a MARQUE document (JWT-VC string or MarqueDocument JSON).
   *
   * Auto-detects format:
   * - If string containing "." → JWT-VC path
   * - If MarqueDocument object → JSON envelope path
   *
   * For JSON envelope, checks (in order):
   * 1. Schema validation (all required fields present)
   * 2. Evidence chain integrity (chainVerified must be true)
   * 3. Freshness (expiresAt > now)
   * 4. Signature (Ed25519 verify against trusted keys)
   */
  async verify(input: MarqueDocument | string): Promise<MarqueVerificationResult> {
    // JWT-VC path
    if (typeof input === "string" && input.includes(".")) {
      const { verifyVCJWT } = await import("./vc-verifier");
      return verifyVCJWT(input, this.trustedPublicKeys);
    }

    // JSON envelope path
    const marque = input as MarqueDocument;
    return this.verifyJSON(marque);
  }

  /**
   * Read a MARQUE document from disk and verify it.
   * Auto-detects format: JWT string or JSON object.
   */
  async verifyFromFile(filePath: string): Promise<MarqueVerificationResult> {
    const content = readFileSync(filePath, "utf-8").trim();

    // If it looks like a JWT (starts with eyJ and has dots), treat as JWT-VC
    if (content.startsWith("eyJ") && content.split(".").length === 3) {
      return this.verify(content);
    }

    // Otherwise parse as JSON envelope
    const doc: MarqueDocument = JSON.parse(content);
    return this.verify(doc);
  }

  // ===========================================================================
  // JSON ENVELOPE VERIFICATION (internal)
  // ===========================================================================

  private verifyJSON(marque: MarqueDocument): MarqueVerificationResult {
    // Step 1: Schema validation
    if (!this.validateSchema(marque)) {
      return { valid: false, reason: "schema_invalid" };
    }

    // Step 2: Evidence chain integrity
    if (!marque.marque.evidenceChain.chainVerified) {
      return {
        valid: false,
        reason: "evidence_mismatch",
        signedBy: marque.marque.issuer?.name,
        generatedAt: marque.marque.generatedAt,
        expiresAt: marque.marque.expiresAt,
      };
    }

    // Step 3: Freshness check
    const now = new Date();
    const expiresAt = new Date(marque.marque.expiresAt);
    if (expiresAt <= now) {
      return {
        valid: false,
        reason: "expired",
        signedBy: marque.marque.issuer?.name,
        generatedAt: marque.marque.generatedAt,
        expiresAt: marque.marque.expiresAt,
      };
    }

    // Step 4: Signature verification
    const canonical = this.canonicalize(marque.marque);
    const signatureValid = this.verifySignature(canonical, marque.signature);

    if (!signatureValid) {
      return {
        valid: false,
        reason: "signature_invalid",
        signedBy: marque.marque.issuer?.name,
        generatedAt: marque.marque.generatedAt,
        expiresAt: marque.marque.expiresAt,
      };
    }

    return {
      valid: true,
      signedBy: marque.marque.issuer?.name,
      generatedAt: marque.marque.generatedAt,
      expiresAt: marque.marque.expiresAt,
    };
  }

  // ===========================================================================
  // INTERNAL
  // ===========================================================================

  /**
   * Validate that all required MARQUE fields are present.
   */
  private validateSchema(doc: MarqueDocument): boolean {
    if (!doc || !doc.parley || !doc.marque || !doc.signature) {
      return false;
    }

    const marque = doc.marque;

    for (const field of REQUIRED_MARQUE_FIELDS) {
      if (marque[field] === undefined || marque[field] === null) {
        return false;
      }
    }

    // Validate nested required structures
    if (!marque.issuer?.id || !marque.issuer?.name) {
      return false;
    }

    if (!marque.scope?.providers || !marque.scope?.frameworksCovered) {
      return false;
    }

    if (
      marque.summary?.controlsTested === undefined ||
      marque.summary?.controlsPassed === undefined ||
      marque.summary?.controlsFailed === undefined ||
      marque.summary?.overallScore === undefined
    ) {
      return false;
    }

    if (
      !marque.evidenceChain?.hashChainRoot ||
      marque.evidenceChain?.recordCount === undefined ||
      marque.evidenceChain?.chainVerified === undefined
    ) {
      return false;
    }

    return true;
  }

  /**
   * Canonicalize marque payload for signature verification.
   * Must match the generator's canonicalization.
   */
  private canonicalize(marque: MarqueDocument["marque"]): string {
    return JSON.stringify(sortKeysDeep(marque));
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
