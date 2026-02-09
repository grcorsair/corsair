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
// ASSURANCE & PROVENANCE TYPES
// =============================================================================

/** Assurance level — L0 (Documented) through L4 (Attested) */
export type AssuranceLevel = 0 | 1 | 2 | 3 | 4;

/** Human-readable assurance level names */
export const ASSURANCE_NAMES: Record<AssuranceLevel, string> = {
  0: "Documented",
  1: "Configured",
  2: "Demonstrated",
  3: "Observed",
  4: "Attested",
};

/** Assurance metadata for a CPOE */
export interface CPOEAssurance {
  /** Declared assurance level (0-4). Min of all in-scope controls. */
  declared: AssuranceLevel;

  /** Has the declared level been verified against all controls? */
  verified: boolean;

  /** Method used to establish assurance */
  method:
    | "self-assessed"
    | "automated-config-check"
    | "ai-evidence-review"
    | "continuous-observation"
    | "third-party-attested";

  /** Count of controls at each level: { "0": 2, "1": 18 } */
  breakdown: Record<string, number>;

  /** Controls explicitly excluded from scope */
  excluded?: Array<{
    controlId: string;
    reason: string;
    acceptedBy?: string;
  }>;
}

/** Evidence provenance — who produced the underlying evidence */
export interface CPOEProvenance {
  /** Source authority type */
  source: "self" | "tool" | "auditor";

  /** Identity of source (e.g., "Deloitte LLP", "Prowler v3.1") */
  sourceIdentity?: string;

  /** SHA-256 hash of the source document */
  sourceDocument?: string;

  /** Date of source assessment (ISO 8601) */
  sourceDate?: string;
}

// =============================================================================
// CORSAIR CPOE CREDENTIAL SUBJECT
// =============================================================================

export interface CPOECredentialSubject extends CredentialSubject {
  /** Discriminator for CPOE credential subjects */
  type: "CorsairCPOE";

  /** Assessment scope (human-readable description) */
  scope: string;

  /** Assurance metadata (required — every CPOE must declare a level) */
  assurance: CPOEAssurance;

  /** Evidence provenance (required — every CPOE must state its source) */
  provenance: CPOEProvenance;

  /** Assessment summary */
  summary: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };

  /** Evidence chain metadata (optional — document ingestion has no chain) */
  evidenceChain?: {
    hashChainRoot: string;
    recordCount: number;
    chainVerified: boolean;
  };

  /** Per-framework compliance results (optional) */
  frameworks?: Record<
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
