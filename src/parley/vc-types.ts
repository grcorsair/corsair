/**
 * VC Types - W3C Verifiable Credential 2.0 Types for Parley
 *
 * Defines the type system for Corsair CPOE (Certificate of Proof of
 * Operational Effectiveness) as W3C Verifiable Credentials.
 *
 * Spec reference: https://www.w3.org/TR/vc-data-model-2.0/
 * JWT encoding: https://www.w3.org/TR/vc-jose-cose/
 */

// =============================================================================
// W3C VC 2.0 CORE TYPES
// =============================================================================

export interface VerifiableCredential {
  /** JSON-LD context. Must include W3C VC 2.0 context. */
  "@context": string[];

  /** Credential types. Must include "VerifiableCredential". */
  type: string[];

  /** Optional unique identifier (URI) */
  id?: string;

  /** Issuer DID or issuer object with id and optional name */
  issuer: string | { id: string; name?: string };

  /** ISO 8601 timestamp when credential becomes valid */
  validFrom: string;

  /** ISO 8601 timestamp when credential expires */
  validUntil?: string;

  /** Claims about the subject */
  credentialSubject: CredentialSubject;

  /** Optional embedded proof (not used when JWT-encoded) */
  proof?: VCProof;
}

export interface CredentialSubject {
  /** Optional subject identifier */
  id?: string;

  /** Extensible claim properties */
  [key: string]: unknown;
}

export interface VCProof {
  /** Proof type (e.g., "Ed25519Signature2020") */
  type: string;

  /** ISO 8601 timestamp when proof was created */
  created: string;

  /** URI of the verification method used */
  verificationMethod: string;

  /** Purpose of the proof (e.g., "assertionMethod") */
  proofPurpose: string;

  /** The proof value (signature) */
  proofValue: string;
}

// =============================================================================
// CORSAIR CPOE CREDENTIAL SUBJECT
// =============================================================================

export interface CPOECredentialSubject extends CredentialSubject {
  /** Discriminator for CPOE credential subjects */
  type: "CorsairCPOE";

  /** Assessment scope */
  scope: {
    providers: string[];
    resourceCount: number;
    frameworksCovered: string[];
  };

  /** Assessment summary */
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };

  /** Evidence chain metadata */
  evidenceChain: {
    hashChainRoot: string;
    recordCount: number;
    chainVerified: boolean;
  };

  /** Per-framework compliance results */
  frameworks: Record<
    string,
    {
      controlsMapped: number;
      passed: number;
      failed: number;
      controls: Array<{
        controlId: string;
        status: "passed" | "failed" | "not-tested";
      }>;
    }
  >;

  /** Optional STRIDE threat model summary */
  threatModel?: {
    methodology: string;
    providersAnalyzed: string[];
    totalThreats: number;
    riskDistribution: Record<string, number>;
  };

  /** Optional Quartermaster AI attestation */
  quartermasterAttestation?: {
    confidenceScore: number;
    trustTier: string;
    dimensions: Array<{ dimension: string; score: number }>;
  };
}

// =============================================================================
// JWT-VC TYPES
// =============================================================================

export interface VCJWTHeader {
  /** Algorithm — EdDSA for Ed25519 */
  alg: "EdDSA";

  /** Media type — vc+jwt per VC-JOSE-COSE spec */
  typ: "vc+jwt";

  /** Key identifier — DID URL of the signing key */
  kid: string;
}

export interface VCJWTPayload {
  /** Issuer DID */
  iss: string;

  /** Subject identifier */
  sub: string;

  /** Expiration (Unix timestamp) */
  exp: number;

  /** Issued at (Unix timestamp) */
  iat: number;

  /** Unique identifier (marque ID) */
  jti: string;

  /** VC payload without proof (proof is the JWT itself) */
  vc: Omit<VerifiableCredential, "proof">;

  /** Protocol version marker */
  parley: "2.0";
}

// =============================================================================
// CORSAIR CPOE AS VC
// =============================================================================

export type CorsairCPOE = VerifiableCredential & {
  type: ["VerifiableCredential", "CorsairCPOE"];
  credentialSubject: CPOECredentialSubject;
};

// =============================================================================
// CONSTANTS
// =============================================================================

/** W3C Verifiable Credentials 2.0 context URI */
export const VC_CONTEXT = "https://www.w3.org/ns/credentials/v2";

/** Corsair-specific credential context URI */
export const CORSAIR_CONTEXT = "https://grcorsair.com/credentials/v1";

/** CPOE credential type discriminator */
export const CPOE_TYPE = "CorsairCPOE";
