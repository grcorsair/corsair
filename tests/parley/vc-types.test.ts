/**
 * VC Types Test Contract
 *
 * Validates W3C Verifiable Credential 2.0 types for the Parley protocol.
 * Tests type instantiation, @context validation, required fields, and
 * CPOE credential subject structure.
 */

import { describe, test, expect } from "bun:test";
import type {
  VerifiableCredential,
  CredentialSubject,
  VCProof,
  CPOECredentialSubject,
  VCJWTHeader,
  VCJWTPayload,
  CorsairCPOE,
  CPOEProvenance,
} from "../../src/parley/vc-types";
import {
  VC_CONTEXT,
  CORSAIR_CONTEXT,
  CPOE_TYPE,
} from "../../src/parley/vc-types";

describe("VC Types - W3C Verifiable Credential 2.0", () => {
  test("VC_CONTEXT constant points to W3C credentials v2", () => {
    expect(VC_CONTEXT).toBe("https://www.w3.org/ns/credentials/v2");
  });

  test("CORSAIR_CONTEXT constant points to grcorsair.com", () => {
    expect(CORSAIR_CONTEXT).toBe("https://grcorsair.com/credentials/v1");
  });

  test("CPOE_TYPE constant is CorsairCPOE", () => {
    expect(CPOE_TYPE).toBe("CorsairCPOE");
  });

  test("VerifiableCredential requires @context with VC 2.0 context", () => {
    const vc: VerifiableCredential = {
      "@context": [VC_CONTEXT, CORSAIR_CONTEXT],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: "did:web:grcorsair.com",
      validFrom: new Date().toISOString(),
      credentialSubject: { id: "urn:corsair:cpoe:test-001" },
    };

    expect(vc["@context"]).toContain(VC_CONTEXT);
    expect(vc["@context"]).toHaveLength(2);
    expect(vc.type).toContain("VerifiableCredential");
    expect(vc.issuer).toBe("did:web:grcorsair.com");
    expect(vc.validFrom).toBeDefined();
    expect(vc.credentialSubject.id).toBe("urn:corsair:cpoe:test-001");
  });

  test("VerifiableCredential issuer can be string or object", () => {
    const vcWithStringIssuer: VerifiableCredential = {
      "@context": [VC_CONTEXT],
      type: ["VerifiableCredential"],
      issuer: "did:web:grcorsair.com",
      validFrom: new Date().toISOString(),
      credentialSubject: {},
    };

    const vcWithObjectIssuer: VerifiableCredential = {
      "@context": [VC_CONTEXT],
      type: ["VerifiableCredential"],
      issuer: { id: "did:web:grcorsair.com", name: "Corsair Engine" },
      validFrom: new Date().toISOString(),
      credentialSubject: {},
    };

    expect(typeof vcWithStringIssuer.issuer).toBe("string");
    expect(typeof vcWithObjectIssuer.issuer).toBe("object");
    expect((vcWithObjectIssuer.issuer as { id: string }).id).toBe("did:web:grcorsair.com");
  });

  test("VerifiableCredential supports optional fields (id, validUntil, proof)", () => {
    const vc: VerifiableCredential = {
      "@context": [VC_CONTEXT],
      type: ["VerifiableCredential"],
      id: "urn:uuid:12345",
      issuer: "did:web:grcorsair.com",
      validFrom: "2026-02-07T00:00:00Z",
      validUntil: "2026-02-14T00:00:00Z",
      credentialSubject: {},
      proof: {
        type: "Ed25519Signature2020",
        created: "2026-02-07T00:00:00Z",
        verificationMethod: "did:web:grcorsair.com#key-1",
        proofPurpose: "assertionMethod",
        proofValue: "base64-encoded-signature",
      },
    };

    expect(vc.id).toBe("urn:uuid:12345");
    expect(vc.validUntil).toBe("2026-02-14T00:00:00Z");
    expect(vc.proof).toBeDefined();
    expect(vc.proof!.type).toBe("Ed25519Signature2020");
    expect(vc.proof!.proofPurpose).toBe("assertionMethod");
  });

  test("VCProof has all required signature fields", () => {
    const proof: VCProof = {
      type: "Ed25519Signature2020",
      created: "2026-02-07T12:00:00Z",
      verificationMethod: "did:web:grcorsair.com#key-1",
      proofPurpose: "assertionMethod",
      proofValue: "z58DAdFfa9SkqZMVPxAQpic76UMjkE...",
    };

    expect(proof.type).toBe("Ed25519Signature2020");
    expect(proof.created).toBeDefined();
    expect(proof.verificationMethod).toContain("did:web:");
    expect(proof.proofPurpose).toBe("assertionMethod");
    expect(proof.proofValue).toBeDefined();
  });

  test("CPOECredentialSubject has complete assessment data", () => {
    const subject: CPOECredentialSubject = {
      type: "CorsairCPOE",
      scope: "aws-cognito, aws-s3 — 12 resources, SOC2 + NIST-800-53",
      provenance: {
        source: "tool",
        sourceIdentity: "Corsair Engine",
      },
      summary: {
        controlsTested: 25,
        controlsPassed: 20,
        controlsFailed: 5,
        overallScore: 80,
      },
      evidenceChain: {
        hashChainRoot: "sha256-abc123",
        recordCount: 42,
        chainVerified: true,
      },
      frameworks: {
        "SOC2": {
          controlsMapped: 10,
          passed: 8,
          failed: 2,
          controls: [
            { controlId: "CC6.1", status: "passed" },
            { controlId: "CC6.2", status: "failed" },
          ],
        },
      },
    };

    expect(subject.type).toBe("CorsairCPOE");
    expect(subject.scope).toContain("aws-cognito");
    expect(subject.provenance.source).toBe("tool");
    expect(subject.summary.controlsTested).toBe(25);
    expect(subject.summary.overallScore).toBe(80);
    expect(subject.evidenceChain!.chainVerified).toBe(true);
    expect(subject.frameworks!["SOC2"].controlsMapped).toBe(10);
    expect(subject.frameworks!["SOC2"].controls[0].controlId).toBe("CC6.1");
  });

  test("CPOECredentialSubject supports optional threatModel", () => {
    const subject: CPOECredentialSubject = {
      type: "CorsairCPOE",
      scope: "aws-cognito — 1 resource, SOC2",
      provenance: { source: "tool", sourceIdentity: "Corsair Test" },
      summary: { controlsTested: 5, controlsPassed: 5, controlsFailed: 0, overallScore: 100 },
      evidenceChain: { hashChainRoot: "sha256-root", recordCount: 10, chainVerified: true },
      frameworks: {},
      threatModel: {
        methodology: "STRIDE",
        providersAnalyzed: ["aws-cognito"],
        totalThreats: 6,
        riskDistribution: { critical: 1, high: 2, medium: 3 },
      },
    };

    expect(subject.threatModel).toBeDefined();
    expect(subject.threatModel!.methodology).toBe("STRIDE");
    expect(subject.threatModel!.totalThreats).toBe(6);
  });

  test("VCJWTHeader uses EdDSA algorithm and vc+jwt type", () => {
    const header: VCJWTHeader = {
      alg: "EdDSA",
      typ: "vc+jwt",
      kid: "did:web:grcorsair.com#key-1",
    };

    expect(header.alg).toBe("EdDSA");
    expect(header.typ).toBe("vc+jwt");
    expect(header.kid).toContain("did:web:");
  });

  test("VCJWTPayload contains VC and parley version", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload: VCJWTPayload = {
      iss: "did:web:grcorsair.com",
      sub: "urn:corsair:cpoe:test-001",
      exp: now + 86400,
      iat: now,
      jti: "marque-uuid-001",
      vc: {
        "@context": [VC_CONTEXT, CORSAIR_CONTEXT],
        type: ["VerifiableCredential", "CorsairCPOE"],
        issuer: "did:web:grcorsair.com",
        validFrom: new Date(now * 1000).toISOString(),
        credentialSubject: {
          type: "CorsairCPOE",
          scope: "test scope",
          provenance: { source: "self" },
          summary: { controlsTested: 0, controlsPassed: 0, controlsFailed: 0, overallScore: 0 },
        } as CPOECredentialSubject,
      },
      parley: "2.0",
    };

    expect(payload.iss).toBe("did:web:grcorsair.com");
    expect(payload.parley).toBe("2.0");
    expect(payload.vc["@context"]).toContain(VC_CONTEXT);
    expect(payload.vc.type).toContain("CorsairCPOE");
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(payload.jti).toBe("marque-uuid-001");
  });

  test("CorsairCPOE type enforces VerifiableCredential + CorsairCPOE types", () => {
    const cpoe: CorsairCPOE = {
      "@context": [VC_CONTEXT, CORSAIR_CONTEXT],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: "did:web:grcorsair.com", name: "Corsair Engine" },
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      credentialSubject: {
        type: "CorsairCPOE",
        scope: "aws-cognito — 3 resources, SOC2",
        provenance: { source: "tool", sourceIdentity: "Corsair Engine" },
        summary: { controlsTested: 10, controlsPassed: 8, controlsFailed: 2, overallScore: 80 },
        evidenceChain: { hashChainRoot: "sha256-root", recordCount: 20, chainVerified: true },
        frameworks: {},
      },
    };

    expect(cpoe.type).toEqual(["VerifiableCredential", "CorsairCPOE"]);
    expect(cpoe.credentialSubject.type).toBe("CorsairCPOE");
    expect(cpoe.credentialSubject.scope).toContain("aws-cognito");
  });

  test("CPOEProvenance captures all source metadata", () => {
    const provenance: CPOEProvenance = {
      source: "auditor",
      sourceIdentity: "Ernst & Young LLP",
      sourceDocument: "sha256-abc123def456",
      sourceDate: "2026-01-15",
    };

    expect(provenance.source).toBe("auditor");
    expect(provenance.sourceIdentity).toBe("Ernst & Young LLP");
    expect(provenance.sourceDocument).toBe("sha256-abc123def456");
    expect(provenance.sourceDate).toBe("2026-01-15");
  });

  test("CPOECredentialSubject allows optional evidenceChain and frameworks", () => {
    const subject: CPOECredentialSubject = {
      type: "CorsairCPOE",
      scope: "Document ingestion scope",
      provenance: { source: "self" },
      summary: { controlsTested: 5, controlsPassed: 3, controlsFailed: 2, overallScore: 60 },
    };

    expect(subject.evidenceChain).toBeUndefined();
    expect(subject.frameworks).toBeUndefined();
    expect(subject.scope).toBe("Document ingestion scope");
    expect(subject.provenance.source).toBe("self");
  });
});
