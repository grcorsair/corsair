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
        provenance: {
          source: "tool",
          sourceIdentity: "Scanner v1.2",
          sourceDocument: "abc123",
          sourceDate: new Date().toISOString(),
        },
        evidenceChain: {
          chainType: "hash-linked",
          algorithm: "sha256",
          canonicalization: "sorted-json-v1",
          recordCount: 1,
          chainVerified: true,
          chainDigest: "chain123",
        },
        processProvenance: {
          chainDigest: "proc123",
          receiptCount: 2,
          chainVerified: true,
          reproducibleSteps: 2,
          attestedSteps: 0,
          toolAttestedSteps: 1,
          scittEntryIds: ["scitt-1", "scitt-2"],
        },
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

  test("requires provenance source type", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireSource: "tool" });
    expect(result.ok).toBe(true);
  });

  test("fails when provenance source type mismatches", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireSource: "auditor" });
    expect(result.ok).toBe(false);
  });

  test("requires source identity in allowed list", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireSourceIdentity: ["Scanner v1.2"] });
    expect(result.ok).toBe(true);
  });

  test("requires tool attestation", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireToolAttestation: true });
    expect(result.ok).toBe(true);
  });

  test("requires input binding with context", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireInputBinding: true }, {
      inputBinding: { ok: true, errors: [] },
    });
    expect(result.ok).toBe(true);
  });

  test("requires evidence chain verification", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireEvidenceChain: true }, {
      evidence: { ok: true },
    });
    expect(result.ok).toBe(true);
  });

  test("requires verified receipts", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireReceipts: true }, {
      process: { chainValid: true, receiptsTotal: 2, receiptsVerified: 2 },
    });
    expect(result.ok).toBe(true);
  });

  test("requires scitt entry IDs", () => {
    const payload = makePayload();
    const result = evaluateVerificationPolicy(payload, { requireScitt: true }, {
      process: { chainValid: true, receiptsTotal: 2, receiptsVerified: 2, scittRegistered: 2 },
    });
    expect(result.ok).toBe(true);
  });
});
