/**
 * Minimum Ingestion Contract — Required Evidence Fields
 *
 * Ensures evidence has the minimum metadata required to be meaningful:
 * - source identity (issuer or auditor)
 * - assessment date
 * - scope
 *
 * This does not validate control contents or mapping correctness.
 */

import type { IngestedDocument } from "./types";
import { deriveSourceTier, type SourceTier } from "./source-tier";

export interface IngestionContractOptions {
  /** Enforce failures as errors instead of warnings */
  strict?: boolean;

  /** Raw input metadata warnings (pre-parse) */
  inputMetadataWarnings?: string[];
}

export interface IngestionContractResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  sourceTier: SourceTier;
}

const knownMissingIssuer = "Missing issuer";
const knownMissingScope = "Missing scope";
const knownMissingDate = "Missing or invalid assessment date";

export function validateIngestionContract(
  doc: IngestedDocument,
  options?: IngestionContractOptions,
): IngestionContractResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const addIssue = (message: string) => {
    if (options?.strict) errors.push(message);
    else warnings.push(message);
  };

  const sourceTierOverride = resolveSourceTierOverride(doc.extensions);
  const sourceTier = deriveSourceTier(doc.source, sourceTierOverride);
  const metadata = doc.metadata;

  let missingIssuer = isBlankOrUnknown(metadata.auditor) && isBlankOrUnknown(metadata.issuer);
  let missingScope = isBlankOrUnknown(metadata.scope);
  let invalidDate = isInvalidDate(metadata.date);

  const inputWarnings = options?.inputMetadataWarnings ?? [];
  if (inputWarnings.some((w) => w.includes(knownMissingIssuer))) missingIssuer = true;
  if (inputWarnings.some((w) => w.includes(knownMissingScope))) missingScope = true;
  if (inputWarnings.some((w) => w.includes(knownMissingDate))) invalidDate = true;

  if (missingIssuer) {
    addIssue("Missing issuer in evidence metadata; provenance identity will be weak.");
  }
  if (missingScope) {
    addIssue("Missing scope in evidence metadata; subject scope will be weak.");
  }
  if (invalidDate) {
    addIssue("Missing or invalid assessment date in metadata; freshness cannot be assessed.");
  }

  // Tier-specific guidance (warnings only)
  if (sourceTier === "human") {
    const missingAuditor = isBlankOrUnknown(metadata.auditor);
    if (missingAuditor) {
      warnings.push("Missing auditor for human-reviewed evidence; include metadata.auditor when available.");
    }
  }

  if (sourceTier === "unknown") {
    warnings.push("Unknown source tier; set mapping.sourceTier for clearer classification.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sourceTier,
  };
}

function isBlankOrUnknown(value?: string): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return lower === "unknown" || lower === "n/a" || lower === "na";
}

function isInvalidDate(value?: string): boolean {
  if (!value) return true;
  const parsed = new Date(value);
  return isNaN(parsed.getTime());
}

function resolveSourceTierOverride(extensions?: Record<string, unknown>): SourceTier | undefined {
  if (!extensions || typeof extensions !== "object") return undefined;
  const mapping = (extensions as { mapping?: { sourceTier?: unknown } }).mapping;
  if (!mapping) return undefined;
  const tier = mapping.sourceTier;
  if (typeof tier !== "string") return undefined;
  const allowed: SourceTier[] = ["native", "tool", "platform", "human", "unknown"];
  return allowed.includes(tier as SourceTier) ? (tier as SourceTier) : undefined;
}
