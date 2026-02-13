/**
 * Ingestion Module — Evidence → CPOE Pipeline
 *
 * Barrel exports for the ingestion layer.
 * Core: types (canonical format), assurance-calculator (provenance + freshness),
 * mapper (IngestedDocument → MarqueGeneratorInput), json-parser (tool adapters).
 *
 * PDF-specific code was DELETED on Feb 12, 2026.
 * Enrichment code (per-control classification, dimensions, anti-gaming) was
 * SHELVED on Feb 13, 2026 — tool adapters now declare assurance levels.
 */

export type {
  DocumentSource,
  AssuranceLevel,
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
} from "./assurance-calculator";
export type { FreshnessAssessment } from "./assurance-calculator";
