/**
 * API Types Tests
 *
 * Validates that the type definitions are importable and structurally correct.
 * Tests the APIEnvelope shape and type-level contracts.
 */

import { describe, test, expect } from "bun:test";
import type {
  APIEnvelope,
  APIError,
  APIErrorCode,
  V1VerifyRequest,
  V1VerifyResponse,
  V1SignRequest,
  V1SignResponse,
  V1HealthResponse,
} from "../../src/api/types";

// =============================================================================
// TYPE CONTRACTS
// =============================================================================

describe("API Types — structural contracts", () => {
  test("APIEnvelope success shape", () => {
    const envelope: APIEnvelope<{ value: number }> = {
      ok: true,
      data: { value: 42 },
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.value).toBe(42);
    expect(envelope.error).toBeUndefined();
  });

  test("APIEnvelope error shape", () => {
    const envelope: APIEnvelope = {
      ok: false,
      error: { code: "bad_request", message: "Invalid input" },
    };
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.code).toBe("bad_request");
    expect(envelope.error?.message).toBe("Invalid input");
    expect(envelope.data).toBeUndefined();
  });

  test("APIErrorCode covers all expected codes", () => {
    const codes: APIErrorCode[] = [
      "bad_request",
      "validation_error",
      "method_not_allowed",
      "not_found",
      "unauthorized",
      "forbidden",
      "rate_limited",
      "payload_too_large",
      "internal_error",
    ];
    expect(codes.length).toBe(9);
    // Each code should be a string
    for (const code of codes) {
      expect(typeof code).toBe("string");
    }
  });

  test("V1VerifyRequest requires cpoe field", () => {
    const req: V1VerifyRequest = { cpoe: "eyJ..." };
    expect(req.cpoe).toBe("eyJ...");
  });

  test("V1VerifyResponse has required fields", () => {
    const res: V1VerifyResponse = {
      valid: true,
      issuer: "did:web:grcorsair.com",
      trustTier: "corsair-verified",
      scope: "SOC 2 Type II",
      summary: { controlsTested: 10, controlsPassed: 9, controlsFailed: 1, overallScore: 90 },
      provenance: { source: "tool", sourceIdentity: "Prowler v3" },
      timestamps: { issuedAt: "2026-02-13T00:00:00Z", expiresAt: "2026-05-13T00:00:00Z" },
    };
    expect(res.valid).toBe(true);
    expect(res.trustTier).toBe("corsair-verified");
    expect(res.summary?.controlsTested).toBe(10);
  });

  test("V1VerifyResponse allows null optional fields", () => {
    const res: V1VerifyResponse = {
      valid: false,
      issuer: null,
      trustTier: null,
      scope: null,
      summary: null,
      provenance: null,
      timestamps: { issuedAt: null, expiresAt: null },
      reason: "signature_invalid",
    };
    expect(res.valid).toBe(false);
    expect(res.issuer).toBeNull();
    expect(res.reason).toBe("signature_invalid");
  });

  test("V1SignRequest requires evidence field", () => {
    const req: V1SignRequest = { evidence: { controls: [] } };
    expect(req.evidence).toBeTruthy();
  });

  test("V1SignResponse has required fields", () => {
    const res: V1SignResponse = {
      cpoe: "eyJ...",
      marqueId: "marque-abc",
      detectedFormat: "generic",
      summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
      provenance: { source: "tool" },
      warnings: [],
    };
    expect(res.cpoe).toBe("eyJ...");
    expect(res.warnings.length).toBe(0);
  });

  test("V1HealthResponse shape", () => {
    const res: V1HealthResponse = {
      status: "ok",
      version: "0.5.0",
      timestamp: new Date().toISOString(),
    };
    expect(res.status).toBe("ok");
    expect(typeof res.version).toBe("string");
  });
});
