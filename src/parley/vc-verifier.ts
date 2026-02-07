/**
 * VC Verifier - JWT-VC Verification for Parley v2
 *
 * Verifies W3C Verifiable Credentials encoded as JWT (vc+jwt).
 * Maps verification result to MarqueVerificationResult for unified interface.
 *
 * Uses jose library for JWT verification with Ed25519 public keys.
 */

import { jwtVerify, importSPKI, decodeJwt, decodeProtectedHeader } from "jose";
import type { MarqueVerificationResult } from "./marque-verifier";
import { VC_CONTEXT } from "./vc-types";

/**
 * Verify a JWT-VC against trusted public keys.
 *
 * Checks:
 * 1. JWT structure (3 parts)
 * 2. Signature against all trusted keys
 * 3. Expiration (exp claim)
 * 4. Required VC claims (@context, type, credentialSubject)
 *
 * Returns MarqueVerificationResult for unified v1/v2 interface.
 */
export async function verifyVCJWT(
  jwt: string,
  trustedKeys: Buffer[],
): Promise<MarqueVerificationResult> {
  // Basic structure check
  if (!jwt || jwt.split(".").length !== 3) {
    return { valid: false, reason: "schema_invalid" };
  }

  // Decode payload to extract metadata (before signature check)
  let payload: Record<string, unknown>;
  try {
    payload = decodeJwt(jwt) as Record<string, unknown>;
  } catch {
    return { valid: false, reason: "schema_invalid" };
  }

  // Extract metadata for result
  const vc = payload.vc as Record<string, unknown> | undefined;
  const issuer = vc?.issuer;
  const signedBy = typeof issuer === "string"
    ? issuer
    : typeof issuer === "object" && issuer !== null
      ? (issuer as { name?: string }).name || (issuer as { id?: string }).id
      : String(payload.iss || "unknown");
  const generatedAt = payload.iat
    ? new Date((payload.iat as number) * 1000).toISOString()
    : undefined;
  const expiresAt = payload.exp
    ? new Date((payload.exp as number) * 1000).toISOString()
    : undefined;

  // Check expiration before signature (fast path)
  if (payload.exp && (payload.exp as number) * 1000 <= Date.now()) {
    return { valid: false, reason: "expired", signedBy, generatedAt, expiresAt };
  }

  // Try signature verification against all trusted keys
  for (const publicKeyPem of trustedKeys) {
    try {
      const publicKey = await importSPKI(publicKeyPem.toString(), "EdDSA");
      const { payload: verifiedPayload } = await jwtVerify(jwt, publicKey);

      // Validate required VC claims
      const verifiedVc = verifiedPayload.vc as Record<string, unknown> | undefined;
      if (!verifiedVc) {
        return { valid: false, reason: "schema_invalid", signedBy, generatedAt, expiresAt };
      }

      const context = verifiedVc["@context"] as string[] | undefined;
      if (!context || !context.includes(VC_CONTEXT)) {
        return { valid: false, reason: "schema_invalid", signedBy, generatedAt, expiresAt };
      }

      const types = verifiedVc.type as string[] | undefined;
      if (!types || !types.includes("VerifiableCredential")) {
        return { valid: false, reason: "schema_invalid", signedBy, generatedAt, expiresAt };
      }

      if (!verifiedVc.credentialSubject) {
        return { valid: false, reason: "schema_invalid", signedBy, generatedAt, expiresAt };
      }

      return { valid: true, signedBy, generatedAt, expiresAt };
    } catch {
      // Try next key
      continue;
    }
  }

  return { valid: false, reason: "signature_invalid", signedBy, generatedAt, expiresAt };
}
