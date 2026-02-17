/**
 * API Types — Versioned /v1/ API Platform
 *
 * Defines request/response types for all v1 endpoints.
 * Follows Stripe-style API conventions:
 *   - Consistent JSON envelope
 *   - Request IDs on every response
 *   - Typed error codes
 */

// =============================================================================
// ENVELOPE
// =============================================================================

/** Standard API response envelope. Every v1 response uses this shape. */
export interface APIEnvelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: APIError;
}

export interface APIError {
  code: APIErrorCode;
  message: string;
}

export type APIErrorCode =
  | "bad_request"
  | "validation_error"
  | "method_not_allowed"
  | "not_found"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "payload_too_large"
  | "internal_error";

// =============================================================================
// VERIFY
// =============================================================================

export interface V1VerifyRequest {
  /** JWT-VC CPOE string */
  cpoe: string;
  /** Optional verification policy */
  policy?: {
    requireIssuer?: string;
    requireFramework?: string[];
    maxAgeDays?: number;
    minScore?: number;
  };
  /** Optional process receipts for chain verification */
  receipts?: unknown[];
}

export interface V1VerifyResponse {
  valid: boolean;
  issuer: string | null;
  trustTier: "corsair-verified" | "self-signed" | "unverifiable" | "invalid" | null;
  scope: string | null;
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  } | null;
  provenance: {
    source: string;
    sourceIdentity?: string;
    sourceDate?: string;
  } | null;
  timestamps: {
    issuedAt: string | null;
    expiresAt: string | null;
  };
  processProvenance?: {
    chainDigest: string;
    receiptCount: number;
    chainVerified: boolean;
    reproducibleSteps: number;
    attestedSteps: number;
  } | null;
  policy?: { ok: boolean; errors: string[] } | null;
  process?: { chainValid: boolean; receiptsVerified: number; receiptsTotal: number } | null;
  extensions?: Record<string, unknown> | null;
  reason?: string;
}

// =============================================================================
// SIGN (re-export shapes from functions/sign.ts for API typing)
// =============================================================================

export interface V1SignRequest {
  evidence: unknown;
  format?: string;
  did?: string;
  scope?: string;
  expiryDays?: number;
  dryRun?: boolean;
}

export interface V1SignResponse {
  cpoe: string;
  marqueId: string;
  detectedFormat: string;
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
    severityDistribution?: Record<string, number>;
  };
  provenance: {
    source: string;
    sourceIdentity?: string;
    sourceDate?: string;
  };
  warnings: string[];
  extensions?: Record<string, unknown>;
  expiresAt?: string;
}

// =============================================================================
// HEALTH
// =============================================================================

export interface V1HealthResponse {
  status: "ok" | "degraded";
  version: string;
  timestamp: string;
}
