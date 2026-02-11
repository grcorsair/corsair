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

// =============================================================================
// EVIDENCE TYPE HIERARCHY (ISO 19011 + SOC 2 + NIST 800-53A)
// =============================================================================

/**
 * Evidence type ranked by reliability across three converging frameworks:
 * ISO 19011 reliability hierarchy + SOC 2 test methods + NIST 800-53A methods.
 *
 * Ordered from highest to lowest reliability.
 */
export type EvidenceType =
  | "automated-observation"   // Highest: CAAT, continuous monitoring (SOC 2: CAAT, NIST: Test-Comprehensive)
  | "system-generated-record" // System logs, config exports (SOC 2: Inspection, NIST: Examine-Focused)
  | "reperformance"           // Assessor re-executes procedure (SOC 2: Reperformance, NIST: Test-Focused)
  | "documented-record"       // Policies, procedures, reports (SOC 2: Observation, NIST: Examine-Basic)
  | "interview"               // Personnel discussions (SOC 2: Inquiry, NIST: Interview-Basic)
  | "self-attestation";       // Lowest: Self-reported (no SOC 2/NIST equivalent)

// =============================================================================
// SEVEN-DIMENSION ASSURANCE MODEL (FAIR-CAM + GRADE + COSO)
// =============================================================================

/**
 * Seven-dimension assurance model grounded in 8 international frameworks.
 *
 * The Universal Triad (D1-D3) comes from FAIR-CAM × COBIT × COSO convergence:
 * every framework agrees effectiveness = strength × breadth × consistency.
 *
 * The Evidence Quality dimensions (D4-D7) come from GRADE × NIST 800-53A × Three Lines Model.
 *
 * All scores are 0-100. Dimensions are INFORMATIONAL, not gating — the L0-L4
 * declared level remains the SSL-model minimum. Dimensions provide granularity
 * WITHIN a level (a rich L1 vs a thin L1).
 */
export interface AssuranceDimensions {
  /** D1: Capability — "How strong is this control as designed?" (FAIR-CAM, COSO Design Effectiveness, CC EAL) */
  capability: number;
  /** D2: Coverage — "What % of in-scope assets does it protect?" (FAIR-CAM, COBIT, NIST 53A Coverage) */
  coverage: number;
  /** D3: Reliability — "How consistently does it operate?" (FAIR-CAM, COBIT Control, COSO Operating Effectiveness) */
  reliability: number;
  /** D4: Evidence Methodology — "How rigorous was the assessment?" (GRADE Risk of Bias, NIST 53A Depth, SOC 2 methods) */
  methodology: number;
  /** D5: Evidence Freshness — "How recent is the evidence?" (GRADE Imprecision, ISO 27004 timing) */
  freshness: number;
  /** D6: Evidence Independence — "How separated is assessor from assessed?" (Three Lines Model, GRADE Publication Bias) */
  independence: number;
  /** D7: Evidence Consistency — "Do multiple sources agree?" (GRADE Inconsistency, IEC 62443 SL alignment) */
  consistency: number;
}

// =============================================================================
// OBSERVATION PERIOD (COSO Design vs Operating + SOC 2 Type II)
// =============================================================================

/**
 * Observation period mapping to COSO's Design Effectiveness vs Operating Effectiveness
 * distinction — the single most validated finding across all frameworks.
 */
export interface ObservationPeriod {
  /** Assessment start date (ISO 8601) */
  startDate: string;
  /** Assessment end date (ISO 8601) */
  endDate: string;
  /** Duration in calendar days */
  durationDays: number;
  /** Whether the period is sufficient for the declared level (>= 90 days for L2+) */
  sufficient: boolean;
  /** COSO classification: "design-only" (L0-L1) or "operating" (L2+) */
  cosoClassification: "design-only" | "operating";
  /** SOC 2 equivalent period description */
  soc2Equivalent: "Pre-engagement" | "Type I" | "Type II (3mo)" | "Type II (6mo)" | "Type II (12mo)";
}

// =============================================================================
// ANTI-GAMING SAFEGUARD RESULT
// =============================================================================

/** Result of dimension gating — deterministic floor thresholds per level */
export interface DimensionGatingResult {
  /** The effective level after dimension gating */
  gatedLevel: AssuranceLevel;
  /** Thresholds that failed, preventing the declared level */
  failedThresholds: Array<{ dimension: string; required: number; actual: number }>;
}

/** Result of applying anti-gaming safeguards to a declared assurance level */
export interface AntiGamingSafeguardResult {
  /** The effective level after all safeguards are applied */
  effectiveLevel: AssuranceLevel;
  /** Which safeguards were triggered */
  appliedSafeguards: Array<
    | "sampling-opacity"
    | "freshness-decay"
    | "independence-check"
    | "severity-asymmetry"
    | "all-pass-bias"
  >;
  /** Human-readable explanation for each triggered safeguard */
  explanations: string[];
}

// =============================================================================
// LLM ASSESSOR METADATA (Plan 2.4.7)
// =============================================================================

/** LLM assessor audit metadata — only present when LLM was used for assessment */
export interface CPOEAssessor {
  /** Assessor type */
  type: "ai" | "human" | "hybrid";
  /** Model identifier (e.g., "claude-3.5-sonnet-2026-01") */
  model?: string;
  /** SHA-256 hash of the prompt used */
  promptHash?: string;
  /** Unique run identifier */
  runId?: string;
  /** SHA-256 hash of assessment inputs */
  inputsHash?: string;
  /** SHA-256 hash of assessment outputs */
  outputsHash?: string;
}

// =============================================================================
// FRAMEWORK EQUIVALENCE (UI hint, not persisted in CPOE)
// =============================================================================

/** Framework equivalence mapping for display (not a protocol claim) */
export interface FrameworkEquivalence {
  SOC2?: string;
  ISO27001?: string;
  "CSA-STAR"?: string;
  CMMC?: string;
}

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

  /** Controls tolerated under the 5% rule (below declared level but within tolerance) */
  toleratedControls?: Array<{
    controlId: string;
    level: AssuranceLevel;
    reason: string;
  }>;

  /** Deterministic calculation version (e.g., "l0-l4@2026-02-09") */
  calculationVersion?: string;

  /** SHA-256 hash of canonicalized inputs used for level determination */
  inputsHash?: string;

  /** Machine-readable rule trace explaining the level outcome */
  ruleTrace?: string[];

  /** Dimension gating result (Phase 2 — which thresholds failed) */
  dimensionGating?: DimensionGatingResult;

  /** LLM assessor audit metadata (only when LLM was used) */
  assessor?: CPOEAssessor;
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

  /** Distribution of evidence types by percentage (ISO 19011 hierarchy) */
  evidenceTypeDistribution?: Record<string, number>;
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

  /** Optional 7-dimension assurance scores (FAIR-CAM + GRADE + COSO grounded) */
  dimensions?: AssuranceDimensions;

  /** Optional evidence types present in the assessment (ISO 19011 hierarchy) */
  evidenceTypes?: EvidenceType[];

  /** Optional observation period (COSO Design vs Operating Effectiveness) */
  observationPeriod?: ObservationPeriod;

  /** Per-control evidence classification (Phase 1 — Scaffolded Intelligence) */
  controlClassifications?: Array<{
    controlId: string;
    level: AssuranceLevel;
    methodology: string;
    trace: string;
    sampleAdequacy?: { sample: number; population?: number; frequency?: string; adequate: boolean };
    boilerplateFlags?: string[];
  }>;

  /** Optional CRQ risk quantification (BetaPERT + FAIR-CAM mapping) */
  riskQuantification?: CPOERiskQuantification;

  /** NIST 800-53A assessment depth classification (Phase 6A) */
  assessmentDepth?: {
    methods: Array<"examine" | "interview" | "test">;
    depth: "basic" | "focused" | "comprehensive";
    rigorScore: number;
  };

  /** SLSA-inspired provenance quality score (Phase 6B) */
  provenanceQuality?: number;

  /** CIS-style binary evidence quality checks (Phase 6C) */
  binaryChecks?: { passed: number; total: number; checks: Record<string, boolean> };

  /** DORA-style paired anti-gaming metrics (Phase 6D) */
  doraMetrics?: {
    freshness: number;
    specificity: number;
    independence: number;
    reproducibility: number;
    band: "elite" | "high" | "medium" | "low";
    pairingFlags: string[];
  };
}

// =============================================================================
// CRQ RISK QUANTIFICATION
// =============================================================================

/**
 * Risk quantification output for CRQ platform consumption.
 * Maps CPOE assurance data to FAIR-CAM and BetaPERT models.
 */
export interface CPOERiskQuantification {
  /** BetaPERT distribution parameters for Monte Carlo simulation */
  betaPert: {
    /** Shape parameter: 2/4/6/8/10 for L0-L4 */
    shapeParameter: number;
    /** Confidence width description */
    confidenceWidth: "very-wide" | "wide" | "moderate" | "narrow" | "very-narrow";
  };
  /** FAIR-CAM operational efficacy mapping */
  fairMapping: {
    /** Resistance strength derived from assurance level */
    resistanceStrength: "very-low" | "low" | "moderate" | "high" | "very-high";
    /** Control effectiveness from pass rate (0-1) */
    controlEffectiveness: number;
    /** FAIR-CAM function classification */
    controlFunction: "loss-event" | "variance-management" | "decision-support";
  };
  /** Three Lines Model provenance modifier: self=0.75, tool=1.0, auditor=1.25 */
  provenanceModifier: number;
  /** Freshness decay factor: 1.0 (fresh) → 0.0 (365+ days) */
  freshnessDecay: number;
  /** Aggregate confidence from 7 dimensions (geometric mean, 0-1) */
  dimensionConfidence: number;
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
  parley: "2.0" | "2.1";
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
