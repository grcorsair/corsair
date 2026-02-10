/**
 * Ingestion Module — Document → CPOE Pipeline
 *
 * Barrel exports for the ingestion layer.
 * New parsers should be added here as they're built.
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

export { parseSOC2, parseSOC2FromText } from "./soc2-parser";
export type { SOC2ParserOptions } from "./soc2-parser";

export { readPDF } from "./pdf-extractor";
export type { ExtractedPDF } from "./pdf-extractor";

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

export type {
  MethodologyTier,
  EvidenceClassification,
  SampleSizeResult,
  BoilerplateResult,
} from "./types";

export { processBatch } from "./batch-processor";
export type { BatchOptions, BatchResult } from "./batch-processor";
