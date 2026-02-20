/**
 * @grcorsair/sdk — Public API
 *
 * Cryptographic compliance proof infrastructure SDK.
 * Sign and verify compliance evidence (CPOEs).
 */

export { CorsairClient } from "./client";

// SDK-specific types
export type {
  CorsairClientConfig,
  SignOptions,
  SignResult,
  VerifyResult,
} from "./types";

// Re-exported core types consumers need
export type {
  EvidenceFormat,
  MarqueVerificationResult,
} from "./types";
