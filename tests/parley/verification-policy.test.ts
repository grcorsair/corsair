/**
 * Verification Policy Tests
 *
 * Tests policy evaluation over VCJWT payloads.
 */

import { describe, test, expect } from "bun:test";
import { evaluateVerificationPolicy } from "../../src/parley/verification-policy";

function makePayload(overrides?: Record<string, unknown>) {
  return {
    iss: "did:web:acme.com",
    vc: {
      credentialSubject: {
        summary: { overallScore: 90 },
        frameworks: { SOC2: { controlsMapped: 1, passed: 1, failed: 0, controls: [] } },
        provenance: { sourceDate: new Date().toISOString() },
      },
    },
    ...overrides,
  };
}

describe("verification policy", () => {
  test("passes when issuer matches", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireIssuer: "did:web:acme.com" });
    expect(result.ok).toBe(true);
  });

  test("fails when issuer mismatches", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireIssuer: "did:web:other.com" });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes("issuer"))).toBe(true);
  });

  test("fails when framework is missing", () => {
    const payload = makePayload({ vc: { credentialSubject: { summary: { overallScore: 90 } } } });
    const result = evaluateVerificationPolicy(payload, { requireFramework: ["SOC2"] });
    expect(result.ok).toBe(false);
  });

  test("fails when score is below minimum", () => {
    const payload = makePayload({ vc: { credentialSubject: { summary: { overallScore: 50 } } } });
    const result = evaluateVerificationPolicy(payload, { minScore: 80 });
    expect(result.ok).toBe(false);
  });

  test("fails when evidence is older than maxAgeDays", () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    const payload = makePayload({ vc: { credentialSubject: { summary: { overallScore: 90 }, provenance: { sourceDate: oldDate } } } });
    const result = evaluateVerificationPolicy(payload, { maxAgeDays: 30 });
    expect(result.ok).toBe(false);
  });
});
