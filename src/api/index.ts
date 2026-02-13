/**
 * API Module — Versioned /v1/ Platform API
 *
 * Barrel exports for the API router and types.
 */

export { createV1Router, createV1VerifyHandler } from "./router";
export type {
  V1RouterDeps,
} from "./router";
export type {
  APIEnvelope,
  APIError,
  APIErrorCode,
  V1VerifyRequest,
  V1VerifyResponse,
  V1SignRequest,
  V1SignResponse,
  V1HealthResponse,
} from "./types";
