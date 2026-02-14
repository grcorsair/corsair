/**
 * SCITT Types - Supply Chain Integrity, Transparency and Trust
 *
 * Type definitions for SCITT transparency log integration in Parley.
 * Based on IETF SCITT Architecture (draft-ietf-scitt-architecture).
 *
 * SCITT provides a transparency log where CPOEs are registered,
 * producing verifiable receipts (COSE signed inclusion proofs).
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * A SCITT receipt is a cryptographic proof that a statement has been
 * registered in a transparency log. Contains a COSE receipt for verification.
 */
export interface SCITTReceipt {
  /** Unique identifier for the log entry */
  entryId: string;

  /** ISO 8601 timestamp when the entry was registered */
  registrationTime: string;

  /** Identifier of the transparency log */
  logId: string;

  /** COSE receipt (opaque base64 for now, will be typed when IETF finalizes) */
  proof: string;
}

/**
 * Result of registering a statement with a SCITT transparency service.
 */
export interface SCITTRegistration {
  /** Unique identifier for the registered entry */
  entryId: string;

  /** ISO 8601 timestamp of registration */
  registrationTime: string;

  /** Registration status */
  status: "registered" | "pending" | "failed";
}

/**
 * Metadata about a SCITT transparency log.
 */
export interface TransparencyLog {
  /** Unique identifier for the log */
  logId: string;

  /** Name of the log operator */
  operator: string;

  /** Base endpoint URL for the log API */
  endpoint: string;

  /** Cryptographic algorithms supported by this log */
  supportedAlgorithms: string[];
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Configuration for connecting to a SCITT transparency service.
 */
export interface SCITTConfig {
  /** Base URL of the SCITT log endpoint */
  logEndpoint: string;

  /** Identifier of the target log */
  logId: string;

  /** Optional registration policy (e.g., "open", "restricted") */
  registrationPolicy?: string;
}

// =============================================================================
// REGISTRY INTERFACE
// =============================================================================

/**
 * Interface for interacting with a SCITT transparency service.
 * Implementations can be mock (for testing) or real (for production).
 */
export interface SCITTRegistry {
  /** Register a signed statement (JWT-VC) with the transparency log */
  register(statement: string, options?: { proofOnly?: boolean }): Promise<SCITTRegistration>;

  /** Retrieve a receipt for a previously registered entry */
  getReceipt(entryId: string): Promise<SCITTReceipt | null>;
}

// =============================================================================
// INCLUSION PROOF & COSE RECEIPT (for Postgres-backed SCITT)
// =============================================================================

/**
 * Merkle inclusion proof for a SCITT transparency log entry.
 */
export interface SCITTInclusionProof {
  leafIndex: number;
  treeSize: number;
  hashes: string[];
}

/**
 * COSE receipt wrapping a signed inclusion proof.
 * The coseBytes field is base64-encoded COSE_Sign1.
 */
export interface COSEReceipt {
  coseBytes: string; // base64-encoded COSE_Sign1
  logId: string;
  treeSize: number;
  treeHash: string;
}

// =============================================================================
// LIST & PROFILE TYPES (for SCITT log browsing)
// =============================================================================

/** Provenance metadata — who produced the evidence (primary signal) */
export interface SCITTProvenance {
  /** Evidence source: self-reported, tool-generated, or auditor-attested */
  source: "self" | "tool" | "auditor" | "unknown";
  /** Identity of the source (e.g., "Prowler v3.1", "Deloitte LLP") */
  sourceIdentity?: string;
}

/** A single entry in the SCITT transparency log listing */
export interface SCITTListEntry {
  entryId: string;
  registrationTime: string;
  treeSize: number;
  issuer: string;
  scope: string;
  /** Provenance — who produced the evidence (primary signal) */
  provenance: SCITTProvenance;
  /** Assurance level — optional enrichment (secondary, only with --enrich) */
  assuranceLevel?: number;
  summary?: {
    controlsTested: number;
    controlsPassed: number;
    controlsFailed: number;
    overallScore: number;
  };
  /** True when entry was registered in proof-only mode (no statement stored) */
  proofOnly?: boolean;
}

/** Options for listing SCITT entries */
export interface SCITTListOptions {
  limit?: number;
  offset?: number;
  after?: string;
  issuer?: string;
  framework?: string;
}

/** Aggregated provenance distribution for an issuer */
export interface ProvenanceSummary {
  self: number;
  tool: number;
  auditor: number;
}

/** Aggregated profile for a CPOE issuer */
export interface IssuerProfile {
  issuerDID: string;
  totalCPOEs: number;
  frameworks: string[];
  averageScore: number;
  /** Provenance distribution across all CPOEs (primary signal) */
  provenanceSummary: ProvenanceSummary;
  /** Highest assurance level seen (optional, secondary) */
  currentAssuranceLevel?: number;
  lastCPOEDate: string;
  history: Array<{
    entryId: string;
    registrationTime: string;
    scope: string;
    score: number;
    provenance: SCITTProvenance;
    assuranceLevel?: number;
  }>;
}
