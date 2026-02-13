/**
 * SD-JWT — Selective Disclosure JWT for CPOEs
 *
 * Implements IETF draft-ietf-oauth-selective-disclosure-jwt.
 * Allows CPOE holders to prove specific compliance claims
 * ("we passed SOC 2 access controls") without revealing the full assessment.
 *
 * Architecture:
 *   Issuer signs:   SD-JWT = JWT + ~disclosure1 + ~disclosure2 + ...
 *   Holder reveals:  SD-JWT = JWT + ~disclosure2 (only chosen claims)
 *   Verifier sees:   JWT claims + only disclosed values, rest are SHA-256 hashes
 *
 * Uses jose for JWT signing + Node.js crypto for SHA-256.
 * SD-JWT separator is ~ (tilde) per IETF spec.
 * Disclosure format: base64url(JSON.stringify([salt, claim_name, claim_value]))
 */

import * as crypto from "crypto";
import { SignJWT, importPKCS8, importJWK, jwtVerify } from "jose";

// =============================================================================
// TYPES
// =============================================================================

export interface SDJWTSigningConfig {
  /** PEM-encoded Ed25519 private key */
  privateKeyPem: string;
  /** Issuer DID for JWT header kid */
  issuerDid: string;
}

export interface SDJWTResult {
  /** The combined SD-JWT string (jwt~disclosure1~disclosure2~...) */
  sdJwt: string;
  /** Individual disclosures with metadata */
  disclosures: Array<{
    claim: string;
    disclosure: string;
    digest: string;
  }>;
}

export interface SDJWTVerificationResult {
  /** Whether the SD-JWT is valid */
  valid: boolean;
  /** Claims that were disclosed and verified */
  disclosedClaims: Record<string, unknown>;
  /** SHA-256 digests of undisclosed claims */
  undisclosedDigests: string[];
  /** The decoded JWT payload (without disclosed claims reconstructed) */
  payload?: Record<string, unknown>;
  /** Error message if invalid */
  error?: string;
}

interface ParsedSDJWT {
  jwt: string;
  disclosures: string[];
}

// Claims that must never be made selectively disclosable (discriminators)
const PROTECTED_CLAIMS = new Set(["type"]);

// =============================================================================
// DISCLOSURE PRIMITIVES
// =============================================================================

/**
 * Create a disclosure: base64url(JSON.stringify([salt, claim_name, claim_value]))
 *
 * Per IETF SD-JWT spec, a disclosure is a JSON array of [salt, claim_name, claim_value]
 * encoded as base64url. The salt provides unlinkability between issuances.
 */
export function createDisclosure(
  claimName: string,
  claimValue: unknown,
  salt?: string,
): string {
  const disclosureSalt = salt ?? crypto.randomBytes(16).toString("base64url");
  const disclosureArray = [disclosureSalt, claimName, claimValue];
  return Buffer.from(JSON.stringify(disclosureArray), "utf-8").toString(
    "base64url",
  );
}

/**
 * Hash a disclosure string using SHA-256, returned as base64url.
 *
 * The _sd array in the JWT payload contains these digests, allowing
 * verifiers to match presented disclosures against the signed JWT.
 */
export function hashDisclosure(disclosure: string): string {
  const hash = crypto.createHash("sha256").update(disclosure).digest();
  return hash.toString("base64url");
}

// =============================================================================
// SD-JWT PARSING
// =============================================================================

/**
 * Parse an SD-JWT string into its JWT and disclosure components.
 *
 * Format: <jwt>~<disclosure1>~<disclosure2>~...~
 * A trailing ~ is valid per spec and is stripped.
 * A plain JWT (no ~) returns an empty disclosures array.
 */
export function parseSDJWT(sdJwt: string): ParsedSDJWT {
  if (!sdJwt.includes("~")) {
    return { jwt: sdJwt, disclosures: [] };
  }

  const parts = sdJwt.split("~");
  const jwt = parts[0];
  const disclosures = parts.slice(1).filter((d) => d.length > 0);

  return { jwt, disclosures };
}

// =============================================================================
// SD-JWT ISSUANCE
// =============================================================================

/**
 * Create an SD-JWT from a CPOE JWT payload.
 *
 * For each disclosable field in vc.credentialSubject:
 *   1. Generate a random salt
 *   2. Create disclosure: base64url([salt, claim_name, claim_value])
 *   3. Hash the disclosure: SHA-256(disclosure)
 *   4. Replace the claim value with the hash in an _sd array
 *   5. Remove the original claim from the payload
 *
 * The JWT is signed with the hashed payload. Disclosures are appended
 * with ~ separators.
 */
export async function createSDJWT(
  payload: Record<string, unknown>,
  disclosableFields: string[],
  config: SDJWTSigningConfig,
): Promise<SDJWTResult> {
  // Deep clone the payload to avoid mutating the original
  const jwtPayload = JSON.parse(JSON.stringify(payload));

  // Deduplicate and filter disclosable fields
  const uniqueFields = [
    ...new Set(
      disclosableFields.filter((f) => !PROTECTED_CLAIMS.has(f)),
    ),
  ];

  const credentialSubject = jwtPayload.vc?.credentialSubject;
  if (!credentialSubject) {
    throw new Error("Payload must contain vc.credentialSubject");
  }

  const disclosures: SDJWTResult["disclosures"] = [];
  const sdDigests: string[] = [];

  for (const field of uniqueFields) {
    // Skip fields that don't exist in the credential subject
    if (!(field in credentialSubject)) continue;

    const value = credentialSubject[field];

    // Create disclosure
    const disclosure = createDisclosure(field, value);
    const digest = hashDisclosure(disclosure);

    disclosures.push({ claim: field, disclosure, digest });
    sdDigests.push(digest);

    // Remove the claim from the payload
    delete credentialSubject[field];
  }

  // Add _sd array and _sd_alg if there are disclosable claims
  if (sdDigests.length > 0) {
    credentialSubject._sd = sdDigests;
    credentialSubject._sd_alg = "sha-256";
  }

  // Sign the JWT
  const privateKey = await importPKCS8(config.privateKeyPem, "EdDSA");

  const { iss, sub, exp, iat, jti, vc, parley } = jwtPayload;
  const jwt = await new SignJWT({ vc, parley })
    .setProtectedHeader({
      alg: "EdDSA",
      typ: "vc+jwt",
      kid: `${config.issuerDid}#key-1`,
    })
    .setIssuedAt(iat)
    .setIssuer(iss)
    .setSubject(sub)
    .setJti(jti)
    .setExpirationTime(exp)
    .sign(privateKey);

  // Build the SD-JWT string
  if (disclosures.length === 0) {
    return { sdJwt: jwt, disclosures: [] };
  }

  const disclosureStrings = disclosures.map((d) => d.disclosure);
  const sdJwt = jwt + "~" + disclosureStrings.join("~") + "~";

  return { sdJwt, disclosures };
}

// =============================================================================
// SD-JWT PRESENTATION
// =============================================================================

/**
 * Create a presentation from an SD-JWT, revealing only selected claims.
 *
 * The holder selects which disclosures to include. The JWT is unchanged
 * (signature remains valid). Only the appended disclosures change.
 */
export function presentSDJWT(
  sdJwt: string,
  allDisclosures: Array<{ claim: string; disclosure: string }>,
  discloseFields: string[],
): string {
  const { jwt } = parseSDJWT(sdJwt);
  const discloseSet = new Set(discloseFields);

  // Filter disclosures to only the ones being revealed
  const selectedDisclosures = allDisclosures.filter((d) =>
    discloseSet.has(d.claim),
  );

  if (selectedDisclosures.length === 0) {
    return jwt;
  }

  const disclosureStrings = selectedDisclosures.map((d) => d.disclosure);
  return jwt + "~" + disclosureStrings.join("~") + "~";
}

// =============================================================================
// SD-JWT VERIFICATION
// =============================================================================

/**
 * Verify an SD-JWT: check JWT signature, then match disclosures to _sd digests.
 *
 * Steps:
 *   1. Parse SD-JWT into JWT and disclosures
 *   2. Verify JWT signature using the provided public key
 *   3. For each disclosure: decode, hash, verify it matches an _sd entry
 *   4. Return disclosed claims and undisclosed digest list
 */
export async function verifySDJWT(
  sdJwt: string,
  publicKeyJwk: JsonWebKey,
): Promise<SDJWTVerificationResult> {
  try {
    const { jwt, disclosures } = parseSDJWT(sdJwt);

    // Verify JWT signature
    const key = await importJWK(publicKeyJwk, "EdDSA");
    const { payload } = await jwtVerify(jwt, key);

    const vc = payload.vc as Record<string, unknown> | undefined;
    const credentialSubject = vc?.credentialSubject as
      | Record<string, unknown>
      | undefined;

    // If no _sd array, this is a normal JWT
    const sdDigests = (credentialSubject?._sd as string[] | undefined) ?? [];

    if (sdDigests.length === 0 && disclosures.length === 0) {
      return {
        valid: true,
        disclosedClaims: {},
        undisclosedDigests: [],
        payload: payload as Record<string, unknown>,
      };
    }

    // Match disclosures to _sd digests
    const disclosedClaims: Record<string, unknown> = {};
    const matchedDigests = new Set<string>();

    for (const disclosureStr of disclosures) {
      const digest = hashDisclosure(disclosureStr);

      if (!sdDigests.includes(digest)) {
        return {
          valid: false,
          disclosedClaims: {},
          undisclosedDigests: [],
          error: `Disclosure digest mismatch: ${digest} not found in _sd array`,
        };
      }

      // Decode the disclosure
      const decoded = JSON.parse(
        Buffer.from(disclosureStr, "base64url").toString("utf-8"),
      );

      if (!Array.isArray(decoded) || decoded.length !== 3) {
        return {
          valid: false,
          disclosedClaims: {},
          undisclosedDigests: [],
          error: "Invalid disclosure format: expected [salt, claim, value]",
        };
      }

      const [, claimName, claimValue] = decoded;
      disclosedClaims[claimName] = claimValue;
      matchedDigests.add(digest);
    }

    // Compute undisclosed digests
    const undisclosedDigests = sdDigests.filter((d) => !matchedDigests.has(d));

    return {
      valid: true,
      disclosedClaims,
      undisclosedDigests,
      payload: payload as Record<string, unknown>,
    };
  } catch (err) {
    return {
      valid: false,
      disclosedClaims: {},
      undisclosedDigests: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
