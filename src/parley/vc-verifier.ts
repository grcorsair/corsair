/**
 * VC Verifier - JWT-VC Verification for Parley
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
 * Returns MarqueVerificationResult for unified interface.
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

      // Extract CPOE-specific fields from verified payload
      const cs = verifiedVc.credentialSubject as Record<string, unknown>;
      return {
        valid: true,
        signedBy,
        generatedAt,
        expiresAt,
        provenance: cs?.provenance as MarqueVerificationResult["provenance"],
        scope: typeof cs?.scope === "string" ? cs.scope : undefined,
        summary: cs?.summary as MarqueVerificationResult["summary"],
        extensions: cs?.extensions as Record<string, unknown> | undefined,
        issuerTier: determineIssuerTier(payload),
      };
    } catch {
      // Try next key
      continue;
    }
  }

  return { valid: false, reason: "signature_invalid", signedBy, generatedAt, expiresAt };
}

// =============================================================================
// ISSUER TIER DETERMINATION
// =============================================================================

function determineIssuerTier(payload: Record<string, unknown>): MarqueVerificationResult["issuerTier"] {
  const iss = payload.iss as string | undefined;
  if (!iss) return "unverifiable";
  if (iss.startsWith("did:web:grcorsair.com")) return "corsair-verified";
  if (iss.startsWith("did:web:")) return "self-signed";
  return "unverifiable";
}

// =============================================================================
// DID-BASED VERIFICATION
// =============================================================================

/**
 * Verify a JWT-VC by resolving the issuer's public key via DID:web.
 * Zero-trust verification path -- no pre-loaded keys needed.
 */
export async function verifyVCJWTViaDID(
  jwt: string,
  fetchFn?: typeof fetch,
): Promise<MarqueVerificationResult> {
  // 1. Basic structure check
  if (!jwt || jwt.split(".").length !== 3) {
    return { valid: false, reason: "schema_invalid", issuerTier: "unverifiable" };
  }

  // 2. Decode header to get kid
  let header;
  try {
    header = decodeProtectedHeader(jwt);
  } catch {
    return { valid: false, reason: "schema_invalid", issuerTier: "unverifiable" };
  }

  const kid = header.kid;
  if (!kid || !kid.includes("did:web:")) {
    return { valid: false, reason: "schema_invalid", issuerTier: "unverifiable" };
  }

  // 3. Extract DID from kid (format: "did:web:domain#key-1")
  const did = kid.split("#")[0];

  // 4. Resolve DID document
  const { resolveDIDDocument } = await import("./did-resolver");
  const resolution = await resolveDIDDocument(did, fetchFn);

  if (!resolution.didDocument) {
    // Decode payload for partial metadata even on failure
    let payload: Record<string, unknown> = {};
    try { payload = decodeJwt(jwt) as Record<string, unknown>; } catch { /* ignore */ }
    return {
      valid: false,
      reason: "schema_invalid",
      issuerTier: "unverifiable",
      signedBy: String(payload.iss || "unknown"),
    };
  }

  // 5. Find the verification method matching kid
  const vm = resolution.didDocument.verificationMethod.find(m => m.id === kid);
  if (!vm?.publicKeyJwk) {
    return { valid: false, reason: "signature_invalid", issuerTier: "unverifiable" };
  }

  // 6. Import JWK and verify
  const { importJWK } = await import("jose");

  try {
    const publicKey = await importJWK(vm.publicKeyJwk, "EdDSA");
    const { payload: verifiedPayload } = await jwtVerify(jwt, publicKey);
    const payload = verifiedPayload as Record<string, unknown>;

    // Extract metadata
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

    // Validate VC structure
    if (!vc) return { valid: false, reason: "schema_invalid", signedBy, issuerTier: "invalid" };

    const context = vc["@context"] as string[] | undefined;
    const vcContext = "https://www.w3.org/ns/credentials/v2";
    if (!context || !context.includes(vcContext)) {
      return { valid: false, reason: "schema_invalid", signedBy, issuerTier: "invalid" };
    }

    const types = vc.type as string[] | undefined;
    if (!types || !types.includes("VerifiableCredential")) {
      return { valid: false, reason: "schema_invalid", signedBy, issuerTier: "invalid" };
    }

    if (!vc.credentialSubject) {
      return { valid: false, reason: "schema_invalid", signedBy, issuerTier: "invalid" };
    }

    // Extract CPOE fields
    const cs = vc.credentialSubject as Record<string, unknown>;
    return {
      valid: true,
      signedBy,
      generatedAt,
      expiresAt,
      provenance: cs?.provenance as MarqueVerificationResult["provenance"],
      scope: typeof cs?.scope === "string" ? cs.scope : undefined,
      summary: cs?.summary as MarqueVerificationResult["summary"],
      extensions: cs?.extensions as Record<string, unknown> | undefined,
      issuerTier: determineIssuerTier(payload),
    };
  } catch {
    return { valid: false, reason: "signature_invalid", issuerTier: "invalid" };
  }
}
