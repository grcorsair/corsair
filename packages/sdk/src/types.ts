/**
 * @corsair/sdk Public Types
 *
 * Re-exports core types and defines SDK-specific types.
 *
 * Historical scoring/query types were removed to keep the SDK focused.
 */

// Re-export from sign engine
export type { EvidenceFormat, SignInput, SignOutput } from "../../../src/sign/sign-core";

// Re-export from verifier
export type { MarqueVerificationResult } from "../../../src/parley/marque-verifier";

// =============================================================================
// SDK-SPECIFIC TYPES
// =============================================================================

/** Configuration for CorsairClient */
export interface CorsairClientConfig {
  /** Directory where Ed25519 signing keys are stored */
  keyDir?: string;

  /** Default issuer DID (e.g., "did:web:acme.com") */
  did?: string;
}

/** Options for the sign method */
export interface SignOptions {
  /** Force a specific evidence format (bypasses auto-detection) */
  format?: EvidenceFormat;

  /** Override issuer DID for this operation */
  did?: string;

  /** Override scope string */
  scope?: string;

  /** CPOE validity in days (default: 90) */
  expiryDays?: number;

  /** Parse + classify but don't sign */
  dryRun?: boolean;
}

/** Result of a sign operation */
export interface SignResult {
  /** Signed JWT-VC string (empty if dryRun) */
  jwt: string;

  /** CPOE identifier */
  marqueId: string;

  /** Detected or forced evidence format */
  detectedFormat: string;

  /** Assessment summary */
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
    severityDistribution?: Record<string, number>;
  };

  /** Evidence provenance */
  provenance: {
    source: string;
    sourceIdentity?: string;
    sourceDate?: string;
  };

  /** Warnings generated during signing */
  warnings: string[];
}

/** Result of a verify operation */
export interface VerifyResult {
  valid: boolean;
  reason?: "signature_invalid" | "expired" | "schema_invalid" | "evidence_mismatch";
  signedBy?: string;
  generatedAt?: string;
  expiresAt?: string;
  provenance?: { source: string; sourceIdentity?: string; sourceDate?: string };
  scope?: string;
  summary?: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
  issuerTier?: "corsair-verified" | "self-signed" | "unverifiable" | "invalid";
}
