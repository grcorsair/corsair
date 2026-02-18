/**
 * Policy Artifact Tests
 *
 * Validates policy schema and field types.
 */

import { describe, test, expect } from "bun:test";
import { validatePolicyArtifact } from "../../src/parley/policy";

describe("policy artifacts", () => {
  test("accepts a minimal policy", () => {
    const policy = {
      version: "1.0",
      requireIssuer: "did:web:acme.com",
    };
    const result = validatePolicyArtifact(policy);
    expect(result.ok).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  test("rejects missing version", () => {
    const policy = { requireIssuer: "did:web:acme.com" };
    const result = validatePolicyArtifact(policy);
    expect(result.ok).toBe(false);
  });

  test("rejects invalid types", () => {
    const policy = {
      version: "1.0",
      requireFramework: "SOC2",
      maxAgeDays: "30",
      requireSource: "invalid",
      requireToolAttestation: "yes",
    };
    const result = validatePolicyArtifact(policy);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("accepts full policy with metadata", () => {
    const policy = {
      version: "1.0",
      name: "Acme Procurement Baseline",
      description: "Baseline acceptance policy",
      owner: "Acme Security",
      contact: "security@acme.com",
      createdAt: new Date().toISOString(),
      requireIssuer: "did:web:acme.com",
      requireFramework: ["SOC2"],
      maxAgeDays: 90,
      minScore: 85,
      requireSource: "tool",
      requireSourceIdentity: ["Prowler v3.1"],
      requireToolAttestation: true,
      requireInputBinding: true,
      requireEvidenceChain: true,
      requireReceipts: true,
      requireScitt: true,
    };
    const result = validatePolicyArtifact(policy);
    expect(result.ok).toBe(true);
  });
});

