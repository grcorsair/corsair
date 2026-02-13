/**
 * Canonical Control Evidence Types — Layer 2 Intelligence Foundation
 *
 * The normalized representation of ANY control evidence, regardless of source tool.
 * This is what the scoring engine (FICO score) will consume.
 *
 * Design: 8 parser formats → IngestedDocument → normalizeDocument() → NormalizedEvidence
 * The normalization engine sits BETWEEN parsers (Layer 1) and scoring (Layer 2).
 */

import type { AssuranceLevel } from "../ingestion/types";

// =============================================================================
// CANONICAL CONTROL EVIDENCE
// =============================================================================

/** Normalized status — tool-agnostic pass/fail/skip/error */
export type CanonicalStatus = "pass" | "fail" | "skip" | "error";

/** Normalized severity — CVSS-aligned canonical scale */
export type CanonicalSeverity = "critical" | "high" | "medium" | "low" | "info";

/** Evidence type classification */
export type EvidenceType = "config" | "scan" | "test" | "observation" | "attestation" | "document";

/** Provenance source classification */
export type ProvenanceSource = "self" | "tool" | "auditor";

/**
 * A single control evidence record in canonical form.
 * Every tool format normalizes to this shape.
 */
export interface CanonicalControlEvidence {
  /** Unique control identifier (normalized) */
  controlId: string;

  /** Human-readable title */
  title: string;

  /** Control description */
  description: string;

  /** Pass/fail/skip/error status */
  status: CanonicalStatus;

  /** Severity (normalized to CVSS-like scale) */
  severity: CanonicalSeverity;

  /** Source tool metadata */
  source: {
    tool: string;
    version?: string;
    rawId: string;
    rawStatus: string;
    timestamp: string;
  };

  /** Framework mappings (deduplicated) */
  frameworks: Array<{
    framework: string;
    controlId: string;
    controlName?: string;
  }>;

  /** Evidence chain */
  evidence: {
    type: EvidenceType;
    summary: string;
    hash?: string;
  };

  /** Assurance metadata */
  assurance: {
    level: AssuranceLevel;
    provenance: ProvenanceSource;
  };
}

// =============================================================================
// NORMALIZED EVIDENCE (document-level output)
// =============================================================================

/** Metadata about the normalization result */
export interface NormalizedMetadata {
  /** Original tool/format that produced the evidence */
  sourceFormat: string;

  /** Document title from the ingested document */
  title: string;

  /** Who issued/produced the evidence */
  issuer: string;

  /** Assessment date (ISO 8601) */
  date: string;

  /** Scope description */
  scope: string;

  /** SHA-256 hash of the original document */
  documentHash?: string;

  /** Tool-declared assurance level from parser */
  toolAssuranceLevel: AssuranceLevel;

  /** Summary statistics */
  stats: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
  };
}

/** The complete normalized evidence output */
export interface NormalizedEvidence {
  controls: CanonicalControlEvidence[];
  metadata: NormalizedMetadata;
}
