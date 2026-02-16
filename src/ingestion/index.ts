/**
 * Ingestion Module — Evidence → CPOE Pipeline
 *
 * Barrel exports for the ingestion layer.
 * Core: types (canonical format), provenance utils (provenance + freshness),
 * mapper (IngestedDocument → MarqueGeneratorInput), json-parser (tool adapters).
 *
 * PDF-specific code was DELETED on Feb 12, 2026.
 * Enrichment code (per-control classification, dimensions, anti-gaming) was
 * SHELVED on Feb 13, 2026.
 */

export type {
  DocumentSource,
  IngestedDocument,
  DocumentMetadata,
  IngestedControl,
  FrameworkRef,
  AssessmentContext,
  TechStackEntry,
  CompensatingControl,
} from "./types";

export { mapToMarqueInput } from "./mapper";
export type { MapperOptions } from "./mapper";

export { parseJSON } from "./json-parser";
export type { ParseJSONOptions } from "./json-parser";

export {
  deriveProvenance,
  assessFreshness,
  deriveEvidenceTypes,
  deriveEvidenceTypeDistribution,
} from "./provenance-utils";
export type { FreshnessAssessment } from "./provenance-utils";
