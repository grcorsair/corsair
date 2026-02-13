/**
 * CAA-in-DID Tests — Scope constraints per signing key in DID documents.
 *
 * Like DNS CAA records but for compliance signing: tells verifiers what
 * a signing key is authorized to sign.
 */

import { describe, test, expect } from "bun:test";
import type { VCJWTPayload, AssuranceLevel } from "../../src/parley/vc-types";
import type { DIDDocument, VerificationMethod } from "../../src/parley/did-resolver";
import {
  type CorsairDIDScope,
  type CorsairVerificationMethod,
  type CorsairDIDDocument,
  type ScopeValidationResult,
  type CAAVerificationResult,
  validateCPOEAgainstScope,
  generateCorsairDIDDocument,
  verifyCPOEWithCAA,
  extractScopeFromDIDDocument,
} from "../../src/parley/caa-did";

// =============================================================================
// TEST HELPERS
// =============================================================================

function makeCPOEPayload(overrides?: {
  frameworks?: Record<string, unknown>;
  assuranceDeclared?: AssuranceLevel;
  provenanceSource?: "self" | "tool" | "auditor";
  kid?: string;
}): VCJWTPayload {
  const frameworks = overrides?.frameworks ?? {
    SOC2: { controlsMapped: 10, passed: 9, failed: 1, controls: [] },
  };

  return {
    iss: "did:web:grcorsair.com",
    sub: "marque-test-001",
    jti: "marque-test-001",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    parley: "2.0",
    vc: {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://grcorsair.com/credentials/v1",
      ],
      type: ["VerifiableCredential", "CorsairCPOE"],
      issuer: { id: "did:web:grcorsair.com", name: "Corsair" },
      validFrom: new Date().toISOString(),
      credentialSubject: {
        type: "CorsairCPOE",
        scope: "Test SOC 2 Type II",
        assurance: {
          declared: overrides?.assuranceDeclared ?? 1,
          verified: true,
          method: "automated-config-check",
          breakdown: { "1": 10 },
        },
        provenance: {
          source: overrides?.provenanceSource ?? "tool",
          sourceIdentity: "Prowler v3.1",
        },
        summary: {
          controlsTested: 10,
          controlsPassed: 9,
          controlsFailed: 1,
          overallScore: 90,
        },
        frameworks,
      },
    },
  };
}

function makeScope(overrides?: Partial<CorsairDIDScope>): CorsairDIDScope {
  return {
    frameworks: overrides?.frameworks,
    maxAssurance: overrides?.maxAssurance,
    purpose: overrides?.purpose,
    allowedSources: overrides?.allowedSources,
  };
}

function makeCorsairDIDDoc(
  scope?: CorsairDIDScope,
  domain = "grcorsair.com",
): CorsairDIDDocument {
  const did = `did:web:${domain}`;
  const keyId = `${did}#key-1`;

  const vm: CorsairVerificationMethod = {
    id: keyId,
    type: "JsonWebKey2020",
    controller: did,
    publicKeyJwk: { kty: "OKP", crv: "Ed25519", x: "dGVzdC1rZXk" },
  };

  if (scope) {
    vm.corsairScope = scope;
  }

  return {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://w3id.org/security/suites/jws-2020/v1",
    ],
    id: did,
    verificationMethod: [vm],
    authentication: [keyId],
    assertionMethod: [keyId],
  };
}

// =============================================================================
// SCOPE VALIDATION TESTS
// =============================================================================

describe("CAA-in-DID: validateCPOEAgainstScope", () => {
  // --- Framework constraints ---

  test("should pass when CPOE framework is in allowed frameworks", () => {
    const cpoe = makeCPOEPayload({ frameworks: { SOC2: { controlsMapped: 5, passed: 5, failed: 0, controls: [] } } });
    const scope = makeScope({ frameworks: ["SOC2", "NIST-800-53"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  test("should fail when CPOE framework is not in allowed frameworks", () => {
    const cpoe = makeCPOEPayload({ frameworks: { "ISO-27001": { controlsMapped: 5, passed: 5, failed: 0, controls: [] } } });
    const scope = makeScope({ frameworks: ["SOC2", "NIST-800-53"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain("ISO-27001");
  });

  test("should pass when no framework constraint is set (all allowed)", () => {
    const cpoe = makeCPOEPayload({ frameworks: { "HIPAA": { controlsMapped: 3, passed: 3, failed: 0, controls: [] } } });
    const scope = makeScope({}); // no frameworks field
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  test("should pass when frameworks list is empty (all allowed)", () => {
    const cpoe = makeCPOEPayload({ frameworks: { SOC2: { controlsMapped: 5, passed: 5, failed: 0, controls: [] } } });
    const scope = makeScope({ frameworks: [] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  test("should fail when multiple frameworks present and one is not allowed", () => {
    const cpoe = makeCPOEPayload({
      frameworks: {
        SOC2: { controlsMapped: 5, passed: 5, failed: 0, controls: [] },
        PCI: { controlsMapped: 3, passed: 3, failed: 0, controls: [] },
      },
    });
    const scope = makeScope({ frameworks: ["SOC2"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v: string) => v.includes("PCI"))).toBe(true);
  });

  // --- Assurance level constraints ---

  test("should pass when assurance is at max level", () => {
    const cpoe = makeCPOEPayload({ assuranceDeclared: 2 });
    const scope = makeScope({ maxAssurance: 2 });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  test("should pass when assurance is below max level", () => {
    const cpoe = makeCPOEPayload({ assuranceDeclared: 1 });
    const scope = makeScope({ maxAssurance: 3 });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  test("should fail when assurance exceeds max level", () => {
    const cpoe = makeCPOEPayload({ assuranceDeclared: 3 });
    const scope = makeScope({ maxAssurance: 2 });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v: string) => v.includes("assurance"))).toBe(true);
  });

  test("should pass when no maxAssurance constraint (unrestricted)", () => {
    const cpoe = makeCPOEPayload({ assuranceDeclared: 4 });
    const scope = makeScope({}); // no maxAssurance
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  // --- Source constraints ---

  test("should pass when provenance source is in allowed sources", () => {
    const cpoe = makeCPOEPayload({ provenanceSource: "tool" });
    const scope = makeScope({ allowedSources: ["tool", "auditor"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  test("should fail when provenance source is not in allowed sources", () => {
    const cpoe = makeCPOEPayload({ provenanceSource: "self" });
    const scope = makeScope({ allowedSources: ["tool", "auditor"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v: string) => v.includes("self"))).toBe(true);
  });

  test("should pass when no allowedSources constraint (all allowed)", () => {
    const cpoe = makeCPOEPayload({ provenanceSource: "self" });
    const scope = makeScope({}); // no allowedSources
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  // --- Purpose constraints ---

  test("should pass when purpose includes sign", () => {
    const cpoe = makeCPOEPayload();
    const scope = makeScope({ purpose: ["sign", "attest"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  test("should fail when purpose does not include sign", () => {
    const cpoe = makeCPOEPayload();
    const scope = makeScope({ purpose: ["revoke"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v: string) => v.includes("purpose"))).toBe(true);
  });

  test("should pass when no purpose constraint (all allowed)", () => {
    const cpoe = makeCPOEPayload();
    const scope = makeScope({}); // no purpose
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
  });

  // --- Combined constraints ---

  test("should collect multiple violations when several constraints fail", () => {
    const cpoe = makeCPOEPayload({
      assuranceDeclared: 4,
      provenanceSource: "self",
      frameworks: { PCI: { controlsMapped: 5, passed: 5, failed: 0, controls: [] } },
    });
    const scope = makeScope({
      frameworks: ["SOC2"],
      maxAssurance: 2,
      allowedSources: ["tool"],
      purpose: ["revoke"],
    });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(3);
  });

  test("should pass when all constraints are satisfied", () => {
    const cpoe = makeCPOEPayload({
      assuranceDeclared: 1,
      provenanceSource: "tool",
      frameworks: { SOC2: { controlsMapped: 10, passed: 9, failed: 1, controls: [] } },
    });
    const scope = makeScope({
      frameworks: ["SOC2", "NIST-800-53"],
      maxAssurance: 2,
      allowedSources: ["tool", "auditor"],
      purpose: ["sign", "attest"],
    });
    const result = validateCPOEAgainstScope(cpoe, scope);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  // --- Edge: no frameworks on CPOE ---

  test("should pass when CPOE has no frameworks field and scope has framework constraint", () => {
    const cpoe = makeCPOEPayload({ frameworks: undefined });
    const scope = makeScope({ frameworks: ["SOC2"] });
    const result = validateCPOEAgainstScope(cpoe, scope);
    // No frameworks present = nothing to violate
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// DID DOCUMENT GENERATION TESTS
// =============================================================================

describe("CAA-in-DID: generateCorsairDIDDocument", () => {
  test("should generate a DID document without scope (backwards compatible)", () => {
    const doc = generateCorsairDIDDocument("example.com", {
      kty: "OKP",
      crv: "Ed25519",
      x: "dGVzdC1rZXk",
    });

    expect(doc.id).toBe("did:web:example.com");
    expect(doc.verificationMethod).toHaveLength(1);
    expect(doc.verificationMethod[0].id).toBe("did:web:example.com#key-1");

    // No corsairScope should be present
    const vm = doc.verificationMethod[0] as CorsairVerificationMethod;
    expect(vm.corsairScope).toBeUndefined();
  });

  test("should generate a DID document with scope constraints", () => {
    const scope: CorsairDIDScope = {
      frameworks: ["SOC2"],
      maxAssurance: 2,
      purpose: ["sign"],
      allowedSources: ["tool"],
    };

    const doc = generateCorsairDIDDocument(
      "example.com",
      { kty: "OKP", crv: "Ed25519", x: "dGVzdC1rZXk" },
      scope,
    );

    const vm = doc.verificationMethod[0] as CorsairVerificationMethod;
    expect(vm.corsairScope).toBeDefined();
    expect(vm.corsairScope!.frameworks).toEqual(["SOC2"]);
    expect(vm.corsairScope!.maxAssurance).toBe(2);
    expect(vm.corsairScope!.purpose).toEqual(["sign"]);
    expect(vm.corsairScope!.allowedSources).toEqual(["tool"]);
  });

  test("should handle domain with port (percent-encoded)", () => {
    const doc = generateCorsairDIDDocument("localhost:3000", {
      kty: "OKP",
      crv: "Ed25519",
      x: "dGVzdC1rZXk",
    });

    expect(doc.id).toBe("did:web:localhost%3A3000");
    expect(doc.verificationMethod[0].controller).toBe("did:web:localhost%3A3000");
  });

  test("should include proper DID context and assertion method", () => {
    const doc = generateCorsairDIDDocument("grcorsair.com", {
      kty: "OKP",
      crv: "Ed25519",
      x: "dGVzdC1rZXk",
    });

    expect(doc["@context"]).toContain("https://www.w3.org/ns/did/v1");
    expect(doc.authentication).toContain("did:web:grcorsair.com#key-1");
    expect(doc.assertionMethod).toContain("did:web:grcorsair.com#key-1");
  });
});

// =============================================================================
// EXTRACT SCOPE FROM DID DOCUMENT
// =============================================================================

describe("CAA-in-DID: extractScopeFromDIDDocument", () => {
  test("should extract scope for a matching key ID", () => {
    const scope: CorsairDIDScope = { frameworks: ["SOC2"], maxAssurance: 3 };
    const doc = makeCorsairDIDDoc(scope);
    const result = extractScopeFromDIDDocument(doc, "did:web:grcorsair.com#key-1");
    expect(result).toBeDefined();
    expect(result!.frameworks).toEqual(["SOC2"]);
  });

  test("should return undefined when key ID not found", () => {
    const doc = makeCorsairDIDDoc({ frameworks: ["SOC2"] });
    const result = extractScopeFromDIDDocument(doc, "did:web:grcorsair.com#key-99");
    expect(result).toBeUndefined();
  });

  test("should return undefined when verification method has no corsairScope", () => {
    const doc = makeCorsairDIDDoc(); // no scope
    const result = extractScopeFromDIDDocument(doc, "did:web:grcorsair.com#key-1");
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// CAA VERIFICATION (END-TO-END)
// =============================================================================

describe("CAA-in-DID: verifyCPOEWithCAA", () => {
  test("should return scopeValid=true when no scope constraints exist (backwards compat)", () => {
    const cpoe = makeCPOEPayload();
    const doc = makeCorsairDIDDoc(); // no scope
    const result = verifyCPOEWithCAA(cpoe, doc, "did:web:grcorsair.com#key-1");
    expect(result.scopeValid).toBe(true);
    expect(result.scopeViolations).toHaveLength(0);
    expect(result.scopeChecked).toBe(false);
  });

  test("should return scopeValid=true when CPOE satisfies all scope constraints", () => {
    const cpoe = makeCPOEPayload({
      assuranceDeclared: 1,
      provenanceSource: "tool",
      frameworks: { SOC2: { controlsMapped: 10, passed: 9, failed: 1, controls: [] } },
    });
    const scope: CorsairDIDScope = {
      frameworks: ["SOC2"],
      maxAssurance: 2,
      allowedSources: ["tool"],
      purpose: ["sign"],
    };
    const doc = makeCorsairDIDDoc(scope);
    const result = verifyCPOEWithCAA(cpoe, doc, "did:web:grcorsair.com#key-1");
    expect(result.scopeValid).toBe(true);
    expect(result.scopeViolations).toHaveLength(0);
    expect(result.scopeChecked).toBe(true);
  });

  test("should return scopeValid=false when CPOE violates scope constraints", () => {
    const cpoe = makeCPOEPayload({
      assuranceDeclared: 4,
      provenanceSource: "self",
    });
    const scope: CorsairDIDScope = {
      maxAssurance: 2,
      allowedSources: ["tool"],
    };
    const doc = makeCorsairDIDDoc(scope);
    const result = verifyCPOEWithCAA(cpoe, doc, "did:web:grcorsair.com#key-1");
    expect(result.scopeValid).toBe(false);
    expect(result.scopeViolations.length).toBeGreaterThan(0);
    expect(result.scopeChecked).toBe(true);
  });

  test("should return scopeChecked=false when key ID is not found in DID doc", () => {
    const cpoe = makeCPOEPayload();
    const doc = makeCorsairDIDDoc({ maxAssurance: 1 });
    const result = verifyCPOEWithCAA(cpoe, doc, "did:web:grcorsair.com#key-99");
    expect(result.scopeValid).toBe(true);
    expect(result.scopeChecked).toBe(false);
  });
});
