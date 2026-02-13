/**
 * Query Engine Types — search, filter, aggregate, and sort over normalized evidence.
 *
 * The Q in: Normalize → Classify → Score → Query → Signal
 */

import type {
  CanonicalControlEvidence,
  CanonicalStatus,
  CanonicalSeverity,
  EvidenceType,
  ProvenanceSource,
} from "../normalize/types";
import type { AssuranceLevel } from "../ingestion/types";

/** Query parameters for filtering, sorting, and paginating evidence */
export interface EvidenceQuery {
  /** Filter by status */
  status?: CanonicalStatus | CanonicalStatus[];

  /** Filter by severity */
  severity?: CanonicalSeverity | CanonicalSeverity[];

  /** Filter by framework (union — control matches if mapped to ANY listed framework) */
  framework?: string | string[];

  /** Filter by provenance source */
  provenance?: ProvenanceSource | ProvenanceSource[];

  /** Filter by minimum assurance level (inclusive) */
  minAssurance?: AssuranceLevel;

  /** Filter by evidence type */
  evidenceType?: EvidenceType | EvidenceType[];

  /** Text search across controlId, title, description (case-insensitive substring) */
  search?: string;

  /** Sort field */
  sortBy?: "controlId" | "severity" | "status" | "assurance";

  /** Sort direction (default: asc) */
  sortDirection?: "asc" | "desc";

  /** Pagination: max results to return */
  limit?: number;

  /** Pagination: skip this many results */
  offset?: number;
}

/** Aggregation counts across multiple dimensions */
export interface QueryAggregations {
  byStatus: Record<CanonicalStatus, number>;
  bySeverity: Record<CanonicalSeverity, number>;
  byFramework: Record<string, number>;
  byProvenance: Record<ProvenanceSource, number>;
  byAssurance: Record<string, number>;
}

/** Result of a query against normalized evidence */
export interface QueryResult {
  /** Matched controls (after filtering, sorting, pagination) */
  controls: CanonicalControlEvidence[];

  /** Total matches before pagination */
  total: number;

  /** Aggregations computed on the FILTERED set */
  aggregations: QueryAggregations;
}
