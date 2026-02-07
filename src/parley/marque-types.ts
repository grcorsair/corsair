/**
 * MARQUE Types - Corsair Proof of Operational Effectiveness
 *
 * Defines the complete type system for MARQUE documents, which serve as
 * cryptographically signed attestations that security controls are
 * operationally effective (not just existing).
 *
 * The MARQUE document format is versioned via the "parley" field (protocol version).
 */

// =============================================================================
// CORE DOCUMENT
// =============================================================================

/**
 * Top-level MARQUE document. Contains the protocol version, the MARQUE payload,
 * and a cryptographic signature over the marque field.
 */
export interface MarqueDocument {
  /** Protocol version identifier (e.g., "1.0") */
  parley: string;

  /** The MARQUE payload containing all assessment data */
  marque: {
    /** Unique identifier for this MARQUE */
    id: string;

    /** Document format version */
    version: string;

    /** Entity that generated this MARQUE */
    issuer: MarqueIssuer;

    /** ISO 8601 timestamp when this MARQUE was generated */
    generatedAt: string;

    /** ISO 8601 timestamp when this MARQUE expires */
    expiresAt: string;

    /** Scope of the assessment */
    scope: MarqueScope;

    /** High-level summary of assessment results */
    summary: MarqueSummary;

    /** Evidence chain metadata for auditability */
    evidenceChain: MarqueEvidenceChain;

    /** Per-framework compliance results */
    frameworks: Record<string, MarqueFrameworkResult>;

    /** Optional threat model summary (from STRIDE analysis) */
    threatModel?: MarqueThreatModelSummary;

    /** Optional quartermaster (AI) attestation of confidence */
    quartermasterAttestation?: MarqueQuartermasterAttestation;
  };

  /** Base64-encoded Ed25519 signature over the serialized marque field */
  signature: string;
}

// =============================================================================
// ISSUER
// =============================================================================

/**
 * Identifies the entity that generated the MARQUE document.
 */
export interface MarqueIssuer {
  /** Unique identifier for the issuer */
  id: string;

  /** Human-readable issuer name */
  name: string;

  /** Optional organization the issuer belongs to */
  organization?: string;

  /** Optional DID for Parley protocol (e.g., "did:web:grcorsair.com") */
  did?: string;
}

// =============================================================================
// MARQUE OUTPUT (dual format support)
// =============================================================================

/**
 * Unified output type that can carry either a JWT-VC encoded CPOE
 * or a JSON envelope MarqueDocument.
 */
export interface MarqueOutput {
  /** Output format: "vc" for JWT-VC (standard), "v1" for JSON envelope */
  format: "v1" | "vc";

  /** JSON envelope MarqueDocument (present when format is "v1") */
  v1?: MarqueDocument;

  /** JWT-VC encoded string (present when format is "vc") */
  jwt?: string;

  /** Unique MARQUE identifier */
  marqueId: string;

  /** ISO 8601 timestamp when issued */
  issuedAt: string;

  /** ISO 8601 timestamp when it expires */
  expiresAt: string;
}

// =============================================================================
// SCOPE
// =============================================================================

/**
 * Defines the assessment scope -- what providers, resources, and frameworks
 * were covered by this MARQUE.
 */
export interface MarqueScope {
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
export interface MarqueSummary {
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
 * Metadata about the cryptographic evidence chain backing this MARQUE.
 * Links to the JSONL evidence store with SHA-256 hash chains.
 */
export interface MarqueEvidenceChain {
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
export interface MarqueFrameworkResult {
  /** Total controls mapped from this framework */
  controlsMapped: number;

  /** Number of controls that passed */
  passed: number;

  /** Number of controls that failed */
  failed: number;

  /** Individual control results */
  controls: MARQUEControlResult[];
}

/**
 * Individual control assessment result within a framework.
 */
export interface MARQUEControlResult {
  /** Framework-specific control identifier (e.g., "AC-2", "CC6.1") */
  controlId: string;

  /** Assessment status */
  status: "passed" | "failed" | "not-tested";
}

// =============================================================================
// THREAT MODEL SUMMARY
// =============================================================================

/**
 * Summary of threat modeling analysis included in the MARQUE.
 * Typically generated from STRIDE analysis.
 */
export interface MarqueThreatModelSummary {
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
 * AI-generated attestation of confidence in the MARQUE findings.
 * The "quartermaster" is the AI evaluator that reviews evidence quality.
 */
export interface MarqueQuartermasterAttestation {
  /** Overall confidence score (0.0 - 1.0) */
  confidenceScore: number;

  /** Individual evaluation dimensions with scores */
  dimensions: MARQUEAttestationDimension[];

  /** Trust tier classification */
  trustTier: "self-assessed" | "ai-verified" | "auditor-verified";

  /** ISO 8601 timestamp when evaluation was performed */
  evaluatedAt: string;

  /** Hash of the full report that was evaluated */
  reportHash: string;
}

/**
 * A single dimension of the quartermaster attestation evaluation.
 */
export interface MARQUEAttestationDimension {
  /** Name of the evaluation dimension */
  dimension: string;

  /** Score for this dimension (0.0 - 1.0) */
  score: number;
}
