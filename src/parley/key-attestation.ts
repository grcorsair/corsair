/**
 * Key Attestation - Certificate Chain of Trust for Parley
 *
 * Implements PKI hierarchy for CPOE signing:
 *   Corsair Root Key (did:web:grcorsair.com#root-1)
 *       |
 *       attests -> Org Key (did:web:acme.com#key-1)
 *                      |
 *                      signs -> CPOE
 *
 * Like TLS certificate chains: browser trusts CA root -> CA signs org cert
 * -> org cert authenticates server. Here: verifier trusts Corsair root ->
 * Corsair attests org key -> org key signs CPOE.
 *
 * Attestation is a JWT (typ: "attestation+jwt") signed by root key that
 * authorizes an org key within a defined scope (frameworks, max assurance,
 * validity period).
 */

import * as crypto from "crypto";
import { SignJWT, jwtVerify, importPKCS8, importJWK as joseImportJWK, decodeJwt } from "jose";
import type { KeyManager } from "./marque-key-manager";

// =============================================================================
// TYPES
// =============================================================================

/** Scope constraints for an attested org key */
export interface AttestationScope {
  /** Frameworks this key is authorized to sign for (empty/undefined = all) */
  frameworks?: string[];

  /** Maximum assurance level this key can declare (0-4, default 4) */
  maxAssurance?: number;

  /** ISO 8601 timestamp when attestation becomes valid */
  validFrom: string;

  /** ISO 8601 timestamp when attestation expires */
  validUntil: string;
}

/** Result of attestation verification */
export interface AttestationResult {
  /** Whether the attestation signature is valid and not expired */
  valid: boolean;

  /** Issuer DID (the root authority) */
  issuer?: string;

  /** Subject DID (the attested org) */
  subject?: string;

  /** Scope constraints from the attestation */
  scope?: AttestationScope;

  /** SHA-256 fingerprint of the attested org key */
  orgKeyFingerprint?: string;

  /** Reason for failure */
  reason?: "signature_invalid" | "expired" | "malformed";
}

/** Result of full chain verification: root -> attestation -> CPOE */
export interface ChainVerificationResult {
  /** Whether the entire chain is valid */
  valid: boolean;

  /** Chain path that was verified */
  chain: string[];

  /** Trust level achieved */
  trustLevel: "chain-verified" | "self-signed" | "invalid";

  /** Reason for failure (if any) */
  reason?: string;
}

/** The attestation document shape (JWT payload) */
export interface KeyAttestation {
  /** Issuer DID (root authority) */
  iss: string;

  /** Subject DID (attested org) */
  sub: string;

  /** Attestation type discriminator */
  type: "CorsairKeyAttestation";

  /** Scope constraints */
  scope: {
    frameworks?: string[];
    maxAssurance: number;
    validFrom: string;
    validUntil: string;
  };

  /** SHA-256 fingerprint of the org's public key (JWK thumbprint) */
  orgKeyFingerprint: string;

  /** Issued at (Unix timestamp) */
  iat: number;

  /** Expiration (Unix timestamp) */
  exp: number;
}

// =============================================================================
// KEY FINGERPRINT
// =============================================================================

/**
 * Compute a deterministic SHA-256 fingerprint of a JWK.
 *
 * Uses JWK Thumbprint (RFC 7638) approach: canonical JSON of required
 * members, then SHA-256 hash. For Ed25519 (OKP/Ed25519), the required
 * members are: crv, kty, x (sorted alphabetically).
 */
export async function computeKeyFingerprint(jwk: JsonWebKey): Promise<string> {
  // RFC 7638: canonical form uses only required members, sorted
  const canonical: Record<string, unknown> = {};

  if (jwk.kty === "OKP") {
    // Ed25519 required members: crv, kty, x
    canonical.crv = jwk.crv;
    canonical.kty = jwk.kty;
    canonical.x = jwk.x;
  } else {
    // Generic fallback: kty + all public key fields
    canonical.kty = jwk.kty;
    if (jwk.crv) canonical.crv = jwk.crv;
    if (jwk.x) canonical.x = jwk.x;
    if (jwk.y) canonical.y = jwk.y;
    if (jwk.n) canonical.n = jwk.n;
    if (jwk.e) canonical.e = jwk.e;
  }

  const json = JSON.stringify(canonical);
  const hash = crypto.createHash("sha256").update(json).digest("hex");
  return hash;
}

// =============================================================================
// ATTESTATION GENERATION
// =============================================================================

/**
 * Generate a key attestation JWT.
 *
 * The root key manager signs an attestation that authorizes an org key
 * (identified by its JWK fingerprint) to sign CPOEs within defined scope.
 *
 * @param orgDID - DID of the org being attested (e.g., "did:web:acme.com")
 * @param orgPublicKey - Org's Ed25519 public key as JWK
 * @param scope - Scope constraints for the attestation
 * @param rootKeyManager - Key manager holding the root signing key
 * @param rootDID - DID of the root authority (e.g., "did:web:grcorsair.com")
 * @returns Signed attestation JWT string
 */
export async function attestOrgKey(
  orgDID: string,
  orgPublicKey: JsonWebKey,
  scope: AttestationScope,
  rootKeyManager: KeyManager,
  rootDID: string,
): Promise<string> {
  // Load root private key
  const keypair = await rootKeyManager.loadKeypair();
  if (!keypair) {
    throw new Error("No root keypair found. Generate a keypair first.");
  }

  // Compute org key fingerprint
  const fingerprint = await computeKeyFingerprint(orgPublicKey);

  // Compute expiry from scope
  const expiresAt = new Date(scope.validUntil);

  // Build scope payload (omit frameworks if not set)
  const scopePayload: Record<string, unknown> = {
    maxAssurance: scope.maxAssurance ?? 4,
    validFrom: scope.validFrom,
    validUntil: scope.validUntil,
  };
  if (scope.frameworks && scope.frameworks.length > 0) {
    scopePayload.frameworks = scope.frameworks;
  }

  const privateKey = await importPKCS8(keypair.privateKey.toString(), "EdDSA");

  const jwt = await new SignJWT({
    type: "CorsairKeyAttestation" as const,
    scope: scopePayload,
    orgKeyFingerprint: fingerprint,
  })
    .setProtectedHeader({
      alg: "EdDSA",
      typ: "attestation+jwt",
      kid: `${rootDID}#root-1`,
    })
    .setIssuedAt()
    .setIssuer(rootDID)
    .setSubject(orgDID)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  return jwt;
}

// =============================================================================
// ATTESTATION VERIFICATION
// =============================================================================

/**
 * Verify a key attestation JWT against a root public key.
 *
 * Checks:
 * 1. JWT structure
 * 2. Ed25519 signature against root key
 * 3. Expiration
 * 4. Required attestation claims
 *
 * @param attestation - The attestation JWT string
 * @param rootPublicKeyJWK - Root authority's public key as JWK
 * @returns Verification result with scope constraints
 */
export async function verifyKeyAttestation(
  attestation: string,
  rootPublicKeyJWK: JsonWebKey,
): Promise<AttestationResult> {
  // Basic structure check
  if (!attestation || attestation.split(".").length !== 3) {
    return { valid: false, reason: "malformed" };
  }

  // Import root public key
  let rootKey;
  try {
    rootKey = await joseImportJWK(rootPublicKeyJWK, "EdDSA");
  } catch {
    return { valid: false, reason: "malformed" };
  }

  // Verify signature and expiry
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(attestation, rootKey);
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    // Distinguish expired from bad signature
    const message = (err as Error).message || "";
    if (message.includes("exp") || message.includes("expired") || message.includes("timestamp")) {
      return { valid: false, reason: "expired" };
    }
    return { valid: false, reason: "signature_invalid" };
  }

  // Extract claims
  const issuer = payload.iss as string | undefined;
  const subject = payload.sub as string | undefined;
  const type = payload.type as string | undefined;
  const scopeRaw = payload.scope as Record<string, unknown> | undefined;
  const fingerprint = payload.orgKeyFingerprint as string | undefined;

  // Validate required claims
  if (type !== "CorsairKeyAttestation" || !scopeRaw || !fingerprint) {
    return { valid: false, reason: "malformed" };
  }

  const scope: AttestationScope = {
    frameworks: scopeRaw.frameworks as string[] | undefined,
    maxAssurance: scopeRaw.maxAssurance as number | undefined,
    validFrom: scopeRaw.validFrom as string,
    validUntil: scopeRaw.validUntil as string,
  };

  return {
    valid: true,
    issuer,
    subject,
    scope,
    orgKeyFingerprint: fingerprint,
  };
}

// =============================================================================
// CHAIN VERIFICATION
// =============================================================================

/**
 * Verify the full certificate chain: root -> attestation -> CPOE.
 *
 * Steps:
 * 1. Verify attestation signature against root public key
 * 2. Verify CPOE signature against org public key
 * 3. Verify org key fingerprint matches attestation
 * 4. Verify scope constraints (maxAssurance, frameworks)
 *
 * @param cpoe - The CPOE JWT string
 * @param attestation - The attestation JWT string
 * @param rootPublicKeyJWK - Root authority's public key as JWK
 * @param orgPublicKeyJWK - Org's public key as JWK (to verify CPOE signature and match fingerprint)
 * @returns Chain verification result
 */
export async function verifyChain(
  cpoe: string,
  attestation: string,
  rootPublicKeyJWK: JsonWebKey,
  orgPublicKeyJWK: JsonWebKey,
): Promise<ChainVerificationResult> {
  // Step 1: Verify attestation against root key
  const attResult = await verifyKeyAttestation(attestation, rootPublicKeyJWK);
  if (!attResult.valid) {
    return {
      valid: false,
      chain: ["root"],
      trustLevel: "invalid",
      reason: `Attestation verification failed: ${attResult.reason}`,
    };
  }

  // Step 2: Verify org key fingerprint matches attestation
  const orgFingerprint = await computeKeyFingerprint(orgPublicKeyJWK);
  if (orgFingerprint !== attResult.orgKeyFingerprint) {
    return {
      valid: false,
      chain: ["root", "attestation"],
      trustLevel: "invalid",
      reason: "Org key fingerprint does not match attestation",
    };
  }

  // Step 3: Verify CPOE signature against org public key
  let cpoePayload: Record<string, unknown>;
  try {
    const orgKey = await joseImportJWK(orgPublicKeyJWK, "EdDSA");
    const result = await jwtVerify(cpoe, orgKey);
    cpoePayload = result.payload as Record<string, unknown>;
  } catch {
    return {
      valid: false,
      chain: ["root", "attestation"],
      trustLevel: "invalid",
      reason: "CPOE signature verification failed (cpoe)",
    };
  }

  // Step 4: Verify scope constraints
  const vc = cpoePayload.vc as Record<string, unknown> | undefined;
  const cs = vc?.credentialSubject as Record<string, unknown> | undefined;
  const assurance = cs?.assurance as Record<string, unknown> | undefined;

  if (assurance && attResult.scope) {
    const declaredLevel = assurance.declared as number | undefined;
    const maxAssurance = attResult.scope.maxAssurance ?? 4;

    if (declaredLevel !== undefined && declaredLevel > maxAssurance) {
      return {
        valid: false,
        chain: ["root", "attestation"],
        trustLevel: "invalid",
        reason: `CPOE assurance level ${declaredLevel} exceeds attestation maxAssurance ${maxAssurance}`,
      };
    }

    // Framework scope check
    const attFrameworks = attResult.scope.frameworks;
    if (attFrameworks && attFrameworks.length > 0) {
      const cpoeFrameworks = cs?.frameworks as Record<string, unknown> | undefined;
      if (cpoeFrameworks) {
        const cpoeFrameworkNames = Object.keys(cpoeFrameworks);
        const unauthorized = cpoeFrameworkNames.filter(f => !attFrameworks.includes(f));
        if (unauthorized.length > 0) {
          return {
            valid: false,
            chain: ["root", "attestation"],
            trustLevel: "invalid",
            reason: `CPOE includes unauthorized frameworks: ${unauthorized.join(", ")}`,
          };
        }
      }
    }
  }

  return {
    valid: true,
    chain: ["root", "attestation", "cpoe"],
    trustLevel: "chain-verified",
  };
}
