/**
 * CPOE Types - Corsair Proof of Operational Effectiveness
 *
 * Defines the complete type system for CPOE documents, which serve as
 * cryptographically signed attestations that security controls are
 * operationally effective (not just existing).
 *
 * The CPOE document format is versioned via the "parley" field (protocol version).
 */

// =============================================================================
// CORE DOCUMENT
// =============================================================================

/**
 * Top-level CPOE document. Contains the protocol version, the CPOE payload,
 * and a cryptographic signature over the cpoe field.
 */
export interface CPOEDocument {
  /** Protocol version identifier (e.g., "1.0") */
  parley: string;

  /** The CPOE payload containing all assessment data */
  cpoe: {
    /** Unique identifier for this CPOE */
    id: string;

    /** Document format version */
    version: string;

    /** Entity that generated this CPOE */
    issuer: CPOEIssuer;

    /** ISO 8601 timestamp when this CPOE was generated */
    generatedAt: string;

    /** ISO 8601 timestamp when this CPOE expires */
    expiresAt: string;

    /** Scope of the assessment */
    scope: CPOEScope;

    /** High-level summary of assessment results */
    summary: CPOESummary;

    /** Evidence chain metadata for auditability */
    evidenceChain: CPOEEvidenceChain;

    /** Per-framework compliance results */
    frameworks: Record<string, CPOEFrameworkResult>;

    /** Optional threat model summary (from STRIDE analysis) */
    threatModel?: CPOEThreatModelSummary;

    /** Optional admiral (AI) attestation of confidence */
    admiralAttestation?: CPOEAdmiralAttestation;
  };

  /** Base64-encoded Ed25519 signature over the serialized cpoe field */
  signature: string;
}

// =============================================================================
// ISSUER
// =============================================================================

/**
 * Identifies the entity that generated the CPOE document.
 */
export interface CPOEIssuer {
  /** Unique identifier for the issuer */
  id: string;

  /** Human-readable issuer name */
  name: string;

  /** Optional organization the issuer belongs to */
  organization?: string;
}

// =============================================================================
// SCOPE
// =============================================================================

/**
 * Defines the assessment scope -- what providers, resources, and frameworks
 * were covered by this CPOE.
 */
export interface CPOEScope {
  /** Cloud/SaaS providers included in the assessment */
  providers: string[];

  /** Total number of resources evaluated */
  resourceCount: number;

  /** Compliance frameworks covered */
  frameworksCovered: string[];
}

// =============================================================================
// SUMMARY
// =============================================================================

/**
 * High-level summary of the assessment results.
 * overallScore is a 0-100 percentage.
 */
export interface CPOESummary {
  /** Total controls tested */
  controlsTested: number;

  /** Controls that passed operational effectiveness testing */
  controlsPassed: number;

  /** Controls that failed operational effectiveness testing */
  controlsFailed: number;

  /** Overall score as a percentage (0-100) */
  overallScore: number;
}

// =============================================================================
// EVIDENCE CHAIN
// =============================================================================

/**
 * Metadata about the cryptographic evidence chain backing this CPOE.
 * Links to the JSONL evidence store with SHA-256 hash chains.
 */
export interface CPOEEvidenceChain {
  /** Root hash of the evidence chain */
  hashChainRoot: string;

  /** Total number of evidence records in the chain */
  recordCount: number;

  /** Whether the hash chain was verified as intact */
  chainVerified: boolean;
}

// =============================================================================
// FRAMEWORK RESULT
// =============================================================================

/**
 * Per-framework compliance assessment results.
 * Contains both aggregate counts and individual control statuses.
 */
export interface CPOEFrameworkResult {
  /** Total controls mapped from this framework */
  controlsMapped: number;

  /** Number of controls that passed */
  passed: number;

  /** Number of controls that failed */
  failed: number;

  /** Individual control results */
  controls: CPOEControlResult[];
}

/**
 * Individual control assessment result within a framework.
 */
export interface CPOEControlResult {
  /** Framework-specific control identifier (e.g., "AC-2", "CC6.1") */
  controlId: string;

  /** Assessment status */
  status: "passed" | "failed" | "not-tested";
}

// =============================================================================
// THREAT MODEL SUMMARY
// =============================================================================

/**
 * Summary of threat modeling analysis included in the CPOE.
 * Typically generated from STRIDE analysis.
 */
export interface CPOEThreatModelSummary {
  /** Threat modeling methodology used (e.g., "STRIDE") */
  methodology: string;

  /** Providers analyzed during threat modeling */
  providersAnalyzed: string[];

  /** Total number of threats identified */
  totalThreats: number;

  /** Distribution of threats by risk level */
  riskDistribution: Record<string, number>;
}

// =============================================================================
// ADMIRAL ATTESTATION
// =============================================================================

/**
 * AI-generated attestation of confidence in the CPOE findings.
 * The "admiral" is the AI evaluator that reviews evidence quality.
 */
export interface CPOEAdmiralAttestation {
  /** Overall confidence score (0.0 - 1.0) */
  confidenceScore: number;

  /** Individual evaluation dimensions with scores */
  dimensions: CPOEAttestationDimension[];

  /** Trust tier classification */
  trustTier: "self-assessed" | "ai-verified" | "auditor-verified";

  /** ISO 8601 timestamp when evaluation was performed */
  evaluatedAt: string;

  /** Hash of the full report that was evaluated */
  reportHash: string;
}

/**
 * A single dimension of the admiral attestation evaluation.
 */
export interface CPOEAttestationDimension {
  /** Name of the evaluation dimension */
  dimension: string;

  /** Score for this dimension (0.0 - 1.0) */
  score: number;
}
