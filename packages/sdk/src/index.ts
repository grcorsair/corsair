/**
 * @corsair/sdk — Public API
 *
 * Cryptographic compliance proof infrastructure SDK.
 * Sign, verify, score, and query compliance evidence.
 */

export { CorsairClient } from "./client";

// SDK-specific types
export type {
  CorsairClientConfig,
  SignOptions,
  SignResult,
  VerifyResult,
  ScoreResult,
  ScoreInputOptions,
} from "./types";

// Re-exported core types consumers need
export type {
  EvidenceFormat,
  EvidenceQualityScore,
  ScoredDimension,
  LetterGrade,
  ScoringMethod,
  EvidenceQuery,
  QueryResult,
  QueryAggregations,
  CanonicalControlEvidence,
  CanonicalStatus,
  CanonicalSeverity,
  EvidenceType,
  ProvenanceSource,
  NormalizedEvidence,
  MarqueVerificationResult,
} from "./types";
