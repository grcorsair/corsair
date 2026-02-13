/**
 * CAA-in-DID — Scope Constraints per Signing Key in DID Documents
 *
 * Like DNS CAA records but for compliance signing. Tells verifiers what a
 * signing key is authorized to sign. The corsairScope field is a Corsair
 * extension on the verification method — other implementations gracefully
 * ignore it.
 *
 * Design principles:
 * - Backwards compatible: if corsairScope is absent, key is unrestricted
 * - corsairScope sits on the verification method, NOT the DID document root
 * - Empty arrays / undefined fields mean "no constraint" (all allowed)
 */

import type { DIDDocument, VerificationMethod } from "./did-resolver";
import type { VCJWTPayload, AssuranceLevel, CPOECredentialSubject } from "./vc-types";

// =============================================================================
// TYPES
// =============================================================================

/** CAA-like scope constraint for a signing key */
export interface CorsairDIDScope {
  /** Frameworks this key can sign for. Empty/undefined = all allowed. */
  frameworks?: string[];

  /** Maximum assurance level this key can declare. Undefined = unrestricted. */
  maxAssurance?: AssuranceLevel;

  /** Key purpose constraints. Undefined = all allowed. */
  purpose?: ("sign" | "attest" | "revoke")[];

  /** Authorized evidence sources. Undefined = all allowed. */
  allowedSources?: ("self" | "tool" | "auditor")[];
}

/** Verification method extended with Corsair scope constraints */
export interface CorsairVerificationMethod extends VerificationMethod {
  /** CAA-like scope constraints (Corsair extension — ignored by non-Corsair implementations) */
  corsairScope?: CorsairDIDScope;
}

/** DID document with Corsair-extended verification methods */
export interface CorsairDIDDocument extends Omit<DIDDocument, "verificationMethod"> {
  verificationMethod: CorsairVerificationMethod[];
}

/** Result of validating a CPOE against a key's scope */
export interface ScopeValidationResult {
  /** Whether the CPOE satisfies all scope constraints */
  valid: boolean;

  /** Human-readable violation descriptions (empty if valid) */
  violations: string[];
}

/** Result of CAA verification against a DID document */
export interface CAAVerificationResult {
  /** Whether the CPOE satisfies the key's scope constraints */
  scopeValid: boolean;

  /** Human-readable violation descriptions */
  scopeViolations: string[];

  /** Whether scope constraints were actually checked (false if no scope or key not found) */
  scopeChecked: boolean;
}

// =============================================================================
// SCOPE VALIDATION
// =============================================================================

/**
 * Validate a CPOE payload against a key's scope constraints.
 *
 * Checks:
 * - Framework is allowed (if frameworks constraint exists)
 * - Assurance level <= maxAssurance (if maxAssurance constraint exists)
 * - Provenance source is allowed (if allowedSources constraint exists)
 * - Key purpose includes "sign" (if purpose constraint exists)
 */
export function validateCPOEAgainstScope(
  cpoePayload: VCJWTPayload,
  scope: CorsairDIDScope,
): ScopeValidationResult {
  const violations: string[] = [];
  const subject = cpoePayload.vc.credentialSubject as CPOECredentialSubject;

  // --- Framework constraint ---
  if (scope.frameworks && scope.frameworks.length > 0) {
    const cpoeFrameworks = subject.frameworks;
    if (cpoeFrameworks) {
      const disallowed = Object.keys(cpoeFrameworks).filter(
        (fw) => !scope.frameworks!.includes(fw),
      );
      for (const fw of disallowed) {
        violations.push(
          `Framework "${fw}" is not in the key's allowed frameworks: [${scope.frameworks!.join(", ")}]`,
        );
      }
    }
    // If CPOE has no frameworks field, nothing to violate
  }

  // --- Assurance level constraint ---
  if (scope.maxAssurance !== undefined) {
    const declared = subject.assurance?.declared;
    if (declared !== undefined && declared > scope.maxAssurance) {
      violations.push(
        `Declared assurance level ${declared} exceeds key's maximum assurance level ${scope.maxAssurance}`,
      );
    }
  }

  // --- Source constraint ---
  if (scope.allowedSources && scope.allowedSources.length > 0) {
    const source = subject.provenance?.source;
    if (source && !scope.allowedSources.includes(source)) {
      violations.push(
        `Provenance source "${source}" is not in the key's allowed sources: [${scope.allowedSources.join(", ")}]`,
      );
    }
  }

  // --- Purpose constraint ---
  if (scope.purpose && scope.purpose.length > 0) {
    if (!scope.purpose.includes("sign")) {
      violations.push(
        `Key purpose [${scope.purpose.join(", ")}] does not include "sign" — this key cannot sign CPOEs`,
      );
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

// =============================================================================
// DID DOCUMENT GENERATION
// =============================================================================

/**
 * Generate a Corsair-extended DID document with optional scope constraints.
 *
 * If no scope is provided, generates a standard DID document (backwards
 * compatible — the corsairScope field is simply absent).
 */
export function generateCorsairDIDDocument(
  domain: string,
  publicKeyJwk: JsonWebKey,
  scope?: CorsairDIDScope,
): CorsairDIDDocument {
  const encodedDomain = domain.replace(/:/g, "%3A");
  const did = `did:web:${encodedDomain}`;
  const keyId = `${did}#key-1`;

  const vm: CorsairVerificationMethod = {
    id: keyId,
    type: "JsonWebKey2020",
    controller: did,
    publicKeyJwk,
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
// SCOPE EXTRACTION
// =============================================================================

/**
 * Extract the corsairScope from a DID document for a specific key ID.
 *
 * Returns undefined if:
 * - The key ID is not found in the DID document
 * - The matching verification method has no corsairScope
 */
export function extractScopeFromDIDDocument(
  didDocument: CorsairDIDDocument,
  keyId: string,
): CorsairDIDScope | undefined {
  const vm = didDocument.verificationMethod.find((m) => m.id === keyId);
  if (!vm) return undefined;
  return vm.corsairScope;
}

// =============================================================================
// CAA VERIFICATION
// =============================================================================

/**
 * Verify a CPOE payload against CAA scope constraints in a DID document.
 *
 * After standard signature verification (handled elsewhere), this checks
 * whether the signing key was authorized to sign this type of CPOE.
 *
 * Backwards compatible: if the key has no corsairScope, returns
 * scopeValid=true with scopeChecked=false.
 */
export function verifyCPOEWithCAA(
  cpoePayload: VCJWTPayload,
  didDocument: CorsairDIDDocument,
  keyId: string,
): CAAVerificationResult {
  const scope = extractScopeFromDIDDocument(didDocument, keyId);

  // No scope found (key not in doc, or no corsairScope) — backwards compatible
  if (!scope) {
    return {
      scopeValid: true,
      scopeViolations: [],
      scopeChecked: false,
    };
  }

  const validation = validateCPOEAgainstScope(cpoePayload, scope);

  return {
    scopeValid: validation.valid,
    scopeViolations: validation.violations,
    scopeChecked: true,
  };
}
