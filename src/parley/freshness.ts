/**
 * Freshness Stapling - OCSP-style freshness proofs for CPOEs
 *
 * Like TLS OCSP stapling: the CPOE includes a signed freshness token
 * proving the compliance state was recently checked. Verifiers get
 * freshness proof without an extra roundtrip to FLAGSHIP.
 *
 * A CPOE WITHOUT a freshness staple is NOT invalid -- just "unstapled."
 * Backwards compatible by design.
 *
 * The staple is a compact JWT (Ed25519-signed) embedded in the CPOE's
 * optional `freshness` field on CPOECredentialSubject.
 */

import { SignJWT, jwtVerify, importPKCS8, importJWK, errors } from "jose";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default staple TTL: 7 days */
export const DEFAULT_STAPLE_TTL_DAYS = 7;

// =============================================================================
// TYPES
// =============================================================================

/** The decoded freshness staple payload */
export interface FreshnessStaple {
  /** When the compliance state was last verified (ISO 8601) */
  checkedAt: string;

  /** When this staple expires (ISO 8601) */
  expiresAt: string;

  /** Number of active FLAGSHIP alerts at check time */
  alertsActive: number;

  /** FLAGSHIP stream ID for real-time status */
  streamId?: string;

  /** Scoring snapshot at check time */
  score?: {
    composite: number;
    grade: string;
  };
}

/** Configuration for generating a freshness staple */
export interface StapleConfig {
  /** Ed25519 private key in PEM format (PKCS8) */
  privateKeyPem: string;

  /** Issuer DID (e.g., "did:web:grcorsair.com") */
  issuerDid: string;

  /** When the compliance state was checked (ISO 8601) */
  checkedAt: string;

  /** Number of active FLAGSHIP alerts */
  alertsActive: number;

  /** Staple TTL in days (default: DEFAULT_STAPLE_TTL_DAYS) */
  ttlDays?: number;

  /** FLAGSHIP stream ID */
  streamId?: string;

  /** Scoring snapshot */
  score?: {
    composite: number;
    grade: string;
  };
}

/** Result of verifying a freshness staple */
export interface FreshnessResult {
  /** Whether the staple signature is valid */
  valid: boolean;

  /** Whether the staple is still fresh (valid + not expired) */
  fresh: boolean;

  /** When the compliance state was last checked */
  checkedAt?: string;

  /** Days since the last check (floored integer) */
  staleDays: number;

  /** Active FLAGSHIP alerts at check time */
  alertsActive: number;

  /** FLAGSHIP stream ID */
  streamId?: string;

  /** Scoring snapshot */
  score?: {
    composite: number;
    grade: string;
  };

  /** Failure reason (only set when valid=false) */
  reason?: "malformed" | "signature_invalid" | "expired";
}

// =============================================================================
// STAPLE GENERATION
// =============================================================================

/**
 * Generate a signed freshness staple JWT.
 *
 * The JWT contains:
 *   Header: { alg: "EdDSA", typ: "freshness+jwt", kid: "<did>#key-1" }
 *   Payload: { iss, iat, exp, checkedAt, alertsActive, streamId?, score? }
 */
export async function generateFreshnessStaple(
  config: StapleConfig,
): Promise<string> {
  const ttlDays = config.ttlDays ?? DEFAULT_STAPLE_TTL_DAYS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const privateKey = await importPKCS8(config.privateKeyPem, "EdDSA");

  // Build custom claims
  const claims: Record<string, unknown> = {
    checkedAt: config.checkedAt,
    alertsActive: config.alertsActive,
  };

  if (config.streamId !== undefined) {
    claims.streamId = config.streamId;
  }

  if (config.score !== undefined) {
    claims.score = config.score;
  }

  const jwt = await new SignJWT(claims)
    .setProtectedHeader({
      alg: "EdDSA",
      typ: "freshness+jwt",
      kid: `${config.issuerDid}#key-1`,
    })
    .setIssuedAt()
    .setIssuer(config.issuerDid)
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  return jwt;
}

// =============================================================================
// STAPLE VERIFICATION
// =============================================================================

/**
 * Verify a freshness staple JWT and compute staleness.
 *
 * Returns { valid, fresh, checkedAt, staleDays, alertsActive }.
 * A missing staple is not an error -- the caller handles "unstapled" CPOEs.
 */
export async function verifyFreshnessStaple(
  staple: string,
  publicKeyJwk: JsonWebKey,
): Promise<FreshnessResult> {
  // Guard: empty or obviously malformed
  if (!staple || staple.split(".").length !== 3) {
    return {
      valid: false,
      fresh: false,
      staleDays: 0,
      alertsActive: 0,
      reason: "malformed",
    };
  }

  let publicKey;
  try {
    publicKey = await importJWK(publicKeyJwk, "EdDSA");
  } catch {
    return {
      valid: false,
      fresh: false,
      staleDays: 0,
      alertsActive: 0,
      reason: "signature_invalid",
    };
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(staple, publicKey);
    payload = result.payload as Record<string, unknown>;
  } catch (err: unknown) {
    // Distinguish expiry from signature failure
    if (err instanceof errors.JWTExpired) {
      return {
        valid: false,
        fresh: false,
        staleDays: 0,
        alertsActive: 0,
        reason: "expired",
      };
    }
    return {
      valid: false,
      fresh: false,
      staleDays: 0,
      alertsActive: 0,
      reason: "signature_invalid",
    };
  }

  // Extract fields from verified payload
  const checkedAt = payload.checkedAt as string | undefined;
  const alertsActive = (payload.alertsActive as number) ?? 0;
  const streamId = payload.streamId as string | undefined;
  const score = payload.score as { composite: number; grade: string } | undefined;

  // Calculate staleness
  const staleDays = checkedAt
    ? Math.floor((Date.now() - new Date(checkedAt).getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  return {
    valid: true,
    fresh: true,
    checkedAt,
    staleDays,
    alertsActive,
    ...(streamId !== undefined ? { streamId } : {}),
    ...(score !== undefined ? { score } : {}),
  };
}
