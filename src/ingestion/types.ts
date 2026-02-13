/**
 * Ingestion Types — Schema Bridge for Document → CPOE Pipeline
 *
 * The canonical intermediate format between any external document
 * (SOC 2 PDF, Prowler JSON, manual CSV) and the MarqueGeneratorInput.
 *
 * Design philosophy:
 *   Layer 1 (Integrity):  Handled by existing MARQUE/Ed25519 — no changes needed
 *   Layer 2 (Context):    AssessmentContext captures structured subjectivity
 *   Layer 3 (Depth):      Future — threat-to-evidence per tech stack
 *
 * Every parser outputs IngestedDocument. The mapper converts it to
 * MarqueGeneratorInput. This separation means adding new document types
 * requires only a new parser, not changes to the signing pipeline.
 */

import type { Severity } from "../types";

// =============================================================================
// CORE INGESTION TYPES
// =============================================================================

/** Supported document source types */
export type DocumentSource =
  | "soc2"
  | "iso27001"
  | "prowler"
  | "securityhub"
  | "pentest"
  | "manual"
  | "json"
  | "ciso-assistant";

/**
 * Assurance levels per the 5-Level Assurance Ladder.
 *
 *   L0 = Claimed    (policy document says so)
 *   L1 = Configured (settings show it's turned on)
 *   L2 = Demonstrated (test results prove it works)
 *   L3 = Observed   (continuous monitoring confirms it)
 *   L4 = Attested   (independent third party verified it)
 */
export type AssuranceLevel = 0 | 1 | 2 | 3 | 4;

/**
 * The canonical ingested document format.
 * Every parser (SOC 2, Prowler, manual) must output this shape.
 */
export interface IngestedDocument {
  /** Where this document came from */
  source: DocumentSource;

  /** Document-level metadata */
  metadata: DocumentMetadata;

  /** Extracted controls with their assessment status */
  controls: IngestedControl[];

  /**
   * Tool-declared assurance level.
   * Set by the parser based on tool class — NOT content analysis.
   *   L0 = human statement (manual, generic)
   *   L1 = machine-observed state (Prowler, SecurityHub, InSpec, Trivy, GitLab)
   *   L2 = assessed/tested result (CISO Assistant with linked evidence)
   */
  toolAssuranceLevel: AssuranceLevel;

  /**
   * Layer 2: Structured Assessment Context (optional).
   * Captures the subjective decisions that make GRC harder than TLS:
   * tech stack, compensating controls, scope gaps, assessor reasoning.
   */
  assessmentContext?: AssessmentContext;
}

// =============================================================================
// METADATA
// =============================================================================

export interface DocumentMetadata {
  /** Document title (e.g., "Acme Corp SOC 2 Type II Report") */
  title: string;

  /** Who issued/authored the document */
  issuer: string;

  /** Assessment date (ISO 8601) */
  date: string;

  /** Scope description */
  scope: string;

  /** Auditor or assessor name (if applicable) */
  auditor?: string;

  /** Document type for display (e.g., "SOC 2 Type II", "Prowler Scan") */
  reportType?: string;

  /** SHA-256 hash of the original document for provenance */
  rawTextHash?: string;

  /** AICPA structural section detection (SOC 2 only — Probo Check 6) */
  structuralSections?: {
    auditorReport: boolean;
    managementAssertion: boolean;
    systemDescription: boolean;
    controlMatrix: boolean;
    testResults: boolean;
  };
}

// =============================================================================
// CONTROLS
// =============================================================================

/** A single control extracted from the source document */
export interface IngestedControl {
  /** Control identifier (e.g., "CC6.1", "AC-2", "check-mfa-enabled") */
  id: string;

  /** Human-readable description of the control */
  description: string;

  /** Assessment status */
  status: "effective" | "ineffective" | "not-tested";

  /** Severity if the control failed */
  severity?: Severity;

  /** Framework references this control maps to */
  frameworkRefs?: FrameworkRef[];

  /** Evidence supporting this control's status */
  evidence?: string;

  /** Assurance level of the evidence (L0-L4) */
  assuranceLevel?: AssuranceLevel;
}

/** A reference to a specific framework control */
export interface FrameworkRef {
  /** Framework name (e.g., "SOC2", "NIST-800-53", "ISO27001") */
  framework: string;

  /** Control identifier within the framework (e.g., "CC6.1", "AC-2") */
  controlId: string;

  /** Human-readable control name */
  controlName?: string;
}

// =============================================================================
// LAYER 2: STRUCTURED ASSESSMENT CONTEXT
// =============================================================================

/**
 * Structured subjectivity — makes GRC decisions auditable.
 *
 * Parley doesn't eliminate subjectivity. It makes it AUDITABLE.
 * An auditor who receives a signed CPOE can disagree with every
 * scope decision, but they can SEE all of them and verify they
 * haven't been changed.
 */
export interface AssessmentContext {
  /** Tech stack details (what systems were assessed) */
  techStack?: TechStackEntry[];

  /** Compensating controls accepted by the assessor */
  compensatingControls?: CompensatingControl[];

  /** Explicit gaps — what was NOT covered */
  gaps?: string[];

  /** Scope coverage estimate (e.g., "85% of interactive user accounts") */
  scopeCoverage?: string;

  /** Assessor notes or methodology description */
  assessorNotes?: string;
}

/** A component of the assessed tech stack */
export interface TechStackEntry {
  /** Component role (e.g., "Primary IdP", "Customer-facing auth") */
  component: string;

  /** Technology name (e.g., "Okta", "AWS Cognito", "Azure AD") */
  technology: string;

  /** What this component covers (e.g., "All employees via SSO") */
  scope: string;
}

/** A compensating control accepted in lieu of the primary control */
export interface CompensatingControl {
  /** What the compensating control is */
  description: string;

  /** Why it's an acceptable substitute */
  rationale: string;

  /** Who accepted this compensating control */
  acceptedBy: string;
}
