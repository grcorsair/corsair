/**
 * Ingestion Module — Evidence → Classification → CPOE Pipeline
 *
 * Barrel exports for the ingestion layer.
 * Core: types (canonical format), assurance-calculator (L0-L4 classification),
 * mapper (IngestedDocument → MarqueGeneratorInput), json-parser (tool adapters).
 *
 * PDF-specific code (pdf-extractor, soc2-parser, batch-processor, cli)
 * was DELETED on Feb 12, 2026 — see memory/corsair-pdf-scrapped.md
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
  MethodologyTier,
  EvidenceClassification,
  SampleSizeResult,
  BoilerplateResult,
} from "./types";

export { mapToMarqueInput } from "./mapper";
export type { MapperOptions } from "./mapper";

export { parseJSON } from "./json-parser";
export type { ParseJSONOptions } from "./json-parser";

export {
  calculateAssuranceLevel,
  calculateDocumentAssurance,
  calculateDocumentRollup,
  deriveProvenance,
  assessFreshness,
  classifyEvidenceContent,
  extractSampleSize,
  detectBoilerplate,
  applyDimensionGating,
  classifyAssessmentDepth,
  computeProvenanceQuality,
  runBinaryChecks,
  computeDoraMetrics,
} from "./assurance-calculator";
export type { FreshnessAssessment } from "./assurance-calculator";
